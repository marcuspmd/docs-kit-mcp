/**
 * Search index builder for the site.
 */

import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import { formatDate } from "../utils.js";
import { badgeClass } from "../badges.js";

/**
 * Build search index data for client-side search (Fuse.js).
 */
export function buildSearchIndex(symbols: CodeSymbol[]): {
  items: object[];
  facets: {
    kinds: Record<string, number>;
    tags: Record<string, number>;
    files: Record<string, number>;
  };
} {
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
