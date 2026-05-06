import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind } from "../symbol.types.js";
import type { ResolutionContext } from "../relationshipExtractor.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";
import { DefaultStrategy } from "./defaultStrategy.js";

/**
 * C# language strategy.
 *
 * Extends DefaultStrategy with DI-aware relationship extraction:
 * scans typed constructor parameters to emit `uses` edges for
 * auto-wired dependencies (Microsoft.Extensions.DependencyInjection,
 * Autofac, SimpleInjector, Castle Windsor, etc.).
 *
 * Supported patterns:
 *   1. Constructor injection — the universal C# DI pattern:
 *
 *        public class OrderService {
 *            public OrderService(IPaymentRepository repo, IEmailService svc) { … }
 *        }
 *
 *   2. [Inject] / [AutoWire] property injection:
 *
 *        [Inject]
 *        public IPaymentRepository Repo { get; set; }
 */
export class CSharpStrategy extends DefaultStrategy implements LanguageStrategy {
  override extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    this._extractCSharpInheritance(node, classSymbol, addRel, file, ctx);
    this._extractCSharpDiRelationships(node, classSymbol, addRel, file, ctx);
  }

  override refineKind(
    kind: SymbolKind,
    name: string,
  ): SymbolKind {
    if (kind !== "class") return kind;
    const n = name.toLowerCase();
    if (n.endsWith("service")) return "service";
    if (n.endsWith("repository") || n.endsWith("repo")) return "repository";
    if (n.endsWith("controller")) return "controller";
    if (n.endsWith("event")) return "event";
    if (n.endsWith("handler") || n.endsWith("listener")) return "listener";
    if (n.endsWith("factory")) return "factory";
    if (n.endsWith("middleware")) return "middleware";
    if (n.endsWith("dto") || n.endsWith("request") || n.endsWith("response") || n.endsWith("viewmodel") || n.endsWith("vm")) return "dto";
    if (n.endsWith("entity") || n.endsWith("model")) return "entity";
    if (n.endsWith("command") || n.endsWith("query")) return "command";
    return kind;
  }

  private _extractCSharpInheritance(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    // base_list: ": BaseClass, IInterface1, IInterface2"
    const baseList = node.children.find((c) => c.type === "base_list");
    if (!baseList) return;

    for (const child of baseList.children) {
      if (child.type === "identifier" || child.type === "generic_name" || child.type === "qualified_name") {
        const name = extractCSharpTypeName(child);
        if (name) addRel(classSymbol.id, name, "inherits", file, node.startPosition.row + 1, ctx);
      }
    }
  }

  private _extractCSharpDiRelationships(
    classNode: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    const body = classNode.children.find((c) => c.type === "declaration_list");
    if (!body) return;

    for (const member of body.children) {
      // ── 1. Constructor injection ─────────────────────────────────────────────
      // constructor_declaration { name: ClassName, parameter_list: [...] }
      if (member.type === "constructor_declaration") {
        const paramList =
          member.childForFieldName("parameters") ??
          member.children.find((c) => c.type === "parameter_list");
        if (!paramList) continue;

        for (const param of paramList.children) {
          if (param.type !== "parameter") continue;

          const typeName = extractCSharpParamType(param, ctx);
          if (typeName) {
            addRel(classSymbol.id, typeName, "uses", file, param.startPosition.row + 1, ctx);
          }
        }
        continue;
      }

      // ── 2. Property injection via [Inject] / [AutoWire] attribute ───────────
      // attribute_list → attribute { name: "Inject" / "AutoWire" / ... }
      // property_declaration → type property_name ...
      if (member.type === "property_declaration") {
        const hasInjectAttr = hasCSharpInjectAttribute(member, body);
        if (!hasInjectAttr) continue;

        const typeNode =
          member.childForFieldName("type") ??
          member.children.find((c) =>
            c.type === "identifier" ||
            c.type === "generic_name" ||
            c.type === "qualified_name" ||
            c.type === "nullable_type" ||
            c.type === "predefined_type",
          );
        if (!typeNode) continue;

        const typeName = extractCSharpTypeName(typeNode);
        if (typeName) {
          addRel(classSymbol.id, typeName, "uses", file, member.startPosition.row + 1, ctx);
        }
      }
    }
  }
}

// ── C# DI helpers ─────────────────────────────────────────────────────────────

/**
 * C# built-in value types, keywords, and BCL primitives that are never
 * user-defined services and must not generate `uses` edges.
 */
