import { describe, it, expect } from "@jest/globals";
import { BuildSiteUseCase } from "../BuildSite.usecase.js";

describe("BuildSiteUseCase", () => {
  let useCase: BuildSiteUseCase;

  beforeEach(() => {
    useCase = new BuildSiteUseCase();
  });

  describe("execute", () => {
    it("should return success result with zero pages generated", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        outputDir: "/test/output",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.pagesGenerated).toBe(0);
      expect(result.value.assetsGenerated).toBe(0);
      expect(result.value.errors).toEqual([]);
    });

    it("should handle optional templateDir parameter", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        outputDir: "/test/output",
        templateDir: "/test/templates",
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should return default output structure", async () => {
      const result = await useCase.execute({
        rootPath: "/test/path",
        outputDir: "/test/output",
      });

      expect(result.value).toHaveProperty("pagesGenerated");
      expect(result.value).toHaveProperty("assetsGenerated");
      expect(result.value).toHaveProperty("errors");
      expect(Array.isArray(result.value.errors)).toBe(true);
    });
  });
});
