import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { FindSymbolUseCase, GetSymbolByIdUseCase } from "../FindSymbol.usecase.js";
import { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import type { ISymbolRepository } from "../../../domain/repositories/ISymbolRepository.js";
import { EntityNotFoundError } from "../../../../../@shared/errors/DomainErrors.js";

describe("FindSymbolUseCase", () => {
  let symbolRepo: jest.Mocked<ISymbolRepository>;
  let useCase: FindSymbolUseCase;
  let testSymbols: CodeSymbol[];

  beforeEach(() => {
    // Create test symbols
    const symbol1 = CodeSymbol.create({
      name: "TestClass",
      qualifiedName: "src/TestClass",
      kind: "class",
      location: { filePath: "src/test.ts", startLine: 10, endLine: 20 },
    }).value;

    const symbol2 = CodeSymbol.create({
      name: "TestFunction",
      qualifiedName: "src/TestFunction",
      kind: "function",
      location: { filePath: "src/utils.ts", startLine: 5, endLine: 10 },
    }).value;

    testSymbols = [symbol1, symbol2];

    // Setup mock
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

    useCase = new FindSymbolUseCase(symbolRepo);
  });

  describe("execute", () => {
    it("should find symbol by id", async () => {
      const symbol = testSymbols[0];
      symbolRepo.findById.mockReturnValue(symbol);

      const result = await useCase.execute({ id: symbol.id });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe(symbol.id);
      expect(symbolRepo.findById).toHaveBeenCalledWith(symbol.id);
    });

    it("should find symbols by name", async () => {
      symbolRepo.findByName.mockReturnValue([testSymbols[0]]);

      const result = await useCase.execute({ name: "TestClass" });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].name).toBe("TestClass");
      expect(symbolRepo.findByName).toHaveBeenCalledWith("TestClass");
    });

    it("should find symbols by file", async () => {
      symbolRepo.findByFile.mockReturnValue([testSymbols[0]]);

      const result = await useCase.execute({ file: "src/test.ts" });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].file).toBe("src/test.ts");
      expect(symbolRepo.findByFile).toHaveBeenCalledWith("src/test.ts");
    });

    it("should find symbols by kind", async () => {
      symbolRepo.findByKind.mockReturnValue([testSymbols[0]]);

      const result = await useCase.execute({ kind: "class" });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].kind).toBe("class");
      expect(symbolRepo.findByKind).toHaveBeenCalledWith("class");
    });

    it("should find all symbols when no criteria provided", async () => {
      symbolRepo.findAll.mockReturnValue(testSymbols);

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(symbolRepo.findAll).toHaveBeenCalled();
    });

    it("should return empty array when symbol by id not found", async () => {
      symbolRepo.findById.mockReturnValue(undefined);

      const result = await useCase.execute({ id: "non-existent" });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it("should return empty array when no symbols match", async () => {
      symbolRepo.findByName.mockReturnValue([]);

      const result = await useCase.execute({ name: "NonExistent" });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it("should handle errors during execution", async () => {
      symbolRepo.findByName.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await useCase.execute({ name: "Test" });

      expect(result.isFailure).toBe(true);
    });

    it("should prioritize id over other criteria", async () => {
      const symbol = testSymbols[0];
      symbolRepo.findById.mockReturnValue(symbol);

      await useCase.execute({
        id: symbol.id,
        name: "SomethingElse",
        file: "other.ts",
      });

      expect(symbolRepo.findById).toHaveBeenCalled();
      expect(symbolRepo.findByName).not.toHaveBeenCalled();
      expect(symbolRepo.findByFile).not.toHaveBeenCalled();
    });
  });
});

describe("GetSymbolByIdUseCase", () => {
  let symbolRepo: jest.Mocked<ISymbolRepository>;
  let useCase: GetSymbolByIdUseCase;
  let testSymbol: CodeSymbol;

  beforeEach(() => {
    testSymbol = CodeSymbol.create({
      name: "TestClass",
      qualifiedName: "src/TestClass",
      kind: "class",
      location: { filePath: "src/test.ts", startLine: 10, endLine: 20 },
    }).value;

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

    useCase = new GetSymbolByIdUseCase(symbolRepo);
  });

  describe("execute", () => {
    it("should return symbol when found", async () => {
      symbolRepo.findById.mockReturnValue(testSymbol);

      const result = await useCase.execute(testSymbol.id);

      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBe(testSymbol.id);
      expect(result.value.name).toBe("TestClass");
    });

    it("should fail when symbol not found", async () => {
      symbolRepo.findById.mockReturnValue(undefined);

      const result = await useCase.execute("non-existent-id");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(EntityNotFoundError);
    });

    it("should handle errors during execution", async () => {
      symbolRepo.findById.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await useCase.execute("test-id");

      expect(result.isFailure).toBe(true);
    });
  });
});
