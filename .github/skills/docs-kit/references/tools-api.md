# docs-kit MCP — Tool API Reference

Complete parameter reference for all docs-kit MCP tools. Use this file when you need exact parameter names and types.

## searchSymbols

Search the AST index for symbols by name, kind, or architecture layer.

```
searchSymbols(
  query?: string,      // Partial or full symbol name / qualified name
  kind?: SymbolKind,   // class | method | function | interface | dto | entity | event | listener | service | repository
  layer?: Layer,       // Filter by architecture layer
  limit?: number       // Max results (default: 20)
)
```

**When to use:** First step of almost any workflow. Confirms a symbol exists and retrieves its exact qualified name and file location before calling other tools.

**Example:**

```
searchSymbols(query: "OrderService", kind: "service")
// Returns: OrderService (service) @ src/services/order.ts:12 — Handles order lifecycle
```

---

## explainSymbol

Returns a structured explanation of a symbol, combining AST data, docs mapping, and cached LLM analysis.

```
explainSymbol(
  symbol: string,      // Symbol name e.g. "OrderService.createOrder"
  docsDir?: string     // Docs directory (default: "docs")
)
```

**When to use:** Any time the question is "what does X do / how does it work". Returns cached explanation if available and still valid (no code changes since last analysis).

**Note:** This tool returns a prompt for the AI to analyze. After calling it, the AI should also call `updateSymbolExplanation` with the resulting analysis to cache it for future calls.

---

## updateSymbolExplanation

Cache a human-readable explanation for a symbol.

```
updateSymbolExplanation(
  symbol: string,       // Symbol name
  explanation: string   // The explanation text to cache
)
```

**When to use:** After `explainSymbol` produces a new explanation. Call this to persist the result so future calls to `explainSymbol` return the cached version cheaply.

---

## getRelevantContext

Returns a bundle of context optimized for editing: AST data + knowledge graph relationships + mapped docs + source code (compact or full).

```
getRelevantContext(
  symbol?: string,           // Symbol name (use this or file, not both)
  file?: string,             // File path relative to project root
  docsDir?: string,          // Docs directory (default: "docs")
  mode?: "compact" | "full", // compact = summary only; full = includes source (default: "compact")
  maxSourceLines?: number,   // Max source lines in full mode (default: 80)
  maxDocChars?: number,      // Max chars from each mapped doc
  maxContextChars?: number   // Total context cap (default: 20000)
)
```

**When to use:** When you need to both understand AND edit a symbol. The `compact` mode is almost always sufficient for understanding. Only use `full` when writing or modifying code.

**Cost guidance:** `compact` ≈ 500–2000 tokens. `full` ≈ 2000–10000 tokens depending on file size. Always prefer `symbol` mode over `file` mode.

---

## getFileOutline

Returns a flat list of all indexed symbols in a file — names, kinds, line numbers, summaries.

```
getFileOutline(
  file: string   // File path relative to project root
)
```

**When to use:** As a filter before `getRelevantContext`. Confirm a specific symbol is in a file without loading its full context.

---

## askKnowledgeBase

Free-form conversational Q&A against the RAG index (built from docs + code summaries).

```
askKnowledgeBase(
  question: string,    // Natural language question
  docsDir?: string     // Docs directory (default: "docs")
)
```

**When to use:** When the question is broad ("how does the auth flow work?", "what patterns does this project use?") or when you're not sure which specific symbol to look at. Less precise than `explainSymbol` but covers questions that don't map to a single symbol.

---

## impactAnalysis

Traverses the knowledge graph to find all symbols that depend on the target, estimating what would break if it changed.

```
impactAnalysis(
  symbol: string,      // Symbol name e.g. "UserRepository.findByEmail"
  maxDepth?: number    // Max traversal depth (default: 3)
)
```

**When to use:** Before any change to a public API, service method, or shared utility. Before deleting dead code candidates. Returns dependents ranked by proximity with risk assessment.

---

## generateMermaid

Generates a Mermaid diagram for the given symbols using relationship data from the knowledge graph.

```
generateMermaid(
  symbols: string,                                   // Comma-separated symbol names
  type?: "classDiagram" | "sequenceDiagram" | "flowchart"  // Default: "classDiagram"
)
```

**When to use:** After `impactAnalysis` to visualize the blast radius. For architecture exploration. For explaining relationships to non-technical stakeholders. Output is always wrapped in a mermaid code block.

---

## generateEventFlow

