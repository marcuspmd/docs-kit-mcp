import type { ResolvedConfig } from "../../configLoader.js";
import type { LlmProvider } from "../provider.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** OpenRouter exposes an OpenAI-compatible API (https://openrouter.ai/docs). */
export class OpenRouterProvider implements LlmProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(private config: ResolvedConfig) {
    this.apiKey = this.config.llm.apiKey || process.env.OPENROUTER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY.");
    }
    this.baseUrl = (this.config.llm.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "X-Title": "docs-kit",
    };
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.llm.model,
        messages,
        max_tokens: opts?.maxTokens ?? this.config.llm.maxTokens,
        temperature: opts?.temperature ?? this.config.llm.temperature,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const model = this.config.llm.embeddingModel;
    if (!model) {
      throw new Error("OpenRouter embeddings require llm.embeddingModel to be set.");
    }
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter embeddings API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    return (json.data ?? []).map((d) => d.embedding);
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
