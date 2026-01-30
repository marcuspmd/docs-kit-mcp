# Task 19 — Business Context Mapper

> **Status:** pending
> **Layer:** Business
> **Priority:** Release 2
> **Depends on:** 02, 07, 15
> **Unblocks:** —

## Pain Point
Product managers and compliance teams can't trace from a Jira ticket to the code that implements it to the docs that describe it. Audits are painful and traceability is manual. (`start.md §3.1`: "Business Context Mapper: liga commits, comentários e tags (ref: PROJ-123) a docs e símbolos" + "RTM: monta matriz requisito → código → teste → doc").

## Objective
Extract business context from commit messages, code comments, and tags (`ref: PROJ-123`) to build a Requirements Traceability Matrix (RTM) linking tickets → code → tests → docs.

## Technical Hints

```ts
// src/business/contextMapper.ts

export interface BusinessRef {
  ticketId: string;           // e.g., "PROJ-123"
  source: "commit" | "comment" | "tag";
  symbolId?: string;
  file: string;
  line?: number;
}

export interface TraceabilityEntry {
  ticketId: string;
  symbols: string[];
  tests: string[];
  docs: string[];
}

export interface ContextMapper {
  extractRefs(repoPath: string): Promise<BusinessRef[]>;
  buildRTM(refs: BusinessRef[], registry: DocRegistry): Promise<TraceabilityEntry[]>;
}

export function createContextMapper(): ContextMapper;
```

```ts
// src/business/rtm.ts
export interface RTM {
  getByTicket(ticketId: string): TraceabilityEntry | undefined;
  getAll(): TraceabilityEntry[];
  export(format: "markdown" | "csv"): string;
}
```

## Files Involved
- `src/business/contextMapper.ts` — ref extraction
- `src/business/rtm.ts` — traceability matrix
- `tests/business.test.ts` — unit tests

## Acceptance Criteria
- [ ] Extracts ticket refs from git log messages (pattern: `PROJ-\d+`)
- [ ] Extracts refs from code comments (`// ref: PROJ-123`)
- [ ] Builds RTM linking ticket → symbols → docs
- [ ] Exports RTM as Markdown table or CSV
- [ ] Unit tests with fixture commits and code

## Scenarios / Examples

```ts
const mapper = createContextMapper();
const refs = await mapper.extractRefs(".");
const rtm = await mapper.buildRTM(refs, registry);
// [{ ticketId: "PROJ-123", symbols: ["OrderService"], tests: ["order.test.ts"], docs: ["domain/orders.md"] }]
```
