import { describe, it, expect } from "@jest/globals";
import { createLlmProvider } from "../LlmProviderFactory.js";
import { OpenAiProvider } from "../OpenAiProvider.js";

describe("createLlmProvider", () => {
  describe("OpenAI provider", () => {
    it("should create OpenAI provider when API key is provided", () => {
      const provider = createLlmProvider({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test-key",
      });

      expect(provider).toBeInstanceOf(OpenAiProvider);
    });

    it("should create OpenAI provider with default config", () => {
      const provider = createLlmProvider({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test-key",
      });

      expect(provider).toBeInstanceOf(OpenAiProvider);
    });

    it("should create provider with API key from config", () => {
      const provider = createLlmProvider({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test-key",
      });

      expect(provider).toBeInstanceOf(OpenAiProvider);
    });

    it("should throw error for Claude provider (not implemented)", () => {
      expect(() => {
        createLlmProvider({
          provider: "claude",
          model: "claude-3",
          apiKey: "test-key",
        });
      }).toThrow("Claude provider not yet implemented");
    });

    it("should throw error for Gemini provider (not implemented)", () => {
      expect(() => {
        createLlmProvider({
          provider: "gemini",
          model: "gemini-pro",
          apiKey: "test-key",
        });
      }).toThrow("Gemini provider not yet implemented");
    });

    it("should throw error for Ollama provider (not implemented)", () => {
      expect(() => {
        createLlmProvider({
          provider: "ollama",
          model: "llama2",
          apiKey: "test-key",
        });
      }).toThrow("Ollama provider not yet implemented");
    });
  });
});
