import type { CodeSymbol, SymbolRelationship } from "../indexer/symbol.types.js";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";

export interface ProjectStatusOptions {
  docsDir?: string;
}

export interface ProjectStatusResult {
  totalSymbols: number;
  documentedSymbols: number;
  docCoverage: number;
  symbolKinds: Record<string, number>;
  patternSummary: Record<string, number>;
  violationSummary: Record<string, number>;
  findingSummary: Record<string, number>;
  totalRelationships: number;
  avgReferencesPerSymbol: number;
  generatedAt: string;
}

export interface ProjectStatusDeps {
  symbolRepo: {
    findAll(): CodeSymbol[];
  };
  relRepo: {
    findAll(): Array<{ source_id: string; target_id: string; type: string }>;
  };
  registry: DocRegistry;
  patternAnalyzer: {
    analyze(
      symbols: CodeSymbol[],
      relationships: SymbolRelationship[],
    ): Array<{
      kind: string;
      symbols: string[];
      confidence: number;
      violations: string[];
    }>;
  };
  archGuard: {
    analyze(
      symbols: CodeSymbol[],
      relationships: SymbolRelationship[],
    ): Array<{
      severity: string;
      rule: string;
      message: string;
      file: string;
    }>;
  };
  reaper: {
    scan(
      symbols: CodeSymbol[],
      graph: KnowledgeGraph,
      mappings: Array<{ symbolName: string; docPath: string }>,
    ): Array<{
      type: string;
      target: string;
      reason: string;
      suggestedAction: string;
    }>;
  };
  graph: KnowledgeGraph;
}

export async function generateProjectStatus(
  options: ProjectStatusOptions,
  deps: ProjectStatusDeps,
): Promise<ProjectStatusResult> {
  const docsDir = options.docsDir || "docs";
  await deps.registry.rebuild(docsDir);

  // Gather all data
  const allSymbols = deps.symbolRepo.findAll();
  const allRels = deps.relRepo.findAll().map((r) => ({
    sourceId: r.source_id,
    targetId: r.target_id,
    type: r.type,
  }));
  const mappings = await deps.registry.findAllMappings();
  const patterns = deps.patternAnalyzer.analyze(allSymbols, allRels);
  const violations = deps.archGuard.analyze(allSymbols, allRels);
  const findings = deps.reaper.scan(allSymbols, deps.graph, mappings);

  // Calculate metrics
  const totalSymbols = allSymbols.length;
  const documentedSymbols = mappings.length;
  const docCoverage = totalSymbols > 0 ? (documentedSymbols / totalSymbols) * 100 : 0;

  const symbolKinds = allSymbols.reduce(
    (acc, s) => {
      acc[s.kind] = (acc[s.kind] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const patternSummary = patterns.reduce(
    (acc, p) => {
      acc[p.kind] = (acc[p.kind] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const violationSummary = violations.reduce(
    (acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const findingSummary = findings.reduce(
    (acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    totalSymbols,
    documentedSymbols,
    docCoverage,
    symbolKinds,
    patternSummary,
    violationSummary,
    findingSummary,
    totalRelationships: allRels.length,
    avgReferencesPerSymbol: totalSymbols > 0 ? allRels.length / totalSymbols : 0,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

export function formatProjectStatus(result: ProjectStatusResult): string {
  const report = `# 📊 Project Status Report

## 📈 Documentation Coverage
- **Total Symbols**: ${result.totalSymbols}
- **Documented Symbols**: ${result.documentedSymbols}
- **Coverage**: ${result.docCoverage.toFixed(1)}%

## 🔧 Symbol Types
${Object.entries(result.symbolKinds)
  .sort(([, a], [, b]) => b - a)
  .map(([kind, count]) => `- **${kind}**: ${count}`)
  .join("\n")}

## 🎯 Detected Patterns
${
  Object.entries(result.patternSummary)
    .map(([pattern, count]) => `- **${pattern}**: ${count} instances`)
    .join("\n") || "No patterns detected"
}

## ⚠️ Architecture Violations
${
  Object.entries(result.violationSummary)
    .map(([severity, count]) => `- **${severity}**: ${count} issues`)
    .join("\n") || "No violations found"
}

## 🧹 Code Quality Issues
${
  Object.entries(result.findingSummary)
    .map(([type, count]) => `- **${type}**: ${count} items`)
    .join("\n") || "No issues found"
}

## 📊 Relationships
- **Total Relationships**: ${result.totalRelationships}
- **Average References per Symbol**: ${result.avgReferencesPerSymbol.toFixed(1)}

---
*Report generated on ${result.generatedAt}*`;

  return report;
}
