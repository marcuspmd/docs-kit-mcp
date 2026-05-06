import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolKind } from "../symbol.types.js";
import type { ResolutionContext } from "../relationshipExtractor.js";
import type { AddRelFn, LanguageStrategy } from "./languageStrategy.js";
import { DefaultStrategy } from "./defaultStrategy.js";

/**
 * Go language strategy.
 *
 * Extends DefaultStrategy with DI-aware relationship extraction for Go's
 * primary DI patterns: Wire, fx (uber-go/fx), and dig.
 *
 * Go has no classes — DI is expressed through:
 *
 *   1. **Struct fields** (fx.In embedding):
 *
 *        type OrderHandler struct {
 *            fx.In
 *            Repo    PaymentRepository
 *            Email   EmailService
 *        }
 *
 *   2. **Constructor / provider functions** (Wire providers, fx.Provide):
 *
 *        func NewOrderService(repo PaymentRepository, svc EmailService) *OrderService {
 *            return &OrderService{repo: repo, svc: svc}
 *        }
 *
 *   3. **Interface satisfaction** — struct implements interface implicitly
 *      (Go structural typing); tracked via method sets (future work).
 *
 * Strategy: for each struct, emit `uses` edges from the struct symbol to
 * the types of its exported (or fx.In-tagged) fields.
 * For constructor functions (pattern 2), emit `uses` from the *returned*
 * struct type to every parameter type.
 */
export class GoStrategy extends DefaultStrategy implements LanguageStrategy {
  override extractClassRelationships(
    node: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    if (node.type !== "type_declaration" && node.type !== "type_spec") return;

    // Navigate to the struct_type node
    const structType = findStructType(node);
    if (!structType) return;

    const hasFxIn = structHasFxIn(structType);

    const fieldList = structType.children.find((c) => c.type === "field_declaration_list");
    if (!fieldList) return;

    for (const field of fieldList.children) {
      if (field.type !== "field_declaration") continue;

      // Only collect typed fields (skip embedded type declarations like `fx.In`)
      const typeNode = field.childForFieldName("type") ?? getFieldTypeNode(field);
      if (!typeNode) continue;

      const typeName = extractGoType(typeNode, ctx);
      if (!typeName) continue;

      // Skip the fx.In embedding itself
      if (typeName === "fx.In" || typeName === "In") continue;

      // For non-fx.In structs, only track exported fields (start with uppercase)
      // and pointer-to-service fields
      if (!hasFxIn) {
        const fieldNames = field.children.filter((c) => c.type === "field_identifier");
        const isExported = fieldNames.some((n) => /^[A-Z]/.test(n.text));
        if (!isExported) continue;
      }

      addRel(classSymbol.id, typeName, "uses", file, field.startPosition.row + 1, ctx);
    }
  }

  override refineKind(
    kind: SymbolKind,
    name: string,
  ): SymbolKind {
    if (kind !== "class") return kind;
    const n = name.toLowerCase();
    if (n.endsWith("service")) return "service";
    if (n.endsWith("repository") || n.endsWith("repo") || n.endsWith("store")) return "repository";
    if (n.endsWith("handler") || n.endsWith("controller")) return "controller";
    if (n.endsWith("event")) return "event";
    if (n.endsWith("listener") || n.endsWith("subscriber")) return "listener";
    if (n.endsWith("factory")) return "factory";
    if (n.endsWith("middleware")) return "middleware";
    if (n.endsWith("dto") || n.endsWith("request") || n.endsWith("response")) return "dto";
    if (n.endsWith("entity") || n.endsWith("model")) return "entity";
    if (n.endsWith("command") || n.endsWith("query")) return "command";
    return kind;
  }

  /**
   * Extract DI edges from Wire/fx constructor (provider) functions.
   *
   * Called externally by the relationship extractor on each top-level
   * function_declaration node.
   */
  extractProviderFunctionRelationships(
    node: Parser.SyntaxNode,
    symsInFile: CodeSymbol[],
    addRel: AddRelFn,
    file: string,
    ctx?: ResolutionContext,
  ): void {
    if (node.type !== "function_declaration") return;

    const funcName = node.childForFieldName("name")?.text ?? "";
    // Wire/fx convention: provider functions start with "New" or "Provide"
    if (!/^(New|Provide)[A-Z]/.test(funcName)) return;

    // Return type: should be *StructType or (StructType, error)
    const resultNode = node.childForFieldName("result") ?? node.children.find(
      (c) => c.type === "type_identifier" || c.type === "pointer_type" || c.type === "parameter_list",
    );
    const returnedType = resultNode ? extractGoType(resultNode, ctx) : null;
    if (!returnedType) return;

    // Find the symbol for the returned struct
    const returnedSymbol = symsInFile.find((s) => s.name === returnedType || s.name.endsWith(`.${returnedType}`));
    if (!returnedSymbol) return;

    // Walk parameter list
    const paramList = node.childForFieldName("parameters");
    if (!paramList) return;

    for (const param of paramList.children) {
      if (param.type !== "parameter_declaration") continue;
      const typeNode = param.childForFieldName("type") ?? getFieldTypeNode(param);
      if (!typeNode) continue;

      const typeName = extractGoType(typeNode, ctx);
      if (typeName) {
        addRel(returnedSymbol.id, typeName, "uses", file, param.startPosition.row + 1, ctx);
      }
    }
  }
}

