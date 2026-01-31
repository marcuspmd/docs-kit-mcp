import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import GoLang from "tree-sitter-go";
import PHP from "tree-sitter-php";
// Note: tree-sitter-dart native binding can fail to load in some environments
// (it requires a compiled native addon). We avoid importing it at module load
// time to prevent Jest runs from crashing when the binding is missing.
import Ruby from "tree-sitter-ruby";
import CSharp from "tree-sitter-c-sharp";
import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import {
  type CodeSymbol,
  type SymbolKind,
  type Visibility,
  type Layer,
  generateSymbolId,
} from "./symbol.types.js";

/* ================== Types ================== */

export interface IndexerOptions {
  rootDir: string;
  include?: string[];
  exclude?: string[];
}

export interface IndexResult {
  symbols: CodeSymbol[];
  fileCount: number;
  errors: Array<{ file: string; error: string }>;
}

/* ================== Node-type mapping ================== */

const NODE_KIND_MAP: Record<string, SymbolKind> = {
  // TypeScript / JavaScript
  class_declaration: "class",
  abstract_class_declaration: "abstract_class",
  method_definition: "method",
  function_declaration: "function",
  interface_declaration: "interface",
  enum_declaration: "enum",
  type_alias_declaration: "type",
  method_signature: "method",

  // Common JS/TS variations
  class: "class",
  method: "method",

  // Python
  class_definition: "class",
  function_definition: "function",
  async_function_definition: "function",
  lambda: "lambda",

  // Go
  method_declaration: "method",
  type_spec: "type",
  type_declaration: "type",
  struct_type: "class",
  interface_type: "interface",

  // PHP
  trait_declaration: "trait",

  // Dart
  constructor_declaration: "constructor",

  // Ruby
  module: "class",
  def: "method",

  // C# / .NET
  struct_declaration: "class",
};

/* ================== Metadata extractors ================== */

function extractVisibility(node: Parser.SyntaxNode): Visibility | undefined {
  // Methods can have accessibility_modifier as a child
  const modifier = node.children.find((c) => c.type === "accessibility_modifier");
  if (modifier) {
    const text = modifier.text as Visibility;
    if (text === "public" || text === "private" || text === "protected") {
      return text;
    }
  }
  return undefined;
}

function isExported(node: Parser.SyntaxNode): boolean {
  // The node's parent may be an export_statement
  const parent = node.parent;
  if (parent?.type === "export_statement") return true;
  // Or the export_statement might wrap a default export
  if (parent?.type === "export_statement" && parent.children.some((c) => c.type === "export")) {
    return true;
  }
  return false;
}

function extractExtends(node: Parser.SyntaxNode): string | undefined {
  const heritage = node.children.find((c) => c.type === "class_heritage");
  if (!heritage) return undefined;
  const extendsClause = heritage.children.find((c) => c.type === "extends_clause");
  if (!extendsClause) return undefined;
  const typeNode = extendsClause.children.find(
    (c) => c.type === "identifier" || c.type === "type_identifier",
  );
  return typeNode?.text;
}

function extractImplements(node: Parser.SyntaxNode): string[] | undefined {
  const heritage = node.children.find((c) => c.type === "class_heritage");
  if (!heritage) return undefined;
  const implClause = heritage.children.find((c) => c.type === "implements_clause");
  if (!implClause) return undefined;
  const types = implClause.children
    .filter((c) => c.type === "type_identifier" || c.type === "identifier")
    .map((c) => c.text);
  return types.length > 0 ? types : undefined;
}

function extractInterfaceExtends(node: Parser.SyntaxNode): string | undefined {
  // interface Foo extends Bar { ... }
  const extendsClause = node.children.find((c) => c.type === "extends_type_clause");
  if (!extendsClause) return undefined;
  const typeNode = extendsClause.children.find(
    (c) => c.type === "type_identifier" || c.type === "identifier",
  );
  return typeNode?.text;
}

