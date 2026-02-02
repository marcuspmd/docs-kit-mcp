/**
 * Dashboard page template (index.html).
 */

import type { SiteData } from "../types.js";
import { escapeHtml } from "../utils.js";
import { badgeClass } from "../badges.js";
import { layout } from "../layout.js";
import { mermaidDiagramWrap, getMermaidExpandModalAndScript } from "../mermaid.js";
import { fileSlug, buildMermaidOverview } from "../../shared.js";

export function renderDashboard(data: SiteData): string {
  const {
    symbols,
    relationships,
    patterns,
    files,
    archViolations = [],
    reaperFindings = [],
    generatedAt,
    docEntries = [],
  } = data;

  const kindCounts: Record<string, number> = {};
  for (const s of symbols) {
    kindCounts[s.kind] = (kindCounts[s.kind] ?? 0) + 1;
  }

  // Layer counts
  const layerCounts: Record<string, number> = {};
  for (const s of symbols) {
    const layer = s.layer || "unknown";
    layerCounts[layer] = (layerCounts[layer] ?? 0) + 1;
  }

  // Top complex symbols
  const complexSymbols = symbols
    .filter((s) => s.metrics?.cyclomaticComplexity)
    .sort((a, b) => (b.metrics!.cyclomaticComplexity || 0) - (a.metrics!.cyclomaticComplexity || 0))
    .slice(0, 10);

  // Group files by directory
  const dirGroups: Record<string, { files: string[]; symbols: number }> = {};
  const dirKindBreakdown: Record<string, Record<string, number>> = {};
  for (const file of files) {
    const dir = file.split("/")[0] || "root";
    if (!dirGroups[dir]) dirGroups[dir] = { files: [], symbols: 0 };
    dirGroups[dir].files.push(file);
  }
  for (const symbol of symbols) {
    const dir = symbol.file.split("/")[0] || "root";
    if (dirGroups[dir]) dirGroups[dir].symbols++;
    if (!dirKindBreakdown[dir]) dirKindBreakdown[dir] = {};
    dirKindBreakdown[dir][symbol.kind] = (dirKindBreakdown[dir][symbol.kind] ?? 0) + 1;
  }

  // Overview graph
  const overviewGraph = buildMermaidOverview(symbols, relationships);

  const topLevel = symbols.filter((s) => !s.parent);

  // Deprecated symbols (top-level only for clarity)
  const deprecatedSymbols = topLevel.filter((s) => s.deprecated);

  // High-impact: symbols with most incoming relationships (top 10)
  const incomingCount = new Map<string, number>();
  for (const r of relationships) {
    incomingCount.set(r.target_id, (incomingCount.get(r.target_id) ?? 0) + 1);
  }
  const highImpactSymbols = symbols
    .filter((s) => (incomingCount.get(s.id) ?? 0) > 0)
    .sort((a, b) => (incomingCount.get(b.id) ?? 0) - (incomingCount.get(a.id) ?? 0))
    .slice(0, 10);

  const generatedLabel = generatedAt
    ? (() => {
        try {
          const d = new Date(generatedAt);
          return (
            d.toLocaleDateString(undefined, { dateStyle: "medium" }) +
            " " +
            d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
          );
        } catch {
          return generatedAt;
        }
      })()
    : "";
  const highComplexityCount = symbols.filter(
    (s) => (s.metrics?.cyclomaticComplexity ?? 0) > 10,
  ).length;

  // Code metrics for dashboard
  const symbolsWithMetrics = symbols.filter((s) => s.metrics).length;
  const withComplexity = symbols.filter((s) => s.metrics?.cyclomaticComplexity != null);
  const avgComplexity =
    withComplexity.length > 0
      ? (
          withComplexity.reduce((sum, s) => sum + (s.metrics!.cyclomaticComplexity ?? 0), 0) /
          withComplexity.length
        ).toFixed(1)
      : null;
  const topByLoc = symbols
    .filter((s) => (s.metrics?.linesOfCode ?? s.endLine - s.startLine + 1) > 0)
    .sort(
      (a, b) =>
        (b.metrics?.linesOfCode ?? b.endLine - b.startLine + 1) -
        (a.metrics?.linesOfCode ?? a.endLine - a.startLine + 1),
    )
    .slice(0, 5);
  const symbolsWithoutDocRef = symbols.filter((s) => !s.docRef).length;

  const body = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      ${generatedLabel ? `<p class="text-sm text-gray-500 dark:text-gray-400" title="Index build time">Generated: ${escapeHtml(generatedLabel)}</p>` : ""}
    </div>

    ${
      deprecatedSymbols.length > 0 || archViolations.length > 0 || highComplexityCount > 0
        ? `
    <div class="flex flex-wrap gap-3 mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Health:</span>
      ${deprecatedSymbols.length > 0 ? `<a href="#deprecated-symbols" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/70">${deprecatedSymbols.length} deprecated</a>` : ""}
      ${archViolations.length > 0 ? `<a href="#arch-violations" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/70">${archViolations.length} violations</a>` : ""}
      ${highComplexityCount > 0 ? `<a href="#top-complex-symbols" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/70">${highComplexityCount} high complexity</a>` : ""}
    </div>`
        : ""
    }

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6 text-center">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Files</dt>
          <dd class="mt-1 text-3xl font-semibold text-blue-600 dark:text-blue-400">${files.length}</dd>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6 text-center">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Symbols</dt>
          <dd class="mt-1 text-3xl font-semibold text-blue-600 dark:text-blue-400">${symbols.length}</dd>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6 text-center">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Relationships</dt>
          <dd class="mt-1 text-3xl font-semibold text-blue-600 dark:text-blue-400">${relationships.length}</dd>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6 text-center">
          <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Patterns</dt>
          <dd class="mt-1 text-3xl font-semibold text-blue-600 dark:text-blue-400">${patterns.length}</dd>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      ${
        avgComplexity != null
          ? `
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-4 text-center">
          <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Avg complexity</dt>
          <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${avgComplexity}</dd>
        </div>
      </div>`
          : ""
      }
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-4 text-center">
          <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">With metrics</dt>
          <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${symbolsWithMetrics}</dd>
        </div>
      </div>
      ${
        symbolsWithoutDocRef > 0
          ? `
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-4 text-center">
          <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Without doc ref</dt>
          <dd class="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">${symbolsWithoutDocRef}</dd>
        </div>
      </div>`
          : ""
      }
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-4 text-center">
          <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Symbol kinds</dt>
          <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${Object.keys(kindCounts).length}</dd>
        </div>
      </div>
    </div>

    ${(() => {
      // Calculate test coverage stats
      const symbolsWithCoverage = symbols.filter((s) => s.metrics?.testCoverage);
      if (symbolsWithCoverage.length === 0) return "";

      const totalCoverage = symbolsWithCoverage.reduce(
        (sum, s) => sum + (s.metrics?.testCoverage?.coveragePercent || 0),
        0,
      );
      const avgCoverage = totalCoverage / symbolsWithCoverage.length;

      const fullyCovered = symbolsWithCoverage.filter(
        (s) => (s.metrics?.testCoverage?.coveragePercent || 0) >= 80,
      ).length;
      const partiallyCovered = symbolsWithCoverage.filter((s) => {
        const cov = s.metrics?.testCoverage?.coveragePercent || 0;
        return cov >= 50 && cov < 80;
      }).length;
      const lowCoverage = symbolsWithCoverage.filter((s) => {
        const cov = s.metrics?.testCoverage?.coveragePercent || 0;
        return cov > 0 && cov < 50;
      }).length;
      const uncovered = symbolsWithCoverage.filter(
        (s) => (s.metrics?.testCoverage?.coveragePercent || 0) === 0,
      ).length;

      const coveragePercent = ((symbolsWithCoverage.length / symbols.length) * 100).toFixed(1);

      return `
    <div id="test-coverage" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Test Coverage</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-4 py-4 text-center">
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Avg Coverage</dt>
            <dd class="mt-1 text-2xl font-semibold ${avgCoverage >= 80 ? "text-green-600 dark:text-green-400" : avgCoverage >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}">${avgCoverage.toFixed(1)}%</dd>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-4 py-4 text-center">
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">With Tests</dt>
            <dd class="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">${symbolsWithCoverage.length}</dd>
            <dd class="text-xs text-gray-500 dark:text-gray-400">${coveragePercent}% of ${symbols.length}</dd>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-4 py-4 text-center">
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Full (≥80%)</dt>
            <dd class="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">${fullyCovered}</dd>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-4 py-4 text-center">
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Partial (50-79%)</dt>
            <dd class="mt-1 text-2xl font-semibold text-yellow-600 dark:text-yellow-400">${partiallyCovered}</dd>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-4 py-4 text-center">
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Low (<50%)</dt>
            <dd class="mt-1 text-2xl font-semibold text-orange-600 dark:text-orange-400">${lowCoverage}</dd>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="px-4 py-4 text-center">
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Uncovered (0%)</dt>
            <dd class="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">${uncovered}</dd>
          </div>
        </div>
      </div>
    </div>`;
    })()}

    <div id="code-metrics" class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Symbols by kind</h2>
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <ul class="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
            ${Object.entries(kindCounts)
              .sort((a, b) => b[1] - a[1])
              .map(
                ([k, n]) =>
                  `<li class="px-4 py-2 flex justify-between items-center"><span class="text-sm font-medium text-gray-700 dark:text-gray-300">${escapeHtml(k)}</span><span class="text-sm text-gray-500 dark:text-gray-400">${n}</span></li>`,
              )
              .join("")}
          </ul>
        </div>
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Longest symbols (LOC)</h2>
        ${
          topByLoc.length > 0
            ? `<div class="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700"><tr><th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Symbol</th><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">LOC</th></tr></thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              ${topByLoc.map((s) => `<tr><td class="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400"><a href="symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td><td class="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">${s.metrics?.linesOfCode ?? s.endLine - s.startLine + 1}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>`
            : '<p class="text-sm text-gray-500 dark:text-gray-400">No LOC data.</p>'
        }
      </div>
    </div>

    ${
      deprecatedSymbols.length > 0
        ? `
    <div id="deprecated-symbols" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Deprecated Symbols</h2>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kind</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${deprecatedSymbols
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(
                (s) => `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="${badgeClass(s.kind)}">${s.kind}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"><a href="files/${fileSlug(s.file)}.html" class="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">${escapeHtml(s.file)}</a></td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400"><a href="deprecated.html" class="text-blue-600 dark:text-blue-400 hover:underline">View all deprecated</a></p>
    </div>`
        : ""
    }

    ${
      highImpactSymbols.length > 0
        ? `
    <div id="high-impact-symbols" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">High-Impact Symbols</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Symbols with the most dependents. Changing these may affect many callers.</p>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dependents</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${highImpactSymbols
              .map((s) => {
                const count = incomingCount.get(s.id) ?? 0;
                return `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"><a href="files/${fileSlug(s.file)}.html" class="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">${escapeHtml(s.file)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">${count}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`
        : ""
    }

    ${
      archViolations.length > 0
        ? `
    <div id="arch-violations" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Architecture Violations</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4"><a href="governance.html#arch" class="text-blue-600 dark:text-blue-400 hover:underline">View all</a></p>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rule</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${archViolations
              .slice(0, 10)
              .map(
                (v) => `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(v.rule)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${escapeHtml(v.file)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="px-2 py-0.5 rounded text-xs font-medium ${v.severity === "error" ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"}">${escapeHtml(v.severity)}</span></td>
                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(v.message)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`
        : ""
    }

    ${
      reaperFindings.length > 0
        ? `
    <div id="reaper-findings" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Code Quality (Reaper)</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4"><a href="governance.html#reaper" class="text-blue-600 dark:text-blue-400 hover:underline">View all</a></p>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${reaperFindings
              .slice(0, 10)
              .map(
                (f) => `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(f.type)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400"><a href="symbols/${escapeHtml(f.target)}.html" class="hover:underline">${escapeHtml(f.target)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${escapeHtml(f.suggested_action)}</td>
                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(f.reason)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`
        : ""
    }

    <div id="architecture-layers" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Architecture Layers</h2>
      ${(() => {
        const layerEntries = Object.entries(layerCounts).sort((a, b) => b[1] - a[1]);
        const maxLayer = Math.max(1, ...layerEntries.map(([, c]) => c));
        return `
      <div class="space-y-3 max-w-2xl mb-4">
        ${layerEntries
          .map(
            ([layer, count]) => `
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize w-24 flex-shrink-0">${layer}</span>
          <div class="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden" title="${count} symbols">
            <div class="h-full bg-blue-500 dark:bg-blue-600 rounded" style="width:${Math.round((count / maxLayer) * 100)}%"></div>
          </div>
          <span class="text-sm font-semibold text-gray-900 dark:text-white w-10 text-right">${count}</span>
        </div>`,
          )
          .join("")}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        ${layerEntries
          .map(
            ([layer, count]) => `
          <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="px-4 py-5 sm:p-6 text-center">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate capitalize">${layer}</dt>
              <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${count}</dd>
            </div>
          </div>`,
          )
          .join("")}
      </div>`;
      })()}
    </div>

    <div class="mb-12" id="architecture-overview">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Architecture Overview</h2>
      ${
        overviewGraph
          ? `
      <div class="flex gap-2 mb-4" role="tablist" aria-label="Overview view">
        <button type="button" id="arch-tab-graph" role="tab" aria-selected="true" aria-controls="arch-panel-graph" class="arch-tab px-4 py-2 rounded-md text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Graph</button>
        <button type="button" id="arch-tab-dirs" role="tab" aria-selected="false" aria-controls="arch-panel-dirs" class="arch-tab px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent">Directory map</button>
      </div>
      <div id="arch-panel-graph" role="tabpanel" class="arch-panel bg-white dark:bg-gray-800 shadow rounded-lg p-6 overflow-x-auto border border-gray-200 dark:border-gray-700">
        ${mermaidDiagramWrap(overviewGraph)}
      </div>`
          : ""
      }
      <div id="arch-panel-dirs" role="tabpanel" class="arch-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${overviewGraph ? "hidden" : ""}" aria-hidden="${overviewGraph ? "true" : "false"}">
        ${Object.entries(dirGroups)
          .sort((a, b) => b[1].symbols - a[1].symbols)
          .map(([dir, { files: dirFiles, symbols: dirSymbols }]) => {
            const kinds = dirKindBreakdown[dir] ?? {};
            const kindLabels = Object.entries(kinds)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([k, n]) => `${k}: ${n}`)
              .join(", ");
            const dirSlug = dir.replace(/\//g, "-");
            return `
        <a href="files.html#dir-${escapeHtml(dirSlug)}" class="block bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group">
          <div class="flex items-start justify-between">
            <span class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">${escapeHtml(dir)}</span>
            <svg class="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </div>
          <dl class="mt-3 space-y-1 text-sm">
            <div class="flex justify-between"><dt class="text-gray-500 dark:text-gray-400">Symbols</dt><dd class="font-medium text-gray-900 dark:text-white">${dirSymbols}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500 dark:text-gray-400">Files</dt><dd class="font-medium text-gray-900 dark:text-white">${dirFiles.length}</dd></div>
          </dl>
          ${kindLabels ? `<p class="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate" title="${escapeHtml(kindLabels)}">${escapeHtml(kindLabels)}</p>` : ""}
        </a>`;
          })
          .join("")}
      </div>
      <script>
        (function(){
          var tabGraph = document.getElementById('arch-tab-graph');
          var tabDirs = document.getElementById('arch-tab-dirs');
          var panelGraph = document.getElementById('arch-panel-graph');
          var panelDirs = document.getElementById('arch-panel-dirs');
          if (!tabGraph || !tabDirs || !panelGraph || !panelDirs) return;
          function showGraph() {
            tabGraph.setAttribute('aria-selected', 'true'); tabGraph.classList.add('bg-blue-100', 'dark:bg-blue-900/50', 'text-blue-800', 'dark:text-blue-300', 'border-blue-200', 'dark:border-blue-800'); tabGraph.classList.remove('text-gray-600', 'dark:text-gray-400', 'border-transparent');
            tabDirs.setAttribute('aria-selected', 'false'); tabDirs.classList.remove('bg-blue-100', 'dark:bg-blue-900/50', 'text-blue-800', 'dark:text-blue-300', 'border-blue-200', 'dark:border-blue-800'); tabDirs.classList.add('text-gray-600', 'dark:text-gray-400', 'border-transparent');
            panelGraph.classList.remove('hidden'); panelDirs.classList.add('hidden'); panelDirs.setAttribute('aria-hidden', 'true');
          }
          function showDirs() {
            tabDirs.setAttribute('aria-selected', 'true'); tabDirs.classList.add('bg-blue-100', 'dark:bg-blue-900/50', 'text-blue-800', 'dark:text-blue-300', 'border-blue-200', 'dark:border-blue-800'); tabDirs.classList.remove('text-gray-600', 'dark:text-gray-400', 'border-transparent');
            tabGraph.setAttribute('aria-selected', 'false'); tabGraph.classList.remove('bg-blue-100', 'dark:bg-blue-900/50', 'text-blue-800', 'dark:text-blue-300', 'border-blue-200', 'dark:border-blue-800'); tabGraph.classList.add('text-gray-600', 'dark:text-gray-400', 'border-transparent');
            panelDirs.classList.remove('hidden'); panelGraph.classList.add('hidden'); panelDirs.setAttribute('aria-hidden', 'false');
          }
          tabGraph.addEventListener('click', showGraph);
          tabDirs.addEventListener('click', showDirs);
        })();
      </script>
    </div>

    <div id="top-complex-symbols" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Top Complex Symbols</h2>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Complexity</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">LOC</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${complexSymbols
              .map((s) => {
                const complexity = s.metrics?.cyclomaticComplexity || 0;
                const loc = s.metrics?.linesOfCode || 0;
                return `<tr class="${complexity > 10 ? "bg-red-50 dark:bg-red-900/20" : ""}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"><a href="files/${fileSlug(s.file)}.html" class="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">${escapeHtml(s.file)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${complexity > 10 ? "text-red-600 dark:text-red-400 font-bold" : "text-gray-500 dark:text-gray-400"}">${complexity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${loc}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Symbol Kinds</h2>
      ${(() => {
        const kindEntries = Object.entries(kindCounts).sort((a, b) => b[1] - a[1]);
        const maxKind = Math.max(1, ...kindEntries.map(([, c]) => c));
        return `
      <div class="space-y-3 max-w-2xl mb-6">
        ${kindEntries
          .map(
            ([kind, count]) => `
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 flex-shrink-0">${kind}</span>
          <div class="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden" title="${count} symbols">
            <div class="h-full bg-blue-500 dark:bg-blue-600 rounded" style="width:${Math.round((count / maxKind) * 100)}%"></div>
          </div>
          <span class="text-sm font-semibold text-gray-900 dark:text-white w-10 text-right">${count}</span>
        </div>`,
          )
          .join("")}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        ${kindEntries
          .map(
            ([kind, count]) => `
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">${kind}</span>
            <span class="text-lg font-semibold text-gray-900 dark:text-white">${count}</span>
          </div>`,
          )
          .join("")}
      </div>`;
      })()}
    </div>

    <div class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Top-Level Symbols</h2>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kind</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${topLevel
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(
                (s) => `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="${badgeClass(s.kind)}">${s.kind}</span>${s.deprecated ? ' <span class="px-2 py-0.5 rounded text-xs font-medium border bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 ml-1 line-through">deprecated</span>' : ""}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"><a href="files/${fileSlug(s.file)}.html" class="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">${escapeHtml(s.file)}</a></td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
      mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose',maxTextSize:300000});

      var INDEX = null;
      var FUSE = null;

      function renderResults(results) {
        var r = document.getElementById('results'); r.textContent='';
        if (results.length === 0) {
            r.innerHTML = '<li class="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">No results found</li>';
            return;
        }
        results.slice(0, 100).forEach(function(it){
          var li = document.createElement('li');

          var div = document.createElement('div');
          div.className = "px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700";

          var flex = document.createElement('div');
          flex.className = "flex items-center justify-between";

          var nameP = document.createElement('p');
          nameP.className = "text-sm font-medium text-blue-600 dark:text-blue-400 truncate";
          var a = document.createElement('a'); a.href='symbols/'+it.id+'.html'; a.textContent=it.name;
          nameP.appendChild(a);

          var badgeDiv = document.createElement('div');
          badgeDiv.className = "ml-2 flex-shrink-0 flex";
          var span = document.createElement('span'); span.className=it.badgeClass; span.textContent=it.kind;
          badgeDiv.appendChild(span);

          flex.appendChild(nameP);
          flex.appendChild(badgeDiv);

          var detailsDiv = document.createElement('div');
          detailsDiv.className = "mt-2 sm:flex sm:justify-between";

          var leftDetails = document.createElement('div');
          leftDetails.className = "sm:flex";

          if (it.signature) {
             var pSig = document.createElement('p'); pSig.className = "flex items-center text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700 px-1 rounded truncate max-w-md";
             pSig.textContent = it.signature;
             leftDetails.appendChild(pSig);
          }

          var rightDetails = document.createElement('div');
          rightDetails.className = "mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 sm:mt-0 sm:ml-6";

          if (it.file) {
              var pFile = document.createElement('p'); pFile.textContent = it.file;
              rightDetails.appendChild(pFile);
          }

          detailsDiv.appendChild(leftDetails);
          detailsDiv.appendChild(rightDetails);

          div.appendChild(flex);
          div.appendChild(detailsDiv);

          if (it.summary) {
             var pSum = document.createElement('p'); pSum.className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic";
             pSum.textContent = it.summary;
             div.appendChild(pSum);
          }

          li.appendChild(div);
          r.appendChild(li);
        });
      }

      function doSearch(q) {
        if (!INDEX) return;
        var results = [];
        if (q && q.trim().length>0 && FUSE) {
          results = FUSE.search(q).map(function(r){ return r.item; });
        } else {
          results = INDEX.items.slice();
        }
        renderResults(results);
      }

      fetch('search.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (Array.isArray(data)) {
            INDEX = { items: data };
          } else {
            INDEX = data;
          }

          try {
            FUSE = new Fuse(INDEX.items, { keys: [{ name: 'name', weight: 0.6 }, { name: 'signature', weight: 0.2 }, { name: 'summary', weight: 0.2 }], includeMatches: true, threshold: 0.35 });
          } catch (e) { console.warn('Fuse init failed', e); FUSE = null; }
          document.getElementById('search').addEventListener('input', function (e) { doSearch(e.target.value); });
        });
    </script>
    ${getMermaidExpandModalAndScript()}
  `;

  // No filters in sidebar for dashboard
  return layout("Dashboard", "index.html", body, 0, "", docEntries);
}
