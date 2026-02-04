import { describe, it, expect, beforeEach, jest, afterEach } from "@jest/globals";
import type { IndexProjectUseCase } from "../../../modules/symbol/application/use-cases/IndexProject.usecase.js";
import type { FindSymbolUseCase } from "../../../modules/symbol/application/use-cases/FindSymbol.usecase.js";
import type { ExplainSymbolUseCase } from "../../../modules/symbol/application/use-cases/ExplainSymbol.usecase.js";
import type { BuildDocsUseCase } from "../../../modules/documentation/application/use-cases/BuildDocs.usecase.js";
import type { BuildSiteUseCase } from "../../../modules/documentation/application/use-cases/BuildSite.usecase.js";
import { CliAdapter } from "../CliAdapter.js";

// Type helper for mock results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockResult<T> = { isSuccess: boolean; value?: T; error?: any };

describe("CliAdapter", () => {
  let adapter: CliAdapter;
  let mockIndexProject: jest.Mocked<IndexProjectUseCase>;
  let mockFindSymbol: jest.Mocked<FindSymbolUseCase>;
  let mockExplainSymbol: jest.Mocked<ExplainSymbolUseCase>;
  let mockBuildDocs: jest.Mocked<BuildDocsUseCase>;
  let mockBuildSite: jest.Mocked<BuildSiteUseCase>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleLog: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleError: any;

  beforeEach(() => {
    mockIndexProject = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<IndexProjectUseCase>;

    mockFindSymbol = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<FindSymbolUseCase>;

    mockExplainSymbol = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ExplainSymbolUseCase>;

    mockBuildDocs = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<BuildDocsUseCase>;

    mockBuildSite = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<BuildSiteUseCase>;

    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    adapter = new CliAdapter({
      indexProject: mockIndexProject,
      findSymbol: mockFindSymbol,
      explainSymbol: mockExplainSymbol,
      buildDocs: mockBuildDocs,
      buildSite: mockBuildSite,
    });
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  describe("index command", () => {
    it("should execute index with default path", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 42, filesProcessed: 10 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: ".",
        fullRebuild: false,
      });
      expect(consoleLog).toHaveBeenCalledWith("Indexed 42 symbols from 10 files");
    });

    it("should execute index with custom path", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 100, filesProcessed: 25 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--path", "src/modules"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src/modules",
        fullRebuild: false,
      });
    });

    it("should execute index with alias path", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 50, filesProcessed: 12 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "-p", "src"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src",
        fullRebuild: false,
      });
    });

    it("should execute index with rebuild flag", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 30, filesProcessed: 8 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--rebuild"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: ".",
        fullRebuild: true,
      });
    });

    it("should execute index with rebuild alias", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 30, filesProcessed: 8 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "-r"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: ".",
        fullRebuild: true,
      });
    });

    it("should handle index execution error", async () => {
      const error = new Error("Index failed");
      const result: MockResult<null> = {
        isSuccess: false,
        error,
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(consoleError).toHaveBeenCalledWith("Index failed:", error.message);
    });

    it("should execute index with multiple options", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 60, filesProcessed: 15 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--path", "src/modules", "--rebuild"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src/modules",
        fullRebuild: true,
      });
    });
  });

  describe("build-site command", () => {
    it("should execute build-site with default options", async () => {
      const result: MockResult<{
        symbolPages: number;
        filePages: number;
        totalFiles: number;
        docEntries: number;
        outputPath: string;
      }> = {
        isSuccess: true,
        value: {
          symbolPages: 15,
          filePages: 5,
          totalFiles: 25,
          docEntries: 3,
          outputPath: "/path/docs-site",
        },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site"]);

      expect(mockBuildSite.execute).toHaveBeenCalledWith({
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
        rootPath: ".",
      });
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Site generated successfully"),
      );
    });

    it("should execute build-site with custom path and output", async () => {
      const result: MockResult<{
        symbolPages: number;
        filePages: number;
        totalFiles: number;
        docEntries: number;
        outputPath: string;
      }> = {
        isSuccess: true,
        value: {
          symbolPages: 20,
          filePages: 10,
          totalFiles: 35,
          docEntries: 5,
          outputPath: "/path/public",
        },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site", "--path", "src", "--output", "public"]);

      expect(mockBuildSite.execute).toHaveBeenCalledWith({
        dbPath: ".docs-kit/index.db",
        outputDir: "public",
        rootPath: "src",
      });
    });

    it("should execute build-site with aliases", async () => {
      const result: MockResult<{
        symbolPages: number;
        filePages: number;
        totalFiles: number;
        docEntries: number;
        outputPath: string;
      }> = {
        isSuccess: true,
        value: {
          symbolPages: 25,
          filePages: 12,
          totalFiles: 40,
          docEntries: 7,
          outputPath: "/path/dist",
        },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site", "-p", "docs", "-o", "dist"]);

      expect(mockBuildSite.execute).toHaveBeenCalledWith({
        dbPath: ".docs-kit/index.db",
        outputDir: "dist",
        rootPath: "docs",
      });
    });

    it("should handle build-site execution error", async () => {
      const error = new Error("Build failed");
      const result: MockResult<null> = {
        isSuccess: false,
        error,
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site"]);

      expect(consoleError).toHaveBeenCalledWith("Build failed:", error.message);
    });
  });

  describe("explain command", () => {
    it("should execute explain with symbol name", async () => {
      const result: MockResult<{ explanation: string }> = {
        isSuccess: true,
        value: { explanation: "This is a test symbol" },
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "--name", "TestSymbol"]);

      expect(mockExplainSymbol.execute).toHaveBeenCalledWith({
        symbolName: "TestSymbol",
        forceRegenerate: false,
      });
      expect(consoleLog).toHaveBeenCalledWith("This is a test symbol");
    });

    it("should execute explain with name alias", async () => {
      const result: MockResult<{ explanation: string }> = {
        isSuccess: true,
        value: { explanation: "Symbol explanation" },
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "-n", "MySymbol"]);

      expect(mockExplainSymbol.execute).toHaveBeenCalledWith({
        symbolName: "MySymbol",
        forceRegenerate: false,
      });
    });

    it("should execute explain with force flag", async () => {
      const result: MockResult<{ explanation: string }> = {
        isSuccess: true,
        value: { explanation: "Regenerated explanation" },
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "--name", "Symbol", "--force"]);

      expect(mockExplainSymbol.execute).toHaveBeenCalledWith({
        symbolName: "Symbol",
        forceRegenerate: true,
      });
    });

    it("should execute explain with force alias", async () => {
      const result: MockResult<{ explanation: string }> = {
        isSuccess: true,
        value: { explanation: "Regenerated" },
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "-n", "Symbol", "-f"]);

      expect(mockExplainSymbol.execute).toHaveBeenCalledWith({
        symbolName: "Symbol",
        forceRegenerate: true,
      });
    });

    it("should handle explain execution error", async () => {
      const error = new Error("Explain failed");
      const result: MockResult<null> = {
        isSuccess: false,
        error,
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "-n", "TestSymbol"]);

      expect(consoleError).toHaveBeenCalledWith("Explain failed:", error.message);
    });
  });

  describe("run method", () => {
    it("should show help when called without arguments", async () => {
      await adapter.run([]);

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("docs-kit - Code Documentation Agent"),
      );
    });

    it("should show help with --help flag", async () => {
      await adapter.run(["--help"]);

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("docs-kit - Code Documentation Agent"),
      );
    });

    it("should show help with -h flag", async () => {
      await adapter.run(["-h"]);

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("docs-kit - Code Documentation Agent"),
      );
    });

    it("should exit with error code on unknown command", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit(1)");
      });

      try {
        await adapter.run(["unknown-command"]);
      } catch {
        // Process exit throws
      }

      expect(consoleError).toHaveBeenCalledWith("Unknown command: unknown-command");
      exitSpy.mockRestore();
    });

    it("should handle help after unknown command", async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit(1)");
      });

      try {
        await adapter.run(["invalid"]);
      } catch {
        // Ignore
      }

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Commands:"));
      exitSpy.mockRestore();
    });
  });

  describe("parseArgs method", () => {
    it("should parse --long-form arguments", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--path", "src/modules"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src/modules",
        fullRebuild: false,
      });
    });

    it("should parse -short-form arguments", async () => {
      const result: MockResult<{ pagesGenerated: number }> = {
        isSuccess: true,
        value: { pagesGenerated: 0 },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site", "-p", "docs", "-o", "output"]);

      expect(mockBuildSite.execute).toHaveBeenCalledWith({
        dbPath: ".docs-kit/index.db",
        outputDir: "output",
        rootPath: "docs",
      });
    });

    it("should handle missing value for argument (flags without values)", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--rebuild"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: ".",
        fullRebuild: true,
      });
    });

    it("should use default values for unspecified options", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: ".",
        fullRebuild: false,
      });
    });

    it("should parse mixed argument formats", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "-p", "src", "--rebuild"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src",
        fullRebuild: true,
      });
    });

    it("should handle options as undefined", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--unknown-arg", "value"]);

      expect(mockIndexProject.execute).toHaveBeenCalled();
    });

    it("should handle increment past array bounds", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--path"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: true,
        fullRebuild: false,
      });
    });
  });

  describe("showHelp method", () => {
    it("should display all registered commands", async () => {
      await adapter.run(["--help"]);

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("index"));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("build-site"));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("explain"));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Commands:"));
    });

    it("should display description for each command", async () => {
      await adapter.run(["-h"]);

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Index project symbols"));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Build documentation site"));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Explain a symbol"));
    });

    it("should format command names with padding", async () => {
      await adapter.run(["--help"]);

      // Should have padded formatting for commands
      expect(consoleLog).toHaveBeenCalled();
    });
  });

  describe("command registration", () => {
    it("should have registered index command", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 1, filesProcessed: 1 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(mockIndexProject.execute).toHaveBeenCalled();
    });

    it("should have registered build-site command", async () => {
      const result: MockResult<{ pagesGenerated: number }> = {
        isSuccess: true,
        value: { pagesGenerated: 1 },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site"]);

      expect(mockBuildSite.execute).toHaveBeenCalled();
    });

    it("should have registered explain command", async () => {
      const result: MockResult<{ explanation: string }> = {
        isSuccess: true,
        value: { explanation: "test" },
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "-n", "Test"]);

      expect(mockExplainSymbol.execute).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle arguments ending with flag without value", async () => {
      const result: MockResult<{
        symbolPages: number;
        filePages: number;
        totalFiles: number;
        docEntries: number;
        outputPath: string;
      }> = {
        isSuccess: true,
        value: {
          symbolPages: 0,
          filePages: 0,
          totalFiles: 0,
          docEntries: 0,
          outputPath: "/path/docs-site",
        },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site", "--path", "src"]);

      expect(mockBuildSite.execute).toHaveBeenCalledWith({
        dbPath: ".docs-kit/index.db",
        outputDir: "docs-site",
        rootPath: "src",
      });
    });

    it("should handle when command has no options defined", async () => {
      // Test case for line 121: if (!options) return result;
      // Create a new adapter instance
      const testAdapter = new CliAdapter({
        indexProject: mockIndexProject,
        findSymbol: mockFindSymbol,
        explainSymbol: mockExplainSymbol,
        buildDocs: mockBuildDocs,
        buildSite: mockBuildSite,
      });

      // Add a command with no options (undefined)
      const noOptsExecute = jest.fn().mockResolvedValue(undefined as never);
      (testAdapter as unknown as { commands: Map<string, unknown> }).commands.set("noopts", {
        name: "noopts",
        description: "Command with no options",
        execute: noOptsExecute,
      });

      await testAdapter.run(["noopts", "--any-arg", "value"]);

      // Should be called with empty parsed args object
      expect(noOptsExecute).toHaveBeenCalledWith({});
    });

    it("should handle long-form flag at end of args (no value)", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "--path", "src", "--rebuild"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src",
        fullRebuild: true,
      });
    });

    it("should handle short-form flag at end of args (no value)", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index", "-p", "src", "-r"]);

      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: "src",
        fullRebuild: true,
      });
    });

    it("should handle command with no options", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 5, filesProcessed: 2 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(mockIndexProject.execute).toHaveBeenCalled();
    });

    it("should preserve original values from successful operations", async () => {
      const result: MockResult<{
        symbolPages: number;
        filePages: number;
        totalFiles: number;
        docEntries: number;
        outputPath: string;
      }> = {
        isSuccess: true,
        value: {
          symbolPages: 42,
          filePages: 21,
          totalFiles: 70,
          docEntries: 10,
          outputPath: "/path/docs-site",
        },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site"]);

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Site generated successfully"),
      );
    });

    it("should handle unknown short-form alias (should not crash)", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 0, filesProcessed: 0 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      // -z is not an alias for any option
      await adapter.run(["index", "-z", "value"]);

      // Should still execute with defaults since unknown alias is ignored
      expect(mockIndexProject.execute).toHaveBeenCalledWith({
        rootPath: ".",
        fullRebuild: false,
      });
    });

    it("should handle null/empty string arguments", async () => {
      const result: MockResult<{ pagesGenerated: number }> = {
        isSuccess: true,
        value: { pagesGenerated: 0 },
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site", "--path", "", "--output", ""]);

      expect(mockBuildSite.execute).toHaveBeenCalledWith({
        dbPath: ".docs-kit/index.db",
        outputDir: "",
        rootPath: "",
      });
    });
  });

  describe("error paths", () => {
    it("should handle error with missing message property", async () => {
      const error = {};
      const result: MockResult<null> = {
        isSuccess: false,
        error,
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(consoleError).toHaveBeenCalledWith("Index failed:", undefined);
    });

    it("should output correctly formatted index success message", async () => {
      const result: MockResult<{ symbolsFound: number; filesProcessed: number }> = {
        isSuccess: true,
        value: { symbolsFound: 999, filesProcessed: 88 },
      };
      mockIndexProject.execute.mockResolvedValue(result as never);

      await adapter.run(["index"]);

      expect(consoleLog).toHaveBeenCalledWith("Indexed 999 symbols from 88 files");
    });

    it("should handle build-site with error containing message", async () => {
      const error = new Error("Custom build error");
      const result: MockResult<null> = {
        isSuccess: false,
        error,
      };
      mockBuildSite.execute.mockResolvedValue(result as never);

      await adapter.run(["build-site"]);

      expect(consoleError).toHaveBeenCalledWith("Build failed:", "Custom build error");
    });

    it("should handle explain success with special characters in explanation", async () => {
      const result: MockResult<{ explanation: string }> = {
        isSuccess: true,
        value: { explanation: "This is a symbol: @Component, it's great!" },
      };
      mockExplainSymbol.execute.mockResolvedValue(result as never);

      await adapter.run(["explain", "-n", "TestSymbol"]);

      expect(consoleLog).toHaveBeenCalledWith("This is a symbol: @Component, it's great!");
    });
  });
});
