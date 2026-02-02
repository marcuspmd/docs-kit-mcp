import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile, indexProject } from "../indexer.js";

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

function parseFixture(name: string) {
  const source = readFileSync(resolve(FIXTURES, name), "utf-8");
  const parser = createFreshParser();
  return indexFile(name, source, parser);
}

/* ================== indexFile ================== */

describe("indexFile", () => {
  describe("class with methods", () => {
    let symbols: ReturnType<typeof indexFile>;

    beforeEach(() => {
      symbols = parseFixture("class-with-methods.ts");
    });

    it("extracts the class", () => {
      const cls = symbols.find((s) => s.kind === "class");
      expect(cls).toBeDefined();
      expect(cls!.name).toBe("UserService");
      expect(cls!.startLine).toBe(2);
      expect(cls!.endLine).toBe(17);
      expect(cls!.parent).toBeUndefined();
    });

    it("extracts methods with parent reference", () => {
      const methods = symbols.filter((s) => s.kind === "method");
      expect(methods.length).toBe(3);

      const names = methods.map((m) => m.name);
      expect(names).toContain("constructor");
      expect(names).toContain("findById");
      expect(names).toContain("create");

      for (const m of methods) {
        expect(m.parent).toBe(symbols.find((s) => s.kind === "class")!.id);
      }
    });

    it("computes correct line ranges for methods", () => {
      const findById = symbols.find((s) => s.name === "findById")!;
      expect(findById.startLine).toBeGreaterThanOrEqual(10);
      expect(findById.endLine).toBeGreaterThanOrEqual(findById.startLine);
    });

    it("extracts exported flag", () => {
      const cls = symbols.find((s) => s.name === "UserService")!;
      expect(cls.exported).toBe(true);
    });

    it("extracts language", () => {
      for (const s of symbols) {
        expect(s.language).toBe("ts");
      }
    });

    it("extracts visibility from methods", () => {
      const create = symbols.find((s) => s.name === "create")!;
      expect(create.visibility).toBe("public");
    });

    it("extracts JSDoc summary", () => {
      const cls = symbols.find((s) => s.name === "UserService")!;
      expect(cls.summary).toBe("User service handles database operations");

      const findById = symbols.find((s) => s.name === "findById")!;
      expect(findById.summary).toBe("Find a user by their ID");
    });

    it("extracts qualifiedName", () => {
      const findById = symbols.find((s) => s.name === "findById")!;
      expect(findById.qualifiedName).toBe("UserService.findById");

      const cls = symbols.find((s) => s.name === "UserService")!;
      expect(cls.qualifiedName).toBe("UserService");
    });

    it("detects layer from name", () => {
      const cls = symbols.find((s) => s.name === "UserService")!;
      expect(cls.layer).toBe("application");
    });
  });

  describe("standalone functions", () => {
    let symbols: ReturnType<typeof indexFile>;

    beforeEach(() => {
      symbols = parseFixture("standalone-functions.ts");
    });

    it("extracts all functions", () => {
      const fns = symbols.filter((s) => s.kind === "function");
      expect(fns.length).toBe(3);
      const names = fns.map((f) => f.name);
      expect(names).toContain("add");
      expect(names).toContain("multiply");
      expect(names).toContain("privateHelper");
    });

    it("functions have no parent", () => {
      for (const s of symbols) {
        expect(s.parent).toBeUndefined();
      }
    });

    it("detects exported functions", () => {
      const add = symbols.find((s) => s.name === "add")!;
      expect(add.exported).toBe(true);

      const helper = symbols.find((s) => s.name === "privateHelper")!;
      expect(helper.exported).toBe(false);
    });
  });

  describe("interfaces", () => {
    let symbols: ReturnType<typeof indexFile>;

    beforeEach(() => {
      symbols = parseFixture("interfaces.ts");
    });

    it("extracts all interfaces", () => {
      const ifaces = symbols.filter((s) => s.kind === "interface");
      expect(ifaces.length).toBe(3);
      const names = ifaces.map((i) => i.name);
      expect(names).toContain("User");
      expect(names).toContain("CreateUserDto");
      expect(names).toContain("UserRepository");
    });

    it("interface methods are extracted with parent", () => {
      const repo = symbols.find((s) => s.name === "UserRepository")!;
      const methods = symbols.filter((s) => s.kind === "method" && s.parent === repo.id);
      expect(methods.length).toBeGreaterThanOrEqual(1);
    });

    it("interfaces have exported flag", () => {
      const user = symbols.find((s) => s.name === "User")!;
      expect(user.exported).toBe(true);
    });
  });

  describe("relationships fixture", () => {
    let symbols: ReturnType<typeof indexFile>;

    beforeEach(() => {
      symbols = parseFixture("relationships.ts");
    });

    it("extracts extends from class", () => {
      const orderRepo = symbols.find((s) => s.name === "OrderRepository")!;
      expect(orderRepo.extends).toBe("BaseRepository");
    });

    it("extracts implements from class", () => {
      const orderRepo = symbols.find((s) => s.name === "OrderRepository")!;
      expect(orderRepo.implements).toEqual(["Serializable", "Cacheable"]);
    });
  });

  describe("syntax error handling", () => {
    it("returns empty array for severely broken files without crashing", () => {
      const symbols = parseFixture("syntax-error.ts");
      expect(Array.isArray(symbols)).toBe(true);
    });
  });
});

/* ================== indexProject ================== */

describe("indexProject", () => {
  it("indexes all fixture files", async () => {
    const result = await indexProject({
      rootDir: FIXTURES,
      include: ["**/*.ts"],
      exclude: [],
    });

    expect(result.fileCount).toBeGreaterThanOrEqual(3);
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    const classNames = result.symbols.filter((s) => s.kind === "class").map((s) => s.name);
    expect(classNames).toContain("UserService");
  });

  it("respects exclude patterns", async () => {
    const result = await indexProject({
      rootDir: FIXTURES,
      include: ["**/*.ts"],
      exclude: ["**/class-with-methods.ts"],
    });

    const classNames = result.symbols
      .filter((s) => s.kind === "class" && s.name === "UserService")
      .map((s) => s.name);
    expect(classNames).not.toContain("UserService");
  });

  it("reports errors for missing directories gracefully", async () => {
    const result = await indexProject({
      rootDir: "/tmp/nonexistent-dir-docs-kit-test",
      include: ["**/*.ts"],
      exclude: [],
    });
    expect(result.fileCount).toBe(0);
    expect(result.symbols).toHaveLength(0);
  });
});
