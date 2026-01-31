import {
  parseFrontmatter,
  serializeFrontmatter,
  updateFrontmatter,
} from "../src/docs/frontmatter.js";

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
