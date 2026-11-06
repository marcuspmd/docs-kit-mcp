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
  if (targetSymbol.security?.isSensitive) {
    parts.push(
      `- **🔐 Security-sensitive** (${targetSymbol.security.categories.join(", ")})`,
    );
  }
  if (targetSymbol.changeVelocity?.isHotspot) {
    const v = targetSymbol.changeVelocity;
    parts.push(`- **⚠️ Hotspot**: ${v.changeCount30d} changes in 30 days`);
  }

  parts.push(
    ``,
    `## Impact Radius (depth ${maxDepth}): ${impactedSymbols.length} symbols affected`,
  );

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
      const tags: string[] = [];
      if (sym.security?.isSensitive) tags.push("🔐 security");
      if (sym.changeVelocity?.isHotspot) tags.push(`⚠️ hotspot (${sym.changeVelocity.changeCount30d}d/30d)`);
      const annotation = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
      parts.push(`- ${sym.name} (${sym.kind} in ${sym.file})${annotation}`);
    }
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
