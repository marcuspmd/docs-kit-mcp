/**
 * LLM Provider Interface
 *
 * Abstraction for LLM providers (OpenAI, Claude, Ollama, etc.)
 */
export interface ILlmProvider {
  /**
   * Complete a prompt
   */
  complete(prompt: string): Promise<string>;

  /**
   * Chat completion with message history
   */
  chat(messages: ChatMessage[]): Promise<string>;

  /**
   * Get provider name
   */
  getName(): string;

  /**
   * Get model name
   */
  getModel(): string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * LLM Configuration
 */
export interface LlmConfig {
  provider: "openai" | "claude" | "ollama" | "gemini";
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}
