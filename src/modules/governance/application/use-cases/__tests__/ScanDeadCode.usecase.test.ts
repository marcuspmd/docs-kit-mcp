import { describe, it, expect } from "@jest/globals";
import { ScanDeadCodeUseCase } from "../ScanDeadCode.usecase.js";

describe("ScanDeadCodeUseCase", () => {
  let useCase: ScanDeadCodeUseCase;

  beforeEach(() => {
    useCase = new ScanDeadCodeUseCase();
  });

  describe("execute", () => {
    it("should return success result with empty findings", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.findings).toEqual([]);
      expect(result.value.filesScanned).toBe(0);
      expect(result.value.symbolsAnalyzed).toBe(0);
    });

    it("should handle optional excludePatterns parameter", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        excludePatterns: ["**/node_modules/**", "**/dist/**"],
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should return default output structure", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.value).toHaveProperty("findings");
      expect(result.value).toHaveProperty("filesScanned");
      expect(result.value).toHaveProperty("symbolsAnalyzed");
      expect(Array.isArray(result.value.findings)).toBe(true);
    });
  });
});
