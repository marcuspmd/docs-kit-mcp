# Task 00 — Project Setup

> **Status:** pending
> **Layer:** Infrastructure
> **Priority:** MVP
> **Depends on:** —
> **Unblocks:** 01

## Pain Point
Without a properly configured project skeleton, every subsequent task starts with boilerplate fights — wrong TS config, missing test runner, no lint rules — leading to inconsistent code and wasted time.

## Objective
Deliver a fully configured TypeScript project with build, test, lint, and dev scripts ready to go, plus the directory structure from `start.md §4.1`.

## Technical Hints

Initialize with strict TypeScript and ESM:

```jsonc
// tsconfig.json (key fields)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  }
}
```

Jest config for TypeScript:

```ts
// jest.config.ts
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
};
```

MCP config file:

```json
{
  "name": "docs-agent",
  "description": "Intelligent documentation agent via MCP",
  "command": "node",
  "args": ["dist/server.js"],
  "env": { "NODE_ENV": "production" }
}
```

Directory scaffold should match `start.md §4.1`:

```
src/
  server.ts
  config.ts
  indexer/
  analyzer/
  patterns/
  events/
  docs/
  knowledge/
  governance/
  business/
  prompts/
  storage/
tests/
docs/domain/
```

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server protocol implementation |
| `tree-sitter` + language grammars (`tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-python`, etc.) | Multi-language AST parsing |
| `better-sqlite3` | SQLite storage for symbol index and relationships |
| `glob` / `fast-glob` | File discovery with include/exclude patterns |
| `ignore` | `.gitignore`-compatible pattern matching |
| `zod` | Runtime config validation |

### Dev

| Package | Purpose |
|---|---|
| `typescript` | Compiler |
| `ts-jest` + `jest` + `@types/jest` | Test runner |
| `eslint` + `@typescript-eslint/*` | Linting |
| `prettier` | Formatting |
| `tsx` | Dev-time execution (`ts-node` replacement) |

## Indexer Configuration Schema

`src/config.ts` must expose a validated config (via Zod) that controls which files the indexer will scan. Default values shown below:

```ts
const ConfigSchema = z.object({
  /** Root of the project being analyzed (resolved at runtime) */
  projectRoot: z.string(),

  /** Glob patterns for files to include in indexing */
  include: z.array(z.string()).default([
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "**/*.py",
    "**/*.java",
    "**/*.go",
    "**/*.rs",
  ]),

  /** Glob patterns for files/dirs to always exclude */
  exclude: z.array(z.string()).default([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/.next/**",
    "**/vendor/**",
    "**/__pycache__/**",
    "**/target/**",        // Rust/Java
    "**/.git/**",
    "**/coverage/**",
    "**/*.min.js",
    "**/*.bundle.js",
    "**/*.map",
    "**/*.d.ts",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
  ]),

  /** Whether to also respect the user's .gitignore for exclusion */
  respectGitignore: z.boolean().default(true),

  /** Max file size in bytes — skip files larger than this */
  maxFileSize: z.number().default(512_000), // 500 KB

  /** SQLite database path (relative to projectRoot) */
  dbPath: z.string().default(".doc-kit/index.db"),

  /**
   * Custom prompt rules — matched top-down, first match wins.
   * Allows different documentation prompts per language, glob pattern, or directory.
   */
  promptRules: z.array(z.object({
    /** Human-readable name for this rule */
    name: z.string(),

    /** Match by language identifier (e.g. "typescript", "php", "python") */
    language: z.string().optional(),

    /** Match by glob pattern (e.g. "src/legacy/**", "**/*.dto.ts") */
    pattern: z.string().optional(),

    /** Prompt template for documenting symbols found in matched files */
    symbolPrompt: z.string().optional(),

    /** Prompt template for generating/updating doc sections */
    docPrompt: z.string().optional(),

    /** Prompt template for change summaries (used in commit/PR descriptions) */
    changePrompt: z.string().optional(),

    /** Extra context injected into all prompts for matched files */
    context: z.string().optional(),

    /** Path to a .md file whose content is loaded and appended as extra context */
    contextFile: z.string().optional(),
  }).refine(
    r => r.language || r.pattern,
    { message: "Each rule must have at least `language` or `pattern`" },
  )).default([]),

  /**
   * Fallback prompts used when no promptRule matches a file.
   */
  defaultPrompts: z.object({
    symbolPrompt: z.string().default("Document this symbol concisely: purpose, params, return value, side effects."),
    docPrompt: z.string().default("Update the relevant documentation section to reflect the code change. Preserve existing structure."),
    changePrompt: z.string().default("Summarize what changed semantically, not line-by-line."),
  }).default({}),
});
```

