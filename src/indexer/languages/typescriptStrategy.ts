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

    // ── Dependency Injection: constructor parameter types ───────────────────
    // Handles tsyringe @injectable/@inject, NestJS @Injectable/@Inject,
    // InversifyJS @injectable/@inject, and plain TypeScript constructor DI.
    //
    // Patterns captured:
    //   constructor(@inject(TOKEN) private repo: PaymentRepository) {}
    //   constructor(private email: EmailService) {}
    //   @inject(TOKEN) private repo: PaymentRepository;  (property injection)
    this._extractDiRelationships(node, classSymbol, addRel, file);
  }

  /**
   * Extract dependency injection relationships from a class node.
   *
   * Walks constructor parameters and injected properties, resolving
   * type annotations to `uses` relationships so the knowledge graph
   * correctly reflects runtime DI wiring — even when no `new X()` call exists.
   */
  private _extractDiRelationships(
    classNode: Parser.SyntaxNode,
    classSymbol: CodeSymbol,
    addRel: AddRelFn,
    file: string,
  ): void {
    const body = classNode.children.find((c) => c.type === "class_body");
    if (!body) return;

    for (const member of body.children) {
      // ── 1. Constructor parameter injection ────────────────────────────────
      // method_definition { name: "constructor", formal_parameters: [...] }
      if (
        member.type === "method_definition" &&
        member.childForFieldName("name")?.text === "constructor"
      ) {
        const params = member.childForFieldName("parameters");
        if (!params) continue;

        for (const param of params.children) {
          // required_parameter | optional_parameter | assignment_pattern
          if (
            param.type !== "required_parameter" &&
            param.type !== "optional_parameter" &&
            param.type !== "assignment_pattern"
          ) {
            continue;
          }

          // Extract type from type_annotation node
          const typeName = extractTypeAnnotation(param);
          if (typeName) {
            addRel(classSymbol.id, typeName, "uses", file, param.startPosition.row + 1);
          }

          // Also capture @inject(TOKEN) / @Inject(TOKEN) decorator arguments.
          // These may be symbols (constants, enums) — register as `uses` too.
          for (const decorator of param.children.filter((c) => c.type === "decorator")) {
            const tokenName = extractDecoratorArgument(decorator);
            if (tokenName) {
              addRel(classSymbol.id, tokenName, "uses", file, decorator.startPosition.row + 1);
            }
          }
        }
      }

      // ── 2. Property injection ──────────────────────────────────────────────
      // public_field_definition decorated with @inject / @Inject / @Autowired
      if (
        member.type === "public_field_definition" ||
        member.type === "field_definition"
      ) {
        const hasInjectDecorator = member.children.some(
          (c) => c.type === "decorator" && DI_DECORATOR_NAMES.test(c.text),
        );
        if (!hasInjectDecorator) continue;

        const typeName = extractTypeAnnotation(member);
        if (typeName) {
          addRel(classSymbol.id, typeName, "uses", file, member.startPosition.row + 1);
        }

        // Capture TOKEN from @inject(TOKEN)
        for (const decorator of member.children.filter((c) => c.type === "decorator")) {
          const tokenName = extractDecoratorArgument(decorator);
          if (tokenName) {
            addRel(classSymbol.id, tokenName, "uses", file, decorator.startPosition.row + 1);
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

// ── DI helper constants & functions ──────────────────────────────────────────

/**
 * Decorator names that signal dependency injection.
 * Covers tsyringe, NestJS, InversifyJS, Angular, and custom variants.
 */
const DI_DECORATOR_NAMES = /^@(inject|Inject|Autowired|InjectRepository|InjectQueue|InjectModel)\b/i;

/**
 * Primitive TypeScript types that should never be treated as DI dependencies.
 * Avoids false positives like `constructor(private count: number)`.
 */
const PRIMITIVE_TYPES = new Set([
  "string", "number", "boolean", "bigint", "symbol", "null", "undefined",
  "any", "unknown", "never", "void", "object", "Function",
  "String", "Number", "Boolean", "Object", "Array", "Promise",
  "Map", "Set", "WeakMap", "WeakSet", "Date", "Error", "RegExp",
]);

/**
 * Extract the type identifier name from a parameter or field node.
 *
 * Handles:
 *   param: TypeName                    → "TypeName"
 *   param: TypeName | null             → "TypeName"  (left side of union)
 *   param?: TypeName                   → "TypeName"
 *   param: TypeName<GenericArg>        → "TypeName"  (strips generic)
 */
function extractTypeAnnotation(node: Parser.SyntaxNode): string | null {
  const typeAnnotation = node.children.find((c) => c.type === "type_annotation");
  if (!typeAnnotation) return null;

  // type_annotation has a ":" then the actual type node
  const typeNode = typeAnnotation.children.find(
    (c) =>
      c.type === "type_identifier" ||
      c.type === "identifier" ||
      c.type === "generic_type" ||
      c.type === "union_type" ||
      c.type === "predefined_type",
  );
  if (!typeNode) return null;

  let typeName: string;

  if (typeNode.type === "generic_type") {
    // SomeService<T> → take only the base name
    const base = typeNode.childForFieldName("name") ?? typeNode.children[0];
    typeName = base?.text ?? typeNode.text;
  } else if (typeNode.type === "union_type") {
    // ServiceType | null → take the first non-null member
    const first = typeNode.children.find(
      (c) => c.type === "type_identifier" || c.type === "identifier",
    );
    typeName = first?.text ?? "";
  } else {
    typeName = typeNode.text;
  }

  // Skip primitives and built-ins — they are never DI tokens
  if (!typeName || PRIMITIVE_TYPES.has(typeName)) return null;

  return typeName;
}

/**
 * Extract the argument name from an `@inject(TOKEN)` / `@Inject(TOKEN)` decorator.
 *
 * Handles:
 *   @inject(PAYMENT_REPOSITORY)      → "PAYMENT_REPOSITORY"
 *   @inject("paymentRepository")     → "paymentRepository"
 *   @Inject(PaymentRepository)       → "PaymentRepository"
 *   @Injectable()                    → null  (no argument to extract)
 */
function extractDecoratorArgument(decoratorNode: Parser.SyntaxNode): string | null {
  // Decorator text must match the DI pattern
  if (!DI_DECORATOR_NAMES.test(decoratorNode.text)) return null;

  const callExpr = decoratorNode.children.find((c) => c.type === "call_expression");
  if (!callExpr) return null;

  const args = callExpr.childForFieldName("arguments");
  if (!args) return null;

  const firstArg = args.namedChildren[0];
  if (!firstArg) return null;

  // String literal: @inject("myService")
  if (firstArg.type === "string" || firstArg.type === "string_literal") {
    return firstArg.text.replace(/^["'`]|["'`]$/g, "") || null;
  }

  // Identifier or member expression: @inject(MY_TOKEN) or @inject(Tokens.Payment)
  if (
    firstArg.type === "identifier" ||
    firstArg.type === "member_expression" ||
    firstArg.type === "type_identifier"
  ) {
    return firstArg.text || null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

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
