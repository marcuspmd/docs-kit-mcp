import { jest } from "@jest/globals";
import { createTestConfig } from "./testHelpers.js";
import type { AnthropicClientLike } from "../ClaudeProvider.js";

type CreateFn = AnthropicClientLike["messages"]["create"];
type CreateReturnType = Awaited<ReturnType<CreateFn>>;

describe("ClaudeProvider", () => {
  let mockAnthropicClient: AnthropicClientLike;
  let mockCreate: jest.Mock<() => Promise<CreateReturnType>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreate = jest.fn<() => Promise<CreateReturnType>>().mockResolvedValue({
      content: [{ type: "text", text: "Test response from Claude" }],
    } as CreateReturnType);

    mockAnthropicClient = {
      messages: {
        create: mockCreate as unknown as CreateFn,
      },
    };

    jest.unstable_mockModule("@anthropic-ai/sdk", () => ({
      default: jest.fn().mockReturnValue(mockAnthropicClient),
    }));

    global.fetch = jest.fn() as typeof global.fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send chat message to Claude API", async () => {
    const { ClaudeProvider } = await import("../ClaudeProvider.js");

    const config = createTestConfig({
      provider: "claude",
      apiKey: "test-key",
      model: "claude-sonnet-4-20250514",
      maxTokens: 2000,
      temperature: 0.7,
    });

    const provider = new ClaudeProvider(config, mockAnthropicClient);

    const result = await provider.chat([{ role: "user", content: "Hello Claude" }]);

    expect(result).toBe("Test response from Claude");
    expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
      }),
    );
  });

  it("should handle system messages correctly", async () => {
    const { ClaudeProvider } = await import("../ClaudeProvider.js");

    const config = createTestConfig({
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      maxTokens: 2000,
    });

    const provider = new ClaudeProvider(config, mockAnthropicClient);

    await provider.chat([
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ]);

    expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are a helpful assistant",
      }),
    );
  });

  it("should throw error when Voyage API key is missing for embeddings", async () => {
    const { ClaudeProvider } = await import("../ClaudeProvider.js");
    delete process.env.VOYAGE_API_KEY;

    const config = createTestConfig({
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      maxTokens: 2000,
    });

    const provider = new ClaudeProvider(config, mockAnthropicClient);

    await expect(provider.embed(["text1", "text2"])).rejects.toThrow(
      "Voyage API key not configured",
    );
  });

  it("should send embedding request to Voyage API", async () => {
    process.env.VOYAGE_API_KEY = "test-voyage-key";
    const { ClaudeProvider } = await import("../ClaudeProvider.js");

    const mockFetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
        }),
    } as Response);
    global.fetch = mockFetch;

    const config = createTestConfig({
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      maxTokens: 2000,
      embeddingModel: "voyage-3",
    });

    const provider = new ClaudeProvider(config, mockAnthropicClient);

    const result = await provider.embed(["text1", "text2"]);

    expect(result).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledWith("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: expect.objectContaining({
        Authorization: expect.stringContaining("Bearer test-voyage-key"),
      }),
      body: expect.stringContaining("voyage-3"),
    });
  });

  it("should handle response with missing embeddings", async () => {
    process.env.VOYAGE_API_KEY = "test-voyage-key";
    const { ClaudeProvider } = await import("../ClaudeProvider.js");

    const mockFetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      json: () => Promise.resolve({ data: undefined }),
    } as Response);
    global.fetch = mockFetch;

    const config = createTestConfig({
      provider: "claude",
      model: "claude-sonnet-4-20250514",
    });

    const provider = new ClaudeProvider(config, mockAnthropicClient);

    const result = await provider.embed(["text1", "text2"]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([]);
    expect(result[1]).toEqual([]);
  });
});
