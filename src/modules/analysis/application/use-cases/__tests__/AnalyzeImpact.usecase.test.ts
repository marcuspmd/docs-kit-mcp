import { describe, it, expect } from "@jest/globals";
import { AnalyzeImpactUseCase } from "../AnalyzeImpact.usecase.js";

describe("AnalyzeImpactUseCase", () => {
  let useCase: AnalyzeImpactUseCase;

  beforeEach(() => {
    useCase = new AnalyzeImpactUseCase();
  });

  describe("execute", () => {
    it("should return success result with empty impacts", async () => {
      const result = await useCase.execute({
        baseBranch: "main",
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.impacts).toEqual([]);
      expect(result.value.filesChanged).toBe(0);
      expect(result.value.symbolsAffected).toBe(0);
      expect(result.value.breakingChanges).toBe(0);
    });

    it("should handle targetBranch parameter", async () => {
      const result = await useCase.execute({
        baseBranch: "main",
        targetBranch: "feature",
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should return default output structure", async () => {
      const result = await useCase.execute({
        baseBranch: "main",
        rootPath: "/test/path",
      });

      expect(result.value).toHaveProperty("impacts");
      expect(result.value).toHaveProperty("filesChanged");
      expect(result.value).toHaveProperty("symbolsAffected");
      expect(result.value).toHaveProperty("breakingChanges");
    });
  });
});
