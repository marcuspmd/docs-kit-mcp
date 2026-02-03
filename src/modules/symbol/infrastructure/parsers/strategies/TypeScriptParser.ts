import Parser from "tree-sitter";
import type { ILanguageParser, ParseResult } from "./ILanguageParser.js";
import { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import type { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";
import type { SymbolKindType } from "../../../domain/value-objects/SymbolKind.js";

/**
 * TypeScript/JavaScript Parser
 *
 * Uses Tree-sitter to parse TypeScript/JavaScript files and extract symbols.
 */
export class TypeScriptParser implements ILanguageParser {
  readonly supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];

  constructor(private readonly parser: Parser) {}

  async parse(filePath: string, content: string): Promise<ParseResult> {
    try {
      const tree = this.parser.parse(content);
      const symbols: CodeSymbol[] = [];
      const relationships: SymbolRelationship[] = [];

      // Extract symbols from AST
      this.extractSymbols(tree.rootNode, content, filePath, symbols, relationships);

      return {
        symbols,
        relationships,
        metadata: {
          language: "ts",
          loc: content.split("\n").length,
          size: content.length,
        },
      };
    } catch (error) {
      console.error(`Failed to parse ${filePath}:`, error);
      return {
        symbols: [],
        relationships: [],
        metadata: {
          language: "ts",
          loc: content.split("\n").length,
          size: content.length,
        },
      };
    }
  }

  private extractSymbols(
    node: Parser.SyntaxNode,
    content: string,
    filePath: string,
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[],
  ): void {
    // Process current node
    const symbol = this.extractSymbol(node, content, filePath);
    if (symbol) {
      symbols.push(symbol);
    }

    // Recursively process children
    for (const child of node.children) {
      this.extractSymbols(child, content, filePath, symbols, relationships);
    }
  }

  private extractSymbol(
    node: Parser.SyntaxNode,
    content: string,
    filePath: string,
  ): CodeSymbol | null {
    const symbolTypes: Record<string, SymbolKindType> = {
      class_declaration: "class",
      interface_declaration: "interface",
      function_declaration: "function",
      method_definition: "method",
      type_alias_declaration: "type",
      enum_declaration: "enum",
    };

    const kind = symbolTypes[node.type];
    if (!kind) return null;

    // Extract name
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const name = content.slice(nameNode.startIndex, nameNode.endIndex);

    // Use CodeSymbol.create factory
    const result = CodeSymbol.create({
      name,
      qualifiedName: `${filePath}:${name}`,
      kind,
      location: {
        filePath,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      },
      exported: this.isExported(node),
      language: "ts",
    });

    if (result.isSuccess) {
      return result.value;
    }

    return null;
  }

  private isExported(node: Parser.SyntaxNode): boolean {
    // Check if node or parent has export modifier
    let current: Parser.SyntaxNode | null = node;
    while (current) {
      if (current.type === "export_statement") return true;
      for (const child of current.children) {
        if (child.type === "export") return true;
      }
      current = current.parent;
    }
    return false;
  }

  async validate(content: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const tree = this.parser.parse(content);
      return { isValid: !tree.rootNode.hasError, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}
