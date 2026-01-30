# Task 12 — Pattern Analyzer

> **Status:** pending
> **Layer:** Governance
> **Priority:** Release 1
> **Depends on:** 02, 11
> **Unblocks:** 16

## Pain Point
Tech leads can't automatically detect which design patterns are used (or misused) in the codebase. Pattern detection is manual, inconsistent, and rarely documented — leading to architectural drift (`start.md §3.1`: "Pattern Analyzer + Violations: detecção de padrões (Observer, Factory etc.) e violações (incluindo SOLID)").

## Objective
Detect common design patterns (Observer, Factory, Singleton, Strategy, Repository) from AST-indexed symbols and their relationships, flagging violations (e.g., Observer without listeners).

## Technical Hints

```ts
// src/patterns/patternAnalyzer.ts

export type PatternKind = "observer" | "factory" | "singleton" | "strategy" | "repository";

export interface DetectedPattern {
  kind: PatternKind;
  symbols: string[];         // symbol IDs involved
  confidence: number;        // 0–1
  violations: string[];      // e.g., "Observer 'OrderEvents' has no registered listeners"
}

export interface PatternAnalyzer {
  analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]): DetectedPattern[];
}

export function createPatternAnalyzer(): PatternAnalyzer;
```

Heuristic examples:

```ts
// Observer: class emits events but no listener references it
function detectObserver(symbols: CodeSymbol[], rels: SymbolRelationship[]): DetectedPattern[] {
  const events = symbols.filter(s => s.kind === "event");
  const listeners = symbols.filter(s => s.kind === "listener");
  // Match events to listeners via naming convention or relationships
}

// Factory: class with static create/build methods returning other types
// Singleton: class with private constructor + static instance field
// Repository: class with find/save/delete methods + entity relationship
```

## Files Involved
- `src/patterns/patternAnalyzer.ts` — detection logic
- `tests/patterns.test.ts` — unit tests

## Acceptance Criteria
- [ ] Detects at least 3 pattern types (Observer, Factory, Repository)
- [ ] Reports violations (e.g., orphan event with no listener)
- [ ] Confidence score reflects heuristic strength
- [ ] Results stored in `symbols.pattern` field
- [ ] Unit tests with fixture symbol sets

## Scenarios / Examples

```ts
const patterns = analyzer.analyze(symbols, relationships);
// [{ kind: "observer", symbols: ["OrderEvents", "OrderListener"], confidence: 0.9, violations: [] }]
// [{ kind: "observer", symbols: ["PaymentEvents"], confidence: 0.6, violations: ["No listeners found"] }]
```
