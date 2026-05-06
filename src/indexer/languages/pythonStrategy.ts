import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind } from "../symbol.types.js";
import type { ResolutionContext } from "../relationshipExtractor.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";
import { DefaultStrategy } from "./defaultStrategy.js";

/**
 * Python language strategy.
 *
 * Extends DefaultStrategy with DI-aware relationship extraction:
 * scans typed `__init__` parameters and `@inject`-decorated properties
 * to emit `uses` edges for auto-wired dependencies.
 *
 * Supported patterns:
 *   1. Constructor injection (most common, works with injector, python-inject,
 *      dependencies, punq, etc.):
 *
 *        class OrderService:
 *            def __init__(self, repo: PaymentRepository, svc: EmailService):
 *
 *   2. Class-variable type annotation injection (lagom, kink, etc.):
 *
 *        class OrderService:
 *            repo: PaymentRepository  # resolved by container
 *
 *   3. @inject / @Inject / @injectable decorated `__init__` params (same
 *      syntax, but explicit decorator confirms DI intent)
 */
export class PythonStrategy extends DefaultStrategy implements LanguageStrategy {
  override extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    this._extractPythonDiRelationships(node, classSymbol, addRel, file, ctx);
  }

  override refineKind(
    kind: SymbolKind,
    name: string,
  ): SymbolKind {
    if (kind !== "class") return kind;
    const n = name.toLowerCase();
    if (n.endsWith("service")) return "service";
    if (n.endsWith("repository") || n.endsWith("repo")) return "repository";
    if (n.endsWith("controller") || n.endsWith("view")) return "controller";
    if (n.endsWith("event")) return "event";
    if (n.endsWith("listener") || n.endsWith("handler") || n.endsWith("subscriber")) return "listener";
    if (n.endsWith("factory")) return "factory";
    if (n.endsWith("middleware")) return "middleware";
    if (n.endsWith("dto") || n.endsWith("schema") || n.endsWith("serializer")) return "dto";
    if (n.endsWith("entity") || n.endsWith("model")) return "entity";
    if (n.endsWith("command") || n.endsWith("usecase") || n.endsWith("use_case")) return "command";
    return kind;
  }

  private _extractPythonDiRelationships(
    classNode: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    const body = classNode.children.find((c) => c.type === "block");
    if (!body) return;

    for (const member of body.children) {
      // ── 1. Constructor injection ─────────────────────────────────────────────
      // function_definition { name: "__init__", parameters: ... }
      if (
        member.type === "function_definition" &&
        member.childForFieldName("name")?.text === "__init__"
      ) {
        const params =
          member.childForFieldName("parameters") ??
          member.children.find((c) => c.type === "parameters");
        if (!params) continue;

        for (const param of params.children) {
          // typed_parameter: identifier ":" type
          // identifier ":" type  (tree-sitter also emits typed_parameter)
          if (param.type !== "typed_parameter" && param.type !== "typed_default_parameter") {
            continue;
          }

          const typeName = extractPythonType(param, ctx);
          if (typeName) {
            addRel(classSymbol.id, typeName, "uses", file, param.startPosition.row + 1, ctx);
          }
        }
        continue;
      }

      // ── 2. Class-level annotated assignments (annotation injection) ──────────
      // expression_statement → assignment / annotated_assignment
      // OR directly: typed_parameter at class body level
      if (member.type === "expression_statement") {
        const inner = member.children[0];
        if (inner?.type === "assignment" || inner?.type === "augmented_assignment") continue; // bare assignment, skip
      }

      // annotated_assignment: `repo: PaymentRepository` or `repo: PaymentRepository = ...`
      if (member.type === "expression_statement") {
        const inner = member.children[0];
        if (inner?.type === "annotated_assignment") {
          const annotation = inner.childForFieldName("type") ?? inner.children[1];
          const typeName = annotationToTypeName(annotation, ctx);
          if (typeName) {
            addRel(classSymbol.id, typeName, "uses", file, member.startPosition.row + 1, ctx);
          }
        }
      }
    }
  }
}

// ── Python DI helpers ─────────────────────────────────────────────────────────

