import { jest } from "@jest/globals";
import { OpenRouterProvider } from "../providers/OpenRouterProvider.js";
import type { ResolvedConfig } from "../../configLoader.js";

const cfg = (over: Partial<ResolvedConfig["llm"]> = {}) =>
  ({
    llm: {
      provider: "openrouter",
      apiKey: "k",
      model: "x/y",
      maxTokens: 10,
      temperature: 0.1,
      ...over,
    },
  }) as unknown as ResolvedConfig;

describe("OpenRouterProvider", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("throws without an API key", () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => new OpenRouterProvider(cfg({ apiKey: undefined }))).toThrow(/OPENROUTER_API_KEY/);
  });

  it("posts to chat/completions with bearer auth and returns trimmed content", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: " hi " } }] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const out = await new OpenRouterProvider(cfg()).chat([{ role: "user", content: "q" }]);
    expect(out).toBe("hi");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body as string).model).toBe("x/y");
  });

  it("surfaces API errors", async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 401,
      text: async () => "no",
    })) as unknown as typeof fetch;
    await expect(new OpenRouterProvider(cfg()).chat([])).rejects.toThrow(/401/);
  });
});
