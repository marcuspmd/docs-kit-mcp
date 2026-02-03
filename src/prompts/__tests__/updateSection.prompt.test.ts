import { jest } from "@jest/globals";
import { buildUpdateSectionPrompt } from "../updateSection.prompt.js";
import type { ResolvedConfig } from "../../configLoader.js";
import type { LlmProvider } from "../../llm/provider.js";

jest.unstable_mockModule("../../di/container.js", () => ({
  container: {
    resolve: jest.fn(),
  },
}));

describe("updateSection.prompt", () => {
  const mockConfig: ResolvedConfig = {
    llm: {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4",
      maxTokens: 4096,
      temperature: 0.7,
    },
    projectRoot: "/test",
    include: ["src/**/*.ts"],
    exclude: ["node_modules/**"],
    docsDir: "docs",
    outputDir: "docs-output",
    repositoryUrl: "https://github.com/test/repo",
    maxConcurrency: 5,
    dryRun: false,
  } as any;

  const mockLlm: LlmProvider = {
    chat: jest.fn().mockResolvedValue("Updated documentation section"),
    embed: jest.fn().mockResolvedValue([[0.1, 0.2]]),
  };

  describe("buildUpdateSectionPrompt", () => {
    it("should build update section prompt with provided LLM", async () => {
      const input = {
        symbolName: "OrderService.createOrder",
        changeType: "method_signature_change",
        diff: "- public createOrder(items: Item[])\n+ public createOrder(items: Item[], options: OrderOptions)",
        currentSection: "## createOrder\nCreates a new order.",
      };

      const result = await buildUpdateSectionPrompt(input, mockConfig, mockLlm);

      expect(mockLlm.chat).toHaveBeenCalled();
      expect(result).toBe("Updated documentation section");

      const callArgs = (mockLlm.chat as jest.Mock).mock.calls[0];
      const messageContent = callArgs[0][0].content;
      expect(messageContent).toContain("OrderService.createOrder");
      expect(messageContent).toContain("method_signature_change");
      expect(messageContent).toContain("+");
      expect(messageContent).toContain("## createOrder");
    });

    it("should pass correct LLM options", async () => {
      const input = {
        symbolName: "test",
        changeType: "minor",
        diff: "some diff",
        currentSection: "current section",
      };

      await buildUpdateSectionPrompt(input, mockConfig, mockLlm);

      const callArgs = (mockLlm.chat as jest.Mock).mock.calls[0];
      const options = callArgs[1];
      expect(options).toEqual({
        maxTokens: 4096,
        temperature: 0.7,
      });
    });

    it("should fallback to current section on LLM error", async () => {
      const mockLlmError = {
        chat: jest.fn().mockRejectedValue(new Error("LLM error")),
        embed: jest.fn(),
      } as any;

      const input = {
        symbolName: "test",
        changeType: "major",
        diff: "diff content",
        currentSection: "original section",
      };

      const result = await buildUpdateSectionPrompt(input, mockConfig, mockLlmError);

      expect(result).toBe("original section");
    });

    it("should handle empty sections", async () => {
      const input = {
        symbolName: "NewFunction",
        changeType: "new_symbol",
        diff: "+ export function newFunction() { }",
        currentSection: "",
      };

      const result = await buildUpdateSectionPrompt(input, mockConfig, mockLlm);

      expect(mockLlm.chat).toHaveBeenCalled();
      expect(result).toBe("Updated documentation section");
    });

    it("should handle large diffs", async () => {
      const largeDiff = Array(100)
        .fill(0)
        .map((_, i) => `+ line ${i}`)
        .join("\n");

      const input = {
        symbolName: "LargeClass",
        changeType: "major_refactoring",
        diff: largeDiff,
        currentSection: "old",
      };

      const result = await buildUpdateSectionPrompt(input, mockConfig, mockLlm);

      expect(result).toBe("Updated documentation section");
      const callArgs = (mockLlm.chat as jest.Mock).mock.calls[0];
      const messageContent = callArgs[0][0].content;
      expect(messageContent).toContain("line 50");
    });
  });
});
