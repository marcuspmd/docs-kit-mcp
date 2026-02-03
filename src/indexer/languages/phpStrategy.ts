import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind, Visibility } from "../symbol.types.js";
import type { ResolutionContext } from "../relationshipExtractor.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";

export class PhpStrategy implements LanguageStrategy {
  extractNamespace(root: Parser.SyntaxNode): string | undefined {
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
  extractUseStatements(root: Parser.SyntaxNode): Map<string, string> {
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

  buildQualifiedName(name: string, parentName?: string, namespace?: string): string {
    if (parentName) return `${parentName}.${name}`;
    if (namespace) return `${namespace}\\${name}`;
    return name;
  }

  extractExtends(node: Parser.SyntaxNode): string | undefined {
    const base = node.children.find((c) => c.type === "base_clause");
    if (!base) return undefined;
    const nameNode = base.children.find((c) => c.type === "name" || c.type === "qualified_name");
    return nameNode?.text;
  }

  extractImplements(node: Parser.SyntaxNode): string[] | undefined {
    const clause = node.children.find((c) => c.type === "class_interface_clause");
    if (!clause) return undefined;
    const names = clause.children
      .filter((c) => c.type === "name" || c.type === "qualified_name")
      .map((c) => c.text);
    return names.length > 0 ? names : undefined;
  }

  extractTraits(node: Parser.SyntaxNode): string[] | undefined {
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

  extractVisibility(node: Parser.SyntaxNode): Visibility | undefined {
    const modifier = node.children.find((c) => c.type === "visibility_modifier");
    if (modifier) {
      const text = modifier.text as Visibility;
      if (text === "public" || text === "private" || text === "protected") return text;
    }
    return undefined;
  }

  refineKind(
    kind: SymbolKind,
    name: string,
    extendsName?: string,
    implementsNames?: string[],
  ): SymbolKind {
    if (kind !== "class" && kind !== "abstract_class") return kind;

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

  detectDeprecated(node: Parser.SyntaxNode): boolean {
    const prev = node.previousNamedSibling;
    if (prev?.type === "comment" && prev.text.includes("@deprecated")) return true;
    return false;
  }

  extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    // extends via base_clause
    const baseClause = node.children.find((c) => c.type === "base_clause");
    if (baseClause) {
      const nameNode = baseClause.children.find(
        (c) => c.type === "name" || c.type === "qualified_name",
      );
      if (nameNode) {
        addRel(classSymbol.id, nameNode.text, "inherits", file, node.startPosition.row + 1, ctx);
      }
    }

    // implements via class_interface_clause
    const ifaceClause = node.children.find((c) => c.type === "class_interface_clause");
    if (ifaceClause) {
      for (const typeChild of ifaceClause.children) {
        if (typeChild.type === "name" || typeChild.type === "qualified_name") {
          addRel(
            classSymbol.id,
            typeChild.text,
            "implements",
            file,
            node.startPosition.row + 1,
            ctx,
          );
        }
      }
    }

    // use traits via use_declaration in declaration_list
    const body = node.children.find((c) => c.type === "declaration_list");
    if (body) {
      for (const child of body.children) {
        if (child.type === "use_declaration") {
          for (const n of child.children) {
            if (n.type === "name" || n.type === "qualified_name") {
              addRel(classSymbol.id, n.text, "uses_trait", file, child.startPosition.row + 1, ctx);
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
    ctx?: ResolutionContext,
  ): void {
    // object_creation_expression → instantiates
    if (node.type === "object_creation_expression") {
      const nameNode = node.children.find((c) => c.type === "name" || c.type === "qualified_name");
      if (nameNode) {
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (enclosing) {
          addRel(
            enclosing.id,
            nameNode.text,
            "instantiates",
            file,
            node.startPosition.row + 1,
            ctx,
          );
        }
      }
      return;
    }

    // scoped_call_expression where method = "dispatch" → dispatches
    if (node.type === "scoped_call_expression") {
      const scope = node.children.find((c) => c.type === "name" || c.type === "qualified_name");
      const methodName = node.childForFieldName("name")?.text;
      if (scope && methodName === "dispatch") {
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (enclosing) {
          // Pass full qualified name if available, or short name for resolution
          addRel(enclosing.id, scope.text, "dispatches", file, node.startPosition.row + 1, ctx);
        }
      }
    }
  }

  extractEventListenerRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    if (node.type !== "method_declaration") return;
    const methodName = node.childForFieldName("name")?.text;
    if (methodName !== "handle") return;

    const params = node.children.find((c) => c.type === "formal_parameters");
    if (!params) return;

    const firstParam = params.children.find((c) => c.type === "simple_parameter");
    if (!firstParam) return;

    const typeNode = firstParam.children.find(
      (c) =>
        c.type === "name" ||
        c.type === "qualified_name" ||
        c.type === "named_type" ||
        c.type === "union_type",
    );
    if (!typeNode) return;

    // For union_type, take the first type
    let typeName = typeNode.text;
    if (typeNode.type === "union_type") {
      const first = typeNode.children.find(
        (c) => c.type === "name" || c.type === "qualified_name" || c.type === "named_type",
      );
      if (first) typeName = first.text;
    }

    // Find the enclosing class symbol
    const enclosingClass = symsInFile.find(
      (s) =>
        !s.parent &&
        s.startLine <= node.startPosition.row + 1 &&
        s.endLine >= node.endPosition.row + 1,
    );
    if (enclosingClass) {
      // Pass full type name for resolution via context
      addRel(enclosingClass.id, typeName, "listens_to", file, node.startPosition.row + 1, ctx);
    }
  }

  extractImportRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    if (node.type !== "namespace_use_declaration") return;
    for (const child of node.children) {
      if (child.type === "namespace_use_clause") {
        const nameNode = child.children.find(
          (c) => c.type === "name" || c.type === "qualified_name",
        );
        if (nameNode) {
          // Use full qualified name for resolution
          const qualifiedName = nameNode.text;
          const topLevel = symsInFile.find((s) => !s.parent);
          if (topLevel) {
            addRel(topLevel.id, qualifiedName, "uses", file, node.startPosition.row + 1, ctx);
          }
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
    if (node.type === "function_call_expression") {
      const functionNode = node.childForFieldName("function");
      if (functionNode?.type === "name" || functionNode?.type === "qualified_name") {
        const funcName = functionNode.text;
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (!enclosing) return;

        // If it's a fully qualified name (starts with \), use it directly
        if (funcName.startsWith("\\")) {
          addRel(enclosing.id, funcName.slice(1), "calls", file, node.startPosition.row + 1, ctx);
          return;
        }

        // If it's already a qualified name (contains \), use it directly
        if (funcName.includes("\\")) {
          // Could be relative to current namespace or absolute
          const qualifiedName = ctx?.namespace ? `${ctx.namespace}\\${funcName}` : funcName;
          addRel(enclosing.id, qualifiedName, "calls", file, node.startPosition.row + 1, ctx);
          return;
        }

        // Short name - need to verify it's a known function
        // Check if function is defined locally in the same file
        const isLocalFunction = symsInFile.some(
          (s) => s.kind === "function" && (s.name === funcName || s.name.endsWith(`\\${funcName}`)),
        );

        // Check if there's a use statement for this function
        // (ctx.imports contains class imports, but PHP also has `use function`)
        const isImported = ctx?.imports.has(funcName);

        // Build qualified name using namespace if available
        const qualifiedName = ctx?.namespace ? `${ctx.namespace}\\${funcName}` : funcName;

        // Check if a function with this qualified name exists in the index
        const existsInNamespace = symsInFile.some(
          (s) => s.kind === "function" && s.name === qualifiedName,
        );

        // Only create relationship if we have confidence about the target
        if (isLocalFunction || isImported || existsInNamespace) {
          addRel(enclosing.id, qualifiedName, "calls", file, node.startPosition.row + 1, ctx);
        }
      }
    }

    // Extract member access - only for static class method calls
    if (node.type === "member_access_expression" || node.type === "member_call_expression") {
      const object = node.childForFieldName("object");

      // Skip variable access like $this->method() or $obj->method()
      if (object?.type === "variable_name" && object.text.startsWith("$")) {
        return;
      }

      // Handle static class access like ClassName::method()
      if (object?.type === "name" || object?.type === "qualified_name") {
        const className = object.text;
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (!enclosing) return;

        // If it's a fully qualified name, use it directly
        if (className.startsWith("\\")) {
          addRel(enclosing.id, className.slice(1), "uses", file, node.startPosition.row + 1, ctx);
          return;
        }

        // Check if this class is imported via use statement
        if (ctx?.imports.has(className)) {
          const qualifiedName = ctx.imports.get(className)!;
          addRel(enclosing.id, qualifiedName, "uses", file, node.startPosition.row + 1, ctx);
          return;
        }

        // Check if class exists in current namespace
        const qualifiedName = ctx?.namespace ? `${ctx.namespace}\\${className}` : className;
        const existsInNamespace = symsInFile.some(
          (s) =>
            (s.kind === "class" || s.kind === "abstract_class" || s.kind === "interface") &&
            s.name === qualifiedName,
        );

        if (existsInNamespace || className.includes("\\")) {
          addRel(enclosing.id, qualifiedName, "uses", file, node.startPosition.row + 1, ctx);
        }
      }
    }

    // Handle $this->method() calls - create relationship to parent class method
    if (node.type === "member_call_expression") {
      const object = node.childForFieldName("object");
      const methodName = node.childForFieldName("name")?.text;

      if (object?.type === "variable_name" && object.text === "$this" && methodName) {
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (!enclosing) return;

        // Find the parent class
        const parentClass = symsInFile.find(
          (s) =>
            s.id === enclosing.parent &&
            (s.kind === "class" || s.kind === "abstract_class" || s.kind === "service"),
        );

        if (parentClass) {
          // Use qualified method name: ClassName.methodName
          const qualifiedMethodName = `${parentClass.name}.${methodName}`;
          addRel(enclosing.id, qualifiedMethodName, "calls", file, node.startPosition.row + 1, ctx);
        }
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
