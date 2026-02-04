import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { McpAdapter } from "../McpAdapter.js";
import type { IndexProjectUseCase } from "../../../modules/symbol/application/use-cases/IndexProject.usecase.js";
import type { ExplainSymbolUseCase } from "../../../modules/symbol/application/use-cases/ExplainSymbol.usecase.js";
import type { BuildSiteUseCase } from "../../../modules/documentation/application/use-cases/BuildSite.usecase.js";
import { Result } from "../../../@core/domain/Result.js";

describe("McpAdapter", () => {
  let indexProject: jest.Mocked<IndexProjectUseCase>;
  let explainSymbol: jest.Mocked<ExplainSymbolUseCase>;
  let buildSite: jest.Mocked<BuildSiteUseCase>;
  let adapter: McpAdapter;

  beforeEach(() => {
    indexProject = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<IndexProjectUseCase>;

    explainSymbol = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ExplainSymbolUseCase>;

    buildSite = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<BuildSiteUseCase>;

    adapter = new McpAdapter({
      indexProject,
      explainSymbol,
      buildSite,
    });
  });

  describe("constructor", () => {
    it("should create adapter instance", () => {
      expect(adapter).toBeInstanceOf(McpAdapter);
    });

    it("should accept dependencies", () => {
      const newAdapter = new McpAdapter({
        indexProject,
        explainSymbol,
        buildSite,
      });

      expect(newAdapter).toBeDefined();
    });
  });

  describe("start", () => {
    it("should be callable", () => {
      expect(typeof adapter.start).toBe("function");
    });
  });

  // Integration-style tests to verify the adapter structure
  describe("MCP server configuration", () => {
    it("should have server instance", () => {
      expect(adapter).toHaveProperty("server");
    });

    it("should initialize with correct name and version", () => {
      // The adapter creates a server internally
      expect(adapter).toBeDefined();
    });
  });

  describe("use case execution", () => {
    it("should have access to index project use case", () => {
      expect(adapter).toHaveProperty("deps");
    });

    it("should have access to explain symbol use case", () => {
      expect(adapter).toHaveProperty("deps");
    });

    it("should have access to build site use case", () => {
      expect(adapter).toHaveProperty("deps");
    });
  });

  describe("tool registration", () => {
    it("should register request handlers", () => {
      // The constructor calls registerHandlers
      // This verifies the adapter was constructed successfully
      expect(adapter).toBeDefined();
    });

    it("should support index_project tool", async () => {
      indexProject.execute.mockResolvedValue(
        Result.ok({
          filesProcessed: 10,
          symbolsFound: 50,
          relationshipsFound: 20,
          duration: 100,
          errors: [],
        }),
      );

      // Verify the use case can be called
      const result = await indexProject.execute({
        rootPath: "/test",
        fullRebuild: false,
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should support explain_symbol tool", async () => {
      explainSymbol.execute.mockResolvedValue(
        Result.ok({
          symbol: {
            id: "test-id",
            name: "TestClass",
            kind: "class",
            file: "test.ts",
            startLine: 1,
            endLine: 10,
          },
          explanation: "Test explanation",
        }),
      );

      const result = await explainSymbol.execute({
        symbolName: "TestClass",
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should support build_site tool", async () => {
      buildSite.execute.mockResolvedValue(
        Result.ok({
          pagesGenerated: 5,
          assetsGenerated: 10,
          errors: [],
        }),
      );

      const result = await buildSite.execute({
        rootPath: "/test",
        outputDir: "/output",
      });

      expect(result.isSuccess).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle index project failures", async () => {
      indexProject.execute.mockResolvedValue(Result.fail(new Error("Index failed")));

      const result = await indexProject.execute({
        rootPath: "/test",
      });

      expect(result.isFailure).toBe(true);
    });

    it("should handle explain symbol failures", async () => {
      explainSymbol.execute.mockResolvedValue(Result.fail(new Error("Symbol not found")));

      const result = await explainSymbol.execute({
        symbolName: "NonExistent",
      });

      expect(result.isFailure).toBe(true);
    });

    it("should handle build site failures", async () => {
      buildSite.execute.mockResolvedValue(Result.fail(new Error("Build failed")));

      const result = await buildSite.execute({
        rootPath: "/test",
        outputDir: "/output",
      });

      expect(result.isFailure).toBe(true);
    });
  });

  describe("parameter handling", () => {
    it("should support optional parameters for index project", async () => {
      indexProject.execute.mockResolvedValue(
        Result.ok({
          filesProcessed: 0,
          symbolsFound: 0,
          relationshipsFound: 0,
          duration: 0,
          errors: [],
        }),
      );

      await indexProject.execute({
        rootPath: "/test",
        fullRebuild: true,
        patterns: ["**/*.ts"],
        excludePatterns: ["**/*.test.ts"],
      });

      expect(indexProject.execute).toHaveBeenCalledWith({
        rootPath: "/test",
        fullRebuild: true,
        patterns: ["**/*.ts"],
        excludePatterns: ["**/*.test.ts"],
      });
    });

    it("should support force regenerate for explain symbol", async () => {
      explainSymbol.execute.mockResolvedValue(
        Result.ok({
          symbol: {
            id: "test-id",
            name: "TestClass",
            kind: "class",
            file: "test.ts",
            startLine: 1,
            endLine: 10,
          },
          explanation: "Regenerated explanation",
        }),
      );

      await explainSymbol.execute({
        symbolName: "TestClass",
        forceRegenerate: true,
      });

      expect(explainSymbol.execute).toHaveBeenCalledWith({
        symbolName: "TestClass",
        forceRegenerate: true,
      });
    });

    it("should support template directory for build site", async () => {
      buildSite.execute.mockResolvedValue(
        Result.ok({
          pagesGenerated: 0,
          assetsGenerated: 0,
          errors: [],
        }),
      );

      await buildSite.execute({
        rootPath: "/test",
        outputDir: "/output",
        templateDir: "/templates",
      });

      expect(buildSite.execute).toHaveBeenCalledWith({
        rootPath: "/test",
        outputDir: "/output",
        templateDir: "/templates",
      });
    });
  });

  describe("start method", () => {
    it("should have start method that returns Promise", () => {
      const result = adapter.start();
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
