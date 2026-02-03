import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { performSmartCodeReview } from "../smartCodeReview.js";
import type { SmartCodeReviewDeps, SmartCodeReviewOptions } from "../smartCodeReview.js";
import type { CodeSymbol, SymbolRelationship } from "../../indexer/symbol.types.js";
import type { DocRegistry } from "../../docs/docRegistry.js";
import type { SymbolRepository, RelationshipRepository } from "../../storage/db.js";
import type { PatternAnalyzer } from "../../patterns/patternAnalyzer.js";
import type { ArchGuard } from "../archGuard.js";
import type { Reaper } from "../reaper.js";
import type { KnowledgeGraph } from "../../knowledge/graph.js";

describe("SmartCodeReview", () => {
  let mockSymbolRepo: jest.Mocked<SymbolRepository>;
  let mockRelRepo: jest.Mocked<RelationshipRepository>;
  let mockRegistry: jest.Mocked<DocRegistry>;
  let mockPatternAnalyzer: jest.Mocked<PatternAnalyzer>;
  let mockArchGuard: jest.Mocked<ArchGuard>;
  let mockReaper: jest.Mocked<Reaper>;
  let mockGraph: jest.Mocked<KnowledgeGraph>;

  beforeEach(() => {
    mockSymbolRepo = {
      findAll: jest.fn(),
      findByName: jest.fn(),
      findByFile: jest.fn(),
      findByIds: jest.fn(),
      findById: jest.fn(),
      upsert: jest.fn(),
    } as jest.Mocked<SymbolRepository>;

    mockRelRepo = {
      findAll: jest.fn(),
      findBySourceId: jest.fn(),
      findByTargetId: jest.fn(),
      upsert: jest.fn(),
    } as jest.Mocked<RelationshipRepository>;

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

    mockPatternAnalyzer = {
      analyze: jest.fn(),
    } as jest.Mocked<PatternAnalyzer>;

    mockArchGuard = {
      setRules: jest.fn(),
      analyze: jest.fn(),
    } as jest.Mocked<ArchGuard>;

    mockReaper = {
      scan: jest.fn(),
      markDeadCode: jest.fn(),
    } as jest.Mocked<Reaper>;

    mockGraph = {
      addRelationship: jest.fn(),
      getDependencies: jest.fn(),
      getDependents: jest.fn(),
      removeRelationship: jest.fn(),
      getAllRelationships: jest.fn(),
      hasRelationship: jest.fn(),
      rebuild: jest.fn(),
    } as jest.Mocked<KnowledgeGraph>;
  });

  describe("performSmartCodeReview", () => {
    it("should generate report with empty data", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue([]);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("# 🔍 Smart Code Review Report");
      expect(result).toContain("## 📊 Summary");
      expect(result).toContain("Total Symbols**: 0");
      expect(result).toContain("Documented**: 0 (0.0%)");
      expect(mockRegistry.rebuild).toHaveBeenCalledWith("docs");
    });

    it("should include violations in report", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "BadFunction",
          kind: "function",
          file: "src/bad.ts",
          startLine: 1,
          endLine: 10,
        },
      ];

      const violations = [
        {
          rule: "naming-convention",
          file: "src/bad.ts",
          symbolId: "1",
          message: "Function name does not follow camelCase",
          severity: "warning" as const,
        },
      ];

      const errorViolations = [
        {
          rule: "layer-boundary",
          file: "src/domain/order.ts",
          symbolId: "2",
          message: "Domain imports from infrastructure",
          severity: "error" as const,
        },
      ];

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([...errorViolations, ...violations]);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("## ⚠️ Critical Issues");
      expect(result).toContain("layer-boundary");
      expect(result).toContain("## 🏗️ Architecture Quality");
      expect(result).toContain("error**: 1 violation(s)");
      expect(result).toContain("warning**: 1 violation(s)");
    });

    it("should include patterns in report", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "FactoryService",
          kind: "class",
          file: "src/factory.ts",
          startLine: 1,
          endLine: 30,
        },
      ];

      const patterns = [
        {
          kind: "factory",
          symbols: ["FactoryService"],
          confidence: 0.95,
          violations: [],
        },
        {
          kind: "singleton",
          symbols: ["DatabaseConnection"],
          confidence: 0.88,
          violations: [],
        },
      ];

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue(patterns);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("## 🎯 Detected Patterns (2)");
      expect(result).toContain("factory**: 1 symbol(s) (confidence: 95%)");
      expect(result).toContain("singleton**: 1 symbol(s) (confidence: 88%)");
    });

    it("should include code quality findings in report", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "DeadCode",
          kind: "function",
          file: "src/dead.ts",
          startLine: 1,
          endLine: 10,
        },
      ];

      const findings = [
        {
          type: "dead_code" as const,
          target: "1",
          reason: "Function has no incoming references",
          suggestedAction: "review" as const,
        },
        {
          type: "orphan_doc" as const,
          target: "docs/old.md",
          reason: "Symbol no longer exists",
          suggestedAction: "update" as const,
        },
      ];

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue(findings);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("## 🧹 Code Quality (2 issue(s))");
      expect(result).toContain("dead_code**: 1");
      expect(result).toContain("orphan_doc**: 1");
    });

    it("should include validators results when includeExamples is true", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: true,
      };

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "MyFunction",
          kind: "function",
          file: "src/my.ts",
          startLine: 1,
          endLine: 5,
        },
      ];

      const exampleResults = [
        { docPath: "docs/example1.md", valid: true, error: undefined },
        { docPath: "docs/example2.md", valid: false, error: "Syntax error" },
        { docPath: "docs/example3.md", valid: true, error: undefined },
      ];

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const mockValidator = {
        validateAll: jest.fn().mockResolvedValue(exampleResults),
      };

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
        codeExampleValidator: mockValidator,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("## ✅ Documentation Examples");
      expect(result).toContain("Total**: 3");
      expect(result).toContain("Valid**: 2");
      expect(result).toContain("Pass Rate**: 66.7%");
      expect(mockValidator.validateAll).toHaveBeenCalledWith("docs");
    });

    it("should include recommendations for low documentation coverage", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      const symbols: CodeSymbol[] = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: String(i),
          name: `Sym${i}`,
          kind: "function",
          file: "src/file.ts",
          startLine: i,
          endLine: i + 5,
        }));

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([
        { symbolName: "Sym0", docPath: "docs/sym.md" },
      ]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("## 💡 Recommendations");
      expect(result).toContain("Documentation**: Coverage is at 1.0%. Target: 80%+");
    });

    it("should include recommendations for architecture errors", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "MyService",
          kind: "class",
          file: "src/service.ts",
          startLine: 1,
          endLine: 10,
        },
      ];

      const violations = [
        {
          rule: "domain-isolation",
          file: "src/domain/service.ts",
          symbolId: "1",
          message: "Domain imports from infrastructure",
          severity: "error" as const,
        },
      ];

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue(violations);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("## 💡 Recommendations");
      expect(result).toContain("Architecture**: Fix all error-level violations before merging");
    });

    it("should handle validator errors gracefully", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: true,
      };

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue([]);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const mockValidator = {
        validateAll: jest.fn().mockRejectedValue(new Error("Validation failed")),
      };

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
        codeExampleValidator: mockValidator,
      };

      await expect(performSmartCodeReview(options, deps)).rejects.toThrow("Validation failed");
    });

    it("should generate proper timestamp in report", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue([]);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue([]);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);
      const today = new Date().toISOString().split("T")[0];

      expect(result).toContain(`*Report generated on ${today}*`);
    });

    it("should calculate documentation coverage correctly", async () => {
      const options: SmartCodeReviewOptions = {
        docsDir: "docs",
        includeExamples: false,
      };

      const symbols: CodeSymbol[] = [
        {
          id: "1",
          name: "ServiceA",
          kind: "class",
          file: "src/a.ts",
          startLine: 1,
          endLine: 10,
        },
        {
          id: "2",
          name: "ServiceB",
          kind: "class",
          file: "src/b.ts",
          startLine: 1,
          endLine: 10,
        },
        {
          id: "3",
          name: "ServiceC",
          kind: "class",
          file: "src/c.ts",
          startLine: 1,
          endLine: 10,
        },
      ];

      const mappings = [
        { symbolName: "ServiceA", docPath: "docs/a.md" },
        { symbolName: "ServiceB", docPath: "docs/b.md" },
      ];

      mockRegistry.rebuild.mockResolvedValue(undefined);
      mockSymbolRepo.findAll.mockReturnValue(symbols);
      mockRelRepo.findAll.mockReturnValue([]);
      mockRegistry.findAllMappings.mockResolvedValue(mappings);
      mockPatternAnalyzer.analyze.mockReturnValue([]);
      mockArchGuard.analyze.mockReturnValue([]);
      mockReaper.scan.mockReturnValue([]);

      const deps: SmartCodeReviewDeps = {
        symbolRepo: mockSymbolRepo,
        relRepo: mockRelRepo,
        registry: mockRegistry,
        patternAnalyzer: mockPatternAnalyzer,
        archGuard: mockArchGuard,
        reaper: mockReaper,
        graph: mockGraph,
      };

      const result = await performSmartCodeReview(options, deps);

      expect(result).toContain("Documented**: 2 (66.7%)");
    });
  });
});
