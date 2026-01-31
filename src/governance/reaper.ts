import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { DocMapping } from "../docs/docRegistry.js";

export interface ReaperFinding {
  type: "dead_code" | "orphan_doc" | "broken_link";
  target: string;
  reason: string;
  suggestedAction: "remove" | "update" | "review";
}

export interface Reaper {
  scan(
    symbols: CodeSymbol[],
    graph: KnowledgeGraph,
    docMappings: DocMapping[],
  ): ReaperFinding[];
}

const ENTRY_KINDS = new Set([
  "test", "mock", "migration", "middleware", "controller", "listener",
]);

export function createReaper(): Reaper {
  return {
    scan(symbols, graph, docMappings) {
      const findings: ReaperFinding[] = [];

      findings.push(...findDeadCode(symbols, graph));
      findings.push(...findOrphanDocs(symbols, docMappings));

      return findings;
    },
  };
}

function findDeadCode(symbols: CodeSymbol[], graph: KnowledgeGraph): ReaperFinding[] {
  const findings: ReaperFinding[] = [];
  const childIds = new Set(
    symbols.filter((s) => s.parent).map((s) => s.parent!),
  );

  for (const sym of symbols) {
    if (sym.parent) continue;
    if (sym.exported === false) continue;
    if (ENTRY_KINDS.has(sym.kind)) continue;

    const dependents = graph.getDependents(sym.id);
    if (dependents.length > 0) continue;
    if (childIds.has(sym.id)) continue;

    findings.push({
      type: "dead_code",
      target: sym.id,
      reason: `Symbol '${sym.name}' in ${sym.file} has no incoming references`,
      suggestedAction: "review",
    });
  }

  return findings;
}

function findOrphanDocs(symbols: CodeSymbol[], docMappings: DocMapping[]): ReaperFinding[] {
  const findings: ReaperFinding[] = [];
  const symbolNames = new Set(symbols.map((s) => s.name));
  const symbolIds = new Set(symbols.map((s) => s.id));

  for (const mapping of docMappings) {
    if (symbolNames.has(mapping.symbolName) || symbolIds.has(mapping.symbolName)) {
      continue;
    }

    findings.push({
      type: "orphan_doc",
      target: mapping.docPath,
      reason: `Symbol '${mapping.symbolName}' no longer exists`,
      suggestedAction: "update",
    });
  }

  return findings;
}