const PYTHON_PRIMITIVES = new Set([
  "int", "float", "str", "bool", "bytes", "bytearray",
  "list", "dict", "tuple", "set", "frozenset",
  "None", "NoneType", "Any", "Optional", "Union",
  "Type", "ClassVar", "Final", "Literal",
  "Callable", "Awaitable", "Coroutine", "AsyncGenerator", "Generator",
  "Iterator", "Iterable", "AsyncIterator", "AsyncIterable",
  "Sequence", "MutableSequence", "Mapping", "MutableMapping",
  "IO", "TextIO", "BinaryIO",
  "object", "type", "super",
  // common typing / annotation helpers
  "Self", "Never", "LiteralString", "TypeVar", "ParamSpec",
  "overload", "cast", "no_type_check", "runtime_checkable",
]);

/**
 * Extract user-defined type name from a tree-sitter-python `typed_parameter`
 * or `typed_default_parameter` node.
 *
 * typed_parameter:
 *   identifier ":" type_expression
 *
 * type_expression may be:
 *   - identifier                 → "PaymentRepository"
 *   - attribute                  → "services.PaymentRepository"
 *   - subscript                  → "Optional[PaymentRepository]"  ← unwrap
 *   - binary_operator (|)        → Python 3.10 union  ← take first operand
 *   - string (forward ref)       → skip (can't resolve statically)
 */
function extractPythonType(
  param: Parser.SyntaxNode,
  ctx?: ResolutionContext,
): string | null {
  // The type annotation is the child after the identifier and ":"
  // In tree-sitter-python, typed_parameter children:
  //   [0] identifier (param name), [1] ":", [2] type expression
  //   OR field "type" in some grammar versions
  const typeNode =
    param.childForFieldName("type") ??
    param.children.find((c, i) => i > 0 && c.type !== ":" && c.type !== "identifier" && c.type !== ",");

  if (!typeNode) return null;

  return annotationToTypeName(typeNode, ctx);
}

function annotationToTypeName(
  typeNode: Parser.SyntaxNode | undefined | null,
  ctx?: ResolutionContext,
): string | null {
  if (!typeNode) return null;

  // Direct identifier: PaymentRepository
  if (typeNode.type === "identifier") {
    const name = typeNode.text;
    if (!name || PYTHON_PRIMITIVES.has(name) || name === "self" || name === "cls") return null;
    return resolveImport(name, ctx);
  }

  // Attribute access: services.PaymentRepository
  if (typeNode.type === "attribute") {
    const name = typeNode.text;
    return resolveImport(name, ctx);
  }

  // Subscript: Optional[T], List[T], Union[T, ...] etc. — unwrap
  if (typeNode.type === "subscript") {
    // First child is the generic name, second is the slice / subscript
    const base = typeNode.childForFieldName("value") ?? typeNode.children[0];
    const baseText = base?.text ?? "";
    // For Optional[X] — unwrap to X
    if (baseText === "Optional" || baseText === "typing.Optional") {
      const sliceNode =
        typeNode.childForFieldName("subscript") ??
        typeNode.children.find((c) => c.type !== "identifier" && c.type !== "[" && c.type !== "]");
      return annotationToTypeName(sliceNode ?? null, ctx);
    }
    // For Union[X, Y, ...] — take first non-None arg
    if (baseText === "Union" || baseText === "typing.Union") {
      const sliceNode =
        typeNode.childForFieldName("subscript") ??
        typeNode.children.find((c) => c.type === "tuple" || c.type === "argument_list");
      if (sliceNode) {
        for (const child of sliceNode.children) {
          const result = annotationToTypeName(child, ctx);
          if (result) return result;
        }
      }
      return null;
    }
    // For other generics (List[X], Sequence[X], etc.), the service is usually the base
    if (!PYTHON_PRIMITIVES.has(baseText)) return resolveImport(baseText, ctx);
    return null;
  }

  // Python 3.10 union: X | Y — take first non-None side
  if (typeNode.type === "binary_operator") {
    const left = typeNode.childForFieldName("left") ?? typeNode.children[0];
    const leftResult = annotationToTypeName(left, ctx);
    if (leftResult) return leftResult;
    const right = typeNode.childForFieldName("right") ?? typeNode.children[2];
    return annotationToTypeName(right, ctx);
  }

  return null;
}

function resolveImport(name: string, ctx?: ResolutionContext): string | null {
  if (!name || PYTHON_PRIMITIVES.has(name)) return null;
  // ctx.imports maps short name → full module path (populated from `from X import Y`)
  if (ctx?.imports?.has(name)) return ctx.imports.get(name)!;
  return name;
}
