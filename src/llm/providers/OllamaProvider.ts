import type { Config } from "../../config.js";
import type { LlmProvider } from "../provider.js";

export class OllamaProvider implements LlmProvider {
  private baseUrl: string;

  constructor(private config: Config) {
    this.baseUrl = this.config.llm.baseUrl ?? "http://localhost:11434";
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.llm.model || "llama3",
        messages,
        stream: false,
        options: {
          num_predict: opts?.maxTokens ?? this.config.llm.maxTokens,
          temperature: opts?.temperature ?? this.config.llm.temperature,
        },
      }),
    });
    const json = (await res.json()) as { message?: { content?: string } };
    return json.message?.content?.trim() ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.llm.embeddingModel || "nomic-embed-text",
          prompt: text,
        }),
      });
      const json = (await res.json()) as { embedding?: number[] };
      results.push(json.embedding ?? []);
    }
    return results;
  }
}
