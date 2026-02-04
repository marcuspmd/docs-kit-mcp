/**
 * Database row types for site generation
 */

export interface SymbolRow {
  id: string;
  name: string;
  qualified_name: string | null;
  kind: string;
  file: string;
  start_line: number;
  end_line: number;
  parent: string | null;
  visibility: string | null;
  exported: number | null;
  signature: string | null;
  pattern: string | null;
  metrics: string | null;
  doc_ref: string | null;
  summary: string | null;
  tags: string | null;
  last_modified: string | null;
  layer: string | null;
  deprecated: number | null;
  violations: string | null;
  explanation: string | null;
}

export interface RelationshipRow {
  source: string;
  target: string;
  kind: string;
  file: string;
  line: number;
}

export interface DocEntryRow {
  path: string;
  title: string | null;
  name: string | null;
  category: string | null;
  module: string | null;
}

export interface SearchIndexItem {
  id: string;
  name: string;
  kind: string;
  file: string;
}
