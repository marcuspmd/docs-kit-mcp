import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BuildSiteUseCase } from "../BuildSite.usecase.js";
import type { ISiteGenerator, SiteGenerationResult } from "../../../domain/services/index.js";
import { Result } from "../../../../../@core/domain/Result.js";

describe("BuildSiteUseCase", () => {
  let useCase: BuildSiteUseCase;
  let mockGenerator: jest.Mocked<ISiteGenerator>;

  beforeEach(() => {
    // Create mock generator
    mockGenerator = {
      generate: jest.fn<ISiteGenerator["generate"]>(),
    };

    useCase = new BuildSiteUseCase(mockGenerator);
  });

  describe("execute", () => {
    it("should successfully generate a site", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
        rootPath: ".",
      };

      const expectedResult: SiteGenerationResult = {
        symbolPages: 10,
        filePages: 5,
        totalFiles: 20,
        docEntries: 3,
        outputPath: "/absolute/path/docs-site",
      };

      mockGenerator.generate.mockResolvedValue(Result.ok(expectedResult));

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual(expectedResult);
      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dbPath: input.dbPath,
        outDir: input.outputDir,
        rootDir: input.rootPath,
      });
      expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it("should pass through generator options correctly", async () => {
      // Arrange
      const input = {
        dbPath: "custom/path/db.sqlite",
        outputDir: "custom-output",
        rootPath: "custom/root",
      };

      mockGenerator.generate.mockResolvedValue(
        Result.ok({
          symbolPages: 0,
          filePages: 0,
          totalFiles: 0,
          docEntries: 0,
          outputPath: "custom-output",
        }),
      );

      // Act
      await useCase.execute(input);

      // Assert
      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dbPath: "custom/path/db.sqlite",
        outDir: "custom-output",
        rootDir: "custom/root",
      });
    });

    it("should handle rootPath as optional", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
      };

      mockGenerator.generate.mockResolvedValue(
        Result.ok({
          symbolPages: 5,
          filePages: 3,
          totalFiles: 10,
          docEntries: 2,
          outputPath: "/path/docs-site",
        }),
      );

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dbPath: input.dbPath,
        outDir: input.outputDir,
        rootDir: undefined,
      });
    });

    it("should return failure when generator fails", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
      };

      const error = new Error("Database not found");
      mockGenerator.generate.mockResolvedValue(Result.fail(error));

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it("should handle generator throwing error", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
      };

      const error = new Error("Unexpected error");
      mockGenerator.generate.mockRejectedValue(error);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual(error);
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
      };

      mockGenerator.generate.mockRejectedValue("String error");

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("String error");
    });

    it("should return correct statistics from generator", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
        rootPath: "src",
      };

      const stats: SiteGenerationResult = {
        symbolPages: 150,
        filePages: 75,
        totalFiles: 250,
        docEntries: 10,
        outputPath: "/full/path/docs-site",
      };

      mockGenerator.generate.mockResolvedValue(Result.ok(stats));

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value?.symbolPages).toBe(150);
      expect(result.value?.filePages).toBe(75);
      expect(result.value?.totalFiles).toBe(250);
      expect(result.value?.docEntries).toBe(10);
      expect(result.value?.outputPath).toBe("/full/path/docs-site");
    });

    it("should work with zero pages generated", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/empty.db",
        outputDir: "empty-site",
      };

      const emptyResult: SiteGenerationResult = {
        symbolPages: 0,
        filePages: 0,
        totalFiles: 0,
        docEntries: 0,
        outputPath: "/path/empty-site",
      };

      mockGenerator.generate.mockResolvedValue(Result.ok(emptyResult));

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual(emptyResult);
    });

    it("should call generator only once per execution", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
      };

      mockGenerator.generate.mockResolvedValue(
        Result.ok({
          symbolPages: 1,
          filePages: 1,
          totalFiles: 2,
          docEntries: 0,
          outputPath: "docs-site",
        }),
      );

      // Act
      await useCase.execute(input);

      // Assert
      expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it("should propagate generator result without modification", async () => {
      // Arrange
      const input = {
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
        rootPath: ".",
      };

      const generatorResult = Result.ok({
        symbolPages: 42,
        filePages: 21,
        totalFiles: 84,
        docEntries: 7,
        outputPath: "/absolute/docs-site",
      });

      mockGenerator.generate.mockResolvedValue(generatorResult);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result).toBe(generatorResult);
    });
  });
});
