import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolRelationship } from "./symbol.types.js";
import { detectLanguage } from "./indexer.js";
import { getStrategy } from "./languages/index.js";

export interface RelationshipExtractorOptions {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  sources: Map<string, string>;
}

function buildNameIndex(symbols: CodeSymbol[]): Map<string, CodeSymbol> {
  const index = new Map<string, CodeSymbol>();
  for (const s of symbols) {
    index.set(s.name, s);
  }
  return index;
}

export function extractRelationships(options: RelationshipExtractorOptions): SymbolRelationship[] {
  const { symbols, trees } = options;
  const nameIndex = buildNameIndex(symbols);
  const relationships: SymbolRelationship[] = [];
  const seen = new Set<string>();

  function addRel(
    sourceId: string,
    targetName: string,
    type: SymbolRelationship["type"],
    file: string,
    line: number,
  ) {
    const target = nameIndex.get(targetName);
    if (!target) return;
    const key = `${sourceId}:${target.id}:${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    relationships.push({
      sourceId,
      targetId: target.id,
      type,
      location: { file, line },
    });
  }

  const fileSymbols = new Map<string, CodeSymbol[]>();
  for (const s of symbols) {
    const list = fileSymbols.get(s.file) ?? [];
    list.push(s);
    fileSymbols.set(s.file, list);
  }

  for (const [file, tree] of trees) {
    const symsInFile = fileSymbols.get(file) ?? [];
    const language = detectLanguage(file);
    const strategy = getStrategy(language);
    walkForRelationships(tree.rootNode, file, symsInFile, addRel, strategy);
  }

  return relationships;
}

function walkForRelationships(
  node: Parser.SyntaxNode,
  file: string,
  symsInFile: CodeSymbol[],
  addRel: (
    sourceId: string,
    targetName: string,
    type: SymbolRelationship["type"],
    file: string,
    line: number,
  ) => void,
  strategy: ReturnType<typeof getStrategy>,
) {
  if (!node) return;

  if (node.type === "class_declaration" || node.type === "abstract_class_declaration") {
    const className = node.childForFieldName("name")?.text;
    const classSymbol = symsInFile.find(
      (s) =>
        s.name === className &&
        (s.kind === "class" ||
          s.kind === "abstract_class" ||
          // Also match refined kinds (event, service, etc.)
          s.name === className),
    );

    if (classSymbol) {
      strategy.extractClassRelationships(node, classSymbol, addRel, file);
    }
  }

  strategy.extractInstantiationRelationships(node, symsInFile, addRel, file);
  strategy.extractImportRelationships(node, symsInFile, addRel, file);
  strategy.extractCallRelationships(node, symsInFile, addRel, file);
  strategy.extractEventListenerRelationships?.(node, symsInFile, addRel, file);

  for (const child of node.children) {
    walkForRelationships(child, file, symsInFile, addRel, strategy);
  }
}
