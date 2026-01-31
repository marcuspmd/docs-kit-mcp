import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolRelationship } from "./symbol.types.js";

export interface RelationshipExtractorOptions {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  sources: Map<string, string>;
}

/**
 * Build a lookup of symbol name → symbol for resolving targets.
 */
function buildNameIndex(symbols: CodeSymbol[]): Map<string, CodeSymbol> {
  const index = new Map<string, CodeSymbol>();
  for (const s of symbols) {
    index.set(s.name, s);
  }
  return index;
}

/**
 * Extract relationships from AST trees and symbol list.
 */
export function extractRelationships(options: RelationshipExtractorOptions): SymbolRelationship[] {
  const { symbols, trees, sources } = options;
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

  // Build a map: file → symbols in that file (only top-level classes/interfaces/functions)
  const fileSymbols = new Map<string, CodeSymbol[]>();
  for (const s of symbols) {
    const list = fileSymbols.get(s.file) ?? [];
    list.push(s);
    fileSymbols.set(s.file, list);
  }

  for (const [file, tree] of trees) {
    const symsInFile = fileSymbols.get(file) ?? [];

    // Walk the AST to find relationship nodes
    walkForRelationships(tree.rootNode, file, symsInFile, addRel);
  }

  return relationships;
}

type AddRelFn = (
  sourceId: string,
  targetName: string,
  type: SymbolRelationship["type"],
  file: string,
  line: number,
) => void;

function findEnclosingSymbol(
  line: number,
  symsInFile: CodeSymbol[],
): CodeSymbol | undefined {
  // Find the most specific (smallest range) symbol containing this line
  let best: CodeSymbol | undefined;
  for (const s of symsInFile) {
    if (s.startLine <= line + 1 && s.endLine >= line + 1) {
      if (!best || (s.endLine - s.startLine) < (best.endLine - best.startLine)) {
        best = s;
      }
    }
  }
  return best;
}

function walkForRelationships(
  node: Parser.SyntaxNode,
  file: string,
  symsInFile: CodeSymbol[],
  addRel: AddRelFn,
) {
  // class_declaration / abstract_class_declaration → check heritage
  if (
    node.type === "class_declaration" ||
    node.type === "abstract_class_declaration"
  ) {
    const className = node.childForFieldName("name")?.text;
    const classSymbol = symsInFile.find(
      (s) => s.name === className && (s.kind === "class" || s.kind === "abstract_class"),
    );

    if (classSymbol) {
      // extends clause
      const heritage = node.children.filter((c) => c.type === "class_heritage");
      for (const h of heritage) {
        for (const child of h.children) {
          if (child.type === "extends_clause") {
            const typeNode = child.children.find(
              (c) => c.type === "identifier" || c.type === "type_identifier",
            );
            if (typeNode) {
              addRel(classSymbol.id, typeNode.text, "inherits", file, node.startPosition.row + 1);
            }
          }
          if (child.type === "implements_clause") {
            // implements can have multiple types
            for (const typeChild of child.children) {
              if (typeChild.type === "type_identifier" || typeChild.type === "identifier") {
                addRel(
                  classSymbol.id,
                  typeChild.text,
                  "implements",
                  file,
                  node.startPosition.row + 1,
                );
              }
            }
          }
        }
      }
    }
  }

  // new ClassName() → instantiates
  if (node.type === "new_expression") {
    const constructorNode = node.childForFieldName("constructor");
    if (constructorNode) {
      const targetName =
        constructorNode.type === "identifier" ? constructorNode.text : undefined;
      if (targetName) {
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (enclosing) {
          addRel(enclosing.id, targetName, "instantiates", file, node.startPosition.row + 1);
        }
      }
    }
  }

  // import statements → uses
  if (node.type === "import_statement") {
    const importClause = node.children.find((c) => c.type === "import_clause");
    if (importClause) {
      const namedImports = importClause.descendantsOfType("import_specifier");
      for (const spec of namedImports) {
        const nameNode = spec.childForFieldName("name");
        if (nameNode) {
          // We'll link from the file's top-level symbols to the imported name
          // Find a top-level symbol in this file to be the source
          const topLevel = symsInFile.find((s) => !s.parent);
          if (topLevel) {
            addRel(topLevel.id, nameNode.text, "uses", file, node.startPosition.row + 1);
          }
        }
      }
    }
  }

  // Recurse
  for (const child of node.children) {
    walkForRelationships(child, file, symsInFile, addRel);
  }
}
