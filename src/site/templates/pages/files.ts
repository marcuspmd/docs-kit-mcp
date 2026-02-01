/**
 * Files page templates (files.html and individual file pages).
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { RelationshipRow } from "../../../storage/db.js";
import type { DocEntry, ArchViolationRow } from "../types.js";
import { escapeHtml, escapeCodeBlocks } from "../utils.js";
import { badgeClass, visibilityBadge, statusBadges, violationsBadges } from "../badges.js";
import { layout } from "../layout.js";
import { mermaidDiagramWrap, getMermaidExpandModalAndScript } from "../mermaid.js";
import { fileSlug, buildSmartDiagramsForFile } from "../../shared.js";

const GHOST_SYMBOL_NAMES = new Set([
  "class",
  "interface",
  "enum",
  "trait",
  "function",
  "type",
  "struct",
  "abstract",
]);

export function renderFilesPage(
  files: string[],
  symbols: CodeSymbol[],
  docEntries: DocEntry[] = [],
): string {
  // 1. Build the tree
  interface TreeNode {
    name: string;
    path: string; // full path so far
    isFile: boolean;
    children: Record<string, TreeNode>;
    symbolCount: number;
  }

  const root: TreeNode = {
    name: "root",
    path: "",
    isFile: false,
    children: {},
    symbolCount: 0,
  };

  const symbolCounts = new Map<string, number>();
  for (const s of symbols) {
    symbolCounts.set(s.file, (symbolCounts.get(s.file) ?? 0) + 1);
  }

  for (const file of files) {
    const parts = file.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: currentPath,
          isFile: isLast,
          children: {},
          symbolCount: 0,
        };
      }
      current = current.children[part];
    }
    // Set symbol count for the file node
    current.symbolCount = symbolCounts.get(file) ?? 0;
  }

  // 2. Propagate counts up
  function calculateCounts(node: TreeNode): number {
    if (node.isFile) return node.symbolCount;
    let sum = 0;
    for (const child of Object.values(node.children)) {
      sum += calculateCounts(child);
    }
    node.symbolCount = sum;
    return sum;
  }
  calculateCounts(root);

  // 3. Recursive Render
  function renderNode(node: TreeNode, depth: number): string {
    const indent = depth * 0.75; // rem — compact so deep paths don't use too much horizontal space
    const children = Object.values(node.children).sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    if (node.isFile) {
      return `
        <div class="file-tree-row flex items-center py-1 hover:bg-gray-50 dark:hover:bg-gray-700 group transition-colors rounded-md px-2 -mx-2" data-path="${escapeHtml(node.path)}" data-name="${escapeHtml(node.name)}">
          <div style="width: ${indent}rem" class="flex-shrink-0"></div>
          <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 group-hover:text-blue-500 dark:group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <a href="files/${fileSlug(node.path)}.html" class="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium truncate flex-1 block">
            ${escapeHtml(node.name)}
          </a>
          <span class="text-xs text-gray-400 dark:text-gray-500 ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">${node.symbolCount}</span>
        </div>
      `;
    } else {
      // Directory
      const inner = children.map((c) => renderNode(c, depth + 1)).join("");
      // Don't render root wrapper if it's the top-level container call
      if (node.name === "root") return inner;

      const dirId = "dir-" + node.path.replace(/\//g, "-");
      return `
        <details class="group/folder file-tree-dir" open id="${escapeHtml(dirId)}" data-path="${escapeHtml(node.path)}" data-name="${escapeHtml(node.name)}">
          <summary class="flex items-center py-1 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer select-none rounded-md px-2 -mx-2 transition-colors">
            <div style="width: ${indent}rem" class="flex-shrink-0"></div>
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 group-open/folder:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <svg class="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0 hidden group-open/folder:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2l-2 2z" />
            </svg>
            <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">${escapeHtml(node.name)}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500 ml-2">${node.symbolCount}</span>
          </summary>
          <div class="border-l border-gray-100 dark:border-gray-700 ml-2 pl-1 my-1">
            ${inner}
          </div>
        </details>
      `;
    }
  }

  const body = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">File Explorer</h1>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        <span class="font-semibold text-gray-900 dark:text-white">${files.length}</span> files,
        <span class="font-semibold text-gray-900 dark:text-white">${symbols.length}</span> symbols
      </div>
    </div>

    <div class="mb-4">
      <label for="file-tree-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by path or name</label>
      <input type="text" id="file-tree-filter" class="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3" placeholder="e.g. src/site or .ts" aria-label="Filter file tree">
    </div>

    <div class="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex flex-wrap justify-between items-center gap-2">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project Source</span>
        <div class="flex gap-2">
          <button type="button" id="file-tree-expand-all" class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Expand All</button>
          <button type="button" onclick="document.querySelectorAll('.file-tree-dir').forEach(d => d.open = false)" class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Collapse All</button>
        </div>
      </div>
      <div class="p-2 overflow-x-auto" id="file-tree-container">
        ${renderNode(root, 0)}
      </div>
    </div>

    <script>
      (function(){
        var filterInput = document.getElementById('file-tree-filter');
        var container = document.getElementById('file-tree-container');
        var expandBtn = document.getElementById('file-tree-expand-all');
        if (!filterInput || !container) return;

        function filterTree() {
          var q = (filterInput.value || '').trim().toLowerCase();
          var dirs = container.querySelectorAll('.file-tree-dir');
          var rows = container.querySelectorAll('.file-tree-row');
          function match(el) {
            var path = (el.getAttribute('data-path') || '').toLowerCase();
            var name = (el.getAttribute('data-name') || '').toLowerCase();
            return !q || path.indexOf(q) !== -1 || name.indexOf(q) !== -1;
          }
          rows.forEach(function(el) { el.style.display = match(el) ? '' : 'none'; });
          dirs.forEach(function(el) { el.style.display = match(el) ? '' : 'none'; });
          if (q) {
            [].slice.call(dirs).reverse().forEach(function(d) {
              var inside = d.querySelectorAll('.file-tree-dir, .file-tree-row');
              var anyVisible = [].some.call(inside, function(c) { return c.style.display !== 'none'; });
              if (anyVisible) d.style.display = '';
            });
            dirs.forEach(function(d) { if (d.style.display !== 'none') d.setAttribute('open', ''); });
          }
        }

        filterInput.addEventListener('input', filterTree);
        filterInput.addEventListener('keydown', function(e) { if (e.key === 'Escape') { filterInput.value = ''; filterTree(); filterInput.blur(); } });
        if (expandBtn) expandBtn.addEventListener('click', function() { container.querySelectorAll('.file-tree-dir').forEach(function(d) { d.setAttribute('open', ''); }); });
      })();
    </script>
  `;

  return layout("Files", "files.html", body, 0, "", docEntries);
}

export function renderFilePage(
  filePath: string,
  symbols: CodeSymbol[],
  sourceCode?: string,
  relationships?: RelationshipRow[],
  allSymbols?: CodeSymbol[],
  archViolationsForFile: ArchViolationRow[] = [],
  docEntries: DocEntry[] = [],
): string {
  const displaySymbols = symbols.filter((s) => !GHOST_SYMBOL_NAMES.has(s.name));
  const topLevel = displaySymbols.filter((s) => !s.parent);

  const totalSymbols = displaySymbols.length;
  const totalLOC = sourceCode ? sourceCode.split("\n").length : 0;
  const avgComplexity =
    displaySymbols.length > 0
      ? displaySymbols
          .filter((s) => s.metrics?.cyclomaticComplexity)
          .reduce((sum, s) => sum + (s.metrics!.cyclomaticComplexity || 0), 0) /
        displaySymbols.length
      : 0;

  const kindCounts: Record<string, number> = {};
  for (const s of displaySymbols) {
    kindCounts[s.kind] = (kindCounts[s.kind] ?? 0) + 1;
  }

  let fileGraphData = { html: "", isMermaid: true };
  if (relationships && allSymbols) {
    fileGraphData = buildSmartDiagramsForFile(
      filePath,
      displaySymbols,
      allSymbols,
      relationships,
      true,
    );
  }

  const body = `
    <nav class="flex mb-6" aria-label="Breadcrumb">
       <ol class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
         <li><a href="../index.html" class="hover:text-gray-700 dark:hover:text-gray-300">Dashboard</a></li>
         <li><svg class="flex-shrink-0 h-5 w-5 text-gray-300 dark:text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg></li>
         <li><span class="text-gray-900 dark:text-white font-semibold">${escapeHtml(filePath)}</span></li>
       </ol>
    </nav>

    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
      <svg class="h-8 w-8 text-gray-400 dark:text-gray-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ${escapeHtml(filePath)}
    </h1>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Symbols</dt>
        <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${totalSymbols}</dd>
      </div>
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Lines of Code</dt>
        <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${totalLOC}</dd>
      </div>
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Avg Complexity</dt>
        <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${avgComplexity.toFixed(1)}</dd>
      </div>
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Symbol Types</dt>
        <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">${Object.keys(kindCounts).length}</dd>
      </div>
    </div>

    ${
      fileGraphData.html
        ? `
    <div class="mb-12">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">File Relationships</h2>
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 overflow-x-auto">
        ${fileGraphData.isMermaid ? mermaidDiagramWrap(fileGraphData.html) : fileGraphData.html}
      </div>
    </div>`
        : ""
    }

    ${
      archViolationsForFile.length > 0
        ? `
    <div class="mb-12">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Architecture violations</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4"><a href="../governance.html#arch" class="text-blue-600 dark:text-blue-400 hover:underline">View all</a></p>
      <ul class="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
        ${archViolationsForFile.map((v) => `<li><span class="font-medium ${v.severity === "error" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}">[${escapeHtml(v.severity)}]</span> ${escapeHtml(v.rule)}: ${escapeHtml(v.message)}</li>`).join("")}
      </ul>
    </div>`
        : ""
    }

    <div class="mb-12">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Symbols by Kind</h2>
      <div class="flex flex-wrap gap-4">
        ${Object.entries(kindCounts)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([kind, count]) => `
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700 flex items-center space-x-2">
            <span class="${badgeClass(kind)}">${kind}</span>
            <span class="text-gray-900 dark:text-white font-semibold">${count}</span>
          </div>`,
          )
          .join("")}
      </div>
    </div>

    <div class="mb-12">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">All Symbols</h2>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kind</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visibility</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lines</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Signature</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            ${topLevel
              .sort((a, b) => a.startLine - b.startLine)
              .map((s) => {
                const children = displaySymbols.filter((c) => c.parent === s.id);
                return `<tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400"><a href="../symbols/${s.id}.html" class="hover:underline">${escapeHtml(s.name)}</a></td>
              <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="${badgeClass(s.kind)}">${s.kind}</span></td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">${visibilityBadge(s.visibility)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadges(s)}${violationsBadges(s, "../governance.html") || "-"}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${s.startLine}-${s.endLine}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400 text-xs">${s.signature ? `<code>${escapeHtml(s.signature)}</code>` : "-"}</td>
            </tr>
            ${children
              .map(
                (c) => `<tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400 pl-12 border-l-4 border-gray-100 dark:border-gray-700"><a href="../symbols/${c.id}.html" class="hover:underline">${escapeHtml(c.name)}</a></td>
              <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="${badgeClass(c.kind)}">${c.kind}</span></td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">${visibilityBadge(c.visibility)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadges(c)}${violationsBadges(c, "../governance.html") || "-"}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${c.startLine}-${c.endLine}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400 text-xs">${c.signature ? `<code>${escapeHtml(c.signature)}</code>` : "-"}</td>
            </tr>`,
              )
              .join("")}`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${
      sourceCode
        ? `<div class="mb-12">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Full Source</h2>
            <div class="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <pre class="p-4 overflow-x-auto text-sm font-mono leading-tight"><code class="language-typescript">${escapeCodeBlocks(sourceCode)}</code></pre>
            </div>
           </div>`
        : ""
    }

    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose',maxTextSize:300000});</script>
    ${getMermaidExpandModalAndScript()}
  `;

  return layout(filePath, "", body, 1, "", docEntries);
}
