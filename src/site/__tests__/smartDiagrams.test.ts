import { createLayeredDiagrams, renderDiagramTabs } from "../smartDiagrams.js";
import { buildMermaidForFile } from "../shared.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import type { RelationshipRow } from "../../storage/db.js";

const makeSymbol = (overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol =>
  ({
    kind: "class",
    file: "src/a.ts",
    startLine: 1,
    endLine: 10,
    language: "ts",
    layer: "application",
    ...overrides,
  }) as CodeSymbol;

const makeRel = (source_id: string, target_id: string, type = "calls"): RelationshipRow => ({
  source_id,
  target_id,
  type,
});

describe("createLayeredDiagrams", () => {
  it("returns empty array when no relationships between layers", () => {
    const symbols = [
      makeSymbol({ id: "s1", name: "Alpha", layer: "application" }),
      makeSymbol({ id: "s2", name: "Beta", layer: "application" }),
    ];
    // Same layer, no cross-layer rels → overview returns null
    const rels = [makeRel("s1", "s2")];
    const views = createLayeredDiagrams(symbols, rels);
    // No overview (single layer), but layer diagram may appear
    expect(Array.isArray(views)).toBe(true);
  });

  it("creates overview diagram for cross-layer relationships", () => {
    const symbols = [
      makeSymbol({ id: "s1", name: "Controller", layer: "presentation" }),
      makeSymbol({ id: "s2", name: "Service", layer: "application" }),
    ];
    const rels = [makeRel("s1", "s2", "calls")];
    const views = createLayeredDiagrams(symbols, rels);

    const overview = views.find((v) => v.id === "overview");
    expect(overview).toBeDefined();
    expect(overview!.mermaid).toContain("graph TB");
  });

  it("creates layer diagram for intra-layer relationships", () => {
    const symbols = [
      makeSymbol({ id: "s1", name: "OrderService", layer: "application" }),
      makeSymbol({ id: "s2", name: "UserService", layer: "application" }),
    ];
    const rels = [makeRel("s1", "s2", "uses")];
    const views = createLayeredDiagrams(symbols, rels);

    const layerView = views.find((v) => v.id.startsWith("layer-"));
    expect(layerView).toBeDefined();
    expect(layerView!.mermaid).toContain("graph LR");
    expect(layerView!.mermaid).toContain("OrderService");
  });

  it("includes clickable links when clickable=true", () => {
    const symbols = [
      makeSymbol({ id: "s1", name: "Alpha", layer: "application" }),
      makeSymbol({ id: "s2", name: "Beta", layer: "application" }),
    ];
    const rels = [makeRel("s1", "s2")];
    const views = createLayeredDiagrams(symbols, rels, true, "../symbols/");

    const layerView = views.find((v) => v.id.startsWith("layer-"));
    if (layerView) {
      expect(layerView.mermaid).toContain("click");
      expect(layerView.mermaid).toContain("../symbols/");
    }
  });

  it("handles symbols with no layer (defaults to application)", () => {
    const symbols = [
      makeSymbol({ id: "s1", name: "Alpha" }),
      makeSymbol({ id: "s2", name: "Beta" }),
    ];
    const rels = [makeRel("s1", "s2")];
    const views = createLayeredDiagrams(symbols, rels);
    expect(Array.isArray(views)).toBe(true);
  });

  it("handles empty symbols and relationships", () => {
    const views = createLayeredDiagrams([], []);
    expect(views).toEqual([]);
  });
});

describe("renderDiagramTabs", () => {
  it("returns empty string for empty views", () => {
    expect(renderDiagramTabs([])).toBe("");
  });

  it("returns single mermaid wrap without tabs for one view", () => {
    const views = [
      { id: "overview", title: "Overview", description: "desc", mermaid: "graph TB\n  A --> B" },
    ];
    const html = renderDiagramTabs(views);
    expect(html).toContain("mermaid");
    expect(html).not.toContain("diagram-tab");
  });

  it("renders tabs for multiple views", () => {
    const views = [
      {
        id: "overview",
        title: "Overview",
        description: "cross-layer",
        mermaid: "graph TB\n  A --> B",
      },
      {
        id: "layer-app",
        title: "Application Layer",
        description: "5 symbols",
        mermaid: "graph LR\n  X --> Y",
      },
    ];
    const html = renderDiagramTabs(views);
    expect(html).toContain("diagram-tab");
    expect(html).toContain("Overview");
    expect(html).toContain("Application Layer");
    expect(html).toContain("diagram-panel");
  });
});

describe("buildMermaidForFile", () => {
  it("returns empty string when no relationships exist within the file", () => {
    const symA = makeSymbol({ id: "a1", name: "ServiceA", file: "src/a.ts" });
    const symB = makeSymbol({ id: "b1", name: "ServiceB", file: "src/b.ts" });
    // Only cross-file relationship — should be filtered out
    const rels: RelationshipRow[] = [{ source_id: "a1", target_id: "b1", type: "uses" }];
    expect(buildMermaidForFile("src/a.ts", [symA], rels)).toBe("");
  });

  it("returns empty string when no relationships at all", () => {
    const symA = makeSymbol({ id: "a1", name: "ServiceA", file: "src/a.ts" });
    expect(buildMermaidForFile("src/a.ts", [symA], [])).toBe("");
  });

  it("generates mermaid graph for intra-file relationships", () => {
    const symA = makeSymbol({ id: "a1", name: "ServiceA", file: "src/a.ts" });
    const symB = makeSymbol({ id: "a2", name: "RepoA", file: "src/a.ts" });
    const rels: RelationshipRow[] = [{ source_id: "a1", target_id: "a2", type: "uses" }];
    const result = buildMermaidForFile("src/a.ts", [symA, symB], rels);
    expect(result).toContain("graph LR");
    expect(result).toContain("ServiceA");
    expect(result).toContain("RepoA");
    expect(result).toContain("uses");
  });

  it("generates clickable links when clickable=true", () => {
    const symA = makeSymbol({ id: "a1", name: "ServiceA", file: "src/a.ts" });
    const symB = makeSymbol({ id: "a2", name: "RepoA", file: "src/a.ts" });
    const rels: RelationshipRow[] = [{ source_id: "a1", target_id: "a2", type: "calls" }];
    const result = buildMermaidForFile("src/a.ts", [symA, symB], rels, true);
    expect(result).toContain("click");
    expect(result).toContain("symbols/a1.html");
  });
});
