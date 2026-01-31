import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind, Visibility } from "../symbol.types.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";

export class DefaultStrategy implements LanguageStrategy {
  extractNamespace(_root: Parser.SyntaxNode): string | undefined {
    return undefined;
  }

  buildQualifiedName(name: string, parentName?: string, _namespace?: string): string {
    return parentName ? `${parentName}.${name}` : name;
  }

  extractExtends(_node: Parser.SyntaxNode): string | undefined {
    return undefined;
  }

  extractImplements(_node: Parser.SyntaxNode): string[] | undefined {
    return undefined;
  }

  extractTraits(_node: Parser.SyntaxNode): string[] | undefined {
    return undefined;
  }

  extractVisibility(node: Parser.SyntaxNode): Visibility | undefined {
    const modifier = node.children.find(
      (c) => c.type === "accessibility_modifier" || c.type === "visibility_modifier",
    );
    if (modifier) {
      const text = modifier.text as Visibility;
      if (text === "public" || text === "private" || text === "protected") return text;
    }
    return undefined;
  }

  refineKind(kind: SymbolKind, _name: string, _extendsName?: string, _implementsNames?: string[]): SymbolKind {
    return kind;
  }

  detectDeprecated(node: Parser.SyntaxNode): boolean {
    const prev = node.previousNamedSibling;
    if (prev?.type === "comment" && prev.text.includes("@deprecated")) return true;
    return false;
  }

  extractClassRelationships(_node: Parser.SyntaxNode, _classSymbol: CodeSymbol, _addRel: AddRelFn, _file: string): void {
    // No-op for unsupported languages
  }

  extractInstantiationRelationships(_node: Parser.SyntaxNode, _symsInFile: CodeSymbol[], _addRel: AddRelFn, _file: string): void {
    // No-op for unsupported languages
  }

  extractImportRelationships(_node: Parser.SyntaxNode, _symsInFile: CodeSymbol[], _addRel: AddRelFn, _file: string): void {
    // No-op for unsupported languages
  }
}
