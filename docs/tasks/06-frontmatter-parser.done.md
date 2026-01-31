# Task 06 — Frontmatter Parser

> **Status:** done
> **Layer:** Documentation
> **Priority:** MVP
> **Depends on:** 01
> **Unblocks:** 07

## Pain Point
Documentation files need metadata to link them to code symbols. Without a parser for YAML frontmatter, the system can't discover which `.md` file documents which symbol, breaking the entire doc-update pipeline.

## Objective
Parse and write YAML frontmatter in Markdown files, specifically the `symbols` field that maps docs to code symbols.

## Technical Hints

Expected frontmatter format in `.md` files:

```markdown
---
title: Order Service
symbols:
  - OrderService
  - OrderService.createOrder
  - OrderService.cancelOrder
lastUpdated: 2025-01-15
---

# Order Service

Content here...
```

```ts
// src/docs/frontmatter.ts

export interface DocFrontmatter {
  title?: string;
  symbols: string[];
  lastUpdated?: string;
  [key: string]: unknown;   // allow arbitrary extra fields
}

export interface ParsedDoc {
  frontmatter: DocFrontmatter;
  content: string;            // markdown body (without frontmatter)
  raw: string;                // original full text
}

/** Parse a markdown file's frontmatter */
export function parseFrontmatter(markdown: string): ParsedDoc;

/** Serialize frontmatter + content back to markdown string */
export function serializeFrontmatter(doc: ParsedDoc): string;

/** Update only the frontmatter, preserving content */
export function updateFrontmatter(
  markdown: string,
  update: Partial<DocFrontmatter>
): string;
```

Use a lightweight YAML parser (e.g., `yaml` npm package):

```ts
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseFrontmatter(markdown: string): ParsedDoc {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: { symbols: [] }, content: markdown, raw: markdown };
  }
  const frontmatter = parseYaml(match[1]) as DocFrontmatter;
  frontmatter.symbols ??= [];
  return { frontmatter, content: match[2], raw: markdown };
}
```

## Files Involved
- `src/docs/frontmatter.ts` — frontmatter parse/serialize logic
- `tests/docs.test.ts` — unit tests

## Acceptance Criteria
- [ ] Parses valid YAML frontmatter with `symbols` array
- [ ] Returns empty `symbols` array for files without frontmatter
- [ ] `serializeFrontmatter` round-trips without data loss
- [ ] `updateFrontmatter` modifies only specified fields, preserves others
- [ ] Handles edge cases: empty frontmatter, no closing `---`, extra fields
- [ ] Unit tests with at least 5 fixture markdown strings

## Scenarios / Examples

```ts
const md = `---
title: User Service
symbols:
  - UserService
  - UserService.findById
---

# User Service

Manages user CRUD operations.`;

const parsed = parseFrontmatter(md);
// parsed.frontmatter.symbols === ["UserService", "UserService.findById"]
// parsed.content starts with "\n# User Service\n..."

const updated = updateFrontmatter(md, { lastUpdated: "2025-06-01" });
// frontmatter now includes lastUpdated, content unchanged
```
