# Task 14 — Mermaid Diagram Generator

> **Status:** done
> **Layer:** Documentation
> **Priority:** Release 1
> **Depends on:** 02, 13, 15
> **Unblocks:** —

## Pain Point
Developers and architects need visual diagrams to understand system structure, but manually creating and maintaining Mermaid diagrams is tedious and they go stale quickly. (`start.md §6.1`: `generateMermaid symbols=ClassA,ClassB type=classDiagram`).

## Objective
Generate Mermaid diagram syntax (class, sequence, flowchart) from indexed symbols and their relationships.

## Technical Hints

```ts
// src/docs/mermaidGenerator.ts

export type DiagramType = "classDiagram" | "sequenceDiagram" | "flowchart";

export interface MermaidOptions {
  symbols: string[];        // symbol names to include
  type: DiagramType;
  includeRelationships?: boolean;
  maxDepth?: number;        // relationship traversal depth
}

export function generateMermaid(
  options: MermaidOptions,
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[]
): string;
```

Class diagram example output:

```ts
function generateClassDiagram(syms: CodeSymbol[], rels: SymbolRelationship[]): string {
  let diagram = "classDiagram\n";
  for (const sym of syms.filter(s => s.kind === "class")) {
    const methods = syms.filter(s => s.parent === sym.id && s.kind === "method");
    diagram += `  class ${sym.name} {\n`;
    for (const m of methods) diagram += `    +${m.name}()\n`;
    diagram += `  }\n`;
  }
  for (const rel of rels) {
    diagram += `  ${sourceName} --> ${targetName} : ${rel.type}\n`;
  }
  return diagram;
}
```

## Files Involved
- `src/docs/mermaidGenerator.ts` — diagram generation
- `tests/mermaid.test.ts` — unit tests

## Acceptance Criteria
- [ ] Generates valid `classDiagram` syntax for class symbols with methods
- [ ] Generates valid `sequenceDiagram` for event flows
- [ ] Generates `flowchart` for call chains
- [ ] Output is valid Mermaid (parseable by Mermaid.js)
- [ ] Unit tests for each diagram type

## Scenarios / Examples

```ts
const mermaid = generateMermaid(
  { symbols: ["OrderService", "PaymentService"], type: "classDiagram" },
  symbols, relationships
);
// classDiagram
//   class OrderService {
//     +createOrder()
//     +cancelOrder()
//   }
//   class PaymentService {
//     +charge()
//   }
//   OrderService --> PaymentService : calls
```
