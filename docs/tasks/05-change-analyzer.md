# Task 05 — Change Analyzer

> **Status:** pending
> **Layer:** Analysis
> **Priority:** MVP
> **Depends on:** 01, 02, 03, 04
> **Unblocks:** 06, 08, 09

## Pain Point
Tech leads and QA engineers need to know: "which symbols were semantically changed in this PR, and do their docs need updating?" Currently there's no automated way to answer this — developers eyeball diffs and hope nothing was missed.

## Objective
Combine Git diffs (Task 03) with AST diffs (Task 04) to produce `ChangeImpact[]` — the definitive list of symbols that changed semantically, with a `docUpdateRequired` flag.

## Technical Hints

```ts
// src/analyzer/changeAnalyzer.ts

import { ChangeImpact, CodeSymbol } from "../indexer/symbol.types";
import { FileDiff } from "./gitDiff";
import { AstChange } from "./astDiff";

export interface AnalyzeOptions {
  repoPath: string;
  base: string;
  head?: string;
}

/**
 * Full pipeline:
 * 1. Get git diff (Task 03)
 * 2. For each changed file, index old + new AST (Task 02)
 * 3. Compute AST diff (Task 04)
 * 4. Correlate: git hunks ∩ symbol line ranges → impacted symbols
 * 5. Set docUpdateRequired based on change type
 */
export async function analyzeChanges(options: AnalyzeOptions): Promise<ChangeImpact[]>;
```

Correlation logic — a symbol is impacted if any git hunk overlaps its line range:

```ts
function isSymbolImpacted(symbol: CodeSymbol, hunks: DiffHunk[]): boolean {
  return hunks.some(h =>
    h.newStart <= symbol.endLine && (h.newStart + h.newLines) >= symbol.startLine
  );
}
```

Doc-update heuristic:

```ts
function requiresDocUpdate(change: AstChange): boolean {
  // Signature changes and additions always require doc updates
  // Body changes require updates only if significant (heuristic: >20% size change)
  return change.changeType === "added"
    || change.changeType === "removed"
    || change.changeType === "signature_changed";
}
```

Pipeline orchestration (as described in `start.md §3.2.1`):

```ts
export async function analyzeChanges(options: AnalyzeOptions): Promise<ChangeImpact[]> {
  const diffs = await getGitDiff(options);
  const impacts: ChangeImpact[] = [];

  for (const fileDiff of diffs) {
    const oldSymbols = await indexFileAtRef(fileDiff.oldPath, options.base);
    const newSymbols = await indexFileAtRef(fileDiff.newPath, options.head ?? "HEAD");
    const astChanges = diffSymbols(oldSymbols, newSymbols);

    for (const change of astChanges) {
      impacts.push({
        symbol: change.symbol,
        changeType: change.changeType as any,
        diff: extractRelevantDiff(fileDiff, change.symbol),
        docUpdateRequired: requiresDocUpdate(change),
        impactedSymbols: [], // populated by knowledge graph in post-MVP
      });
    }
  }
  return impacts;
}
```

## Files Involved
- `src/analyzer/changeAnalyzer.ts` — orchestration pipeline
- `tests/analyzer.test.ts` — integration tests

## Acceptance Criteria
- [ ] Produces `ChangeImpact[]` from a base..head ref range
- [ ] Correctly marks `docUpdateRequired` for signature changes and additions
- [ ] Does NOT mark cosmetic-only changes (whitespace, comments) as requiring doc updates
- [ ] Handles new files (all symbols = added) and deleted files (all symbols = removed)
- [ ] Integration test with a real git fixture repo (or mocked git output)

## Scenarios / Examples

```ts
const impacts = await analyzeChanges({ repoPath: ".", base: "main", head: "feature/add-email" });
// impacts might include:
// { symbol: { name: "getEmail", kind: "method" }, changeType: "added", docUpdateRequired: true }
// { symbol: { name: "User", kind: "class" }, changeType: "modified", docUpdateRequired: false }
```
