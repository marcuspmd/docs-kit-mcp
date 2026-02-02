---
title: MCP Server
module: server
lastUpdated: 2026-02-01
symbols:
  - server
  - generateDocs
  - explainSymbol
  - generateMermaid
  - scanFile
---

# MCP Server - Model Context Protocol

> O MCP Server expõe todas as funcionalidades do docs-kit através do Model Context Protocol, permitindo integração com LLMs e ferramentas de IA.

## Visão Geral

O MCP Server (`src/server.ts`) implementa o [Model Context Protocol](https://modelcontextprotocol.io/) para permitir que LLMs e agentes de IA interajam com o docs-kit. Ele expõe 18 tools registradas que encapsulam toda a funcionalidade do sistema.

## Arquitetura

```typescript
McpServer (SDK)
  ↓
StdioServerTransport (comunicação)
  ↓
ToolRegistry (18 tools registradas)
  ↓
Core Services (symbolRepo, registry, graph, llm, etc.)
```

## Inicialização

O servidor carrega todas as dependências na inicialização:

```typescript
// Config e database
const config = await loadConfig(process.cwd());
const db = new Database(config.dbPath);

// Core repositories
const registry = createDocRegistry(db);
const symbolRepo = createSymbolRepository(db);
const relRepo = createRelationshipRepository(db);

// Knowledge systems
const graph = createKnowledgeGraph(db);
const ragIndex = createRagIndex({...});

// Governance
const archGuard = createArchGuard();
const reaper = createReaper();

// LLM
const llm = createLlmProvider(config);
```

## Tools Registradas

### 1. `generateDocs`

Atualiza documentação para símbolos afetados por mudanças no git.

**Input Schema:**
```typescript
{
  base: string = "main",     // Branch base
  head?: string,             // Branch head
  dryRun: boolean = false,   // Preview mode
  docsDir: string = "docs"   // Docs directory
}
```

**Output:**
Lista de atualizações aplicadas ou "No doc updates needed."

**Fluxo:**
1. Rebuild registry
2. Analisa mudanças (git diff → AST diff)
3. Aplica atualizações via DocUpdater
4. Retorna summary

**Exemplo:**
```json
{
  "name": "generateDocs",
  "arguments": {
    "base": "main",
    "head": "feature/new-api",
    "dryRun": true
  }
}
```

### 2. `explainSymbol`

Explica um símbolo combinando análise de código e docs existentes.

**Input Schema:**
```typescript
{
  symbol: string,           // Symbol name
  docsDir: string = "docs"  // Docs directory
}
```

**Output:**
Prompt formatado com contexto completo para LLM (código + docs + relacionamentos).

**Fluxo:**
1. Localiza símbolo no symbolRepo
2. Busca relacionamentos no graph
3. Carrega documentação do registry
4. Extrai source code
5. Formata prompt com `buildExplainSymbolContext()`

**Exemplo:**
```json
{
  "name": "explainSymbol",
  "arguments": {
    "symbol": "OrderService.createOrder"
  }
}
```

### 3. `generateMermaid`

Gera diagrama Mermaid para símbolos especificados.

**Input Schema:**
```typescript
{
  symbols: string,  // Comma-separated names
  type: "classDiagram" | "sequenceDiagram" | "flowchart"
}
```

**Output:**
Bloco de código Mermaid formatado.

**Exemplo:**
```json
{
  "name": "generateMermaid",
  "arguments": {
    "symbols": "OrderService,PaymentService",
    "type": "classDiagram"
  }
}
```

### 4. `scanFile`

Escaneia arquivo TypeScript e gera documentação para símbolos não documentados.

**Input Schema:**
```typescript
{
  filePath: string,                        // File to scan
  docsDir: string = "docs",                // Docs dir
  dbPath: string = ".docs-kit/registry.db"  // DB path
}
```

**Output:**
Lista de símbolos para os quais docs foram criadas.

**Fluxo:**
1. Parse file com Tree-sitter
2. Extrai símbolos
3. Verifica registry para símbolos não documentados
4. Cria docs stubs via `scanFileAndCreateDocs()`

### 5. `impactAnalysis`

Analisa o raio de impacto de mudanças em um símbolo.

**Input Schema:**
```typescript
{
  symbol: string,       // Symbol name
  maxDepth: number = 3  // Max traversal depth
}
```

**Output:**
Prompt formatado com símbolos impactados (dependências diretas e transitivas).

**Fluxo:**
1. Localiza símbolo
2. Usa `graph.getImpactRadius()` para traversal
3. Busca símbolos impactados
4. Formata com `buildImpactAnalysisPrompt()`

### 6. `analyzePatterns`

Detecta design patterns e violations (SOLID, etc.).

**Output:**
Relatório formatado com patterns, confidence, e violations.

**Fluxo:**
1. Carrega todos os símbolos e relacionamentos
2. Executa `patternAnalyzer.analyze()`
3. Formata resultado em markdown

### 7. `generateEventFlow`

Simula event flows e listeners (diagrama Mermaid).

**Output:**
Diagrama Mermaid em formato sequenceDiagram.

**Fluxo:**
1. Analisa símbolos de eventos/listeners
2. Monta flows com `eventFlowAnalyzer.analyze()`
3. Converte para Mermaid com `formatEventFlowsAsMermaid()`

### 8. `createOnboarding`

Gera learning path usando RAG no código e docs.

**Input Schema:**
```typescript
{
  topic: string,            // Topic to learn
  docsDir: string = "docs"  // Docs dir
}
```

**Output:**
Learning path ranqueado por relevância (top 10 chunks).

**Fluxo:**
1. Index docs se necessário
2. Busca semântica: `ragIndex.search(topic, 10)`
3. Formata resultados com scores

### 9. `askKnowledgeBase`

Q&A conversacional sobre código + docs.

**Input Schema:**
```typescript
{
  question: string,         // User question
  docsDir: string = "docs"  // Docs dir
}
```

**Output:**
Resposta gerada pelo LLM baseada em contexto RAG.

**Fluxo:**
1. Busca contexto relevante via RAG
2. Monta prompt com contexto + pergunta
3. Chama `llm.chat()` para gerar resposta

### 10. `scanForDeadCode`

Escaneia dead code, orphan docs, e broken links.

**Input Schema:**
```typescript
{
  docsDir: string = "docs"
}
```

**Output:**
Relatório de findings do Reaper (dead_code, orphan_doc, broken_link).

**Fluxo:**
1. Rebuild registry
2. Carrega símbolos, mappings, e graph
3. Executa `reaper.scan()`
4. Formata findings

### 11. `buildTraceabilityMatrix`

Gera matriz de rastreabilidade (tickets → símbolos → testes → docs).

**Input Schema:**
```typescript
{
  docsDir: string = "docs"
}
```

**Output:**
Relatório formatado por ticket ID.

**Fluxo:**
1. Extrai referências de commits/comments via `contextMapper.extractRefs()`
2. Constrói RTM via `contextMapper.buildRTM()`
3. Formata resultado

### 12. `describeInBusinessTerms`

Descreve símbolo em linguagem de negócio (para product/compliance).

**Input Schema:**
```typescript
{
  symbol: string,           // Symbol name
  docsDir: string = "docs"  // Docs dir
}
```

**Output:**
Descrição em termos de negócio (regras, condições, outcomes).

**Fluxo:**
1. Localiza símbolo
2. Extrai source code
3. Busca documentação existente
4. Chama `businessTranslator.describeInBusinessTerms()`

### 13. `validateExamples`

Valida code examples na documentação contra código real.

**Input Schema:**
```typescript
{
  docsDir: string = "docs",  // Docs dir
  docPath?: string           // Specific doc (optional)
}
```

**Output:**
Relatório de validação (✅ PASS / ❌ FAIL por exemplo).

**Fluxo:**
1. Escaneia docs extraindo code blocks
2. Valida sintaxe/existência via validators
3. Retorna `ValidationResult[]`

### 14. `smartCodeReview`

Code review abrangente combinando múltiplas análises.

**Input Schema:**
```typescript
{
  docsDir: string = "docs",
  includeExamples: boolean = true
}
```

**Output:**
Relatório completo com arch violations, dead code, patterns, doc drift, e code examples.

**Fluxo:**
1. Executa arch-guard
2. Executa reaper (dead code)
3. Detecta patterns
4. Valida examples (se enabled)
5. Combina resultados via `performSmartCodeReview()`

### 15. `projectStatus`

Gera relatório de status do projeto.

**Input Schema:**
```typescript
{
  docsDir: string = "docs"
}
```

**Output:**
Relatório formatado com métricas de documentação, patterns, violations, coverage.

**Fluxo:**
1. Coleta métricas de múltiplas fontes
2. Formata via `formatProjectStatus()`

### 16. `getRelevantContext`

Obtém contexto abrangente para um símbolo ou arquivo.

**Input Schema:**
```typescript
{
  symbol?: string,          // Symbol name
  file?: string,            // File path
  docsDir: string = "docs"  // Docs dir
}
```

**Output:**
Contexto completo: código + docs + relacionamentos + dependências.

**Fluxo:**
1. Localiza símbolo/file
2. Carrega código fonte
3. Busca relacionamentos
4. Carrega docs
5. Formata com `buildRelevantContext()`

## Transport Layer

O servidor usa `StdioServerTransport` para comunicação via stdin/stdout. Isso permite:

- **Claude Desktop integration**: Via `mcp.json` config
- **VS Code extensions**: Via MCP client
- **CLI tools**: Via stdio pipes

## Error Handling

Todas as tools retornam estrutura consistente:

**Success:**
```typescript
{
  content: [{ type: "text", text: "..." }]
}
```

**Error:**
```typescript
{
  content: [{ type: "text", text: "Error: ..." }],
  isError: true
}
```

## Configuração (mcp.json)

Exemplo para Claude Desktop:

```json
{
  "mcpServers": {
    "docs-kit": {
      "command": "node",
      "args": ["/path/to/docs-kit/dist/server.js"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## Input Validation

Todas as tools usam Zod schemas para validação:

```typescript
{
  inputSchema: {
    param: z.string().describe("..."),
    optional: z.boolean().default(false).describe("...")
  }
}
```

Isso garante:
- Type safety
- Default values
- Descriptions para LLMs

## Performance

**Lazy loading:**
- RAG index é populado on-demand (`if (ragIndex.chunkCount() === 0)`)

**Connection pooling:**
- Única instância de Database compartilhada

**Caching:**
- Registry rebuild usa cache interno

## Extensibilidade

Para adicionar nova tool:

```typescript
server.registerTool(
  "myTool",
  {
    description: "...",
    inputSchema: {
      param: z.string().describe("...")
    }
  },
  async ({ param }) => {
    try {
      // Logic aqui
      return {
        content: [{ type: "text", text: "..." }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true
      };
    }
  }
);
```

## Testing

Para testar o servidor localmente:

```bash
# Via stdio (echo JSON request)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/server.js

# Via MCP inspector
npx @modelcontextprotocol/inspector dist/server.js
```

## Debugging

O servidor loga para stderr (não interfere com stdio protocol):

```typescript
console.error("Debug info:", ...);  // OK
console.log("User output:", ...);   // NEVER - breaks protocol
```

## Lifecycle

```typescript
// 1. Load config and dependencies
const config = await loadConfig(...);
const db = new Database(...);

// 2. Initialize services
const registry = createDocRegistry(db);
// ... outros services

// 3. Register tools
server.registerTool("generateDocs", {...}, async () => {...});
// ... outras tools

// 4. Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);

// 5. Server runs indefinitely (stdio loop)
```

## Shutdown

O servidor roda indefinidamente até:
- Process kill signal (SIGTERM/SIGINT)
- Stdio connection closes
- Unhandled error

Database é fechado automaticamente pelo SQLite no process exit.

## Referências

- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [MCP SDK (@modelcontextprotocol/sdk)](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [CLI Commands](./cli.md)
- [Doc Registry](./docs.md#docregistry)
- [Knowledge Graph](./knowledge.md#graph)
