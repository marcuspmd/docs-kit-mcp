---
title: Knowledge - Grafo e RAG
module: knowledge
lastUpdated: 2026-02-01
symbols:
  - createKnowledgeGraph
  - createRagIndex
  - buildRelevantContext
---

# Knowledge - Grafo de Conhecimento e RAG

> O módulo Knowledge fornece busca semântica, navegação por dependências e contextualização inteligente.

## Visão Geral

O módulo Knowledge (`src/knowledge/`) oferece:

1. **Knowledge Graph**: Grafo de dependências para navegação e análise de impacto
2. **RAG Index**: Busca semântica em código e docs via embeddings
3. **Context Builder**: Monta contexto relevante para LLMs

## Componentes

### 1. Knowledge Graph (`graph.ts`)

Grafo de dependências entre símbolos.

**Criação:**
```typescript
function createKnowledgeGraph(db: Database): KnowledgeGraph
```

**Interface:**
```typescript
interface KnowledgeGraph {
  // Get all dependencies of a symbol (what it uses)
  getDependencies(symbolId: string, maxDepth?: number): string[];

  // Get all dependents of a symbol (what uses it)
  getDependents(symbolId: string, maxDepth?: number): string[];

  // Get impact radius (all symbols affected if this changes)
  getImpactRadius(symbolId: string, maxDepth: number): string[];

  // Find shortest path between two symbols
  findPath(fromId: string, toId: string): string[] | null;

  // Get subgraph for symbols
  getSubgraph(symbolIds: string[]): {
    nodes: string[];
    edges: Array<{ from: string; to: string; type: string }>;
  };
}
```

**Implementation (Adjacency List):**
```typescript
class KnowledgeGraphImpl implements KnowledgeGraph {
  private outgoing: Map<string, Set<string>>; // symbolId -> dependencies
  private incoming: Map<string, Set<string>>; // symbolId -> dependents

  constructor(db: Database) {
    this.outgoing = new Map();
    this.incoming = new Map();
    this.buildGraph(db);
  }

  private buildGraph(db: Database) {
    const rels = db.prepare(`
      SELECT source_id, target_id, type
      FROM relationships
    `).all() as Array<{ source_id: string; target_id: string; type: string }>;

    for (const rel of rels) {
      // Add to outgoing (source depends on target)
      if (!this.outgoing.has(rel.source_id)) {
        this.outgoing.set(rel.source_id, new Set());
      }
      this.outgoing.get(rel.source_id)!.add(rel.target_id);

      // Add to incoming (target is depended on by source)
      if (!this.incoming.has(rel.target_id)) {
        this.incoming.set(rel.target_id, new Set());
      }
      this.incoming.get(rel.target_id)!.add(rel.source_id);
    }
  }

  getDependencies(symbolId: string, maxDepth = Infinity): string[] {
    const result = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: symbolId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth >= maxDepth) continue;
      visited.add(id);

      const deps = this.outgoing.get(id);
      if (deps) {
        for (const depId of deps) {
          result.add(depId);
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }

    return Array.from(result);
  }

  getDependents(symbolId: string, maxDepth = Infinity): string[] {
    const result = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: symbolId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth >= maxDepth) continue;
      visited.add(id);

      const dependents = this.incoming.get(id);
      if (dependents) {
        for (const depId of dependents) {
          result.add(depId);
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }

    return Array.from(result);
  }

  getImpactRadius(symbolId: string, maxDepth: number): string[] {
    // Impact radius = all dependents (breadth-first)
    return this.getDependents(symbolId, maxDepth);
  }

  findPath(fromId: string, toId: string): string[] | null {
    // BFS to find shortest path
    const queue: Array<{ id: string; path: string[] }> = [
      { id: fromId, path: [fromId] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === toId) {
        return path;
      }

      if (visited.has(id)) continue;
      visited.add(id);

      const deps = this.outgoing.get(id);
      if (deps) {
        for (const depId of deps) {
          queue.push({ id: depId, path: [...path, depId] });
        }
      }
    }

    return null; // No path found
  }

  getSubgraph(symbolIds: string[]) {
    const nodes = new Set<string>(symbolIds);
    const edges: Array<{ from: string; to: string; type: string }> = [];

    // Load relevant relationships from DB
    const db = this.db;
    const placeholders = symbolIds.map(() => "?").join(",");
    const rels = db.prepare(`
      SELECT source_id, target_id, type
      FROM relationships
      WHERE source_id IN (${placeholders})
        OR target_id IN (${placeholders})
    `).all(...symbolIds, ...symbolIds) as Array<{
      source_id: string;
      target_id: string;
      type: string;
    }>;

    for (const rel of rels) {
      nodes.add(rel.source_id);
      nodes.add(rel.target_id);
      edges.push({
        from: rel.source_id,
        to: rel.target_id,
        type: rel.type
      });
    }

    return {
      nodes: Array.from(nodes),
      edges
    };
  }
}
```

