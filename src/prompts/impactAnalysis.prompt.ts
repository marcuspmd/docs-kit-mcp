import type { CodeSymbol } from "../indexer/symbol.types.js";

export interface ImpactAnalysisInput {
  targetSymbol: CodeSymbol;
  impactedSymbols: CodeSymbol[];
  maxDepth: number;
}

export function buildImpactAnalysisPrompt(input: ImpactAnalysisInput): string {
  const { targetSymbol, impactedSymbols, maxDepth } = input;

  const parts: string[] = [
    `You are a senior engineer performing impact analysis. Assess risk and provide actionable guidance.`,
    ``,
    `## Target Symbol: ${targetSymbol.qualifiedName || targetSymbol.name}`,
    `- **Kind**: ${targetSymbol.kind}`,
    `- **File**: ${targetSymbol.file}:${targetSymbol.startLine}-${targetSymbol.endLine}`,
    `- **Layer**: ${targetSymbol.layer || "unknown"}`,
  ];

  if (targetSymbol.signature) parts.push(`- **Signature**: \`${targetSymbol.signature}\``);

  parts.push(``, `## Impact Radius (depth ${maxDepth}): ${impactedSymbols.length} symbols affected`);

  // Group by layer
  const byLayer = new Map<string, CodeSymbol[]>();
  for (const sym of impactedSymbols) {
    const layer = sym.layer || "unknown";
    const list = byLayer.get(layer) ?? [];
    list.push(sym);
    byLayer.set(layer, list);
  }

  for (const [layer, syms] of byLayer) {
    parts.push(``, `### ${layer} layer (${syms.length})`);
    for (const sym of syms) {
      parts.push(`- ${sym.name} (${sym.kind} in ${sym.file})`);
    }
  }

  // Group by file
  const byFile = new Map<string, CodeSymbol[]>();
  for (const sym of impactedSymbols) {
    const list = byFile.get(sym.file) ?? [];
    list.push(sym);
    byFile.set(sym.file, list);
  }

  parts.push(``, `## Files affected: ${byFile.size}`);
  for (const [file, syms] of byFile) {
    parts.push(`- ${file} (${syms.length} symbols)`);
  }

  parts.push(
    ``,
    `## Instructions`,
    `Provide:`,
    `1. **Risk Level** (Low/Medium/High/Critical) with justification`,
    `2. **Breaking Change Assessment**: Could this change break public API or downstream consumers?`,
    `3. **Test Coverage**: Which areas need testing after this change?`,
    `4. **Documentation Impact**: Which docs need updating?`,
    `5. **Migration Steps**: If breaking, what migration path should consumers follow?`,
    `6. **Recommended Review Checklist**: Specific things reviewers should verify`,
  );

  return parts.join("\n");
}
