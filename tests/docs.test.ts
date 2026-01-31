import {
  parseFrontmatter,
  serializeFrontmatter,
  updateFrontmatter,
} from "../src/docs/frontmatter.js";
import Database from "better-sqlite3";
import { createDocRegistry } from "../src/docs/docRegistry.js";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("frontmatter parser", () => {
  const fixture1 = `---
title: User Service
symbols:
  - UserService
  - UserService.findById
lastUpdated: "2025-01-15"
---

# User Service

Manages user CRUD operations.`;

  const fixture2 = `# No Frontmatter

Just plain markdown content.`;

  const fixture3 = `---
title: Empty Symbols
---

# Empty Symbols`;

  const fixture4 = `---
title: Extra Fields
symbols:
  - Foo
custom: bar
tags:
  - api
  - v2
---

Content here.`;

  const fixture5 = `---
symbols:
  - OrderService
  - OrderService.createOrder
  - OrderService.cancelOrder
---
`;

  test("parses valid frontmatter with symbols", () => {
    const result = parseFrontmatter(fixture1);
    expect(result.frontmatter.title).toBe("User Service");
    expect(result.frontmatter.symbols).toEqual([
      "UserService",
      "UserService.findById",
    ]);
    expect(result.frontmatter.lastUpdated).toBe("2025-01-15");
    expect(result.content).toContain("# User Service");
  });

  test("returns empty symbols for files without frontmatter", () => {
    const result = parseFrontmatter(fixture2);
    expect(result.frontmatter.symbols).toEqual([]);
    expect(result.content).toBe(fixture2);
  });

  test("returns empty symbols when symbols field is missing", () => {
    const result = parseFrontmatter(fixture3);
    expect(result.frontmatter.symbols).toEqual([]);
    expect(result.frontmatter.title).toBe("Empty Symbols");
  });

  test("preserves extra fields", () => {
    const result = parseFrontmatter(fixture4);
    expect(result.frontmatter.symbols).toEqual(["Foo"]);
    expect(result.frontmatter.custom).toBe("bar");
    expect(result.frontmatter.tags).toEqual(["api", "v2"]);
  });

  test("handles frontmatter with only symbols", () => {
    const result = parseFrontmatter(fixture5);
    expect(result.frontmatter.symbols).toEqual([
      "OrderService",
      "OrderService.createOrder",
      "OrderService.cancelOrder",
    ]);
  });

  test("serializeFrontmatter round-trips without data loss", () => {
    const parsed = parseFrontmatter(fixture1);
    const serialized = serializeFrontmatter(parsed);
    const reparsed = parseFrontmatter(serialized);
    expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
    expect(reparsed.content).toEqual(parsed.content);
  });

  test("updateFrontmatter modifies only specified fields", () => {
    const updated = updateFrontmatter(fixture1, { lastUpdated: "2025-06-01" });
    const parsed = parseFrontmatter(updated);
    expect(parsed.frontmatter.lastUpdated).toBe("2025-06-01");
    expect(parsed.frontmatter.title).toBe("User Service");
    expect(parsed.frontmatter.symbols).toEqual([
      "UserService",
      "UserService.findById",
    ]);
    expect(parsed.content).toContain("# User Service");
  });

  test("updateFrontmatter adds new fields", () => {
    const updated = updateFrontmatter(fixture2, {
      symbols: ["NewSymbol"],
      title: "New Doc",
    });
    const parsed = parseFrontmatter(updated);
    expect(parsed.frontmatter.symbols).toEqual(["NewSymbol"]);
    expect(parsed.frontmatter.title).toBe("New Doc");
  });

  test("handles empty frontmatter block", () => {
    const md = `---

---

Content after empty frontmatter.`;
    const result = parseFrontmatter(md);
    expect(result.frontmatter.symbols).toEqual([]);
    expect(result.content).toContain("Content after empty frontmatter.");
  });
});

describe("doc registry", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(async () => {
    db = new Database(":memory:");
    tmpDir = await mkdtemp(join(tmpdir(), "dockit-test-"));

    await mkdir(join(tmpDir, "domain"), { recursive: true });

    await writeFile(
      join(tmpDir, "domain", "orders.md"),
      `---
title: Order Service
symbols:
  - OrderService
  - OrderService.createOrder
  - OrderService.cancelOrder
---

# Order Service

Content here.`,
    );

    await writeFile(
      join(tmpDir, "domain", "users.md"),
      `---
title: User Service
symbols:
  - UserService
  - UserService.findById
---

# User Service`,
    );

    await writeFile(
      join(tmpDir, "no-frontmatter.md"),
      `# Plain Doc\n\nNo frontmatter here.`,
    );
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("rebuild populates registry from frontmatter", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const docs = await registry.findDocBySymbol("OrderService");
    expect(docs).toEqual([
      { symbolName: "OrderService", docPath: "domain/orders.md" },
    ]);
  });

  test("findDocBySymbol returns correct mappings", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const docs = await registry.findDocBySymbol("UserService.findById");
    expect(docs).toHaveLength(1);
    expect(docs[0].docPath).toBe("domain/users.md");
  });

  test("findSymbolsByDoc returns all symbols for a file", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const symbols = await registry.findSymbolsByDoc("domain/orders.md");
    expect(symbols.sort()).toEqual([
      "OrderService",
      "OrderService.cancelOrder",
      "OrderService.createOrder",
    ]);
  });

  test("skips docs without frontmatter", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    const symbols = await registry.findSymbolsByDoc("no-frontmatter.md");
    expect(symbols).toEqual([]);
  });

  test("register adds a new mapping", async () => {
    const registry = createDocRegistry(db);
    await registry.register({
      symbolName: "PaymentService",
      docPath: "domain/payments.md",
    });

    const docs = await registry.findDocBySymbol("PaymentService");
    expect(docs).toHaveLength(1);
    expect(docs[0].docPath).toBe("domain/payments.md");
  });

  test("unregister removes mappings for a symbol", async () => {
    const registry = createDocRegistry(db);
    await registry.rebuild(tmpDir);

    await registry.unregister("OrderService");
    const docs = await registry.findDocBySymbol("OrderService");
    expect(docs).toEqual([]);
  });

  test("findDocBySymbol returns empty for unknown symbol", async () => {
    const registry = createDocRegistry(db);
    const docs = await registry.findDocBySymbol("NonExistent");
    expect(docs).toEqual([]);
  });
});
