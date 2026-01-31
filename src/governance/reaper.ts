import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { DocMapping } from "../docs/docRegistry.js";
import type { SymbolRepository } from "../storage/db.js";

export interface ReaperFinding {
  type: "dead_code" | "orphan_doc" | "broken_link";
  target: string;
  reason: string;
  suggestedAction: "remove" | "update" | "review";
}

export interface Reaper {
  scan(symbols: CodeSymbol[], graph: KnowledgeGraph, docMappings: DocMapping[]): ReaperFinding[];
  markDeadCode(symbolRepo: SymbolRepository, findings: ReaperFinding[]): void;
}

const ENTRY_KINDS = new Set(["test", "mock", "migration", "middleware", "controller", "listener"]);

export function createReaper(): Reaper {
  return {
    scan(symbols, graph, docMappings) {
      const findings: ReaperFinding[] = [];

      findings.push(...findDeadCode(symbols, graph));
      findings.push(...findOrphanDocs(symbols, docMappings));

      return findings;
    },

    markDeadCode(symbolRepo, findings) {
      for (const finding of findings) {
        if (finding.type === "dead_code") {
          const symbol = symbolRepo.findById(finding.target);
          if (symbol) {
            // Add "dead_code" to violations
            const violations = symbol.violations || [];
            if (!violations.includes("dead_code")) {
              violations.push("dead_code");
              symbol.violations = violations;
              symbolRepo.upsert(symbol);
            }
          }
        }
      }
    },
  };
}

function findDeadCode(symbols: CodeSymbol[], graph: KnowledgeGraph): ReaperFinding[] {
  const findings: ReaperFinding[] = [];
  const childIds = new Set(symbols.filter((s) => s.parent).map((s) => s.parent!));

  // Only consider executable symbols for dead code analysis
  // Types, interfaces, enums are often used implicitly
  const executableKinds = new Set([
    "function",
    "method",
    "class",
    "abstract_class",
    "constructor",
    "getter",
    "setter",
    "event",
    "service",
    "controller",
    "listener",
  ]);

  for (const sym of symbols) {
    if (sym.parent) continue;
    if (sym.exported === false) continue;
    if (ENTRY_KINDS.has(sym.kind)) continue;
    if (!executableKinds.has(sym.kind)) continue; // Skip non-executable symbols
    // Skip test fixtures and test helpers (they are referenced by tests, not by app code)
    if (sym.file.includes("tests/") || sym.file.includes("/fixtures/")) continue;
    // Skip site shared helpers (used by templates.ts; call relationships may not resolve across files)
    if (sym.file.includes("site/shared")) continue;

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
