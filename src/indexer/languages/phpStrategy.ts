import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind, Visibility } from "../symbol.types.js";
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

  refineKind(kind: SymbolKind, name: string, extendsName?: string, implementsNames?: string[]): SymbolKind {
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

  extractClassRelationships(node: Parser.SyntaxNode, classSymbol: CodeSymbol, addRel: AddRelFn, file: string): void {
    // extends via base_clause
    const baseClause = node.children.find((c) => c.type === "base_clause");
    if (baseClause) {
      const nameNode = baseClause.children.find(
        (c) => c.type === "name" || c.type === "qualified_name",
      );
      if (nameNode) {
        addRel(classSymbol.id, nameNode.text, "inherits", file, node.startPosition.row + 1);
      }
    }

    // implements via class_interface_clause
    const ifaceClause = node.children.find((c) => c.type === "class_interface_clause");
    if (ifaceClause) {
      for (const typeChild of ifaceClause.children) {
        if (typeChild.type === "name" || typeChild.type === "qualified_name") {
          addRel(classSymbol.id, typeChild.text, "implements", file, node.startPosition.row + 1);
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
              addRel(classSymbol.id, n.text, "uses_trait", file, child.startPosition.row + 1);
            }
          }
        }
      }
    }
  }

  extractInstantiationRelationships(node: Parser.SyntaxNode, symsInFile: CodeSymbol[], addRel: AddRelFn, file: string): void {
    // object_creation_expression → instantiates
    if (node.type === "object_creation_expression") {
      const nameNode = node.children.find(
        (c) => c.type === "name" || c.type === "qualified_name",
      );
      if (nameNode) {
        const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
        if (enclosing) {
          addRel(enclosing.id, nameNode.text, "instantiates", file, node.startPosition.row + 1);
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
          const parts = scope.text.split("\\");
          const shortName = parts[parts.length - 1];
          addRel(enclosing.id, shortName, "dispatches", file, node.startPosition.row + 1);
        }
      }
    }
  }

  extractEventListenerRelationships(node: Parser.SyntaxNode, symsInFile: CodeSymbol[], addRel: AddRelFn, file: string): void {
    if (node.type !== "method_declaration") return;
    const methodName = node.childForFieldName("name")?.text;
    if (methodName !== "handle") return;

    const params = node.children.find((c) => c.type === "formal_parameters");
    if (!params) return;

    const firstParam = params.children.find((c) => c.type === "simple_parameter");
    if (!firstParam) return;

    const typeNode = firstParam.children.find(
      (c) => c.type === "name" || c.type === "qualified_name" || c.type === "named_type" || c.type === "union_type",
    );
    if (!typeNode) return;

    // For union_type, take the first type; for qualified_name, take last segment
    let typeName = typeNode.text;
    if (typeNode.type === "union_type") {
      const first = typeNode.children.find((c) => c.type === "name" || c.type === "qualified_name" || c.type === "named_type");
      if (first) typeName = first.text;
    }
    const parts = typeName.split("\\");
    const shortName = parts[parts.length - 1];

    // Find the enclosing class symbol
    const enclosingClass = symsInFile.find(
      (s) => !s.parent && s.startLine <= node.startPosition.row + 1 && s.endLine >= node.endPosition.row + 1,
    );
    if (enclosingClass) {
      addRel(enclosingClass.id, shortName, "listens_to", file, node.startPosition.row + 1);
    }
  }

  extractImportRelationships(node: Parser.SyntaxNode, symsInFile: CodeSymbol[], addRel: AddRelFn, file: string): void {
    if (node.type !== "namespace_use_declaration") return;
    for (const child of node.children) {
      if (child.type === "namespace_use_clause") {
        const nameNode = child.children.find(
          (c) => c.type === "name" || c.type === "qualified_name",
        );
        if (nameNode) {
          const parts = nameNode.text.split("\\");
          const shortName = parts[parts.length - 1];
          const topLevel = symsInFile.find((s) => !s.parent);
          if (topLevel) {
            addRel(topLevel.id, shortName, "uses", file, node.startPosition.row + 1);
          }
        }
      }
    }
  }
}

function findEnclosingSymbol(line: number, symsInFile: CodeSymbol[]): CodeSymbol | undefined {
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
