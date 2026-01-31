import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { SymbolRepository } from "../storage/db.js";
import { createStubCodeSymbol } from "../indexer/symbol.types.js";
import { buildExplainSymbolPrompt } from "../prompts/explainSymbol.prompt.js";

export interface ExplainSymbolDeps {
  projectRoot: string;
  docsDir: string;
  registry: DocRegistry;
  symbolRepo: SymbolRepository;
  graph: KnowledgeGraph;
}

export interface ExplainSymbolResult {
  prompt: string;
  found: boolean;
}

/**
 * Build explain-symbol prompt from index, docs, and graph. Reusable by MCP server and CLI.
 */
export async function buildExplainSymbolContext(
  symbolName: string,
  deps: ExplainSymbolDeps,
): Promise<ExplainSymbolResult> {
  const { projectRoot, docsDir, registry, symbolRepo, graph } = deps;

  const symbols = symbolRepo.findByName(symbolName);
  const mappings = await registry.findDocBySymbol(symbolName);

  if (symbols.length === 0 && mappings.length === 0) {
    return { prompt: "", found: false };
  }

  let docContent: string | undefined;
  for (const mapping of mappings) {
    try {
      docContent = await readFile(join(docsDir, mapping.docPath), "utf-8");
      break;
    } catch {
      /* skip */
    }
  }

  let sourceCode: string | undefined;
  let dependencies: typeof symbols = [];
  let dependents: typeof symbols = [];
  const sym = symbols[0];

  if (sym) {
    try {
      const filePath = resolve(projectRoot, sym.file);
      const fullSource = await readFile(filePath, "utf-8");
      const lines = fullSource.split("\n").slice(sym.startLine - 1, sym.endLine);
      sourceCode = lines.join("\n");
    } catch {
      /* skip */
    }

    const depRels = graph.getDependencies(sym.id);
    dependencies = symbolRepo.findByIds(depRels.map((r) => r.targetId));
    const depByRels = graph.getDependents(sym.id);
    dependents = symbolRepo.findByIds(depByRels.map((r) => r.sourceId));
  }

  const symbol = sym ?? createStubCodeSymbol(symbolName);
  const prompt = buildExplainSymbolPrompt({
    symbol,
    sourceCode,
    docContent,
    dependencies,
    dependents,
  });

  return { prompt, found: true };
}
