---
title: LLM - Abstração de Provedores
module: llm
lastUpdated: 2026-02-01
symbols:
  - createLlmProvider
  - LlmProvider
---

# LLM - Abstração de Provedores de IA

> O módulo LLM fornece uma interface unificada para múltiplos provedores de LLM (OpenAI, Claude, Gemini, Ollama).

## Visão Geral

O módulo LLM (`src/llm/`) implementa o padrão **Strategy + Factory** para permitir:

1. **Troca transparente** entre provedores
2. **Interface consistente** (chat, embeddings)
3. **Configuração centralizada**
4. **Fallback automático** (opcional)

## Arquitetura

```typescript
Config
  ↓
createLlmProvider() [Factory]
  ↓
LlmProvider [Strategy Interface]
  ├─ OpenAIProvider
  ├─ ClaudeProvider
  ├─ GeminiProvider
  └─ OllamaProvider
```

## Interface

**Provider Interface:**
```typescript
interface LlmProvider {
  // Chat completion
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null>;

  // Embeddings (for RAG)
  embed(texts: string[]): Promise<number[][]>;

  // Provider info
  info(): { provider: string; model: string; embeddingModel?: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;      // 0-2 (default: 0.7)
  maxTokens?: number;        // Max response tokens
  topP?: number;             // Nucleus sampling (0-1)
  frequencyPenalty?: number; // -2 to 2
  presencePenalty?: number;  // -2 to 2
}
```

## Factory

**Criação:**
```typescript
function createLlmProvider(config: Config): LlmProvider
```

**Implementation:**
```typescript
// src/llm/provider.ts
export function createLlmProvider(config: Config): LlmProvider {
  const { provider, model, apiKey, embeddingModel } = config.llm;

  switch (provider) {
    case "openai":
      return new OpenAIProvider({
        apiKey: apiKey || process.env.OPENAI_API_KEY!,
        model,
        embeddingModel: embeddingModel || "text-embedding-ada-002"
      });

    case "claude":
      return new ClaudeProvider({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY!,
        model,
        // Claude usa Voyage AI para embeddings
        voyageApiKey: process.env.VOYAGE_API_KEY!,
        embeddingModel: embeddingModel || "voyage-2"
      });

    case "gemini":
      return new GeminiProvider({
        apiKey: apiKey || process.env.GEMINI_API_KEY!,
        model,
        embeddingModel: embeddingModel || "embedding-001"
      });

    case "ollama":
      return new OllamaProvider({
        baseUrl: config.llm.baseUrl || "http://localhost:11434",
        model,
        embeddingModel: embeddingModel || "nomic-embed-text"
      });

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
```

## Providers

### 1. OpenAI Provider (`providers/OpenAIProvider.ts`)

```typescript
import OpenAI from "openai";

export class OpenAIProvider implements LlmProvider {
  private client: OpenAI;
  private model: string;
  private embeddingModel: string;

  constructor(options: {
    apiKey: string;
    model: string;
    embeddingModel: string;
  }) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model;
    this.embeddingModel = options.embeddingModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty
      });

      return response.choices[0]?.message?.content || null;
    } catch (err) {
      console.error("OpenAI chat error:", err);
      return null;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts
      });

      return response.data.map(d => d.embedding);
    } catch (err) {
      console.error("OpenAI embed error:", err);
      throw err;
    }
  }

  info() {
    return {
      provider: "openai",
      model: this.model,
      embeddingModel: this.embeddingModel
    };
  }
}
```

**Supported Models:**
- `gpt-4` (high quality, expensive)
- `gpt-4-turbo` (balance)
- `gpt-3.5-turbo` (fast, cheap)

**Embeddings:**
- `text-embedding-ada-002` (1536 dims)
- `text-embedding-3-small` (512-1536 dims)
- `text-embedding-3-large` (256-3072 dims)

### 2. Claude Provider (`providers/ClaudeProvider.ts`)

