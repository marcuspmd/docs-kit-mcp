# Task 17 — Reaper (Dead Code & Orphan Doc Detector)

> **Status:** pending
> **Layer:** Governance
> **Priority:** Release 2
> **Depends on:** 02, 07, 15
> **Unblocks:** —

## Pain Point
Dead code and orphan docs accumulate silently. Docs reference symbols that no longer exist, and code has no remaining callers. This bloats the codebase and misleads developers. (`start.md §3.1`: "Reaper: identifica código morto, docs órfãs e links quebrados para limpeza proativa").

## Objective
Scan the codebase for dead symbols (no references), orphan docs (linked symbols don't exist), and broken links, producing a cleanup report.

## Technical Hints

```ts
// src/governance/reaper.ts

export interface ReaperFinding {
  type: "dead_code" | "orphan_doc" | "broken_link";
  target: string;           // symbol id or doc path or URL
  reason: string;
  suggestedAction: "remove" | "update" | "review";
}

export interface Reaper {
  scan(symbols: CodeSymbol[], graph: KnowledgeGraph, registry: DocRegistry): Promise<ReaperFinding[]>;
}

export function createReaper(): Reaper;
```

## Files Involved
- `src/governance/reaper.ts` — scanner logic
- `tests/governance.test.ts` — unit tests

## Acceptance Criteria
- [ ] Identifies symbols with zero incoming references (dead code candidates)
- [ ] Identifies doc mappings pointing to non-existent symbols (orphan docs)
- [ ] Identifies broken markdown links within doc files
- [ ] Returns actionable findings with suggested actions
- [ ] Unit tests for each finding type

## Scenarios / Examples

```ts
const findings = await reaper.scan(symbols, graph, registry);
// [{ type: "orphan_doc", target: "docs/domain/legacy.md", reason: "Symbol 'LegacyService' no longer exists" }]
// [{ type: "dead_code", target: "src/utils/old.ts:formatDate:function", reason: "No callers found" }]
```
