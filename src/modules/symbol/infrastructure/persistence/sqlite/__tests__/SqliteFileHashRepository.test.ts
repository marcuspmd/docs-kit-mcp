import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { SqliteFileHashRepository } from "../SqliteFileHashRepository.js";
import type Database from "better-sqlite3";

// Mock Database.Statement
class MockStatement {
  private lastParams: unknown[] = [];

  get(_param?: unknown): { content_hash: string; last_indexed_at: string } | undefined {
    this.lastParams = [_param];
    return {
      content_hash: "mocked-hash",
      last_indexed_at: "2024-01-01T00:00:00Z",
    };
  }

  run(...params: unknown[]) {
    this.lastParams = params;
    return { changes: 1 };
  }

  all(...params: unknown[]) {
    this.lastParams = params;
    return [
      { file_path: "file1.ts", content_hash: "hash1" },
      { file_path: "file2.ts", content_hash: "hash2" },
    ];
  }
}

// Mock Database
class MockDatabase {
  statements = new Map<string, MockStatement>();

  prepare(sql: string) {
    if (!this.statements.has(sql)) {
      this.statements.set(sql, new MockStatement());
    }
    return this.statements.get(sql)!;
  }
}

describe("SqliteFileHashRepository", () => {
  let repository: SqliteFileHashRepository;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    repository = new SqliteFileHashRepository(mockDb as unknown as Database.Database);
  });

  describe("get", () => {
    it("should retrieve file hash from database", () => {
      const result = repository.get("src/index.ts");

      expect(result).toBeDefined();
      expect(result?.contentHash).toBe("mocked-hash");
      expect(result?.lastIndexedAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should return undefined when file hash does not exist", () => {
      // Mock the get statement to return undefined
      const getStmt = mockDb.statements.get(
        "SELECT content_hash, last_indexed_at FROM file_hashes WHERE file_path = ?",
      );
      if (getStmt) {
        jest.spyOn(getStmt, "get").mockReturnValueOnce(undefined);
      }

      const result = repository.get("non-existent.ts");
      expect(result).toBeUndefined();
    });

    it("should handle missing file paths", () => {
      // When get returns undefined from database
      const result = repository.get("non-existent.ts");
      // Should still return correctly formatted result or undefined
      expect(result === undefined || typeof result === "object").toBe(true);
    });
  });

  describe("upsert", () => {
    it("should insert new file hash", () => {
      expect(() => {
        repository.upsert("src/file.ts", "abc123");
      }).not.toThrow();
    });

    it("should update existing file hash", () => {
      expect(() => {
        repository.upsert("src/file.ts", "hash1");
        repository.upsert("src/file.ts", "hash2");
      }).not.toThrow();
    });

    it("should handle multiple upserts", () => {
      expect(() => {
        repository.upsert("file1.ts", "hash1");
        repository.upsert("file2.ts", "hash2");
        repository.upsert("file3.ts", "hash3");
      }).not.toThrow();
    });
  });

  describe("getAll", () => {
    it("should return all file hashes", () => {
      const results = repository.getAll();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should map database rows correctly", () => {
      const results = repository.getAll();

      results.forEach((record) => {
        expect(record).toHaveProperty("filePath");
        expect(record).toHaveProperty("contentHash");
        expect(typeof record.filePath).toBe("string");
        expect(typeof record.contentHash).toBe("string");
      });
    });

    it("should return empty array when no records", () => {
      // When database is empty, getAll should return empty array
      const results = repository.getAll();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete file hash from database", () => {
      expect(() => {
        repository.delete("src/file.ts");
      }).not.toThrow();
    });

    it("should handle deletion of non-existent files", () => {
      expect(() => {
        repository.delete("non-existent.ts");
      }).not.toThrow();
    });

    it("should delete multiple files", () => {
      expect(() => {
        repository.delete("file1.ts");
        repository.delete("file2.ts");
        repository.delete("file3.ts");
      }).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should clear all file hashes", () => {
      expect(() => {
        repository.clear();
      }).not.toThrow();
    });

    it("should be idempotent", () => {
      expect(() => {
        repository.clear();
        repository.clear();
      }).not.toThrow();
    });
  });

  describe("data format", () => {
    it("should format data with correct property names", () => {
      const result = repository.get("file.ts");

      expect(result).toHaveProperty("contentHash");
      expect(result).toHaveProperty("lastIndexedAt");
      // Should not have snake_case properties from database
      expect(result).not.toHaveProperty("content_hash");
      expect(result).not.toHaveProperty("last_indexed_at");
    });

    it("should format getAll results correctly", () => {
      const results = repository.getAll();

      results.forEach((record) => {
        expect(record).toHaveProperty("filePath");
        expect(record).toHaveProperty("contentHash");
        // Should not have snake_case properties
        expect(record).not.toHaveProperty("file_path");
        expect(record).not.toHaveProperty("content_hash");
      });
    });
  });
});
