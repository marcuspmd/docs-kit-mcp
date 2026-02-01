/**
 * Template types and interfaces for site generation.
 */

/** Doc entry for docs index and nav (matches generator DocEntry). */
export interface DocEntry {
  path: string;
  title?: string;
  name?: string;
  category?: string;
  /** Tag: several docs can share the same module for grouping. */
  module?: string;
  /** Path of the next doc (for sequential navigation). */
  next?: string;
  /** Path of the previous doc (for sequential navigation). */
  prev?: string;
  sourcePath?: string;
  /** Show this doc in the sidebar menu. Defaults to false. */
  showOnMenu?: boolean;
}

export interface ArchViolationRow {
  rule: string;
  file: string;
  symbol_id: string | null;
  message: string;
  severity: string;
}

export interface ReaperFindingRow {
  type: string;
  target: string;
  reason: string;
  suggested_action: string;
}

export interface SiteData {
  symbols: import("../../indexer/symbol.types.js").CodeSymbol[];
  relationships: import("../../storage/db.js").RelationshipRow[];
  patterns: import("../../patterns/patternAnalyzer.js").DetectedPattern[];
  files: string[];
  archViolations?: ArchViolationRow[];
  reaperFindings?: ReaperFindingRow[];
  /** ISO date string when the site was generated */
  generatedAt?: string;
  /** Docs for menu (showOnMenu: true) */
  docEntries?: DocEntry[];
}
