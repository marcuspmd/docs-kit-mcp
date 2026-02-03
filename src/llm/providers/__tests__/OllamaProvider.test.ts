import { jest } from "@jest/globals";
import { createTestConfig } from "./testHelpers.js";

describe("OllamaProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as typeof global.fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send chat request to Ollama API", async () => {
    const mockFetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          message: { content: "Response from Ollama" },
        }),
    } as Response);
    global.fetch = mockFetch;

    const { OllamaProvider } = await import("../OllamaProvider.js");
    const config = createTestConfig({
      provider: "ollama",
      model: "llama3",
      maxTokens: 2000,
      temperature: 0.7,
      baseUrl: "http://localhost:11434",
    });

    const provider = new OllamaProvider(config);

    const result = await provider.chat([{ role: "user", content: "test" }]);

    expect(result).toBe("Response from Ollama");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.any(Object),
    );
  });

  it("should embed texts using Ollama API", async () => {
    const mockFetch = jest
      .fn<typeof global.fetch>()
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            embedding: [0.1, 0.2, 0.3],
          }),
      } as Response)
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            embedding: [0.4, 0.5, 0.6],
          }),
      } as Response);
    global.fetch = mockFetch;

    const { OllamaProvider } = await import("../OllamaProvider.js");
    const config = createTestConfig({
      provider: "ollama",
      model: "llama3",
      maxTokens: 2000,
      temperature: 0.7,
      baseUrl: "http://localhost:11434",
    });

    const provider = new OllamaProvider(config);

    const result = await provider.embed(["Text 1", "Text 2"]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0.1, 0.2, 0.3]);
  });

  it("should use default base URL", async () => {
    const mockFetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          message: { content: "Hello" },
        }),
    } as Response);
    global.fetch = mockFetch;

    const { OllamaProvider } = await import("../OllamaProvider.js");
    const config = createTestConfig({
      provider: "ollama",
      model: "llama3",
      maxTokens: 2000,
      temperature: 0.7,
    });

    const provider = new OllamaProvider(config);

    await provider.chat([{ role: "user", content: "test" }]);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.any(Object),
    );
  });
});
