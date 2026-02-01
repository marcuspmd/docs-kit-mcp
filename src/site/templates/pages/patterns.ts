/**
 * Patterns page template.
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { DetectedPattern } from "../../../patterns/patternAnalyzer.js";
import type { DocEntry } from "../types.js";
import { escapeHtml } from "../utils.js";
import { layout } from "../layout.js";

export function renderPatternsPage(
  patterns: DetectedPattern[],
  symbols: CodeSymbol[],
  docEntries: DocEntry[] = [],
): string {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  const body = `
    <h1 class="text-3xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-200">Detected Patterns</h1>

    ${
      patterns.length === 0
        ? "<div class='text-center py-12 text-gray-500'>No patterns detected.</div>"
        : `<div class="grid grid-cols-1 gap-6">
            ${patterns
              .map(
                (p) => `
          <div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
               <h3 class="text-lg font-medium text-gray-900">${escapeHtml(p.kind)}</h3>
               <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.confidence > 0.8 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}">
                 Confidence: ${(p.confidence * 100).toFixed(0)}%
               </span>
            </div>
            <div class="p-6">
              <div class="mb-4">
                <span class="text-sm font-medium text-gray-500 uppercase tracking-wider block mb-2">Symbols Involved</span>
                <div class="flex flex-wrap gap-2">
                   ${p.symbols
                     .map((id) => {
                       const s = symbolMap.get(id);
                       return s
                         ? `<a href="symbols/${s.id}.html" class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">${escapeHtml(s.name)}</a>`
                         : `<span class="text-gray-500">${id}</span>`;
                     })
                     .join("")}
                </div>
              </div>

              ${
                p.violations.length > 0
                  ? `<div>
                      <span class="text-sm font-medium text-red-500 uppercase tracking-wider block mb-2">Violations</span>
                      <ul class="list-disc pl-5 space-y-1 text-sm text-gray-700">
                        ${p.violations.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}
                      </ul>
                    </div>`
                  : "<p class='text-sm text-green-600 flex items-center'><svg class='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'/></svg> No violations found</p>"
              }
            </div>
          </div>`,
              )
              .join("")}
          </div>`
    }
  `;

  return layout("Patterns", "patterns.html", body, 0, "", docEntries);
}
