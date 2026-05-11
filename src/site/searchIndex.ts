/**
 * Search index builder for the site (standalone, no v1 template deps).
 */

import type { CodeSymbol } from "../indexer/symbol.types.js";

function formatDate(d?: Date): string | undefined {
  if (!d) return undefined;
  try {
    return d.toISOString();
  } catch {
    return String(d);
  }
}

/**
 * Lightweight badge-class hint used by the client to color symbol chips.
 * The v2 site renders its own badges, so this is purely informational.
 */
function badgeClass(kind: string): string {
  const map: Record<string, string> = {
    class: "kind-class",
    abstract_class: "kind-class",
    interface: "kind-interface",
    function: "kind-function",
    method: "kind-method",
    enum: "kind-enum",
    type: "kind-type",
  };
  return map[kind] ?? "kind-other";
}

export interface SearchIndex {
  items: object[];
  facets: {
    kinds: Record<string, number>;
    tags: Record<string, number>;
    files: Record<string, number>;
  };
}

export function buildSearchIndex(symbols: CodeSymbol[]): SearchIndex {
  const items = symbols.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    file: s.file,
    signature: s.signature ?? null,
    docRef: s.docRef ?? null,
    summary: s.summary ?? null,
    tags: s.tags ?? null,
    pattern: s.pattern ?? null,
    lastModified: s.lastModified ? formatDate(s.lastModified) : null,
    badgeClass: badgeClass(s.kind),
  }));

  const kinds: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const files: Record<string, number> = {};

  for (const it of items) {
    kinds[it.kind] = (kinds[it.kind] ?? 0) + 1;
    if (Array.isArray(it.tags)) {
      for (const t of it.tags as string[]) {
        tags[t] = (tags[t] ?? 0) + 1;
      }
    }
    const seg = it.file && typeof it.file === "string" ? it.file.split("/")[0] || it.file : "root";
    files[seg] = (files[seg] ?? 0) + 1;
  }

  return { items, facets: { kinds, tags, files } };
}
