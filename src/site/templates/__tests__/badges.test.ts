import {
  badgeClass,
  visibilityBadge,
  layerBadge,
  statusBadges,
  violationsBadges,
  coverageBadge,
} from "../badges.js";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";

const makeSymbol = (overrides: Partial<CodeSymbol> = {}): CodeSymbol =>
  ({
    id: "s1",
    name: "MyClass",
    kind: "class",
    file: "src/a.ts",
    startLine: 1,
    endLine: 10,
    language: "ts",
    ...overrides,
  }) as CodeSymbol;

describe("badges", () => {
  describe("badgeClass", () => {
    it("returns class-specific classes for class kind", () => {
      const result = badgeClass("class");
      expect(result).toContain("blue");
    });

    it("returns method-specific classes for method kind", () => {
      const result = badgeClass("method");
      expect(result).toContain("purple");
    });

    it("returns function-specific classes for function kind", () => {
      const result = badgeClass("function");
      expect(result).toContain("yellow");
    });

    it("returns default classes for unknown kind", () => {
      const result = badgeClass("unknown-kind");
      expect(result).toContain("gray");
    });

    it("includes base px-2 class always", () => {
      expect(badgeClass("class")).toContain("px-2");
      expect(badgeClass("anything")).toContain("px-2");
    });
  });

  describe("visibilityBadge", () => {
    it("returns empty string for undefined visibility", () => {
      expect(visibilityBadge(undefined)).toBe("");
    });

    it("renders public badge", () => {
      const result = visibilityBadge("public");
      expect(result).toContain("public");
      expect(result).toContain("green");
    });

    it("renders private badge", () => {
      const result = visibilityBadge("private");
      expect(result).toContain("private");
      expect(result).toContain("red");
    });

    it("renders protected badge", () => {
      const result = visibilityBadge("protected");
      expect(result).toContain("protected");
      expect(result).toContain("yellow");
    });

    it("renders unknown visibility with default class", () => {
      const result = visibilityBadge("internal");
      expect(result).toContain("internal");
      expect(result).toContain("gray");
    });
  });

  describe("layerBadge", () => {
    it("returns empty string for undefined layer", () => {
      expect(layerBadge(undefined)).toBe("");
    });

    it("renders domain layer", () => {
      expect(layerBadge("domain")).toContain("green");
    });

    it("renders application layer", () => {
      expect(layerBadge("application")).toContain("blue");
    });

    it("renders infrastructure layer", () => {
      expect(layerBadge("infrastructure")).toContain("yellow");
    });

    it("renders unknown layer with default class", () => {
      const result = layerBadge("custom");
      expect(result).toContain("custom");
      expect(result).toContain("gray");
    });
  });

  describe("statusBadges", () => {
    it("returns empty string for symbol without exported/deprecated", () => {
      const sym = makeSymbol({ exported: false, deprecated: false });
      expect(statusBadges(sym)).toBe("");
    });

    it("includes exported badge when exported", () => {
      const sym = makeSymbol({ exported: true });
      expect(statusBadges(sym)).toContain("exported");
    });

    it("includes deprecated badge when deprecated", () => {
      const sym = makeSymbol({ deprecated: true });
      expect(statusBadges(sym)).toContain("deprecated");
      expect(statusBadges(sym)).toContain("line-through");
    });

    it("includes both badges when both are set", () => {
      const sym = makeSymbol({ exported: true, deprecated: true });
      const result = statusBadges(sym);
      expect(result).toContain("exported");
      expect(result).toContain("deprecated");
    });
  });

  describe("violationsBadges", () => {
    it("returns empty string for no violations", () => {
      const sym = makeSymbol({ violations: [] });
      expect(violationsBadges(sym)).toBe("");
    });

    it("returns empty string for undefined violations", () => {
      const sym = makeSymbol();
      expect(violationsBadges(sym)).toBe("");
    });

    it("renders a badge for each violation", () => {
      const sym = makeSymbol({ violations: ["dead-code", "unused-export"] });
      const result = violationsBadges(sym);
      expect(result).toContain("dead-code");
      expect(result).toContain("unused-export");
      expect(result).toContain("governance.html");
    });

    it("uses custom governance href", () => {
      const sym = makeSymbol({ violations: ["v1"] });
      const result = violationsBadges(sym, "../governance.html");
      expect(result).toContain("../governance.html");
    });
  });

  describe("coverageBadge", () => {
    it("returns empty string for undefined coverage", () => {
      expect(coverageBadge(undefined)).toBe("");
    });

    it("shows green check for >= 80%", () => {
      const result = coverageBadge(85);
      expect(result).toContain("✓");
      expect(result).toContain("green");
    });

    it("shows yellow warning for 50-79%", () => {
      const result = coverageBadge(60);
      expect(result).toContain("~");
      expect(result).toContain("yellow");
    });

    it("shows red warning for 1-49%", () => {
      const result = coverageBadge(30);
      expect(result).toContain("!");
      expect(result).toContain("red");
    });

    it("shows gray X for 0%", () => {
      const result = coverageBadge(0);
      expect(result).toContain("✗");
      expect(result).toContain("gray");
    });

    it("includes coverage percentage in output", () => {
      const result = coverageBadge(95.5);
      expect(result).toContain("95.5%");
    });
  });
});
