import type { CodeSymbol } from "../indexer/symbol.types.js";

export interface SmartCodeReviewInput {
  symbols: CodeSymbol[];
  architectureViolations: Array<{ rule: string; severity: string; message: string; file: string }>;
  patterns: Array<{ kind: string; confidence: number; violations: string[]; symbols: string[] }>;
  deadCodeFindings: Array<{ target: string; reason: string }>;
  docCoverage: { documented: number; total: number };
}

// buildSmartCodeReviewPrompt has been removed (obsolete/unused).
export function buildSmartCodeReviewPrompt_DEPRECATED(input: SmartCodeReviewInput): string {
  const { symbols, architectureViolations, patterns, deadCodeFindings, docCoverage } = input;

  const parts: string[] = [
    `You are a senior architect performing a comprehensive code review. Provide structured, actionable feedback.`,
    ``,
    `## Codebase Overview`,
    `- **Total symbols**: ${symbols.length}`,
    `- **Documentation coverage**: ${docCoverage.documented}/${docCoverage.total} (${docCoverage.total > 0 ? ((docCoverage.documented / docCoverage.total) * 100).toFixed(0) : 0}%)`,
    `- **Patterns detected**: ${patterns.length}`,
    `- **Architecture violations**: ${architectureViolations.length}`,
    `- **Dead code findings**: ${deadCodeFindings.length}`,
  ];

  if (architectureViolations.length > 0) {
    parts.push(``, `## Architecture Violations`);
    for (const v of architectureViolations.slice(0, 20)) {
      parts.push(`- [${v.severity.toUpperCase()}] ${v.rule}: ${v.message} (${v.file})`);
    }
    if (architectureViolations.length > 20) {
      parts.push(`- ... and ${architectureViolations.length - 20} more`);
    }
  }

  if (patterns.length > 0) {
    parts.push(``, `## Detected Patterns`);
    for (const p of patterns) {
      parts.push(`- **${p.kind}** (confidence: ${(p.confidence * 100).toFixed(0)}%)`);
      if (p.violations.length > 0) {
        for (const v of p.violations) {
          parts.push(`  - Violation: ${v}`);
        }
      }
    }
  }

  if (deadCodeFindings.length > 0) {
    parts.push(``, `## Dead Code`);
    for (const f of deadCodeFindings.slice(0, 15)) {
      parts.push(`- ${f.target}: ${f.reason}`);
    }
    if (deadCodeFindings.length > 15) {
      parts.push(`- ... and ${deadCodeFindings.length - 15} more`);
    }
  }

  parts.push(
    ``,
    `## Instructions`,
    `Provide a structured code review with:`,
    `1. **Executive Summary**: Overall health assessment (1-2 sentences)`,
    `2. **Critical Issues**: Must-fix problems ranked by severity`,
    `3. **Architecture Recommendations**: Structural improvements`,
    `4. **Code Quality**: Naming, patterns, SOLID compliance`,
    `5. **Documentation Gaps**: What needs documenting`,
    `6. **Action Items**: Prioritized list of next steps`,
  );

  return parts.join("\n");
}
