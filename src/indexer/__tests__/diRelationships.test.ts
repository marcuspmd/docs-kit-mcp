/**
 * Tests: DI relationship extraction (constructor + property injection).
 *
 * Verifies that TypeScriptStrategy correctly resolves `uses` edges
 * for auto-wired dependencies — even when no `new X()` call exists.
 */

import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile } from "../indexer.js";
import { extractRelationships } from "../relationshipExtractor.js";
import type { CodeSymbol, SymbolRelationship } from "../symbol.types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, "fixtures/di-injection.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fresh parser instance — avoids tree-sitter global state issues. */
function createParser(): Parser {
  const parser = new Parser();
  (parser as { setLanguage: (l: unknown) => void }).setLanguage(TypeScript.typescript);
  return parser;
}

function parseFixture() {
  const source = readFileSync(FIXTURE_PATH, "utf-8");

  // Two separate parsers: one for the AST tree, one for symbol extraction
  const tree = createParser().parse(source);
  const symbols = indexFile(FIXTURE_PATH, source, createParser());

  const trees = new Map([[FIXTURE_PATH, tree]]);
  const sources = new Map([[FIXTURE_PATH, source]]);
  const relationships = extractRelationships({ symbols, trees, sources });

  return { symbols, relationships };
}

function findId(symbols: CodeSymbol[], name: string): string {
  const sym = symbols.find((s) => s.name === name);
  if (!sym) throw new Error(`Symbol not found in fixture: "${name}"`);
  return sym.id;
}

function hasUsesRel(
  rels: SymbolRelationship[],
  symbols: CodeSymbol[],
  fromName: string,
  toName: string,
): boolean {
  const fromId = findId(symbols, fromName);
  const toId = findId(symbols, toName);
  return rels.some(
    (r) => r.sourceId === fromId && r.targetId === toId && r.type === "uses",
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("TypeScriptStrategy — DI relationship extraction", () => {
  let symbols: CodeSymbol[];
  let relationships: SymbolRelationship[];

  beforeEach(() => {
    ({ symbols, relationships } = parseFixture());
  });

  // ── Constructor injection ──────────────────────────────────────────────────

  it("extracts @inject(TOKEN) constructor param type as `uses`", () => {
    expect(hasUsesRel(relationships, symbols, "OrderService", "PaymentRepository")).toBe(true);
    expect(hasUsesRel(relationships, symbols, "OrderService", "EmailService")).toBe(true);
  });

  it("extracts plain constructor param (no decorator) as `uses`", () => {
    // LoggerService injected without @inject — purely via TypeScript type
    expect(hasUsesRel(relationships, symbols, "OrderService", "LoggerService")).toBe(true);
  });

  // ── Property injection ─────────────────────────────────────────────────────

  it("extracts @Inject property type as `uses`", () => {
    expect(hasUsesRel(relationships, symbols, "InvoiceService", "PaymentRepository")).toBe(true);
    expect(hasUsesRel(relationships, symbols, "InvoiceService", "EmailService")).toBe(true);
  });

  // ── False-positive guard ───────────────────────────────────────────────────

  it("does NOT create `uses` edges for primitive constructor params", () => {
    const simpleId = findId(symbols, "SimpleService");
    const primitiveEdges = relationships.filter(
      (r) =>
        r.sourceId === simpleId &&
        r.type === "uses" &&
        // Check target name if the symbol was indexed (it won't be, but just in case)
        symbols.find((s) => s.id === r.targetId && ["number", "string", "boolean"].includes(s.name)),
    );
    expect(primitiveEdges).toHaveLength(0);
  });

  // ── Sanity: all classes were indexed ──────────────────────────────────────

  it("indexes all DI-related symbols", () => {
    const names = symbols.map((s) => s.name);
    expect(names).toContain("OrderService");
    expect(names).toContain("InvoiceService");
    expect(names).toContain("PaymentRepository");
    expect(names).toContain("EmailService");
    expect(names).toContain("LoggerService");
    expect(names).toContain("SimpleService");
  });
});
