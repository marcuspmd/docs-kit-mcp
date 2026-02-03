/**
 * Markdown rendering utilities for server-side HTML generation.
 */

import { marked } from "marked";
import { escapeHtml } from "./utils.js";

/**
 * Configures marked with safe defaults for rendering user content.
 */
function configureMarked() {
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
    pedantic: false,
  });
}

configureMarked();

/**
 * Renders markdown to HTML safely.
 *
 * @param markdown - Raw markdown text
 * @returns HTML string safe for embedding in page
 */
export function renderMarkdown(markdown: string | undefined | null): string {
  if (!markdown || markdown.trim() === "") {
    return "";
  }

  try {
    return marked.parse(markdown.trim()) as string;
  } catch (error) {
    console.warn("Failed to render markdown:", error);
    // Fallback to escaped HTML with line breaks preserved
    return `<p>${escapeHtml(markdown).replace(/\n/g, "<br>")}</p>`;
  }
}

/**
 * Renders markdown inline (without wrapping in <p> tags for short text).
 * Useful for summaries that should stay on one line.
 *
 * @param markdown - Raw markdown text
 * @returns HTML string safe for embedding in page
 */
// renderMarkdownInline has been removed (unused helper).
export function renderMarkdownInline_DEPRECATED(markdown: string | undefined | null): string {
  if (!markdown || markdown.trim() === "") {
    return "";
  }

  try {
    const html = marked.parseInline(markdown.trim()) as string;
    return html;
  } catch (error) {
    console.warn("Failed to render inline markdown:", error);
    return escapeHtml(markdown);
  }
}
