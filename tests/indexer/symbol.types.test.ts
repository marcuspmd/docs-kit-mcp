import {
  CodeSymbolSchema,
  SymbolRelationshipSchema,
  ChangeImpactSchema,
  ChangeTypeSchema,
  SymbolKindSchema,
  CodeEmbeddingSchema,
  generateSymbolId,
} from "../../src/indexer/symbol.types.js";

function validSymbol(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc123",
    name: "UserService",
    kind: "service" as const,
    file: "src/user.ts",
    startLine: 1,
    endLine: 50,
    ...overrides,
  };
}

describe("CodeSymbolSchema", () => {
  it("accepts a valid minimal symbol", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol());
    expect(result.success).toBe(true);
  });

  it("accepts a symbol with all optional fields", () => {
    const result = CodeSymbolSchema.safeParse(
      validSymbol({
        qualifiedName: "app.UserService",
        parent: "app",
        visibility: "public",
        exported: true,
        language: "ts",
        layer: "application",
        metrics: { linesOfCode: 50, cyclomaticComplexity: 3, parameterCount: 2 },
        deprecated: false,
        stability: "stable",
        tags: ["auth"],
        implements: ["IUserService"],
        lastModified: new Date(),
        signature: "class UserService",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects unknown SymbolKind", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol({ kind: "unknown" }));
    expect(result.success).toBe(false);
  });

  it("rejects endLine < startLine", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol({ startLine: 10, endLine: 5 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("endLine");
    }
  });

  it("rejects empty id", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol({ id: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects negative startLine", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol({ startLine: -1 }));
    expect(result.success).toBe(false);
  });

  it("accepts startLine equal to endLine", () => {
    const result = CodeSymbolSchema.safeParse(validSymbol({ startLine: 5, endLine: 5 }));
    expect(result.success).toBe(true);
  });
});

describe("SymbolKindSchema", () => {
  it("accepts all defined kinds", () => {
    const kinds = [
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
    ];
    for (const kind of kinds) {
      expect(SymbolKindSchema.safeParse(kind).success).toBe(true);
    }
  });
});

describe("SymbolRelationshipSchema", () => {
  it("accepts a valid relationship", () => {
    const result = SymbolRelationshipSchema.safeParse({
      sourceId: "a",
      targetId: "b",
      type: "calls",
    });
    expect(result.success).toBe(true);
  });

  it("accepts custom relationship type", () => {
    const result = SymbolRelationshipSchema.safeParse({
      sourceId: "a",
      targetId: "b",
      type: "decorates",
    });
    expect(result.success).toBe(true);
  });

  it("accepts relationship with confidence and location", () => {
    const result = SymbolRelationshipSchema.safeParse({
      sourceId: "a",
      targetId: "b",
      type: "inherits",
      confidence: 0.95,
      location: { file: "src/foo.ts", line: 10 },
      inferred: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence > 1", () => {
    const result = SymbolRelationshipSchema.safeParse({
      sourceId: "a",
      targetId: "b",
      type: "calls",
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("ChangeImpactSchema", () => {
  it("accepts valid change impact", () => {
    const result = ChangeImpactSchema.safeParse({
      symbol: validSymbol(),
      changeType: "modified",
      diff: "- old\n+ new",
      docUpdateRequired: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts with suggestedActions", () => {
    const result = ChangeImpactSchema.safeParse({
      symbol: validSymbol(),
      changeType: "signature_changed",
      diff: "- fn(a)\n+ fn(a, b)",
      docUpdateRequired: true,
      breakingChange: true,
      severity: "high",
      suggestedActions: [{ type: "update_doc", description: "Update API docs" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid changeType", () => {
    const result = ChangeTypeSchema.safeParse("deleted");
    expect(result.success).toBe(false);
  });
});

describe("generateSymbolId", () => {
  it("returns deterministic id for same inputs", () => {
    const id1 = generateSymbolId("src/a.ts", "Foo", "class");
    const id2 = generateSymbolId("src/a.ts", "Foo", "class");
    expect(id1).toBe(id2);
  });

  it("returns different ids for different inputs", () => {
    const id1 = generateSymbolId("src/a.ts", "Foo", "class");
    const id2 = generateSymbolId("src/a.ts", "Bar", "class");
    expect(id1).not.toBe(id2);
  });

  it("returns a 16-char hex string", () => {
    const id = generateSymbolId("src/a.ts", "Foo", "class");
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("CodeEmbeddingSchema", () => {
  it("accepts valid embedding", () => {
    const result = CodeEmbeddingSchema.safeParse({
      id: "sym1",
      vector: [0.1, 0.2, 0.3],
      model: "text-embedding-3-small",
      version: "1",
      dimensions: 3,
      createdAt: new Date(),
      sourceHash: "abc123",
    });
    expect(result.success).toBe(true);
  });
});
