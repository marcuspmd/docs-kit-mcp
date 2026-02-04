import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemoryFileHashRepository } from "../InMemoryFileHashRepository.js";

describe("InMemoryFileHashRepository", () => {
  let repository: InMemoryFileHashRepository;

  beforeEach(() => {
    repository = new InMemoryFileHashRepository();
  });

  describe("upsert and get", () => {
    it("should store and retrieve file hash", () => {
      const filePath = "src/index.ts";
      const contentHash = "abc123def456";

      repository.upsert(filePath, contentHash);
      const result = repository.get(filePath);

      expect(result).toBeDefined();
      expect(result?.contentHash).toBe(contentHash);
      expect(result?.lastIndexedAt).toBeDefined();
    });

    it("should update existing hash", () => {
      const filePath = "src/index.ts";

      repository.upsert(filePath, "hash1");
      repository.upsert(filePath, "hash2");

      const result = repository.get(filePath);
      expect(result?.contentHash).toBe("hash2");
    });
  });

  describe("get", () => {
    it("should return undefined for non-existent file", () => {
      const result = repository.get("non-existent.ts");
      expect(result).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return all stored hashes", () => {
      repository.upsert("file1.ts", "hash1");
      repository.upsert("file2.ts", "hash2");
      repository.upsert("file3.ts", "hash3");

      const all = repository.getAll();
      expect(all).toHaveLength(3);
      expect(all).toContainEqual({ filePath: "file1.ts", contentHash: "hash1" });
      expect(all).toContainEqual({ filePath: "file2.ts", contentHash: "hash2" });
      expect(all).toContainEqual({ filePath: "file3.ts", contentHash: "hash3" });
    });

    it("should return empty array when no hashes", () => {
      const all = repository.getAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("should delete a file hash", () => {
      repository.upsert("file1.ts", "hash1");
      repository.delete("file1.ts");

      const result = repository.get("file1.ts");
      expect(result).toBeUndefined();
    });

    it("should not affect other hashes", () => {
      repository.upsert("file1.ts", "hash1");
      repository.upsert("file2.ts", "hash2");

      repository.delete("file1.ts");

      expect(repository.get("file1.ts")).toBeUndefined();
      expect(repository.get("file2.ts")).toBeDefined();
    });
  });

  describe("clear", () => {
    it("should clear all hashes", () => {
      repository.upsert("file1.ts", "hash1");
      repository.upsert("file2.ts", "hash2");

      repository.clear();

      expect(repository.getAll()).toHaveLength(0);
      expect(repository.get("file1.ts")).toBeUndefined();
    });

    it("should handle clear on empty repository", () => {
      repository.clear();
      expect(repository.getAll()).toHaveLength(0);
    });
  });

  describe("lastIndexedAt", () => {
    it("should set lastIndexedAt timestamp", () => {
      const before = new Date();
      repository.upsert("file.ts", "hash");
      const after = new Date();

      const result = repository.get("file.ts");
      const timestamp = new Date(result!.lastIndexedAt);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it("should update lastIndexedAt on reinsert", (done) => {
      repository.upsert("file.ts", "hash1");
      const firstResult = repository.get("file.ts");

      setTimeout(() => {
        repository.upsert("file.ts", "hash2");
        const secondResult = repository.get("file.ts");

        if (firstResult && secondResult) {
          expect(new Date(secondResult.lastIndexedAt).getTime()).toBeGreaterThanOrEqual(
            new Date(firstResult.lastIndexedAt).getTime(),
          );
        }
        done();
      }, 100);
    });
  });
});
