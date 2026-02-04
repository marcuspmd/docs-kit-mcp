import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { OpenAiProvider } from "../OpenAiProvider.js";
import type { ChatMessage } from "../../domain/ILlmProvider.js";

// Mock OpenAI
jest.mock("openai", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

type MockCreateFn = jest.MockedFunction<() => Promise<any>>;

describe("OpenAiProvider", () => {
  let provider: OpenAiProvider;
  let mockCreate: MockCreateFn;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require("openai").default;
    const instance = new OpenAI({ apiKey: "test-key" });
    mockCreate = instance.chat.completions.create as MockCreateFn;
    provider = new OpenAiProvider({ provider: "openai", model: "gpt-4o-mini", apiKey: "test-key" });
  });

  describe("chat", () => {
    it("should send messages and return response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Test response",
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages: ChatCompletionMessageParam[] = [{ role: "user", content: "Hello" }];

      const result = await provider.chat(messages);

      expect(result).toBe("Test response");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
      });
    });

    it("should handle API errors", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      await expect(provider.chat(messages)).rejects.toThrow("OpenAI API failed");
    });

    it("should handle missing content in response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {},
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const result = await provider.chat(messages);

      expect(result).toBe("");
    });

    it("should handle empty choices array", async () => {
      const mockResponse = {
        choices: [],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const result = await provider.chat(messages);

      expect(result).toBe("");
    });
  });

  describe("configuration", () => {
    it("should use correct model", () => {
      expect(provider["model"]).toBe("gpt-4o-mini");
    });

    it("should initialize with API key", () => {
      expect(provider["client"]).toBeDefined();
    });
  });
});
