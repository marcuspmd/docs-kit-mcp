import { AstDiffAnalyzer } from "../AstDiffAnalyzer.js";
import type { IFileIndexer } from "../../../symbol/infrastructure/parsers/IFileIndexer.js";
import { CodeSymbol } from "../../../symbol/domain/entities/CodeSymbol.js";
import { FileLocation } from "../../../symbol/domain/value-objects/FileLocation.js";
import { SymbolKind } from "../../../symbol/domain/value-objects/SymbolKind.js";
import { Signature } from "../../../symbol/domain/value-objects/Signature.js";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";

jest.mock("node:child_process");
jest.mock("node:util");
jest.mock("node:fs/promises");

const mockPromisify = promisify as jest.MockedFunction<typeof promisify>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe("AstDiffAnalyzer", () => {
  let analyzer: AstDiffAnalyzer;
  let mockFileIndexer: jest.Mocked<IFileIndexer>;
  let mockExecAsync: jest.Mock;

  beforeEach(() => {
    mockFileIndexer = {
      indexFile: jest.fn(),
      discoverFiles: jest.fn(),
    } as jest.Mocked<IFileIndexer>;

    mockExecAsync = jest.fn();
    mockPromisify.mockReturnValue(mockExecAsync as never);

    analyzer = new AstDiffAnalyzer(mockFileIndexer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockSymbol = (
    name: string,
    overrides: Partial<{
      kind: string;
      qualifiedName: string;
      visibility: string;
      exported: boolean;
      signature: string;
      deprecated: boolean;
    }> = {},
  ) => {
    const locationResult = FileLocation.create({
      file: "test.ts",
      startLine: 1,
      endLine: 10,
    });

    if (locationResult.isFailure) throw new Error(locationResult.error.message);

    const kindResult = SymbolKind.create(overrides.kind || "class");
    if (kindResult.isFailure) throw new Error(kindResult.error.message);

    let signature: Signature | undefined;
    if (overrides.signature) {
      const sigResult = Signature.create(overrides.signature);
      if (sigResult.isSuccess) signature = sigResult.value;
    }

    const symbolResult = CodeSymbol.create({
      name,
      kind: kindResult.value,
      location: locationResult.value,
      language: "typescript",
      qualifiedName: overrides.qualifiedName,
      visibility: overrides.visibility as "public" | "private" | "protected",
      exported: overrides.exported,
      signature,
      deprecated: overrides.deprecated,
    });

    if (symbolResult.isFailure) throw new Error(symbolResult.error.message);
    return symbolResult.value;
  };

  describe("analyzeFileChanges", () => {
    it("should detect added symbols when no old content", async () => {
      const newSymbol = createMockSymbol("TestClass");

      mockFileIndexer.indexFile.mockResolvedValue({
        symbols: [newSymbol],
        relationships: [],
        skipped: false,
        contentHash: "hash123",
      });

      const result = await analyzer.analyzeFileChanges("test.ts");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        changeType: "added",
        severity: "low",
        breakingChange: false,
        reason: "New symbol added",
      });
      expect(result[0].symbol).toBe(newSymbol);
    });

    it("should detect removed symbols", async () => {
      const oldSymbol = createMockSymbol("OldClass", { qualifiedName: "OldClass" });
      const newSymbol = createMockSymbol("NewClass", { qualifiedName: "NewClass" });

      mockFileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [newSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        })
        .mockResolvedValueOnce({
          symbols: [oldSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash456",
        });

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      expect(result.some((r) => r.changeType === "removed")).toBe(true);
      const removedChange = result.find((r) => r.changeType === "removed");
      expect(removedChange).toMatchObject({
        severity: "high",
        breakingChange: true,
        reason: "Symbol removed",
      });
    });

    it("should detect signature changes", async () => {
      const oldSymbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        signature: "class TestClass()",
      });

      const newSymbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        signature: "class TestClass(name: string)",
      });

      mockFileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [newSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        })
        .mockResolvedValueOnce({
          symbols: [oldSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash456",
        });

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      const signatureChange = result.find((r) => r.changeType === "signature_changed");
      expect(signatureChange).toBeDefined();
      expect(signatureChange?.severity).toBe("high");
      expect(signatureChange?.breakingChange).toBe(true);
    });

    it("should detect visibility changes", async () => {
      const oldSymbol = createMockSymbol("TestMethod", {
        qualifiedName: "TestClass.TestMethod",
        visibility: "public",
      });

      const newSymbol = createMockSymbol("TestMethod", {
        qualifiedName: "TestClass.TestMethod",
        visibility: "private",
      });

      mockFileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [newSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        })
        .mockResolvedValueOnce({
          symbols: [oldSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash456",
        });

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      const visibilityChange = result.find((r) => r.changeType === "visibility_changed");
      expect(visibilityChange).toBeDefined();
      expect(visibilityChange?.severity).toBe("low");
      expect(visibilityChange?.breakingChange).toBe(true);
    });

    it("should detect exported status changes", async () => {
      const oldSymbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        exported: true,
      });

      const newSymbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        exported: false,
      });

      mockFileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [newSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        })
        .mockResolvedValueOnce({
          symbols: [oldSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash456",
        });

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      const exportChange = result.find((r) => r.reason?.includes("Exported"));
      expect(exportChange).toBeDefined();
      expect(exportChange?.severity).toBe("high");
      expect(exportChange?.breakingChange).toBe(true);
    });

    it("should detect deprecated status changes", async () => {
      const oldSymbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        deprecated: false,
      });

      const newSymbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        deprecated: true,
      });

      mockFileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [newSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        })
        .mockResolvedValueOnce({
          symbols: [oldSymbol],
          relationships: [],
          skipped: false,
          contentHash: "hash456",
        });

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      const deprecatedChange = result.find((r) => r.reason?.includes("Deprecated"));
      expect(deprecatedChange).toBeDefined();
      expect(deprecatedChange?.severity).toBe("medium");
      expect(deprecatedChange?.breakingChange).toBe(true);
    });

    it("should handle skipped files", async () => {
      mockFileIndexer.indexFile.mockResolvedValue({
        symbols: [],
        relationships: [],
        skipped: true,
      });

      const result = await analyzer.analyzeFileChanges("test.ts");

      expect(result).toHaveLength(0);
    });

    it("should handle indexing errors gracefully", async () => {
      mockFileIndexer.indexFile.mockRejectedValue(new Error("Parse error"));

      const result = await analyzer.analyzeFileChanges("test.ts");

      expect(result).toHaveLength(0);
    });

    it("should handle temp file creation errors", async () => {
      const newSymbol = createMockSymbol("TestClass");

      mockFileIndexer.indexFile.mockResolvedValueOnce({
        symbols: [newSymbol],
        relationships: [],
        skipped: false,
        contentHash: "hash123",
      });

      mockFs.writeFile.mockRejectedValue(new Error("Write error"));

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      // Should still return added symbols
      expect(result.length).toBeGreaterThan(0);
    });

    it("should ignore unchanged symbols", async () => {
      const symbol = createMockSymbol("TestClass", {
        qualifiedName: "TestClass",
        visibility: "public",
        exported: true,
      });

      mockFileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [symbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        })
        .mockResolvedValueOnce({
          symbols: [symbol],
          relationships: [],
          skipped: false,
          contentHash: "hash123",
        });

      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await analyzer.analyzeFileChanges("test.ts", "old content");

      // Should have added symbol but no modifications
      expect(result.every((r) => r.changeType === "added")).toBe(true);
    });
  });

  describe("getOldFileContent", () => {
    it("should get file content from git", async () => {
      const content = "export class Old {}";
      mockExecAsync.mockResolvedValue({ stdout: content, stderr: "" });

      const result = await analyzer.getOldFileContent("test.ts", "main");

      expect(result).toBe(content);
      expect(mockExecAsync).toHaveBeenCalledWith("git show main:test.ts");
    });

    it("should return undefined when file does not exist in ref", async () => {
      mockExecAsync.mockRejectedValue(new Error("File not found"));

      const result = await analyzer.getOldFileContent("test.ts", "main");

      expect(result).toBeUndefined();
    });

    it("should handle git errors gracefully", async () => {
      mockExecAsync.mockRejectedValue(new Error("Not a git repository"));

      const result = await analyzer.getOldFileContent("test.ts", "main");

      expect(result).toBeUndefined();
    });
  });
});
