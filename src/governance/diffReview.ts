import type { DocGuardResult } from "./docGuardCli.js";
import type { ChangeImpact } from "../indexer/symbol.types.js";
import type { LlmProvider } from "../llm/provider.js";
import type { LoadedSiteData } from "../site/dataLoader.js";

export type DiffReviewStatus = "not_requested" | "skipped" | "generated" | "failed";
export type DiffReviewFindingSeverity = "info" | "warning" | "error" | "critical";
export type DiffReviewFindingSource =
  | "impact"
  | "docs_guard"
  | "architecture"
  | "pattern"
  | "reaper";

export interface DiffReviewFinding {
  id: string;
  source: DiffReviewFindingSource;
  severity: DiffReviewFindingSeverity;
  title: string;
  message: string;
  file?: string;
  symbolId?: string;
  line?: number;
  suggestion?: string;
}

export interface DiffReviewItem {
  symbolId: string;
  symbolName: string;
  qualifiedName?: string;
  file: string;
  changeType: ChangeImpact["changeType"];
  status: DiffReviewStatus;
  aiSummary?: string;
  error?: string;
  findings: DiffReviewFinding[];
}

export interface DiffReviewSummary {
  status: DiffReviewStatus;
  generatedAt: string;
  provider?: string;
  summary: string;
  error?: string;
  totalFindings: number;
  findingsBySeverity: Record<DiffReviewFindingSeverity, number>;
  items: DiffReviewItem[];
}

export interface BuildDiffReviewOptions {
  impacts: ChangeImpact[];
  data: LoadedSiteData;
  docGuard: DocGuardResult;
  aiReview: boolean;
  llm?: LlmProvider;
  provider?: string;
  maxItems?: number;
}

const emptyFindingsBySeverity: Record<DiffReviewFindingSeverity, number> = {
  info: 0,
  warning: 0,
  error: 0,
  critical: 0,
};

