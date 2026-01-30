# Task 15 — Knowledge Graph

> **Status:** pending
> **Layer:** Knowledge
> **Priority:** Release 1
> **Depends on:** 02, 11
> **Unblocks:** 14, 18

## Pain Point
Impact analysis ("if I change X, what breaks?") requires understanding symbol relationships — calls, inheritance, implementations. Without a graph, this is guesswork. (`start.md §3.1`: "Knowledge Graph: relaciona símbolos (calls, inherits, instantiates) para análises de impacto e fluxos").

## Objective
Build a symbol relationship graph backed by SQLite, enabling traversal queries like "find all transitive dependents of symbol X".

## Technical Hints

```ts
// src/knowledge/graph.ts

export interface KnowledgeGraph {
  addRelationship(rel: SymbolRelationship): void;
  removeRelationship(sourceId: string, targetId: string): void;

  /** Direct dependents (who calls/uses this symbol) */
  getDependents(symbolId: string): SymbolRelationship[];

  /** Direct dependencies (what this symbol calls/uses) */
  getDependencies(symbolId: string): SymbolRelationship[];

  /** Transitive impact — all symbols reachable from this one */
  getImpactRadius(symbolId: string, maxDepth?: number): string[];

  /** Rebuild graph from AST analysis */
  rebuild(symbols: CodeSymbol[]): Promise<void>;
}

export function createKnowledgeGraph(db: Database.Database): KnowledgeGraph;
```

Uses the `relationships` table from Task 11 schema.

## Files Involved
- `src/knowledge/graph.ts` — graph implementation
- `tests/knowledge.test.ts` — unit tests

## Acceptance Criteria
- [ ] CRUD operations on relationships
- [ ] `getDependents` / `getDependencies` return correct direct links
- [ ] `getImpactRadius` performs BFS/DFS traversal up to maxDepth
- [ ] Handles cycles without infinite loops
- [ ] Unit tests with graph fixtures (diamond dependencies, cycles)

## Scenarios / Examples

```ts
const graph = createKnowledgeGraph(db);
graph.addRelationship({ sourceId: "OrderService", targetId: "PaymentService", type: "calls" });
graph.addRelationship({ sourceId: "PaymentService", targetId: "StripeClient", type: "calls" });

const impact = graph.getImpactRadius("StripeClient", 3);
// ["PaymentService", "OrderService"] — changing StripeClient impacts these
```
