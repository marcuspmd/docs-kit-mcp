import type { CodeSymbol } from "../indexer/symbol.types.js";

export interface CodeReviewInput {
  diff: string;
  affectedSymbols: CodeSymbol[];
  relatedDocs: Array<{ symbolName: string; docPath: string }>;
  architectureViolations?: Array<{ rule: string; severity: string; message: string }>;
}

// buildCodeReviewPrompt has been removed (obsolete/unused).
// Use smartCodeReview.prompt.ts instead.
export function buildCodeReviewPrompt_DEPRECATED(input: CodeReviewInput): string {
  const { diff, affectedSymbols, relatedDocs, architectureViolations } = input;

  const parts: string[] = [
    `You are a senior engineer reviewing a code change. Provide specific, actionable feedback with line references.`,
    ``,
    `## Diff`,
    "```diff",
    diff.slice(0, 8000),
    "```",
  ];

  if (diff.length > 8000) {
    parts.push(`_(diff truncated, ${diff.length} chars total)_`);
  }

  if (affectedSymbols.length > 0) {
    parts.push(``, `## Affected Symbols (from semantic index)`);
    for (const sym of affectedSymbols) {
      const meta = [sym.kind, sym.file];
      if (sym.layer) meta.push(`layer: ${sym.layer}`);
      if (sym.pattern) meta.push(`pattern: ${sym.pattern}`);
      parts.push(`- **${sym.name}** (${meta.join(", ")})`);
    }
  }

  if (relatedDocs.length > 0) {
    parts.push(``, `## Related Documentation`);
    for (const doc of relatedDocs) {
      parts.push(`- ${doc.symbolName} -> ${doc.docPath}`);
    }
  }

  if (architectureViolations?.length) {
    parts.push(``, `## Architecture Violations Introduced`);
    for (const v of architectureViolations) {
      parts.push(`- [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}`);
    }
  }

  parts.push(
    ``,
    `## Instructions`,
    `Review this change and provide:`,
    `1. **Summary**: What this change does (1-2 sentences)`,
    `2. **Correctness**: Bugs, logic errors, edge cases`,
    `3. **Security**: Injection, auth, data exposure risks`,
    `4. **Performance**: N+1 queries, unnecessary allocations, missing caching`,
    `5. **Documentation**: Do docs listed above need updating?`,
    `6. **Suggestions**: Concrete improvements with code examples if applicable`,
  );

  return parts.join("\n");
}
