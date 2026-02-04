import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { IndexProjectUseCase } from "../IndexProject.usecase.js";
import { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";
import type { ISymbolRepository } from "../../../domain/repositories/ISymbolRepository.js";
import type { IRelationshipRepository } from "../../../domain/repositories/IRelationshipRepository.js";
import type { IFileHashRepository } from "../../../domain/repositories/IFileHashRepository.js";
import type { IFileIndexer } from "../../../infrastructure/parsers/IFileIndexer.js";

describe("IndexProjectUseCase", () => {
  let symbolRepo: jest.Mocked<ISymbolRepository>;
  let relationshipRepo: jest.Mocked<IRelationshipRepository>;
  let fileHashRepo: jest.Mocked<IFileHashRepository>;
  let fileIndexer: jest.Mocked<IFileIndexer>;
  let useCase: IndexProjectUseCase;

  beforeEach(() => {
    // Setup mocks
    symbolRepo = {
      findByName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByFile: jest.fn(),
      findByKind: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      upsert: jest.fn(),
      upsertMany: jest.fn(),
      delete: jest.fn(),
      deleteByFile: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<ISymbolRepository>;

    relationshipRepo = {
      findBySource: jest.fn(),
      findByTarget: jest.fn(),
      save: jest.fn(),
      upsert: jest.fn(),
      upsertMany: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<IRelationshipRepository>;

    fileHashRepo = {
      get: jest.fn(),
      getAll: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<IFileHashRepository>;

    fileIndexer = {
      discoverFiles: jest.fn(),
      indexFile: jest.fn(),
      getSupportedExtensions: jest.fn(),
    } as unknown as jest.Mocked<IFileIndexer>;

    useCase = new IndexProjectUseCase(symbolRepo, relationshipRepo, fileHashRepo, fileIndexer);
  });

  describe("execute", () => {
    it("should index project successfully", async () => {
      const testSymbol = CodeSymbol.create({
        name: "TestClass",
        qualifiedName: "src/TestClass",
        kind: "class",
        location: { filePath: "src/test.ts", startLine: 10, endLine: 20 },
      }).value;

      fileIndexer.discoverFiles.mockResolvedValue(["src/test.ts"]);
      fileHashRepo.getAll.mockReturnValue([]);
      fileIndexer.indexFile.mockResolvedValue({
        symbols: [testSymbol],
        relationships: [],
        contentHash: "hash123",
        skipped: false,
      });

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.filesProcessed).toBe(1);
      expect(result.value.symbolsFound).toBe(1);
      expect(result.value.relationshipsFound).toBe(0);
      expect(result.value.errors).toEqual([]);
    });

    it("should clear repositories on full rebuild", async () => {
      fileIndexer.discoverFiles.mockResolvedValue([]);
      fileHashRepo.getAll.mockReturnValue([]);

      await useCase.execute({
        rootPath: "/test/path",
        fullRebuild: true,
      });

      expect(symbolRepo.clear).toHaveBeenCalled();
      expect(relationshipRepo.clear).toHaveBeenCalled();
      expect(fileHashRepo.clear).toHaveBeenCalled();
    });

    it("should not clear repositories when not full rebuild", async () => {
      fileIndexer.discoverFiles.mockResolvedValue([]);
      fileHashRepo.getAll.mockReturnValue([]);

      await useCase.execute({
        rootPath: "/test/path",
        fullRebuild: false,
      });

      expect(symbolRepo.clear).not.toHaveBeenCalled();
      expect(relationshipRepo.clear).not.toHaveBeenCalled();
      expect(fileHashRepo.clear).not.toHaveBeenCalled();
    });

    it("should use custom patterns when provided", async () => {
      fileIndexer.discoverFiles.mockResolvedValue([]);
      fileHashRepo.getAll.mockReturnValue([]);

      await useCase.execute({
        rootPath: "/test/path",
        patterns: ["**/*.custom"],
        excludePatterns: ["**/custom/**"],
      });

      expect(fileIndexer.discoverFiles).toHaveBeenCalledWith(
        "/test/path",
        ["**/*.custom"],
        ["**/custom/**"],
      );
    });

    it("should use default patterns when not provided", async () => {
      fileIndexer.discoverFiles.mockResolvedValue([]);
      fileHashRepo.getAll.mockReturnValue([]);

      await useCase.execute({
        rootPath: "/test/path",
      });

      expect(fileIndexer.discoverFiles).toHaveBeenCalledWith(
        "/test/path",
        ["**/*.ts", "**/*.js", "**/*.py", "**/*.go"],
        ["**/node_modules/**", "**/dist/**", "**/__tests__/**"],
      );
    });

    it("should skip unchanged files", async () => {
      fileIndexer.discoverFiles.mockResolvedValue(["src/test.ts"]);
      fileHashRepo.getAll.mockReturnValue([
        { filePath: "src/test.ts", contentHash: "existing-hash" },
      ]);
      fileIndexer.indexFile.mockResolvedValue({
        symbols: [],
        relationships: [],
        contentHash: "existing-hash",
        skipped: true,
      });

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.filesProcessed).toBe(0);
      expect(result.value.symbolsFound).toBe(0);
    });

    it("should save symbols and relationships", async () => {
      const testSymbol = CodeSymbol.create({
        name: "TestClass",
        qualifiedName: "src/TestClass",
        kind: "class",
        location: { filePath: "src/test.ts", startLine: 10, endLine: 20 },
      }).value;

      const testRel = SymbolRelationship.create({
        sourceId: "src-id",
        targetId: "target-id",
        type: "calls",
      });

      fileIndexer.discoverFiles.mockResolvedValue(["src/test.ts"]);
      fileHashRepo.getAll.mockReturnValue([]);
      fileIndexer.indexFile.mockResolvedValue({
        symbols: [testSymbol],
        relationships: [testRel],
        contentHash: "hash123",
        skipped: false,
      });

      await useCase.execute({
        rootPath: "/test/path",
      });

      expect(symbolRepo.deleteByFile).toHaveBeenCalledWith("src/test.ts");
      expect(symbolRepo.upsertMany).toHaveBeenCalledWith([testSymbol]);
      expect(relationshipRepo.upsertMany).toHaveBeenCalledWith([testRel]);
      expect(fileHashRepo.upsert).toHaveBeenCalledWith("src/test.ts", "hash123");
    });

    it("should handle indexing errors gracefully", async () => {
      fileIndexer.discoverFiles.mockResolvedValue(["src/error.ts"]);
      fileHashRepo.getAll.mockReturnValue([]);
      fileIndexer.indexFile.mockRejectedValue(new Error("Parse error"));

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toContain("error.ts");
      expect(result.value.errors[0]).toContain("Parse error");
    });

    it("should handle non-Error exceptions", async () => {
      fileIndexer.discoverFiles.mockResolvedValue(["src/error.ts"]);
      fileHashRepo.getAll.mockReturnValue([]);
      // Reject with a non-Error object (string, number, etc.)
      fileIndexer.indexFile.mockRejectedValue("String error message");

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toContain("error.ts");
      expect(result.value.errors[0]).toContain("String error message");
    });

    it("should process multiple files", async () => {
      const symbol1 = CodeSymbol.create({
        name: "Class1",
        qualifiedName: "src/Class1",
        kind: "class",
        location: { filePath: "src/file1.ts", startLine: 1, endLine: 10 },
      }).value;

      const symbol2 = CodeSymbol.create({
        name: "Class2",
        qualifiedName: "src/Class2",
        kind: "class",
        location: { filePath: "src/file2.ts", startLine: 1, endLine: 10 },
      }).value;

      fileIndexer.discoverFiles.mockResolvedValue(["src/file1.ts", "src/file2.ts"]);
      fileHashRepo.getAll.mockReturnValue([]);
      fileIndexer.indexFile
        .mockResolvedValueOnce({
          symbols: [symbol1],
          relationships: [],
          contentHash: "hash1",
          skipped: false,
        })
        .mockResolvedValueOnce({
          symbols: [symbol2],
          relationships: [],
          contentHash: "hash2",
          skipped: false,
        });

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.filesProcessed).toBe(2);
      expect(result.value.symbolsFound).toBe(2);
    });

    it("should include duration in output", async () => {
      fileIndexer.discoverFiles.mockResolvedValue([]);
      fileHashRepo.getAll.mockReturnValue([]);

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.value.duration).toBe("number");
    });

    it("should handle complete failure", async () => {
      fileIndexer.discoverFiles.mockRejectedValue(new Error("Discovery failed"));

      const result = await useCase.execute({
        rootPath: "/test/path",
      });

      expect(result.isFailure).toBe(true);
    });

    it("should delete old symbols before inserting new ones", async () => {
      const testSymbol = CodeSymbol.create({
        name: "TestClass",
        qualifiedName: "src/TestClass",
        kind: "class",
        location: { filePath: "src/test.ts", startLine: 10, endLine: 20 },
      }).value;

      fileIndexer.discoverFiles.mockResolvedValue(["src/test.ts"]);
      fileHashRepo.getAll.mockReturnValue([]);
      fileIndexer.indexFile.mockResolvedValue({
        symbols: [testSymbol],
        relationships: [],
        contentHash: "hash123",
        skipped: false,
      });

      const deleteCall = jest.fn();
      const upsertCall = jest.fn();
      symbolRepo.deleteByFile = deleteCall;
      symbolRepo.upsertMany = upsertCall;

      await useCase.execute({
        rootPath: "/test/path",
      });

      // Verify deleteByFile is called before upsertMany
      const deleteOrder = deleteCall.mock.invocationCallOrder[0];
      const upsertOrder = upsertCall.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(upsertOrder);
    });
  });
});
