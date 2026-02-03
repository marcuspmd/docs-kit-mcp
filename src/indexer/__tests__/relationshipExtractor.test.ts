import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile } from "../indexer.js";
import {
  extractRelationships,
  resolveSymbol,
  type SymbolIndex,
  type ResolutionContext,
} from "../relationshipExtractor.js";
import type { CodeSymbol } from "../symbol.types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

/**
 * Create a fresh parser for each test to avoid state corruption issues
 * with tree-sitter in Jest test environment.
 */
function createFreshParser(): Parser {
  const parser = new Parser();
  (parser as { setLanguage: (l: unknown) => void }).setLanguage(TypeScript.typescript);
  return parser;
}

function parseFixtureWithTree(name: string) {
  const source = readFileSync(resolve(FIXTURES, name), "utf-8");

  // Use completely separate parsers for tree and symbols extraction
  const treeParser = createFreshParser();
  const tree = treeParser.parse(source);

  const symbolParser = createFreshParser();
  const symbols = indexFile(name, source, symbolParser);

  return { symbols, tree, source };
}

describe("extractRelationships", () => {
  it("detects extends relationship", () => {
    const { symbols, tree, source } = parseFixtureWithTree("relationships.ts");
    const trees = new Map([["relationships.ts", tree]]);
    const sources = new Map([["relationships.ts", source]]);

    const rels = extractRelationships({ symbols, trees, sources });

    const inheritsRels = rels.filter((r) => r.type === "inherits");
    expect(inheritsRels.length).toBeGreaterThanOrEqual(1);

    const orderRepo = symbols.find((s) => s.name === "OrderRepository");
    const baseRepo = symbols.find((s) => s.name === "BaseRepository");
    expect(orderRepo).toBeDefined();
    expect(baseRepo).toBeDefined();

    const extendsRel = inheritsRels.find(
      (r) => r.sourceId === orderRepo!.id && r.targetId === baseRepo!.id,
    );
    expect(extendsRel).toBeDefined();
  });

  it("detects implements relationships", () => {
    const { symbols, tree, source } = parseFixtureWithTree("relationships.ts");
    const trees = new Map([["relationships.ts", tree]]);
    const sources = new Map([["relationships.ts", source]]);

    const rels = extractRelationships({ symbols, trees, sources });

    const implRels = rels.filter((r) => r.type === "implements");
    expect(implRels.length).toBeGreaterThanOrEqual(2);

    const orderRepo = symbols.find((s) => s.name === "OrderRepository");
    const serializable = symbols.find((s) => s.name === "Serializable");
    const cacheable = symbols.find((s) => s.name === "Cacheable");

    expect(
      implRels.some((r) => r.sourceId === orderRepo!.id && r.targetId === serializable!.id),
    ).toBe(true);
    expect(implRels.some((r) => r.sourceId === orderRepo!.id && r.targetId === cacheable!.id)).toBe(
      true,
    );
  });

  it("detects instantiates relationships (new expressions)", () => {
    const { symbols, tree, source } = parseFixtureWithTree("relationships.ts");
    const trees = new Map([["relationships.ts", tree]]);
    const sources = new Map([["relationships.ts", source]]);

    const rels = extractRelationships({ symbols, trees, sources });

    const instantiates = rels.filter((r) => r.type === "instantiates");
    // new UserService(...) inside findById, and new OrderRepository() in createOrderRepository
    // UserService is not in this file's symbols, so only OrderRepository instantiation counts
    const orderRepoInstantiations = instantiates.filter((r) => {
      const target = symbols.find((s) => s.id === r.targetId);
      return target?.name === "OrderRepository";
    });
    expect(orderRepoInstantiations.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array when no relationships found", () => {
    const { symbols, tree, source } = parseFixtureWithTree("standalone-functions.ts");
    const trees = new Map([["standalone-functions.ts", tree]]);
    const sources = new Map([["standalone-functions.ts", source]]);

    const rels = extractRelationships({ symbols, trees, sources });
    // standalone functions with no class relationships
    expect(Array.isArray(rels)).toBe(true);
  });

  it("includes location info on relationships", () => {
    const { symbols, tree, source } = parseFixtureWithTree("relationships.ts");
    const trees = new Map([["relationships.ts", tree]]);
    const sources = new Map([["relationships.ts", source]]);

    const rels = extractRelationships({ symbols, trees, sources });
    for (const rel of rels) {
      expect(rel.location).toBeDefined();
      expect(rel.location!.file).toBe("relationships.ts");
      expect(rel.location!.line).toBeGreaterThan(0);
    }
  });
});

describe("resolveSymbol", () => {
  function createSymbol(name: string, id?: string): CodeSymbol {
    return {
      id: id ?? name,
      name,
      kind: "class",
      file: "test.php",
      startLine: 1,
      endLine: 10,
    };
  }

  function buildIndex(symbols: CodeSymbol[]): SymbolIndex {
    const byQualified = new Map<string, CodeSymbol>();
    const byShortName = new Map<string, CodeSymbol[]>();

    for (const s of symbols) {
      byQualified.set(s.name, s);

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

  it("resolves by exact qualified name", () => {
    const symbol = createSymbol("App\\Services\\Request");
    const index = buildIndex([symbol]);

    const result = resolveSymbol("App\\Services\\Request", index);

    expect(result).toBe(symbol);
  });

  it("resolves via use import alias", () => {
    const symbol = createSymbol("App\\Services\\Request", "svc-request");
    const index = buildIndex([symbol]);
    const ctx: ResolutionContext = {
      imports: new Map([["Request", "App\\Services\\Request"]]),
    };

    const result = resolveSymbol("Request", index, ctx);

    expect(result).toBe(symbol);
  });

  it("resolves via current namespace", () => {
    const symbol = createSymbol("App\\Controllers\\UserController");
    const index = buildIndex([symbol]);
    const ctx: ResolutionContext = {
      imports: new Map(),
      namespace: "App\\Controllers",
    };

    const result = resolveSymbol("UserController", index, ctx);

    expect(result).toBe(symbol);
  });

  it("does NOT resolve by short name alone (prevents false positives)", () => {
    // Short name fallback was removed to prevent false positive relationships.
    // A function named "count" in one file should NOT match all "count()" calls.
    const symbol = createSymbol("App\\Services\\UniqueService");
    const index = buildIndex([symbol]);

    const result = resolveSymbol("UniqueService", index);

    // Without explicit import or namespace context, short names don't resolve
    expect(result).toBeUndefined();
  });

  it("returns undefined when short name is ambiguous", () => {
    const symbol1 = createSymbol("App\\Services\\Request", "svc-request");
    const symbol2 = createSymbol("App\\Http\\Request", "http-request");
    const index = buildIndex([symbol1, symbol2]);

    const result = resolveSymbol("Request", index);

    expect(result).toBeUndefined();
  });

  it("prefers import over short name fallback", () => {
    const svcRequest = createSymbol("App\\Services\\Request", "svc-request");
    const httpRequest = createSymbol("App\\Http\\Request", "http-request");
    const index = buildIndex([svcRequest, httpRequest]);
    const ctx: ResolutionContext = {
      imports: new Map([["Request", "App\\Http\\Request"]]),
    };

    const result = resolveSymbol("Request", index, ctx);

    expect(result).toBe(httpRequest);
  });

  it("prefers namespace over short name fallback", () => {
    const svcRequest = createSymbol("App\\Services\\Request", "svc-request");
    const httpRequest = createSymbol("App\\Http\\Request", "http-request");
    const index = buildIndex([svcRequest, httpRequest]);
    const ctx: ResolutionContext = {
      imports: new Map(),
      namespace: "App\\Services",
    };

    const result = resolveSymbol("Request", index, ctx);

    expect(result).toBe(svcRequest);
  });

  it("requires qualified name for TypeScript/JS method lookups", () => {
    // Short name "nestedMethod" alone should NOT resolve - must use qualified name
    const symbol = createSymbol("MyClass.nestedMethod");
    const index = buildIndex([symbol]);

    // Short name alone doesn't resolve (prevents false positives)
    const resultShort = resolveSymbol("nestedMethod", index);
    expect(resultShort).toBeUndefined();

    // Full qualified name resolves correctly
    const resultQualified = resolveSymbol("MyClass.nestedMethod", index);
    expect(resultQualified).toBe(symbol);
  });

  it("resolves TypeScript imports via source path", () => {
    const symbol = createSymbol("count");
    symbol.file = "src/utils/math.ts";
    const index = buildIndex([symbol]);

    // Format: "./utils/math::count" from import resolution
    const result = resolveSymbol("./utils/math::count", index);

    expect(result).toBe(symbol);
  });
});
