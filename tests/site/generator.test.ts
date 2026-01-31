import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { initializeSchema, createSymbolRepository, createRelationshipRepository } from "../../src/storage/db.js";
import { generateSite } from "../../src/site/generator.js";
import { generateSymbolId } from "../../src/indexer/symbol.types.js";
import { fileSlug } from "../../src/site/templates.js";
import type { CodeSymbol } from "../../src/indexer/symbol.types.js";

function createTestDb(dbPath: string) {
  const db = new Database(dbPath);
  initializeSchema(db);

  const symbolRepo = createSymbolRepository(db);
  const relRepo = createRelationshipRepository(db);

  const symbols: CodeSymbol[] = [
    {
      id: generateSymbolId("src/service.ts", "UserService", "class"),
      name: "UserService",
      kind: "class",
      file: "src/service.ts",
      startLine: 1,
      endLine: 20,
      signature: "class UserService",
      metrics: { linesOfCode: 20, cyclomaticComplexity: 3, parameterCount: 0 },
    },
    {
      id: generateSymbolId("src/service.ts", "findById", "method"),
      name: "findById",
      kind: "method",
      file: "src/service.ts",
      startLine: 5,
      endLine: 10,
      parent: generateSymbolId("src/service.ts", "UserService", "class"),
      signature: "findById(id: string): Promise<User>",
      metrics: { linesOfCode: 6, cyclomaticComplexity: 1, parameterCount: 1 },
    },
    {
      id: generateSymbolId("src/model.ts", "User", "interface"),
      name: "User",
      kind: "interface",
      file: "src/model.ts",
      startLine: 1,
      endLine: 5,
    },
  ];

  for (const s of symbols) {
    symbolRepo.upsert(s);
  }

  relRepo.upsert(
    symbols[0].id,
    symbols[2].id,
    "uses",
  );

  db.close();
  return symbols;
}

describe("generateSite", () => {
  let tmpDir: string;
  let dbPath: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-kit-site-test-"));
    dbPath = path.join(tmpDir, "index.db");
    outDir = path.join(tmpDir, "site");
    createTestDb(dbPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates index.html", () => {
    generateSite({ dbPath, outDir });
    const indexHtml = fs.readFileSync(path.join(outDir, "index.html"), "utf-8");
    expect(indexHtml).toContain("doc-kit Documentation");
    expect(indexHtml).toContain("UserService");
    expect(indexHtml).toContain("User");
  });

  it("generates symbol pages", () => {
    generateSite({ dbPath, outDir });
    const symbolsDir = path.join(outDir, "symbols");
    const files = fs.readdirSync(symbolsDir);
    expect(files.length).toBe(3);

    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(symbolsDir, `${userServiceId}.html`), "utf-8");
    expect(page).toContain("UserService");
    expect(page).toContain("class");
    expect(page).toContain("src/service.ts");
  });

  it("generates file pages with slug names (no encoded slashes)", () => {
    generateSite({ dbPath, outDir });
    const filesDir = path.join(outDir, "files");
    const files = fs.readdirSync(filesDir);
    expect(files.length).toBe(2);

    // Files should use -- instead of /
    expect(files).toContain("src--service.ts.html");
    expect(files).toContain("src--model.ts.html");
    // No %2F in filenames
    expect(files.every((f) => !f.includes("%2F"))).toBe(true);
  });

  it("generates relationships page without giant mermaid", () => {
    generateSite({ dbPath, outDir });
    const html = fs.readFileSync(path.join(outDir, "relationships.html"), "utf-8");
    expect(html).toContain("Relationships");
    expect(html).toContain("UserService");
    // Should have a table, not a giant mermaid
    expect(html).toContain("<table>");
    expect(html).not.toContain("classDiagram");
  });

  it("generates patterns page", () => {
    generateSite({ dbPath, outDir });
    const html = fs.readFileSync(path.join(outDir, "patterns.html"), "utf-8");
    expect(html).toContain("Detected Patterns");
  });

  it("generates search.json", () => {
    generateSite({ dbPath, outDir });
    const searchJson = JSON.parse(
      fs.readFileSync(path.join(outDir, "search.json"), "utf-8"),
    );
    expect(searchJson.length).toBe(3);
    expect(searchJson.some((s: { name: string }) => s.name === "UserService")).toBe(true);
  });

  it("symbol page shows dependency graph (mermaid per-symbol)", () => {
    generateSite({ dbPath, outDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.html`), "utf-8");
    expect(page).toContain("Dependencies");
    expect(page).toContain("mermaid");
    expect(page).toContain("User");
  });

  it("symbol page shows members", () => {
    generateSite({ dbPath, outDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.html`), "utf-8");
    expect(page).toContain("Members");
    expect(page).toContain("findById");
  });

  it("returns GenerateResult with counts", () => {
    const result = generateSite({ dbPath, outDir });
    expect(result.symbolPages).toBe(3);
    expect(result.filePages).toBe(2);
    expect(result.totalFiles).toBeGreaterThan(5);
  });

  it("includes source code when rootDir is provided", () => {
    // Create a fake source file
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "service.ts"),
      "export class UserService {\n  findById(id: string) {}\n}\n",
    );

    generateSite({ dbPath, outDir, rootDir: tmpDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.html`), "utf-8");
    expect(page).toContain("Source Code");
    expect(page).toContain("UserService");
  });
});

describe("fileSlug", () => {
  it("replaces slashes with double dashes", () => {
    expect(fileSlug("analyzer/gitDiff.ts")).toBe("analyzer--gitDiff.ts");
    expect(fileSlug("src/indexer/indexer.ts")).toBe("src--indexer--indexer.ts");
  });

  it("leaves flat filenames unchanged", () => {
    expect(fileSlug("cli.ts")).toBe("cli.ts");
  });
});
