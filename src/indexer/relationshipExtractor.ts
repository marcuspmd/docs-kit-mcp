import type Parser from "tree-sitter";
import type { CodeSymbol, SymbolRelationship } from "./symbol.types.js";
import { detectLanguage } from "./indexer.js";
import { getStrategy } from "./languages/index.js";
import {
  detectDynamicRelationships,
  dynamicToSymbolRelationships,
} from "./dynamicRelationshipDetector.js";

export interface RelationshipExtractorOptions {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  sources: Map<string, string>;
}

/**
 * Index structure that supports both qualified name and short name lookups.
 * This enables proper resolution of PHP namespaced classes.
 */
export interface SymbolIndex {
  byQualified: Map<string, CodeSymbol>;
  byShortName: Map<string, CodeSymbol[]>;
}

/**
 * Context for resolving symbol references, particularly for PHP.
 */
export interface ResolutionContext {
  imports: Map<string, string>; // alias/shortName → qualified name (from use statements)
  namespace?: string; // current file's namespace
}

function buildSymbolIndex(symbols: CodeSymbol[]): SymbolIndex {
  const byQualified = new Map<string, CodeSymbol>();
  const byShortName = new Map<string, CodeSymbol[]>();

  for (const s of symbols) {
    // Use qualified name (s.name includes namespace for PHP classes)
    byQualified.set(s.name, s);

    // Extract short name (last segment after \ or .)
    const shortName = s.name.includes("\\")
      ? s.name.split("\\").pop()!
      : s.name.includes(".")
        ? s.name.split(".").pop()!
        : s.name;

    const list = byShortName.get(shortName) ?? [];
    list.push(s);
    byShortName.set(shortName, list);
  }

  return { byQualified, byShortName };
}

/**
 * Resolve a symbol reference to a CodeSymbol using namespace-aware logic.
 * Resolution order:
 * 1. Exact qualified name match
 * 2. Via use import/alias (PHP namespaces or TypeScript imports)
 * 3. Current namespace + name (PHP only)
 * 4. Import source path match (TypeScript: ./path::symbolName)
 *
 * NOTE: Short name fallback was REMOVED to prevent false positives.
 * A function named "count" should NOT match all "count()" calls globally.
 * Relationships are only created when we have high confidence about the target.
 */
