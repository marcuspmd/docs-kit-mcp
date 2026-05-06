import type { CodeSymbol, SymbolRelationship } from "../../../indexer/symbol.types.js";
import type { PatternRowForInsert } from "../../../storage/db.js";
import { header, summary } from "../../utils/index.js";

export function reportSummary(
  tsFiles: string[],
  allSymbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  patterns: PatternRowForInsert[],
  registeredDocsCount: number,
  docMappingsCount: number,
  dbPath: string,
) {
  const kindCounts: Record<string, number> = {};
  for (const symbol of allSymbols) {
    kindCounts[symbol.kind] = (kindCounts[symbol.kind] ?? 0) + 1;
  }

  header("Index Summary");
  summary([
    ["Files", tsFiles.length],
    ["Symbols", allSymbols.length],
    ...Object.entries(kindCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => [`  ${kind}`, count] as [string, number]),
    ["Relationships", relationships.length],
    ["Patterns", patterns.length],
    ["Registered docs", registeredDocsCount],
    ["Symbol mappings", docMappingsCount],
    ["Database", dbPath],
  ]);
  console.log();
}
