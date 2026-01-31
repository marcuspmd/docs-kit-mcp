import { describe, it, expect, beforeEach } from "@jest/globals";
import Database from "better-sqlite3";
import { generateProjectStatus, formatProjectStatus } from "../src/governance/projectStatus.js";
import { initializeSchema } from "../src/storage/db.js";
import { createDocRegistry } from "../src/docs/docRegistry.js";
import { createSymbolRepository, createRelationshipRepository } from "../src/storage/db.js";
import { createKnowledgeGraph } from "../src/knowledge/graph.js";
import { createPatternAnalyzer } from "../src/patterns/patternAnalyzer.js";
import { createArchGuard } from "../src/governance/archGuard.js";
import { createReaper } from "../src/governance/reaper.js";

describe("ProjectStatus", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
  });

  it("should generate project status with empty database", async () => {
    const registry = createDocRegistry(db);
    const symbolRepo = createSymbolRepository(db);
    const relRepo = createRelationshipRepository(db);
    const graph = createKnowledgeGraph(db);
    const patternAnalyzer = createPatternAnalyzer();
    const archGuard = createArchGuard();
    const reaper = createReaper();

    const result = await generateProjectStatus(
      { docsDir: "docs" },
      {
        symbolRepo,
        relRepo,
        registry,
        patternAnalyzer,
        archGuard,
        reaper,
        graph,
      },
    );

    expect(result.totalSymbols).toBe(0);
    expect(result.documentedSymbols).toBe(0);
    expect(result.docCoverage).toBe(0);
    expect(result.symbolKinds).toEqual({});
    expect(result.patternSummary).toEqual({});
    expect(result.violationSummary).toEqual({});
    expect(result.findingSummary).toEqual({});
    expect(result.totalRelationships).toBe(0);
    expect(result.avgReferencesPerSymbol).toBe(0);
  });

  it("should format project status correctly", () => {
    const result = {
      totalSymbols: 100,
      documentedSymbols: 50,
      docCoverage: 50.0,
      symbolKinds: { function: 60, class: 40 },
      patternSummary: { factory: 2 },
      violationSummary: { error: 1 },
      findingSummary: { dead_code: 5 },
      totalRelationships: 80,
      avgReferencesPerSymbol: 0.8,
      generatedAt: "2024-01-01",
    };

    const formatted = formatProjectStatus(result);

    expect(formatted).toContain("# 📊 Project Status Report");
    expect(formatted).toContain("Total Symbols**: 100");
    expect(formatted).toContain("Coverage**: 50.0%");
    expect(formatted).toContain("function**: 60");
    expect(formatted).toContain("class**: 40");
    expect(formatted).toContain("factory**: 2 instances");
    expect(formatted).toContain("error**: 1 issues");
    expect(formatted).toContain("dead_code**: 5 items");
    expect(formatted).toContain("Total Relationships**: 80");
    expect(formatted).toContain("Average References per Symbol**: 0.8");
    expect(formatted).toContain("*Report generated on 2024-01-01*");
  });
});
