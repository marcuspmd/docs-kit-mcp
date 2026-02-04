import { describe, it, expect } from "@jest/globals";
import { AnalyzeArchitectureUseCase } from "../AnalyzeArchitecture.usecase.js";

describe("AnalyzeArchitectureUseCase", () => {
  let useCase: AnalyzeArchitectureUseCase;

  beforeEach(() => {
    useCase = new AnalyzeArchitectureUseCase();
  });

  describe("execute", () => {
    it("should return success result with empty violations", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.violations).toEqual([]);
      expect(result.value.symbolsAnalyzed).toBe(0);
      expect(result.value.rulesApplied).toBe(0);
    });

    it("should handle optional rulesPath parameter", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        rulesPath: "/test/rules.json",
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should return default output structure", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.value).toHaveProperty("violations");
      expect(result.value).toHaveProperty("symbolsAnalyzed");
      expect(result.value).toHaveProperty("rulesApplied");
      expect(Array.isArray(result.value.violations)).toBe(true);
    });
  });
});
