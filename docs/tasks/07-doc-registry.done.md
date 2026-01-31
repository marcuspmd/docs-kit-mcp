# Task 07 — Doc Registry

> **Status:** done
> **Layer:** Documentation
> **Priority:** MVP
> **Depends on:** 01, 06, 11
> **Unblocks:** 08

## Pain Point
When the Change Analyzer flags `OrderService` as changed, the system needs to instantly find which `.md` file(s) document it. Without a registry, this requires scanning every doc file on every change — slow and unreliable.

## Objective
Build a symbol-to-document mapping registry backed by SQLite (Task 11), populated by scanning doc files' frontmatter.

## Technical Hints

```ts
// src/docs/docRegistry.ts

import { DocFrontmatter } from "./frontmatter";

export interface DocMapping {
  symbolName: string;     // e.g., "OrderService.createOrder"
  docPath: string;        // e.g., "docs/domain/orders.md"
  section?: string;       // optional: heading anchor within the doc
}

export interface DocRegistry {
  /** Scan docs directory and rebuild the registry */
  rebuild(docsDir: string): Promise<void>;

  /** Find doc(s) linked to a symbol */
  findDocBySymbol(symbolName: string): Promise<DocMapping[]>;

  /** Find all symbols documented in a file */
  findSymbolsByDoc(docPath: string): Promise<string[]>;

  /** Register a new mapping */
  register(mapping: DocMapping): Promise<void>;

  /** Remove mappings for a symbol */
  unregister(symbolName: string): Promise<void>;
}

export function createDocRegistry(db: Database): DocRegistry;
```

SQLite schema (coordinates with Task 11):

```sql
CREATE TABLE IF NOT EXISTS doc_mappings (
  symbol_name TEXT NOT NULL,
  doc_path    TEXT NOT NULL,
  section     TEXT,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (symbol_name, doc_path)
);
```

Rebuild logic:

```ts
async rebuild(docsDir: string): Promise<void> {
  const mdFiles = await glob("**/*.md", { cwd: docsDir });
  await db.run("DELETE FROM doc_mappings");

  for (const file of mdFiles) {
    const content = await readFile(join(docsDir, file), "utf-8");
    const { frontmatter } = parseFrontmatter(content);
    for (const sym of frontmatter.symbols) {
      await this.register({ symbolName: sym, docPath: file });
    }
  }
}
```

## Files Involved
- `src/docs/docRegistry.ts` — registry implementation
- `src/storage/schema.sql` — table definition (Task 11)
- `tests/docs.test.ts` — unit tests

## Acceptance Criteria
- [ ] `rebuild` scans all `.md` files and populates registry from frontmatter
- [ ] `findDocBySymbol` returns correct doc path(s) for a given symbol
- [ ] `findSymbolsByDoc` returns all symbols linked to a doc file
- [ ] `register` / `unregister` update the database
- [ ] Handles docs with no frontmatter (skips them)
- [ ] Unit tests with in-memory SQLite

## Scenarios / Examples

```ts
const registry = createDocRegistry(db);
await registry.rebuild("./docs");

const docs = await registry.findDocBySymbol("OrderService.createOrder");
// [{ symbolName: "OrderService.createOrder", docPath: "domain/orders.md" }]

const symbols = await registry.findSymbolsByDoc("domain/orders.md");
// ["OrderService", "OrderService.createOrder", "OrderService.cancelOrder"]
```
