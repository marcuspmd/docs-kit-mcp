import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";
import { createLayeredDiagrams, renderDiagramTabs } from "./smartDiagrams.js";

export function fileSlug(filePath: string): string {
  return filePath.replace(/\//g, "--");
}

function safeNodeId(name: string, counter?: Map<string, number>): string {
  let base = name.replace(/[^a-zA-Z0-9_]/g, "_");

  // Remove leading numbers (Mermaid doesn't like IDs starting with numbers)
  base = base.replace(/^[0-9]+/, "_");

  // Ensure it's not empty
  if (!base || base.length === 0) {
    base = "node";
  }

  // If a counter is provided, ensure uniqueness
  if (counter) {
    const existing = counter.get(base) || 0;
    counter.set(base, existing + 1);
    if (existing > 0) {
      return `${base}_${existing}`;
    }
  }

  return base;
}

export function buildMermaidForSymbol(
  symbol: CodeSymbol,
  allSymbols: CodeSymbol[],
  relationships: RelationshipRow[],
  direction: "outgoing" | "incoming" | "both",
  clickable = false,
): string {
  const outgoing = relationships.filter((r) => r.source_id === symbol.id);
  const incoming = relationships.filter((r) => r.target_id === symbol.id);

  const relevantRels =
    direction === "outgoing"
      ? outgoing
      : direction === "incoming"
        ? incoming
        : [...outgoing, ...incoming];

  if (relevantRels.length === 0) return "";

  const symbolMap = new Map(allSymbols.map((s) => [s.id, s]));
  const lines: string[] = ["graph LR"];
  const nodeLines: string[] = [];
  const edgeLines: string[] = [];
  const styleLines: string[] = [];
  const clickLines: string[] = [];
  const added = new Map<string, string>(); // Map original name to safe ID
  const idCounter = new Map<string, number>(); // Track ID usage for uniqueness

  const selfName = safeNodeId(symbol.name, idCounter);
  added.set(symbol.name, selfName);
  nodeLines.push(`  ${selfName}["${symbol.name}"]`);
  styleLines.push(`  style ${selfName} fill:#dbeafe,stroke:#2563eb,stroke-width:2px`);
  if (clickable) {
    clickLines.push(`  click ${selfName} "${symbol.id}.html"`);
  }

  const arrowMap: Record<string, string> = {
    inherits: "-->|inherits|",
    implements: "-.->|implements|",
    uses: "-->|uses|",
    instantiates: "-.->|instantiates|",
    calls: "-->|calls|",
    contains: "-->|contains|",
    listens_to: "-.->|listens to|",
    dispatches: "-->|dispatches|",
  };

  for (const rel of relevantRels) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    let sName = added.get(source.name);
    if (!sName) {
      sName = safeNodeId(source.name, idCounter);
      added.set(source.name, sName);
      nodeLines.push(`  ${sName}["${source.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${sName} "${source.id}.html"`);
      }
    }

    let tName = added.get(target.name);
    if (!tName) {
      tName = safeNodeId(target.name, idCounter);
      added.set(target.name, tName);
      nodeLines.push(`  ${tName}["${target.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${tName} "${target.id}.html"`);
      }
    }

    const arrow = arrowMap[rel.type] ?? "-->|" + rel.type + "|";
    edgeLines.push(`  ${sName} ${arrow} ${tName}`);
  }

  return [...lines, ...nodeLines, ...edgeLines, ...styleLines, ...clickLines].join("\n");
}

/** Max edges in file/symbol Mermaid diagrams to avoid "Maximum text size in diagram exceeded". */
const MAX_MERMAID_EDGES = 400;

export function buildMermaidForFile(
  filePath: string,
  fileSymbols: CodeSymbol[],
  relationships: RelationshipRow[],
  clickable = false,
): string {
  const fileIds = new Set(fileSymbols.map((s) => s.id));
  const relevantRels = relationships.filter(
    (r) => fileIds.has(r.source_id) && fileIds.has(r.target_id),
  );

  if (relevantRels.length === 0) return "";

  const truncated = relevantRels.length > MAX_MERMAID_EDGES;
  const relsToRender = truncated ? relevantRels.slice(0, MAX_MERMAID_EDGES) : relevantRels;

  const symbolMap = new Map(fileSymbols.map((s) => [s.id, s]));
  const lines: string[] = ["graph LR"];
  const nodeLines: string[] = [];
  const edgeLines: string[] = [];
  const clickLines: string[] = [];
  const added = new Map<string, string>();
  const idCounter = new Map<string, number>();

  const arrowMap: Record<string, string> = {
    inherits: "-->|inherits|",
    implements: "-.->|implements|",
    uses: "-->|uses|",
    instantiates: "-.->|instantiates|",
    calls: "-->|calls|",
    contains: "-->|contains|",
    listens_to: "-.->|listens to|",
    dispatches: "-->|dispatches|",
  };

  for (const rel of relsToRender) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    let sName = added.get(source.name);
    if (!sName) {
      sName = safeNodeId(source.name, idCounter);
      added.set(source.name, sName);
      nodeLines.push(`  ${sName}["${source.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${sName} "../symbols/${source.id}.html"`);
      }
    }

    let tName = added.get(target.name);
    if (!tName) {
      tName = safeNodeId(target.name, idCounter);
      added.set(target.name, tName);
      nodeLines.push(`  ${tName}["${target.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${tName} "../symbols/${target.id}.html"`);
      }
    }

    const arrow = arrowMap[rel.type] ?? "-->|" + rel.type + "|";
    edgeLines.push(`  ${sName} ${arrow} ${tName}`);
  }

  if (added.size === 0) return "";

  if (truncated) {
    const label = `Truncated - first ${MAX_MERMAID_EDGES} of ${relevantRels.length} relationships`;
    lines.push(`  subgraph _truncated[${label}]`);
    lines.push("  end");
  }
  return [...lines, ...nodeLines, ...edgeLines, ...clickLines].join("\n");
}

