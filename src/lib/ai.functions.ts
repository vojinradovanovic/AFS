import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const searchSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({ kind: z.enum(["machine", "record", "maintenance"]), id: z.string(), label: z.string() }),
  ),
});
export type SearchResult = z.infer<typeof searchSchema> & { error?: string };

export const askPlant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ question: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const { supabase } = context;
    const [m, r, e] = await Promise.all([
      supabase.from("machines").select("*"),
      supabase.from("paper_records").select("*").order("recorded_at", { ascending: false }).limit(150),
      supabase.from("maintenance_events").select("*").order("starts_at", { ascending: false }).limit(100),
    ]);
    const ctx = [
      "MACHINES:",
      ...(m.data ?? []).map((x) => `[machine:${x.id}] ${x.name} | ${x.line} | ${x.brand} via ${x.protocol} | status ${x.status} | criticality ${x.criticality}/5 | ${x.hours_since_pm}h since PM of ${x.pm_interval_hours}h interval | nominal ${x.nominal_speed}/min | notes: ${x.notes ?? "-"}`),
      "PAPER RECORDS:",
      ...(r.data ?? []).map((x) => `[record:${x.id}] ${x.recorded_at} | ${x.record_type} | ${x.line} | ${x.title} | by ${x.recorded_by ?? "?"} | data ${JSON.stringify(x.data)} | flags ${JSON.stringify(x.flags)}`),
      "MAINTENANCE:",
      ...(e.data ?? []).map((x) => `[maintenance:${x.id}] ${x.kind} | ${x.title} | ${x.starts_at} → ${x.ends_at} | protected ${x.protected} | machine ${x.machine_id} | ${x.notes ?? ""}`),
    ].join("\n");

    try {
      const { streamText, Output } = await import("ai");
      const { gatewayModel, responsesOptions } = await import("./ai.server");
      const result = streamText({
        model: gatewayModel(),
        providerOptions: responsesOptions,
        output: Output.object({ schema: searchSchema }),
        system:
          "You are AFS, an AI assistant for a consumer packaged goods plant. Answer ONLY from the plant data provided. Be concise and specific (numbers, lines, times). If the data does not contain the answer, say so. List every item you used in sources with its exact kind and id from the brackets, and a short label.",
        prompt: `Current time: ${new Date().toISOString()}\n\n${ctx}\n\nQUESTION: ${data.question}`,
      });
      const out = await result.output;
      return out;
    } catch (err) {
      const { friendlyAiError } = await import("./ai.server");
      return { answer: "", sources: [], error: friendlyAiError(err) };
    }
  });

const extractSchema = z.object({
  record_type: z.enum(["weight_check", "batch_sheet", "changeover", "downtime"]),
  title: z.string(),
  line: z.string(),
  recorded_by: z.string().nullable(),
  product: z.string().nullable(),
  target: z.number().nullable(),
  tolerance: z.number().nullable(),
  samples: z.array(z.number()),
  batch: z.string().nullable(),
  mix_temp_c: z.number().nullable(),
  target_temp_c: z.number().nullable(),
  checklist: z.array(z.object({ step: z.string(), done: z.boolean() })),
  machine: z.string().nullable(),
  reason: z.string().nullable(),
  minutes: z.number().nullable(),
});
export type Extracted = z.infer<typeof extractSchema>;

export const extractPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ image: z.string().startsWith("data:image/").max(10_000_000) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ result?: Extracted; error?: string }> => {
    try {
      const { streamText, Output } = await import("ai");
      const { gatewayModel, responsesOptions } = await import("./ai.server");
      const result = streamText({
        model: gatewayModel(),
        providerOptions: responsesOptions,
        output: Output.object({ schema: extractSchema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is a photo of a paper form from a food/CPG production line (hourly weight check, batch sheet, changeover checklist, or downtime log). Transcribe it into the schema. Use null or empty arrays for fields not on the form. Weights in grams, temperatures in °C. Line like 'Line 2'.",
              },
              { type: "image", image: new URL(data.image) },
            ],
          },
        ],
      });
      return { result: await result.output };
    } catch (err) {
      const { friendlyAiError } = await import("./ai.server");
      return { error: friendlyAiError(err) };
    }
  });
