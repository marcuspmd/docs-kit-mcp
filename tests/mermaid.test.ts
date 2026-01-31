import { generateMermaid } from "../src/docs/mermaidGenerator.js";
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

describe("MermaidGenerator", () => {
  describe("classDiagram", () => {
    it("generates class with methods", () => {
      const symbols = [
        sym({ id: "c1", name: "OrderService", kind: "class" }),
        sym({ id: "m1", name: "createOrder", kind: "method", parent: "c1" }),
        sym({ id: "m2", name: "cancelOrder", kind: "method", parent: "c1" }),
      ];

      const result = generateMermaid(
        { symbols: ["OrderService"], type: "classDiagram" },
        symbols,
        [],
      );

      expect(result).toContain("classDiagram");
      expect(result).toContain("class OrderService {");
      expect(result).toContain("+createOrder()");
      expect(result).toContain("+cancelOrder()");
    });

    it("generates relationships between classes", () => {
      const symbols = [
        sym({ id: "c1", name: "OrderService", kind: "class" }),
        sym({ id: "c2", name: "PaymentService", kind: "class" }),
      ];
      const rels = [rel("c1", "c2", "calls")];

      const result = generateMermaid(
        { symbols: ["OrderService", "PaymentService"], type: "classDiagram" },
        symbols,
        rels,
      );

      expect(result).toContain("OrderService --> PaymentService : calls");
    });

    it("marks abstract classes and interfaces", () => {
      const symbols = [
        sym({ id: "a1", name: "BaseService", kind: "abstract_class" }),
        sym({ id: "i1", name: "Serializable", kind: "interface" }),
      ];

      const result = generateMermaid(
        { symbols: ["BaseService", "Serializable"], type: "classDiagram" },
        symbols,
        [],
      );

      expect(result).toContain("<<abstract>>");
      expect(result).toContain("<<interface>>");
    });

    it("respects visibility prefixes", () => {
      const symbols = [
        sym({ id: "c1", name: "Foo", kind: "class" }),
        sym({ id: "m1", name: "pub", kind: "method", parent: "c1", visibility: "public" }),
        sym({ id: "m2", name: "priv", kind: "method", parent: "c1", visibility: "private" }),
        sym({ id: "m3", name: "prot", kind: "method", parent: "c1", visibility: "protected" }),
      ];

      const result = generateMermaid(
        { symbols: ["Foo"], type: "classDiagram" },
        symbols,
        [],
      );

      expect(result).toContain("+pub()");
      expect(result).toContain("-priv()");
      expect(result).toContain("#prot()");
    });

    it("omits relationships when includeRelationships is false", () => {
      const symbols = [
        sym({ id: "c1", name: "A", kind: "class" }),
        sym({ id: "c2", name: "B", kind: "class" }),
      ];
      const rels = [rel("c1", "c2", "calls")];

      const result = generateMermaid(
        { symbols: ["A", "B"], type: "classDiagram", includeRelationships: false },
        symbols,
        rels,
      );

      expect(result).not.toContain("-->");
    });
  });

  describe("sequenceDiagram", () => {
    it("generates participants and interactions", () => {
      const symbols = [
        sym({ id: "s1", name: "OrderService", kind: "service" }),
        sym({ id: "s2", name: "PaymentService", kind: "service" }),
        sym({ id: "s3", name: "EmailService", kind: "service" }),
      ];
      const rels = [
        rel("s1", "s2", "calls"),
        rel("s2", "s3", "calls"),
      ];

      const result = generateMermaid(
        { symbols: ["OrderService"], type: "sequenceDiagram", maxDepth: 2 },
        symbols,
        rels,
      );

      expect(result).toContain("sequenceDiagram");
      expect(result).toContain("participant OrderService");
      expect(result).toContain("participant PaymentService");
      expect(result).toContain("OrderService->>+PaymentService: calls");
    });

    it("returns header only when no relationships", () => {
      const symbols = [sym({ id: "c1", name: "Lonely", kind: "class" })];

      const result = generateMermaid(
        { symbols: ["Lonely"], type: "sequenceDiagram" },
        symbols,
        [],
      );

      expect(result.trim()).toBe("sequenceDiagram");
    });
  });

  describe("flowchart", () => {
    it("generates nodes and edges", () => {
      const symbols = [
        sym({ id: "c1", name: "Controller", kind: "class" }),
        sym({ id: "c2", name: "Service", kind: "class" }),
        sym({ id: "c3", name: "Repository", kind: "class" }),
      ];
      const rels = [
        rel("c1", "c2", "calls"),
        rel("c2", "c3", "uses"),
      ];

      const result = generateMermaid(
        { symbols: ["Controller"], type: "flowchart", maxDepth: 2 },
        symbols,
        rels,
      );

      expect(result).toContain("flowchart TD");
      expect(result).toContain('Controller["Controller"]');
      expect(result).toContain('Service["Service"]');
      expect(result).toContain("Controller -->|calls| Service");
      expect(result).toContain("Service -->|uses| Repository");
    });

    it("omits edges when includeRelationships is false", () => {
      const symbols = [
        sym({ id: "c1", name: "A", kind: "class" }),
        sym({ id: "c2", name: "B", kind: "class" }),
      ];
      const rels = [rel("c1", "c2", "calls")];

      const result = generateMermaid(
        { symbols: ["A", "B"], type: "flowchart", includeRelationships: false },
        symbols,
        rels,
      );

      expect(result).toContain('A["A"]');
      expect(result).not.toContain("-->|");
    });
  });

  describe("maxDepth", () => {
    it("limits relationship traversal depth", () => {
      const symbols = [
        sym({ id: "c1", name: "A", kind: "class" }),
        sym({ id: "c2", name: "B", kind: "class" }),
        sym({ id: "c3", name: "C", kind: "class" }),
      ];
      const rels = [
        rel("c1", "c2", "calls"),
        rel("c2", "c3", "calls"),
      ];

      const depth0 = generateMermaid(
        { symbols: ["A"], type: "flowchart", maxDepth: 0 },
        symbols,
        rels,
      );

      expect(depth0).toContain("A");
      expect(depth0).not.toContain("B");
      expect(depth0).not.toContain("C");

      const depth1 = generateMermaid(
        { symbols: ["A"], type: "flowchart", maxDepth: 1 },
        symbols,
        rels,
      );

      expect(depth1).toContain("A");
      expect(depth1).toContain("B");
      expect(depth1).not.toContain("C");
    });
  });
});
