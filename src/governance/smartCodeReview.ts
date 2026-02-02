import type { DocRegistry } from "../docs/docRegistry.js";
import type { SymbolRepository, RelationshipRepository } from "../storage/db.js";
import type { PatternAnalyzer } from "../patterns/patternAnalyzer.js";
import type { ArchGuard } from "../governance/archGuard.js";
import type { Reaper } from "../governance/reaper.js";
import type { KnowledgeGraph } from "../knowledge/graph.js";
import type { ValidationResult } from "../docs/codeExampleValidator.js";

export interface SmartCodeReviewOptions {
  docsDir: string;
  includeExamples: boolean;
}

export interface SmartCodeReviewDeps {
  symbolRepo: SymbolRepository;
  relRepo: RelationshipRepository;
  registry: DocRegistry;
  patternAnalyzer: PatternAnalyzer;
  archGuard: ArchGuard;
  reaper: Reaper;
  graph: KnowledgeGraph;
  codeExampleValidator?: {
    validateAll: (docsDir: string) => Promise<ValidationResult[]>;
  };
}

export interface SmartCodeReviewResult {
  summary: {
    totalSymbols: number;
    documentedSymbols: number;
    coverage: number;
    architectureViolations: number;
    detectedPatterns: number;
    deadCodeIssues: number;
    validExamples?: number;
    totalExamples?: number;
  };
  criticalIssues: {
    violations: unknown[];
    findings: unknown[];
  };
  architecture: {
    violations: unknown[];
    violationsBySeverity: Record<string, number>;
  };
  patterns: unknown[];
  codeQuality: {
    findings: unknown[];
    issuesByType: Record<string, number>;
  };
  documentation?: {
    exampleResults: ValidationResult[];
    validCount: number;
    passRate: number;
  };
  recommendations: string[];
}

export async function performSmartCodeReview(
  options: SmartCodeReviewOptions,
  deps: SmartCodeReviewDeps,
): Promise<string> {
  const { docsDir, includeExamples } = options;
  const {
    symbolRepo,
    relRepo,
    registry,
    patternAnalyzer,
    archGuard,
    reaper,
    graph,
    codeExampleValidator,
  } = deps;

  await registry.rebuild(docsDir);

  const allSymbols = symbolRepo.findAll();
  const allRels = relRepo.findAll().map((r) => ({
    sourceId: r.source_id,
    targetId: r.target_id,
    type: r.type,
  }));
  const mappings = await registry.findAllMappings();

  // Sequential analysis
  patternAnalyzer.analyze(allSymbols, allRels);
  archGuard.analyze(allSymbols, allRels);
  reaper.scan(allSymbols, graph, mappings);

  let exampleResults: ValidationResult[] = [];
  if (includeExamples && codeExampleValidator) {
    console.log("Starting example validation...");
    try {
      console.log(`Validating examples in docs dir: ${docsDir}`);
      exampleResults = await codeExampleValidator.validateAll(docsDir);
      console.log(`Example validation done: ${exampleResults.length} examples validated`);
    } catch (error) {
      console.error("Error during example validation:", error);
      throw error;
    }
  }

  // Build comprehensive report
  const report = [`# 🔍 Smart Code Review Report\n`];

  // TODO: Complete the report building logic - currently only partial implementation
  // Add critical issues, architecture, patterns, code quality sections
  // Implement proper result structure and formatting

  return report.join("\n");
}
