import type { ResolvedConfig } from "../../configLoader.js";
import type { LlmProvider } from "../provider.js";

export class GeminiProvider implements LlmProvider {
  private apiKey: string;

  constructor(private config: ResolvedConfig) {
    this.apiKey = this.config.llm.apiKey || process.env.GEMINI_API_KEY!;
    if (!this.apiKey) throw new Error("Gemini API key not configured. Set GEMINI_API_KEY.");
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const model = this.config.llm.model || "gemini-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: opts?.maxTokens ?? this.config.llm.maxTokens,
          temperature: opts?.temperature ?? this.config.llm.temperature,
        },
      }),
    });
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const model = this.config.llm.embeddingModel || "text-embedding-004";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        })),
      }),
    });
    const json = (await res.json()) as {
      embeddings?: Array<{ values?: number[] }>;
    };
    return json.embeddings?.map((e) => e.values ?? []) ?? texts.map(() => []);
  }
}
