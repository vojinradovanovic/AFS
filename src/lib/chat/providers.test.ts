import { describe, expect, it } from "vitest";
import { resolveChatProvider } from "./providers";

describe("chat provider selection", () => {
  it("keeps OpenAI as the default", () => {
    expect(resolveChatProvider(undefined).model).toBe("openai/gpt-6-astra");
  });
  it("routes Anthropic to Claude", () => {
    expect(resolveChatProvider("anthropic").model).toBe("anthropic/claude-sonnet-5");
  });
  it("routes Google to Gemini", () => {
    expect(resolveChatProvider("google").model).toBe("google/gemini-3-flash-preview");
  });
  it("rejects unlisted vendors rather than silently switching", () => {
    expect(() => resolveChatProvider("unknown")).toThrow();
  });
});
