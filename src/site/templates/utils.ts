/**
 * Utility functions for template rendering.
 */

/**
 * HTML escape special characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escape code blocks for safe HTML display.
 */
export function escapeCodeBlocks(str: string): string {
  return escapeHtml(str);
}

/**
 * Base64-encode a string for use in data attributes (Node.js).
 */
export function base64Encode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

/**
 * Format a Date object as ISO string, handling errors gracefully.
 */
export function formatDate(d?: Date): string | undefined {
  if (!d) return undefined;
  try {
    return d.toISOString();
  } catch {
    return String(d);
  }
}

/**
 * Get a label for a doc entry, preferring title > name > filename.
 */
export function docEntryLabel(entry: { title?: string; name?: string; path: string }): string {
  return (
    entry.title ?? entry.name ?? (entry.path.split("/").pop() || entry.path).replace(/\.md$/i, "")
  );
}