### Prompt Rules — Example

A PHP + TypeScript monorepo where each language needs different documentation style:

```jsonc
// .doc-kit.json (user config)
{
  "promptRules": [
    {
      "name": "PHP Legacy",
      "language": "php",
      "symbolPrompt": "Document using PHPDoc format. Include @param, @return, @throws.",
      "context": "This is a Laravel codebase. Reference Eloquent models by class name.",
      "contextFile": "docs/prompts/php-guidelines.md"
    },
    {
      "name": "TypeScript API",
      "language": "typescript",
      "pattern": "src/api/**",
      "symbolPrompt": "Document using TSDoc. Include @param, @returns. Mention DTO types.",
      "context": "NestJS REST API. All endpoints use class-validator DTOs."
    },
    {
      "name": "TypeScript Frontend",
      "language": "typescript",
      "pattern": "src/app/**",
      "symbolPrompt": "Document React components: props, behavior, key states.",
      "contextFile": "docs/prompts/react-conventions.md"
    },
    {
      "name": "Migration files",
      "pattern": "**/migrations/**",
      "docPrompt": "Describe schema changes: tables created/altered, columns added/removed, indexes."
    }
  ]
}
```

### Prompt Resolution Order

1. Iterate `promptRules` top-down.
2. A rule matches if **all** its defined matchers (`language`, `pattern`) match the file.
3. First matching rule wins — its prompts override the defaults.
4. Any prompt field left `undefined` in the matched rule falls back to `defaultPrompts`.
5. If no rule matches, `defaultPrompts` are used entirely.

### Rationale

- **`respectGitignore: true`** — avoids indexing generated/vendored files the user already ignores, without requiring manual duplication of patterns.
- **Lock files, sourcemaps, `.d.ts`** — contain no meaningful symbols for documentation; excluding them reduces noise and speeds up indexing.
- **`maxFileSize`** — protects against accidentally parsing large generated files (e.g., bundled outputs left outside `dist/`).
- **Common build output dirs** (`dist`, `build`, `out`, `.next`, `target`) — these contain compiled artifacts, not source.

## Files Involved
- `package.json` — project metadata, scripts, dependencies
- `tsconfig.json` — TypeScript configuration
- `jest.config.ts` — test runner config
- `mcp.json` — MCP server descriptor
- `src/server.ts` — entry point stub
- `src/config.ts` — configuration loader stub (exports validated `ConfigSchema` via Zod)

## Acceptance Criteria
- [ ] `npm install` succeeds with zero errors
- [ ] `npm run build` compiles TypeScript to `dist/`
- [ ] `npm test` runs Jest (can report 0 tests, must not crash)
- [ ] All directories from §4.1 exist
- [ ] `mcp.json` matches the spec
- [ ] ESLint and Prettier configured with consistent rules
- [ ] `src/config.ts` exports a Zod-validated config with `include`, `exclude`, `respectGitignore`, and `maxFileSize`
- [ ] Default excludes cover `node_modules`, `dist`, `build`, `vendor`, `__pycache__`, `target`, `.git`, lock files, sourcemaps, and `.d.ts`
- [ ] Default includes cover `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.java`, `.go`, `.rs`
- [ ] `respectGitignore` defaults to `true`
- [ ] `promptRules` array allows matching by `language` and/or `pattern`, with per-rule `symbolPrompt`, `docPrompt`, `changePrompt`, and `context`
- [ ] `defaultPrompts` provides fallback prompts when no rule matches
- [ ] Prompt resolution is top-down, first-match-wins, with per-field fallback to defaults

## Scenarios / Examples

```bash
# Clone and setup
git clone <repo> && cd docs-agent
npm install
npm run build
npm test
# All pass — ready for Task 01
```
