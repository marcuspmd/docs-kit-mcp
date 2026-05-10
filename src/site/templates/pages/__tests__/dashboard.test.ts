import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { SiteData } from "../../types.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────
jest.unstable_mockModule("../../../shared.js", () => ({
  fileSlug: jest.fn((p: string) => p.replace(/\//g, "--").replace(/\.[^.]+$/, "")),
  buildMermaidOverview: jest.fn().mockReturnValue("graph TD\n  A --> B"),
  buildMermaidTopConnected: jest.fn().mockReturnValue(""),
  buildSmartDiagramsForFile: jest.fn().mockReturnValue([]),
  buildMermaidForFile: jest.fn().mockReturnValue(""),
}));

jest.unstable_mockModule("../../utils.js", () => ({
  escapeHtml: jest.fn((s: string) => s ?? ""),
  escapeCodeBlocks: jest.fn((s: string) => s),
  docEntryLabel: jest.fn(() => "label"),
}));

jest.unstable_mockModule("../../badges.js", () => ({
  badgeClass: jest.fn(() => "badge-class"),
  visibilityBadge: jest.fn(() => ""),
  layerBadge: jest.fn(() => ""),
  statusBadges: jest.fn(() => ""),
  violationsBadges: jest.fn(() => ""),
  coverageBadge: jest.fn(() => ""),
}));

jest.unstable_mockModule("../../layout.js", () => ({
  layout: jest.fn((_title: string, _page: string, body: string) => `<html>${body}</html>`),
}));

jest.unstable_mockModule("../../mermaid.js", () => ({
  mermaidDiagramWrap: jest.fn((s: string) => `<mermaid>${s}</mermaid>`),
  getMermaidExpandModalAndScript: jest.fn(() => ""),
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

const emptySiteData = (): SiteData => ({
  symbols: [],
  relationships: [],
  patterns: [],
  files: [],
  archViolations: [],
  reaperFindings: [],
  generatedAt: "2024-01-01T00:00:00.000Z",
  docEntries: [],
});

// ─── Dashboard page ───────────────────────────────────────────────────────────
describe("renderDashboard", () => {
  let renderDashboard: typeof import("../dashboard.js").renderDashboard;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ renderDashboard } = await import("../dashboard.js"));
  });

  it("renders with empty site data", () => {
    const result = renderDashboard(emptySiteData());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("renders with symbols", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService", kind: "class" });
    const data = { ...emptySiteData(), symbols: [sym], files: ["src/a.ts"] };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });

  it("renders kind counts for multiple symbol kinds", () => {
    const syms = [
      makeSymbol({ id: "a", name: "OrderService", kind: "class" }),
      makeSymbol({ id: "b", name: "createOrder", kind: "function" }),
      makeSymbol({ id: "c", name: "getOrder", kind: "function" }),
    ];
    const data = { ...emptySiteData(), symbols: syms };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });

  it("renders with arch violations", () => {
    const data = {
      ...emptySiteData(),
      archViolations: [
        { code: "dep-violation", message: "Dep violation", file: "src/a.ts" } as any,
      ],
    };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });

  it("renders with reaper findings", () => {
    const data = {
      ...emptySiteData(),
      reaperFindings: [
        { symbolId: "a", symbolName: "OldFn", file: "src/a.ts", reason: "unused" } as any,
      ],
    };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });

  it("renders with patterns", () => {
    const sym = makeSymbol({ id: "a", name: "OrderService" });
    const data = {
      ...emptySiteData(),
      symbols: [sym],
      patterns: [{ kind: "Singleton", confidence: 0.9, symbols: ["a"], violations: [] } as any],
    };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });

  it("renders with relationships", () => {
    const symA = makeSymbol({ id: "a", name: "ServiceA" });
    const symB = makeSymbol({ id: "b", name: "RepoA", kind: "class" });
    const data = {
      ...emptySiteData(),
      symbols: [symA, symB],
      relationships: [{ source_id: "a", target_id: "b", type: "uses" }],
    };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });

  it("renders layer distribution", () => {
    const syms = [
      makeSymbol({ id: "a", name: "OrderService", layer: "domain" }),
      makeSymbol({ id: "b", name: "OrderController", layer: "application" }),
      makeSymbol({ id: "c", name: "OrderRepo", layer: "infrastructure" }),
    ];
    const data = { ...emptySiteData(), symbols: syms };
    const result = renderDashboard(data);
    expect(result).toContain("html");
  });
});
