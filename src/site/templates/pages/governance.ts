/**
 * Governance page template.
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { DocEntry, ArchViolationRow, ReaperFindingRow } from "../types.js";
import { escapeHtml } from "../utils.js";
import { layout } from "../layout.js";

export function renderGovernancePage(
  archViolations: ArchViolationRow[],
  reaperFindings: ReaperFindingRow[],
  symbols: CodeSymbol[],
  docEntries: DocEntry[] = [],
): string {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  const body = `
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-200 dark:border-gray-700">Governance</h1>
    <p class="text-gray-600 dark:text-gray-400 mb-8">Architecture violations and code quality findings (Reaper).</p>

    <div id="arch" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Architecture Violations</h2>
      ${
        archViolations.length === 0
          ? "<p class='text-gray-500 dark:text-gray-400'>No architecture violations.</p>"
          : `
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rule</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${archViolations
              .map((v) => {
                const sym = v.symbol_id ? symbolMap.get(v.symbol_id) : undefined;
                const symbolCell = sym
                  ? `<a href="symbols/${v.symbol_id}.html" class="text-blue-600 dark:text-blue-400 hover:underline">${escapeHtml(sym.name)}</a>`
                  : v.symbol_id
                    ? escapeHtml(v.symbol_id)
                    : "-";
                return `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(v.rule)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${escapeHtml(v.file)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${symbolCell}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="px-2 py-0.5 rounded text-xs font-medium ${v.severity === "error" ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"}">${escapeHtml(v.severity)}</span></td>
                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(v.message)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`
      }
    </div>

    <div id="reaper" class="mb-12">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Code Quality (Reaper)</h2>
      ${
        reaperFindings.length === 0
          ? "<p class='text-gray-500 dark:text-gray-400'>No Reaper findings.</p>"
          : `
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Suggested action</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${reaperFindings
              .map((f) => {
                const sym = symbolMap.get(f.target);
                const targetCell = sym
                  ? `<a href="symbols/${f.target}.html" class="text-blue-600 dark:text-blue-400 hover:underline">${escapeHtml(sym.name)}</a>`
                  : escapeHtml(f.target);
                return `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(f.type)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${targetCell}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${escapeHtml(f.suggested_action)}</td>
                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(f.reason)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`
      }
    </div>
  `;

  return layout("Governance", "governance.html", body, 0, "", docEntries);
}
