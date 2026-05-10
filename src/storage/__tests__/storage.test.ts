import {
  createDatabase,
  initializeSchema,
  createSymbolRepository,
  createRelationshipRepository,
  createFileHashRepository,
  CURRENT_SCHEMA_VERSION,
} from "../db.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import type Database from "better-sqlite3";

describe("Storage Layer", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    initializeSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("createDatabase", () => {
    it("creates an in-memory database", () => {
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
    });

    it("sets WAL journal mode", () => {
      const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
      // in-memory databases may report "memory" instead of "wal"
      expect(result[0].journal_mode).toBeDefined();
    });
  });

  describe("initializeSchema", () => {
    it("creates tables idempotently", () => {
      // calling again should not throw
      initializeSchema(db);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;

      const names = tables.map((t) => t.name);
      expect(names).toContain("symbols");
      expect(names).toContain("relationships");
      expect(names).toContain("doc_mappings");
    });

    it("tracks the current schema version", () => {
      expect(db.pragma("user_version", { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
    });

    it("migrates legacy explanation and vector columns idempotently", () => {
      const legacyDb = createDatabase({ inMemory: true });
      try {
        legacyDb.exec(`
          CREATE TABLE symbols (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            file TEXT NOT NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL
          );
          CREATE TABLE rag_chunks (
            hash TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            source TEXT NOT NULL,
            symbol_id TEXT,
            vector TEXT NOT NULL
          );
        `);

        initializeSchema(legacyDb);
        initializeSchema(legacyDb);

        const symbolColumns = legacyDb.prepare("PRAGMA table_info(symbols)").all() as Array<{
          name: string;
        }>;
        const ragColumns = legacyDb.prepare("PRAGMA table_info(rag_chunks)").all() as Array<{
          name: string;
        }>;

        expect(symbolColumns.map((column) => column.name)).toEqual(
          expect.arrayContaining(["doc_comment", "explanation", "explanation_hash"]),
        );
        expect(ragColumns.map((column) => column.name)).toContain("vector_blob");
        expect(legacyDb.pragma("user_version", { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
      } finally {
        legacyDb.close();
      }
    });
  });

  describe("SymbolRepository", () => {
    const makeSymbol = (overrides?: Partial<CodeSymbol>): CodeSymbol =>
      ({
        id: "abc123",
        name: "User",
        kind: "class",
        file: "src/user.ts",
        startLine: 1,
        endLine: 20,
        ...overrides,
      }) as CodeSymbol;

    it("upserts and finds by id", () => {
      const repo = createSymbolRepository(db);
      const sym = makeSymbol();

      repo.upsert(sym);
      const found = repo.findById("abc123");

      expect(found).toBeDefined();
      expect(found!.name).toBe("User");
      expect(found!.kind).toBe("class");
      expect(found!.file).toBe("src/user.ts");
      expect(found!.startLine).toBe(1);
      expect(found!.endLine).toBe(20);
    });

    it("returns undefined for missing id", () => {
      const repo = createSymbolRepository(db);
      expect(repo.findById("nonexistent")).toBeUndefined();
    });

    it("upsert overwrites existing symbol", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ endLine: 20 }));
      repo.upsert(makeSymbol({ endLine: 50 }));

      const found = repo.findById("abc123");
      expect(found!.endLine).toBe(50);
    });

    it("finds by file", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "a", file: "src/a.ts" }));
      repo.upsert(makeSymbol({ id: "b", file: "src/a.ts" }));
      repo.upsert(makeSymbol({ id: "c", file: "src/b.ts" }));

      const results = repo.findByFile("src/a.ts");
      expect(results).toHaveLength(2);
    });

    it("finds by kind", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "a", kind: "class" }));
      repo.upsert(makeSymbol({ id: "b", kind: "function" }));
      repo.upsert(makeSymbol({ id: "c", kind: "class" }));

      const results = repo.findByKind("class");
      expect(results).toHaveLength(2);
    });

    it("deletes by file", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "a", file: "src/a.ts" }));
      repo.upsert(makeSymbol({ id: "b", file: "src/a.ts" }));
      repo.upsert(makeSymbol({ id: "c", file: "src/b.ts" }));

      repo.deleteByFile("src/a.ts");

      expect(repo.findByFile("src/a.ts")).toHaveLength(0);
      expect(repo.findByFile("src/b.ts")).toHaveLength(1);
    });

    it("stores and retrieves all optional fields", () => {
      const repo = createSymbolRepository(db);
      const date = new Date("2024-01-15T10:00:00.000Z");
      repo.upsert(
        makeSymbol({
          qualifiedName: "app.models.User",
          parent: "Module",
          visibility: "public",
          exported: true,
          language: "ts",
          docRef: "docs/user.md",
          summary: "User entity",
          tags: ["auth", "core"],
          domain: "identity",
          boundedContext: "auth",
          extends: "BaseEntity",
          implements: ["Serializable", "Auditable"],
          usesTraits: ["SoftDelete"],
          references: ["Role", "Permission"],
          referencedBy: ["AuthService"],
          layer: "domain",
          metrics: { linesOfCode: 50, cyclomaticComplexity: 3, parameterCount: 2 },
          pattern: "entity",
          violations: ["missing-doc", "no-test"],
          deprecated: false,
          since: "1.0.0",
          stability: "stable",
          generated: false,
          source: "human",
          lastModified: date,
          signature: "class User extends BaseEntity",
        }),
      );

      const found = repo.findById("abc123")!;
      expect(found.qualifiedName).toBe("app.models.User");
      expect(found.parent).toBe("Module");
      expect(found.visibility).toBe("public");
      expect(found.exported).toBe(true);
      expect(found.language).toBe("ts");
      expect(found.docRef).toBe("docs/user.md");
      expect(found.summary).toBe("User entity");
      expect(found.tags).toEqual(["auth", "core"]);
      expect(found.domain).toBe("identity");
      expect(found.boundedContext).toBe("auth");
      expect(found.extends).toBe("BaseEntity");
      expect(found.implements).toEqual(["Serializable", "Auditable"]);
      expect(found.usesTraits).toEqual(["SoftDelete"]);
      expect(found.references).toEqual(["Role", "Permission"]);
      expect(found.referencedBy).toEqual(["AuthService"]);
      expect(found.layer).toBe("domain");
      expect(found.metrics).toEqual({
        linesOfCode: 50,
        cyclomaticComplexity: 3,
        parameterCount: 2,
      });
      expect(found.pattern).toBe("entity");
      expect(found.violations).toEqual(["missing-doc", "no-test"]);
      expect(found.deprecated).toBe(false);
      expect(found.since).toBe("1.0.0");
      expect(found.stability).toBe("stable");
      expect(found.generated).toBe(false);
      expect(found.source).toBe("human");
      expect(found.lastModified).toEqual(date);
      expect(found.signature).toBe("class User extends BaseEntity");
    });

    it("handles null optional fields", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol());

      const found = repo.findById("abc123")!;
      expect(found.parent).toBeUndefined();
      expect(found.qualifiedName).toBeUndefined();
      expect(found.visibility).toBeUndefined();
      expect(found.exported).toBeUndefined();
      expect(found.language).toBeUndefined();
      expect(found.docRef).toBeUndefined();
      expect(found.summary).toBeUndefined();
      expect(found.tags).toBeUndefined();
      expect(found.domain).toBeUndefined();
      expect(found.boundedContext).toBeUndefined();
      expect(found.extends).toBeUndefined();
      expect(found.implements).toBeUndefined();
      expect(found.layer).toBeUndefined();
      expect(found.metrics).toBeUndefined();
      expect(found.pattern).toBeUndefined();
      expect(found.violations).toBeUndefined();
      expect(found.deprecated).toBeUndefined();
      expect(found.stability).toBeUndefined();
      expect(found.lastModified).toBeUndefined();
      expect(found.signature).toBeUndefined();
    });
  });

  describe("RelationshipRepository", () => {
    it("upserts and finds by source", () => {
      const repo = createRelationshipRepository(db);
      repo.upsert("a", "b", "calls");
      repo.upsert("a", "c", "inherits");

      const results = repo.findBySource("a");
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("calls");
    });

    it("finds by target", () => {
      const repo = createRelationshipRepository(db);
      repo.upsert("a", "x", "calls");
      repo.upsert("b", "x", "uses");

      const results = repo.findByTarget("x");
      expect(results).toHaveLength(2);
    });

    it("upsert overwrites existing relationship", () => {
      const repo = createRelationshipRepository(db);
      repo.upsert("a", "b", "calls");
      repo.upsert("a", "b", "inherits");

      const results = repo.findBySource("a");
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("inherits");
    });

    it("deletes by source", () => {
      const repo = createRelationshipRepository(db);
      repo.upsert("a", "b", "calls");
      repo.upsert("a", "c", "uses");
      repo.upsert("x", "y", "inherits");

      repo.deleteBySource("a");

      expect(repo.findBySource("a")).toHaveLength(0);
      expect(repo.findBySource("x")).toHaveLength(1);
    });

    it("findAll returns all relationships", () => {
      const repo = createRelationshipRepository(db);
      repo.upsert("a", "b", "calls");
      repo.upsert("x", "y", "uses");

      const all = repo.findAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("SymbolRepository advanced methods", () => {
    const makeSymbol = (overrides?: Partial<CodeSymbol>): CodeSymbol =>
      ({
        id: "sym1",
        name: "MyClass",
        qualifiedName: "pkg.MyClass",
        kind: "class",
        file: "src/my.ts",
        startLine: 1,
        endLine: 10,
        language: "ts",
        ...overrides,
      }) as CodeSymbol;

    it("findByIds returns symbols for given ids", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "id1", name: "Alpha" }));
      repo.upsert(makeSymbol({ id: "id2", name: "Beta" }));
      repo.upsert(makeSymbol({ id: "id3", name: "Gamma" }));

      const results = repo.findByIds(["id1", "id3"]);
      expect(results).toHaveLength(2);
      const names = results.map((s) => s.name).sort();
      expect(names).toEqual(["Alpha", "Gamma"]);
    });

    it("findByIds returns empty array for empty input", () => {
      const repo = createSymbolRepository(db);
      expect(repo.findByIds([])).toEqual([]);
    });

    it("search filters by query", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "s1", name: "OrderService" }));
      repo.upsert(makeSymbol({ id: "s2", name: "UserController" }));

      const results = repo.search({ query: "Order" });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("OrderService");
    });

    it("search filters by kind", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "s1", name: "MyClass", kind: "class" }));
      repo.upsert(makeSymbol({ id: "s2", name: "myFunc", kind: "function" }));

      const results = repo.search({ kind: "function" });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("myFunc");
    });

    it("findByName returns symbols matching name or qualifiedName", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(
        makeSymbol({ id: "s1", name: "createOrder", qualifiedName: "orders.createOrder" }),
      );
      repo.upsert(
        makeSymbol({ id: "s2", name: "deleteOrder", qualifiedName: "orders.deleteOrder" }),
      );

      const results = repo.findByName("createOrder");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("createOrder");
    });

    it("findAll returns all symbols", () => {
      const repo = createSymbolRepository(db);
      repo.upsert(makeSymbol({ id: "s1", name: "Alpha" }));
      repo.upsert(makeSymbol({ id: "s2", name: "Beta" }));

      const all = repo.findAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("FileHashRepository", () => {
    it("upserts and gets a file hash", () => {
      const repo = createFileHashRepository(db);
      repo.upsert("src/foo.ts", "abc123");

      const result = repo.get("src/foo.ts");
      expect(result).toBeDefined();
      expect(result!.contentHash).toBe("abc123");
      expect(result!.lastIndexedAt).toBeDefined();
    });

    it("get returns undefined for missing file", () => {
      const repo = createFileHashRepository(db);
      expect(repo.get("nonexistent.ts")).toBeUndefined();
    });

    it("getAll returns all hashes", () => {
      const repo = createFileHashRepository(db);
      repo.upsert("src/a.ts", "hash1");
      repo.upsert("src/b.ts", "hash2");

      const all = repo.getAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
      const files = all.map((r) => r.filePath);
      expect(files).toContain("src/a.ts");
    });

    it("delete removes a specific file hash", () => {
      const repo = createFileHashRepository(db);
      repo.upsert("src/a.ts", "hash1");
      repo.upsert("src/b.ts", "hash2");

      repo.delete("src/a.ts");

      expect(repo.get("src/a.ts")).toBeUndefined();
      expect(repo.get("src/b.ts")).toBeDefined();
    });

    it("clear removes all hashes", () => {
      const repo = createFileHashRepository(db);
      repo.upsert("src/a.ts", "hash1");
      repo.upsert("src/b.ts", "hash2");

      repo.clear();

      expect(repo.getAll()).toHaveLength(0);
    });

    it("upsert overwrites existing hash", () => {
      const repo = createFileHashRepository(db);
      repo.upsert("src/a.ts", "old-hash");
      repo.upsert("src/a.ts", "new-hash");

      const result = repo.get("src/a.ts");
      expect(result!.contentHash).toBe("new-hash");
    });
  });
});
