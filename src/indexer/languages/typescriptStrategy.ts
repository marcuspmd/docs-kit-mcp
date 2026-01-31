import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind, Visibility } from "../symbol.types.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";

export class TypeScriptStrategy implements LanguageStrategy {
  extractNamespace(_root: Parser.SyntaxNode): string | undefined {
    return undefined;
  }

  buildQualifiedName(name: string, parentName?: string, _namespace?: string): string {
    return parentName ? `${parentName}.${name}` : name;
  }

  extractExtends(node: Parser.SyntaxNode): string | undefined {
    const heritage = node.children.find((c) => c.type === "class_heritage");
    if (!heritage) return undefined;
    const extendsClause = heritage.children.find((c) => c.type === "extends_clause");
    if (!extendsClause) return undefined;
    const typeNode = extendsClause.children.find(
      (c) => c.type === "identifier" || c.type === "type_identifier",
    );
    return typeNode?.text;
  }

  extractImplements(node: Parser.SyntaxNode): string[] | undefined {
    const heritage = node.children.find((c) => c.type === "class_heritage");
    if (!heritage) return undefined;
    const implClause = heritage.children.find((c) => c.type === "implements_clause");
    if (!implClause) return undefined;
    const types = implClause.children
      .filter((c) => c.type === "type_identifier" || c.type === "identifier")
      .map((c) => c.text);
    return types.length > 0 ? types : undefined;
  }

  extractTraits(_node: Parser.SyntaxNode): string[] | undefined {
    return undefined;
  }

  extractVisibility(node: Parser.SyntaxNode): Visibility | undefined {
    const modifier = node.children.find((c) => c.type === "accessibility_modifier");
    if (modifier) {
      const text = modifier.text as Visibility;
      if (text === "public" || text === "private" || text === "protected") return text;
    }
    return undefined;
  }

  refineKind(
    kind: SymbolKind,
    _name: string,
    _extendsName?: string,
    _implementsNames?: string[],
  ): SymbolKind {
    return kind;
  }

  detectDeprecated(node: Parser.SyntaxNode): boolean {
    const targetNode = node.parent?.type === "export_statement" ? node.parent : node;
    const prev = targetNode.previousNamedSibling;
    if (prev?.type === "comment" && prev.text.includes("@deprecated")) return true;
    for (const child of node.children) {
      if (child.type === "decorator" && child.text.includes("Deprecated")) return true;
    }
    return false;
  }

  extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
  ): void {
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

  extractInstantiationRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
  ): void {
    if (node.type !== "new_expression") return;
    const constructorNode = node.childForFieldName("constructor");
    if (constructorNode?.type === "identifier") {
      const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
      if (enclosing) {
        addRel(
          enclosing.id,
          constructorNode.text,
          "instantiates",
          file,
          node.startPosition.row + 1,
        );
      }
    }
  }

  extractImportRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
  ): void {
    if (node.type !== "import_statement") return;
    const importClause = node.children.find((c) => c.type === "import_clause");
    if (importClause) {
      const namedImports = importClause.descendantsOfType("import_specifier");
      const source = symsInFile.find((s) => !s.parent) ?? syntheticModuleSymbol(file);
      for (const spec of namedImports) {
        const nameNode = spec.childForFieldName("name");
        if (nameNode) {
          addRel(source.id, nameNode.text, "uses", file, node.startPosition.row + 1);
        }
      }
    }
  }

  extractCallRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
  ): void {
    // Extract function calls
    if (node.type === "call_expression") {
      const functionNode = node.childForFieldName("function");
      if (functionNode?.type === "identifier") {
        const enclosing =
          findEnclosingSymbol(node.startPosition.row, symsInFile) ??
          symsInFile.find((s) => !s.parent) ??
          syntheticModuleSymbol(file);
        addRel(enclosing.id, functionNode.text, "calls", file, node.startPosition.row + 1);
      }
    }
  }
}

function findEnclosingSymbol(line: number, symsInFile: CodeSymbol[]): CodeSymbol | undefined {
  let best: CodeSymbol | undefined;
  for (const s of symsInFile) {
    if (s.startLine <= line + 1 && s.endLine >= line + 1) {
      if (!best || s.endLine - s.startLine < best.endLine - best.startLine) {
        best = s;
      }
    }
  }
  return best;
}

/** Synthetic "module" id for files with no top-level symbols (e.g. server.ts with only callbacks). */
function syntheticModuleSymbol(file: string): { id: string } {
  return { id: `module::${file}` };
}
