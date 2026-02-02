/**
 * Configuration validation utilities
 */

/**
 * Check if LLM is properly configured with credentials.
 * Returns true only if the provider has the necessary credentials available.
 */
export function isLlmConfigured(config: {
  llm: { provider: string; apiKey?: string; baseUrl?: string };
}): boolean {
  if (config.llm.provider === "none") return false;

  const hasOllamaConfigured = config.llm.provider === "ollama" && !!config.llm.baseUrl;
  const hasOpenAiConfigured =
    config.llm.provider === "openai" && !!(config.llm.apiKey || process.env.OPENAI_API_KEY);
  const hasGeminiConfigured =
    config.llm.provider === "gemini" && !!(config.llm.apiKey || process.env.GEMINI_API_KEY);
  const hasClaudeConfigured = config.llm.provider === "claude" && !!process.env.VOYAGE_API_KEY;

  return hasOllamaConfigured || hasOpenAiConfigured || hasGeminiConfigured || hasClaudeConfigured;
}
