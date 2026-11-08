import { z } from "zod";

export const chatProviderSchema = z.enum(["openai", "anthropic", "google"]);
export type ChatProvider = z.infer<typeof chatProviderSchema>;
export const CHAT_PROVIDERS = {
  openai: { name: "OpenAI", model: "openai/gpt-6-astra", label: "GPT-6 Astra" },
  anthropic: { name: "Anthropic", model: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
  google: {
    name: "Google",
    model: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
  },
} as const;

export function resolveChatProvider(value: unknown) {
  const provider = chatProviderSchema.parse(value ?? "openai");
  return { provider, ...CHAT_PROVIDERS[provider] };
}
