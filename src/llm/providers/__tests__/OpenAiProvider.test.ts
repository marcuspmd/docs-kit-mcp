import { jest } from "@jest/globals";
import { createTestConfig } from "./testHelpers.js";
import type { OpenAIClientLike } from "../OpenAiProvider.js";

type ChatCreateFn = OpenAIClientLike["chat"]["completions"]["create"];
type ChatReturnType = Awaited<ReturnType<ChatCreateFn>>;
type EmbedCreateFn = OpenAIClientLike["embeddings"]["create"];
type EmbedReturnType = Awaited<ReturnType<EmbedCreateFn>>;

describe("OpenAiProvider", () => {
  let mockOpenAIClient: OpenAIClientLike;
  let mockChatCreate: jest.Mock<() => Promise<ChatReturnType>>;
  let mockEmbeddingsCreate: jest.Mock<() => Promise<EmbedReturnType>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChatCreate = jest.fn<() => Promise<ChatReturnType>>().mockResolvedValue({
      choices: [{ message: { content: "Test response from OpenAI" } }],
    } as ChatReturnType);

    mockEmbeddingsCreate = jest.fn<() => Promise<EmbedReturnType>>().mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
    } as EmbedReturnType);

    mockOpenAIClient = {
      chat: {
        completions: {
          create: mockChatCreate as unknown as ChatCreateFn,
        },
      },
      embeddings: {
        create: mockEmbeddingsCreate as unknown as EmbedCreateFn,
      },
    };

    jest.unstable_mockModule("openai", () => ({
      default: jest.fn().mockReturnValue(mockOpenAIClient),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send chat message using gpt-4o", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    const config = createTestConfig({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4o",
      maxTokens: 2000,
      temperature: 0.7,
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    const result = await provider.chat([{ role: "user", content: "Hello OpenAI" }]);

    expect(result).toBe("Test response from OpenAI");
    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        max_tokens: 2000,
        temperature: 0.7,
      }),
    );
  });

  it("should use max_completion_tokens for gpt-5", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    const config = createTestConfig({
      provider: "openai",
      model: "gpt-5-turbo",
      maxTokens: 2000,
      temperature: 0.7,
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    await provider.chat([{ role: "user", content: "Hello" }]);

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-turbo",
        max_completion_tokens: 2000,
      }),
    );

    // Should not include temperature for gpt-5
    const calls = mockChatCreate.mock.calls as unknown[][];
    expect(calls[0][0]).not.toHaveProperty("temperature");
  });

  it("should use max_completion_tokens for o1 models", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    const config = createTestConfig({
      provider: "openai",
      model: "o1-turbo",
      maxTokens: 3000,
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    await provider.chat([{ role: "user", content: "Hello" }]);

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "o1-turbo",
        max_completion_tokens: 3000,
      }),
    );
  });

  it("should handle system, user, and assistant messages", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    const config = createTestConfig({
      provider: "openai",
      model: "gpt-4o",
      maxTokens: 2000,
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    await provider.chat([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "How are you?" },
    ]);

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello" },
          { role: "user", content: "How are you?" },
        ],
      }),
    );
  });

  it("should generate embeddings", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    const config = createTestConfig({
      provider: "openai",
      model: "gpt-4o",
      embeddingModel: "text-embedding-3-small",
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    const result = await provider.embed(["text1", "text2"]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0.1, 0.2, 0.3]);
    expect(result[1]).toEqual([0.4, 0.5, 0.6]);
    expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["text1", "text2"],
    });
  });

  it("should use default embedding model", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    const config = createTestConfig({
      provider: "openai",
      model: "gpt-4o",
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    await provider.embed(["text1", "text2"]);

    expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
      model: "text-embedding-ada-002",
      input: ["text1", "text2"],
    });
  });

  it("should handle empty response content", async () => {
    const { OpenAiProvider } = await import("../OpenAiProvider.js");

    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    } as ChatReturnType);

    const config = createTestConfig({
      provider: "openai",
      model: "gpt-4o",
    });

    const provider = new OpenAiProvider(config, mockOpenAIClient);

    const result = await provider.chat([{ role: "user", content: "Hello" }]);

    expect(result).toBe("");
  });
});
