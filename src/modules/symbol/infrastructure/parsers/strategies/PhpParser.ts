import Parser from "tree-sitter";
import type { ILanguageParser, ParseResult } from "./ILanguageParser.js";
import { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";
import type { SymbolKindType } from "../../../domain/value-objects/SymbolKind.js";

/**
 * PHP Parser
 *
 * Uses Tree-sitter to parse PHP files and extract symbols with relationships.
 */
export class PhpParser implements ILanguageParser {
  readonly supportedExtensions = [".php"];

  constructor(private readonly parser: Parser) {}

  async parse(filePath: string, content: string): Promise<ParseResult> {
    try {
      const tree = this.parser.parse(content);
      const symbols: CodeSymbol[] = [];
      const relationships: SymbolRelationship[] = [];

      // Extract namespace and use statements for context
      const namespace = this.extractNamespace(tree.rootNode);
      const useStatements = this.extractUseStatements(tree.rootNode);

      // Extract symbols from AST
      this.extractSymbols(
        tree.rootNode,
        content,
        filePath,
        symbols,
        relationships,
        namespace,
        useStatements,
      );

      return {
        symbols,
        relationships,
        metadata: {
          language: "php",
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
          language: "php",
          loc: content.split("\n").length,
          size: content.length,
        },
      };
    }
  }

  /**
   * Extract namespace from PHP file
   */
  private extractNamespace(root: Parser.SyntaxNode): string | undefined {
    for (const child of root.children) {
      if (child.type === "namespace_definition") {
        const name = child.childForFieldName("name");
        return name?.text;
      }
    }
    return undefined;
  }

  /**
   * Extract use statements from PHP file for namespace resolution.
   * Returns a map of alias/shortName → fully qualified name.
   *
   * Handles:
   * - `use App\Services\Request;` → "Request" → "App\Services\Request"
   * - `use App\Services\Request as HttpReq;` → "HttpReq" → "App\Services\Request"
   * - `use App\Services\{Request, Response};` → group imports
   */
  private extractUseStatements(root: Parser.SyntaxNode): Map<string, string> {
    const imports = new Map<string, string>();

    for (const child of root.children) {
      if (child.type === "namespace_use_declaration") {
        for (const clause of child.children) {
          if (clause.type === "namespace_use_clause") {
            const nameNode = clause.children.find(
              (c) => c.type === "name" || c.type === "qualified_name",
            );
            if (nameNode) {
              const qualifiedName = nameNode.text;
              // Check for alias: `use Foo\Bar as Baz;`
              const aliasNode = clause.children.find((c) => c.type === "namespace_aliasing_clause");
              let alias: string;
              if (aliasNode) {
                const aliasName = aliasNode.children.find((c) => c.type === "name");
                alias = aliasName?.text ?? qualifiedName.split("\\").pop()!;
              } else {
                alias = qualifiedName.split("\\").pop()!;
              }
              imports.set(alias, qualifiedName);
            }
          } else if (clause.type === "namespace_use_group") {
            // Handle group imports: `use App\Services\{Request, Response};`
            const prefixNode = clause.children.find(
              (c) => c.type === "name" || c.type === "qualified_name",
            );
            const prefix = prefixNode?.text ?? "";

            for (const groupClause of clause.children) {
              if (groupClause.type === "namespace_use_group_clause") {
                const subName = groupClause.children.find(
                  (c) => c.type === "name" || c.type === "qualified_name",
                );
                if (subName) {
                  const qualifiedName = prefix ? `${prefix}\\${subName.text}` : subName.text;
                  // Check for alias within group
                  const aliasNode = groupClause.children.find(
                    (c) => c.type === "namespace_aliasing_clause",
                  );
                  let alias: string;
                  if (aliasNode) {
                    const aliasName = aliasNode.children.find((c) => c.type === "name");
                    alias = aliasName?.text ?? subName.text.split("\\").pop()!;
                  } else {
                    alias = subName.text.split("\\").pop()!;
                  }
                  imports.set(alias, qualifiedName);
                }
              }
            }
          }
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
    namespace?: string,
    useStatements?: Map<string, string>,
    parentName?: string,
  ): void {
    // Process current node
    const symbol = this.extractSymbol(node, content, filePath, namespace, parentName);
    if (symbol) {
      symbols.push(symbol);
      // Extract class-level relationships
      this.extractClassRelationships(node, symbol, symbols, relationships, filePath, useStatements);

      // Recursively process children with this symbol as parent
      for (const child of node.children) {
        const newParent = symbol.qualifiedName;
        this.extractSymbols(
          child,
          content,
          filePath,
          symbols,
          relationships,
          namespace,
          useStatements,
          newParent,
        );
      }
    } else {
      // Recursively process children with same parent
      for (const child of node.children) {
        this.extractSymbols(
          child,
          content,
          filePath,
          symbols,
          relationships,
          namespace,
          useStatements,
          parentName,
        );
      }
    }

    // Extract method-level relationships (calls, instantiations, etc.)
    this.extractMethodRelationships(node, symbols, relationships, filePath, useStatements);
  }

  private extractSymbol(
    node: Parser.SyntaxNode,
    content: string,
    filePath: string,
    namespace?: string,
    parentName?: string,
  ): CodeSymbol | null {
    const symbolTypes: Record<string, SymbolKindType> = {
      class_declaration: "class",
      interface_declaration: "interface",
      trait_declaration: "trait",
      function_definition: "function",
      method_declaration: "method",
      enum_declaration: "enum",
    };

    let kind = symbolTypes[node.type];
    if (!kind) return null;

    // Extract name
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;

    const name = content.slice(nameNode.startIndex, nameNode.endIndex);

    // Build qualified name
    let qualifiedName: string;
    if (parentName) {
      qualifiedName = `${parentName}.${name}`;
    } else if (namespace) {
      qualifiedName = `${namespace}\\${name}`;
    } else {
      qualifiedName = name;
    }

    // Refine kind based on naming conventions
    const extendsName = this.extractExtends(node);
    const implementsNames = this.extractImplements(node);
    kind = this.refineKind(kind, name, extendsName, implementsNames);

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
      exported: this.isExported(),
      language: "php",
      visibility,
    });

    if (result.isSuccess) {
      return result.value;
    }

    return null;
  }

  private extractExtends(node: Parser.SyntaxNode): string | undefined {
    const base = node.children.find((c) => c.type === "base_clause");
    if (!base) return undefined;
    const nameNode = base.children.find((c) => c.type === "name" || c.type === "qualified_name");
    return nameNode?.text;
  }

  private extractImplements(node: Parser.SyntaxNode): string[] | undefined {
    const clause = node.children.find((c) => c.type === "class_interface_clause");
    if (!clause) return undefined;
    const names = clause.children
      .filter((c) => c.type === "name" || c.type === "qualified_name")
      .map((c) => c.text);
    return names.length > 0 ? names : undefined;
  }

  private extractTraits(node: Parser.SyntaxNode): string[] | undefined {
    const body = node.children.find((c) => c.type === "declaration_list");
    if (!body) return undefined;
    const traits: string[] = [];
    for (const child of body.children) {
      if (child.type === "use_declaration") {
        for (const n of child.children) {
          if (n.type === "name" || n.type === "qualified_name") traits.push(n.text);
        }
      }
    }
    return traits.length > 0 ? traits : undefined;
  }

  private extractVisibility(
    node: Parser.SyntaxNode,
  ): "public" | "private" | "protected" | undefined {
    const modifier = node.children.find((c) => c.type === "visibility_modifier");
    if (modifier) {
      const text = modifier.text;
      if (text === "public" || text === "private" || text === "protected") return text;
    }
    return undefined;
  }

  private refineKind(
    kind: SymbolKindType,
    name: string,
    extendsName?: string,
    implementsNames?: string[],
  ): SymbolKindType {
    if (kind !== "class") return kind;

    const n = name.toLowerCase();
    const e = extendsName?.toLowerCase() ?? "";
    const impls = (implementsNames ?? []).map((i) => i.toLowerCase());

    if (n.endsWith("event") || e.includes("event")) return "event";
    if (n.endsWith("listener") || n.endsWith("subscriber")) return "listener";
    if (n.endsWith("handler")) return "handler";
    if (n.endsWith("controller")) return "controller";
    if (n.endsWith("service")) return "service";
    if (n.endsWith("repository")) return "repository";
    if (n.endsWith("factory")) return "factory";
    if (n.endsWith("middleware")) return "middleware";
    if (n.endsWith("provider")) return "provider";
    if (n.endsWith("dto") || n.endsWith("request") || n.endsWith("response")) return "dto";
    if (n.endsWith("entity") || n.endsWith("model")) return "entity";
    if (n.endsWith("command")) return "command";
    if (n.endsWith("query")) return "query";
    if (n.endsWith("migration")) return "migration";
    if (impls.some((i) => i.includes("listener") || i.includes("subscriber"))) return "listener";

    return kind;
  }

  private detectDeprecated(node: Parser.SyntaxNode): boolean {
    const prev = node.previousNamedSibling;
    if (prev?.type === "comment" && prev.text.includes("@deprecated")) return true;
    return false;
  }

  private isExported(): boolean {
    // In PHP, all top-level classes, interfaces, traits are considered exported
    // as they can be used via namespace imports
    return true;
  }

  private extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[],
    file: string,
    useStatements?: Map<string, string>,
  ): void {
    // Extract extends relationship
    const baseClause = node.children.find((c) => c.type === "base_clause");
    if (baseClause) {
      const nameNode = baseClause.children.find(
        (c) => c.type === "name" || c.type === "qualified_name",
      );
      if (nameNode) {
        const targetName = this.resolveClassName(nameNode.text, useStatements);
        const rel = SymbolRelationship.create({
          sourceId: classSymbol.id,
          targetId: targetName,
          type: "inherits",
          location: {
            file,
            line: node.startPosition.row + 1,
          },
        });
        relationships.push(rel);
      }
    }

    // Extract implements relationships
    const ifaceClause = node.children.find((c) => c.type === "class_interface_clause");
    if (ifaceClause) {
      for (const typeChild of ifaceClause.children) {
        if (typeChild.type === "name" || typeChild.type === "qualified_name") {
          const targetName = this.resolveClassName(typeChild.text, useStatements);
          const rel = SymbolRelationship.create({
            sourceId: classSymbol.id,
            targetId: targetName,
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

    // Extract trait usage
    const traits = this.extractTraits(node);
    if (traits) {
      for (const traitName of traits) {
        const targetName = this.resolveClassName(traitName, useStatements);
        const rel = SymbolRelationship.create({
          sourceId: classSymbol.id,
          targetId: targetName,
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

  private extractMethodRelationships(
    node: Parser.SyntaxNode,
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[],
    file: string,
    useStatements?: Map<string, string>,
  ): void {
    // Extract instantiation relationships
    if (node.type === "object_creation_expression") {
      const nameNode = node.children.find((c) => c.type === "name" || c.type === "qualified_name");
      if (nameNode) {
        const enclosing = this.findEnclosingSymbol(node.startPosition.row, symbols);
        if (enclosing) {
          const targetName = this.resolveClassName(nameNode.text, useStatements);
          const rel = SymbolRelationship.create({
            sourceId: enclosing.id,
            targetId: targetName,
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
    if (node.type === "function_call_expression") {
      const functionNode = node.childForFieldName("function");
      if (functionNode?.type === "name" || functionNode?.type === "qualified_name") {
        const funcName = functionNode.text;
        const enclosing = this.findEnclosingSymbol(node.startPosition.row, symbols);
        if (enclosing) {
          const targetName = this.resolveClassName(funcName, useStatements);
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

    // Recursively process children
    for (const child of node.children) {
      this.extractMethodRelationships(child, symbols, relationships, file, useStatements);
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

  private resolveClassName(name: string, useStatements?: Map<string, string>): string {
    if (!useStatements) return name;

    // If it's a fully qualified name (starts with \), use it without the leading \
    if (name.startsWith("\\")) {
      return name.slice(1);
    }

    // If it's already a qualified name (contains \), use it as is
    if (name.includes("\\")) {
      return name;
    }

    // Check if there's a use statement for this short name
    const resolved = useStatements.get(name);
    if (resolved) {
      return resolved;
    }

    // Return the short name as is
    return name;
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
