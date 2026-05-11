/**
 * Smart Diagrams - Create intelligent, layered Mermaid diagrams
 * Separate complex visualizations into manageable views
 */

import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { RelationshipRow } from "../storage/db.js";

/**
 * Wrap a Mermaid diagram source in a fenced code block that renders inside
 * Markdown viewers and the React v2 site.
 */
function mermaidDiagramWrap(source: string): string {
  if (!source.trim()) return "";
  return "```mermaid\n" + source + "\n```";
}

interface DiagramView {
  id: string;
  title: string;
  description: string;
  mermaid: string;
}

/**
 * Safely escape node IDs for Mermaid
 */
function safeNodeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Create smart layered diagrams that separate relationships by architectural layer
 */
export function createLayeredDiagrams(
  symbols: CodeSymbol[],
  relationships: RelationshipRow[],
  clickable = false,
  baseUrl = "../symbols/",
): DiagramView[] {
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));

  // Group symbols by layer
  const layers = new Map<string, Set<string>>();
  for (const symbol of symbols) {
    const layer = symbol.layer || "application";
    if (!layers.has(layer)) layers.set(layer, new Set());
    layers.get(layer)!.add(symbol.id);
  }

  const views: DiagramView[] = [];

  const overviewView = buildOverviewDiagram(layers, relationships, symbolMap);
  if (overviewView) views.push(overviewView);

  for (const [layer, symbolIds] of layers) {
    const view = buildLayerDiagram(layer, symbolIds, relationships, symbolMap, clickable, baseUrl);
    if (view) views.push(view);
  }

  return views;
}

