# Task 13 — Event Flow Analyzer

> **Status:** pending
> **Layer:** Analysis
> **Priority:** Release 1
> **Depends on:** 02, 11, 12
> **Unblocks:** 14

## Pain Point
In event-driven architectures, understanding which events trigger which handlers is critical but invisible in the code structure. Developers waste hours tracing event flows manually. (`start.md §3.1`: event/listener as first-class symbol kinds).

## Objective
Analyze event emitters and listeners to build event flow graphs, identifying complete chains (emitter → event → listener → handler) and broken flows.

## Technical Hints

```ts
// src/events/eventFlowAnalyzer.ts

export interface EventFlow {
  event: CodeSymbol;              // the event class/type
  emitters: CodeSymbol[];         // symbols that emit this event
  listeners: CodeSymbol[];        // symbols that handle this event
  complete: boolean;              // true if has both emitters and listeners
}

export interface EventFlowAnalyzer {
  analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]): EventFlow[];
}

export function createEventFlowAnalyzer(): EventFlowAnalyzer;
```

## Files Involved
- `src/events/eventFlowAnalyzer.ts` — flow analysis
- `tests/events.test.ts` — unit tests

## Acceptance Criteria
- [ ] Identifies event → emitter → listener chains
- [ ] Flags incomplete flows (event with no listener, or listener with no emitter)
- [ ] Returns structured `EventFlow[]` for diagram generation (Task 14)
- [ ] Unit tests with event-driven fixture code

## Scenarios / Examples

```ts
const flows = analyzer.analyze(symbols, relationships);
// [{ event: OrderCreatedEvent, emitters: [OrderService], listeners: [InventoryListener, EmailListener], complete: true }]
```
