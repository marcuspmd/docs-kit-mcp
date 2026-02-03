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
  const patterns = patternAnalyzer.analyze(allSymbols, allRels);
  const violations = archGuard.analyze(allSymbols, allRels);
  const findings = reaper.scan(allSymbols, graph, mappings);

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
  const report: string[] = [`# 🔍 Smart Code Review Report\n`];

  // Summary statistics
  const documentedSymbols = mappings.length;
  const docCoverage = allSymbols.length > 0 ? (documentedSymbols / allSymbols.length) * 100 : 0;

  report.push(`## 📊 Summary
- **Total Symbols**: ${allSymbols.length}
- **Documented**: ${documentedSymbols} (${docCoverage.toFixed(1)}%)
- **Architecture Violations**: ${violations.length}
- **Code Quality Issues**: ${findings.length}
- **Patterns Detected**: ${patterns.length}
${exampleResults.length > 0 ? `- **Examples Validated**: ${exampleResults.length}` : ""}
\n`);

  // Critical issues
  if (violations.length > 0) {
    const criticalViolations = violations.filter((v) => v.severity === "error");
    report.push(`## ⚠️ Critical Issues (${criticalViolations.length})`);

    if (criticalViolations.length > 0) {
      report.push("### Architecture Violations");
      for (const v of criticalViolations.slice(0, 10)) {
        report.push(`- **${v.rule}** (${v.file}): ${v.message}`);
      }
      if (criticalViolations.length > 10) {
        report.push(`- ... and ${criticalViolations.length - 10} more`);
      }
    }
    report.push("");
  }

  // Architecture quality
  if (violations.length > 0) {
    const violationsBySeverity = violations.reduce(
      (acc, v) => {
        acc[v.severity] = (acc[v.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    report.push(`## 🏗️ Architecture Quality
${Object.entries(violationsBySeverity)
  .map(([severity, count]) => `- **${severity}**: ${count} violation(s)`)
  .join("\n")}
\n`);
  }

  // Detected patterns
  if (patterns.length > 0) {
    report.push(`## 🎯 Detected Patterns (${patterns.length})`);
    for (const pattern of patterns.slice(0, 5)) {
      report.push(
        `- **${pattern.kind}**: ${pattern.symbols.length} symbol(s) (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`,
      );
    }
    if (patterns.length > 5) {
      report.push(`- ... and ${patterns.length - 5} more`);
    }
    report.push("");
  }

  // Code quality findings
  if (findings.length > 0) {
    const findingsByType = findings.reduce(
      (acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    report.push(`## 🧹 Code Quality (${findings.length} issue(s))
${Object.entries(findingsByType)
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join("\n")}
\n`);
  }

  // Example validation results
  if (exampleResults.length > 0) {
    const validCount = exampleResults.filter((r) => r.valid).length;
    const passRate = exampleResults.length > 0 ? (validCount / exampleResults.length) * 100 : 0;

    report.push(`## ✅ Documentation Examples
- **Total**: ${exampleResults.length}
- **Valid**: ${validCount}
- **Pass Rate**: ${passRate.toFixed(1)}%
\n`);
  }

  // Recommendations
  const recommendations: string[] = [];
  if (docCoverage < 50) {
    recommendations.push(
      `📚 **Documentation**: Coverage is at ${docCoverage.toFixed(1)}%. Target: 80%+`,
    );
  }
  if (violations.filter((v) => v.severity === "error").length > 0) {
    recommendations.push("🏗️ **Architecture**: Fix all error-level violations before merging");
  }
  if (findings.length > 0) {
    recommendations.push(`🧹 **Code Quality**: Address ${findings.length} identified issue(s)`);
  }
  if (exampleResults.length > 0 && exampleResults.some((r) => !r.valid)) {
    recommendations.push("✏️ **Examples**: Update code examples in documentation");
  }

  if (recommendations.length > 0) {
    report.push(`## 💡 Recommendations
${recommendations.map((r) => `- ${r}`).join("\n")}
\n`);
  }

  report.push(`---
*Report generated on ${new Date().toISOString().split("T")[0]}*`);

  return report.join("\n");
}
