/**
 * Dynamic Relationship Detector
 *
 * Detects dynamic registrations like:
 * - server.registerTool("myTool", ...)
 * - app.route("/api", handler)
 * - Events.on("event", listener)
 * - container.register(Service, implementation)
 *
 * Works across all languages using Tree-sitter AST analysis.
 */

import type Parser from "tree-sitter";
import type { CodeSymbol } from "./symbol.types.js";

export interface DynamicRelationship {
  sourceId: string; // Symbol being registered (extracted from string literal or identifier)
  targetId: string; // Symbol doing the registration (function/method)
  type: "dynamic_registration";
  registrationPattern: string; // e.g., "registerTool", "route", "on"
  location: { file: string; line: number };
}

/**
 * Common registration patterns across languages
 */
const REGISTRATION_PATTERNS = [
  // MCP/Plugin systems
  "registerTool",
  "registerCommand",
  "registerHandler",
  "registerProvider",

  // Event systems
  "on",
  "addEventListener",
  "subscribe",
  "listen",
  "addListener",

  // Routing/HTTP
  "route",
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "use",

  // DI containers
  "register",
  "bind",
  "singleton",
  "transient",

  // Test frameworks
  "describe",
  "test",
  "it",
  "beforeEach",
  "afterEach",
];

/**
 * Extract string literal value from AST node
 */
function extractStringLiteral(node: Parser.SyntaxNode): string | null {
  if (
    node.type === "string" ||
    node.type === "string_literal" ||
    node.type === "template_string" ||
    node.type.includes("string")
  ) {
    const text = node.text.trim();
    // Remove quotes
    return text.replace(/^["'`]|["'`]$/g, "");
  }
  return null;
}

/**
 * Extract identifier name from AST node
 */
function extractIdentifier(node: Parser.SyntaxNode): string | null {
  if (
    node.type === "identifier" ||
    node.type === "type_identifier" ||
    node.type === "field_identifier" ||
    node.type.includes("identifier")
  ) {
    return node.text.trim();
  }
  return null;
}

/**
 * Check if node is a registration call expression
 */
function isRegistrationCall(node: Parser.SyntaxNode): { pattern: string; method: string } | null {
  // Must be a call_expression or similar
  if (!node.type.includes("call")) {
    return null;
  }

  // Get the function/method being called
  const functionNode = node.childForFieldName("function") || node.child(0);
  if (!functionNode) return null;

  // Handle member expressions (e.g., server.registerTool)
  if (
    functionNode.type === "member_expression" ||
    functionNode.type === "property_identifier" ||
    functionNode.type.includes("member")
  ) {
    const propertyNode = functionNode.childForFieldName("property") || functionNode.child(2);
    if (propertyNode) {
      const methodName = extractIdentifier(propertyNode);
      if (methodName && REGISTRATION_PATTERNS.includes(methodName)) {
        return { pattern: methodName, method: methodName };
      }
    }
  }

  // Handle direct function calls (e.g., register(...))
  const identifier = extractIdentifier(functionNode);
  if (identifier && REGISTRATION_PATTERNS.includes(identifier)) {
    return { pattern: identifier, method: identifier };
  }

  return null;
}

/**
 * Extract the registered symbol name from call arguments
 */
function extractRegisteredSymbol(
  callNode: Parser.SyntaxNode,
  symbolsInFile: CodeSymbol[],
): string | null {
  // Get arguments
  const argsNode =
    callNode.childForFieldName("arguments") ||
    callNode.children.find((c) => c.type === "arguments" || c.type === "argument_list");
  if (!argsNode) return null;

  // First argument is usually the symbol name (string literal)
  const firstArg = argsNode.child(1); // Skip opening paren
  if (!firstArg) return null;

  // Try string literal first
  const stringLiteral = extractStringLiteral(firstArg);
  if (stringLiteral) return stringLiteral;

  // Try identifier reference
  const identifier = extractIdentifier(firstArg);
  if (identifier) {
    // Check if it's a known symbol in the file
    const symbol = symbolsInFile.find((s) => s.name === identifier);
    if (symbol) return symbol.id;
    return identifier;
  }

  // Try second argument (some patterns have name as second param)
  const secondArg = argsNode.child(3); // Skip comma
  if (secondArg) {
    const str = extractStringLiteral(secondArg);
    if (str) return str;
  }

  return null;
}

/**
 * Find the containing function/method that makes the registration call
 */
function findContainingFunction(
  node: Parser.SyntaxNode,
  symbolsInFile: CodeSymbol[],
): CodeSymbol | null {
  let current: Parser.SyntaxNode | null = node.parent;

  while (current) {
    // Find symbol at this location
    const symbol = symbolsInFile.find(
      (s) =>
        s.startLine <= current!.startPosition.row + 1 && s.endLine >= current!.endPosition.row + 1,
    );

    if (symbol && (symbol.kind === "function" || symbol.kind === "method")) {
      return symbol;
    }

    current = current.parent;
  }

  return null;
}

/**
 * Walk AST and detect dynamic registrations
 */
export function detectDynamicRelationships(
  tree: Parser.Tree,
  file: string,
  symbolsInFile: CodeSymbol[],
): DynamicRelationship[] {
  const relationships: DynamicRelationship[] = [];

  function walk(node: Parser.SyntaxNode) {
    // Check if this is a registration call
    const registration = isRegistrationCall(node);

    if (registration) {
      // Extract the symbol being registered
      const registeredSymbol = extractRegisteredSymbol(node, symbolsInFile);

      if (registeredSymbol) {
        // Find the containing function that does the registration
        const containingFunc = findContainingFunction(node, symbolsInFile);

        if (containingFunc) {
          relationships.push({
            sourceId: registeredSymbol,
            targetId: containingFunc.id,
            type: "dynamic_registration",
            registrationPattern: registration.pattern,
            location: {
              file,
              line: node.startPosition.row + 1,
            },
          });
        }
      }
    }

    // Recurse
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return relationships;
}

/**
 * Convert dynamic relationships to standard symbol relationships
 */
export function dynamicToSymbolRelationships(
  dynamicRels: DynamicRelationship[],
  symbols: CodeSymbol[],
): Array<{ sourceId: string; targetId: string; type: string }> {
  const result: Array<{ sourceId: string; targetId: string; type: string }> = [];
  const symbolNameIndex = new Map(symbols.map((s) => [s.name, s.id]));

  for (const rel of dynamicRels) {
    // If sourceId is a name (not an ID), resolve it to ID if possible
    let sourceId = rel.sourceId;
    if (!sourceId.includes(":")) {
      // It's a name, try to resolve to ID
      const symbolId = symbolNameIndex.get(rel.sourceId);
      // But keep the name if symbol doesn't exist (e.g., string literals like "/users")
      sourceId = symbolId || rel.sourceId;
    }

    result.push({
      sourceId: rel.targetId, // The symbol doing registration DEPENDS ON the registered symbol
      targetId: sourceId, // The registered symbol is USED BY the registering symbol
      type: "dynamic_call", // Mark as dynamic relationship
    });
  }

  return result;
}