// ── Go DI helpers ─────────────────────────────────────────────────────────────

const GO_PRIMITIVES = new Set([
  "bool", "byte", "complex64", "complex128",
  "error", "float32", "float64",
  "int", "int8", "int16", "int32", "int64",
  "rune", "string",
  "uint", "uint8", "uint16", "uint32", "uint64", "uintptr",
  // Common built-in interfaces / types that aren't user services
  "any", "comparable",
  "context.Context", "Context",
  "io.Reader", "io.Writer", "io.Closer", "io.ReadWriter",
  "io.ReadCloser", "io.WriteCloser",
  "http.Handler", "http.ResponseWriter",
  "sql.DB", "sql.Tx",
]);

function extractGoType(
  typeNode: Parser.SyntaxNode,
  ctx?: ResolutionContext,
): string | null {
  if (!typeNode) return null;

  switch (typeNode.type) {
    case "type_identifier": {
      const name = typeNode.text;
      if (!name || GO_PRIMITIVES.has(name)) return null;
      // ctx.imports maps alias → package path (from import block)
      // For local types, just return the name
      return resolveGoImport(name, ctx);
    }

    case "qualified_type": {
      // pkg.TypeName
      return typeNode.text || null;
    }

    case "pointer_type": {
      // *TypeName — unwrap to the base type
      const inner = typeNode.children.find(
        (c) => c.type !== "*" && c.type !== "pointer_type",
      );
      return inner ? extractGoType(inner, ctx) : null;
    }

    case "slice_type":
    case "array_type": {
      // []TypeName — the element type
      const elemType = typeNode.childForFieldName("element") ?? typeNode.children.find(
        (c) => c.type !== "[" && c.type !== "]" && c.type !== "int_literal",
      );
      return elemType ? extractGoType(elemType, ctx) : null;
    }

    case "map_type":
      // map[K]V — typically not a service itself
      return null;

    case "interface_type":
      // Inline interface — not a named type
      return null;

    case "channel_type":
      // chan T — not a service
      return null;

    case "generic_type": {
      // TypeName[T] — take the base type name
      const base = typeNode.children[0];
      return base ? extractGoType(base, ctx) : null;
    }

    default:
      return null;
  }
}

/** Check whether a struct_type contains an `fx.In` embedded field. */
function structHasFxIn(structType: Parser.SyntaxNode): boolean {
  const fieldList = structType.children.find((c) => c.type === "field_declaration_list");
  if (!fieldList) return false;
  return fieldList.children.some((field) => {
    if (field.type !== "field_declaration") return false;
    // Embedded field: no field_identifier, just a type node
    const text = field.text.trim();
    return text === "fx.In" || text === "dig.In";
  });
}

/** Navigate from a type_declaration/type_spec node to struct_type. */
function findStructType(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  if (node.type === "struct_type") return node;

  // type_declaration → type_spec → struct_type
  for (const child of node.children) {
    const found = findStructType(child);
    if (found) return found;
  }
  return null;
}

/**
 * Get the type node from a field_declaration or parameter_declaration.
 * In Go's grammar these share the pattern: [names] type [tag].
 * The type is typically the last child before an optional string literal (tag).
 */
function getFieldTypeNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  const children = node.children.filter(
    (c) => c.type !== "field_identifier" && c.type !== "identifier" &&
            c.type !== "," && c.type !== "raw_string_literal" && c.type !== "interpreted_string_literal",
  );
  return children[children.length - 1] ?? null;
}

function resolveGoImport(name: string, ctx?: ResolutionContext): string | null {
  if (!name || GO_PRIMITIVES.has(name)) return null;
  if (ctx?.imports?.has(name)) return ctx.imports.get(name)!;
  return name;
}
