import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { DocEntry } from "../../types.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────
jest.unstable_mockModule("../../utils.js", () => ({
  escapeHtml: jest.fn((s: string) => s ?? ""),
  escapeCodeBlocks: jest.fn((s: string) => s ?? ""),
  docEntryLabel: jest.fn(() => "label"),
  formatDate: jest.fn(() => "Jan 1, 2024"),
}));

jest.unstable_mockModule("../../layout.js", () => ({
  layout: jest.fn((_title: string, _page: string, body: string) => `<html>${body}</html>`),
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

jest.unstable_mockModule("../../../shared.js", () => ({
  fileSlug: jest.fn((p: string) => p.replace(/\//g, "--").replace(/\.[^.]+$/, "")),
  buildMermaidForSymbol: jest.fn().mockReturnValue(""),
  buildMermaidTopConnected: jest.fn().mockReturnValue(""),
}));

jest.unstable_mockModule("../../markdown.js", () => ({
  renderMarkdown: jest.fn((s: string) => `<p>${s ?? ""}</p>`),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeSymbol = (overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol =>
  ({
    kind: "class",
    file: "src/a.ts",
    startLine: 1,
    endLine: 10,
    language: "typescript",
    exported: false,
    layer: "domain",
    ...overrides,
  }) as CodeSymbol;

// ─── DocsPage ────────────────────────────────────────────────────────────────
describe("renderDocsPage", () => {
  let renderDocsPage: typeof import("../docs.js").renderDocsPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderDocsPage } = await import("../docs.js"));
  });

  it("renders with no doc entries", () => {
    const result = renderDocsPage([]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("renders with one doc entry", () => {
    const entry: DocEntry = {
      path: "docs/orders.md",
      title: "Orders",
      name: "orders",
      module: "Commerce",
      category: "domain",
      showOnMenu: true,
    } as DocEntry;
    const result = renderDocsPage([entry]);
    expect(result).toContain("domain");
  });

  it("renders entries grouped by module", () => {
    const entries: DocEntry[] = [
      {
        path: "docs/a.md",
        title: "A Doc",
        module: "Core",
        category: "domain",
        showOnMenu: true,
      } as DocEntry,
      {
        path: "docs/b.md",
        title: "B Doc",
        module: "Core",
        category: "domain",
        showOnMenu: true,
      } as DocEntry,
    ];
    const result = renderDocsPage(entries);
    expect(result).toContain("html");
  });
});

// ─── SymbolPage ──────────────────────────────────────────────────────────────
describe("renderSymbolPage", () => {
  let renderSymbolPage: typeof import("../symbol.js").renderSymbolPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderSymbolPage } = await import("../symbol.js"));
  });

  it("renders a basic symbol page", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService", kind: "class" });
    const result = renderSymbolPage(sym, [], [], undefined, []);
    expect(typeof result).toBe("string");
    expect(result).toContain("OrderService");
  });

  it("renders a deprecated symbol", () => {
    const sym = makeSymbol({ id: "a", name: "OldService", deprecated: true });
    const result = renderSymbolPage(sym, [], [], undefined, []);
    expect(result).toContain("html");
  });

  it("renders relationships for symbol", () => {
    const symA = makeSymbol({ id: "a", name: "ServiceA" });
    const symB = makeSymbol({ id: "b", name: "RepoA" });
    const result = renderSymbolPage(
      symA,
      [symB],
      [{ source_id: "a", target_id: "b", type: "uses" }],
      undefined,
      [],
    );
    expect(result).toContain("html");
  });

  it("renders arch violations for symbol", () => {
    const sym = makeSymbol({ id: "a", name: "ServiceA" });
    const violation = {
      symbolId: "a",
      code: "dep-violation",
      message: "Bad dep",
      file: "src/a.ts",
    };
    const result = renderSymbolPage(sym, [], [], undefined, [violation as any]);
    expect(result).toContain("html");
  });

  it("renders symbol with docstring", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService", docstring: "Handles orders." });
    const result = renderSymbolPage(sym, [], [], undefined, []);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(100);
  });
});
