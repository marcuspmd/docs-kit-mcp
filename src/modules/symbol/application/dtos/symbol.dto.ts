import type { SymbolKindType } from "../../domain/value-objects/SymbolKind.js";
import type {
  Layer,
  Visibility,
  Language,
  Stability,
  CodeMetrics,
} from "../../domain/entities/CodeSymbol.js";

/**
 * Input DTO for IndexProject use case
 */
export interface IndexProjectInput {
  rootPath: string;
  patterns?: string[];
  excludePatterns?: string[];
  fullRebuild?: boolean;
  parallel?: boolean;
}

/**
 * Output DTO for IndexProject use case
 */
export interface IndexProjectOutput {
  filesProcessed: number;
  symbolsFound: number;
  relationshipsFound: number;
  duration: number;
  errors: string[];
}

/**
 * Input DTO for FindSymbol use case
 */
export interface FindSymbolInput {
  name?: string;
  id?: string;
  file?: string;
  kind?: SymbolKindType;
}

/**
 * Output DTO for symbol data
 */
export interface SymbolOutput {
  id: string;
  name: string;
  qualifiedName?: string;
  kind: SymbolKindType;
  file: string;
  startLine: number;
  endLine: number;
  parent?: string;
  visibility?: Visibility;
  exported?: boolean;
  language?: Language;
  docRef?: string;
  summary?: string;
  docComment?: string;
  tags?: string[];
  domain?: string;
  boundedContext?: string;
  extends?: string;
  implements?: string[];
  layer?: Layer;
  metrics?: CodeMetrics;
  pattern?: string;
  violations?: string[];
  deprecated?: boolean;
  stability?: Stability;
  signature?: string;
  explanation?: string;
}

/**
 * Input DTO for ExplainSymbol use case
 */
export interface ExplainSymbolInput {
  symbolName: string;
  forceRegenerate?: boolean;
}

/**
 * Output DTO for ExplainSymbol use case
 */
export interface ExplainSymbolOutput {
  symbol: SymbolOutput;
  explanation: string;
  sourceCode?: string;
  relationships?: {
    callers: SymbolOutput[];
    callees: SymbolOutput[];
    implementors: SymbolOutput[];
  };
}