**Use Cases:**

**Impact Analysis:**
```typescript
const graph = createKnowledgeGraph(db);
const impactedIds = graph.getImpactRadius("orderService.createOrder", 3);
const impactedSymbols = symbolRepo.findByIds(impactedIds);

console.log(`Changing createOrder affects ${impactedSymbols.length} symbols`);
```

**Dependency Path:**
```typescript
const path = graph.findPath("OrderController", "DatabaseConnection");
if (path) {
  console.log(`Dependency chain: ${path.join(" -> ")}`);
}
```

### 2. RAG Index (`rag.ts`)

Retrieval-Augmented Generation via embeddings.

**Criação:**
```typescript
function createRagIndex(options: {
  embeddingModel: string;
  db: Database;
  embedFn: (texts: string[]) => Promise<number[][]>;
}): RagIndex
```

**Interface:**
```typescript
interface RagIndex {
  // Index symbols (code)
  indexSymbols(
    symbols: CodeSymbol[],
    sources: Map<string, string>
  ): Promise<void>;

  // Index documentation
  indexDocs(docsDir: string): Promise<void>;

  // Search by semantic similarity
  search(query: string, topK: number): Promise<SearchResult[]>;

  // Get chunk count
  chunkCount(): number;
}

interface SearchResult {
  content: string;      // Text chunk
  source: string;       // File/symbol reference
  score: number;        // Similarity 0-1
  metadata?: Record<string, any>;
}
```

**Implementation:**

**Storage Schema:**
```sql
CREATE TABLE rag_chunks (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  embedding BLOB NOT NULL,  -- Serialized float array
  metadata TEXT             -- JSON
);

CREATE INDEX idx_rag_source ON rag_chunks(source);
```

**Index Symbols:**
```typescript
async indexSymbols(symbols: CodeSymbol[], sources: Map<string, string>) {
  const chunks: RagChunk[] = [];

  for (const sym of symbols) {
    const source = sources.get(sym.file);
    if (!source) continue;

    // Extract symbol's source code
    const lines = source.split("\n");
    const code = lines.slice(sym.startLine - 1, sym.endLine).join("\n");

    // Create chunk
    const content = `
Symbol: ${sym.name} (${sym.kind})
File: ${sym.file}
${sym.signature ? `Signature: ${sym.signature}` : ""}

${code}
`.trim();

    chunks.push({
      content,
      source: `${sym.file}:${sym.name}`,
      metadata: {
        symbolId: sym.id,
        kind: sym.kind,
        file: sym.file
      }
    });
  }

  // Batch embed
  await this.embedAndStore(chunks);
}
```

**Index Docs:**
```typescript
async indexDocs(docsDir: string) {
  const mdFiles = await fg("**/*.md", { cwd: docsDir });
  const chunks: RagChunk[] = [];

  for (const file of mdFiles) {
    const content = await fs.readFile(path.join(docsDir, file), "utf-8");
    const { metadata, body } = parseFrontmatter(content);

    // Split into sections
    const sections = extractSections(body);

    for (const section of sections) {
      chunks.push({
        content: `
