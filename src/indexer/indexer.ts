import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { type CodeSymbol, type SymbolKind, generateSymbolId } from "./symbol.types.js";

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

/* ================== AST Walker ================== */

function walkNode(node: Parser.SyntaxNode, file: string, parent?: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kind = NODE_KIND_MAP[node.type];

  if (kind) {
    const name = node.childForFieldName("name")?.text ?? "anonymous";
    const id = generateSymbolId(file, name, kind);
    symbols.push({
      id,
      name,
      kind,
      file,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      parent,
    });

    for (const child of node.children) {
      symbols.push(...walkNode(child, file, id));
    }
  } else {
    for (const child of node.children) {
      symbols.push(...walkNode(child, file, parent));
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
