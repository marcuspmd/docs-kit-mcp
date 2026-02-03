import { CodeSymbol } from "../domain/entities/CodeSymbol.js";

describe("CodeSymbol", () => {
  describe("create", () => {
    it("should create a valid CodeSymbol", () => {
      const result = CodeSymbol.create({
        name: "myFunction",
        qualifiedName: "MyClass.myFunction",
        kind: "function",
        location: {
          filePath: "src/index.ts",
          startLine: 10,
          endLine: 20,
        },
        language: "ts",
        exported: true,
        visibility: "public",
      });

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const symbol = result.value;
        expect(symbol.name).toBe("myFunction");
        expect(symbol.qualifiedName).toBe("MyClass.myFunction");
        expect(symbol.kind).toBe("function");
        expect(symbol.file).toBe("src/index.ts");
        expect(symbol.startLine).toBe(10);
        expect(symbol.endLine).toBe(20);
        expect(symbol.language).toBe("ts");
        expect(symbol.exported).toBe(true);
        expect(symbol.visibility).toBe("public");
      }
    });

    it("should fail with empty name", () => {
      const result = CodeSymbol.create({
        name: "",
        kind: "function",
        location: {
          filePath: "src/index.ts",
          startLine: 10,
          endLine: 20,
        },
      });

      expect(result.isFailure).toBe(true);
    });

    it("should fail with invalid kind", () => {
      const result = CodeSymbol.create({
        name: "test",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind: "invalid_kind" as any,
        location: {
          filePath: "src/index.ts",
          startLine: 10,
          endLine: 20,
        },
      });

      expect(result.isFailure).toBe(true);
    });
  });

  describe("fromPersistence", () => {
    it("should restore from persistence data", () => {
      const symbol = CodeSymbol.fromPersistence({
        id: "abc123",
        name: "myFunction",
        qualifiedName: "MyClass.myFunction",
        kind: "function",
        location: {
          filePath: "src/index.ts",
          startLine: 10,
          endLine: 20,
        },
        language: "ts",
        exported: true,
        visibility: "public",
      });

      expect(symbol.id).toBe("abc123");
      expect(symbol.name).toBe("myFunction");
    });
  });
});
