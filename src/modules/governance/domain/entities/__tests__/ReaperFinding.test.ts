import { describe, it, expect } from "@jest/globals";
import { ReaperFinding, type ReaperFindingProps } from "../ReaperFinding.js";

describe("ReaperFinding Entity", () => {
  const baseProps: ReaperFindingProps = {
    type: "dead_code",
    target: "src/utils/oldHelper.ts",
    reason: "Function is never called",
    suggestedAction: "Remove the unused function",
  };

  describe("create", () => {
    it("should create a ReaperFinding instance", () => {
      const finding = ReaperFinding.create(baseProps);

      expect(finding).toBeInstanceOf(ReaperFinding);
    });

    it("should generate ID from type and target", () => {
      const finding = ReaperFinding.create(baseProps);

      expect(finding.id).toBe("dead_code::src/utils/oldHelper.ts");
    });

    it("should generate different IDs for different types", () => {
      const finding1 = ReaperFinding.create({ ...baseProps, type: "dead_code" });
      const finding2 = ReaperFinding.create({ ...baseProps, type: "unused_export" });

      expect(finding1.id).not.toBe(finding2.id);
    });

    it("should generate different IDs for different targets", () => {
      const finding1 = ReaperFinding.create({ ...baseProps, target: "file1.ts" });
      const finding2 = ReaperFinding.create({ ...baseProps, target: "file2.ts" });

      expect(finding1.id).not.toBe(finding2.id);
    });
  });

  describe("getters", () => {
    it("should return type", () => {
      const finding = ReaperFinding.create(baseProps);

      expect(finding.type).toBe("dead_code");
    });

    it("should return target", () => {
      const finding = ReaperFinding.create(baseProps);

      expect(finding.target).toBe("src/utils/oldHelper.ts");
    });

    it("should return reason", () => {
      const finding = ReaperFinding.create(baseProps);

      expect(finding.reason).toBe("Function is never called");
    });

    it("should return suggestedAction", () => {
      const finding = ReaperFinding.create(baseProps);

      expect(finding.suggestedAction).toBe("Remove the unused function");
    });
  });

  describe("all finding types", () => {
    const types: Array<ReaperFindingProps["type"]> = [
      "unused_export",
      "dead_code",
      "unreachable",
      "orphan_file",
    ];

    types.forEach((type) => {
      it(`should create finding with type: ${type}`, () => {
        const finding = ReaperFinding.create({ ...baseProps, type });

        expect(finding.type).toBe(type);
      });
    });
  });

  describe("various scenarios", () => {
    it("should handle unused export finding", () => {
      const finding = ReaperFinding.create({
        type: "unused_export",
        target: "src/services/UserService.ts::oldFunction",
        reason: "Export is never imported anywhere",
        suggestedAction: "Remove export or make it internal",
      });

      expect(finding.type).toBe("unused_export");
      expect(finding.id).toBe("unused_export::src/services/UserService.ts::oldFunction");
    });

    it("should handle unreachable code finding", () => {
      const finding = ReaperFinding.create({
        type: "unreachable",
        target: "src/utils/helper.ts:42",
        reason: "Code after return statement",
        suggestedAction: "Remove unreachable code",
      });

      expect(finding.type).toBe("unreachable");
      expect(finding.reason).toBe("Code after return statement");
    });

    it("should handle orphan file finding", () => {
      const finding = ReaperFinding.create({
        type: "orphan_file",
        target: "src/legacy/old-module.ts",
        reason: "File is not imported by any other file",
        suggestedAction: "Delete file or add to usage",
      });

      expect(finding.type).toBe("orphan_file");
      expect(finding.suggestedAction).toBe("Delete file or add to usage");
    });
  });
});
