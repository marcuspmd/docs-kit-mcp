import { describe, it, expect } from "@jest/globals";
import { OpenAiProvider } from "../OpenAiProvider.js";

/**
 * OpenAiProvider Integration Tests
 *
 * Note: These are simplified tests. Full integration tests with OpenAI
 * would require API keys and make real API calls.
 * For unit tests with mocks, we'd need to refactor OpenAiProvider to use DI.
 */
describe("OpenAiProvider", () => {
  describe("configuration", () => {
    it("should initialize with config", () => {
      const provider = new OpenAiProvider({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test-key",
      });

      expect(provider).toBeDefined();
      expect(provider.getModel()).toBe("gpt-4o-mini");
    });

    it("should use default model when not provided", () => {
      const provider = new OpenAiProvider({
        provider: "openai",
        model: "",
        apiKey: "test-key",
      });

      expect(provider.getModel()).toBe("gpt-4o-mini");
    });
  });

  describe("error handling", () => {
    it("should throw error when API call fails", async () => {
      const provider = new OpenAiProvider({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "invalid-key",
      });

      await expect(provider.chat([{ role: "user", content: "test" }])).rejects.toThrow();
    });
  });
});
