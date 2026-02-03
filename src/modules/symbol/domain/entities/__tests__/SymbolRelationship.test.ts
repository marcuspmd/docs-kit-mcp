import { describe, it, expect } from "@jest/globals";
import {
  SymbolRelationship,
  type SymbolRelationshipProps,
  RelationshipTypeSchema,
} from "../SymbolRelationship.js";

describe("SymbolRelationship", () => {
  const validProps: SymbolRelationshipProps = {
    sourceId: "src::UserService",
    targetId: "src::UserRepository",
    type: "uses",
    confidence: 0.95,
    location: { file: "src/services/UserService.ts", line: 15 },
    inferred: false,
  };

  describe("create()", () => {
    it("should create relationship with all properties", () => {
      const rel = SymbolRelationship.create(validProps);

      expect(rel.sourceId).toBe("src::UserService");
      expect(rel.targetId).toBe("src::UserRepository");
      expect(rel.type).toBe("uses");
      expect(rel.confidence).toBe(0.95);
      expect(rel.location).toEqual({ file: "src/services/UserService.ts", line: 15 });
      expect(rel.inferred).toBe(false);
    });

    it("should create relationship with minimal properties", () => {
      const minimalProps: SymbolRelationshipProps = {
        sourceId: "src::A",
        targetId: "src::B",
        type: "calls",
      };

      const rel = SymbolRelationship.create(minimalProps);

      expect(rel.sourceId).toBe("src::A");
      expect(rel.targetId).toBe("src::B");
      expect(rel.type).toBe("calls");
    });

    it("should generate consistent ID", () => {
      const rel1 = SymbolRelationship.create(validProps);
      const rel2 = SymbolRelationship.create(validProps);

      expect(rel1.id).toBe(rel2.id);
    });

    it("should generate different IDs for different relationships", () => {
      const props2 = {
        ...validProps,
        type: "inherits" as const,
      };

      const rel1 = SymbolRelationship.create(validProps);
      const rel2 = SymbolRelationship.create(props2);

      expect(rel1.id).not.toBe(rel2.id);
    });

    it("should support all predefined relationship types", () => {
      const types: Array<
        | "calls"
        | "inherits"
        | "implements"
        | "instantiates"
        | "uses"
        | "contains"
        | "imports"
        | "exports"
      > = [
        "calls",
        "inherits",
        "implements",
        "instantiates",
        "uses",
        "contains",
        "imports",
        "exports",
      ];

      types.forEach((type) => {
        const rel = SymbolRelationship.create({
          ...validProps,
          type,
        });

        expect(rel.type).toBe(type);
      });
    });

    it("should support custom relationship types", () => {
      const customRel = SymbolRelationship.create({
        ...validProps,
        type: "custom_relationship",
      });

      expect(customRel.type).toBe("custom_relationship");
    });
  });

  describe("Getters", () => {
    let rel: SymbolRelationship;

    beforeEach(() => {
      rel = SymbolRelationship.create(validProps);
    });

    it("should return sourceId", () => {
      expect(rel.sourceId).toBe("src::UserService");
    });

    it("should return targetId", () => {
      expect(rel.targetId).toBe("src::UserRepository");
    });

    it("should return type", () => {
      expect(rel.type).toBe("uses");
    });

    it("should return confidence with default 1.0", () => {
      const relNoConfidence = SymbolRelationship.create({
        sourceId: "A",
        targetId: "B",
        type: "calls",
      });

      expect(relNoConfidence.confidence).toBe(1.0);
    });

    it("should return custom confidence", () => {
      expect(rel.confidence).toBe(0.95);
    });

    it("should return location when provided", () => {
      expect(rel.location).toEqual({ file: "src/services/UserService.ts", line: 15 });
    });

    it("should return undefined location when not provided", () => {
      const relNoLocation = SymbolRelationship.create({
        sourceId: "A",
        targetId: "B",
        type: "calls",
      });

      expect(relNoLocation.location).toBeUndefined();
    });

    it("should return inferred with default false", () => {
      const relNoInferred = SymbolRelationship.create({
        sourceId: "A",
        targetId: "B",
        type: "calls",
      });

      expect(relNoInferred.inferred).toBe(false);
    });

    it("should return true for inferred when set", () => {
      expect(rel.inferred).toBe(false);

      const relInferred = SymbolRelationship.create({
        ...validProps,
        inferred: true,
      });

      expect(relInferred.inferred).toBe(true);
    });
  });

  describe("fromPersistence()", () => {
    it("should reconstitute from persistence", () => {
      const persistenceData: SymbolRelationshipProps = {
        sourceId: "src::UserService",
        targetId: "src::UserRepository",
        type: "uses",
        confidence: 0.9,
        location: { file: "test.ts", line: 10 },
        inferred: true,
      };

      const rel = SymbolRelationship.fromPersistence(persistenceData);

      expect(rel.sourceId).toBe("src::UserService");
      expect(rel.targetId).toBe("src::UserRepository");
      expect(rel.type).toBe("uses");
      expect(rel.confidence).toBe(0.9);
      expect(rel.inferred).toBe(true);
    });

    it("should generate same ID as create", () => {
      const rel1 = SymbolRelationship.create(validProps);
      const rel2 = SymbolRelationship.fromPersistence(validProps);

      expect(rel1.id).toBe(rel2.id);
    });
  });

  describe("toPersistence()", () => {
    let rel: SymbolRelationship;

    beforeEach(() => {
      rel = SymbolRelationship.create(validProps);
    });

    it("should serialize all properties", () => {
      const persistence = rel.toPersistence();

      expect(persistence.sourceId).toBe("src::UserService");
      expect(persistence.targetId).toBe("src::UserRepository");
      expect(persistence.type).toBe("uses");
      expect(persistence.confidence).toBe(0.95);
      expect(persistence.location).toEqual({ file: "src/services/UserService.ts", line: 15 });
      expect(persistence.inferred).toBe(false);
    });

    it("should handle undefined optional fields", () => {
      const minRel = SymbolRelationship.create({
        sourceId: "A",
        targetId: "B",
        type: "calls",
      });

      const persistence = minRel.toPersistence();

      expect(persistence.sourceId).toBe("A");
      expect(persistence.targetId).toBe("B");
      expect(persistence.type).toBe("calls");
      expect(persistence.confidence).toBeUndefined();
      expect(persistence.location).toBeUndefined();
      expect(persistence.inferred).toBeUndefined();
    });

    it("should be suitable for database storage", () => {
      const persistence = rel.toPersistence();

      // Should be serializable
      expect(() => JSON.stringify(persistence)).not.toThrow();

      // Should have expected keys
      expect(Object.keys(persistence)).toContain("sourceId");
      expect(Object.keys(persistence)).toContain("targetId");
      expect(Object.keys(persistence)).toContain("type");
    });
  });

  describe("Entity equality", () => {
    it("should consider relationships with same ID as equal", () => {
      const rel1 = SymbolRelationship.create(validProps);
      const rel2 = SymbolRelationship.create(validProps);

      expect(rel1.equals(rel2)).toBe(true);
    });

    it("should consider relationships with different sourceId as not equal", () => {
      const rel1 = SymbolRelationship.create(validProps);
      const rel2 = SymbolRelationship.create({
        ...validProps,
        sourceId: "different::Id",
      });

      expect(rel1.equals(rel2)).toBe(false);
    });

    it("should be self-equal", () => {
      const rel = SymbolRelationship.create(validProps);

      expect(rel.equals(rel)).toBe(true);
    });

    it("should handle null comparison", () => {
      const rel = SymbolRelationship.create(validProps);

      expect(rel.equals(null as unknown as SymbolRelationship)).toBe(false);
    });

    it("should handle undefined comparison", () => {
      const rel = SymbolRelationship.create(validProps);

      expect(rel.equals(undefined)).toBe(false);
    });
  });

  describe("RelationshipTypeSchema validation", () => {
    it("should accept predefined types", () => {
      const types = [
        "calls",
        "inherits",
        "implements",
        "instantiates",
        "uses",
        "contains",
        "imports",
        "exports",
      ];

      types.forEach((type) => {
        const result = RelationshipTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it("should accept custom types", () => {
      const result = RelationshipTypeSchema.safeParse("custom_type");
      expect(result.success).toBe(true);
    });

    it("should reject empty string", () => {
      const result = RelationshipTypeSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });
});
