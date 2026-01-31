import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { initializeSchema, createSymbolRepository, createRelationshipRepository } from "../../src/storage/db.js";
import { generateDocs } from "../../src/site/mdGenerator.js";
import { generateSymbolId } from "../../src/indexer/symbol.types.js";
import { fileSlug } from "../../src/site/shared.js";
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

  relRepo.upsert(symbols[0].id, symbols[2].id, "uses");

  db.close();
  return symbols;
}

describe("generateDocs (Markdown)", () => {
  let tmpDir: string;
  let dbPath: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-kit-md-test-"));
    dbPath = path.join(tmpDir, "index.db");
    outDir = path.join(tmpDir, "docs-output");
    createTestDb(dbPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates README.md with stats and links", () => {
    generateDocs({ dbPath, outDir });
    const readme = fs.readFileSync(path.join(outDir, "README.md"), "utf-8");
    expect(readme).toContain("# doc-kit Documentation");
    expect(readme).toContain("UserService");
    expect(readme).toContain("User");
    expect(readme).toContain("symbols/");
    expect(readme).toContain("files/");
  });

  it("generates symbol pages", () => {
    generateDocs({ dbPath, outDir });
    const symbolsDir = path.join(outDir, "symbols");
    const files = fs.readdirSync(symbolsDir);
    expect(files.length).toBe(3);

    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(symbolsDir, `${userServiceId}.md`), "utf-8");
    expect(page).toContain("UserService");
    expect(page).toContain("`class`");
    expect(page).toContain("src/service.ts");
  });

  it("generates file pages with slug names", () => {
    generateDocs({ dbPath, outDir });
    const filesDir = path.join(outDir, "files");
    const files = fs.readdirSync(filesDir);
    expect(files.length).toBe(2);
    expect(files).toContain("src--service.ts.md");
    expect(files).toContain("src--model.ts.md");
  });

  it("generates relationships page with table", () => {
    generateDocs({ dbPath, outDir });
    const md = fs.readFileSync(path.join(outDir, "relationships.md"), "utf-8");
    expect(md).toContain("# Relationships");
    expect(md).toContain("UserService");
    expect(md).toContain("uses");
  });

  it("generates patterns page", () => {
    generateDocs({ dbPath, outDir });
    const md = fs.readFileSync(path.join(outDir, "patterns.md"), "utf-8");
    expect(md).toContain("Detected Patterns");
  });

  it("symbol page contains mermaid dependency graph", () => {
    generateDocs({ dbPath, outDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.md`), "utf-8");
    expect(page).toContain("```mermaid");
    expect(page).toContain("graph LR");
    expect(page).toContain("User");
  });

  it("symbol page shows members", () => {
    generateDocs({ dbPath, outDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.md`), "utf-8");
    expect(page).toContain("## Members");
    expect(page).toContain("findById");
  });

  it("returns MdGenerateResult with counts", () => {
    const result = generateDocs({ dbPath, outDir });
    expect(result.symbolPages).toBe(3);
    expect(result.filePages).toBe(2);
    expect(result.totalFiles).toBeGreaterThan(5);
  });

  it("includes source code when rootDir is provided", () => {
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "service.ts"),
      "export class UserService {\n  findById(id: string) {}\n}\n",
    );

    generateDocs({ dbPath, outDir, rootDir: tmpDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.md`), "utf-8");
    expect(page).toContain("## Source Code");
    expect(page).toContain("```typescript");
  });

  it("uses correct relative links from symbol pages", () => {
    generateDocs({ dbPath, outDir });
    const userServiceId = generateSymbolId("src/service.ts", "UserService", "class");
    const page = fs.readFileSync(path.join(outDir, "symbols", `${userServiceId}.md`), "utf-8");
    // Link to file should go up one level
    expect(page).toContain("../files/src--service.ts.md");
  });

  it("uses correct relative links from file pages", () => {
    generateDocs({ dbPath, outDir });
    const filePage = fs.readFileSync(path.join(outDir, "files", "src--service.ts.md"), "utf-8");
    // Link to symbol should go up one level
    expect(filePage).toContain("../symbols/");
  });
});

describe("fileSlug (shared)", () => {
  it("replaces slashes with double dashes", () => {
    expect(fileSlug("analyzer/gitDiff.ts")).toBe("analyzer--gitDiff.ts");
    expect(fileSlug("src/indexer/indexer.ts")).toBe("src--indexer--indexer.ts");
  });

  it("leaves flat filenames unchanged", () => {
    expect(fileSlug("cli.ts")).toBe("cli.ts");
  });
});
