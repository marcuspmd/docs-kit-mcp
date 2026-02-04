import { describe, it, expect } from "@jest/globals";
import { ChangeImpact, type ChangeImpactProps } from "../ChangeImpact.js";

describe("ChangeImpact Entity", () => {
  const baseProps: ChangeImpactProps = {
    symbolId: "test-symbol-id",
    symbolName: "TestSymbol",
    changeType: "modified",
    diff: "+line added\n-line removed",
    docUpdateRequired: true,
  };

  describe("create", () => {
    it("should create a ChangeImpact instance", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact).toBeInstanceOf(ChangeImpact);
      expect(impact.id).toBe("test-symbol-id::modified");
    });

    it("should generate ID from symbolId and changeType", () => {
      const impact = ChangeImpact.create({ ...baseProps, changeType: "added" });

      expect(impact.id).toBe("test-symbol-id::added");
    });
  });

  describe("getters", () => {
    it("should return symbolId", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.symbolId).toBe("test-symbol-id");
    });

    it("should return symbolName", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.symbolName).toBe("TestSymbol");
    });

    it("should return changeType", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.changeType).toBe("modified");
    });

    it("should return diff", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.diff).toBe("+line added\n-line removed");
    });

    it("should return docUpdateRequired", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.docUpdateRequired).toBe(true);
    });

    it("should return breakingChange as false when undefined", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.breakingChange).toBe(false);
    });

    it("should return breakingChange when provided", () => {
      const impact = ChangeImpact.create({ ...baseProps, breakingChange: true });

      expect(impact.breakingChange).toBe(true);
    });

    it("should return severity as 'low' when undefined", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.severity).toBe("low");
    });

    it("should return severity when provided", () => {
      const impact = ChangeImpact.create({ ...baseProps, severity: "critical" });

      expect(impact.severity).toBe("critical");
    });

    it("should return empty directImpacts array when undefined", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.directImpacts).toEqual([]);
    });

    it("should return directImpacts when provided", () => {
      const impact = ChangeImpact.create({
        ...baseProps,
        directImpacts: ["symbol1", "symbol2"],
      });

      expect(impact.directImpacts).toEqual(["symbol1", "symbol2"]);
    });

    it("should return empty indirectImpacts array when undefined", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.indirectImpacts).toEqual([]);
    });

    it("should return indirectImpacts when provided", () => {
      const impact = ChangeImpact.create({
        ...baseProps,
        indirectImpacts: ["symbol3", "symbol4"],
      });

      expect(impact.indirectImpacts).toEqual(["symbol3", "symbol4"]);
    });

    it("should return undefined reason when not provided", () => {
      const impact = ChangeImpact.create(baseProps);

      expect(impact.reason).toBeUndefined();
    });

    it("should return reason when provided", () => {
      const impact = ChangeImpact.create({ ...baseProps, reason: "API changed" });

      expect(impact.reason).toBe("API changed");
    });
  });

  describe("all change types", () => {
    const changeTypes: Array<ChangeImpactProps["changeType"]> = [
      "added",
      "removed",
      "modified",
      "renamed",
      "moved",
      "signature_changed",
      "visibility_changed",
      "behavior_changed",
    ];

    changeTypes.forEach((changeType) => {
      it(`should create impact with changeType: ${changeType}`, () => {
        const impact = ChangeImpact.create({ ...baseProps, changeType });

        expect(impact.changeType).toBe(changeType);
      });
    });
  });

  describe("all severities", () => {
    const severities: Array<ChangeImpactProps["severity"]> = ["low", "medium", "high", "critical"];

    severities.forEach((severity) => {
      it(`should create impact with severity: ${severity}`, () => {
        const impact = ChangeImpact.create({ ...baseProps, severity });

        expect(impact.severity).toBe(severity);
      });
    });
  });
});
