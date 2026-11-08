import { createOpenAI } from "@ai-sdk/openai";

const RUN_ID = "X-Lovable-AIG-Run-ID";

export function gatewayModel() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app.");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID)) headers.set(RUN_ID, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID)?.trim() || undefined;
      return res;
    },
  });
  return provider.responses("openai/gpt-6-astra");
}

export const responsesOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
};

export function friendlyAiError(e: unknown): string {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 429) return "The AI is busy right now. Please try again in a minute.";
  if (status === 402) return "AI credits are used up. Add credits in Settings → Plans & credits.";
  if (status === 403) return "AI access is blocked for this workspace.";
  console.error(e);
  return "The AI request failed. Please try again.";
}
