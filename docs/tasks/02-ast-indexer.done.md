# Task 02 — AST Indexer (tree-sitter)

> **Status:** done
> **Layer:** Analysis
> **Priority:** MVP
> **Depends on:** 01
> **Unblocks:** 04, 05, 11

## Pain Point
Developers can't get reliable documentation updates if the system doesn't understand code structure. Text-based grep is fragile — renaming a variable shouldn't trigger a doc update, but changing a method signature should. AST parsing is the foundation.

## Objective
Build an indexer that uses tree-sitter to parse source files and extract `CodeSymbol[]` with accurate line ranges, parent relationships, and symbol kinds.

## Technical Hints

```ts
// src/indexer/indexer.ts

import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { CodeSymbol, SymbolKind } from "./symbol.types";

export interface IndexerOptions {
  rootDir: string;
  include?: string[];   // glob patterns, default ["**/*.ts"]
  exclude?: string[];   // e.g., ["node_modules/**", "dist/**"]
}

export interface IndexResult {
  symbols: CodeSymbol[];
  fileCount: number;
  errors: Array<{ file: string; error: string }>;
}

export async function indexProject(options: IndexerOptions): Promise<IndexResult>;

export function indexFile(filePath: string, source: string, parser: Parser): CodeSymbol[];
```

Node-type to SymbolKind mapping (TypeScript):

```ts
const NODE_KIND_MAP: Record<string, SymbolKind> = {
  class_declaration: "class",
  method_definition: "method",
  function_declaration: "function",
  interface_declaration: "interface",
  // DTO/Entity/Event/Listener detected by naming convention or decorator
};
```

Walk the AST tree recursively:

```ts
function walkNode(node: Parser.SyntaxNode, file: string, parent?: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kind = NODE_KIND_MAP[node.type];
  if (kind) {
    const name = node.childForFieldName("name")?.text ?? "anonymous";
    symbols.push({
      id: `${file}:${name}:${kind}`,
      name,
      kind,
      file,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parent,
    });
  }
  for (const child of node.children) {
    symbols.push(...walkNode(child, file, kind ? symbols[symbols.length - 1]?.id : parent));
  }
  return symbols;
}
```

## Files Involved
- `src/indexer/indexer.ts` — main indexer logic
- `src/indexer/symbol.types.ts` — types (from Task 01)
- `tests/indexer.test.ts` — unit tests

## Acceptance Criteria
- [ ] Parses TypeScript files and extracts classes, methods, functions, interfaces
- [ ] Correctly computes `startLine` / `endLine` for each symbol
- [ ] Sets `parent` for methods belonging to a class
- [ ] Handles parse errors gracefully (returns partial results + error list)
- [ ] Supports glob-based file inclusion/exclusion
- [ ] Unit tests with at least 3 fixture files covering: class with methods, standalone functions, interfaces

## Scenarios / Examples

```ts
const result = await indexProject({ rootDir: "./fixtures/sample-project" });
// result.symbols includes:
// { name: "UserService", kind: "class", file: "services/user.ts", startLine: 5, endLine: 42 }
// { name: "findById", kind: "method", parent: "...:UserService:class", ... }
```