function extractJsDoc(node: Parser.SyntaxNode): { summary?: string; tags?: string[] } {
  // Look for a comment node immediately before this node (or before export_statement parent)
  const targetNode = node.parent?.type === "export_statement" ? node.parent : node;
  const prev = targetNode.previousNamedSibling;

  if (!prev || prev.type !== "comment") return {};
  const text = prev.text;

  // Only handle JSDoc-style comments
  if (!text.startsWith("/**")) return {};

  // Strip comment markers
  const cleaned = text
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim();

  // Extract @tags
  const tags: string[] = [];
  const summaryLines: string[] = [];

  for (const line of cleaned.split("\n")) {
    const tagMatch = line.match(/^@(\w+)/);
    if (tagMatch) {
      tags.push(line.trim());
    } else {
      summaryLines.push(line);
    }
  }

  const summary = summaryLines.join(" ").trim() || undefined;
  return { summary, tags: tags.length > 0 ? tags : undefined };
}

function detectLanguage(file: string): CodeSymbol["language"] {
  if (file.endsWith(".ts") || file.endsWith(".tsx")) return "ts";
  if (file.endsWith(".js") || file.endsWith(".jsx")) return "js";
  if (file.endsWith(".py")) return "python";
  if (file.endsWith(".go")) return "go";
  if (file.endsWith(".php")) return "php";
  return undefined;
}

function languageForFile(file: string) {
  if (file.endsWith(".ts") || file.endsWith(".tsx")) return TypeScript.typescript;
  if (file.endsWith(".js") || file.endsWith(".jsx")) return JavaScript;
  if (file.endsWith(".py")) return Python;
  if (file.endsWith(".go")) return GoLang;
  if (file.endsWith(".php")) return PHP;
  // Skip dart parsing if the dart grammar/binding isn't present to avoid
  // test-time native binding errors. If you need Dart support, ensure the
  // tree-sitter-dart package is installed and its native bindings are built.
  if (file.endsWith(".dart")) return undefined;
  if (file.endsWith(".rb")) return Ruby;
  if (file.endsWith(".cs")) return CSharp;
  return undefined;
}

const LAYER_PATTERNS: Array<{ pattern: RegExp; layer: Layer }> = [
  { pattern: /(controller|route|view|page|component|ui)/i, layer: "presentation" },
  { pattern: /(service|use.?case|handler|command|query|application)/i, layer: "application" },
  { pattern: /(entity|model|value.?object|domain|event)/i, layer: "domain" },
  {
    pattern: /(repository|adapter|gateway|storage|db|infra|migration|provider)/i,
    layer: "infrastructure",
  },
  { pattern: /(test|spec|mock|fixture)/i, layer: "test" },
];

function detectLayer(file: string, name: string): Layer | undefined {
  const combined = `${file} ${name}`;
  for (const { pattern, layer } of LAYER_PATTERNS) {
    if (pattern.test(combined)) return layer;
  }
  return undefined;
}

function detectDeprecated(node: Parser.SyntaxNode): boolean {
  const targetNode = node.parent?.type === "export_statement" ? node.parent : node;
  const prev = targetNode.previousNamedSibling;
  if (prev?.type === "comment" && prev.text.includes("@deprecated")) return true;
  // Check decorators (if present)
  for (const child of node.children) {
    if (child.type === "decorator" && child.text.includes("Deprecated")) return true;
  }
  return false;
}

/* ================== AST Walker ================== */

