import { diffSymbols } from "../src/analyzer/astDiff.js";
import type { CodeSymbol } from "../src/indexer/symbol.types.js";

function sym(
  overrides: Partial<CodeSymbol> & Pick<CodeSymbol, "name" | "kind" | "startLine" | "endLine">,
): CodeSymbol {
  return {
    id: `test:${overrides.name}:${overrides.kind}`,
    file: "src/test.ts",
    ...overrides,
  } as CodeSymbol;
}

describe("diffSymbols", () => {
  it("returns empty array when symbols are identical", () => {
    const symbols = [sym({ name: "Foo", kind: "class", startLine: 1, endLine: 10 })];
    expect(diffSymbols(symbols, symbols)).toEqual([]);
  });

  it("detects added symbols", () => {
    const oldSyms: CodeSymbol[] = [];
    const newSyms = [sym({ name: "Bar", kind: "function", startLine: 1, endLine: 5 })];

    const changes = diffSymbols(oldSyms, newSyms);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("added");
    expect(changes[0].symbol.name).toBe("Bar");
  });

  it("detects removed symbols", () => {
    const oldSyms = [sym({ name: "Bar", kind: "function", startLine: 1, endLine: 5 })];
    const newSyms: CodeSymbol[] = [];

    const changes = diffSymbols(oldSyms, newSyms);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("removed");
  });

  it("detects body_changed when size differs", () => {
    const oldSyms = [sym({ name: "Foo", kind: "class", startLine: 1, endLine: 10 })];
    const newSyms = [sym({ name: "Foo", kind: "class", startLine: 1, endLine: 15 })];

    const changes = diffSymbols(oldSyms, newSyms);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("body_changed");
    expect(changes[0].details).toContain("10");
    expect(changes[0].details).toContain("15");
    expect(changes[0].oldSymbol).toBeDefined();
  });

  it("detects moved when lines shift but size stays the same", () => {
    const oldSyms = [sym({ name: "Foo", kind: "class", startLine: 1, endLine: 10 })];
    const newSyms = [sym({ name: "Foo", kind: "class", startLine: 5, endLine: 14 })];

    const changes = diffSymbols(oldSyms, newSyms);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("moved");
  });

  it("detects signature_changed when signature field differs", () => {
    const oldSyms = [
      sym({
        name: "greet",
        kind: "function",
        startLine: 1,
        endLine: 3,
        signature: "greet(name: string): void",
      }),
    ];
    const newSyms = [
      sym({
        name: "greet",
        kind: "function",
        startLine: 1,
        endLine: 3,
        signature: "greet(name: string, age: number): void",
      }),
    ];

    const changes = diffSymbols(oldSyms, newSyms);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("signature_changed");
  });

  it("handles mixed adds, removes, and modifications", () => {
    const oldSyms = [
      sym({ name: "A", kind: "class", startLine: 1, endLine: 10 }),
      sym({ name: "B", kind: "function", startLine: 12, endLine: 20 }),
    ];
    const newSyms = [
      sym({ name: "A", kind: "class", startLine: 1, endLine: 15 }),
      sym({ name: "C", kind: "interface", startLine: 17, endLine: 25 }),
    ];

    const changes = diffSymbols(oldSyms, newSyms);
    const types = changes.map((c) => c.changeType).sort();
    expect(types).toEqual(["added", "body_changed", "removed"]);
  });
});
