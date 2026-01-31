import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DetectedPattern } from "../patterns/patternAnalyzer.js";
import type { RelationshipRow } from "../storage/db.js";
import { fileSlug, buildMermaidForSymbol } from "./shared.js";

export interface MdSiteData {
  symbols: CodeSymbol[];
  relationships: RelationshipRow[];
  patterns: DetectedPattern[];
  files: string[];
}

export function renderDashboardMd(data: MdSiteData): string {
  const { symbols, relationships, patterns, files } = data;

  const kindCounts: Record<string, number> = {};
  for (const s of symbols) {
    kindCounts[s.kind] = (kindCounts[s.kind] ?? 0) + 1;
  }

  const topLevel = symbols.filter((s) => !s.parent);

  const kindRows = Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `| ${kind} | ${count} |`)
    .join("\n");

  const fileList = files
    .sort()
    .map((f) => `- [${f}](files/${fileSlug(f)}.md)`)
    .join("\n");

  const symbolRows = topLevel
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (s) =>
        `| [${s.name}](symbols/${s.id}.md) | \`${s.kind}\` | [${s.file}](files/${fileSlug(s.file)}.md) |`,
    )
    .join("\n");

  return `# docs-kit Documentation

| Metric | Count |
|--------|-------|
| Files | ${files.length} |
| Symbols | ${symbols.length} |
| Relationships | ${relationships.length} |
| Patterns | ${patterns.length} |

## Symbol Kinds

| Kind | Count |
|------|-------|
${kindRows}

## Files

${fileList}

## Top-Level Symbols

| Name | Kind | File |
|------|------|------|
${symbolRows}
`;
}

export function renderSymbolMd(
  symbol: CodeSymbol,
  allSymbols: CodeSymbol[],
  relationships: RelationshipRow[],
  sourceCode?: string,
): string {
  const children = allSymbols.filter((s) => s.parent === symbol.id);
  const outgoing = relationships.filter((r) => r.source_id === symbol.id);
  const incoming = relationships.filter((r) => r.target_id === symbol.id);

  const sections: string[] = [];

  // Header
  sections.push(`# \`${symbol.kind}\` ${symbol.name}\n`);

  // Metadata
  const meta: string[] = [];
  meta.push(`- **File:** [${symbol.file}](../files/${fileSlug(symbol.file)}.md):${symbol.startLine}-${symbol.endLine}`);
  if (symbol.signature) meta.push(`- **Signature:** \`${symbol.signature}\``);
  if (symbol.pattern) meta.push(`- **Pattern:** ${symbol.pattern}`);
  if (symbol.metrics) {
    meta.push(`- **Metrics:** LOC: ${symbol.metrics.linesOfCode ?? "-"}, Complexity: ${symbol.metrics.cyclomaticComplexity ?? "-"}, Params: ${symbol.metrics.parameterCount ?? "-"}`);
  }
  sections.push(meta.join("\n") + "\n");

  // Source code
  if (sourceCode) {
    const lines = sourceCode.split("\n");
    const start = Math.max(0, symbol.startLine - 1);
    const end = Math.min(lines.length, symbol.endLine);
    const snippet = lines.slice(start, end);
    const numbered = snippet
      .map((line, i) => `${String(start + i + 1).padStart(4)} | ${line}`)
      .join("\n");
    sections.push(`## Source Code\n\n\`\`\`typescript\n${numbered}\n\`\`\`\n`);
  }

  // Dependency graph
  const depGraph = buildMermaidForSymbol(symbol, allSymbols, relationships, "outgoing");
  if (depGraph) {
    sections.push(`## Dependencies\n\n\`\`\`mermaid\n${depGraph}\n\`\`\`\n`);
  }

  // Outgoing relationships table
  if (outgoing.length > 0) {
    const symbolMap = new Map(allSymbols.map((s) => [s.id, s]));
    const rows = outgoing
      .map((r) => {
        const target = symbolMap.get(r.target_id);
        const name = target ? `[${target.name}](${target.id}.md)` : r.target_id;
        return `| ${name} | ${r.type} |`;
      })
      .join("\n");
    sections.push(`### Outgoing\n\n| Target | Type |\n|--------|------|\n${rows}\n`);
  }

  // Impact graph
  const impactGraph = buildMermaidForSymbol(symbol, allSymbols, relationships, "incoming");
  if (impactGraph) {
    sections.push(`## Impact (depended by)\n\n\`\`\`mermaid\n${impactGraph}\n\`\`\`\n`);
  }

  // Incoming relationships table
  if (incoming.length > 0) {
    const symbolMap = new Map(allSymbols.map((s) => [s.id, s]));
    const rows = incoming
      .map((r) => {
        const source = symbolMap.get(r.source_id);
        const name = source ? `[${source.name}](${source.id}.md)` : r.source_id;
        return `| ${name} | ${r.type} |`;
      })
      .join("\n");
    sections.push(`### Incoming\n\n| Source | Type |\n|--------|------|\n${rows}\n`);
  }

  // Members
  if (children.length > 0) {
    const rows = children
      .map(
        (c) =>
          `| [${c.name}](${c.id}.md) | \`${c.kind}\` | ${c.signature ? `\`${c.signature}\`` : "-"} |`,
      )
      .join("\n");
    sections.push(`## Members\n\n| Name | Kind | Signature |\n|------|------|-----------|\n${rows}\n`);
  }

  return sections.join("\n");
}

