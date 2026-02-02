import { z } from "zod";
import { createHash } from "node:crypto";

/* ================== Enums ================== */

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

export type SymbolKind = z.infer<typeof SymbolKindSchema>;

export const VisibilitySchema = z.enum(["public", "protected", "private"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const LanguageSchema = z.enum(["ts", "js", "php", "python", "go"]);
export type Language = z.infer<typeof LanguageSchema>;

export const LayerSchema = z.enum([
  "domain",
  "application",
  "infrastructure",
  "presentation",
  "test",
]);
export type Layer = z.infer<typeof LayerSchema>;

export const StabilitySchema = z.enum(["experimental", "stable", "deprecated"]);
export type Stability = z.infer<typeof StabilitySchema>;

/* ================== Metrics ================== */

export const CodeMetricsSchema = z.object({
  linesOfCode: z.number().int().nonnegative().optional(),
  cyclomaticComplexity: z.number().int().nonnegative().optional(),
  parameterCount: z.number().int().nonnegative().optional(),
  testCoverage: z
    .object({
      hitCount: z.number().int().nonnegative(),
      linesHit: z.number().int().nonnegative(),
      linesCovered: z.number().int().nonnegative(),
      coveragePercent: z.number().min(0).max(100),
      branchesHit: z.number().int().nonnegative().optional(),
      branchesCovered: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type CodeMetrics = z.infer<typeof CodeMetricsSchema>;

/* ================== CodeSymbol ================== */

export const CodeSymbolSchema = z
  .object({
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
    docComment: z.string().optional(),
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

    explanation: z.string().optional(),
    explanationHash: z.string().optional(),
  })
  .refine((s) => s.endLine >= s.startLine, {
    message: "endLine must be greater than or equal to startLine",
    path: ["endLine"],
  });

export type CodeSymbol = z.infer<typeof CodeSymbolSchema>;

/* ================== CodeEmbedding ================== */

export const CodeEmbeddingSchema = z.object({
  id: z.string().min(1),
  vector: z.array(z.number()),
  model: z.string().min(1),
  version: z.string().min(1),
  dimensions: z.number().int().positive(),
  createdAt: z.date(),
  sourceHash: z.string().min(1),
});

export type CodeEmbedding = z.infer<typeof CodeEmbeddingSchema>;

/* ================== EmbeddingPayload ================== */

export const EmbeddingPayloadSchema = z.object({
  qualifiedName: z.string().min(1),
  kind: SymbolKindSchema,
  summary: z.string().optional(),
  doc: z.string().optional(),
  signature: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  domain: z.string().optional(),
});

export type EmbeddingPayload = z.infer<typeof EmbeddingPayloadSchema>;

/* ================== Relationships ================== */

export const RelationshipTypeSchema = z.union([
  z.enum(["calls", "inherits", "implements", "instantiates", "uses", "contains"]),
  z.string().min(1),
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const SymbolRelationshipSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: RelationshipTypeSchema,
  confidence: z.number().min(0).max(1).optional(),
  location: z
    .object({
      file: z.string().min(1),
      line: z.number().int().nonnegative(),
    })
    .optional(),
  inferred: z.boolean().optional(),
});

export type SymbolRelationship = z.infer<typeof SymbolRelationshipSchema>;

/* ================== Change Impact ================== */

export const ChangeTypeSchema = z.enum([
  "added",
  "removed",
  "modified",
  "renamed",
  "moved",
  "signature_changed",
  "visibility_changed",
  "behavior_changed",
]);

export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const ChangeImpactSchema = z.object({
  symbol: CodeSymbolSchema,
  changeType: ChangeTypeSchema,
  diff: z.string(),
  breakingChange: z.boolean().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  docUpdateRequired: z.boolean(),
  directImpacts: z.array(z.string().min(1)).optional(),
  indirectImpacts: z.array(z.string().min(1)).optional(),
  reason: z.string().optional(),
  suggestedActions: z
    .array(
      z.object({
        type: z.enum(["update_doc", "add_test", "refactor", "review"]),
        target: z.string().optional(),
        description: z.string().min(1),
      }),
    )
    .optional(),
});

export type ChangeImpact = z.infer<typeof ChangeImpactSchema>;

/* ================== Deterministic ID ================== */

export function generateSymbolId(file: string, name: string, kind: SymbolKind): string {
  return createHash("sha256").update(`${file}::${name}::${kind}`).digest("hex").slice(0, 16);
}

/** Minimal CodeSymbol for fallback when a symbol is not found in the index (e.g. for prompt building). */
export function createStubCodeSymbol(name: string, kind: SymbolKind = "function"): CodeSymbol {
  return {
    id: "_",
    name,
    kind,
    file: "unknown",
    startLine: 0,
    endLine: 0,
  };
}
