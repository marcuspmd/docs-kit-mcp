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
    class:
      "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    abstract_class:
      "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 dashed",
    interface:
      "bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    function:
      "bg-yellow-50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    method:
      "bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    enum: "bg-pink-50 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    type: "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  };
  return `${base} ${map[kind] || "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"}`;
}

/**
 * Render a visibility badge (public/protected/private).
 */
export function visibilityBadge(visibility?: string): string {
  if (!visibility) return "";
  const base = "px-2 py-0.5 rounded text-xs font-medium border ml-2";
  const map: Record<string, string> = {
    public:
      "bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    protected:
      "bg-yellow-50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    private:
      "bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  };
  return `<span class="${base} ${map[visibility] || "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"}">${visibility}</span>`;
}

/**
 * Render a layer badge (domain/application/infrastructure/presentation/test).
 */
export function layerBadge(layer?: string): string {
  if (!layer) return "";
  const base = "px-2 py-0.5 rounded text-xs font-medium border ml-2";
  const map: Record<string, string> = {
    domain:
      "bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    application:
      "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    infrastructure:
      "bg-yellow-50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    presentation:
      "bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    test: "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600",
  };
  return `<span class="${base} ${map[layer] || "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"}">${layer}</span>`;
}

/**
 * Render status badges for a symbol (exported, deprecated).
 */
export function statusBadges(symbol: CodeSymbol): string {
  const badges = [];
  if (symbol.exported) {
    badges.push(
      `<span class="px-2 py-0.5 rounded text-xs font-medium border bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 ml-2">exported</span>`,
    );
  }
  if (symbol.deprecated) {
    badges.push(
      `<span class="px-2 py-0.5 rounded text-xs font-medium border bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 ml-2 line-through">deprecated</span>`,
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
        `<a href="${governanceHref}#reaper" class="px-2 py-0.5 rounded text-xs font-medium border bg-amber-50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 ml-2 hover:bg-amber-100 dark:hover:bg-amber-900/70">${escapeHtml(v)}</a>`,
    )
    .join("");
}
