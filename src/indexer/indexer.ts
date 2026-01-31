import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
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
  class_declaration: "class",
  abstract_class_declaration: "abstract_class",
  method_definition: "method",
  function_declaration: "function",
  interface_declaration: "interface",
  enum_declaration: "enum",
  type_alias_declaration: "type",
  method_signature: "method",
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

const LAYER_PATTERNS: Array<{ pattern: RegExp; layer: Layer }> = [
  { pattern: /(controller|route|view|page|component|ui)/i, layer: "presentation" },
  { pattern: /(service|use.?case|handler|command|query|application)/i, layer: "application" },
  { pattern: /(entity|model|value.?object|domain|event)/i, layer: "domain" },
  { pattern: /(repository|adapter|gateway|storage|db|infra|migration|provider)/i, layer: "infrastructure" },
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
  const kind = NODE_KIND_MAP[node.type];

  if (kind) {
    const name = node.childForFieldName("name")?.text ?? "anonymous";
    const id = generateSymbolId(file, name, kind);

    // Signature
    let signature: string | undefined;
    if (kind === "function" || kind === "method") {
      const parameters = node.childForFieldName("parameters");
      const returnType = node.childForFieldName("return_type");
      const paramsText = parameters ? parameters.text : "()";
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
  const tree = parser.parse(source);
  return walkNode(tree.rootNode, filePath);
}

/* ================== Project indexer ================== */

export async function indexProject(options: IndexerOptions): Promise<IndexResult> {
  const { rootDir, include = ["**/*.ts"], exclude = ["node_modules/**", "dist/**"] } = options;

  const files = await fg(include, {
    cwd: rootDir,
    ignore: exclude,
    absolute: false,
  });

  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);

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
