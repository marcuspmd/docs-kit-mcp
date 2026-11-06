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
            this._resolveUseClause(clause, imports);
          } else if (clause.type === "namespace_use_group") {
            this._resolveUseGroup(clause, imports);
          }
        }
      }
    }
    return imports;
  }

  private _resolveUseClause(clause: Parser.SyntaxNode, imports: Map<string, string>): void {
    const nameNode = clause.children.find((c) => c.type === "name" || c.type === "qualified_name");
    if (!nameNode) return;
    const qualifiedName = nameNode.text;
    const aliasNode = clause.children.find((c) => c.type === "namespace_aliasing_clause");
    const alias = aliasNode
      ? (aliasNode.children.find((c) => c.type === "name")?.text ??
        qualifiedName.split("\\").pop()!)
      : qualifiedName.split("\\").pop()!;
    imports.set(alias, qualifiedName);
  }

  private _resolveUseGroup(clause: Parser.SyntaxNode, imports: Map<string, string>): void {
    const prefixNode = clause.children.find(
      (c) => c.type === "name" || c.type === "qualified_name",
    );
    const prefix = prefixNode?.text ?? "";
    for (const groupClause of clause.children) {
      if (groupClause.type === "namespace_use_group_clause") {
        const subName = groupClause.children.find(
          (c) => c.type === "name" || c.type === "qualified_name",
        );
        if (!subName) continue;
        const qualifiedName = prefix ? `${prefix}\\${subName.text}` : subName.text;
        const aliasNode = groupClause.children.find((c) => c.type === "namespace_aliasing_clause");
        const alias = aliasNode
          ? (aliasNode.children.find((c) => c.type === "name")?.text ??
            subName.text.split("\\").pop()!)
          : subName.text.split("\\").pop()!;
        imports.set(alias, qualifiedName);
      }
    }
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

    // ── PHP Dependency Injection ──────────────────────────────────────────────
    // Covers:
    //   1. Constructor parameter type hints (Symfony/Laravel/PHP-DI auto-wiring)
    //      public function __construct(private PaymentRepository $repo) {}
    //   2. PHP 8 constructor promotion (same syntax as above — already in params)
    //   3. PHP 8 Attributes on properties: #[Inject] private PaymentRepository $repo;
    this._extractPhpDiRelationships(node, classSymbol, addRel, file, ctx);
  }

  /**
   * Extract DI relationships from a PHP class node.
   *
   * PHP DI is unique: type hints on constructor params ARE the injection tokens —
   * no extra decorator needed (Symfony autowiring reads the type hint directly).
   */
  private _extractPhpDiRelationships(
    classNode: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    const body = classNode.children.find((c) => c.type === "declaration_list");
    if (!body) return;

    for (const member of body.children) {
      // ── 1. Constructor parameter injection ──────────────────────────────────
      // method_declaration { name: "__construct", formal_parameters: [...] }
      if (
        member.type === "method_declaration" &&
        member.childForFieldName("name")?.text === "__construct"
      ) {
        const params =
          member.childForFieldName("parameters") ??
          member.children.find((c) => c.type === "formal_parameters");
        if (!params) continue;

        for (const param of params.children) {
          // simple_parameter | promoted_property_parameter | variadic_parameter
          if (
            param.type !== "simple_parameter" &&
            param.type !== "promoted_property_parameter" &&
            param.type !== "variadic_parameter"
          ) {
            continue;
          }

          const typeName = extractPhpTypeHint(param, ctx);
          if (typeName) {
            addRel(classSymbol.id, typeName, "uses", file, param.startPosition.row + 1, ctx);
          }
        }
      }

      // ── 2. Property injection via PHP 8 Attributes (#[Inject]) ──────────────
      // attribute_list  → attribute { name: "Inject" / "Autowire" / ... }
      // property_declaration → named_type
      if (member.type === "property_declaration") {
        const hasInjectAttr =
          member.previousNamedSibling?.type === "attribute_list" &&
          PHP_INJECT_ATTRS.test(member.previousNamedSibling.text);

        if (!hasInjectAttr) continue;

        const typeName = extractPhpTypeHint(member, ctx);
        if (typeName) {
          addRel(classSymbol.id, typeName, "uses", file, member.startPosition.row + 1, ctx);
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
    if (node.type === "function_call_expression") {
      this._extractFunctionCallRel(node, symsInFile, addRel, file, ctx);
    }
    if (node.type === "member_access_expression" || node.type === "member_call_expression") {
      this._extractMemberAccessRel(node, symsInFile, addRel, file, ctx);
    }
    if (node.type === "member_call_expression") {
      this._extractThisCallRel(node, symsInFile, addRel, file, ctx);
    }
  }

  private _extractFunctionCallRel(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    const functionNode = node.childForFieldName("function");
    if (functionNode?.type !== "name" && functionNode?.type !== "qualified_name") return;

    const funcName = functionNode.text;
    const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
    if (!enclosing) return;

    if (funcName.startsWith("\\")) {
      addRel(enclosing.id, funcName.slice(1), "calls", file, node.startPosition.row + 1, ctx);
      return;
    }
    if (funcName.includes("\\")) {
      const qualifiedName = ctx?.namespace ? `${ctx.namespace}\\${funcName}` : funcName;
      addRel(enclosing.id, qualifiedName, "calls", file, node.startPosition.row + 1, ctx);
      return;
    }

    const qualifiedName = ctx?.namespace ? `${ctx.namespace}\\${funcName}` : funcName;
    const isLocalFunction = symsInFile.some(
      (s) => s.kind === "function" && (s.name === funcName || s.name.endsWith(`\\${funcName}`)),
    );
    const isImported = ctx?.imports.has(funcName);
    const existsInNamespace = symsInFile.some(
      (s) => s.kind === "function" && s.name === qualifiedName,
    );

    if (isLocalFunction || isImported || existsInNamespace) {
      addRel(enclosing.id, qualifiedName, "calls", file, node.startPosition.row + 1, ctx);
    }
  }

  private _extractMemberAccessRel(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    const object = node.childForFieldName("object");

    // Skip variable access like $this->method() or $obj->method()
    if (object?.type === "variable_name" && object.text.startsWith("$")) return;

    if (object?.type !== "name" && object?.type !== "qualified_name") return;

    const className = object.text;
    const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
    if (!enclosing) return;

    if (className.startsWith("\\")) {
      addRel(enclosing.id, className.slice(1), "uses", file, node.startPosition.row + 1, ctx);
      return;
    }
    if (ctx?.imports.has(className)) {
      addRel(
        enclosing.id,
        ctx.imports.get(className)!,
        "uses",
        file,
        node.startPosition.row + 1,
        ctx,
      );
      return;
    }

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

  private _extractThisCallRel(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    const object = node.childForFieldName("object");
    const methodName = node.childForFieldName("name")?.text;
    if (object?.type !== "variable_name" || object.text !== "$this" || !methodName) return;

    const enclosing = findEnclosingSymbol(node.startPosition.row, symsInFile);
    if (!enclosing) return;

    const parentClass = symsInFile.find(
      (s) =>
        s.id === enclosing.parent &&
        (s.kind === "class" || s.kind === "abstract_class" || s.kind === "service"),
    );
    if (parentClass) {
      addRel(
        enclosing.id,
        `${parentClass.name}.${methodName}`,
        "calls",
        file,
        node.startPosition.row + 1,
        ctx,
      );
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

// ── PHP DI helpers ────────────────────────────────────────────────────────────

/**
 * PHP 8 attribute names that signal property injection.
 * Matches #[Inject], #[Autowire], #[Autowired], #[Required].
 */
const PHP_INJECT_ATTRS = /\#\[\s*(Inject|Autowire|Autowired|Required)\s*[(\]]/i;

/**
 * PHP primitive and built-in types that must NOT generate `uses` edges.
 * Includes scalar types, compound types, pseudo-types, and SPL/global interfaces
 * that are never user-defined services.
 */
const PHP_PRIMITIVES = new Set([
  "int",
  "float",
  "string",
  "bool",
  "array",
  "callable",
  "void",
  "null",
  "mixed",
  "never",
  "self",
  "static",
  "parent",
  "object",
  "iterable",
  "resource",
  "false",
  "true",
  // Common SPL types — not user services
  "Closure",
  "Generator",
  "Throwable",
  "Exception",
  "Error",
  "stdClass",
  "DateTime",
  "DateTimeImmutable",
  "DateTimeInterface",
]);

/**
 * Extract the concrete user-defined type name from a PHP parameter or property
 * node, skipping primitives and nullable/union syntax.
 *
 * Tree-sitter-php type nodes:
 *   named_type      → name | qualified_name | self | static | parent
 *   nullable_type   → "?" named_type
 *   union_type      → named_type ("|" named_type)+
 *   intersection_type → named_type ("&" named_type)+
 *   disjunctive_normal_form_type — complex, skip
 */
function resolvePhpTypeCandidate(typeNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
  const isNameOrQualified = (c: Parser.SyntaxNode) =>
    c.type === "name" || c.type === "qualified_name";

  if (typeNode.type === "named_type") {
    return typeNode.children.find(isNameOrQualified) ?? null;
  }

  if (typeNode.type === "nullable_type") {
    const inner = typeNode.children.find((c) => c.type === "named_type");
    return inner?.children.find(isNameOrQualified) ?? null;
  }

  if (typeNode.type === "union_type" || typeNode.type === "intersection_type") {
    for (const child of typeNode.children) {
      if (child.type === "named_type") {
        const nameNode = child.children.find(isNameOrQualified);
        if (nameNode && !PHP_PRIMITIVES.has(nameNode.text)) return nameNode;
      }
    }
  }

  return null;
}

function extractPhpTypeHint(node: Parser.SyntaxNode, ctx?: ResolutionContext): string | null {
  const typeNode =
    node.childForFieldName("type") ??
    node.children.find(
      (c) =>
        c.type === "named_type" ||
        c.type === "nullable_type" ||
        c.type === "union_type" ||
        c.type === "intersection_type",
    );

  if (!typeNode) return null;

  const candidate = resolvePhpTypeCandidate(typeNode);
  if (!candidate) return null;

  const name = candidate.text;
  if (!name || PHP_PRIMITIVES.has(name)) return null;

  return ctx?.imports.has(name) ? ctx.imports.get(name)! : name;
}