```typescript
import Anthropic from "@anthropic-ai/sdk";

export class ClaudeProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;
  private voyageClient: VoyageAI; // For embeddings
  private embeddingModel: string;

  constructor(options: {
    apiKey: string;
    model: string;
    voyageApiKey: string;
    embeddingModel: string;
  }) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model;
    this.voyageClient = new VoyageAI({ apiKey: options.voyageApiKey });
    this.embeddingModel = options.embeddingModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null> {
    try {
      // Claude requires system message separate
      const systemMessage = messages.find(m => m.role === "system");
      const userMessages = messages.filter(m => m.role !== "system");

      const response = await this.client.messages.create({
        model: this.model,
        system: systemMessage?.content,
        messages: userMessages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 4096
      });

      return response.content[0]?.text || null;
    } catch (err) {
      console.error("Claude chat error:", err);
      return null;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      // Use Voyage AI for embeddings (Claude doesn't have native embeddings)
      const response = await this.voyageClient.embed({
        model: this.embeddingModel,
        input: texts
      });

      return response.data.map(d => d.embedding);
    } catch (err) {
      console.error("Voyage embed error:", err);
      throw err;
    }
  }

  info() {
    return {
      provider: "claude",
      model: this.model,
      embeddingModel: this.embeddingModel
    };
  }
}
```

**Supported Models:**
- `claude-3-opus-20240229` (highest quality)
- `claude-3-sonnet-20240229` (balance)
- `claude-3-haiku-20240307` (fastest)

### 3. Gemini Provider (`providers/GeminiProvider.ts`)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider implements LlmProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private embeddingModel: string;

  constructor(options: {
    apiKey: string;
    model: string;
    embeddingModel: string;
  }) {
    this.client = new GoogleGenerativeAI(options.apiKey);
    this.model = options.model;
    this.embeddingModel = options.embeddingModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });

      // Convert messages to Gemini format
      const history = messages.slice(0, -1).map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens,
          topP: options?.topP
        }
      });

      const result = await chat.sendMessage(lastMessage.content);
      return result.response.text();
    } catch (err) {
      console.error("Gemini chat error:", err);
      return null;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const model = this.client.getGenerativeModel({ model: this.embeddingModel });

      const results = await Promise.all(
        texts.map(async (text) => {
          const result = await model.embedContent(text);
          return result.embedding.values;
        })
      );

      return results;
    } catch (err) {
      console.error("Gemini embed error:", err);
      throw err;
    }
  }

  info() {
    return {
      provider: "gemini",
      model: this.model,
      embeddingModel: this.embeddingModel
    };
  }
}
```

**Supported Models:**
- `gemini-1.5-pro` (best quality)
- `gemini-1.5-flash` (fast)
- `gemini-1.0-pro` (legacy)

### 4. Ollama Provider (`providers/OllamaProvider.ts`)

```typescript
export class OllamaProvider implements LlmProvider {
  private baseUrl: string;
  private model: string;
  private embeddingModel: string;

  constructor(options: {
    baseUrl: string;
    model: string;
    embeddingModel: string;
  }) {
    this.baseUrl = options.baseUrl;
    this.model = options.model;
    this.embeddingModel = options.embeddingModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens,
            top_p: options?.topP
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.message?.content || null;
    } catch (err) {
      console.error("Ollama chat error:", err);
      return null;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const results = await Promise.all(
        texts.map(async (text) => {
          const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: this.embeddingModel,
              prompt: text
            })
          });

          if (!response.ok) {
            throw new Error(`Ollama embed error: ${response.statusText}`);
          }