export function resolveSymbol(
  targetName: string,
  index: SymbolIndex,
  ctx?: ResolutionContext,
): CodeSymbol | undefined {
  // 1. Exact qualified name match
  if (index.byQualified.has(targetName)) {
    return index.byQualified.get(targetName);
  }

  // 2. Via use import/alias (PHP namespaces)
  if (ctx?.imports.has(targetName)) {
    const qualified = ctx.imports.get(targetName)!;
    if (index.byQualified.has(qualified)) {
      return index.byQualified.get(qualified);
    }
  }

  // 3. Current namespace + name (PHP only)
  if (ctx?.namespace) {
    const withNs = `${ctx.namespace}\\${targetName}`;
    if (index.byQualified.has(withNs)) {
      return index.byQualified.get(withNs);
    }
  }

  // 4. TypeScript import path resolution (e.g., "./utils::count" → find symbol in that file)
  if (targetName.includes("::")) {
    const [sourcePath, symbolName] = targetName.split("::");
    // Find symbols that match the name and are in a file that matches the source path
    const candidates = index.byShortName.get(symbolName) ?? [];
    for (const candidate of candidates) {
      // Check if the candidate's file matches the import source path
      // Handle relative paths: "./utils" should match "src/utils.ts" etc.
      const normalizedSource = sourcePath.replace(/^\.\//, "").replace(/\.(js|ts|tsx|jsx)$/, "");
      const normalizedFile = candidate.file.replace(/\.(js|ts|tsx|jsx)$/, "");
      if (
        normalizedFile.endsWith(normalizedSource) ||
        normalizedFile.endsWith(`/${normalizedSource}`)
      ) {
        return candidate;
      }
    }
  }

  // NO short name fallback - this was causing false positives
  // A function named "count" in one file should NOT match all "count()" calls
  return undefined;
}

/**
 * Type for addRel function that includes optional resolution context.
 */
export type AddRelWithContextFn = (
  sourceId: string,
  targetName: string,
  type: SymbolRelationship["type"],
  file: string,
  line: number,
  ctx?: ResolutionContext,
) => void;

export function extractRelationships(options: RelationshipExtractorOptions): SymbolRelationship[] {
  const { symbols, trees } = options;
  const symbolIndex = buildSymbolIndex(symbols);
  const relationships: SymbolRelationship[] = [];
  const seen = new Set<string>();

  function addRel(
    sourceId: string,
    targetName: string,
    type: SymbolRelationship["type"],
    file: string,
    line: number,
    ctx?: ResolutionContext,
  ) {
    const target = resolveSymbol(targetName, symbolIndex, ctx);
    if (!target) return;
    const key = `${sourceId}:${target.id}:${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    relationships.push({
      sourceId,
      targetId: target.id,
      type,
      location: { file, line },
    });
  }

  const fileSymbols = new Map<string, CodeSymbol[]>();
  for (const s of symbols) {
    const list = fileSymbols.get(s.file) ?? [];
    list.push(s);
    fileSymbols.set(s.file, list);
  }

  for (const [file, tree] of trees) {
    const symsInFile = fileSymbols.get(file) ?? [];
    const language = detectLanguage(file);
    const strategy = getStrategy(language);

    // Extract resolution context based on language
    let resolutionCtx: ResolutionContext | undefined;

    if (language === "php" && "extractUseStatements" in strategy) {
      // PHP: use statements and namespaces
      const phpStrategy = strategy as {
        extractUseStatements: (root: Parser.SyntaxNode) => Map<string, string>;
        extractNamespace: (root: Parser.SyntaxNode) => string | undefined;
      };
      resolutionCtx = {
        imports: phpStrategy.extractUseStatements(tree.rootNode),
        namespace: phpStrategy.extractNamespace(tree.rootNode),
      };
    } else if ((language === "ts" || language === "js") && "extractImports" in strategy) {
      // TypeScript/JavaScript: import statements
      const tsStrategy = strategy as {
        extractImports: (root: Parser.SyntaxNode) => Map<string, string>;
      };
      resolutionCtx = {
        imports: tsStrategy.extractImports(tree.rootNode),
      };
    }

    // Static relationships (AST-based)
    walkForRelationships(tree.rootNode, file, symsInFile, addRel, strategy, resolutionCtx);

    // Dynamic relationships (registration patterns)
    const dynamicRels = detectDynamicRelationships(tree, file, symsInFile);
    const convertedRels = dynamicToSymbolRelationships(dynamicRels, symbols);

    for (const rel of convertedRels) {
      const key = `${rel.sourceId}:${rel.targetId}:${rel.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        relationships.push({
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          type: rel.type,
          location: { file, line: 0 }, // Dynamic calls don't have specific line
        });
      }
    }
  }

  return relationships;
}

function walkForRelationships(
  node: Parser.SyntaxNode,
  file: string,
  symsInFile: CodeSymbol[],
  addRel: AddRelWithContextFn,
  strategy: ReturnType<typeof getStrategy>,
  resolutionCtx?: ResolutionContext,
) {
  if (!node) return;

  if (node.type === "class_declaration" || node.type === "abstract_class_declaration") {
    const className = node.childForFieldName("name")?.text;
    // Match by short name (className) against the last segment of qualified names
    const classSymbol = symsInFile.find((s) => {
      const shortName = s.name.includes("\\") ? s.name.split("\\").pop() : s.name;
      return (
        shortName === className &&
        (s.kind === "class" ||
          s.kind === "abstract_class" ||
          // Also match refined kinds (event, service, etc.)
          shortName === className)
      );
    });

    if (classSymbol) {
      strategy.extractClassRelationships(node, classSymbol, addRel, file, resolutionCtx);
    }
  }

  strategy.extractInstantiationRelationships(node, symsInFile, addRel, file, resolutionCtx);
  strategy.extractImportRelationships(node, symsInFile, addRel, file, resolutionCtx);
  strategy.extractCallRelationships(node, symsInFile, addRel, file, resolutionCtx);
  strategy.extractEventListenerRelationships?.(node, symsInFile, addRel, file, resolutionCtx);

  for (const child of node.children) {
    walkForRelationships(child, file, symsInFile, addRel, strategy, resolutionCtx);
  }
}
