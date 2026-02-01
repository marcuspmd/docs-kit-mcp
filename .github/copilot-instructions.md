# docs-kit - AI Coding Agent Instructions

## Project Overview

**docs-kit** is an MCP (Model Context Protocol) documentation agent that uses Tree-sitter AST analysis to detect semantic code changes and automatically update documentation. It tracks symbol-to-doc mappings in SQLite and provides CI/CD gates via `doc-guard`.

## Architecture (Layered)

```
src/
├── analyzer/      # Git diff parsing, semantic change detection
├── indexer/       # Tree-sitter AST indexer, symbol extraction
├── docs/          # DocRegistry, frontmatter parser, section updater, code validators
├── governance/    # doc-guard CLI, arch-guard, reaper, project-status
├── knowledge/     # Knowledge graph, symbol relationships
├── llm/           # Provider abstraction (OpenAI, Claude, Ollama, Gemini)
├── storage/       # SQLite persistence
├── site/          # Static site generator
└── server.ts      # MCP server entrypoint
```

**Data flow**: Git diff → AST diff → `ChangeImpact[]` → DocRegistry lookup → section-level doc update

## Key Conventions

### TypeScript/ESM
- Pure ESM (`"type": "module"`). Always use `.js` extension in imports even for TypeScript files
- Target ES2022, `moduleResolution: Node16`
- Use Zod for all schema validation (prefer `z.uuid()` over deprecated `z.string().uuid()`)

### Testing (Jest + ESM)
```typescript
// REQUIRED: Import jest for ESM mocking
import { jest } from "@jest/globals";

// Use dependency injection for LLM providers (see tests/docs.test.ts)
const mockProvider = {
  chat: async () => "mock response",
  embed: jest.fn().mockResolvedValue([[0.1, 0.2]]),
};
const updater = createDocUpdater({ llm: mockProvider });
```

Run tests: `npm run test` (uses `--experimental-vm-modules`)

### LLM Provider Pattern (Strategy + Factory)
```typescript
// src/llm/provider.ts - Factory creates provider from config
const provider = createLlmProvider(config);
await provider.chat([{ role: "user", content: "..." }]);

// Implement new providers in src/llm/providers/{Name}Provider.ts
```

### Symbol Model
Core entity is `CodeSymbol` (see `src/indexer/symbol.types.ts`):
- Kinds: `class`, `method`, `function`, `interface`, `dto`, `entity`, `event`, `listener`, `service`, `repository`, etc.
- ID generated via `generateSymbolId(file, name, kind)` - SHA256 hash

### Documentation Rules
- **Never create new doc files** - only update existing sections
- **Never destroy existing content** - surgical section updates only
- Frontmatter `symbols:` array links symbols to docs
- Section headings match symbol names (`## createOrder`)

## CLI Commands

```bash
npm run build          # Compile to dist/
docs-kit index         # Index repository symbols to SQLite
docs-kit build-site    # Generate static HTML docs site
doc-guard --base main  # Check if PRs update docs for changed symbols
```

## File Patterns

| Pattern | Purpose |
|---------|---------|
| `src/**/*.ts` | Source code (Tree-sitter parsed) |
| `docs/**/*.md` | Documentation with frontmatter |
| `.doc-kit/*.db` | SQLite index/registry databases |
| `tests/*.test.ts` | Jest test files |

## Common Tasks

**Add language support**: Implement `LanguageParser` in `src/indexer/languages/`

**Add code validator**: Create `{Lang}Validator.ts` in `src/docs/strategies/` implementing `ValidatorStrategy`

**Add LLM provider**: Create `{Name}Provider.ts` in `src/llm/providers/` implementing `LlmProvider` interface, register in factory

## Critical Files

- `src/indexer/symbol.types.ts` - Central CodeSymbol schema
- `src/config.ts` - Configuration schema with Zod
- `src/llm/provider.ts` - LLM abstraction layer
- `src/docs/docRegistry.ts` - Symbol-to-doc mapping
- `src/docs/docUpdater.ts` - Section-level updates