          const data = await response.json();
          return data.embedding;
        })
      );

      return results;
    } catch (err) {
      console.error("Ollama embed error:", err);
      throw err;
    }
  }

  info() {
    return {
      provider: "ollama",
      model: this.model,
      embeddingModel: this.embeddingModel
    };
  }
}
```

**Supported Models:**
- `llama3:8b` (8B params, good balance)
- `llama3:70b` (70B params, high quality)
- `mistral` (7B params, fast)
- `codellama` (code-specialized)
- `nomic-embed-text` (embeddings)

## Configuration

**In `docs.config.js`:**
```javascript
export default {
  llm: {
    provider: "openai",           // or "claude", "gemini", "ollama"
    model: "gpt-4-turbo",
    embeddingModel: "text-embedding-ada-002",
    apiKey: process.env.OPENAI_API_KEY, // or config value
    baseUrl: "http://localhost:11434"   // for ollama
  }
};
```

**Environment Variables:**
```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Claude
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...  # For embeddings

# Gemini
GEMINI_API_KEY=...

# Ollama (local, no key needed)
# Just run: ollama serve
```

## Usage Examples

**Chat:**
```typescript
const llm = createLlmProvider(config);

const response = await llm.chat([
  { role: "system", content: "You are a helpful coding assistant." },
  { role: "user", content: "Explain this code: const sum = (a, b) => a + b;" }
]);

console.log(response);
// "This is an arrow function that takes two parameters..."
```

**Embeddings:**
```typescript
const llm = createLlmProvider(config);

const embeddings = await llm.embed([
  "How do I create an order?",
  "Order creation process",
  "Payment processing"
]);

console.log(embeddings.length); // 3
console.log(embeddings[0].length); // 1536 (for ada-002)
```

**With Options:**
```typescript
const response = await llm.chat(messages, {
  temperature: 0.2,      // More deterministic
  maxTokens: 500,        // Shorter response
  topP: 0.95
});
```

## Testing

**Dependency Injection:**
```typescript
// In tests
import { jest } from "@jest/globals";

const mockLlm: LlmProvider = {
  chat: jest.fn().mockResolvedValue("Mock response"),
  embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  info: () => ({ provider: "mock", model: "mock" })
};

const updater = createDocUpdater({ llm: mockLlm });
```

## Cost Optimization

**Token Limits:**
```typescript
// Set aggressive limits for cost control
const response = await llm.chat(messages, {
  maxTokens: 150  // Limit response size
});
```

**Cheap Provider for Bulk:**
```typescript
// Use gpt-3.5-turbo for simple tasks
const cheapConfig = { ...config, llm: { ...config.llm, model: "gpt-3.5-turbo" }};
const cheapLlm = createLlmProvider(cheapConfig);
```

**Local Ollama for Dev:**
```typescript
// No cost, fully local
const devConfig = {
  llm: {
    provider: "ollama",
    model: "llama3:8b",
    embeddingModel: "nomic-embed-text",
    baseUrl: "http://localhost:11434"
  }
};
```

## Error Handling

All providers return `null` on chat error (logged to console). Embeddings throw on error.

**Retry Logic (Future):**
```typescript
async function chatWithRetry(llm: LlmProvider, messages: ChatMessage[], retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await llm.chat(messages);
    if (response) return response;
    await sleep(1000 * (i + 1)); // Exponential backoff
  }
  throw new Error("LLM chat failed after retries");
}
```

## Extensibility

**Adding New Provider:**

1. Create `src/llm/providers/MyProvider.ts`:
```typescript
export class MyProvider implements LlmProvider {
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null> {
    // Implementation
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Implementation
  }

  info() {
    return { provider: "my-provider", model: this.model };
  }
}
```

2. Register in factory (`src/llm/provider.ts`):
```typescript
case "my-provider":
  return new MyProvider({ ... });
```

3. Update Config schema (`src/config.ts`):
```typescript
provider: z.enum(["openai", "claude", "gemini", "ollama", "my-provider"])
```

## Referências

- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Claude API](https://docs.anthropic.com/claude/reference)
- [Gemini API](https://ai.google.dev/docs)
- [Ollama](https://ollama.com/)