Simulates and documents event flows, tracing which listeners respond to which events.

```
generateEventFlow(
  // No explicit schema found in source — call with empty params for full flow
)
```

**When to use:** When the question involves events, listeners, pub/sub, or message queues. Complement `generateMermaid` for event-driven architectures.

---

## analyzePatterns

Scans all indexed symbols and relationships to detect design patterns and SOLID violations.

```
analyzePatterns()
// No parameters — operates on the full index
```

**When to use:** During code review, before a refactor, or when assessing technical debt. Returns patterns with confidence scores and violation lists per pattern group.

---

## smartCodeReview

Comprehensive review combining: architecture rules (arch-guard), pattern analysis, dead code scan, and doc example validation in a single call.

```
smartCodeReview(
  docsDir?: string,          // Docs directory (default: "docs")
  includeExamples?: boolean  // Validate code examples in docs (default: true)
)
```

**When to use:** For PR reviews, periodic code health checks, or when someone says "review this codebase". This is the high-level review tool — use `analyzePatterns` when you need more granular pattern data.

---

## generateDocs

Compares Git refs (base vs head) to detect semantically changed symbols, then updates only the corresponding documentation sections.

```
generateDocs(
  base?: string,     // Base ref (default: "main")
  head?: string,     // Head ref (default: current HEAD)
  dryRun?: boolean,  // Preview without writing (default: false)
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** After code changes to keep docs in sync. Always run `dryRun: true` first to preview what would change. This tool never creates new doc files — it only updates existing sections.

---

## scanFile

Scans a single TypeScript file and generates documentation stubs for any symbols not yet in the docs registry.

```
scanFile(
  file: string,      // File path
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** For newly added files that have no documentation at all. This is the "first time" tool — for updates to existing docs, use `generateDocs`.

---

## scanForDeadCode

Scans for: unused symbols (dead code), docs without linked symbols (orphan docs), and broken doc links.

```
scanForDeadCode(
  docsDir?: string,  // Docs directory (default: "docs")
  status?: "active" | "false_positive" | "ignored" | "resolved" | "all"
  // default: "active" — shows only unreviewed findings
)
```

**When to use:** During cleanup sprints, before major refactors, or as a scheduled health check. Results are persisted to the database — use `status: "all"` to see previously reviewed findings too.

---

## updateDeadCodeStatus

Update the status of a dead code finding (mark as false positive, ignored, or resolved).

```
updateDeadCodeStatus(
  target: string,    // Symbol or doc path identified as dead code
  status: "false_positive" | "ignored" | "resolved"
)
```

**When to use:** After reviewing findings from `scanForDeadCode`. Prevents the same false positives from appearing on the next scan.

---

## getDeadCodeHistory

Retrieves historical dead code findings from the database.

```
getDeadCodeHistory(
  status?: "active" | "false_positive" | "ignored" | "resolved" | "all"
)
```

**When to use:** When you need a trend view — is dead code growing or shrinking over time? Or when looking up previously reviewed findings.

---

## describeInBusinessTerms

Translates a technical symbol into plain business language using LLM + doc context.

```
describeInBusinessTerms(
  symbol: string,    // Symbol name
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** When communicating with non-technical stakeholders, generating user-facing documentation, or creating executive summaries.

---

## createOnboarding

Generates a structured learning path for a given topic using RAG over the docs index.

```
createOnboarding(
  topic: string,     // e.g. "backend payment flow" or "auth module"
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** When onboarding new team members, creating role-specific guides, or documenting a subsystem for the first time.

---

## buildTraceabilityMatrix

Extracts ticket/PR references from commit messages and comments, then maps them to symbols and docs.

```
buildTraceabilityMatrix(
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** For compliance, audits, or when stakeholders need to know "what code changed for ticket X?". Requires that commits mention ticket IDs (e.g. `PROJ-123`).

---

## projectStatus

Generates a comprehensive health report: documentation coverage %, pattern violations, dead code count, symbol counts by kind and layer.

```
projectStatus(
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** At the start of any broad exploration ("what is the state of this project?"). Also useful as a first step in code reviews to understand the health baseline.

---

## validateExamples

Validates code examples embedded in documentation against the actual indexed symbols to detect stale or broken examples.

```
validateExamples(
  docsDir?: string   // Docs directory (default: "docs")
)
```

**When to use:** During doc reviews, before publishing docs, or when tests pass but you suspect docs are outdated. Catches examples that reference symbols that no longer exist or have changed signatures.
