import type { ResolvedConfig } from "../../configLoader.js";
import type { LlmProvider } from "../provider.js";
import OpenAI from "openai";

type OpenAIClient = InstanceType<typeof OpenAI>;

export class OpenAiProvider implements LlmProvider {
  private client: OpenAIClient | undefined;

  constructor(
    private config: ResolvedConfig,
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
    const maxTokensValue = opts?.maxTokens ?? this.config.llm.maxTokens;

    // GPT-5 and newer models have different parameter requirements
    const isGpt5OrNewer =
      this.config.llm.model.startsWith("gpt-5") ||
      this.config.llm.model.startsWith("o1") ||
      this.config.llm.model.startsWith("o3");

    const baseParams = {
      model: this.config.llm.model,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    };

    // GPT-5+ only accepts temperature=1 (default), so we omit it
    // Older models can use custom temperature values
    const requestParams = isGpt5OrNewer
      ? { ...baseParams, max_completion_tokens: maxTokensValue }
      : {
          ...baseParams,
          max_tokens: maxTokensValue,
          temperature: opts?.temperature ?? this.config.llm.temperature,
        };

    const res = await client.chat.completions.create(requestParams);
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const client = this.getClient();
    const model = this.config.llm.embeddingModel ?? "text-embedding-ada-002";
    const res = await client.embeddings.create({ model, input: texts });
    return res.data.map((d: { embedding: number[] }) => d.embedding);
  }
}
