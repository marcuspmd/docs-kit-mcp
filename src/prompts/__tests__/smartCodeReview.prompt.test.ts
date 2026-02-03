import { buildSmartCodeReviewPrompt_DEPRECATED } from "../smartCodeReview.prompt.js";
import type { SmartCodeReviewInput } from "../smartCodeReview.prompt.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";

describe("smartCodeReview.prompt", () => {
  const createMockSymbol = (name: string): CodeSymbol => ({
    id: `id-${name}`,
    name,
    qualifiedName: `module.${name}`,
    kind: "function",
    file: "/test/file.ts",
    startLine: 1,
    endLine: 10,
    signature: "()",
    extends: undefined,
    implements: [],
    deprecated: false,
  });

  describe("buildSmartCodeReviewPrompt_DEPRECATED", () => {
    it("should build basic smart code review prompt", () => {
      const input: SmartCodeReviewInput = {
        symbols: [createMockSymbol("func1"), createMockSymbol("func2")],
        architectureViolations: [],
        patterns: [],
        deadCodeFindings: [],
        docCoverage: { documented: 1, total: 2 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("senior architect");
      expect(prompt).toContain("## Codebase Overview");
      expect(prompt).toContain("- **Total symbols**: 2");
      expect(prompt).toContain("- **Documentation coverage**: 1/2");
      expect(prompt).toContain("## Instructions");
    });

    it("should calculate documentation coverage percentage", () => {
      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [],
        patterns: [],
        deadCodeFindings: [],
        docCoverage: { documented: 3, total: 10 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("30%");
    });

    it("should handle zero doc coverage", () => {
      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [],
        patterns: [],
        deadCodeFindings: [],
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("0%");
    });

    it("should include architecture violations", () => {
      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [
          {
            rule: "layer-boundary",
            severity: "error",
            message: "Cannot import from UI in service",
            file: "src/service/order.ts",
          },
          {
            rule: "circular-dep",
            severity: "warning",
            message: "Circular dependency detected",
            file: "src/module/a.ts",
          },
        ],
        patterns: [],
        deadCodeFindings: [],
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Architecture Violations");
      expect(prompt).toContain("[ERROR]");
      expect(prompt).toContain("[WARNING]");
      expect(prompt).toContain("layer-boundary");
      expect(prompt).toContain("Cannot import from UI in service");
    });

    it("should truncate violations to 20", () => {
      const violations = Array(25)
        .fill(0)
        .map((_, i) => ({
          rule: `rule${i}`,
          severity: "error",
          message: `message${i}`,
          file: `file${i}.ts`,
        }));

      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: violations,
        patterns: [],
        deadCodeFindings: [],
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("and 5 more");
    });

    it("should include detected patterns", () => {
      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [],
        patterns: [
          {
            kind: "singleton",
            confidence: 0.95,
            violations: ["Instance created multiple times"],
            symbols: ["DatabaseService"],
          },
          {
            kind: "factory",
            confidence: 0.87,
            violations: [],
            symbols: ["UserFactory"],
          },
        ],
        deadCodeFindings: [],
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Detected Patterns");
      expect(prompt).toContain("singleton");
      expect(prompt).toContain("95%");
      expect(prompt).toContain("factory");
      expect(prompt).toContain("87%");
      expect(prompt).toContain("Instance created multiple times");
    });

    it("should include dead code findings", () => {
      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [],
        patterns: [],
        deadCodeFindings: [
          { target: "unused_function", reason: "Never called" },
          { target: "old_variable", reason: "Never read" },
        ],
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Dead Code");
      expect(prompt).toContain("unused_function");
      expect(prompt).toContain("Never called");
      expect(prompt).toContain("old_variable");
      expect(prompt).toContain("Never read");
    });

    it("should truncate dead code to 15", () => {
      const deadCode = Array(20)
        .fill(0)
        .map((_, i) => ({ target: `dead${i}`, reason: `reason${i}` }));

      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [],
        patterns: [],
        deadCodeFindings: deadCode,
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("and 5 more");
    });

    it("should include all review criteria", () => {
      const input: SmartCodeReviewInput = {
        symbols: [createMockSymbol("test")],
        architectureViolations: [
          {
            rule: "test",
            severity: "error",
            message: "test",
            file: "test.ts",
          },
        ],
        patterns: [
          {
            kind: "test",
            confidence: 0.8,
            violations: [],
            symbols: ["test"],
          },
        ],
        deadCodeFindings: [{ target: "test", reason: "test" }],
        docCoverage: { documented: 1, total: 1 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("Executive Summary");
      expect(prompt).toContain("Critical Issues");
      expect(prompt).toContain("Architecture Recommendations");
      expect(prompt).toContain("Code Quality");
      expect(prompt).toContain("Documentation Gaps");
      expect(prompt).toContain("Action Items");
    });

    it("should handle empty input", () => {
      const input: SmartCodeReviewInput = {
        symbols: [],
        architectureViolations: [],
        patterns: [],
        deadCodeFindings: [],
        docCoverage: { documented: 0, total: 0 },
      };

      const prompt = buildSmartCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Codebase Overview");
      expect(prompt).toContain("0/0");
      expect(prompt).not.toContain("## Architecture Violations");
      expect(prompt).not.toContain("## Detected Patterns");
      expect(prompt).not.toContain("## Dead Code");
      expect(prompt).toContain("## Instructions");
    });
  });
});
