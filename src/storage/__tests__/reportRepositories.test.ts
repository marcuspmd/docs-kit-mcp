import { createDatabase, initializeSchema } from "../db.js";
import {
  replaceAllPatterns,
  replaceAllArchViolations,
  upsertReaperFindings,
  getAllFindings,
  updateFindingStatus,
  getFindingHistory,
  type PatternRowForInsert,
  type ArchViolationRow,
  type ReaperFindingInput,
} from "../reportRepositories.js";
import type Database from "better-sqlite3";

describe("reportRepositories", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase({ inMemory: true });
    initializeSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("replaceAllPatterns", () => {
    it("inserts patterns and replaces on subsequent call", () => {
      const patterns: PatternRowForInsert[] = [
        { kind: "repository", symbols: ["OrderRepo", "UserRepo"], confidence: 0.9, violations: [] },
        { kind: "service", symbols: ["OrderService"], confidence: 0.8, violations: ["violation1"] },
      ];

      replaceAllPatterns(db, patterns);
      const rows = db.prepare("SELECT * FROM patterns").all() as Array<{ kind: string }>;
      expect(rows).toHaveLength(2);

      // Replace with new set
      replaceAllPatterns(db, [{ kind: "factory", symbols: ["F"], confidence: 1, violations: [] }]);
      const rows2 = db.prepare("SELECT * FROM patterns").all() as Array<{ kind: string }>;
      expect(rows2).toHaveLength(1);
      expect(rows2[0].kind).toBe("factory");
    });

    it("handles empty patterns array", () => {
      replaceAllPatterns(db, []);
      const rows = db.prepare("SELECT * FROM patterns").all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("replaceAllArchViolations", () => {
    it("inserts violations and replaces on subsequent call", () => {
      const violations: ArchViolationRow[] = [
        {
          rule: "no-cross-layer",
          file: "src/a.ts",
          symbol_id: "sym1",
          message: "violation",
          severity: "error",
        },
        {
          rule: "no-circular",
          file: "src/b.ts",
          symbol_id: null,
          message: "circular dep",
          severity: "warning",
        },
      ];

      replaceAllArchViolations(db, violations);
      const rows = db.prepare("SELECT * FROM arch_violations").all();
      expect(rows).toHaveLength(2);

      // Replace
      replaceAllArchViolations(db, []);
      const rows2 = db.prepare("SELECT * FROM arch_violations").all();
      expect(rows2).toHaveLength(0);
    });
  });

  describe("upsertReaperFindings", () => {
    const finding: ReaperFindingInput = {
      type: "dead-export",
      target: "src/unused.ts::deadFn",
      reason: "Never referenced",
      suggestedAction: "Remove it",
    };

    it("inserts new finding as active", () => {
      upsertReaperFindings(db, [finding]);
      const results = getAllFindings(db);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("active");
      expect(results[0].type).toBe("dead-export");
    });

    it("refreshes existing active finding without changing status", () => {
      upsertReaperFindings(db, [finding]);
      upsertReaperFindings(db, [{ ...finding, reason: "Updated reason" }]);
      const results = getAllFindings(db);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("active");
      expect(results[0].reason).toBe("Updated reason");
    });

    it("resolves findings that disappear", () => {
      upsertReaperFindings(db, [finding]);
      // Run with empty set — should auto-resolve
      upsertReaperFindings(db, []);
      const all = getAllFindings(db, { status: "all" });
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe("resolved");
    });

    it("reactivates previously resolved finding", () => {
      upsertReaperFindings(db, [finding]);
      upsertReaperFindings(db, []); // resolve
      upsertReaperFindings(db, [finding]); // reappears
      const results = getAllFindings(db);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("active");
    });
  });

  describe("getAllFindings", () => {
    it("excludes resolved by default", () => {
      upsertReaperFindings(db, [
        { type: "dead-export", target: "a", reason: "r", suggestedAction: "s" },
      ]);
      upsertReaperFindings(db, []); // resolve it

      const active = getAllFindings(db);
      expect(active).toHaveLength(0);

      const all = getAllFindings(db, { status: "all" });
      expect(all).toHaveLength(1);
    });

    it("filters by specific status", () => {
      upsertReaperFindings(db, [
        { type: "t1", target: "a", reason: "r", suggestedAction: "s" },
        { type: "t2", target: "b", reason: "r", suggestedAction: "s" },
      ]);
      // resolve one
      const results = getAllFindings(db);
      const id = results[0].id;
      updateFindingStatus(db, id, "false_positive");

      const fp = getAllFindings(db, { status: "false_positive" });
      expect(fp).toHaveLength(1);
    });
  });

  describe("updateFindingStatus", () => {
    it("updates status and writes history", () => {
      upsertReaperFindings(db, [
        { type: "dead-export", target: "src/x.ts::fn", reason: "r", suggestedAction: "s" },
      ]);
      const [finding] = getAllFindings(db);

      const ok = updateFindingStatus(db, finding.id, "ignored", "will fix later");
      expect(ok).toBe(true);

      const updated = getAllFindings(db, { status: "ignored" });
      expect(updated).toHaveLength(1);
      expect(updated[0].notes).toBe("will fix later");
    });

    it("returns false for unknown finding id", () => {
      const result = updateFindingStatus(db, "nonexistent-id", "resolved");
      expect(result).toBe(false);
    });
  });

  describe("getFindingHistory", () => {
    it("returns history for a specific finding", () => {
      upsertReaperFindings(db, [
        { type: "dead-export", target: "fn1", reason: "r", suggestedAction: "s" },
      ]);
      const [finding] = getAllFindings(db);
      updateFindingStatus(db, finding.id, "ignored");

      const history = getFindingHistory(db, finding.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].finding_id).toBe(finding.id);
    });

    it("returns all history when no findingId given", () => {
      upsertReaperFindings(db, [
        { type: "t1", target: "a", reason: "r", suggestedAction: "s" },
        { type: "t2", target: "b", reason: "r", suggestedAction: "s" },
      ]);

      const history = getFindingHistory(db);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });
});
