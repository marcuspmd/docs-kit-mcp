import type Parser from "tree-sitter";
import type { CodeMetrics, CodeSymbol } from "./symbol.types.js";
import type { LcovFileData } from "./lcovCollector.js";
import { enrichSymbolsWithCoverage } from "./lcovCollector.js";

const BRANCH_NODE_TYPES = new Set([
  "if_statement",
  "else_clause",
  "switch_case",
  "for_statement",
  "for_in_statement",
  "while_statement",
  "do_statement",
  "catch_clause",
  "ternary_expression",
  "binary_expression", // && and || counted separately below
]);

const LOGICAL_OPERATORS = new Set(["&&", "||", "??"]);

function countBranches(node: Parser.SyntaxNode): number {
  let count = 0;

  if (BRANCH_NODE_TYPES.has(node.type)) {
    // For binary_expression, only count logical operators
    if (node.type === "binary_expression") {
      const op = node.childForFieldName("operator")?.text;
      if (op && LOGICAL_OPERATORS.has(op)) {
        count++;
      }
    } else {
      count++;
    }
  }

  for (const child of node.children) {
    count += countBranches(child);
  }
  return count;
}

function countParameters(signature: string | undefined): number {
  if (!signature) return 0;
  const match = signature.match(/\(([^)]*)\)/);
  if (!match || !match[1].trim()) return 0;
  return match[1].split(",").length;
}

/**
 * Find the AST node corresponding to a symbol by matching line range.
 */
function findNodeForSymbol(
  root: Parser.SyntaxNode,
  symbol: CodeSymbol,
): Parser.SyntaxNode | undefined {
  // BFS to find the node matching the symbol's line range
  const startRow = symbol.startLine - 1;
  const endRow = symbol.endLine - 1;

  function search(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
    if (node.startPosition.row === startRow && node.endPosition.row === endRow) {
      return node;
    }
    for (const child of node.children) {
      if (child.startPosition.row <= startRow && child.endPosition.row >= endRow) {
        const found = search(child);
        if (found) return found;
      }
    }
    return undefined;
  }

  return search(root);
}

export interface MetricsCollectorOptions {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  coverage?: LcovFileData[];
}

/**
 * Compute metrics for each symbol and return updated symbols.
 * If coverage data is provided, enriches symbols with test coverage metrics.
 */
export function collectMetrics(options: MetricsCollectorOptions): CodeSymbol[] {
  const { symbols, trees, coverage } = options;

  // First, collect static metrics (LOC, complexity, parameters)
  const symbolsWithStaticMetrics = symbols.map((symbol) => {
    const tree = trees.get(symbol.file);
    const linesOfCode = symbol.endLine - symbol.startLine + 1;
    const parameterCount = countParameters(symbol.signature);

    let cyclomaticComplexity = 1; // base complexity
    if (tree) {
      const node = findNodeForSymbol(tree.rootNode, symbol);
      if (node) {
        cyclomaticComplexity += countBranches(node);
      }
    }

    const metrics: CodeMetrics = {
      linesOfCode,
      cyclomaticComplexity,
      parameterCount,
    };

    return { ...symbol, metrics };
  });

  // If coverage data is available, enrich symbols with test coverage
  if (coverage && coverage.length > 0) {
    const { enrichedSymbols, stats } = enrichSymbolsWithCoverage(
      symbolsWithStaticMetrics,
      coverage,
    );

    if (stats.symbolsEnriched > 0) {
      console.log(
        `✓ Coverage: Enriched ${stats.symbolsEnriched}/${stats.totalSymbols} symbols from ${stats.filesProcessed} files`,
      );
    }

    return enrichedSymbols;
  }

  return symbolsWithStaticMetrics;
}
