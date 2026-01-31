import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";

export function fileSlug(filePath: string): string {
  return filePath.replace(/\//g, "--");
}

function safeNodeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
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
  const added = new Set<string>();
  const clickLines: string[] = [];

  const selfName = safeNodeId(symbol.name);
  if (!added.has(selfName)) {
    added.add(selfName);
    lines.push(`  ${selfName}["${symbol.name}"]`);
    lines.push(`  style ${selfName} fill:#dbeafe,stroke:#2563eb,stroke-width:2px`);
    if (clickable) {
      clickLines.push(`  click ${selfName} "symbols/${symbol.id}.html"`);
    }
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

    const sName = safeNodeId(source.name);
    const tName = safeNodeId(target.name);

    if (!added.has(sName)) {
      added.add(sName);
      lines.push(`  ${sName}["${source.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${sName} "symbols/${source.id}.html"`);
      }
    }
    if (!added.has(tName)) {
      added.add(tName);
      lines.push(`  ${tName}["${target.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${tName} "symbols/${target.id}.html"`);
      }
    }

    const arrow = arrowMap[rel.type] ?? "-->|" + rel.type + "|";
    lines.push(`  ${sName} ${arrow} ${tName}`);
  }

  return [...lines, ...clickLines].join("\n");
}

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

  const symbolMap = new Map(fileSymbols.map((s) => [s.id, s]));
  const lines: string[] = ["graph LR"];
  const added = new Set<string>();
  const clickLines: string[] = [];

  for (const rel of relevantRels) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    const sName = safeNodeId(source.name);
    const tName = safeNodeId(target.name);

    if (!added.has(sName)) {
      added.add(sName);
      lines.push(`  ${sName}["${source.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${sName} "../symbols/${source.id}.html"`);
      }
    }
    if (!added.has(tName)) {
      added.add(tName);
      lines.push(`  ${tName}["${target.name}"]`);
      if (clickable) {
        clickLines.push(`  click ${tName} "../symbols/${target.id}.html"`);
      }
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
    const arrow = arrowMap[rel.type] ?? "-->|" + rel.type + "|";
    lines.push(`  ${sName} ${arrow} ${tName}`);
  }

  if (added.size === 0) return "";
  return [...lines, ...clickLines].join("\n");
}

export function buildMermaidOverview(
  symbols: CodeSymbol[],
  relationships: RelationshipRow[],
  clickable = false,
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
  for (const [dir, ids] of dirMap) {
    const safe = safeNodeId(dir);
    lines.push(`  ${safe}["${dir} (${ids.size})"]`);
  }
  for (const [key, count] of edgeCount) {
    const [sd, td] = key.split(":::");
    lines.push(`  ${safeNodeId(sd)} -->|${count}| ${safeNodeId(td)}`);
  }

  return lines.join("\n");
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
  const added = new Set<string>();
  const clickLines: string[] = [];

  for (const rel of relevantRels) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    const sName = safeNodeId(source.name);
    const tName = safeNodeId(target.name);

    if (!added.has(sName)) {
      added.add(sName);
      lines.push(`  ${sName}["${source.name}"]`);
      if (clickable) clickLines.push(`  click ${sName} "symbols/${source.id}.html"`);
    }
    if (!added.has(tName)) {
      added.add(tName);
      lines.push(`  ${tName}["${target.name}"]`);
      if (clickable) clickLines.push(`  click ${tName} "symbols/${target.id}.html"`);
    }

    lines.push(`  ${sName} -->|${rel.type}| ${tName}`);
  }

  if (added.size === 0) return "";
  return [...lines, ...clickLines].join("\n");
}
