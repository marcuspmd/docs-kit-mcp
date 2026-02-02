import type { ChangeImpact } from "../indexer/symbol.types.js";
import type { DocRegistry } from "../docs/docRegistry.js";
import type { AnalyzeDeps } from "../analyzer/changeAnalyzer.js";

export interface DocGuardOptions {
  repoPath: string;
  base: string;
  head?: string;
  strict?: boolean;
}

export interface DocGuardResult {
  passed: boolean;
  totalChanges: number;
  coveredChanges: number;
  uncoveredChanges: DocGuardViolation[];
}

export interface DocGuardViolation {
  symbolName: string;
  file: string;
  changeType: string;
  docPath?: string;
  reason: string;
}

export interface DocGuardDeps {
  analyzeChanges: (
    options: { repoPath: string; base: string; head?: string },
    deps?: AnalyzeDeps,
  ) => Promise<ChangeImpact[]>;
  registry: DocRegistry;
  getChangedFiles: (options: DocGuardOptions) => Promise<string[]>;
}

export async function runDocGuard(
  options: DocGuardOptions,
  deps: DocGuardDeps,
): Promise<DocGuardResult> {
  const strict = options.strict ?? true;

  const impacts = await deps.analyzeChanges({
    repoPath: options.repoPath,
    base: options.base,
    head: options.head,
  });

  const requiring = impacts.filter((i) => i.docUpdateRequired);
  const changedFiles = await deps.getChangedFiles(options);
  const changedDocs = changedFiles.filter((f) => f.endsWith(".md"));

  const violations: DocGuardViolation[] = [];

  for (const impact of requiring) {
    const mappings = await deps.registry.findDocBySymbol(impact.symbol.name);
    const docTouched = mappings.some((m) => changedDocs.includes(m.docPath));

    if (!docTouched) {
      violations.push({
        symbolName: impact.symbol.name,
        file: impact.symbol.file,
        changeType: impact.changeType,
        docPath: mappings[0]?.docPath,
        reason:
          mappings.length === 0
            ? "No doc linked to this symbol"
            : "Linked doc was not updated in this PR",
      });
    }
  }

  const passed = strict ? violations.length === 0 : true;

  return {
    passed,
    totalChanges: requiring.length,
    coveredChanges: requiring.length - violations.length,
    uncoveredChanges: violations,
  };
}

export function formatResult(result: DocGuardResult): string {
  if (result.uncoveredChanges.length > 0) {
    const lines = [
      `docs-guard: ${result.uncoveredChanges.length} symbol(s) changed without doc updates:`,
    ];
    for (const v of result.uncoveredChanges) {
      lines.push(`  - ${v.symbolName} (${v.file}): ${v.reason}`);
    }
    return lines.join("\n");
  }
  return `docs-guard: ${result.coveredChanges}/${result.totalChanges} changes covered.`;
}