const CSHARP_PRIMITIVES = new Set([
  // keywords / aliases
  "int", "uint", "long", "ulong", "short", "ushort",
  "byte", "sbyte", "float", "double", "decimal",
  "bool", "char", "string", "object", "void",
  "nint", "nuint",
  // BCL types that won't be app services
  "String", "Boolean", "Int32", "Int64", "Double", "Decimal",
  "Char", "Byte", "Object", "DateTime", "DateTimeOffset",
  "TimeSpan", "Guid", "Uri", "Version",
  "Task", "ValueTask", "CancellationToken",
  "IEnumerable", "IList", "ICollection", "IReadOnlyList",
  "IReadOnlyCollection", "IReadOnlyDictionary",
  "List", "Dictionary", "HashSet", "Queue", "Stack",
  "Array", "Span", "Memory", "ReadOnlySpan", "ReadOnlyMemory",
  "Action", "Func", "Predicate", "EventHandler",
  "Exception", "AggregateException",
  "IDisposable", "IAsyncDisposable",
]);

/** Attribute names (without []) that indicate property/constructor injection. */
const CSHARP_INJECT_ATTRS = /^(Inject|AutoWire|Autowired|FromServices|ServiceDependency)$/i;

/**
 * Extract the concrete type name from a C# `parameter` node.
 *
 * parameter:
 *   [modifier*] type identifier [= default]
 *
 * The "type" field may be: identifier, generic_name, qualified_name,
 * nullable_type, predefined_type, array_type, etc.
 */
function extractCSharpParamType(
  param: Parser.SyntaxNode,
  ctx?: ResolutionContext,
): string | null {
  const typeNode =
    param.childForFieldName("type") ??
    param.children.find((c) =>
      c.type !== "modifier" &&
      c.type !== "identifier" &&  // param name
      c.type !== "=" &&
      c.type !== "," &&
      !["this", "ref", "out", "in", "params"].includes(c.text),
    );

  if (!typeNode) return null;
  return extractCSharpTypeName(typeNode, ctx);
}

/**
 * Recursively extract the user-defined type name from common C# type nodes.
 */
function extractCSharpTypeName(
  typeNode: Parser.SyntaxNode,
  ctx?: ResolutionContext,
): string | null {
  switch (typeNode.type) {
    case "identifier": {
      const name = typeNode.text;
      if (!name || CSHARP_PRIMITIVES.has(name)) return null;
      if (ctx?.imports?.has(name)) return ctx.imports.get(name)!;
      return name;
    }

    case "qualified_name": {
      // Namespace.TypeName — use last segment as the short name for lookup,
      // but emit the full name for the graph
      const name = typeNode.text;
      if (!name) return null;
      return name;
    }

    case "generic_name": {
      // Generic<T> — the service is the generic wrapper itself
      // e.g. IRepository<Order>, IOptions<AppSettings>
      // For common generic BCL interfaces, unwrap to the type argument
      const nameNode = typeNode.childForFieldName("identifier") ?? typeNode.children[0];
      const baseName = nameNode?.text ?? "";

      // Well-known wrappers where the inner type is the real service
      const UNWRAP_GENERICS = new Set(["Lazy", "IOptions", "IOptionsSnapshot", "IOptionsMonitor"]);
      if (UNWRAP_GENERICS.has(baseName)) {
        const typeArgs = typeNode.children.find(
          (c) => c.type === "type_argument_list",
        );
        const innerType = typeArgs?.children.find(
          (c) => c.type !== "<" && c.type !== ">" && c.type !== ",",
        );
        if (innerType) return extractCSharpTypeName(innerType, ctx);
      }

      if (CSHARP_PRIMITIVES.has(baseName)) return null;
      return baseName || null;
    }

    case "nullable_type": {
      // T? — extract inner type
      const inner = typeNode.children.find(
        (c) => c.type !== "?" && c.type !== "nullable_type",
      );
      return inner ? extractCSharpTypeName(inner, ctx) : null;
    }

    case "predefined_type":
      // int, string, bool, etc. — always skip
      return null;

    case "array_type":
      // Service[] — the element type is the service
      return extractCSharpTypeName(typeNode.children[0], ctx);

    default:
      return null;
  }
}

/**
 * Check whether a property_declaration is preceded by an inject-style
 * attribute within the same class body.
 */
function hasCSharpInjectAttribute(
  propNode: Parser.SyntaxNode,
  bodyNode: Parser.SyntaxNode,
): boolean {
  // In C#, attributes appear as attribute_list siblings BEFORE the member
  const propIndex = bodyNode.children.indexOf(propNode);
  if (propIndex <= 0) return false;

  const prev = bodyNode.children[propIndex - 1];
  if (prev?.type !== "attribute_list") return false;

  // attribute_list contains one or more `attribute` nodes
  return prev.children.some(
    (c) => c.type === "attribute" && CSHARP_INJECT_ATTRS.test(
      c.childForFieldName("name")?.text ?? c.children[0]?.text ?? "",
    ),
  );
}
