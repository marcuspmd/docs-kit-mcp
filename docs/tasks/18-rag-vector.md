# Task 18 — RAG / Vector DB Integration

> **Status:** pending
> **Layer:** Knowledge
> **Priority:** Release 2
> **Depends on:** 02, 15
> **Unblocks:** —

## Pain Point
Developers want to ask natural-language questions about the codebase ("where is the pricing logic?") and get accurate answers. Keyword search fails for conceptual queries. (`start.md §3.1`: "RAG / Vector DB: indexa código + docs em embeddings para busca semântica e Q&A conversacional").

## Objective
Index code and documentation into vector embeddings for semantic search, enabling conversational Q&A over the codebase.

## Technical Hints

```ts
// src/knowledge/rag.ts

export interface RagOptions {
  embeddingModel: string;       // e.g., "text-embedding-3-small"
  chunkSize?: number;           // default: 500 tokens
  overlapSize?: number;         // default: 50 tokens
}

export interface SearchResult {
  content: string;
  source: string;               // file path
  symbolId?: string;
  score: number;
}

export interface RagIndex {
  indexSymbols(symbols: CodeSymbol[], sourceCode: Map<string, string>): Promise<void>;
  indexDocs(docsDir: string): Promise<void>;
  search(query: string, topK?: number): Promise<SearchResult[]>;
}

export function createRagIndex(options: RagOptions): RagIndex;
```

## Files Involved
- `src/knowledge/rag.ts` — RAG indexing and search
- `tests/knowledge.test.ts` — unit tests

## Acceptance Criteria
- [ ] Chunks code and docs into embedding-sized segments
- [ ] Indexes chunks into a vector store
- [ ] `search` returns top-K results ranked by semantic similarity
- [ ] Handles incremental re-indexing (only changed files)
- [ ] Unit tests with mock embeddings

## Scenarios / Examples

```ts
const rag = createRagIndex({ embeddingModel: "text-embedding-3-small" });
await rag.indexSymbols(symbols, sourceCode);
const results = await rag.search("how is order pricing calculated?", 5);
// [{ content: "calculatePrice method...", source: "src/services/pricing.ts", score: 0.92 }]
```
