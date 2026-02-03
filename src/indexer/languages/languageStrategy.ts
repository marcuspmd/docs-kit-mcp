import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind, SymbolRelationship, Visibility } from "../symbol.types.js";
import type { ResolutionContext } from "../relationshipExtractor.js";

export type AddRelFn = (
  sourceId: string,
  targetName: string,
  type: SymbolRelationship["type"],
  file: string,
  line: number,
  ctx?: ResolutionContext,
) => void;

export interface LanguageStrategy {
  extractNamespace(root: Parser.SyntaxNode): string | undefined;
  buildQualifiedName(name: string, parentName?: string, namespace?: string): string;
  extractExtends(node: Parser.SyntaxNode): string | undefined;
  extractImplements(node: Parser.SyntaxNode): string[] | undefined;
  extractTraits(node: Parser.SyntaxNode): string[] | undefined;
  extractVisibility(node: Parser.SyntaxNode): Visibility | undefined;
  refineKind(
    kind: SymbolKind,
    name: string,
    extendsName?: string,
    implementsNames?: string[],
  ): SymbolKind;
  detectDeprecated(node: Parser.SyntaxNode): boolean;
  extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void;
  extractInstantiationRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void;
  extractImportRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void;
  extractCallRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void;
  extractEventListenerRelationships?(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void;
  /** PHP-specific: extract use statements for namespace resolution */
  extractUseStatements?(root: Parser.SyntaxNode): Map<string, string>;

  /**
   * Extract import statements from a file.
   * Returns a map of local name → source module path.
   * Used for precise call relationship resolution.
   */
  extractImports?(root: Parser.SyntaxNode): Map<string, string>;
}
