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
  estimateTokens?: (text: string) => number;
}

export interface BuildRelevantContextInput {
  symbolName?: string;
  filePath?: string;
  mode?: "compact" | "full";
  maxSourceLines?: number;
  maxDocChars?: number;
  maxContextChars?: number;
}

export interface BuildRelevantContextResult {
  text: string;
  found: boolean;
}

const DEFAULT_MAX_SOURCE_LINES = 80;
const DEFAULT_MAX_CONTEXT_CHARS = 20_000;
const CONTEXT_TOKEN_WARNING = 8_000;
const COMPACT_MAX_DOC_CHARS = 500;
const FULL_MAX_DOC_CHARS = 2_000;

function truncateText(text: string, maxChars: number, suffix: string): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n${suffix}`;
}

function dependencyLabel(symbol: CodeSymbol): string {
  return `${symbol.name} (${symbol.kind})`;
}

function trimSourceWindow(
  lines: string[],
  startLine: number,
  endLine: number,
  maxSourceLines: number,
) {
  const minLine = Math.max(0, startLine - 3);
  const desiredMaxLine = Math.min(lines.length, endLine + 3);
  const maxLine = Math.min(desiredMaxLine, minLine + maxSourceLines);
  const omitted = Math.max(0, desiredMaxLine - maxLine);

  return {
    start: minLine,
    end: maxLine,
    omitted,
    text: lines.slice(minLine, maxLine).join("\n"),
  };
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
  const {
    symbolName,
    filePath,
    mode = "full",
    maxSourceLines = DEFAULT_MAX_SOURCE_LINES,
    maxDocChars = mode === "compact" ? COMPACT_MAX_DOC_CHARS : FULL_MAX_DOC_CHARS,
    maxContextChars = DEFAULT_MAX_CONTEXT_CHARS,
  } = input;

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
      parts.push(
        mode === "compact"
          ? `- ${dependencyLabel(dep)}`
          : `- ${dep.name} (${dep.kind} in ${dep.file})`,
      );
    }
    parts.push("");
  }

  if (dependentSymbols.length > 0) {
    parts.push(`## Dependents (${dependentSymbols.length})\n`);
    for (const dep of dependentSymbols) {
      parts.push(
        mode === "compact"
          ? `- ${dependencyLabel(dep)}`
          : `- ${dep.name} (${dep.kind} in ${dep.file})`,
      );
    }
    parts.push("");
  }

  const docParts: string[] = [];
  for (const sym of targetSymbols) {
    const mappings = await registry.findDocBySymbol(sym.name);
    for (const m of mappings) {
      try {
        const content = await readFile(join(docsDir, m.docPath), "utf-8");
        docParts.push(
          `### ${m.docPath}\n${truncateText(content, maxDocChars, "_(documentation truncated)_")}`,
        );
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

  if (mode === "full") {
    const relevantFiles = new Set(targetSymbols.map((s) => s.file));
    parts.push(`## Source Code\n`);
    for (const file of relevantFiles) {
      try {
        const absPath = resolve(projectRoot, file);
        const source = await readFile(absPath, "utf-8");
        const lines = source.split("\n");
        const fileSymbols = targetSymbols.filter((s) => s.file === file);
        const startLine = Math.min(...fileSymbols.map((s) => s.startLine));
        const endLine = Math.max(...fileSymbols.map((s) => s.endLine));
        const window = trimSourceWindow(lines, startLine, endLine, maxSourceLines);
        parts.push(`### ${file}:${window.start + 1}-${window.end}`);
        parts.push("```");
        parts.push(window.text);
        if (window.omitted > 0) {
          parts.push(`... (${window.omitted} lines omitted)`);
        }
        parts.push("```\n");
      } catch {
        /* skip */
      }
    }
  }

  const text = parts.join("\n");
  const estimatedTokens = deps.estimateTokens?.(text) ?? Math.ceil(text.length / 4);
  if (estimatedTokens > CONTEXT_TOKEN_WARNING) {
    console.warn(
      `[doc-kit] Context for "${queryLabel}" is ~${estimatedTokens} tokens. Consider using mode:"compact".`,
    );
  }

  return {
    text: truncateText(text, maxContextChars, "_(context truncated)_"),
    found: true,
  };
}
