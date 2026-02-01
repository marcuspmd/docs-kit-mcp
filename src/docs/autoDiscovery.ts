import * as fs from "node:fs";
import * as path from "node:path";
import fastGlob from "fast-glob";
import type { DocEntry } from "../config.js";

/**
 * Expands doc entries with autoDiscovery:true by scanning directories for .md files.
 *
 * Rules:
 * - Recursively scans path directory for all .md files
 * - module: derived from relative path (e.g., "examples", "examples/advanced")
 * - name: filename without extension
 * - category: parent directory name
 * - title: capitalized filename
 * - next/previous: automatically linked in alphabetical order
 * - Respects explicit next/previous when provided
 */
export async function expandAutoDiscoveryDocs(
  docs: DocEntry[],
  projectRoot: string,
): Promise<DocEntry[]> {
  const expanded: DocEntry[] = [];

  for (const doc of docs) {
    if (!doc.autoDiscovery) {
      // Keep non-auto-discovery entries as-is
      expanded.push(doc);
      continue;
    }

    // Resolve path relative to project root
    const dirPath = path.resolve(projectRoot, doc.path);

    // Verify it's a directory
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      console.warn(`  [auto-discovery] Skipping ${doc.path} - not a directory`);
      expanded.push(doc);
      continue;
    }

    // Find all .md files recursively
    const mdFiles = await fastGlob("**/*.md", {
      cwd: dirPath,
      absolute: false,
    });

    // Sort alphabetically for consistent ordering
    mdFiles.sort();

    // Convert to DocEntry objects
    const discovered = mdFiles.map((relativePath) => {
      const absolutePath = path.join(dirPath, relativePath);
      const parsed = path.parse(relativePath);
      const name = parsed.name;

      // Extract module from path structure
      // e.g., "examples" or "examples/advanced" for examples/advanced/file.md
      const dirParts = parsed.dir ? parsed.dir.split(path.sep) : [];
      const baseModule = path.basename(dirPath);
      const module = dirParts.length > 0 ? `${baseModule}/${dirParts.join("/")}` : baseModule;

      // Category: immediate parent directory
      const category = dirParts[dirParts.length - 1] || baseModule;

      // Title: capitalize name
      const title = name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      // Preserve the original path prefix (e.g., "./" or "docs/")
      const fullPath = path.join(doc.path, relativePath).replace(/\\/g, "/");

      return {
        path: fullPath,
        name,
        title,
        category,
        module,
        absolutePath,
      };
    });

    // Create DocEntry objects (navigation links will be added by linkDocNavigation)
    for (const current of discovered) {
      expanded.push({
        path: current.path,
        name: current.name,
        title: current.title,
        category: current.category,
        module: current.module,
        showOnMenu: doc.showOnMenu,
        symbols: [], // Will be extracted from frontmatter during rebuild
      });
    }
  }

  return expanded;
}

/**
 * Post-processes expanded docs to link them sequentially.
 *
 * Rules:
 * - Maintains the order of the docs array (order matters!)
 * - Links docs sequentially: doc[i].next = doc[i+1].path
 * - Respects explicit next/previous when provided
 * - First doc has no previous, last doc has no next
 */
export function linkDocNavigation(docs: DocEntry[]): DocEntry[] {
  const linked: DocEntry[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    // Calculate automatic links based on array position
    const autoPrevious = i > 0 ? docs[i - 1].path : undefined;
    const autoNext = i < docs.length - 1 ? docs[i + 1].path : undefined;

    // Use explicit links if provided, otherwise use automatic links
    const previous = doc.previous ?? autoPrevious;
    const next = doc.next ?? autoNext;

    linked.push({
      ...doc,
      previous,
      next,
    });
  }

  return linked;
}
