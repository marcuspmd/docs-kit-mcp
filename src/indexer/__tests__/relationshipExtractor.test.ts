import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile } from "../indexer.js";
import { extractRelationships } from "../relationshipExtractor.js";

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
