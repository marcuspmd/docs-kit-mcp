import { describe, it, expect } from "@jest/globals";
import { BuildDocsUseCase } from "../BuildDocs.usecase.js";

describe("BuildDocsUseCase", () => {
  let useCase: BuildDocsUseCase;

  beforeEach(() => {
    useCase = new BuildDocsUseCase();
  });

  describe("execute", () => {
    it("should return success result with empty documentation", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        outputDir: "/test/output",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.filesGenerated).toBe(0);
      expect(result.value.symbolsDocumented).toBe(0);
      expect(result.value.errors).toEqual([]);
    });

    it("should handle optional symbolIds parameter", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        outputDir: "/test/output",
        symbolIds: ["symbol1", "symbol2"],
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should return default output structure", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        outputDir: "/test/output",
      });

      expect(result.value).toHaveProperty("filesGenerated");
      expect(result.value).toHaveProperty("symbolsDocumented");
      expect(result.value).toHaveProperty("errors");
      expect(Array.isArray(result.value.errors)).toBe(true);
    });
  });
});
