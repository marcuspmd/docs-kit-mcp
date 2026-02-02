import type { ResolvedConfig } from "../../configLoader.js";
import type { LlmProvider } from "../provider.js";
import Anthropic from "@anthropic-ai/sdk";

type AnthropicClient = InstanceType<typeof Anthropic>;

export class ClaudeProvider implements LlmProvider {
  private client: AnthropicClient | undefined;

  constructor(
    private config: ResolvedConfig,
    client?: AnthropicClient,
  ) {
    if (client) this.client = client;
  }

  private getClient() {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.config.llm.apiKey || process.env.ANTHROPIC_API_KEY,
      });
    }
    return this.client;
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const client = this.getClient();

    // Separate system message from the rest
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const res = await client.messages.create({
      model: this.config.llm.model || "claude-sonnet-4-20250514",
      max_tokens: opts?.maxTokens ?? this.config.llm.maxTokens,
      ...(systemMessages.length > 0
        ? { system: systemMessages.map((m) => m.content).join("\n") }
        : {}),
      messages: nonSystem.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const block = res.content[0];
    return block?.type === "text" ? block.text.trim() : "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const voyageKey = process.env.VOYAGE_API_KEY;
    if (!voyageKey) throw new Error("Voyage API key not configured. Set VOYAGE_API_KEY.");
    const model = this.config.llm.embeddingModel || "voyage-3";
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({ model, input: texts }),
    });
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return json.data?.map((d) => d.embedding ?? []) ?? texts.map(() => []);
  }
}