${section.title}

${section.content}
`.trim(),
        source: `${file}#${section.title}`,
        metadata: {
          docPath: file,
          symbols: metadata.symbols || []
        }
      });
    }
  }

  await this.embedAndStore(chunks);
}
```

**Embed and Store:**
```typescript
async embedAndStore(chunks: RagChunk[]) {
  const texts = chunks.map(c => c.content);

  // Call embedding function (batched)
  const embeddings = await this.embedFn(texts);

  // Store in SQLite
  const insert = this.db.prepare(`
    INSERT INTO rag_chunks (content, source, embedding, metadata)
    VALUES (?, ?, ?, ?)
  `);

  this.db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      // Serialize embedding (float32 array -> Buffer)
      const embeddingBuf = Buffer.from(new Float32Array(embedding).buffer);

      insert.run(
        chunk.content,
        chunk.source,
        embeddingBuf,
        JSON.stringify(chunk.metadata || {})
      );
    }
  })();
}
```

**Search (Cosine Similarity):**
```typescript
async search(query: string, topK: number): Promise<SearchResult[]> {
  // 1. Embed query
  const [queryEmbedding] = await this.embedFn([query]);

  // 2. Load all chunks (TODO: optimize with approximate search)
  const chunks = this.db.prepare(`
    SELECT id, content, source, embedding, metadata
    FROM rag_chunks
  `).all() as Array<{
    id: number;
    content: string;
    source: string;
    embedding: Buffer;
    metadata: string;
  }>;

  // 3. Calculate cosine similarity
  const results: Array<{ chunk: typeof chunks[0]; score: number }> = [];

  for (const chunk of chunks) {
    const embedding = new Float32Array(chunk.embedding.buffer);
    const similarity = cosineSimilarity(queryEmbedding, Array.from(embedding));
    results.push({ chunk, score: similarity });
  }

  // 4. Sort by score and return topK
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK).map(r => ({
    content: r.chunk.content,
    source: r.chunk.source,
    score: r.score,
    metadata: JSON.parse(r.chunk.metadata || "{}")
  }));
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Use Cases:**

**Q&A:**
```typescript
const ragIndex = createRagIndex({...});
await ragIndex.indexDocs("docs");

const results = await ragIndex.search("How do I create an order?", 5);
const context = results.map(r => r.content).join("\n\n");

const answer = await llm.chat([{
  role: "user",
  content: `Based on this context: ${context}\n\nAnswer: How do I create an order?`
}]);
```

**Learning Paths:**
```typescript
const results = await ragIndex.search("authentication", 10);
console.log("Learning path:");
for (const [i, r] of results.entries()) {
  console.log(`${i + 1}. ${r.source} (${(r.score * 100).toFixed(0)}%)`);
}
```

### 3. Context Builder (`contextBuilder.ts`)

Monta contexto relevante para LLMs.

**Função:**
```typescript
async function buildRelevantContext(
  target: { symbolName?: string; filePath?: string },
  services: {
    projectRoot: string;
    docsDir: string;
    registry: DocRegistry;
    symbolRepo: SymbolRepository;
    graph: KnowledgeGraph;
  }
): Promise<{ text: string; symbols: CodeSymbol[] }>
```

**Context Structure:**
```typescript
interface Context {
  // Target symbol/file info
  target: CodeSymbol | { file: string };

  // Source code
  sourceCode: string;

  // Dependencies (what it uses)
  dependencies: CodeSymbol[];

  // Dependents (what uses it)
  dependents: CodeSymbol[];

  // Related documentation
  docs: string[];

  // Related symbols (same file, parent class, etc.)
  relatedSymbols: CodeSymbol[];
}
```

