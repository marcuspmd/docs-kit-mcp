import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind, Visibility } from "../symbol.types.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";
import type { ResolutionContext } from "../relationshipExtractor.js";

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
    _ctx?: unknown,
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
    _ctx?: unknown,
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
    _ctx?: unknown,
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
    ctx?: ResolutionContext,
  ): void {
    // Extract function calls
    if (node.type === "call_expression") {
      const functionNode = node.childForFieldName("function");

      // Only handle direct function calls (identifier), not method calls (member_expression)
      // Method calls like obj.count() should NOT match standalone functions named "count"
      if (functionNode?.type === "identifier") {
        const funcName = functionNode.text;
        const enclosing =
          findEnclosingSymbol(node.startPosition.row, symsInFile) ??
          symsInFile.find((s) => !s.parent) ??
          syntheticModuleSymbol(file);

        // Check if this function is defined in the same file (local function)
        const isLocalFunction = symsInFile.some(
          (s) =>
            (s.kind === "function" || s.kind === "method") &&
            (s.name === funcName || s.name.endsWith(`.${funcName}`)),
        );

        // Check if this function was imported from another file
        const isImported = ctx?.imports.has(funcName);

        // Only create relationship if we have high confidence about the target
        if (isLocalFunction || isImported) {
          // Use the imported module path to help with resolution if available
          const importSource = ctx?.imports.get(funcName);
          const targetName = importSource ? `${importSource}::${funcName}` : funcName;
          addRel(enclosing.id, targetName, "calls", file, node.startPosition.row + 1);
        }
      }

      // Handle method calls on 'this' (e.g., this.count())
      if (functionNode?.type === "member_expression") {
        const object = functionNode.childForFieldName("object");
        const property = functionNode.childForFieldName("property");

        if (object?.text === "this" && property?.type === "property_identifier") {
          const methodName = property.text;
          const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
          if (enclosing) {
            // Find the parent class to build qualified name
            const parentClass = symsInFile.find(
              (s) => s.id === enclosing.parent && (s.kind === "class" || s.kind === "abstract_class"),
            );
            if (parentClass) {
              const qualifiedName = `${parentClass.name}.${methodName}`;
              addRel(enclosing.id, qualifiedName, "calls", file, node.startPosition.row + 1);
            }
          }
        }
      }
    }
  }

  /**
   * Extract import statements from a TypeScript file.
   * Returns a map of local name → source module path.
   */
  extractImports(root: Parser.SyntaxNode): Map<string, string> {
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