export function buildMermaidOverview(
  symbols: CodeSymbol[],
  relationships: RelationshipRow[],
): string {
  // Group symbols by first directory segment
  const dirMap = new Map<string, Set<string>>();
  for (const s of symbols) {
    const dir = s.file.split("/")[0] || "root";
    if (!dirMap.has(dir)) dirMap.set(dir, new Set());
    dirMap.get(dir)!.add(s.id);
  }

  // Count cross-directory relationships
  const symbolToDir = new Map<string, string>();
  for (const s of symbols) {
    symbolToDir.set(s.id, s.file.split("/")[0] || "root");
  }

  const edgeCount = new Map<string, number>();
  for (const r of relationships) {
    const sd = symbolToDir.get(r.source_id);
    const td = symbolToDir.get(r.target_id);
    if (!sd || !td || sd === td) continue;
    const key = `${sd}:::${td}`;
    edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
  }

  if (edgeCount.size === 0 && dirMap.size <= 1) return "";

  const lines: string[] = ["graph LR"];
  const idCounter = new Map<string, number>();
  const nodeLines: string[] = [];
  const edgeLines: string[] = [];

  for (const [dir, ids] of dirMap) {
    const safe = safeNodeId(dir, idCounter);
    nodeLines.push(`  ${safe}["${dir} (${ids.size})"]`);
  }

  for (const [key, count] of edgeCount) {
    const [sd, td] = key.split(":::");
    const safeSd = safeNodeId(sd, idCounter);
    const safeTd = safeNodeId(td, idCounter);
    edgeLines.push(`  ${safeSd} -->|${count}| ${safeTd}`);
  }

  return [...lines, ...nodeLines, ...edgeLines].join("\n");
}

export function buildMermaidTopConnected(
  symbols: CodeSymbol[],
  relationships: RelationshipRow[],
  limit = 30,
  clickable = false,
): string {
  // Count connections per symbol
  const connCount = new Map<string, number>();
  for (const r of relationships) {
    connCount.set(r.source_id, (connCount.get(r.source_id) ?? 0) + 1);
    connCount.set(r.target_id, (connCount.get(r.target_id) ?? 0) + 1);
  }

  const topIds = [...connCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const topSet = new Set(topIds);
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  const relevantRels = relationships.filter(
    (r) => topSet.has(r.source_id) && topSet.has(r.target_id),
  );

  if (relevantRels.length === 0) return "";

  const lines: string[] = ["graph LR"];
  const nodeLines: string[] = [];
  const edgeLines: string[] = [];
  const clickLines: string[] = [];
  const added = new Map<string, string>();
  const idCounter = new Map<string, number>();

  for (const rel of relevantRels) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    let sName = added.get(source.name);
    if (!sName) {
      sName = safeNodeId(source.name, idCounter);
      added.set(source.name, sName);
      nodeLines.push(`  ${sName}["${source.name}"]`);
      if (clickable) clickLines.push(`  click ${sName} "symbols/${source.id}.html"`);
    }

    let tName = added.get(target.name);
    if (!tName) {
      tName = safeNodeId(target.name, idCounter);
      added.set(target.name, tName);
      nodeLines.push(`  ${tName}["${target.name}"]`);
      if (clickable) clickLines.push(`  click ${tName} "symbols/${target.id}.html"`);
    }

    edgeLines.push(`  ${sName} -->|${rel.type}| ${tName}`);
  }

  if (added.size === 0) return "";
  return [...lines, ...nodeLines, ...edgeLines, ...clickLines].join("\n");
}

/**
 * Build smart layered diagrams for a file
 * Returns either Mermaid markup (for small diagrams) or full HTML with tabs (for large diagrams)
 */
export function buildSmartDiagramsForFile(
  filePath: string,
  fileSymbols: CodeSymbol[],
  allSymbols: CodeSymbol[],
  relationships: RelationshipRow[],
  clickable = false,
): { html: string; isMermaid: boolean } {
  const fileIds = new Set(fileSymbols.map((s) => s.id));
  const relevantRels = relationships.filter(
    (r) => fileIds.has(r.source_id) && fileIds.has(r.target_id),
  );

  if (relevantRels.length === 0) return { html: "", isMermaid: true };

  // Use smart diagrams with tabs if there are many relationships
  if (relevantRels.length > 50) {
    const views = createLayeredDiagrams(fileSymbols, relevantRels, clickable, "../symbols/");
    return { html: renderDiagramTabs(views), isMermaid: false };
  }

  // For smaller diagrams, use the original single diagram
  const mermaid = buildMermaidForFile(filePath, fileSymbols, relationships, clickable);
  return { html: mermaid, isMermaid: true };
}
