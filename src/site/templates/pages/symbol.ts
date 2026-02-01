/**
 * Symbol page template (individual symbol pages).
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { RelationshipRow } from "../../../storage/db.js";
import type { DocEntry, ArchViolationRow } from "../types.js";
import { escapeHtml, escapeCodeBlocks, formatDate } from "../utils.js";
import {
  badgeClass,
  visibilityBadge,
  layerBadge,
  statusBadges,
  violationsBadges,
} from "../badges.js";
import { layout } from "../layout.js";
import { mermaidDiagramWrap, getMermaidExpandModalAndScript } from "../mermaid.js";
import { fileSlug, buildMermaidForSymbol } from "../../shared.js";

export function renderSymbolPage(
  symbol: CodeSymbol,
  allSymbols: CodeSymbol[],
  relationships: RelationshipRow[],
  sourceCode?: string,
  archViolationsForSymbol: ArchViolationRow[] = [],
  docEntries: DocEntry[] = [],
): string {
  const children = allSymbols.filter((s) => s.parent === symbol.id);
  const outgoing = relationships.filter((r) => r.source_id === symbol.id);
  const incoming = relationships.filter((r) => r.target_id === symbol.id);

  let sourceSnippet = "";
  if (sourceCode) {
    const lines = sourceCode.split("\n");
    const start = Math.max(0, symbol.startLine - 1);
    const end = Math.min(lines.length, symbol.endLine);
    sourceSnippet = lines.slice(start, end).join("\n");
  }

  const breadcrumb = [
    '<a href="../index.html" class="hover:text-gray-700 dark:hover:text-gray-300">Dashboard</a>',
    `<a href="../files/${fileSlug(symbol.file)}.html" class="hover:text-gray-700 dark:hover:text-gray-300">${escapeHtml(symbol.file)}</a>`,
  ];
  if (symbol.parent) {
    const parent = allSymbols.find((s) => s.id === symbol.parent);
    if (parent) {
      breadcrumb.splice(
        1,
        0,
        `<a href="${parent.id}.html" class="hover:text-gray-700 dark:hover:text-gray-300">${escapeHtml(parent.name)}</a>`,
      );
    }
  }
  breadcrumb.push(
    `<span class="text-gray-900 dark:text-white font-semibold">${escapeHtml(symbol.name)}</span>`,
  );

  const depGraph = buildMermaidForSymbol(symbol, allSymbols, relationships, "outgoing", true);
  const impactGraph = buildMermaidForSymbol(symbol, allSymbols, relationships, "incoming", true);

  const body = `
    <nav class="flex mb-6" aria-label="Breadcrumb">
      <ol class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
        ${breadcrumb
          .map(
            (item, i) => `
          <li>
            <div class="flex items-center">
              ${i > 0 ? '<svg class="flex-shrink-0 h-5 w-5 text-gray-300 dark:text-gray-600 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>' : ""}
              ${item}
            </div>
          </li>
        `,
          )
          .join("")}
      </ol>
    </nav>

    <div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8 border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center flex-wrap gap-2">
           <span class="mr-2">${escapeHtml(symbol.name)}</span>
           <span class="${badgeClass(symbol.kind)}">${symbol.kind}</span>
           ${visibilityBadge(symbol.visibility)}
           ${layerBadge(symbol.layer)}
           ${statusBadges(symbol)}
           ${violationsBadges(symbol, "../governance.html")}
        </h1>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          Last updated: ${escapeHtml(formatDate(symbol.lastModified) ?? "Unknown")}
        </div>
      </div>
      <div class="px-6 py-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="min-w-0">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Location</h3>
            <p class="mt-1 text-sm text-gray-900 dark:text-white min-w-0 overflow-hidden">
              <a href="../files/${fileSlug(symbol.file)}.html" class="text-blue-600 dark:text-blue-400 hover:underline truncate block" title="${escapeHtml(symbol.file)}:${symbol.startLine}-${symbol.endLine}">${escapeHtml(symbol.file)}:${symbol.startLine}-${symbol.endLine}</a>
            </p>
          </div>
          ${
            symbol.metrics
              ? `
          <div class="min-w-0">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Metrics</h3>
            <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-900 dark:text-white">
              <span>LOC: ${symbol.metrics.linesOfCode ?? "-"}</span>
              <span>Complexity: <span class="${(symbol.metrics.cyclomaticComplexity ?? 0) > 10 ? "text-red-600 dark:text-red-400 font-bold" : ""}">${symbol.metrics.cyclomaticComplexity ?? "-"}</span></span>
              <span>Params: ${symbol.metrics.parameterCount ?? "-"}</span>
            </div>
          </div>`
              : ""
          }
        </div>

        ${
          symbol.signature
            ? `
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Signature</h3>
          <div class="mt-1 bg-gray-50 dark:bg-gray-900 rounded-md p-3 font-mono text-sm text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 overflow-x-auto">
            ${escapeHtml(symbol.signature)}
          </div>
        </div>`
            : ""
        }

        ${
          symbol.pattern
            ? `
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Pattern</h3>
          <p class="mt-1 text-sm text-gray-900 dark:text-white bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded inline-block border border-green-200 dark:border-green-800">${escapeHtml(symbol.pattern)}</p>
        </div>`
            : ""
        }

        ${
          symbol.docRef
            ? `
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Documentation</h3>
          <p class="mt-1 text-sm"><a href="../${escapeHtml(symbol.docRef.replace(/\.md$/, ".html"))}" class="text-blue-600 dark:text-blue-400 hover:underline flex items-center"><svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>${escapeHtml(symbol.docRef)}</a></p>
        </div>`
            : ""
        }

        ${
          symbol.summary
            ? `
        <div class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
           <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Summary</h3>
           <p>${escapeHtml(symbol.summary)}</p>
        </div>`
            : ""
        }

        ${
          symbol.violations?.length
            ? `
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Code quality</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">This symbol has governance findings. <a href="../governance.html#reaper" class="text-blue-600 dark:text-blue-400 hover:underline">View all</a>.</p>
          <div class="flex flex-wrap gap-2">
            ${symbol.violations.map((v) => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">${escapeHtml(v)}</span>`).join("")}
          </div>
        </div>`
            : ""
        }

        ${
          archViolationsForSymbol.length > 0
            ? `
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Architecture violations</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2"><a href="../governance.html#arch" class="text-blue-600 dark:text-blue-400 hover:underline">View all</a></p>
          <ul class="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            ${archViolationsForSymbol.map((v) => `<li><span class="font-medium ${v.severity === "error" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}">[${escapeHtml(v.severity)}]</span> ${escapeHtml(v.rule)}: ${escapeHtml(v.message)}</li>`).join("")}
          </ul>
        </div>`
            : ""
        }

        ${
          symbol.tags
            ? `
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</h3>
          <div class="flex flex-wrap gap-2">
            ${symbol.tags.map((t) => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600">#${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>`
            : ""
        }
      </div>
    </div>

    ${
      sourceSnippet
        ? `<div class="mb-12">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Source Code</h2>
            <div class="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <pre class="p-4 overflow-x-auto text-sm font-mono leading-tight"><code class="language-typescript">${escapeCodeBlocks(sourceSnippet)}</code></pre>
            </div>
           </div>`
        : ""
    }

    ${
      children.length > 0
        ? `<div class="mb-12">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Members</h2>
            <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kind</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visibility</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Signature</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  ${children
                    .map(
                      (c) => `<tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="${c.id}.html" class="hover:underline">${escapeHtml(c.name)}</a></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="${badgeClass(c.kind)}">${c.kind}</span></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${visibilityBadge(c.visibility)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadges(c)}${violationsBadges(c, "../governance.html") || "-"}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400 text-xs">${c.signature ? escapeHtml(c.signature) : "-"}</td>
                  </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>`
        : ""
    }

    ${(() => {
      const listeners = incoming.filter((r) => r.type === "listens_to");
      if (symbol.kind === "event" && listeners.length > 0) {
        return `<div class="mb-12">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Listeners</h2>
            <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Listener</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  ${listeners
                    .map((r) => {
                      const source = allSymbols.find((s) => s.id === r.source_id);
                      return `<tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">${source ? `<a href="${source.id}.html" class="hover:underline">${escapeHtml(source.name)}</a>` : r.source_id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${source ? `<a href="../files/${fileSlug(source.file)}.html" class="hover:underline hover:text-blue-600 dark:hover:text-blue-400">${escapeHtml(source.file)}</a>` : "-"}</td>
                  </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>`;
      }
      return "";
    })()}

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
       <div>
          ${
            depGraph
              ? `<div class="mb-8">
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Dependencies (Outgoing)</h2>
                  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    ${mermaidDiagramWrap(depGraph)}
                  </div>
                </div>`
              : ""
          }

          ${
            outgoing.length > 0
              ? `<div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700 mb-8">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th></tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    ${outgoing
                      .map((r) => {
                        const target = allSymbols.find((s) => s.id === r.target_id);
                        return `<tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">${target ? `<a href="${target.id}.html" class="hover:underline">${escapeHtml(target.name)}</a>` : r.target_id}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${r.type}</td>
                    </tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>`
              : "<p class='text-gray-500 dark:text-gray-400 italic mb-8'>No outgoing dependencies.</p>"
          }
       </div>

       <div>
          ${
            impactGraph
              ? `<div class="mb-8">
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Impact (Incoming)</h2>
                  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    ${mermaidDiagramWrap(impactGraph)}
                  </div>
                </div>`
              : ""
          }

          ${
            incoming.length > 0
              ? `<div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700 mb-8">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th><th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th></tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    ${incoming
                      .map((r) => {
                        const source = allSymbols.find((s) => s.id === r.source_id);
                        return `<tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">${source ? `<a href="${source.id}.html" class="hover:underline">${escapeHtml(source.name)}</a>` : r.source_id}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${r.type}</td>
                    </tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>`
              : "<p class='text-gray-500 dark:text-gray-400 italic mb-8'>No incoming dependencies.</p>"
          }
       </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose',maxTextSize:300000});</script>
    ${getMermaidExpandModalAndScript()}
  `;

  return layout(symbol.name, "", body, 1, "", docEntries);
}
