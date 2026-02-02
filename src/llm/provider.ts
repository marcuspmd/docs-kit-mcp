import type { ResolvedConfig } from "../configLoader.js";
import { OpenAiProvider } from "./providers/OpenAiProvider.js";
import { OllamaProvider } from "./providers/OllamaProvider.js";
import { GeminiProvider } from "./providers/GeminiProvider.js";
import { ClaudeProvider } from "./providers/ClaudeProvider.js";

export interface LlmProvider {
  chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}

/* ── Factory ────────────────────────────────────────── */

export function createLlmProvider(config: ResolvedConfig): LlmProvider {
  switch (config.llm.provider) {
    case "openai":
      return new OpenAiProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "claude":
      return new ClaudeProvider(config);
    default:
      return new OpenAiProvider(config);
  }
}
