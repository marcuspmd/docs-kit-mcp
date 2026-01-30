# Task 01 — Symbol Types & Core Data Model

> **Status:** pending
> **Layer:** Analysis
> **Priority:** MVP
> **Depends on:** 00
> **Unblocks:** 02, 03, 04, 05, 06, 07, 11

## Pain Point
Every module in the system needs a shared vocabulary for what a "code symbol" is. Without a canonical type system, each module invents its own representation, leading to adapter hell and runtime mismatches.

## Objective
Define the core TypeScript types and interfaces that every other module imports: `SymbolKind`, `CodeSymbol`, `ChangeImpact`, `RelationshipType`, and related enums/interfaces.

## Technical Hints

From `start.md §4.3`:

```ts
// src/indexer/symbol.types.ts

export type SymbolKind =
  | "class"
  | "abstract_class"
  | "interface"
  | "enum"
  | "type"
  | "trait"
  | "method"
  | "function"
  | "constructor"
  | "lambda"
  | "dto"
  | "entity"
  | "value_object"
  | "event"
  | "listener"
  | "service"
  | "repository"
  | "use_case"
  | "controller"
  | "command"
  | "query"
  | "handler"
  | "factory"
  | "builder"
  | "model"
  | "schema"
  | "migration"
  | "middleware"
  | "provider"
  | "component"
  | "test"
  | "mock";

export interface CodeSymbol {
  id: string;
  name: string;
  qualifiedName?: string;
  kind: SymbolKind;

  file: string;
  startLine: number;
  endLine: number;

  parent?: string;

  visibility?: "public" | "protected" | "private";
  exported?: boolean;
  language?: "ts" | "js" | "php" | "python" | "go";

  docRef?: string;
  summary?: string;
  tags?: string[];
  domain?: string;
  boundedContext?: string;

  extends?: string;
  implements?: string[];
  usesTraits?: string[];
  references?: string[];
  referencedBy?: string[];

  layer?: "domain" | "application" | "infrastructure" | "presentation" | "test";

  metrics?: {
    linesOfCode?: number;
    cyclomaticComplexity?: number;
    parameterCount?: number;
  };

  pattern?: string;
  violations?: string[];

  deprecated?: boolean;
  since?: string;
  stability?: "experimental" | "stable" | "deprecated";

  generated?: boolean;
  source?: "human" | "ai";

  lastModified?: Date;
  signature?: string;
}


export interface CodeEmbedding {
  id: string;              // geralmente = CodeSymbol.id
  vector: number[];        // embedding real
  model: string;
  version: string;
  dimensions: number;
  createdAt: Date;
  sourceHash: string;      // hash do texto usado
}

interface EmbeddingPayload {
  qualifiedName: string;
  kind: SymbolKind;
  summary?: string;
  doc?: string;
  signature?: string;
  tags?: string[];
  domain?: string;
}

```

Additional types needed by downstream tasks:

```ts
export type RelationshipType =
  | "calls"
  | "inherits"
  | "implements"
  | "instantiates"
  | "uses"
  | "contains"
  | string;

export interface SymbolRelationship {
  sourceId: string;
  targetId: string;
  type: RelationshipType;

  confidence?: number;        // 0–1 (AST vs inferido por IA)
  location?: {
    file: string;
    line: number;
  };

  inferred?: boolean;         // não veio direto do AST
}

export type ChangeType = "added" | "removed" | "modified" | "renamed"
| "moved"        // arquivo ou namespace
| "signature_changed"
| "visibility_changed"
| "behavior_changed" // inferido por IA

export interface ChangeImpact {
  symbol: CodeSymbol;
  changeType: ChangeType;

  diff: string;

  breakingChange?: boolean;
  severity?: "low" | "medium" | "high" | "critical";

  docUpdateRequired: boolean;

  directImpacts?: string[];
  indirectImpacts?: string[];

  reason?: string;

  suggestedActions?: {
    type: "update_doc" | "add_test" | "refactor" | "review";
    target?: string;
    description: string;
  }[];
}

```

