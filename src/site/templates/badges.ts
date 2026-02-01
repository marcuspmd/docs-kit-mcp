/**
 * Badge rendering functions for symbol display.
 */

import type { CodeSymbol } from "../../indexer/symbol.types.js";
import { escapeHtml } from "./utils.js";

/**
 * Get CSS classes for a symbol kind badge.
 */
export function badgeClass(kind: string): string {
  const base = "px-2 py-0.5 rounded text-xs font-medium border";
  const map: Record<string, string> = {
    class: "bg-blue-50 text-blue-700 border-blue-200",
    abstract_class: "bg-blue-50 text-blue-700 border-blue-200 dashed",
    interface: "bg-green-50 text-green-700 border-green-200",
    function: "bg-yellow-50 text-yellow-800 border-yellow-200",
    method: "bg-purple-50 text-purple-700 border-purple-200",
    enum: "bg-pink-50 text-pink-700 border-pink-200",
    type: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return `${base} ${map[kind] || "bg-gray-50 text-gray-700 border-gray-200"}`;
}

/**
 * Render a visibility badge (public/protected/private).
 */
export function visibilityBadge(visibility?: string): string {
  if (!visibility) return "";
  const base = "px-2 py-0.5 rounded text-xs font-medium border ml-2";
  const map: Record<string, string> = {
    public: "bg-green-50 text-green-700 border-green-200",
    protected: "bg-yellow-50 text-yellow-800 border-yellow-200",
    private: "bg-red-50 text-red-700 border-red-200",
  };
  return `<span class="${base} ${map[visibility] || "bg-gray-50 text-gray-700 border-gray-200"}">${visibility}</span>`;
}

/**
 * Render a layer badge (domain/application/infrastructure/presentation/test).
 */
export function layerBadge(layer?: string): string {
  if (!layer) return "";
  const base = "px-2 py-0.5 rounded text-xs font-medium border ml-2";
  const map: Record<string, string> = {
    domain: "bg-green-50 text-green-700 border-green-200",
    application: "bg-blue-50 text-blue-700 border-blue-200",
    infrastructure: "bg-yellow-50 text-yellow-800 border-yellow-200",
    presentation: "bg-purple-50 text-purple-700 border-purple-200",
    test: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return `<span class="${base} ${map[layer] || "bg-gray-50 text-gray-700 border-gray-200"}">${layer}</span>`;
}

/**
 * Render status badges for a symbol (exported, deprecated).
 */
export function statusBadges(symbol: CodeSymbol): string {
  const badges = [];
  if (symbol.exported) {
    badges.push(
      `<span class="px-2 py-0.5 rounded text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 ml-2">exported</span>`,
    );
  }
  if (symbol.deprecated) {
    badges.push(
      `<span class="px-2 py-0.5 rounded text-xs font-medium border bg-red-50 text-red-700 border-red-200 ml-2 line-through">deprecated</span>`,
    );
  }
  return badges.join("");
}

/**
 * Render violation badges for a symbol with links to governance page.
 */
export function violationsBadges(symbol: CodeSymbol, governanceHref = "governance.html"): string {
  if (!symbol.violations?.length) return "";
  return symbol.violations
    .map(
      (v) =>
        `<a href="${governanceHref}#reaper" class="px-2 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200 ml-2 hover:bg-amber-100">${escapeHtml(v)}</a>`,
    )
    .join("");
}
