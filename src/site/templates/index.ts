/**
 * Template module entry point.
 * Re-exports all template functions and types for easy consumption.
 */

// Types
export type { DocEntry, ArchViolationRow, ReaperFindingRow, SiteData } from "./types.js";

// Utilities
export { escapeHtml, escapeCodeBlocks, base64Encode, formatDate, docEntryLabel } from "./utils.js";

// Badges
export {
  badgeClass,
  visibilityBadge,
  layerBadge,
  statusBadges,
  violationsBadges,
} from "./badges.js";

// Mermaid
export { mermaidDiagramWrap, getMermaidExpandModalAndScript } from "./mermaid.js";

// Layout
export { layout } from "./layout.js";

// Pages
export { renderDashboard } from "./pages/dashboard.js";
export { renderFilesPage, renderFilePage } from "./pages/files.js";
export { renderSymbolPage } from "./pages/symbol.js";
export { renderRelationshipsPage } from "./pages/relationships.js";
export { renderPatternsPage } from "./pages/patterns.js";
export { renderMarkdownWrapper, renderDocsPage } from "./pages/docs.js";
export { renderDeprecatedPage } from "./pages/deprecated.js";
export { renderGovernancePage } from "./pages/governance.js";
export { buildSearchIndex } from "./pages/search.js";

// Re-export fileSlug from shared
export { fileSlug } from "../shared.js";
