import { jest } from "@jest/globals";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { generateProjectStatus, formatProjectStatus } from "../projectStatus.js";
import type { CodeSymbol, SymbolRelationship } from "../../indexer/symbol.types.js";
import type { DocRegistry } from "../../docs/docRegistry.js";
import type { KnowledgeGraph } from "../../knowledge/graph.js";

describe("ProjectStatus", () => {
  let mockSymbolRepo: { findAll: jest.MockedFunction<() => CodeSymbol[]> };
  let mockRelRepo: {
    findAll: jest.MockedFunction<
      () => Array<{ source_id: string; target_id: string; type: string }>
    >;
  };
  let mockRegistry: jest.Mocked<DocRegistry>;
  let mockPatternAnalyzer: {
    analyze: jest.MockedFunction<
      (
        symbols: CodeSymbol[],
        relationships: SymbolRelationship[],
      ) => Array<{ kind: string; symbols: string[]; confidence: number; violations: string[] }>
    >;
  };
  let mockArchGuard: {
    analyze: jest.MockedFunction<
      (
        symbols: CodeSymbol[],
        relationships: SymbolRelationship[],
      ) => Array<{ severity: string; rule: string; message: string; file: string }>
    >;
  };
  let mockReaper: {
    scan: jest.MockedFunction<
      (
        symbols: CodeSymbol[],
        graph: KnowledgeGraph,
        mappings: Array<{ symbolName: string; docPath: string }>,
      ) => Array<{ type: string; target: string; reason: string; suggestedAction: string }>
    >;
  };
  let mockGraph: jest.Mocked<KnowledgeGraph>;

  beforeEach(() => {
    mockSymbolRepo = { findAll: jest.fn() };
    mockRelRepo = { findAll: jest.fn() };
    mockRegistry = {
      rebuild: jest.fn(),
      findAllMappings: jest.fn(),
      findDocBySymbol: jest.fn(),
      findSymbolsByDoc: jest.fn(),
      register: jest.fn(),
      unregister: jest.fn(),
      findDocByPath: jest.fn(),
      findAllDocs: jest.fn(),
    } as jest.Mocked<DocRegistry>;
    mockPatternAnalyzer = { analyze: jest.fn() };
    mockArchGuard = { analyze: jest.fn() };
    mockReaper = { scan: jest.fn() };
    mockGraph = {} as jest.Mocked<KnowledgeGraph>;
  });

  describe("generateProjectStatus", () => {
    it("should generate project status with empty data", async () => {
      mockSymbolRepo.findAll.mockReturnValue([]);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const result = await generateProjectStatus(
        { docsDir: "docs" },
        {
          symbolRepo: mockSymbolRepo,
          relRepo: mockRelRepo,
          registry: mockRegistry,
          patternAnalyzer: mockPatternAnalyzer,
          archGuard: mockArchGuard,
          reaper: mockReaper,
          graph: mockGraph,
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
      expect(result.testCoverage).toBeUndefined();
    });

    it("should generate project status with symbols and relationships", async () => {
      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "func1",
          kind: "function",
          file: "file1.ts",
          startLine: 1,
          endLine: 10,
          metrics: {
            testCoverage: { hitCount: 8, linesHit: 8, linesCovered: 10, coveragePercent: 80 },
          },
        },
        {
          id: "2",
          name: "class1",
          kind: "class",
          file: "file2.ts",
          startLine: 1,
          endLine: 20,
          metrics: {
            testCoverage: { hitCount: 0, linesHit: 0, linesCovered: 10, coveragePercent: 0 },
          },
        },
      ];
      const rels = [{ source_id: "1", target_id: "2", type: "references" }];
      const mappings = [{ symbolName: "func1", docPath: "docs/func1.md" }];
      const patterns = [{ kind: "factory", symbols: ["func1"], confidence: 0.9, violations: [] }];
      const violations = [{ severity: "error", rule: "rule1", message: "msg", file: "file1.ts" }];
      const findings = [
        { type: "dead_code", target: "func2", reason: "unused", suggestedAction: "remove" },
      ];

      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue(rels);
      mockRegistry.findAllMappings.mockResolvedValue(mappings);
      mockPatternAnalyzer.analyze.mockReturnValue(patterns);
      mockArchGuard.analyze.mockReturnValue(violations);
      mockReaper.scan.mockReturnValue(findings);

      const result = await generateProjectStatus(
        { docsDir: "docs" },
        {
          symbolRepo: mockSymbolRepo,
          relRepo: mockRelRepo,
          registry: mockRegistry,
          patternAnalyzer: mockPatternAnalyzer,
          archGuard: mockArchGuard,
          reaper: mockReaper,
          graph: mockGraph,
        },
      );

      expect(result.totalSymbols).toBe(2);
      expect(result.documentedSymbols).toBe(1);
      expect(result.docCoverage).toBe(50);
      expect(result.symbolKinds).toEqual({ function: 1, class: 1 });
      expect(result.patternSummary).toEqual({ factory: 1 });
      expect(result.violationSummary).toEqual({ error: 1 });
      expect(result.findingSummary).toEqual({ dead_code: 1 });
      expect(result.totalRelationships).toBe(1);
      expect(result.avgReferencesPerSymbol).toBe(0.5);
      expect(result.testCoverage).toBeDefined();
      expect(result.testCoverage!.avgCoverage).toBe(40); // (80 + 0)/2
      expect(result.testCoverage!.symbolsWithTests).toBe(2);
      expect(result.testCoverage!.totalTestableSymbols).toBe(2);
      expect(result.testCoverage!.fullyCovered).toBe(1);
      expect(result.testCoverage!.uncovered).toBe(1);
    });
  });

  describe("formatProjectStatus", () => {
    it("should format project status without test coverage", () => {
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
      expect(formatted).not.toContain("Test Coverage");
    });

    it("should format project status with test coverage", () => {
      const result = {
        totalSymbols: 10,
        documentedSymbols: 5,
        docCoverage: 50.0,
        symbolKinds: { function: 6, class: 4 },
        patternSummary: {},
        violationSummary: {},
        findingSummary: {},
        totalRelationships: 8,
        avgReferencesPerSymbol: 0.8,
        generatedAt: "2024-01-01",
        testCoverage: {
          avgCoverage: 70.0,
          symbolsWithTests: 5,
          totalTestableSymbols: 10,
          fullyCovered: 3,
          partiallyCovered: 1,
          lowCoverage: 1,
          uncovered: 0,
        },
      };

      const formatted = formatProjectStatus(result);

      expect(formatted).toContain("## Test Coverage");
      expect(formatted).toContain("Average Coverage**: 70.0%");
      expect(formatted).toContain("Symbols with Tests**: 5/10 (50.0%)");
      expect(formatted).toContain("Fully Covered (≥80%)**: 3");
      expect(formatted).toContain("Partially Covered (50-79%)**: 1");
      expect(formatted).toContain("Low Coverage (<50%)**: 1");
      expect(formatted).toContain("Uncovered (0%)**: 0");
    });
  });
});
