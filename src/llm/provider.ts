import type { Config } from "../config.js";

export interface LlmProvider {
  chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}

/* ── OpenAI ────────────────────────────────────────── */

function createOpenAiProvider(config: Config): LlmProvider {
  let OpenAI: typeof import("openai").default;

  async function getClient() {
    if (!OpenAI) {
      OpenAI = (await import("openai")).default;
    }
    return new OpenAI({ apiKey: config.llm.apiKey || process.env.OPENAI_API_KEY });
  }

  return {
    async chat(messages, opts) {
      const client = await getClient();
      const res = await client.chat.completions.create({
        model: config.llm.model,
        messages: messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        max_tokens: opts?.maxTokens ?? config.llm.maxTokens,
        temperature: opts?.temperature ?? config.llm.temperature,
      });
      return res.choices[0]?.message?.content?.trim() ?? "";
    },
    async embed(texts) {
      const client = await getClient();
      const model = config.llm.embeddingModel ?? "text-embedding-ada-002";
      const res = await client.embeddings.create({ model, input: texts });
      return res.data.map((d) => d.embedding);
    },
  };
}

/* ── Ollama ─────────────────────────────────────────── */

function createOllamaProvider(config: Config): LlmProvider {
  const baseUrl = config.llm.baseUrl ?? "http://localhost:11434";

  return {
    async chat(messages, opts) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.llm.model || "llama3",
          messages,
          stream: false,
          options: {
            num_predict: opts?.maxTokens ?? config.llm.maxTokens,
            temperature: opts?.temperature ?? config.llm.temperature,
          },
        }),
      });
      const json = (await res.json()) as { message?: { content?: string } };
      return json.message?.content?.trim() ?? "";
    },
    async embed(texts) {
      const results: number[][] = [];
      for (const text of texts) {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.llm.embeddingModel || "nomic-embed-text",
            prompt: text,
          }),
        });
        const json = (await res.json()) as { embedding?: number[] };
        results.push(json.embedding ?? []);
      }
      return results;
    },
  };
}

/* ── Gemini ─────────────────────────────────────────── */

function createGeminiProvider(config: Config): LlmProvider {
  const apiKey = config.llm.apiKey || process.env.GEMINI_API_KEY;

  return {
    async chat(messages, opts) {
      if (!apiKey) throw new Error("Gemini API key not configured. Set GEMINI_API_KEY.");
      const model = config.llm.model || "gemini-pro";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
            maxOutputTokens: opts?.maxTokens ?? config.llm.maxTokens,
            temperature: opts?.temperature ?? config.llm.temperature,
          },
        }),
      });
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    },
    async embed(texts) {
      if (!apiKey) throw new Error("Gemini API key not configured. Set GEMINI_API_KEY.");
      const model = config.llm.embeddingModel || "text-embedding-004";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;
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
    },
  };
}

/* ── Claude + Voyage ────────────────────────────────── */

function createClaudeProvider(config: Config): LlmProvider {
  let Anthropic: typeof import("@anthropic-ai/sdk").default;

  async function getClient() {
    if (!Anthropic) {
      Anthropic = (await import("@anthropic-ai/sdk")).default;
    }
    return new Anthropic({ apiKey: config.llm.apiKey || process.env.ANTHROPIC_API_KEY });
  }

  return {
    async chat(messages, opts) {
      const client = await getClient();

      // Separate system message from the rest
      const systemMessages = messages.filter((m) => m.role === "system");
      const nonSystem = messages.filter((m) => m.role !== "system");

      const res = await client.messages.create({
        model: config.llm.model || "claude-sonnet-4-20250514",
        max_tokens: opts?.maxTokens ?? config.llm.maxTokens,
        ...(systemMessages.length > 0 ? { system: systemMessages.map((m) => m.content).join("\n") } : {}),
        messages: nonSystem.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const block = res.content[0];
      return block?.type === "text" ? block.text.trim() : "";
    },
    async embed(texts) {
      const voyageKey = process.env.VOYAGE_API_KEY;
      if (!voyageKey) throw new Error("Voyage API key not configured. Set VOYAGE_API_KEY.");
      const model = config.llm.embeddingModel || "voyage-3";
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
    },
  };
}

/* ── Factory ────────────────────────────────────────── */

export function createLlmProvider(config: Config): LlmProvider {
  switch (config.llm.provider) {
    case "openai":
      return createOpenAiProvider(config);
    case "ollama":
      return createOllamaProvider(config);
    case "gemini":
      return createGeminiProvider(config);
    case "claude":
      return createClaudeProvider(config);
    default:
      return createOpenAiProvider(config);
  }
}
