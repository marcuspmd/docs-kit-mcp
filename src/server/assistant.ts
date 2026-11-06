/**
 * Site assistant — answers questions about a symbol / file / project using the
 * data bundle (site-data.json) as context. Runs server-side so the API key
 * never reaches the browser.
 */
import fs from "fs";
import path from "path";
import type { LlmProvider } from "../llm/provider.js";

export interface AssistantRequest {
  question: string;
  scope?: { type?: "symbol" | "file" | "project"; id?: string; path?: string };
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface SiteSymbol {
  id: string;
  name: string;
  qualifiedName?: string;
  kind: string;
  file: string;
  startLine: number;
  endLine: number;
  signature?: string;
}
interface SiteComplexity {
  id: string;
  name: string;
  file: string;
  linesOfCode?: number;
  cyclomaticComplexity?: number;
  cognitiveComplexity?: number;
  coveragePercent?: number;
  riskScore?: number;
}
interface SiteData {
  project?: { name?: string; branch?: string };
  symbols: SiteSymbol[];
  complexity?: { symbols?: SiteComplexity[] };
  sourceFiles?: Record<string, { text?: string }>;
  archViolations?: Array<{ file: string; message?: string; rule?: string }>;
}

const MAX_SOURCE_CHARS = 12_000;
const MAX_QUESTION_CHARS = 4_000;
const MAX_HISTORY = 10;

const SYSTEM_PROMPT =
  "You are the docs-kit assistant embedded in a code documentation site. " +
  "Answer concisely using ONLY the provided project context. If the context does not " +
  "contain the answer, say so. Reply in the same language as the question. Use markdown.";

function loadSiteData(outDir: string): SiteData {
  const raw = fs.readFileSync(path.join(outDir, "site-data.json"), "utf-8");
  return JSON.parse(raw) as SiteData;
}

function clip(text: string, max = MAX_SOURCE_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n… [truncated]` : text;
}

function metricsLine(c?: SiteComplexity): string {
  if (!c) return "no metrics";
  return `LOC ${c.linesOfCode ?? "?"}, cyclomatic ${c.cyclomaticComplexity ?? "?"}, cognitive ${
    c.cognitiveComplexity ?? "?"
  }, coverage ${c.coveragePercent != null ? `${c.coveragePercent.toFixed(1)}%` : "n/a"}, risk ${
    c.riskScore != null ? c.riskScore.toFixed(1) : "n/a"
  }`;
}

export function buildAssistantContext(data: SiteData, scope: AssistantRequest["scope"]): string {
  const complexity = new Map((data.complexity?.symbols ?? []).map((c) => [c.id, c]));
  const lines: string[] = [`Project: ${data.project?.name ?? "unknown"}`];

  if (scope?.type === "symbol" && scope.id) {
    const sym = data.symbols.find((s) => s.id === scope.id);
    if (sym) {
      lines.push(
        `Scope: symbol ${sym.qualifiedName ?? sym.name} (${sym.kind}) in ${sym.file}:${sym.startLine}-${sym.endLine}`,
        `Signature: ${sym.signature ?? "n/a"}`,
        `Metrics: ${metricsLine(complexity.get(sym.id))}`,
      );
      const src = data.sourceFiles?.[sym.file]?.text;
      if (src) {
        const body = src
          .split("\n")
          .slice(Math.max(0, sym.startLine - 1), sym.endLine)
          .join("\n");
        lines.push("Source:", "```", clip(body), "```");
      }
      return lines.join("\n");
    }
  }

  if (scope?.type === "file" && scope.path) {
    const filePath = scope.path;
    const fileSyms = data.symbols.filter((s) => s.file === filePath);
    lines.push(`Scope: file ${filePath} (${fileSyms.length} symbols)`);
    for (const s of fileSyms.slice(0, 60)) {
      lines.push(
        `- ${s.kind} ${s.name} L${s.startLine}-${s.endLine}: ${metricsLine(complexity.get(s.id))}`,
      );
    }
    const viol = (data.archViolations ?? []).filter((v) => v.file === filePath);
    if (viol.length) {
      lines.push(
        "Architecture violations:",
        ...viol.map((v) => `- ${v.rule ?? ""} ${v.message ?? ""}`),
      );
    }
    const src = data.sourceFiles?.[filePath]?.text;
    if (src) lines.push("Source:", "```", clip(src), "```");
    return lines.join("\n");
  }

  const top = [...(data.complexity?.symbols ?? [])]
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    .slice(0, 15);
  lines.push(
    `Scope: whole project (${data.symbols.length} symbols, ${Object.keys(data.sourceFiles ?? {}).length} files)`,
    `Architecture violations: ${data.archViolations?.length ?? 0}`,
    "Top risk symbols:",
    ...top.map((c) => `- ${c.name} (${c.file}): ${metricsLine(c)}`),
  );
  return lines.join("\n");
}

export async function answerAssistant(
  outDir: string,
  llm: LlmProvider,
  req: AssistantRequest,
): Promise<string> {
  const question = (req.question ?? "").toString().trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) throw new Error("Empty question");
  const data = loadSiteData(outDir);
  const context = buildAssistantContext(data, req.scope);
  const history = (req.history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_CHARS) }));
  return llm.chat([
    { role: "system", content: `${SYSTEM_PROMPT}\n\n# Context\n${context}` },
    ...history,
    { role: "user", content: question },
  ]);
}
