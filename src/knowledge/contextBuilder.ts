import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { KnowledgeGraph } from "./graph.js";
import type { SymbolRepository } from "../storage/db.js";

export interface BuildRelevantContextDeps {
  projectRoot: string;
  docsDir: string;
  registry: DocRegistry;
  symbolRepo: SymbolRepository;
  graph: KnowledgeGraph;
}

export interface BuildRelevantContextInput {
  symbolName?: string;
  filePath?: string;
}

export interface BuildRelevantContextResult {
  text: string;
  found: boolean;
}

/**
 * Build comprehensive context (symbols, dependencies, docs, source) for a symbol or file.
 * Reusable by MCP server and CLI.
 */
export async function buildRelevantContext(
  input: BuildRelevantContextInput,
  deps: BuildRelevantContextDeps,
): Promise<BuildRelevantContextResult> {
  const { projectRoot, docsDir, registry, symbolRepo, graph } = deps;
  const { symbolName, filePath } = input;

  let targetSymbols: CodeSymbol[] = [];
  const queryLabel = symbolName ?? filePath ?? "";

  if (symbolName) {
    targetSymbols = symbolRepo.findByName(symbolName);
  } else if (filePath) {
    targetSymbols = symbolRepo.findByFile(filePath);
  }

  if (targetSymbols.length === 0) {
    return { text: `No symbols found for: ${queryLabel}`, found: false };
  }

  const parts: string[] = [];

  parts.push(`# Context for ${queryLabel}\n`);
  parts.push(`## Symbols (${targetSymbols.length})\n`);
  for (const sym of targetSymbols) {
    parts.push(`### ${sym.qualifiedName ?? sym.name}`);
    parts.push(`- Kind: ${sym.kind}`);
    parts.push(`- File: ${sym.file}:${sym.startLine}-${sym.endLine}`);
    if (sym.signature) parts.push(`- Signature: \`${sym.signature}\``);
    if (sym.layer) parts.push(`- Layer: ${sym.layer}`);
    if (sym.pattern) parts.push(`- Pattern: ${sym.pattern}`);
    if (sym.summary) parts.push(`- Summary: ${sym.summary}`);
    parts.push("");
  }

  const allDepIds = new Set<string>();
  const allDependentIds = new Set<string>();
  for (const sym of targetSymbols) {
    const depsRels = graph.getDependencies(sym.id);
    for (const d of depsRels) allDepIds.add(d.targetId);
    const depByRels = graph.getDependents(sym.id);
    for (const d of depByRels) allDependentIds.add(d.sourceId);
  }

  const depSymbols = symbolRepo.findByIds([...allDepIds]);
  const dependentSymbols = symbolRepo.findByIds([...allDependentIds]);

  if (depSymbols.length > 0) {
    parts.push(`## Dependencies (${depSymbols.length})\n`);
    for (const dep of depSymbols) {
      parts.push(`- ${dep.name} (${dep.kind} in ${dep.file})`);
    }
    parts.push("");
  }

  if (dependentSymbols.length > 0) {
    parts.push(`## Dependents (${dependentSymbols.length})\n`);
    for (const dep of dependentSymbols) {
      parts.push(`- ${dep.name} (${dep.kind} in ${dep.file})`);
    }
    parts.push("");
  }

  await registry.rebuild(docsDir);
  const docParts: string[] = [];
  for (const sym of targetSymbols) {
    const mappings = await registry.findDocBySymbol(sym.name);
    for (const m of mappings) {
      try {
        const content = await readFile(join(docsDir, m.docPath), "utf-8");
        docParts.push(`### ${m.docPath}\n${content.slice(0, 2000)}`);
      } catch {
        /* skip */
      }
    }
  }
  if (docParts.length > 0) {
    parts.push(`## Documentation\n`);
    parts.push(...docParts);
    parts.push("");
  }

  const relevantFiles = new Set(targetSymbols.map((s) => s.file));
  parts.push(`## Source Code\n`);
  for (const file of relevantFiles) {
    try {
      const absPath = resolve(projectRoot, file);
      const source = await readFile(absPath, "utf-8");
      const lines = source.split("\n");
      const fileSymbols = targetSymbols.filter((s) => s.file === file);
      const minLine = Math.max(0, Math.min(...fileSymbols.map((s) => s.startLine)) - 3);
      const maxLine = Math.min(lines.length, Math.max(...fileSymbols.map((s) => s.endLine)) + 3);
      parts.push(`### ${file}:${minLine + 1}-${maxLine}`);
      parts.push("```");
      parts.push(lines.slice(minLine, maxLine).join("\n"));
      parts.push("```\n");
    } catch {
      /* skip */
    }
  }

  return { text: parts.join("\n"), found: true };
}
