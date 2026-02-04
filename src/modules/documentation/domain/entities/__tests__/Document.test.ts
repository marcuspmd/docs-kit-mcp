import { describe, it, expect } from "@jest/globals";
import { Document, type DocumentProps } from "../Document.js";

describe("Document Entity", () => {
  const baseProps: DocumentProps = {
    path: "docs/test.md",
    content: "# Test Document\n\nContent here",
  };

  describe("create", () => {
    it("should create a Document instance", () => {
      const doc = Document.create(baseProps);

      expect(doc).toBeInstanceOf(Document);
      expect(doc.id).toBe("docs/test.md");
    });

    it("should use path as ID", () => {
      const doc = Document.create({ ...baseProps, path: "docs/another.md" });

      expect(doc.id).toBe("docs/another.md");
    });

    it("should create with optional properties", () => {
      const date = new Date("2024-01-01");
      const doc = Document.create({
        ...baseProps,
        title: "Test Title",
        frontmatter: { tags: ["test"] },
        symbols: ["symbol1", "symbol2"],
        lastModified: date,
      });

      expect(doc.title).toBe("Test Title");
      expect(doc.frontmatter).toEqual({ tags: ["test"] });
      expect(doc.symbols).toEqual(["symbol1", "symbol2"]);
      expect(doc.lastModified).toBe(date);
    });
  });

  describe("fromPersistence", () => {
    it("should create a Document from persistence data", () => {
      const doc = Document.fromPersistence("docs/test.md", baseProps);

      expect(doc).toBeInstanceOf(Document);
      expect(doc.id).toBe("docs/test.md");
    });

    it("should restore with all properties", () => {
      const date = new Date("2024-01-01");
      const doc = Document.fromPersistence("docs/test.md", {
        path: "docs/test.md",
        title: "Restored Title",
        content: "Restored content",
        frontmatter: { author: "Test" },
        symbols: ["sym1"],
        lastModified: date,
      });

      expect(doc.path).toBe("docs/test.md");
      expect(doc.title).toBe("Restored Title");
      expect(doc.content).toBe("Restored content");
      expect(doc.frontmatter).toEqual({ author: "Test" });
      expect(doc.symbols).toEqual(["sym1"]);
      expect(doc.lastModified).toBe(date);
    });
  });

  describe("getters", () => {
    it("should return path", () => {
      const doc = Document.create(baseProps);

      expect(doc.path).toBe("docs/test.md");
    });

    it("should return content", () => {
      const doc = Document.create(baseProps);

      expect(doc.content).toBe("# Test Document\n\nContent here");
    });

    it("should return undefined title when not provided", () => {
      const doc = Document.create(baseProps);

      expect(doc.title).toBeUndefined();
    });

    it("should return title when provided", () => {
      const doc = Document.create({ ...baseProps, title: "My Title" });

      expect(doc.title).toBe("My Title");
    });

    it("should return undefined frontmatter when not provided", () => {
      const doc = Document.create(baseProps);

      expect(doc.frontmatter).toBeUndefined();
    });

    it("should return frontmatter when provided", () => {
      const doc = Document.create({ ...baseProps, frontmatter: { key: "value" } });

      expect(doc.frontmatter).toEqual({ key: "value" });
    });

    it("should return empty symbols array when not provided", () => {
      const doc = Document.create(baseProps);

      expect(doc.symbols).toEqual([]);
    });

    it("should return symbols when provided", () => {
      const doc = Document.create({ ...baseProps, symbols: ["sym1", "sym2"] });

      expect(doc.symbols).toEqual(["sym1", "sym2"]);
    });

    it("should return undefined lastModified when not provided", () => {
      const doc = Document.create(baseProps);

      expect(doc.lastModified).toBeUndefined();
    });

    it("should return lastModified when provided", () => {
      const date = new Date("2024-01-01");
      const doc = Document.create({ ...baseProps, lastModified: date });

      expect(doc.lastModified).toBe(date);
    });
  });

  describe("updateContent", () => {
    it("should return new Document with updated content", () => {
      const doc = Document.create(baseProps);
      const updated = doc.updateContent("New content");

      expect(updated).toBeInstanceOf(Document);
      expect(updated.content).toBe("New content");
      expect(updated.path).toBe(doc.path);
      expect(updated.id).toBe(doc.id);
    });

    it("should update lastModified when updating content", () => {
      const doc = Document.create(baseProps);
      const before = Date.now();
      const updated = doc.updateContent("New content");
      const after = Date.now();

      expect(updated.lastModified).toBeDefined();
      expect(updated.lastModified!.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated.lastModified!.getTime()).toBeLessThanOrEqual(after);
    });

    it("should not mutate original document", () => {
      const doc = Document.create(baseProps);
      const originalContent = doc.content;

      doc.updateContent("New content");

      expect(doc.content).toBe(originalContent);
    });
  });

  describe("addSymbol", () => {
    it("should return new Document with added symbol", () => {
      const doc = Document.create(baseProps);
      const updated = doc.addSymbol("new-symbol");

      expect(updated).toBeInstanceOf(Document);
      expect(updated.symbols).toContain("new-symbol");
      expect(updated.id).toBe(doc.id);
    });

    it("should append symbol to existing symbols", () => {
      const doc = Document.create({ ...baseProps, symbols: ["existing"] });
      const updated = doc.addSymbol("new-symbol");

      expect(updated.symbols).toEqual(["existing", "new-symbol"]);
    });

    it("should handle adding first symbol", () => {
      const doc = Document.create(baseProps);
      const updated = doc.addSymbol("first-symbol");

      expect(updated.symbols).toEqual(["first-symbol"]);
    });

    it("should not mutate original document", () => {
      const doc = Document.create({ ...baseProps, symbols: ["original"] });
      const originalSymbols = [...doc.symbols];

      doc.addSymbol("new-symbol");

      expect(doc.symbols).toEqual(originalSymbols);
    });
  });
});
