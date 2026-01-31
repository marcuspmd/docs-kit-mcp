# Task 04 — AST Diff

> **Status:** done
> **Layer:** Analysis
> **Priority:** MVP
> **Depends on:** 01, 02
> **Unblocks:** 05

## Pain Point
Text diffs can't distinguish meaningful changes (new parameter, changed return type) from cosmetic ones (formatting, comments). The system needs structural comparison of ASTs before and after a change to detect semantic differences.

## Objective
Compare two AST snapshots of the same file and produce a list of structural changes: added/removed/modified symbols with detail on what changed (signature, body, location).

## Technical Hints

```ts
// src/analyzer/astDiff.ts

import { CodeSymbol } from "../indexer/symbol.types";

export type AstChangeType = "added" | "removed" | "signature_changed" | "body_changed" | "moved";

export interface AstChange {
  symbol: CodeSymbol;
  changeType: AstChangeType;
  details: string;              // human-readable description
  oldSymbol?: CodeSymbol;       // for modified/moved, the previous version
}

/**
 * Compare symbols extracted from old and new versions of a file.
 * Matching is by symbol name + kind (id may differ if file path changed).
 */
export function diffSymbols(oldSymbols: CodeSymbol[], newSymbols: CodeSymbol[]): AstChange[];
```

Matching strategy:

```ts
function matchSymbols(oldSymbols: CodeSymbol[], newSymbols: CodeSymbol[]) {
  const oldMap = new Map(oldSymbols.map(s => [`${s.name}:${s.kind}`, s]));
  const newMap = new Map(newSymbols.map(s => [`${s.name}:${s.kind}`, s]));

  const added = [...newMap.entries()].filter(([k]) => !oldMap.has(k));
  const removed = [...oldMap.entries()].filter(([k]) => !newMap.has(k));
  const common = [...newMap.entries()].filter(([k]) => oldMap.has(k));

  return { added, removed, common };
}
```

Detect signature vs body changes — compare line counts and parent references:

```ts
function classifyChange(oldSym: CodeSymbol, newSym: CodeSymbol): AstChangeType | null {
  if (oldSym.startLine !== newSym.startLine || oldSym.endLine !== newSym.endLine) {
    const sizeChanged = (oldSym.endLine - oldSym.startLine) !== (newSym.endLine - newSym.startLine);
    return sizeChanged ? "body_changed" : "moved";
  }
  return null; // no structural change detected
}
```

For deeper signature detection (parameters, return type), a future enhancement can compare AST node children directly.

## Files Involved
- `src/analyzer/astDiff.ts` — AST comparison logic
- `tests/analyzer.test.ts` — unit tests

## Acceptance Criteria
- [ ] Detects added symbols (present in new, absent in old)
- [ ] Detects removed symbols (present in old, absent in new)
- [ ] Detects modified symbols (same name+kind, different structure)
- [ ] Distinguishes `body_changed` from `moved` (line shift without size change)
- [ ] Returns empty array when files are identical
- [ ] Unit tests with at least 4 scenarios: add, remove, modify, no-change

## Scenarios / Examples

```ts
const old = [{ id: "f:Foo:class", name: "Foo", kind: "class", file: "f", startLine: 1, endLine: 10 }];
const next = [{ id: "f:Foo:class", name: "Foo", kind: "class", file: "f", startLine: 1, endLine: 15 }];

const changes = diffSymbols(old, next);
// [{ symbol: next[0], changeType: "body_changed", details: "body size changed (10 → 15 lines)" }]
```