Use Zod for runtime validation (per CLAUDE.md, use `z.uuid()` not `z.string().uuid()`):

```ts
import { z } from "zod";

import { z } from "zod";

/* ------------------ Enums auxiliares ------------------ */

export const SymbolKindSchema = z.enum([
  "class",
  "abstract_class",
  "interface",
  "enum",
  "type",
  "trait",
  "method",
  "function",
  "constructor",
  "lambda",
  "dto",
  "entity",
  "value_object",
  "event",
  "listener",
  "service",
  "repository",
  "use_case",
  "controller",
  "command",
  "query",
  "handler",
  "factory",
  "builder",
  "model",
  "schema",
  "migration",
  "middleware",
  "provider",
  "component",
  "test",
  "mock",
]);

export const VisibilitySchema = z.enum(["public", "protected", "private"]);

export const LanguageSchema = z.enum(["ts", "js", "php", "python", "go"]);

export const LayerSchema = z.enum([
  "domain",
  "application",
  "infrastructure",
  "presentation",
  "test",
]);

export const StabilitySchema = z.enum([
  "experimental",
  "stable",
  "deprecated",
]);

/* ------------------ Métricas ------------------ */

export const CodeMetricsSchema = z.object({
  linesOfCode: z.number().int().nonnegative().optional(),
  cyclomaticComplexity: z.number().int().nonnegative().optional(),
  parameterCount: z.number().int().nonnegative().optional(),
});

/* ------------------ CodeSymbol ------------------ */

export const CodeSymbolSchema = z.object({
  id: z.string().min(1),

  name: z.string().min(1),
  qualifiedName: z.string().min(1).optional(),
  kind: SymbolKindSchema,

  file: z.string().min(1),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),

  parent: z.string().optional(),

  visibility: VisibilitySchema.optional(),
  exported: z.boolean().optional(),
  language: LanguageSchema.optional(),

  docRef: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  domain: z.string().optional(),
  boundedContext: z.string().optional(),

  extends: z.string().optional(),
  implements: z.array(z.string().min(1)).optional(),
  usesTraits: z.array(z.string().min(1)).optional(),
  references: z.array(z.string().min(1)).optional(),
  referencedBy: z.array(z.string().min(1)).optional(),

  layer: LayerSchema.optional(),

  metrics: CodeMetricsSchema.optional(),

  pattern: z.string().optional(),
  violations: z.array(z.string().min(1)).optional(),

  deprecated: z.boolean().optional(),
  since: z.string().optional(),
  stability: StabilitySchema.optional(),

  generated: z.boolean().optional(),
  source: z.enum(["human", "ai"]).optional(),

  lastModified: z.date().optional(),
  signature: z.string().optional(),
})
.refine(
  (s) => s.endLine >= s.startLine,
  {
    message: "endLine must be greater than or equal to startLine",
    path: ["endLine"],
  }
);


export type CodeSymbolFromSchema = z.infer<typeof CodeSymbolSchema>;


```

## Files Involved
- `src/indexer/symbol.types.ts` — all type definitions and Zod schemas

## Acceptance Criteria
- [ ] `SymbolKind`, `CodeSymbol`, `ChangeImpact`, `SymbolRelationship` exported
- [ ] Zod schemas validate correct data and reject invalid data
- [ ] `id` generation is deterministic given same `file + name + kind`
- [ ] Unit tests cover valid construction, invalid rejection, and edge cases
- [ ] No circular imports

## Scenarios / Examples

```ts
import { CodeSymbol, CodeSymbolSchema } from "./symbol.types";

const sym: CodeSymbol = {
  ...

CodeSymbolSchema.parse(sym); // ✓ passes

CodeSymbolSchema.parse({ ...sym, kind: "unknown" }); // ✗ throws ZodError
```