export function renderFileMd(
  filePath: string,
  symbols: CodeSymbol[],
  sourceCode?: string,
): string {
  const topLevel = symbols.filter((s) => !s.parent);
  const sections: string[] = [];

  sections.push(`# ${filePath}\n`);

  // Symbol table
  const rows: string[] = [];
  for (const s of topLevel.sort((a, b) => a.startLine - b.startLine)) {
    rows.push(
      `| [${s.name}](../symbols/${s.id}.md) | \`${s.kind}\` | ${s.startLine}-${s.endLine} | ${s.signature ? `\`${s.signature}\`` : "-"} |`,
    );
    const children = symbols.filter((c) => c.parent === s.id);
    for (const c of children) {
      rows.push(
        `| &nbsp;&nbsp;[${c.name}](../symbols/${c.id}.md) | \`${c.kind}\` | ${c.startLine}-${c.endLine} | ${c.signature ? `\`${c.signature}\`` : "-"} |`,
      );
    }
  }

  sections.push(`| Name | Kind | Lines | Signature |\n|------|------|-------|-----------|\n${rows.join("\n")}\n`);

  if (sourceCode) {
    sections.push(`## Source\n\n\`\`\`typescript\n${sourceCode}\n\`\`\`\n`);
  }

  return sections.join("\n");
}

export function renderRelationshipsMd(
  relationships: RelationshipRow[],
  symbols: CodeSymbol[],
): string {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  const byType: Record<string, number> = {};
  for (const r of relationships) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }

  const statsRows = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `| ${type} | ${count} |`)
    .join("\n");

  const tableRows = relationships
    .map((r) => {
      const source = symbolMap.get(r.source_id);
      const target = symbolMap.get(r.target_id);
      const sName = source ? `[${source.name}](symbols/${source.id}.md)` : r.source_id;
      const tName = target ? `[${target.name}](symbols/${target.id}.md)` : r.target_id;
      return `| ${sName} | ${r.type} | ${tName} |`;
    })
    .join("\n");

  return `# Relationships

## Stats

| Type | Count |
|------|-------|
${statsRows}

## All Relationships

| Source | Type | Target |
|--------|------|--------|
${tableRows}
`;
}

export function renderPatternsMd(
  patterns: DetectedPattern[],
  symbols: CodeSymbol[],
): string {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  if (patterns.length === 0) {
    return `# Detected Patterns\n\nNo patterns detected.\n`;
  }

  const cards = patterns
    .map((p) => {
      const symLinks = p.symbols
        .map((id) => {
          const s = symbolMap.get(id);
          return s ? `[${s.name}](symbols/${s.id}.md)` : id;
        })
        .join(", ");

      const violations =
        p.violations.length > 0
          ? `\n- **Violations:**\n${p.violations.map((v) => `  - ${v}`).join("\n")}`
          : "";

      return `### ${p.kind} (confidence: ${(p.confidence * 100).toFixed(0)}%)

- **Symbols:** ${symLinks}${violations}`;
    })
    .join("\n\n");

  return `# Detected Patterns\n\n${cards}\n`;
}
