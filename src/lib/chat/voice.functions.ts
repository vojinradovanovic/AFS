import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ownedMediaPath, validateMedia } from "./media-rules";
export const transcribeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ path: z.string(), threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!ownedMediaPath(data.path, context.userId, data.threadId))
      throw new Error("This recording is not available.");
    const { data: cached, error: cacheError } = await context.supabase
      .from("voice_transcripts")
      .select("transcript")
      .eq("path", data.path)
      .maybeSingle();
    if (cacheError) throw new Error("Could not read voice note.");
    if (cached) return cached.transcript;
    const { data: block } = await context.supabase
      .from("ai_access_blocks")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (block) throw new Error(block.reason);
    const { data: blob, error } = await context.supabase.storage
      .from("chat-media")
      .download(data.path);
    if (error || !blob) throw new Error("Could not read recording.");
    if (validateMedia(blob.type, blob.size) !== "audio")
      throw new Error("Choose an audio recording.");
    const { transcribe } = await import("./transcribe.server");
    const { readAiStream, MediaAiError } = await import("./media.server");
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured.");
    try {
      const response = await transcribe(
        {
          baseURL: "https://ai.gateway.lovable.dev",
          apiKey: key,
          model: "openai/gpt-transcribe",
          maxFileBytes: 20 * 1024 * 1024,
          audioOnly: true,
        },
        new File([blob], data.path.split("/").at(-1) ?? "voice.wav", { type: blob.type }),
      );
      const transcript = await readAiStream(response, "transcript");
      const { error: saveError } = await context.supabase
        .from("voice_transcripts")
        .insert({ path: data.path, transcript });
      if (saveError) throw new Error("Could not save transcript.");
      return transcript;
    } catch (e) {
      if (e instanceof MediaAiError && [402, 403].includes(e.status)) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("ai_access_blocks")
          .upsert({ user_id: context.userId, reason: e.message, status: e.status });
      }
      throw e;
    }
  });