function impactSeverity(severity: ChangeImpact["severity"]): DiffReviewFindingSeverity {
  if (severity === "critical") return "critical";
  if (severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "info";
}

function makeFindingId(...parts: Array<string | number | undefined>): string {
  return parts.filter((part) => part !== undefined && String(part).length > 0).join(":");
}

function collectImpactFindings(impact: ChangeImpact): DiffReviewFinding[] {
  const findings: DiffReviewFinding[] = [];

  if (impact.breakingChange || impact.severity === "high" || impact.severity === "critical") {
    findings.push({
      id: makeFindingId("impact", impact.symbol.id, impact.changeType, impact.severity),
      source: "impact",
      severity: impact.breakingChange ? "critical" : impactSeverity(impact.severity),
      title: impact.breakingChange ? "Potential breaking change" : "High-risk change",
      message: impact.reason ?? `${impact.changeType} change detected for ${impact.symbol.name}.`,
      file: impact.symbol.file,
      symbolId: impact.symbol.id,
      line: impact.symbol.startLine,
    });
  }

  for (const [index, action] of (impact.suggestedActions ?? []).entries()) {
    findings.push({
      id: makeFindingId("impact-action", impact.symbol.id, index),
      source: "impact",
      severity: action.type === "review" ? "warning" : "info",
      title: action.type.replace(/_/g, " "),
      message: action.description,
      file: impact.symbol.file,
      symbolId: impact.symbol.id,
      line: impact.symbol.startLine,
      suggestion: action.target,
    });
  }

  return findings;
}

function collectDocGuardFindings(
  impact: ChangeImpact,
  docGuard: DocGuardResult,
): DiffReviewFinding[] {
  return docGuard.uncoveredChanges
    .filter(
      (violation) =>
        violation.symbolName === impact.symbol.name && violation.file === impact.symbol.file,
    )
    .map((violation, index) => ({
      id: makeFindingId("docs-guard", impact.symbol.id, index),
      source: "docs_guard" as const,
      severity: "warning" as const,
      title: "Documentation coverage gap",
      message: violation.reason,
      file: violation.file,
      symbolId: impact.symbol.id,
      line: impact.symbol.startLine,
      suggestion: violation.docPath
        ? `Update ${violation.docPath}`
        : "Link documentation for this symbol",
    }));
}

function collectArchitectureFindings(
  impact: ChangeImpact,
  data: LoadedSiteData,
): DiffReviewFinding[] {
  return data.archViolations
    .filter(
      (violation) =>
        violation.symbol_id === impact.symbol.id ||
        (!violation.symbol_id && violation.file === impact.symbol.file),
    )
    .map((violation, index) => ({
      id: makeFindingId("architecture", impact.symbol.id, violation.rule, index),
      source: "architecture" as const,
      severity: violation.severity === "error" ? ("error" as const) : ("warning" as const),
      title: violation.rule,
      message: violation.message,
      file: violation.file,
      symbolId: violation.symbol_id ?? impact.symbol.id,
      line: impact.symbol.startLine,
    }));
}

function collectPatternFindings(impact: ChangeImpact, data: LoadedSiteData): DiffReviewFinding[] {
  const findings: DiffReviewFinding[] = [];

  for (const pattern of data.patterns) {
    if (!pattern.symbols.includes(impact.symbol.id) || pattern.violations.length === 0) continue;

    for (const [index, violation] of pattern.violations.entries()) {
      findings.push({
        id: makeFindingId("pattern", impact.symbol.id, pattern.kind, index),
        source: "pattern",
        severity: pattern.confidence < 0.7 ? "info" : "warning",
        title: `${pattern.kind} pattern issue`,
        message: violation,
        file: impact.symbol.file,
        symbolId: impact.symbol.id,
        line: impact.symbol.startLine,
      });
    }
  }

  return findings;
}

function collectReaperFindings(impact: ChangeImpact, data: LoadedSiteData): DiffReviewFinding[] {
  return data.reaperFindings
    .filter(
      (finding) =>
        finding.target === impact.symbol.id ||
        finding.target === impact.symbol.file ||
        finding.reason.includes(impact.symbol.name) ||
        finding.reason.includes(impact.symbol.file),
    )
    .map((finding, index) => ({
      id: makeFindingId("reaper", impact.symbol.id, finding.type, index),
      source: "reaper" as const,
      severity: finding.type === "dead_code" ? ("warning" as const) : ("info" as const),
      title: finding.type.replace(/_/g, " "),
      message: finding.reason,
      file: impact.symbol.file,
      symbolId: impact.symbol.id,
      line: impact.symbol.startLine,
      suggestion: finding.suggested_action,
    }));
}

function collectFindings(
  impact: ChangeImpact,
  data: LoadedSiteData,
  docGuard: DocGuardResult,
): DiffReviewFinding[] {
  return [
    ...collectImpactFindings(impact),
    ...collectDocGuardFindings(impact, docGuard),
    ...collectArchitectureFindings(impact, data),
    ...collectPatternFindings(impact, data),
    ...collectReaperFindings(impact, data),
  ];
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n... truncated ...`;
}

function buildItemPrompt(item: DiffReviewItem, impact: ChangeImpact): string {
  const findings = item.findings
    .map((finding) => `- ${finding.severity}/${finding.source}: ${finding.message}`)
    .join("\n");

  return `You are reviewing one code diff for a pull request. Return a concise code-review summary with risks and concrete suggestions. Do not repeat the full diff.

Symbol: ${item.qualifiedName ?? item.symbolName}
File: ${item.file}
Change type: ${item.changeType}
Known findings:
${findings || "- None"}

Diff:
${truncate(impact.diff || "No textual diff captured.", 4000)}`;
}

function buildOverallPrompt(items: DiffReviewItem[]): string {
  const changes = items
    .map(
      (item) =>
        `- ${item.qualifiedName ?? item.symbolName} (${item.changeType}, ${item.file}): ${item.findings.length} finding(s)`,
    )
    .join("\n");
  const summaries = items
    .filter((item) => item.aiSummary)
    .map((item) => `- ${item.symbolName}: ${item.aiSummary}`)
    .join("\n");

  return `Create a short pull-request code-review summary from these changed symbols. Focus on behavioral risk, missing docs/tests, and anti-patterns. Keep it under 8 bullet points.

Changes:
${changes || "- None"}

Per-change review notes:
${summaries || "- None"}`;
}

function buildDeterministicSummary(items: DiffReviewItem[]): string {
  const totalFindings = items.reduce((sum, item) => sum + item.findings.length, 0);
  const changedFiles = new Set(items.map((item) => item.file)).size;
  const riskyItems = items.filter((item) =>
    item.findings.some(
      (finding) => finding.severity === "error" || finding.severity === "critical",
    ),
  ).length;

  if (items.length === 0) return "No semantic changes were detected for review.";
  if (totalFindings === 0) {
    return `${items.length} changed symbol(s) across ${changedFiles} file(s). No deterministic anti-patterns or review problems were detected.`;
  }

  return `${items.length} changed symbol(s) across ${changedFiles} file(s), with ${totalFindings} review finding(s). ${riskyItems} change(s) include error or critical risk.`;
}

function countFindingsBySeverity(
  items: DiffReviewItem[],
): Record<DiffReviewFindingSeverity, number> {
  const counts = { ...emptyFindingsBySeverity };
  for (const item of items) {
    for (const finding of item.findings) {
      counts[finding.severity]++;
    }
  }
  return counts;
}

async function generateAiSummaries(
  items: DiffReviewItem[],
  impacts: ChangeImpact[],
  llm: LlmProvider,
  maxItems: number,
): Promise<void> {
  const impactsById = new Map(impacts.map((impact) => [impact.symbol.id, impact]));

  for (const item of items.slice(0, maxItems)) {
    const impact = impactsById.get(item.symbolId);
    if (!impact) continue;

    try {
      item.aiSummary = await llm.chat([{ role: "user", content: buildItemPrompt(item, impact) }], {
        maxTokens: 450,
        temperature: 0.2,
      });
      item.status = "generated";
    } catch (error) {
      item.status = "failed";
      item.error = (error as Error).message;
    }
  }
}

export async function buildDiffReview(options: BuildDiffReviewOptions): Promise<DiffReviewSummary> {
  const maxItems = options.maxItems ?? 12;
  const items: DiffReviewItem[] = options.impacts.map((impact) => ({
    symbolId: impact.symbol.id,
    symbolName: impact.symbol.name,
    qualifiedName: impact.symbol.qualifiedName,
    file: impact.symbol.file,
    changeType: impact.changeType,
    status: options.aiReview ? "skipped" : "not_requested",
    findings: collectFindings(impact, options.data, options.docGuard),
  }));

  if (!options.aiReview) {
    return {
      status: "not_requested",
      generatedAt: new Date().toISOString(),
      provider: options.provider,
      summary: buildDeterministicSummary(items),
      totalFindings: items.reduce((sum, item) => sum + item.findings.length, 0),
      findingsBySeverity: countFindingsBySeverity(items),
      items,
    };
  }

  if (!options.llm) {
    return {
      status: "skipped",
      generatedAt: new Date().toISOString(),
      provider: options.provider,
      summary: buildDeterministicSummary(items),
      totalFindings: items.reduce((sum, item) => sum + item.findings.length, 0),
      findingsBySeverity: countFindingsBySeverity(items),
      items,
      error: "AI review was requested, but no LLM provider is configured.",
    };
  }

  await generateAiSummaries(items, options.impacts, options.llm, maxItems);

  let summary = buildDeterministicSummary(items);
  let status: DiffReviewStatus = items.some((item) => item.status === "generated")
    ? "generated"
    : "failed";
  let error: string | undefined;

  try {
    summary = await options.llm.chat([{ role: "user", content: buildOverallPrompt(items) }], {
      maxTokens: 700,
      temperature: 0.2,
    });
    status = "generated";
  } catch (caught) {
    status = status === "generated" ? "generated" : "failed";
    error = (caught as Error).message;
  }

  return {
    status,
    generatedAt: new Date().toISOString(),
    provider: options.provider,
    summary,
    error,
    totalFindings: items.reduce((sum, item) => sum + item.findings.length, 0),
    findingsBySeverity: countFindingsBySeverity(items),
    items,
  };
}