function buildOverviewDiagram(
  layers: Map<string, Set<string>>,
  relationships: RelationshipRow[],
  symbolMap: Map<string, CodeSymbol>,
): DiagramView | null {
  const overviewRels = relationships.filter((rel) => {
    const s = symbolMap.get(rel.source_id);
    const t = symbolMap.get(rel.target_id);
    return s && t && (s.layer || "application") !== (t.layer || "application");
  });

  if (overviewRels.length === 0 || layers.size <= 1) return null;

  const lines: string[] = ["graph TB"];
  for (const [layer, ids] of layers) {
    const safe = safeNodeId(layer);
    lines.push(`  ${safe}["${layer}<br/>(${ids.size} symbols)"]:::layerBox`);
  }

  const edgeCounts = new Map<string, number>();
  for (const rel of overviewRels) {
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;
    const key = `${source.layer || "application"}:::${target.layer || "application"}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of edgeCounts) {
    const [sLayer, tLayer] = key.split(":::");
    lines.push(`  ${safeNodeId(sLayer)} -->|${count} refs| ${safeNodeId(tLayer)}`);
  }
  lines.push("  classDef layerBox fill:#dbeafe,stroke:#2563eb,stroke-width:2px");

  return {
    id: "overview",
    title: "Architecture Overview",
    description: "Cross-layer dependencies",
    mermaid: lines.join("\n"),
  };
}

function buildLayerDiagram(
  layer: string,
  symbolIds: Set<string>,
  relationships: RelationshipRow[],
  symbolMap: Map<string, CodeSymbol>,
  clickable: boolean,
  baseUrl: string,
): DiagramView | null {
  const layerSymbols = Array.from(symbolIds)
    .map((id) => symbolMap.get(id)!)
    .filter(Boolean);
  const layerRels = relationships.filter(
    (r) => symbolIds.has(r.source_id) && symbolIds.has(r.target_id),
  );
  if (layerRels.length === 0) return null;

  const lines: string[] = ["graph LR"];
  const added = new Set<string>();
  const clickLines: string[] = [];
  const limit = Math.min(layerRels.length, 100);
  const arrowMap: Record<string, string> = {
    inherits: "-->|inherits|",
    implements: "-.->|implements|",
    uses: "-->|uses|",
    instantiates: "-.->|instantiates|",
    calls: "-->|calls|",
    contains: "-->|contains|",
    listens_to: "-.->|listens to|",
    dispatches: "-->|dispatches|",
  };

  for (let i = 0; i < limit; i++) {
    const rel = layerRels[i];
    const source = symbolMap.get(rel.source_id);
    const target = symbolMap.get(rel.target_id);
    if (!source || !target) continue;

    const sName = safeNodeId(source.name);
    const tName = safeNodeId(target.name);

    if (!added.has(sName)) {
      added.add(sName);
      lines.push(`  ${sName}["${source.name}"]`);
      if (clickable) clickLines.push(`  click ${sName} "${baseUrl}${source.id}.html"`);
    }
    if (!added.has(tName)) {
      added.add(tName);
      lines.push(`  ${tName}["${target.name}"]`);
      if (clickable) clickLines.push(`  click ${tName} "${baseUrl}${target.id}.html"`);
    }

    const arrow = arrowMap[rel.type] ?? `-->|${rel.type}|`;
    lines.push(`  ${sName} ${arrow} ${tName}`);
  }

  if (added.size === 0) return null;

  if (layerRels.length > limit) {
    lines.push(`  subgraph _note[Showing ${limit} of ${layerRels.length} relationships]`);
    lines.push("  end");
  }

  return {
    id: `layer-${layer}`,
    title: `${layer} Layer`,
    description: `${layerSymbols.length} symbols, ${layerRels.length} relationships`,
    mermaid: [...lines, ...clickLines].join("\n"),
  };
}

/**
 * Render multiple diagram views with tabs
 */
export function renderDiagramTabs(views: DiagramView[]): string {
  if (views.length === 0) return "";
  if (views.length === 1) {
    // Single view, no tabs needed - wrap with expand button
    return mermaidDiagramWrap(views[0].mermaid);
  }

  // Generate unique ID for this tab group
  const tabGroupId = `tabs-${Math.random().toString(36).substring(7)}`;

  const tabs = views
    .map(
      (view, i) => `
    <button
      class="diagram-tab px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${i === 0 ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-l border-r border-gray-200 dark:border-gray-600" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}"
      data-tab="${view.id}"
      data-group="${tabGroupId}"
      ${i === 0 ? 'aria-selected="true"' : 'aria-selected="false"'}
      role="tab">
      ${view.title}
      <span class="text-xs ml-1 opacity-70">(${view.description})</span>
    </button>`,
    )
    .join("");

  const panels = views
    .map(
      (view, i) => `
    <div
      class="diagram-panel ${i === 0 ? "" : "hidden"}"
      data-panel="${view.id}"
      data-group="${tabGroupId}"
      role="tabpanel">
      ${mermaidDiagramWrap(view.mermaid)}
    </div>`,
    )
    .join("");

  return `
    <div class="diagram-tabs-container">
      <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto" role="tablist">
        ${tabs}
      </div>
      <div class="diagram-panels">
        ${panels}
      </div>
    </div>
    <script>
      (function() {
        document.querySelectorAll('.diagram-tab').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var tabId = this.getAttribute('data-tab');
            var groupId = this.getAttribute('data-group');

            // Update tabs
            document.querySelectorAll('.diagram-tab[data-group="' + groupId + '"]').forEach(function(t) {
              t.classList.remove('bg-white', 'dark:bg-gray-800', 'text-blue-600', 'dark:text-blue-400', 'border-t', 'border-l', 'border-r', 'border-gray-200', 'dark:border-gray-600');
              t.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-600', 'dark:text-gray-400');
              t.setAttribute('aria-selected', 'false');
            });
            this.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-600', 'dark:text-gray-400');
            this.classList.add('bg-white', 'dark:bg-gray-800', 'text-blue-600', 'dark:text-blue-400', 'border-t', 'border-l', 'border-r', 'border-gray-200', 'dark:border-gray-600');
            this.setAttribute('aria-selected', 'true');

            // Update panels
            document.querySelectorAll('.diagram-panel[data-group="' + groupId + '"]').forEach(function(p) {
              p.classList.add('hidden');
            });
            var panel = document.querySelector('.diagram-panel[data-panel="' + tabId + '"][data-group="' + groupId + '"]');
            if (panel) {
              panel.classList.remove('hidden');
              // Re-render Mermaid for this panel
              if (typeof mermaid !== 'undefined') {
                var mermaidDiv = panel.querySelector('.mermaid');
                if (mermaidDiv && !mermaidDiv.getAttribute('data-processed')) {
                  try {
                    mermaid.run({ nodes: [mermaidDiv] });
                  } catch (e) {
                    console.warn('Mermaid render failed', e);
                  }
                }
              }
            }
          });
        });
      })();
    </script>
  `;
}