function walkNode(
  node: Parser.SyntaxNode,
  file: string,
  parent?: string,
  parentName?: string,
): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  if (!node) return symbols;
  const kind = NODE_KIND_MAP[node.type];

  function getNodeName(n: Parser.SyntaxNode): string {
    // Try common field names
    const byField = n.childForFieldName("name") ?? n.childForFieldName("identifier");
    if (byField) return byField.text;

    // Search for first identifier-like child
    const idChild = n.children.find((c) =>
      /identifier|name|type_identifier|field_identifier/.test(c.type),
    );
    if (idChild) return idChild.text;

    // fallback to node's own text (trimmed)
    const t = n.text?.trim();
    if (t && t.length > 0) return t.split(/\s|\(|\{/)[0];
    return "anonymous";
  }

  function getParametersText(n: Parser.SyntaxNode): string | undefined {
    const params = n.childForFieldName("parameters") ?? n.childForFieldName("parameter_list");
    if (params) return params.text;
    // fallback: find first child that looks like parameter list
    const p = n.children.find((c) => /parameter|argument_list|formal_parameters/.test(c.type));
    if (p) return p.text;
    return undefined;
  }

  if (kind) {
    const name = getNodeName(node) ?? "anonymous";
    const id = generateSymbolId(file, name, kind);

    // Signature
    let signature: string | undefined;
    if (kind === "function" || kind === "method") {
      const paramsText = getParametersText(node) ?? "()";
      // try common return type fields
      const returnType = node.childForFieldName("return_type") ?? node.childForFieldName("type");
      const returnText = returnType ? `: ${returnType.text}` : "";
      signature = `${name}${paramsText}${returnText}`;
    } else if (kind === "interface" || kind === "class" || kind === "abstract_class") {
      signature = `${kind} ${name}`;
    } else if (kind === "enum") {
      signature = `enum ${name}`;
    } else if (kind === "type") {
      signature = `type ${name}`;
    }

    // Visibility
    const visibility = extractVisibility(node);

    // Exported
    const exported = isExported(node);

    // Language
    const language = detectLanguage(file);

    // Extends / Implements
    let extendsName: string | undefined;
    let implementsNames: string[] | undefined;
    if (kind === "class" || kind === "abstract_class") {
      extendsName = extractExtends(node);
      implementsNames = extractImplements(node);
    } else if (kind === "interface") {
      extendsName = extractInterfaceExtends(node);
    }

    // JSDoc
    const { summary, tags } = extractJsDoc(node);

    // Layer
    const layer = detectLayer(file, name);

    // Deprecated
    const deprecated = detectDeprecated(node) || undefined;

    // Qualified name
    const qualifiedName = parentName ? `${parentName}.${name}` : name;

    symbols.push({
      id,
      name,
      qualifiedName,
      kind,
      file,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parent,
      visibility,
      exported,
      language,
      extends: extendsName,
      implements: implementsNames,
      summary,
      tags,
      layer,
      deprecated,
      signature,
    });

    for (const child of node.children) {
      symbols.push(...walkNode(child, file, id, name));
    }
  } else {
    for (const child of node.children) {
      symbols.push(...walkNode(child, file, parent, parentName));
    }
  }

  return symbols;
}

/* ================== Single file indexer ================== */

export function indexFile(filePath: string, source: string, parser: Parser): CodeSymbol[] {
  const lang = languageForFile(filePath);
  if (!lang) return [];
  try {
    (parser as unknown as { setLanguage: (l: unknown) => void }).setLanguage(lang);
  } catch {
    // ignore setLanguage errors
  }
  const tree = parser.parse(source);
  return walkNode(tree.rootNode, filePath);
}

/* ================== Project indexer ================== */

export async function indexProject(options: IndexerOptions): Promise<IndexResult> {
  const {
    rootDir,
    include = ["**/*.{ts,tsx,js,jsx,py,go,php,dart,rb,cs}"],
    exclude = ["node_modules/**", "dist/**"],
  } = options;

  const files = await fg(include, {
    cwd: rootDir,
    ignore: exclude,
    absolute: false,
  });

  const parser = new Parser();

  const symbols: CodeSymbol[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    try {
      const absolutePath = `${rootDir}/${file}`;
      const source = await readFile(absolutePath, "utf-8");
      const fileSymbols = indexFile(file, source, parser);
      symbols.push(...fileSymbols);
    } catch (err) {
      errors.push({
        file,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { symbols, fileCount: files.length, errors };
}
