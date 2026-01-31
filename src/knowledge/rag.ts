import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fastGlob from "fast-glob";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type Database from "better-sqlite3";

export interface RagOptions {
  embeddingModel: string;
  chunkSize?: number;
  overlapSize?: number;
  embedFn: (texts: string[]) => Promise<number[][]>;
  db?: Database.Database;
}

export interface SearchResult {
  content: string;
  source: string;
  symbolId?: string;
  score: number;
}

interface StoredChunk {
  content: string;
  source: string;
  symbolId?: string;
  vector: number[];
  hash: string;
}

export interface RagIndex {
  indexSymbols(symbols: CodeSymbol[], sourceCode: Map<string, string>): Promise<void>;
  indexDocs(docsDir: string): Promise<void>;
  search(query: string, topK?: number): Promise<SearchResult[]>;
  chunkCount(): number;
}

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function chunkText(text: string, chunkSize: number, overlapSize: number): string[] {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start += chunkSize - overlapSize;
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function buildSymbolText(sym: CodeSymbol, sourceCode: Map<string, string>): string {
  const parts = [
    `${sym.kind} ${sym.name}`,
    sym.summary ?? "",
    sym.signature ?? "",
    sym.tags?.join(" ") ?? "",
    sym.domain ?? "",
  ];

  const code = sourceCode.get(sym.file);
  if (code) {
    const lines = code.split("\n").slice(sym.startLine - 1, sym.endLine);
    parts.push(lines.join("\n"));
  }

  return parts.filter(Boolean).join("\n");
}

export function createRagIndex(options: RagOptions): RagIndex {
  const chunkSize = options.chunkSize ?? 500;
  const overlapSize = options.overlapSize ?? 50;
  const embedFn = options.embedFn;
  const db = options.db;

  const store: StoredChunk[] = [];
  const indexedHashes = new Set<string>();
  let loadedFromDb = false;

  function loadFromDb(): void {
    if (loadedFromDb || !db) return;
    loadedFromDb = true;
    try {
      const rows = db.prepare("SELECT hash, content, source, symbol_id, vector FROM rag_chunks").all() as Array<{
        hash: string;
        content: string;
        source: string;
        symbol_id: string | null;
        vector: string;
      }>;
      for (const row of rows) {
        if (indexedHashes.has(row.hash)) continue;
        indexedHashes.add(row.hash);
        store.push({
          hash: row.hash,
          content: row.content,
          source: row.source,
          symbolId: row.symbol_id ?? undefined,
          vector: JSON.parse(row.vector),
        });
      }
    } catch {
      // Table may not exist yet
    }
  }

  function persistChunk(chunk: StoredChunk): void {
    if (!db) return;
    try {
      db.prepare(
        "INSERT OR REPLACE INTO rag_chunks (hash, content, source, symbol_id, vector) VALUES (?, ?, ?, ?, ?)",
      ).run(chunk.hash, chunk.content, chunk.source, chunk.symbolId ?? null, JSON.stringify(chunk.vector));
    } catch {
      // Ignore persistence errors
    }
  }

  async function addChunks(texts: string[], source: string, symbolId?: string): Promise<void> {
    loadFromDb();
    const newTexts: Array<{ text: string; hash: string }> = [];

    for (const text of texts) {
      const hash = simpleHash(text + source);
      if (indexedHashes.has(hash)) continue;
      newTexts.push({ text, hash });
    }

    if (newTexts.length === 0) return;

    const vectors = await embedFn(newTexts.map((t) => t.text));

    for (let i = 0; i < newTexts.length; i++) {
      indexedHashes.add(newTexts[i].hash);
      const chunk: StoredChunk = {
        content: newTexts[i].text,
        source,
        symbolId,
        vector: vectors[i],
        hash: newTexts[i].hash,
      };
      store.push(chunk);
      persistChunk(chunk);
    }
  }

  return {
    async indexSymbols(symbols, sourceCode) {
      for (const sym of symbols) {
        const text = buildSymbolText(sym, sourceCode);
        const chunks = chunkText(text, chunkSize, overlapSize);
        await addChunks(chunks, sym.file, sym.id);
      }
    },

    async indexDocs(docsDir) {
      const files = await fastGlob("**/*.md", { cwd: docsDir });
      for (const file of files) {
        const content = await readFile(join(docsDir, file), "utf-8");
        const chunks = chunkText(content, chunkSize, overlapSize);
        await addChunks(chunks, file);
      }
    },

    async search(query, topK = 5) {
      loadFromDb();
      if (store.length === 0) return [];

      const [queryVector] = await embedFn([query]);
      const scored = store.map((chunk) => ({
        content: chunk.content,
        source: chunk.source,
        symbolId: chunk.symbolId,
        score: cosineSimilarity(queryVector, chunk.vector),
      }));

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    },

    chunkCount() {
      loadFromDb();
      return store.length;
    },
  };
}
