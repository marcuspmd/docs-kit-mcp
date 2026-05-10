import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { RelationshipRow } from "../../../storage/db.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────
jest.unstable_mockModule("../../../shared.js", () => ({
  buildMermaidTopConnected: jest.fn().mockReturnValue(""),
  fileSlug: jest.fn((p: string) => p.replace(/\//g, "--").replace(/\.ts$/, "")),
  buildSmartDiagramsForFile: jest.fn().mockReturnValue([]),
  buildMermaidForFile: jest.fn().mockReturnValue(""),
}));

jest.unstable_mockModule("../../layout.js", () => ({
  layout: jest.fn((_title: string, _page: string, body: string) => `<html>${body}</html>`),
}));

jest.unstable_mockModule("../../utils.js", () => ({
  escapeHtml: jest.fn((s: string) => s),
  escapeCodeBlocks: jest.fn((s: string) => s),
  docEntryLabel: jest.fn(() => "label"),
}));

jest.unstable_mockModule("../../mermaid.js", () => ({
  mermaidDiagramWrap: jest.fn((s: string) => `<mermaid>${s}</mermaid>`),
  getMermaidExpandModalAndScript: jest.fn(() => ""),
}));

jest.unstable_mockModule("../../badges.js", () => ({
  badgeClass: jest.fn(() => "badge-class"),
  visibilityBadge: jest.fn(() => ""),
  layerBadge: jest.fn(() => ""),
  statusBadges: jest.fn(() => ""),
  violationsBadges: jest.fn(() => ""),
  coverageBadge: jest.fn(() => ""),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeSymbol = (overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol =>
  ({
    kind: "class",
    file: "src/a.ts",
    startLine: 1,
    endLine: 10,
    language: "ts",
    exported: false,
    ...overrides,
  }) as CodeSymbol;

const makeRel = (source_id: string, target_id: string, type = "uses"): RelationshipRow => ({
  source_id,
  target_id,
  type,
});

// ─── Relationships page ───────────────────────────────────────────────────────
describe("renderRelationshipsPage", () => {
  let renderRelationshipsPage: typeof import("../relationships.js").renderRelationshipsPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderRelationshipsPage } = await import("../relationships.js"));
  });

  it("renders with empty relationships", () => {
    const result = renderRelationshipsPage([], []);
    expect(result).toContain("Relationships");
  });

  it("renders relationship type counts", () => {
    const symA = makeSymbol({ id: "a", name: "ServiceA" });
    const symB = makeSymbol({ id: "b", name: "RepoA" });
    const rels = [makeRel("a", "b", "uses"), makeRel("a", "b", "uses")];
    const result = renderRelationshipsPage(rels, [symA, symB]);
    expect(result).toContain("uses");
  });

  it("renders table row for each relationship", () => {
    const symA = makeSymbol({ id: "a", name: "ServiceA" });
    const symB = makeSymbol({ id: "b", name: "RepoA" });
    const rels = [makeRel("a", "b", "calls")];
    const result = renderRelationshipsPage(rels, [symA, symB]);
    expect(result).toContain("calls");
  });
});

// ─── Deprecated page ─────────────────────────────────────────────────────────
describe("renderDeprecatedPage", () => {
  let renderDeprecatedPage: typeof import("../deprecated.js").renderDeprecatedPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderDeprecatedPage } = await import("../deprecated.js"));
  });

  it("renders empty state when no deprecated symbols", () => {
    const result = renderDeprecatedPage([makeSymbol({ id: "a", name: "Active" })]);
    expect(result).toContain("No deprecated symbols");
  });

  it("renders table for deprecated symbols", () => {
    const sym = makeSymbol({ id: "a", name: "OldService", deprecated: true });
    const result = renderDeprecatedPage([sym]);
    expect(result).toContain("OldService");
    expect(result).not.toContain("No deprecated symbols");
  });

  it("includes symbol kind and file in table", () => {
    const sym = makeSymbol({
      id: "a",
      name: "OldApi",
      deprecated: true,
      kind: "function",
      file: "src/api.ts",
    });
    const result = renderDeprecatedPage([sym]);
    expect(result).toContain("function");
    expect(result).toContain("src/api.ts");
  });
});

// ─── Patterns page ───────────────────────────────────────────────────────────
describe("renderPatternsPage", () => {
  let renderPatternsPage: typeof import("../patterns.js").renderPatternsPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderPatternsPage } = await import("../patterns.js"));
  });

  it("renders empty state when no patterns", () => {
    const result = renderPatternsPage([], []);
    expect(result).toContain("No patterns detected");
  });

  it("renders patterns list", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService" });
    const pattern = {
      kind: "Singleton",
      confidence: 0.9,
      symbols: ["a"],
      violations: [],
    };
    const result = renderPatternsPage([pattern as any], [sym]);
    expect(result).toContain("Singleton");
    expect(result).toContain("90%");
  });

  it("renders pattern violations when present", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService" });
    const pattern = {
      kind: "Singleton",
      confidence: 0.7,
      symbols: ["a"],
      violations: ["Missing private constructor"],
    };
    const result = renderPatternsPage([pattern as any], [sym]);
    expect(result).toContain("Missing private constructor");
  });

  it("renders 'No violations' message for clean patterns", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService" });
    const pattern = { kind: "Factory", confidence: 0.85, symbols: ["a"], violations: [] };
    const result = renderPatternsPage([pattern as any], [sym]);
    expect(result).toContain("No violations found");
  });
});

// ─── Files page ───────────────────────────────────────────────────────────────
describe("renderFilesPage", () => {
  let renderFilesPage: typeof import("../files.js").renderFilesPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderFilesPage } = await import("../files.js"));
  });

  it("renders with empty file list", () => {
    const result = renderFilesPage([], []);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("renders file paths in output", () => {
    const sym = makeSymbol({ id: "a", name: "ServiceA", file: "src/services/order.ts" });
    const result = renderFilesPage(["src/services/order.ts"], [sym]);
    expect(result).toContain("src");
  });

  it("renders multiple files", () => {
    const sym1 = makeSymbol({ id: "a", name: "ServiceA", file: "src/a.ts" });
    const sym2 = makeSymbol({ id: "b", name: "ServiceB", file: "src/b.ts" });
    const result = renderFilesPage(["src/a.ts", "src/b.ts"], [sym1, sym2]);
    expect(result).toContain("html");
  });
});

// ─── File detail page ─────────────────────────────────────────────────────────
describe("renderFilePage", () => {
  let renderFilePage: typeof import("../files.js").renderFilePage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderFilePage } = await import("../files.js"));
  });

  it("renders file page with no symbols", () => {
    const result = renderFilePage("src/empty.ts", []);
    expect(result).toContain("html");
  });

  it("renders symbols in the file", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService", file: "src/order.ts" });
    const result = renderFilePage("src/order.ts", [sym]);
    expect(result).toContain("OrderService");
  });

  it("renders source code when provided", () => {
    const sym = makeSymbol({ id: "a", name: "Svc", file: "src/svc.ts" });
    const result = renderFilePage("src/svc.ts", [sym], "const x = 1;");
    expect(result).toContain("const x = 1");
  });
});
