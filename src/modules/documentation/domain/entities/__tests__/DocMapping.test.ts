import { describe, it, expect } from "@jest/globals";
import { DocMapping, type DocMappingProps } from "../DocMapping.js";

describe("DocMapping Entity", () => {
  const baseProps: DocMappingProps = {
    symbolName: "TestClass",
    docPath: "docs/test.md",
  };

  describe("create", () => {
    it("should create a DocMapping instance", () => {
      const mapping = DocMapping.create(baseProps);

      expect(mapping).toBeInstanceOf(DocMapping);
      expect(mapping.id).toBe("TestClass::docs/test.md");
    });

    it("should generate ID from symbolName and docPath", () => {
      const mapping = DocMapping.create({
        symbolName: "AnotherClass",
        docPath: "docs/another.md",
      });

      expect(mapping.id).toBe("AnotherClass::docs/another.md");
    });

    it("should create with optional section", () => {
      const mapping = DocMapping.create({ ...baseProps, section: "## Methods" });

      expect(mapping.section).toBe("## Methods");
    });

    it("should create with optional updatedAt", () => {
      const date = new Date("2024-01-01");
      const mapping = DocMapping.create({ ...baseProps, updatedAt: date });

      expect(mapping.updatedAt).toBe(date);
    });
  });

  describe("fromPersistence", () => {
    it("should create a DocMapping from persistence data", () => {
      const mapping = DocMapping.fromPersistence(baseProps);

      expect(mapping).toBeInstanceOf(DocMapping);
      expect(mapping.id).toBe("TestClass::docs/test.md");
    });

    it("should restore with all properties", () => {
      const date = new Date("2024-01-01");
      const mapping = DocMapping.fromPersistence({
        symbolName: "TestClass",
        docPath: "docs/test.md",
        section: "## Overview",
        updatedAt: date,
      });

      expect(mapping.symbolName).toBe("TestClass");
      expect(mapping.docPath).toBe("docs/test.md");
      expect(mapping.section).toBe("## Overview");
      expect(mapping.updatedAt).toBe(date);
    });
  });

  describe("getters", () => {
    it("should return symbolName", () => {
      const mapping = DocMapping.create(baseProps);

      expect(mapping.symbolName).toBe("TestClass");
    });

    it("should return docPath", () => {
      const mapping = DocMapping.create(baseProps);

      expect(mapping.docPath).toBe("docs/test.md");
    });

    it("should return undefined section when not provided", () => {
      const mapping = DocMapping.create(baseProps);

      expect(mapping.section).toBeUndefined();
    });

    it("should return section when provided", () => {
      const mapping = DocMapping.create({ ...baseProps, section: "## Details" });

      expect(mapping.section).toBe("## Details");
    });

    it("should return undefined updatedAt when not provided", () => {
      const mapping = DocMapping.create(baseProps);

      expect(mapping.updatedAt).toBeUndefined();
    });

    it("should return updatedAt when provided", () => {
      const date = new Date("2024-01-01");
      const mapping = DocMapping.create({ ...baseProps, updatedAt: date });

      expect(mapping.updatedAt).toBe(date);
    });
  });

  describe("equality", () => {
    it("should have same ID for same symbolName and docPath", () => {
      const mapping1 = DocMapping.create(baseProps);
      const mapping2 = DocMapping.create(baseProps);

      expect(mapping1.id).toBe(mapping2.id);
    });

    it("should have different IDs for different symbolNames", () => {
      const mapping1 = DocMapping.create({ ...baseProps, symbolName: "Class1" });
      const mapping2 = DocMapping.create({ ...baseProps, symbolName: "Class2" });

      expect(mapping1.id).not.toBe(mapping2.id);
    });

    it("should have different IDs for different docPaths", () => {
      const mapping1 = DocMapping.create({ ...baseProps, docPath: "docs/test1.md" });
      const mapping2 = DocMapping.create({ ...baseProps, docPath: "docs/test2.md" });

      expect(mapping1.id).not.toBe(mapping2.id);
    });
  });
});
