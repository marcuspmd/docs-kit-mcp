import { createRagIndex } from "../rag.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function sym(overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol {
  return {
    kind: "function",
    file: "src/test.ts",
    startLine: 1,
    endLine: 5,
    ...overrides,
  } as CodeSymbol;
}

/** Deterministic mock: each word hashes to a stable vector based on char codes */
function mockEmbedFn(texts: string[]): Promise<number[][]> {
  return Promise.resolve(
    texts.map((text) => {
      const vec = new Array(8).fill(0);
      for (let i = 0; i < text.length; i++) {
        vec[i % 8] += text.charCodeAt(i);
      }
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    }),
  );
}

describe("RagIndex", () => {
  describe("indexSymbols", () => {
    it("indexes symbols into searchable chunks", async () => {
      const rag = createRagIndex({ embeddingModel: "mock", embedFn: mockEmbedFn });
      const symbols = [
        sym({
          id: "s1",
          name: "calculatePrice",
          summary: "Calculates the total price for an order",
        }),
        sym({ id: "s2", name: "sendEmail", summary: "Sends notification emails to users" }),
      ];

      await rag.indexSymbols(symbols, new Map());

      expect(rag.chunkCount()).toBe(2);
    });

    it("includes source code in the indexed text", async () => {
      const rag = createRagIndex({ embeddingModel: "mock", embedFn: mockEmbedFn });
      const sourceCode = new Map([
        [
          "src/pricing.ts",
          "function calculatePrice(items) {\n  return items.reduce((sum, i) => sum + i.price, 0);\n}",
        ],
      ]);
      const symbols = [
        sym({ id: "s1", name: "calculatePrice", file: "src/pricing.ts", startLine: 1, endLine: 3 }),
      ];

      await rag.indexSymbols(symbols, sourceCode);
      const results = await rag.search("calculatePrice items reduce price");

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe("src/pricing.ts");
      expect(results[0].symbolId).toBe("s1");
    });
  });

  describe("indexDocs", () => {
    const tmpDir = join(tmpdir(), `rag-test-${Date.now()}`);

    beforeAll(async () => {
      await mkdir(tmpDir, { recursive: true });
      await writeFile(
        join(tmpDir, "pricing.md"),
        "# Pricing\nThe pricing module calculates order totals.",
      );
      await writeFile(
        join(tmpDir, "auth.md"),
        "# Auth\nAuthentication handles user login and tokens.",
      );
    });

    afterAll(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("indexes markdown files from docs directory", async () => {
      const rag = createRagIndex({ embeddingModel: "mock", embedFn: mockEmbedFn });
      await rag.indexDocs(tmpDir);

      expect(rag.chunkCount()).toBe(2);

      const results = await rag.search("pricing order totals");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe("pricing.md");
    });
  });

  describe("search", () => {
    it("returns results ranked by similarity", async () => {
      const rag = createRagIndex({ embeddingModel: "mock", embedFn: mockEmbedFn });
      const symbols = [
        sym({ id: "s1", name: "calculatePrice", summary: "pricing calculation for orders" }),
        sym({ id: "s2", name: "sendEmail", summary: "email notification dispatch" }),
        sym({ id: "s3", name: "validateOrder", summary: "order validation rules" }),
      ];

      await rag.indexSymbols(symbols, new Map());
      const results = await rag.search("order pricing");

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it("respects topK limit", async () => {
      const rag = createRagIndex({ embeddingModel: "mock", embedFn: mockEmbedFn });
      const symbols = Array.from({ length: 10 }, (_, i) =>
        sym({ id: `s${i}`, name: `func${i}`, summary: `function number ${i}` }),
      );

      await rag.indexSymbols(symbols, new Map());
      const results = await rag.search("function", 3);

      expect(results).toHaveLength(3);
    });

    it("returns empty when index is empty", async () => {
      const rag = createRagIndex({ embeddingModel: "mock", embedFn: mockEmbedFn });
      const results = await rag.search("anything");
      expect(results).toHaveLength(0);
    });
  });

  describe("chunking", () => {
    it("splits large text into overlapping chunks", async () => {
      const rag = createRagIndex({
        embeddingModel: "mock",
        embedFn: mockEmbedFn,
        chunkSize: 5,
        overlapSize: 2,
      });

      const symbols = [
        sym({
          id: "s1",
          name: "bigFunction",
          summary: "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
        }),
      ];

      await rag.indexSymbols(symbols, new Map());
      expect(rag.chunkCount()).toBeGreaterThan(1);
    });
  });

  describe("incremental indexing", () => {
    it("skips already-indexed chunks on re-index", async () => {
      let callCount = 0;
      const countingEmbed = (texts: string[]): Promise<number[][]> => {
        callCount += texts.length;
        return mockEmbedFn(texts);
      };

      const rag = createRagIndex({ embeddingModel: "mock", embedFn: countingEmbed });
      const symbols = [sym({ id: "s1", name: "foo", summary: "bar baz" })];

      await rag.indexSymbols(symbols, new Map());
      const firstCount = callCount;

      await rag.indexSymbols(symbols, new Map());
      expect(callCount).toBe(firstCount); // no new embed calls
      expect(rag.chunkCount()).toBe(1); // no duplicates
    });
  });
});