**Build Logic:**
```typescript
async function buildRelevantContext({ symbolName, filePath }, services) {
  let targetSymbol: CodeSymbol | undefined;
  const symbols: CodeSymbol[] = [];
  let text = "";

  // 1. Resolve target
  if (symbolName) {
    const matches = services.symbolRepo.findByName(symbolName);
    if (matches.length === 0) {
      return { text: `No symbol found: ${symbolName}`, symbols: [] };
    }
    targetSymbol = matches[0];
    filePath = targetSymbol.file;
  }

  // 2. Load source code
  const fullPath = path.resolve(services.projectRoot, filePath);
  const source = await fs.readFile(fullPath, "utf-8");

  if (targetSymbol) {
    const lines = source.split("\n");
    const symbolCode = lines.slice(
      targetSymbol.startLine - 1,
      targetSymbol.endLine
    ).join("\n");

    text += `## Symbol: ${targetSymbol.name}\n\n`;
    text += `**Kind:** ${targetSymbol.kind}\n`;
    text += `**File:** ${targetSymbol.file}:${targetSymbol.startLine}\n`;
    if (targetSymbol.signature) {
      text += `**Signature:** \`${targetSymbol.signature}\`\n`;
    }
    text += `\n\`\`\`typescript\n${symbolCode}\n\`\`\`\n\n`;

    // 3. Dependencies
    const depIds = services.graph.getDependencies(targetSymbol.id, 1);
    const deps = services.symbolRepo.findByIds(depIds);

    if (deps.length > 0) {
      text += `## Dependencies (${deps.length})\n\n`;
      for (const dep of deps.slice(0, 10)) {
        text += `- ${dep.name} (${dep.kind}) in ${dep.file}\n`;
      }
      text += "\n";
      symbols.push(...deps);
    }

    // 4. Dependents
    const dependentIds = services.graph.getDependents(targetSymbol.id, 1);
    const dependents = services.symbolRepo.findByIds(dependentIds);

    if (dependents.length > 0) {
      text += `## Dependents (${dependents.length})\n\n`;
      for (const dependent of dependents.slice(0, 10)) {
        text += `- ${dependent.name} (${dependent.kind}) in ${dependent.file}\n`;
      }
      text += "\n";
      symbols.push(...dependents);
    }

    // 5. Documentation
    const docs = await services.registry.findDocBySymbol(targetSymbol.name);
    if (docs.length > 0) {
      text += `## Documentation\n\n`;
      for (const doc of docs) {
        const docPath = path.join(services.docsDir, doc.docPath);
        try {
          const docContent = await fs.readFile(docPath, "utf-8");
          text += `### ${doc.docPath}\n\n${docContent.slice(0, 500)}...\n\n`;
        } catch {
          // Skip missing docs
        }
      }
    }

    symbols.push(targetSymbol);
  } else {
    // File-level context
    text += `## File: ${filePath}\n\n`;
    text += `\`\`\`typescript\n${source}\n\`\`\`\n\n`;

    const fileSymbols = services.symbolRepo.findByFile(filePath);
    symbols.push(...fileSymbols);
  }

  return { text, symbols };
}
```

**Use Cases:**

**LLM context for code modification:**
```typescript
const context = await buildRelevantContext(
  { symbolName: "createOrder" },
  services
);

const prompt = `${context.text}\n\nRefactor this code to use async/await.`;
const result = await llm.chat([{ role: "user", content: prompt }]);
```

## Performance

**Knowledge Graph:**
- In-memory adjacency lists (fast traversal)
- Rebuild on demand (lazy loading)

**RAG Index:**
- Batch embedding for efficiency
- SQLite for persistence
- TODO: Add approximate nearest neighbor (FAISS/Annoy)

**Context Builder:**
- Limits depth/breadth to avoid token overflow
- Caches frequently accessed contexts

## Referências

- [Graph Algorithms](https://en.wikipedia.org/wiki/Graph_traversal)
- [RAG Pattern](https://arxiv.org/abs/2005.11401)
- [Embeddings](https://platform.openai.com/docs/guides/embeddings)
