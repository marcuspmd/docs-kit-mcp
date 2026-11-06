# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**docs-kit** is an intelligent documentation agent built on MCP (Model Context Protocol). It uses Tree-sitter AST analysis combined with Git diffs to detect semantic code changes and automatically update documentation. Symbols are indexed into SQLite; CI enforcement is done via `docs-guard`.

## Commands

```bash
npm run build              # Compile TypeScript to dist/
npm test                   # Run all tests (Jest + ESM)
npm run test:coverage      # Run tests with coverage report
npm run test:watch         # Watch mode (single thread)
npm run lint               # ESLint on src/
npm run format             # Prettier on src/
npm run dev                # Run MCP server via tsx (no build needed)
node dist/server.js &      # Run compiled MCP server in background
node dist/cli.js <cmd>     # Run CLI commands
```

**Run a single test file:**
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js src/indexer/__tests__/indexer.test.ts
```

**CLI commands (after build):**
```bash
docs-kit index             # Index repo symbols into SQLite (.docs-kit/index.db)
docs-kit build-site        # Generate static HTML docs site
docs-kit diff              # Analyze semantic diff between commits
docs-kit impact-analysis   # Show impact of changed symbols
docs-guard --base main     # CI gate: fail if semantic changes lack doc updates
```

## Architecture

### Data Flow
```
Git diff → AST diff → ChangeImpact[] → DocRegistry lookup → section-level doc update
```

### Source Layout
```
src/
├── analyzer/       # Git diff parsing + semantic change detection
├── indexer/        # Tree-sitter AST indexer, symbol extraction, parallel worker
├── docs/           # DocRegistry, frontmatter parser, section updater, code validators
├── governance/     # docs-guard CLI, arch-guard, reaper, project-status, diff review
├── knowledge/      # Symbol relationship graph + RAG index
├── llm/            # Provider abstraction: OpenAI, Codex, Ollama, Gemini
├── storage/        # SQLite persistence (better-sqlite3)
├── site/           # Static site generator (v2Generator, dataBundle)
├── business/       # Business translator, RTM (requirements traceability matrix)
├── patterns/       # Pattern analyzer for architecture detection
├── events/         # Event flow analyzer
├── interfaces/     # OpenAPI/GraphQL sync
├── di/             # tsyringe DI container (tokens.ts + container.ts)
├── prompts/        # LLM prompt templates
├── server/         # MCP server: tools/, dependencies.ts, http.ts
├── cli/            # CLI commands organized as use cases
├── config.ts       # Zod-validated config schema (ConfigSchema)
├── configLoader.ts # Loads docs.config.js from project root
└── server.ts       # MCP server entrypoint
```

### Key Patterns

**Dependency Injection**: Uses `tsyringe` with Symbol tokens from `src/di/tokens.ts`. All services are registered in `src/di/container.ts` and injected via `@injectable()` / `@inject()`.

**LLM Provider (Strategy + Factory)**: `src/llm/provider.ts` creates the active provider from config. To add a provider, implement `LlmProvider` in `src/llm/providers/` and register in the factory.

**Language Parsers**: Each supported language has a `LanguageStrategy` in `src/indexer/languages/`. To add a language, implement `LanguageStrategy` and register in `src/indexer/languages/index.ts`.

**Code Validators**: `src/docs/strategies/` holds per-language validators for code example validation. Implement `ValidatorStrategy` and register in `src/docs/strategies/index.ts`.

**Architecture Guards**: `src/governance/guards/{language}/` contains language-specific rule files. Each rule file exports a check function matching the `ArchRule` interface.

**MCP Tools**: Each tool lives in `src/server/tools/{name}.tool.ts`, exports a Zod schema and a `register*Tool(server, deps)` function. All tools are registered in `src/server/tools/index.ts`.

**CLI Use Cases**: CLI commands live in `src/cli/usecases/`, each exporting an async function called from `src/cli.ts`.

### Central Types

- `CodeSymbol` — `src/indexer/symbol.types.ts` — the core entity. Kinds: `class`, `method`, `function`, `interface`, `dto`, `entity`, `event`, `listener`, `service`, `repository`. IDs are SHA256 of `(file, name, kind)`.
- `Config` — `src/config.ts` — full Zod schema; LLM provider, indexing, arch-guard, docs, RAG, coverage.
- `ChangeImpact` — produced by `src/analyzer/changeAnalyzer.ts`, consumed by doc update and impact analysis tools.

## Configuration

Project configuration lives in `docs.config.js` at the repo root (see `docs.config.example.js`). Key options:

- `llm.provider`: `none | openai | ollama | gemini | Codex`
- `llm.apiKey`: use `{ env: "VAR_NAME" }` form — never a literal key
- `dbPath`: defaults to `.docs-kit/index.db`
- `archGuard.languages[].rules`: empty array = all rules applied; list specific rule codes to whitelist
- `docs[]`: symbol-to-doc mappings; `autoDiscovery: true` on a directory path discovers all `.md` files

## TypeScript / ESM Conventions

- Pure ESM (`"type": "module"`) — always use `.js` extension in imports even for `.ts` source files
- Target ES2022, `moduleResolution: Node16`
- Use Zod for all schema validation; prefer `z.uuid()` over the deprecated `z.string().uuid()`
- `reflect-metadata` must be imported before any tsyringe usage

## Testing

Tests colocate with source in `__tests__/` subdirectories. The `testMatch` pattern is `**.test.ts`.

- tree-sitter tests have global state issues — Jest is configured with `maxWorkers: 2` and `resetModules: true` to isolate them
- `src/__tests__/setup.ts` runs `setupFilesAfterEnv` for cleanup between test files
- `src/indexer/__tests__/setup.ts` handles tree-sitter–specific teardown
- Coverage excludes entrypoints (`cli.ts`, `server.ts`, `configLoader.ts`) and index barrel files

## Documentation Rules

- **Never create new doc files** — only update existing sections
- **Never destroy existing content** — surgical section updates only
- Frontmatter `symbols:` array in `.md` files links code symbols to that doc
- Section headings must match symbol names (e.g., `## createOrder`) for section-level updates to work

## Imported Claude Cowork project instructions
