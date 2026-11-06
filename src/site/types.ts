/**
 * Shared site types (v2). Independent from the deprecated v1 templates.
 */

import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DetectedPattern } from "../patterns/patternAnalyzer.js";
import type { ArchViolationRow, ReaperFindingRow, RelationshipRow } from "../storage/db.js";

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

export interface SiteData {
  symbols: CodeSymbol[];
  relationships: RelationshipRow[];
  patterns: DetectedPattern[];
  files: string[];
  archViolations?: ArchViolationRow[];
  reaperFindings?: ReaperFindingRow[];
  /** ISO date string when the site was generated */
  generatedAt?: string;
  /** Docs for menu (showOnMenu: true) */
  docEntries?: DocEntry[];
}
