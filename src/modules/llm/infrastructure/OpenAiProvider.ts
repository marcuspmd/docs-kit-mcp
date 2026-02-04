import OpenAI from "openai";
import type { ILlmProvider, ChatMessage, LlmConfig } from "../domain/ILlmProvider.js";

/**
 * OpenAI LLM Provider
 *
 * Implements LLM provider interface using OpenAI API.
 */
export class OpenAiProvider implements ILlmProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: LlmConfig) {
    this.model = config.model || "gpt-4o-mini";
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  async chat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("OpenAI chat error:", error);
      throw new Error(
        `OpenAI API failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error("OpenAI embed error:", error);
      throw new Error(
        `OpenAI embedding failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getModel(): string {
    return this.model;
  }
}
