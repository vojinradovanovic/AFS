import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type ModelMessage } from "ai";
import { resolveChatProvider, type ChatProvider } from "./providers";
import { createResponsesCall } from "./responses.ts";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.ts";

export function createProviderCall(
  request: Request,
  config: {
    baseURL: string;
    apiKey: string;
    provider: ChatProvider;
    onResponse?: (response: Response) => Promise<void>;
  },
  messages: ModelMessage[],
  instructions: string,
) {
  const selected = resolveChatProvider(config.provider);
  if (selected.provider === "openai") {
    return createResponsesCall(
      request,
      { ...config, model: selected.model },
      messages,
      instructions,
    );
  }
  const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const headers = { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" };
  const fetchWithAccessCheck: typeof fetch = async (input, init) => {
    const response = await gateway.fetch(input, init);
    await config.onResponse?.(response.clone());
    return response;
  };
  const baseURL = `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;
  const model =
    selected.provider === "anthropic"
      ? createAnthropic({ baseURL, apiKey: config.apiKey, headers, fetch: fetchWithAccessCheck })(
          selected.model,
        )
      : createOpenAICompatible({ name: "lovable", baseURL, headers, fetch: fetchWithAccessCheck })(
          selected.model,
        );
  const result = streamText({
    model,
    system: instructions,
    messages,
    abortSignal: request.signal,
    maxRetries: 0,
    ...(selected.provider === "anthropic" ? { maxOutputTokens: 16000 } : {}),
  });
  return { result, gateway };
}
