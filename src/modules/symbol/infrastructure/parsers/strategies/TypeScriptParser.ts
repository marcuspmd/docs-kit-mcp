import Parser from "tree-sitter";
import type { ILanguageParser, ParseResult } from "./ILanguageParser.js";
import { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";
import type { SymbolKindType } from "../../../domain/value-objects/SymbolKind.js";

/**
 * TypeScript/JavaScript Parser
 *
 * Uses Tree-sitter to parse TypeScript/JavaScript files and extract symbols with relationships.
 */
export class TypeScriptParser implements ILanguageParser {
  readonly supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];

  constructor(private readonly parser: Parser) {}

  async parse(filePath: string, content: string): Promise<ParseResult> {
    try {
      const tree = this.parser.parse(content);
      const symbols: CodeSymbol[] = [];
      const relationships: SymbolRelationship[] = [];

      // Extract import statements for context
      const imports = this.extractImports(tree.rootNode);

      // Extract symbols from AST
      this.extractSymbols(tree.rootNode, content, filePath, symbols, relationships, imports);

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

  /**
   * Extract import statements from a TypeScript file.
   * Returns a map of local name → source module path.
   */
  private extractImports(root: Parser.SyntaxNode): Map<string, string> {
    const imports = new Map<string, string>();

    for (const child of root.children) {
      if (child.type !== "import_statement") continue;

      // Get the source module path
      const sourceNode = child.childForFieldName("source");
      const source = sourceNode?.text?.replace(/['"]/g, "") ?? "";

      // Skip external packages (node_modules)
      if (!source.startsWith(".") && !source.startsWith("/")) continue;

      const importClause = child.children.find((c) => c.type === "import_clause");
      if (!importClause) continue;

      // Handle default import: import Foo from './foo'
      const defaultImport = importClause.children.find((c) => c.type === "identifier");
      if (defaultImport) {
        imports.set(defaultImport.text, source);
      }

      // Handle named imports: import { foo, bar as baz } from './foo'
      const namedImports = importClause.descendantsOfType("import_specifier");
      for (const spec of namedImports) {
        const aliasNode = spec.childForFieldName("alias");
        const nameNode = spec.childForFieldName("name");

        // If there's an alias, use it as the local name
        const localName = aliasNode?.text ?? nameNode?.text;
        const originalName = nameNode?.text;

        if (localName && originalName) {
          imports.set(localName, `${source}::${originalName}`);
        }
      }

      // Handle namespace import: import * as foo from './foo'
      const namespaceImport = importClause.descendantsOfType("namespace_import");
      for (const ns of namespaceImport) {
        const nameNode = ns.children.find((c) => c.type === "identifier");
        if (nameNode) {
          imports.set(nameNode.text, `${source}::*`);
        }
      }
    }

    return imports;
  }

  private extractSymbols(
    node: Parser.SyntaxNode,
    content: string,
    filePath: string,
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[],
    imports: Map<string, string>,
    parentName?: string,
  ): void {
    // Process current node
    const symbol = this.extractSymbol(node, content, filePath, parentName);
    if (symbol) {
      symbols.push(symbol);
      // Extract class-level relationships
      this.extractClassRelationships(node, symbol, symbols, relationships, filePath);

      // Recursively process children with this symbol as parent
      for (const child of node.children) {
        const newParent = symbol.qualifiedName;
        this.extractSymbols(child, content, filePath, symbols, relationships, imports, newParent);
      }
    } else {
      // Recursively process children with same parent
      for (const child of node.children) {
        this.extractSymbols(child, content, filePath, symbols, relationships, imports, parentName);
      }
    }

    // Extract method-level relationships (calls, instantiations, etc.)
    this.extractMethodRelationships(node, symbols, relationships, filePath, imports);
  }

  private extractSymbol(
    node: Parser.SyntaxNode,
    content: string,
    filePath: string,
    parentName?: string,
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

    // Build qualified name
    const qualifiedName = parentName ? `${parentName}.${name}` : name;

    // Extract visibility
    const visibility = this.extractVisibility(node);

    // Use CodeSymbol.create factory
    const result = CodeSymbol.create({
      name,
      qualifiedName,
      kind,
      location: {
        filePath,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      },
      exported: this.isExported(node),
      language: "ts",
      visibility,
    });

    if (result.isSuccess) {
      return result.value;
    }

    return null;
  }

  private extractVisibility(
    node: Parser.SyntaxNode,
  ): "public" | "private" | "protected" | undefined {
    const modifier = node.children.find((c) => c.type === "accessibility_modifier");
    if (modifier) {
      const text = modifier.text;
      if (text === "public" || text === "private" || text === "protected") return text;
    }
    return undefined;
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

  private extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    _symbols: CodeSymbol[],
    relationships: SymbolRelationship[],
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
            const rel = SymbolRelationship.create({
              sourceId: classSymbol.id,
              targetId: typeNode.text,
              type: "inherits",
              location: {
                file,
                line: node.startPosition.row + 1,
              },
            });
            relationships.push(rel);
          }
        }
        if (child.type === "implements_clause") {
          for (const typeChild of child.children) {
            if (typeChild.type === "type_identifier" || typeChild.type === "identifier") {
              const rel = SymbolRelationship.create({
                sourceId: classSymbol.id,
                targetId: typeChild.text,
                type: "implements",
                location: {
                  file,
                  line: node.startPosition.row + 1,
                },
              });
              relationships.push(rel);
            }
          }
        }
      }
    }
  }

  private extractMethodRelationships(
    node: Parser.SyntaxNode,
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[],
    file: string,
    imports: Map<string, string>,
  ): void {
    // Extract instantiation relationships
    if (node.type === "new_expression") {
      const constructorNode = node.childForFieldName("constructor");
      if (constructorNode?.type === "identifier") {
        const enclosing = this.findEnclosingSymbol(node.startPosition.row, symbols);
        if (enclosing) {
          const rel = SymbolRelationship.create({
            sourceId: enclosing.id,
            targetId: constructorNode.text,
            type: "instantiates",
            location: {
              file,
              line: node.startPosition.row + 1,
            },
          });
          relationships.push(rel);
        }
      }
    }

    // Extract function/method calls
    if (node.type === "call_expression") {
      const functionNode = node.childForFieldName("function");

      // Only handle direct function calls (identifier), not method calls (member_expression)
      // Method calls like obj.count() should NOT match standalone functions named "count"
      if (functionNode?.type === "identifier") {
        const funcName = functionNode.text;
        const enclosing = this.findEnclosingSymbol(node.startPosition.row, symbols);
        if (enclosing) {
          // Check if this function is defined in the same file (local function)
          const isLocalFunction = symbols.some(
            (s) =>
              (s.kind === "function" || s.kind === "method") &&
              (s.name === funcName || s.name.endsWith(`.${funcName}`)),
          );

          // Check if this function was imported from another file
          const isImported = imports.has(funcName);

          // Only create relationship if we have high confidence about the target
          if (isLocalFunction || isImported) {
            // Use the imported module path to help with resolution if available
            const importSource = imports.get(funcName);
            const targetName = importSource ? `${importSource}::${funcName}` : funcName;
            const rel = SymbolRelationship.create({
              sourceId: enclosing.id,
              targetId: targetName,
              type: "calls",
              location: {
                file,
                line: node.startPosition.row + 1,
              },
            });
            relationships.push(rel);
          }
        }
      }

      // Handle method calls on 'this' (e.g., this.count())
      if (functionNode?.type === "member_expression") {
        const object = functionNode.childForFieldName("object");
        const property = functionNode.childForFieldName("property");

        if (object?.text === "this" && property?.type === "property_identifier") {
          const methodName = property.text;
          const enclosing = this.findEnclosingSymbol(node.startPosition.row, symbols);
          if (enclosing) {
            // Find the parent class to build qualified name
            const parentClass = symbols.find(
              (s) =>
                s.id === enclosing.parent && (s.kind === "class" || s.kind === "abstract_class"),
            );
            if (parentClass) {
              const qualifiedName = `${parentClass.name}.${methodName}`;
              const rel = SymbolRelationship.create({
                sourceId: enclosing.id,
                targetId: qualifiedName,
                type: "calls",
                location: {
                  file,
                  line: node.startPosition.row + 1,
                },
              });
              relationships.push(rel);
            }
          }
        }
      }
    }

    // Extract import relationships
    if (node.type === "import_statement") {
      const importClause = node.children.find((c) => c.type === "import_clause");
      if (importClause) {
        const namedImports = importClause.descendantsOfType("import_specifier");
        const source = symbols.find((s) => s.parent === undefined);
        if (source) {
          for (const spec of namedImports) {
            const nameNode = spec.childForFieldName("name");
            if (nameNode) {
              const rel = SymbolRelationship.create({
                sourceId: source.id,
                targetId: nameNode.text,
                type: "uses",
                location: {
                  file,
                  line: node.startPosition.row + 1,
                },
              });
              relationships.push(rel);
            }
          }
        }
      }
    }

    // Recursively process children
    for (const child of node.children) {
      this.extractMethodRelationships(child, symbols, relationships, file, imports);
    }
  }

  private findEnclosingSymbol(line: number, symbols: CodeSymbol[]): CodeSymbol | undefined {
    let best: CodeSymbol | undefined;
    for (const s of symbols) {
      if (s.startLine <= line + 1 && s.endLine >= line + 1) {
        if (!best || s.endLine - s.startLine < best.endLine - best.startLine) {
          best = s;
        }
      }
    }
    return best;
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
