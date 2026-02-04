import { describe, it, expect } from "@jest/globals";
import { BuildContextUseCase } from "../BuildContext.usecase.js";

describe("BuildContextUseCase", () => {
  let useCase: BuildContextUseCase;

  beforeEach(() => {
    useCase = new BuildContextUseCase();
  });

  describe("execute", () => {
    it("should return success result with empty context", async () => {
      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value.context).toBe("");
      expect(result.value.sourceNodes).toEqual([]);
    });

    it("should handle symbolId parameter", async () => {
      const result = await useCase.execute({
        symbolId: "test-symbol-123",
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should handle query parameter", async () => {
      const result = await useCase.execute({
        query: "authentication logic",
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should handle maxNodes parameter", async () => {
      const result = await useCase.execute({
        query: "test query",
        maxNodes: 10,
      });

      expect(result.isSuccess).toBe(true);
    });

    it("should return default output structure", async () => {
      const result = await useCase.execute({});

      expect(result.value).toHaveProperty("context");
      expect(result.value).toHaveProperty("sourceNodes");
      expect(Array.isArray(result.value.sourceNodes)).toBe(true);
    });

    it("should handle all parameters together", async () => {
      const result = await useCase.execute({
        symbolId: "symbol-1",
        query: "test",
        maxNodes: 5,
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.context).toBe("");
      expect(result.value.sourceNodes).toEqual([]);
    });
  });
});
