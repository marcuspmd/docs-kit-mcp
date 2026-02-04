import { describe, it, expect } from "@jest/globals";
import { KnowledgeNode, type KnowledgeNodeProps } from "../KnowledgeNode.js";

describe("KnowledgeNode Entity", () => {
  const baseProps: KnowledgeNodeProps = {
    type: "symbol",
    label: "UserService",
  };

  describe("create", () => {
    it("should create a KnowledgeNode instance", () => {
      const node = KnowledgeNode.create("node-id-123", baseProps);

      expect(node).toBeInstanceOf(KnowledgeNode);
      expect(node.id).toBe("node-id-123");
    });

    it("should use provided ID", () => {
      const node = KnowledgeNode.create("custom-id", baseProps);

      expect(node.id).toBe("custom-id");
    });

    it("should create with minimal properties", () => {
      const node = KnowledgeNode.create("node-1", {
        type: "concept",
        label: "Authentication",
      });

      expect(node.type).toBe("concept");
      expect(node.label).toBe("Authentication");
    });

    it("should create with all optional properties", () => {
      const node = KnowledgeNode.create("node-2", {
        type: "document",
        label: "API Guide",
        content: "This is the content of the document",
        embedding: [0.1, 0.2, 0.3],
        metadata: { author: "John", version: "1.0" },
      });

      expect(node.content).toBe("This is the content of the document");
      expect(node.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(node.metadata).toEqual({ author: "John", version: "1.0" });
    });
  });

  describe("getters", () => {
    it("should return type", () => {
      const node = KnowledgeNode.create("node-1", baseProps);

      expect(node.type).toBe("symbol");
    });

    it("should return label", () => {
      const node = KnowledgeNode.create("node-1", baseProps);

      expect(node.label).toBe("UserService");
    });

    it("should return undefined content when not provided", () => {
      const node = KnowledgeNode.create("node-1", baseProps);

      expect(node.content).toBeUndefined();
    });

    it("should return content when provided", () => {
      const node = KnowledgeNode.create("node-1", {
        ...baseProps,
        content: "Test content",
      });

      expect(node.content).toBe("Test content");
    });

    it("should return undefined embedding when not provided", () => {
      const node = KnowledgeNode.create("node-1", baseProps);

      expect(node.embedding).toBeUndefined();
    });

    it("should return embedding when provided", () => {
      const embedding = [0.5, 0.6, 0.7, 0.8];
      const node = KnowledgeNode.create("node-1", {
        ...baseProps,
        embedding,
      });

      expect(node.embedding).toEqual(embedding);
    });

    it("should return undefined metadata when not provided", () => {
      const node = KnowledgeNode.create("node-1", baseProps);

      expect(node.metadata).toBeUndefined();
    });

    it("should return metadata when provided", () => {
      const metadata = { key: "value", count: 42 };
      const node = KnowledgeNode.create("node-1", {
        ...baseProps,
        metadata,
      });

      expect(node.metadata).toEqual(metadata);
    });
  });

  describe("all node types", () => {
    const types: Array<KnowledgeNodeProps["type"]> = ["symbol", "document", "concept"];

    types.forEach((type) => {
      it(`should create node with type: ${type}`, () => {
        const node = KnowledgeNode.create("node-1", {
          type,
          label: "Test Label",
        });

        expect(node.type).toBe(type);
      });
    });
  });

  describe("various scenarios", () => {
    it("should handle symbol node with embedding", () => {
      const node = KnowledgeNode.create("symbol-123", {
        type: "symbol",
        label: "calculateTotal",
        content: "function calculateTotal(items: Item[]): number",
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        metadata: { kind: "function", file: "utils.ts" },
      });

      expect(node.type).toBe("symbol");
      expect(node.embedding).toHaveLength(5);
      expect(node.metadata).toHaveProperty("kind", "function");
    });

    it("should handle document node", () => {
      const node = KnowledgeNode.create("doc-456", {
        type: "document",
        label: "Getting Started",
        content: "# Getting Started\n\nWelcome to our documentation...",
        metadata: { category: "guides", tags: ["beginner", "tutorial"] },
      });

      expect(node.type).toBe("document");
      expect(node.content).toContain("Getting Started");
      expect(node.metadata).toHaveProperty("tags");
    });

    it("should handle concept node", () => {
      const node = KnowledgeNode.create("concept-789", {
        type: "concept",
        label: "Dependency Injection",
        content: "A design pattern for implementing IoC",
        embedding: [0.9, 0.8, 0.7],
      });

      expect(node.type).toBe("concept");
      expect(node.label).toBe("Dependency Injection");
    });
  });

  describe("metadata handling", () => {
    it("should handle complex nested metadata", () => {
      const node = KnowledgeNode.create("node-1", {
        type: "symbol",
        label: "ComplexClass",
        metadata: {
          nested: {
            deep: {
              value: "test",
            },
          },
          array: [1, 2, 3],
          mixed: { a: 1, b: "text" },
        },
      });

      expect(node.metadata).toHaveProperty("nested");
      expect(node.metadata).toHaveProperty("array");
      expect(node.metadata).toHaveProperty("mixed");
    });
  });
});
