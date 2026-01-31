import type { CodeSymbol, SymbolRelationship } from "../indexer/symbol.types.js";

export type DiagramType = "classDiagram" | "sequenceDiagram" | "flowchart";

export interface MermaidOptions {
  symbols: string[];
  type: DiagramType;
  includeRelationships?: boolean;
  maxDepth?: number;
}

export function generateMermaid(
  options: MermaidOptions,
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
): string {
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const byName = new Map(symbols.map((s) => [s.name, s]));

  const rootSymbols = options.symbols
    .map((n) => byName.get(n) ?? symbols.find((s) => s.id === n))
    .filter((s): s is CodeSymbol => s != null);

  const included = collectSymbols(rootSymbols, symbols, relationships, byId, options.maxDepth ?? 1);
  const includeRels = options.includeRelationships !== false;

  switch (options.type) {
    case "classDiagram":
      return generateClassDiagram(included, symbols, relationships, byId, includeRels);
    case "sequenceDiagram":
      return generateSequenceDiagram(included, relationships, byId);
    case "flowchart":
      return generateFlowchart(included, relationships, byId, includeRels);
  }
}

function collectSymbols(
  roots: CodeSymbol[],
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
  maxDepth: number,
): CodeSymbol[] {
  const seen = new Set<string>();
  let frontier = roots.map((s) => s.id);

  for (let depth = 0; depth <= maxDepth; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (depth < maxDepth) {
        for (const r of relationships) {
          if (r.sourceId === id && !seen.has(r.targetId)) next.push(r.targetId);
          if (r.targetId === id && !seen.has(r.sourceId)) next.push(r.sourceId);
        }
      }
    }
    frontier = next;
  }

  return allSymbols.filter((s) => seen.has(s.id));
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function visibilityPrefix(sym: CodeSymbol): string {
  switch (sym.visibility) {
    case "private":
      return "-";
    case "protected":
      return "#";
    default:
      return "+";
  }
}

function generateClassDiagram(
  included: CodeSymbol[],
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
  includeRels: boolean,
): string {
  const lines: string[] = ["classDiagram"];
  const classSymbols = included.filter(
    (s) =>
      s.kind === "class" ||
      s.kind === "abstract_class" ||
      s.kind === "interface" ||
      s.kind === "enum",
  );
  const classIds = new Set(classSymbols.map((s) => s.id));

  for (const cls of classSymbols) {
    if (cls.kind === "abstract_class") {
      lines.push(`  class ${sanitize(cls.name)} {`);
      lines.push(`    <<abstract>>`);
    } else if (cls.kind === "interface") {
      lines.push(`  class ${sanitize(cls.name)} {`);
      lines.push(`    <<interface>>`);
    } else {
      lines.push(`  class ${sanitize(cls.name)} {`);
    }

    const members = allSymbols.filter((s) => s.parent === cls.id);
    for (const m of members) {
      if (m.kind === "method" || m.kind === "constructor") {
        lines.push(`    ${visibilityPrefix(m)}${m.name}()`);
      }
    }
    lines.push("  }");
  }

  if (includeRels) {
    const relMap = new Map<string, string>();
    for (const r of relationships) {
      if (!classIds.has(r.sourceId) || !classIds.has(r.targetId)) continue;
      const src = byId.get(r.sourceId);
      const tgt = byId.get(r.targetId);
      if (!src || !tgt) continue;
      const key = `${src.id}:${tgt.id}`;
      if (relMap.has(key)) continue;
      relMap.set(key, `  ${sanitize(src.name)} --> ${sanitize(tgt.name)} : ${r.type}`);
    }
    for (const line of relMap.values()) {
      lines.push(line);
    }
  }

  return lines.join("\n") + "\n";
}

function generateSequenceDiagram(
  included: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
): string {
  const lines: string[] = ["sequenceDiagram"];
  const includedIds = new Set(included.map((s) => s.id));

  const participants = new Set<string>();
  const interactions: string[] = [];

  for (const r of relationships) {
    if (!includedIds.has(r.sourceId) || !includedIds.has(r.targetId)) continue;
    const src = byId.get(r.sourceId);
    const tgt = byId.get(r.targetId);
    if (!src || !tgt) continue;

    const srcName = sanitize(src.name);
    const tgtName = sanitize(tgt.name);

    if (!participants.has(srcName)) {
      participants.add(srcName);
      lines.push(`  participant ${srcName}`);
    }
    if (!participants.has(tgtName)) {
      participants.add(tgtName);
      lines.push(`  participant ${tgtName}`);
    }

    interactions.push(`  ${srcName}->>+${tgtName}: ${r.type}`);
  }

  lines.push(...interactions);
  return lines.join("\n") + "\n";
}

function generateFlowchart(
  included: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
  includeRels: boolean,
): string {
  const lines: string[] = ["flowchart TD"];
  const includedIds = new Set(included.map((s) => s.id));

  for (const s of included) {
    if (s.kind === "method" || s.kind === "constructor") continue;
    const safe = sanitize(s.name);
    lines.push(`  ${safe}["${s.name}"]`);
  }

  if (includeRels) {
    for (const r of relationships) {
      if (!includedIds.has(r.sourceId) || !includedIds.has(r.targetId)) continue;
      const src = byId.get(r.sourceId);
      const tgt = byId.get(r.targetId);
      if (!src || !tgt) continue;
      if (src.kind === "method" || tgt.kind === "method") continue;
      lines.push(`  ${sanitize(src.name)} -->|${r.type}| ${sanitize(tgt.name)}`);
    }
  }

  return lines.join("\n") + "\n";
}
