/**
 * Relationships page template.
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { RelationshipRow } from "../../../storage/db.js";
import type { DocEntry } from "../types.js";
import { escapeHtml } from "../utils.js";
import { layout } from "../layout.js";
import { mermaidDiagramWrap, getMermaidExpandModalAndScript } from "../mermaid.js";
import { buildMermaidTopConnected } from "../../shared.js";

export function renderRelationshipsPage(
  relationships: RelationshipRow[],
  symbols: CodeSymbol[],
  docEntries: DocEntry[] = [],
): string {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  const byType: Record<string, number> = {};
  for (const r of relationships) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }

  const topConnectedGraph = buildMermaidTopConnected(symbols, relationships, 30, true);

  const body = `
    <h1 class="text-3xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-200">Relationships</h1>

    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
      ${Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([type, count]) => `
        <button onclick="filterByType('${type}')" class="bg-white shadow rounded-lg p-4 border border-gray-200 text-center hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
          <div class="text-2xl font-bold text-blue-600">${count}</div>
          <div class="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">${type}</div>
        </button>`,
        )
        .join("")}
    </div>

    ${
      topConnectedGraph
        ? `
    <div class="mb-12">
      <h2 class="text-xl font-bold text-gray-900 mb-4">Architecture Overview (Top 30 Connected)</h2>
      <div class="bg-white shadow rounded-lg p-6 border border-gray-200 overflow-x-auto">
        ${mermaidDiagramWrap(topConnectedGraph)}
      </div>
    </div>`
        : ""
    }

    <div class="mb-8 p-4 bg-blue-50 rounded-md border border-blue-100 text-blue-800 text-sm">
       Each symbol page contains focused dependency and impact graphs. Below is the full relationship table.
       Click a statistic card above or type below to filter.
    </div>

    <div class="mb-6">
      <label for="relationship-filter" class="block text-sm font-medium text-gray-700 mb-2">Filter Relationships</label>
      <input type="text" id="relationship-filter" class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2" placeholder="Type to filter by source, target or type...">
    </div>

    <div class="bg-white shadow overflow-x-auto sm:rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200" id="relationships-table">
        <thead class="bg-gray-50">
          <tr>
             <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
             <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
             <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          ${relationships
            .map((r) => {
              const source = symbolMap.get(r.source_id);
              const target = symbolMap.get(r.target_id);
              return `<tr data-source="${escapeHtml(source?.name || r.source_id)}" data-type="${r.type}" data-target="${escapeHtml(target?.name || r.target_id)}">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${source ? `<a href="symbols/${source.id}.html" class="hover:underline">${escapeHtml(source.name)}</a>` : r.source_id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">${r.type}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${target ? `<a href="symbols/${target.id}.html" class="hover:underline">${escapeHtml(target.name)}</a>` : r.target_id}</td>
          </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
      mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose',maxTextSize:300000});

      const filterInput = document.getElementById('relationship-filter');
      const tableRows = document.querySelectorAll('#relationships-table tbody tr');

      function filterTable(filterValue) {
        const filter = filterValue.toLowerCase();
        tableRows.forEach(row => {
          const source = row.dataset.source.toLowerCase();
          const type = row.dataset.type.toLowerCase();
          const target = row.dataset.target.toLowerCase();

          const matches = source.includes(filter) || type.includes(filter) || target.includes(filter);
          row.style.display = matches ? '' : 'none';
        });
      }

      function filterByType(type) {
        filterInput.value = type;
        filterTable(type);
      }

      filterInput.addEventListener('input', function(e) {
        filterTable(e.target.value);
      });
    </script>
    ${getMermaidExpandModalAndScript()}
  `;

  return layout("Relationships", "relationships.html", body, 0, "", docEntries);
}
