/**
 * Documentation pages templates.
 */

import type { DocEntry } from "../types.js";
import { escapeHtml, docEntryLabel } from "../utils.js";
import { layout } from "../layout.js";
import { getMermaidExpandModalAndScript } from "../mermaid.js";

export function renderMarkdownWrapper(
  title: string,
  mdFilename: string,
  docPath?: string,
  docEntries?: DocEntry[],
  markdownContent?: string,
): string {
  const depth = docPath ? Math.max(0, docPath.split("/").length - 1) : 1;
  const prefix = depth > 0 ? "../".repeat(depth) : "";

  const entryByPath = docEntries?.length
    ? new Map(docEntries.map((e) => [e.path, e]))
    : new Map<string, DocEntry>();
  const currentEntry = docPath ? entryByPath.get(docPath) : undefined;
  const prevEntry = currentEntry?.prev ? entryByPath.get(currentEntry.prev) : undefined;
  const nextEntry = currentEntry?.next ? entryByPath.get(currentEntry.next) : undefined;

  let facetsHtml = "";
  if (docEntries?.length && docPath) {
    // Only show docs with explicit category AND that are markdown files
    // Filter out auto-generated module pages and docs without explicit category
    const others = docEntries.filter((e) => 
      e.path !== docPath && 
      e.category && 
      e.category.trim() !== "" &&
      e.path.toLowerCase().endsWith('.md')  // Only include markdown docs
    );
    const byCategory = new Map<string, DocEntry[]>();
    for (const e of others) {
      const cat = e.category!; // Safe because we filtered above
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(e);
    }
    const prevNextHtml =
      prevEntry || nextEntry
        ? `
      <div class="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 space-y-1">
        ${prevEntry ? `<a href="${prefix}${prevEntry.path.replace(/\.md$/i, ".html")}" class="block px-3 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white text-sm">← ${escapeHtml(docEntryLabel(prevEntry))}</a>` : ""}
        ${nextEntry ? `<a href="${prefix}${nextEntry.path.replace(/\.md$/i, ".html")}" class="block px-3 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white text-sm">${escapeHtml(docEntryLabel(nextEntry))} →</a>` : ""}
      </div>`
        : "";
    facetsHtml = `
    <h3 class="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Documentation</h3>
    <nav class="space-y-1 text-sm">
      <a href="${prefix}docs.html" class="block px-3 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">All docs</a>
      ${prevNextHtml}
      ${
        others.length > 0
          ? Array.from(byCategory.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, entries]) => {
                return `
      <div class="mt-3">
        <span class="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${escapeHtml(category)}</span>
        ${entries
          .map((e) => {
            const href = prefix + e.path.replace(/\.md$/i, ".html");
            const labelE = docEntryLabel(e);
            return `<a href="${escapeHtml(href)}" class="block px-3 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">${escapeHtml(labelE)}</a>`;
          })
          .join("")}
      </div>`;
              })
              .join("")
          : ""
      }
    </nav>`;
  }

  const prevNextFooter =
    prevEntry || nextEntry
      ? `
    <nav class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between gap-4 text-sm" aria-label="Doc navigation">
      ${prevEntry ? `<a href="${prefix}${prevEntry.path.replace(/\.md$/i, ".html")}" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">← ${escapeHtml(docEntryLabel(prevEntry))}</a>` : "<span></span>"}
      ${nextEntry ? `<a href="${prefix}${nextEntry.path.replace(/\.md$/i, ".html")}" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">${escapeHtml(docEntryLabel(nextEntry))} →</a>` : "<span></span>"}
    </nav>`
      : "";

  // If markdown content is provided, embed it directly to avoid CORS issues with file:// protocol
  const escapedMarkdown = markdownContent
    ? markdownContent.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")
    : null;

  const body = markdownContent
    ? `
    <article id="doc" class="prose dark:prose-invert max-w-none prose-blue dark:prose-blue"></article>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
      (function(){
        const md = \`${escapedMarkdown}\`;
        const html = marked.parse(md);
        document.getElementById('doc').innerHTML = html;
        
        // Convert internal .md links to .html so navigation stays within site
        document.querySelectorAll('#doc a').forEach(function(a){
          const href = a.getAttribute('href');
          if (!href) return;
          if (href.toLowerCase().endsWith('.md')) a.setAttribute('href', href.slice(0, -3) + '.html');
        });
        
        // Process code blocks for Mermaid diagrams
        document.querySelectorAll('#doc pre code').forEach(function(block) {
          const className = block.className || '';
          if (className.includes('language-mermaid')) {
            // This is a Mermaid diagram - extract the code and replace with a div
            const mermaidCode = block.textContent;
            const pre = block.parentElement;
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-expand-wrapper relative group';
            wrapper.setAttribute('data-mermaid-src-base64', btoa(mermaidCode));
            
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = mermaidCode;
            wrapper.appendChild(mermaidDiv);
            
            const expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.className = 'mermaid-expand-btn absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium rounded bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 shadow hover:bg-white dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 opacity-70 group-hover:opacity-100 transition-opacity';
            expandBtn.title = 'Expand to fullscreen (zoom and pan)';
            expandBtn.textContent = 'Expand';
            wrapper.appendChild(expandBtn);
            
            pre.parentElement.replaceChild(wrapper, pre);
          } else if (typeof hljs !== 'undefined') {
            // Regular code block - apply syntax highlighting
            hljs.highlightElement(block);
          }
        });
        
        // Initialize Mermaid to render diagrams
        if (typeof mermaid !== 'undefined') {
          mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose',maxTextSize:300000});
          mermaid.run({querySelector:'.mermaid'});
        }
      })();
    </script>
    ${prevNextFooter}
    ${getMermaidExpandModalAndScript()}
  `
    : `
    <article id="doc" class="prose dark:prose-invert max-w-none prose-blue dark:prose-blue">
       <div class="flex items-center justify-center h-32">
          <svg class="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2 text-gray-600 dark:text-gray-400">Loading document...</span>
       </div>
    </article>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
      (async function(){
        try {
          const res = await fetch('./${escapeHtml(mdFilename)}');
          if (!res.ok) throw new Error('Failed to load');
          const md = await res.text();
          const html = marked.parse(md);
          document.getElementById('doc').innerHTML = html;
          
          // Convert internal .md links to .html so navigation stays within site
          document.querySelectorAll('#doc a').forEach(function(a){
            const href = a.getAttribute('href');
            if (!href) return;
            if (href.toLowerCase().endsWith('.md')) a.setAttribute('href', href.slice(0, -3) + '.html');
          });
          
          // Process code blocks for Mermaid diagrams
          document.querySelectorAll('#doc pre code').forEach(function(block) {
            const className = block.className || '';
            if (className.includes('language-mermaid')) {
              // This is a Mermaid diagram - extract the code and replace with a div
              const mermaidCode = block.textContent;
              const pre = block.parentElement;
              const wrapper = document.createElement('div');
              wrapper.className = 'mermaid-expand-wrapper relative group';
              wrapper.setAttribute('data-mermaid-src-base64', btoa(mermaidCode));
              
              const mermaidDiv = document.createElement('div');
              mermaidDiv.className = 'mermaid';
              mermaidDiv.textContent = mermaidCode;
              wrapper.appendChild(mermaidDiv);
              
              const expandBtn = document.createElement('button');
              expandBtn.type = 'button';
              expandBtn.className = 'mermaid-expand-btn absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium rounded bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 shadow hover:bg-white dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 opacity-70 group-hover:opacity-100 transition-opacity';
              expandBtn.title = 'Expand to fullscreen (zoom and pan)';
              expandBtn.textContent = 'Expand';
              wrapper.appendChild(expandBtn);
              
              pre.parentElement.replaceChild(wrapper, pre);
            } else if (typeof hljs !== 'undefined') {
              // Regular code block - apply syntax highlighting
              hljs.highlightElement(block);
            }
          });
          
          // Initialize Mermaid to render diagrams
          if (typeof mermaid !== 'undefined') {
            mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose',maxTextSize:300000});
            mermaid.run({querySelector:'.mermaid'});
          }
        } catch(e) {
          document.getElementById('doc').innerHTML = '<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4 text-red-700 dark:text-red-300">Error loading document: ' + e.message + '</div>';
        }
      })();
    </script>
    ${prevNextFooter}
    ${getMermaidExpandModalAndScript()}
  `;

  return layout(title, "", body, depth, facetsHtml, docEntries ?? []);
}

export function renderDocsPage(docEntries: DocEntry[]): string {
  // Only show markdown docs with explicit category
  const filtered = docEntries.filter((e) => 
    e.category && 
    e.category.trim() !== "" &&
    e.path.toLowerCase().endsWith('.md')
  );
  
  const sorted = [...filtered].sort((a, b) => {
    const catA = a.category ?? "";
    const catB = b.category ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    return (a.title ?? a.name ?? a.path).localeCompare(b.title ?? b.name ?? b.path);
  });

  const byCategory = new Map<string, DocEntry[]>();
  const byModule = new Map<string, DocEntry[]>();
  for (const e of sorted) {
    const cat = e.category!; // Safe because we filtered above
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(e);
    if (e.module) {
      if (!byModule.has(e.module)) byModule.set(e.module, []);
      byModule.get(e.module)!.push(e);
    }
  }

  const facetsHtml =
    sorted.length > 0
      ? `
    <h3 class="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Documentation</h3>
    <nav class="space-y-1 text-sm">
      <a href="docs.html" class="block px-3 py-1 rounded-md text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/50">All docs</a>
      ${Array.from(byCategory.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, entries]) => {
          return `
      <div class="mt-3">
        <span class="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${escapeHtml(category)}</span>
        ${entries
          .map((e) => {
            const href = e.path.replace(/\.md$/i, ".html");
            const labelE = docEntryLabel(e);
            return `<a href="${escapeHtml(href)}" class="block px-3 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">${escapeHtml(labelE)}</a>`;
          })
          .join("")}
      </div>`;
        })
        .join("")}
      ${
        byModule.size > 0
          ? `
      <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <span class="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Module</span>
        ${Array.from(byModule.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([mod, entries]) => `
        <div class="mt-2">
          <span class="px-3 text-xs text-gray-500 dark:text-gray-400">${escapeHtml(mod)}</span>
          ${entries
            .map((e) => {
              const href = e.path.replace(/\.md$/i, ".html");
              const labelE = docEntryLabel(e);
              return `<a href="${escapeHtml(href)}" class="block px-3 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">${escapeHtml(labelE)}</a>`;
            })
            .join("")}
        </div>`,
          )
          .join("")}
      </div>`
          : ""
      }
    </nav>`
      : "";

  const body = `
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-200 dark:border-gray-700">Documentation</h1>
    <p class="text-gray-600 dark:text-gray-400 mb-6">Markdown docs explicitly listed in <code class="text-sm bg-gray-100 dark:bg-gray-700 px-1 rounded">docs.config.js</code>. Open the HTML version to read in the site.</p>
    ${
      sorted.length === 0
        ? "<div class='text-center py-12 text-gray-500 dark:text-gray-400'>No documentation entries found. Add docs with explicit categories to <code class='text-sm bg-gray-100 dark:bg-gray-700 px-1 rounded'>docs.config.js</code>.</div>"
        : Array.from(byCategory.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, entries]) => {
              return `
    <div class="mb-10">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">${escapeHtml(category)}</h2>
      <div class="bg-white dark:bg-gray-800 shadow overflow-x-auto sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          ${entries
            .map((e) => {
              const htmlRef = e.path.replace(/\.md$/i, ".html");
              const displayLabel = docEntryLabel(e);
              const moduleBadge = e.module
                ? `<span class="ml-2 px-2 py-0.5 text-xs font-medium rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">module: ${escapeHtml(e.module)}</span>`
                : "";
              return `<li class="px-6 py-4"><a href="${escapeHtml(htmlRef)}" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">${escapeHtml(displayLabel)}</a>${moduleBadge}<span class="text-gray-400 dark:text-gray-500 text-sm ml-2">${escapeHtml(e.path)}</span></li>`;
            })
            .join("")}
        </ul>
      </div>
    </div>`;
            })
            .join("")
    }
    ${
      byModule.size > 0
        ? `
    <div class="mb-10">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">By module</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${Array.from(byModule.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([mod, entries]) => `
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <span class="text-sm font-semibold text-gray-800 dark:text-white">${escapeHtml(mod)}</span>
          </div>
          <ul class="divide-y divide-gray-100 dark:divide-gray-700 px-4 py-2">
            ${entries
              .map((e) => {
                const htmlRef = e.path.replace(/\.md$/i, ".html");
                const displayLabel = docEntryLabel(e);
                return `<li class="py-2"><a href="${escapeHtml(htmlRef)}" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">${escapeHtml(displayLabel)}</a></li>`;
              })
              .join("")}
          </ul>
        </div>`,
          )
          .join("")}
      </div>
    </div>`
        : ""
    }
  `;

  return layout("Docs", "docs.html", body, 0, facetsHtml, docEntries);
}
