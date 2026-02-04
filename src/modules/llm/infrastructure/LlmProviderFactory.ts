import type { ILlmProvider, LlmConfig } from "../domain/ILlmProvider.js";
import { OpenAiProvider } from "./OpenAiProvider.js";

/**
 * Create LLM Provider based on configuration
 */
export function createLlmProvider(config: LlmConfig): ILlmProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAiProvider(config);

    case "claude":
      // TODO: Implement Claude provider
      throw new Error("Claude provider not yet implemented");

    case "gemini":
      // TODO: Implement Gemini provider
      throw new Error("Gemini provider not yet implemented");

    case "ollama":
      // TODO: Implement Ollama provider
      throw new Error("Ollama provider not yet implemented");

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
