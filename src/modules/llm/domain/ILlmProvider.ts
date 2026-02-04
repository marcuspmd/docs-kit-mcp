export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  provider: "openai" | "claude" | "gemini" | "ollama";
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * LLM Provider Interface
 *
 * Abstract interface for different LLM providers.
 */
export interface ILlmProvider {
  /**
   * Send chat messages and receive response
   */
  chat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string>;

  /**
   * Generate embeddings for texts
   */
  embed?(texts: string[]): Promise<number[][]>;

  /**
   * Get model name
   */
  getModel(): string;
}
