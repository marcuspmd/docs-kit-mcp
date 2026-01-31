import type { Config } from "../../config.js";
import type { LlmProvider } from "../provider.js";
import OpenAI from "openai";

type OpenAIClient = InstanceType<typeof OpenAI>;

export class OpenAiProvider implements LlmProvider {
  private client: OpenAIClient | undefined;

  constructor(
    private config: Config,
    client?: OpenAIClient,
  ) {
    if (client) this.client = client;
  }

  private getClient() {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.config.llm.apiKey || process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const client = this.getClient();
    const res = await client.chat.completions.create({
      model: this.config.llm.model,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      max_tokens: opts?.maxTokens ?? this.config.llm.maxTokens,
      temperature: opts?.temperature ?? this.config.llm.temperature,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const client = this.getClient();
    const model = this.config.llm.embeddingModel ?? "text-embedding-ada-002";
    const res = await client.embeddings.create({ model, input: texts });
    return res.data.map((d: { embedding: number[] }) => d.embedding);
  }
}
