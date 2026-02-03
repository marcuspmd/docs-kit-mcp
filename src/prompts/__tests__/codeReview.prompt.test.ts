import { buildCodeReviewPrompt_DEPRECATED } from "../codeReview.prompt.js";
import type { CodeReviewInput } from "../codeReview.prompt.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";

describe("codeReview.prompt", () => {
  const createMockSymbol = (overrides?: Partial<CodeSymbol>): CodeSymbol => ({
    id: "test-id",
    name: "testFunction",
    qualifiedName: "module.testFunction",
    kind: "function",
    file: "/test/file.ts",
    startLine: 1,
    endLine: 10,
    signature: "()",
    layer: "application",
    pattern: "factory",
    extends: undefined,
    implements: [],
    deprecated: false,
    ...overrides,
  });

  describe("buildCodeReviewPrompt_DEPRECATED", () => {
    it("should build basic code review prompt", () => {
      const input: CodeReviewInput = {
        diff: "- old code\n+ new code",
        affectedSymbols: [],
        relatedDocs: [],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("senior engineer reviewing a code change");
      expect(prompt).toContain("## Diff");
      expect(prompt).toContain("old code");
      expect(prompt).toContain("new code");
      expect(prompt).toContain("## Instructions");
    });

    it("should include affected symbols", () => {
      const symbols = [
        createMockSymbol({ name: "function1", kind: "function" }),
        createMockSymbol({ name: "class1", kind: "class" }),
      ];

      const input: CodeReviewInput = {
        diff: "some diff",
        affectedSymbols: symbols,
        relatedDocs: [],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Affected Symbols");
      expect(prompt).toContain("function1");
      expect(prompt).toContain("class1");
      expect(prompt).toContain("function");
      expect(prompt).toContain("class");
    });

    it("should include layer and pattern info", () => {
      const symbols = [
        createMockSymbol({
          name: "service",
          kind: "class",
          layer: "service",
          pattern: "singleton",
        }),
      ];

      const input: CodeReviewInput = {
        diff: "diff",
        affectedSymbols: symbols,
        relatedDocs: [],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("service");
      expect(prompt).toContain("singleton");
      expect(prompt).toContain("layer: service");
      expect(prompt).toContain("pattern: singleton");
    });

    it("should include related documentation", () => {
      const input: CodeReviewInput = {
        diff: "diff",
        affectedSymbols: [],
        relatedDocs: [
          { symbolName: "OrderService", docPath: "docs/services/order.md" },
          { symbolName: "OrderItem", docPath: "docs/entities/orderItem.md" },
        ],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Related Documentation");
      expect(prompt).toContain("OrderService");
      expect(prompt).toContain("OrderItem");
      expect(prompt).toContain("docs/services/order.md");
      expect(prompt).toContain("docs/entities/orderItem.md");
    });

    it("should include architecture violations", () => {
      const input: CodeReviewInput = {
        diff: "diff",
        affectedSymbols: [],
        relatedDocs: [],
        architectureViolations: [
          {
            rule: "layer-boundary",
            severity: "error",
            message: "Service layer cannot import from presentation layer",
          },
          {
            rule: "circular-dependency",
            severity: "warning",
            message: "Circular dependency detected",
          },
        ],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Architecture Violations Introduced");
      expect(prompt).toContain("[ERROR]");
      expect(prompt).toContain("[WARNING]");
      expect(prompt).toContain("layer-boundary");
      expect(prompt).toContain("circular-dependency");
    });

    it("should truncate large diffs", () => {
      const largeDiff = Array(2000)
        .fill(0)
        .map((_, i) => `line ${i}`)
        .join("\n");

      const input: CodeReviewInput = {
        diff: largeDiff,
        affectedSymbols: [],
        relatedDocs: [],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("diff truncated");
      expect(prompt).toContain(String(largeDiff.length));
    });

    it("should handle all fields together", () => {
      const symbols = [createMockSymbol({ name: "testFunc" })];
      const input: CodeReviewInput = {
        diff: "- old\n+ new",
        affectedSymbols: symbols,
        relatedDocs: [{ symbolName: "test", docPath: "docs/test.md" }],
        architectureViolations: [{ rule: "test", severity: "error", message: "test violation" }],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("## Diff");
      expect(prompt).toContain("## Affected Symbols");
      expect(prompt).toContain("## Related Documentation");
      expect(prompt).toContain("## Architecture Violations");
      expect(prompt).toContain("## Instructions");
    });

    it("should include all review criteria", () => {
      const input: CodeReviewInput = {
        diff: "diff",
        affectedSymbols: [],
        relatedDocs: [],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).toContain("Summary");
      expect(prompt).toContain("Correctness");
      expect(prompt).toContain("Security");
      expect(prompt).toContain("Performance");
      expect(prompt).toContain("Documentation");
      expect(prompt).toContain("Suggestions");
    });

    it("should not include architecture section when empty", () => {
      const input: CodeReviewInput = {
        diff: "diff",
        affectedSymbols: [],
        relatedDocs: [],
        architectureViolations: [],
      };

      const prompt = buildCodeReviewPrompt_DEPRECATED(input);

      expect(prompt).not.toContain("## Architecture Violations Introduced");
    });
  });
});
