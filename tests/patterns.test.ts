import { createPatternAnalyzer } from "../src/patterns/patternAnalyzer.js";
import type { CodeSymbol, SymbolRelationship } from "../src/indexer/symbol.types.js";

function sym(overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol {
  return {
    kind: "class",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    ...overrides,
  } as CodeSymbol;
}

function rel(source: string, target: string, type: string): SymbolRelationship {
  return { sourceId: source, targetId: target, type } as SymbolRelationship;
}

describe("PatternAnalyzer", () => {
  const analyzer = createPatternAnalyzer();

  describe("Observer", () => {
    it("detects event with matching listener", () => {
      const symbols = [
        sym({ id: "e1", name: "OrderEvents", kind: "event" }),
        sym({ id: "l1", name: "OrderListener", kind: "listener" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const observer = results.find((r) => r.kind === "observer");

      expect(observer).toBeDefined();
      expect(observer!.symbols).toContain("e1");
      expect(observer!.symbols).toContain("l1");
      expect(observer!.confidence).toBe(0.9);
      expect(observer!.violations).toHaveLength(0);
    });

    it("flags orphan event with no listener", () => {
      const symbols = [sym({ id: "e1", name: "PaymentEvents", kind: "event" })];
      const results = analyzer.analyze(symbols, []);
      const observer = results.find((r) => r.kind === "observer");

      expect(observer).toBeDefined();
      expect(observer!.confidence).toBe(0.6);
      expect(observer!.violations).toContain("No listeners found for event 'PaymentEvents'");
    });

    it("matches listener via relationship", () => {
      const symbols = [
        sym({ id: "e1", name: "AppEvent", kind: "event" }),
        sym({ id: "l1", name: "SomeHandler", kind: "listener" }),
      ];
      const rels = [rel("l1", "e1", "uses")];
      const results = analyzer.analyze(symbols, rels);
      const observer = results.find((r) => r.kind === "observer");

      expect(observer!.symbols).toContain("l1");
      expect(observer!.confidence).toBe(0.9);
    });
  });

  describe("Factory", () => {
    it("detects class with create methods", () => {
      const symbols = [
        sym({ id: "f1", name: "UserFactory", kind: "class" }),
        sym({ id: "m1", name: "createAdmin", kind: "method", parent: "f1" }),
        sym({ id: "m2", name: "createGuest", kind: "method", parent: "f1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const factory = results.find((r) => r.kind === "factory");

      expect(factory).toBeDefined();
      expect(factory!.symbols).toContain("f1");
      expect(factory!.symbols).toContain("m1");
      expect(factory!.symbols).toContain("m2");
    });

    it("higher confidence with instantiation relationships", () => {
      const symbols = [
        sym({ id: "f1", name: "UserFactory", kind: "class" }),
        sym({ id: "m1", name: "createUser", kind: "method", parent: "f1" }),
        sym({ id: "u1", name: "User", kind: "class" }),
      ];
      const rels = [rel("m1", "u1", "instantiates")];
      const results = analyzer.analyze(symbols, rels);
      const factory = results.find((r) => r.kind === "factory");

      expect(factory!.confidence).toBe(0.9);
      expect(factory!.violations).toHaveLength(0);
    });

    it("flags factory without instantiations", () => {
      const symbols = [
        sym({ id: "f1", name: "ThingFactory", kind: "class" }),
        sym({ id: "m1", name: "buildThing", kind: "method", parent: "f1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const factory = results.find((r) => r.kind === "factory");

      expect(factory!.violations[0]).toMatch(/no detected instantiations/);
    });

    it("ignores classes without factory methods", () => {
      const symbols = [
        sym({ id: "c1", name: "RegularClass", kind: "class" }),
        sym({ id: "m1", name: "doSomething", kind: "method", parent: "c1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      expect(results.find((r) => r.kind === "factory")).toBeUndefined();
    });
  });

  describe("Singleton", () => {
    it("detects class with private constructor and static instance", () => {
      const symbols = [
        sym({ id: "s1", name: "AppConfig", kind: "class" }),
        sym({
          id: "c1",
          name: "constructor",
          kind: "constructor",
          parent: "s1",
          visibility: "private",
        }),
        sym({ id: "g1", name: "getInstance", kind: "method", parent: "s1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const singleton = results.find((r) => r.kind === "singleton");

      expect(singleton).toBeDefined();
      expect(singleton!.confidence).toBe(0.95);
      expect(singleton!.violations).toHaveLength(0);
    });

    it("flags private constructor without static instance", () => {
      const symbols = [
        sym({ id: "s1", name: "Locked", kind: "class" }),
        sym({
          id: "c1",
          name: "constructor",
          kind: "constructor",
          parent: "s1",
          visibility: "private",
        }),
      ];
      const results = analyzer.analyze(symbols, []);
      const singleton = results.find((r) => r.kind === "singleton");

      expect(singleton!.confidence).toBe(0.6);
      expect(singleton!.violations[0]).toMatch(/no static instance accessor/);
    });

    it("flags static instance without private constructor", () => {
      const symbols = [
        sym({ id: "s1", name: "Loose", kind: "class" }),
        sym({ id: "g1", name: "getInstance", kind: "method", parent: "s1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const singleton = results.find((r) => r.kind === "singleton");

      expect(singleton!.confidence).toBe(0.6);
      expect(singleton!.violations[0]).toMatch(/constructor is not private/);
    });
  });

  describe("Strategy", () => {
    it("detects interface with multiple implementors", () => {
      const symbols = [
        sym({ id: "i1", name: "PaymentStrategy", kind: "interface" }),
        sym({ id: "c1", name: "CreditCard", kind: "class", implements: ["i1"] }),
        sym({ id: "c2", name: "PayPal", kind: "class", implements: ["i1"] }),
      ];
      const rels = [rel("ctx", "i1", "uses")];
      const results = analyzer.analyze(symbols, rels);
      const strategy = results.find((r) => r.kind === "strategy");

      expect(strategy).toBeDefined();
      expect(strategy!.symbols).toContain("i1");
      expect(strategy!.symbols).toContain("c1");
      expect(strategy!.symbols).toContain("c2");
      expect(strategy!.confidence).toBe(0.85);
    });

    it("flags strategy without consumer", () => {
      const symbols = [
        sym({ id: "i1", name: "Sorter", kind: "interface" }),
        sym({ id: "c1", name: "QuickSort", kind: "class", implements: ["i1"] }),
        sym({ id: "c2", name: "MergeSort", kind: "class", implements: ["i1"] }),
      ];
      const results = analyzer.analyze(symbols, []);
      const strategy = results.find((r) => r.kind === "strategy");

      expect(strategy!.confidence).toBe(0.6);
      expect(strategy!.violations[0]).toMatch(/no detected consumer/);
    });

    it("ignores interface with single implementor", () => {
      const symbols = [
        sym({ id: "i1", name: "Logger", kind: "interface" }),
        sym({ id: "c1", name: "ConsoleLogger", kind: "class", implements: ["i1"] }),
      ];
      const results = analyzer.analyze(symbols, []);
      expect(results.find((r) => r.kind === "strategy")).toBeUndefined();
    });
  });

  describe("Repository", () => {
    it("detects repository with CRUD methods and entity", () => {
      const symbols = [
        sym({ id: "r1", name: "UserRepository", kind: "repository" }),
        sym({ id: "m1", name: "findById", kind: "method", parent: "r1" }),
        sym({ id: "m2", name: "save", kind: "method", parent: "r1" }),
        sym({ id: "m3", name: "delete", kind: "method", parent: "r1" }),
        sym({ id: "e1", name: "User", kind: "entity" }),
      ];
      const rels = [rel("r1", "e1", "uses")];
      const results = analyzer.analyze(symbols, rels);
      const repo = results.find((r) => r.kind === "repository");

      expect(repo).toBeDefined();
      expect(repo!.confidence).toBe(1);
      expect(repo!.violations).toHaveLength(0);
    });

    it("detects class ending in Repository by naming convention", () => {
      const symbols = [
        sym({ id: "r1", name: "OrderRepository", kind: "class" }),
        sym({ id: "m1", name: "findAll", kind: "method", parent: "r1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const repo = results.find((r) => r.kind === "repository");

      expect(repo).toBeDefined();
      expect(repo!.symbols).toContain("r1");
    });

    it("flags repository without entity", () => {
      const symbols = [
        sym({ id: "r1", name: "ThingRepository", kind: "repository" }),
        sym({ id: "m1", name: "findById", kind: "method", parent: "r1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const repo = results.find((r) => r.kind === "repository");

      expect(repo!.violations).toContain("Repository 'ThingRepository' has no associated entity");
    });

    it("flags repository without CRUD methods", () => {
      const symbols = [
        sym({ id: "r1", name: "BadRepo", kind: "repository" }),
        sym({ id: "m1", name: "doSomething", kind: "method", parent: "r1" }),
      ];
      const results = analyzer.analyze(symbols, []);
      const repo = results.find((r) => r.kind === "repository");

      expect(repo!.violations).toContain("Repository 'BadRepo' has no standard CRUD methods");
    });
  });

  it("returns empty for symbols with no patterns", () => {
    const symbols = [
      sym({ id: "c1", name: "Utils", kind: "class" }),
      sym({ id: "m1", name: "helper", kind: "method", parent: "c1" }),
    ];
    const results = analyzer.analyze(symbols, []);
    expect(results).toHaveLength(0);
  });
});
