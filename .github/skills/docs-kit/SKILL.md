---
name: docs-kit
description: "Use this skill whenever working in a repository that has docs-kit MCP configured. Always activate when: explaining a class or function, reviewing a file or PR, generating or updating documentation, analyzing what breaks when changing a symbol, detecting dead code, onboarding new developers, tracing requirements to code, generating architecture diagrams, or asking any question about codebase structure and behavior. Always prefer this skill over reading source files directly — the MCP index answers the same questions for a fraction of the tokens."
---

# docs-kit MCP — How to Use It, When, and Why

docs-kit exposes a pre-built intelligence layer through MCP tools. This layer contains an AST-indexed symbol graph, documentation mappings, architecture rules, and relationship analysis — all pre-computed from the codebase. Using these tools instead of reading raw files is the single most effective way to reduce token cost while improving answer accuracy.

## The Core Principle

**The index already knows what the file contains. Ask the index, not the file.**

Reading a TypeScript file with 400 lines to answer "what does `OrderService.createOrder` do?" costs ~400 tokens of context. Calling `explainSymbol` costs ~10 tokens of input and returns a structured, doc-augmented answer. The principle applies to every operation: exploration, review, doc generation, impact analysis — always query the MCP layer first.

Only fall back to reading files when:

- You need to edit code and must see surrounding lines for context
- A tool returns "not found" and you need to verify manually
- You are writing new code and need exact function signatures

## Tool Map — Quick Reference

| Goal                                          | Tool to use               |
| --------------------------------------------- | ------------------------- |
| Understand a class / function / method        | `explainSymbol`           |
| Find where a symbol is defined                | `searchSymbols`           |
| Get code + docs context together for editing  | `getRelevantContext`      |
| See what symbols live in a file               | `getFileOutline`          |
| Ask a free-form question about the codebase   | `askKnowledgeBase`        |
| Review a file for issues                      | `smartCodeReview`         |
| Detect SOLID violations and design patterns   | `analyzePatterns`         |
| Find what other code would break if X changes | `impactAnalysis`          |
| Generate or update documentation              | `generateDocs`            |
| Create docs for an undocumented file          | `scanFile`                |
| Draw an architecture or relationship diagram  | `generateMermaid`         |
| Simulate event flows                          | `generateEventFlow`       |
| Find unused code and orphan docs              | `scanForDeadCode`         |
| Translate a symbol to business language       | `describeInBusinessTerms` |
| Generate a learning path for new developers   | `createOnboarding`        |
| Map tickets/commits to code                   | `buildTraceabilityMatrix` |
| Get overall project health and coverage       | `projectStatus`           |

For full parameter details of each tool, see [references/tools-api.md](references/tools-api.md).

## Task Workflows

### Explaining a symbol

When someone asks "what does X do?", "how does Y work?", "explain class Z":

1. `searchSymbols(query: "X")` — locate the symbol and confirm its qualified name
2. `explainSymbol(symbol: "QualifiedName.X")` — get structured explanation enriched by docs
3. If business context is needed: `describeInBusinessTerms(symbol: "X")`
4. Answer directly. Do not open the source file.

### Reviewing a file or PR

1. `projectStatus()` — understand current health, doc coverage, existing violations
2. `smartCodeReview(docsDir: "docs")` — architecture + pattern + dead code + doc validation in one call
3. `analyzePatterns()` — for detailed SOLID/design pattern analysis if needed
4. `validateExamples()` — if the file contains code examples in docs
5. Report structured findings: violations first, then suggestions

### Generating or updating documentation

1. `searchSymbols(query: "TargetClass")` — confirm the symbol is in the index
2. `getRelevantContext(symbol: "TargetClass", mode: "compact")` — see current doc + code together
3. `generateDocs()` — trigger automated section-level update for changed symbols
4. For a brand-new undocumented file: `scanFile(file: "src/services/new.ts")`
5. Only use `edit` for manual surgical corrections after tools have run

### Impact analysis before a change

When someone is about to modify a symbol and wants to know what breaks:

1. `searchSymbols(query: "TargetSymbol")` — confirm exact symbol name
2. `impactAnalysis(symbol: "TargetSymbol")` — traverse knowledge graph, get dependents
3. `generateMermaid(symbols: "TargetSymbol,Dependent1,Dependent2")` — visualize the blast radius
4. Report: affected files ranked by risk (high/medium/low), with suggested change order

### Architecture exploration / diagrams

1. `searchSymbols(query: "domain area", layer: "service")` — identify relevant symbols
2. `generateMermaid(symbols: "A,B,C", type: "class")` — class or sequence diagram
3. `generateEventFlow(event: "OrderCreated")` — for event-driven flows
4. Render the diagram inside a ` ```mermaid ` block in the answer

### Dead code detection

1. `scanForDeadCode(status: "active")` — find candidates with confidence scores
2. For each candidate: `impactAnalysis(symbol: "X")` — confirm it is truly unreachable
3. Only recommend deletion after impact analysis confirms zero dependents
4. Use `updateDeadCodeStatus` to mark false positives so they don't recur

### Onboarding a developer

1. `createOnboarding(role: "backend engineer", area: "payments")` — generate learning path
2. `askKnowledgeBase(question: "how does the auth flow work?")` — fill gaps
3. `buildTraceabilityMatrix()` — show how features map to code
4. Produce a structured onboarding doc with links to relevant symbols

### Tracing a ticket or requirement to code

1. `buildTraceabilityMatrix(keywords: "feature name or ticket ID")` — commit→code→docs chain
2. `searchSymbols(query: "feature keyword")` — find specific components
3. Summarize: ticket → commit(s) → changed symbols → affected docs

## Token Economy Rules

These rules exist because context windows are finite and expensive. Following them means the AI can handle more complex tasks per conversation without losing earlier context.

**Batch before answering.** If answering a question requires knowing three things, call three tools in the same turn and answer after all results arrive. Never call one tool, partially answer, then call another.

**`getFileOutline` as a filter.** Before calling `getRelevantContext` on a file, use `getFileOutline` to confirm the symbol is in that file. This avoids loading a full context blob only to discover the symbol is elsewhere.

**Prefer `symbol` mode over `file` mode.** `getRelevantContext(symbol: "X")` loads only what's needed for symbol X. `getRelevantContext(file: "big-service.ts")` loads everything in the file. Use file mode only when you need to see a symbol's neighbors.

**Stop at sufficient confidence.** Once you can answer with >85% confidence from MCP tools, answer. Don't keep reading.

**Never dump raw source code in responses** unless explicitly requested. Quote the relevant 5–10 lines from tool output instead.

## Anti-patterns to Avoid

- **Reading a file to find a symbol** — use `searchSymbols` instead
- **Reading a file to understand a class** — use `explainSymbol` instead
- **Grepping across the repo for callers** — use `impactAnalysis` instead
- **Reading the whole project tree** — use `projectStatus` instead
- **Calling `generateDocs` before checking `getRelevantContext`** — always verify the current state first to avoid overwriting good content
- **Deleting dead code without running `impactAnalysis`** — the reaper can have false positives
- **Inventing symbol names** — always verify with `searchSymbols` first; the index is the source of truth

## When the Index is Stale

docs-kit's index is rebuilt by running `docs-kit index`. If tool responses say "not found" for symbols you can see in the source, the index may be outdated. In that case:

- Read files directly (temporary exception)
- Suggest the developer run `docs-kit index` to rebuild
- After rebuild, MCP tools will reflect the current state

For detailed tool parameters and advanced options, read [references/tools-api.md](references/tools-api.md).
For full workflow examples, read [references/workflows.md](references/workflows.md).
