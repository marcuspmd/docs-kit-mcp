import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";

export function fileSlug(filePath: string): string {
  return filePath.replace(/\//g, "--");
}

export function buildMermaidForSymbol(
  symbol: CodeSymbol,
  allSymbols: CodeSymbol[],
  relationships: RelationshipRow[],
  direction: "outgoing" | "incoming" | "both",
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

  const selfName = symbol.name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!added.has(selfName)) {
    added.add(selfName);
    lines.push(`  ${selfName}["${symbol.name}"]`);
    lines.push(`  style ${selfName} fill:#dbeafe,stroke:#2563eb,stroke-width:2px`);
  }

  const arrowMap: Record<string, string> = {
    inherits: "-->|inherits|",
    implements: "-.->|implements|",
    uses: "-->|uses|",
    instantiates: "-.->|instantiates|",
    calls: "-->|calls|",
    contains: "-->|contains|",
  };

  for (const rel of relevantRels) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    const sName = source.name.replace(/[^a-zA-Z0-9_]/g, "_");
    const tName = target.name.replace(/[^a-zA-Z0-9_]/g, "_");

    if (!added.has(sName)) {
      added.add(sName);
      lines.push(`  ${sName}["${source.name}"]`);
    }
    if (!added.has(tName)) {
      added.add(tName);
      lines.push(`  ${tName}["${target.name}"]`);
    }

    const arrow = arrowMap[rel.type] ?? "-->|" + rel.type + "|";
    lines.push(`  ${sName} ${arrow} ${tName}`);
  }

  return lines.join("\n");
}
