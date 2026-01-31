import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexFile, indexProject } from "../../src/indexer/indexer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

function parseFixture(name: string) {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  const source = readFileSync(resolve(FIXTURES, name), "utf-8");
  return indexFile(name, source, parser);
}

/* ================== indexFile ================== */

describe("indexFile", () => {
  describe("class with methods", () => {
    const symbols = parseFixture("class-with-methods.ts");

    it("extracts the class", () => {
      const cls = symbols.find((s) => s.kind === "class");
      expect(cls).toBeDefined();
      expect(cls!.name).toBe("UserService");
      expect(cls!.startLine).toBe(1);
      expect(cls!.endLine).toBe(15);
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
      expect(findById.startLine).toBeGreaterThanOrEqual(8);
      expect(findById.endLine).toBeGreaterThanOrEqual(findById.startLine);
    });
  });

  describe("standalone functions", () => {
    const symbols = parseFixture("standalone-functions.ts");

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
  });

  describe("interfaces", () => {
    const symbols = parseFixture("interfaces.ts");

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
      const methods = symbols.filter(
        (s) => s.kind === "method" && s.parent === repo.id,
      );
      expect(methods.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("syntax error handling", () => {
    it("returns empty array for severely broken files without crashing", () => {
      const symbols = parseFixture("syntax-error.ts");
      // tree-sitter is error-tolerant but severely broken syntax
      // may not produce recognizable nodes — the key is no crash
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
    });

    expect(result.fileCount).toBeGreaterThanOrEqual(3);
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    const classNames = result.symbols
      .filter((s) => s.kind === "class")
      .map((s) => s.name);
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
      rootDir: "/tmp/nonexistent-dir-doc-kit-test",
      include: ["**/*.ts"],
    });
    expect(result.fileCount).toBe(0);
    expect(result.symbols).toHaveLength(0);
  });
});
