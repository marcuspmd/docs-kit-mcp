import { jest } from "@jest/globals";
import { createTestConfig } from "./testHelpers.js";

describe("GeminiProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as typeof global.fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw error when Gemini API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const { GeminiProvider } = await import("../GeminiProvider.js");

    const config = createTestConfig({
      provider: "gemini",
      model: "gemini-pro",
      maxTokens: 2000,
      temperature: 0.7,
    });

    expect(() => {
      new GeminiProvider(config);
    }).toThrow("Gemini API key not configured");
  });

  it("should send chat request to Gemini API", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const mockFetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: "Hello response" }],
              },
            },
          ],
        }),
    } as Response);
    global.fetch = mockFetch;

    const { GeminiProvider } = await import("../GeminiProvider.js");
    const config = createTestConfig({
      provider: "gemini",
      model: "gemini-pro",
      maxTokens: 2000,
      temperature: 0.7,
      apiKey: "test-key",
    });

    const provider = new GeminiProvider(config);

    const result = await provider.chat([{ role: "user", content: "Hello" }]);

    expect(result).toBe("Hello response");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should embed texts using Gemini API", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const mockFetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          embeddings: [{ values: [0.1, 0.2, 0.3] }, { values: [0.4, 0.5, 0.6] }],
        }),
    } as Response);
    global.fetch = mockFetch;

    const { GeminiProvider } = await import("../GeminiProvider.js");
    const config = createTestConfig({
      provider: "gemini",
      model: "gemini-pro",
      maxTokens: 2000,
      temperature: 0.7,
      apiKey: "test-key",
    });

    const provider = new GeminiProvider(config);

    const result = await provider.embed(["Text 1", "Text 2"]);

    expect(result).toHaveLength(2);
  });
});
