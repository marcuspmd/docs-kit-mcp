/**
 * Deprecated symbols page template.
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { DocEntry } from "../types.js";
import { escapeHtml } from "../utils.js";
import { badgeClass } from "../badges.js";
import { layout } from "../layout.js";
import { fileSlug } from "../../shared.js";

export function renderDeprecatedPage(symbols: CodeSymbol[], docEntries: DocEntry[] = []): string {
  const deprecated = symbols
    .filter((s) => s.deprecated)
    .sort((a, b) => a.name.localeCompare(b.name));

  const body = `
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-200 dark:border-gray-700">Deprecated Symbols</h1>
    <p class="text-gray-600 dark:text-gray-400 mb-6">Symbols marked as deprecated. Consider migrating callers before removal.</p>
    ${
      deprecated.length === 0
        ? "<div class='text-center py-12 text-gray-500 dark:text-gray-400'>No deprecated symbols.</div>"
        : `
    <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kind</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Signature</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          ${deprecated
            .map(
              (s) => `<tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="${badgeClass(s.kind)}">${s.kind}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"><a href="files/${fileSlug(s.file)}.html" class="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">${escapeHtml(s.file)}</a></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400 text-xs">${s.signature ? escapeHtml(s.signature) : "-"}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`
    }
  `;

  return layout("Deprecated", "deprecated.html", body, 0, "", docEntries);
}
