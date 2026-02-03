import type { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import type { SymbolRelationship } from "../../../domain/entities/SymbolRelationship.js";

/**
 * Parse Result
 */
export interface ParseResult {
  symbols: CodeSymbol[];
  relationships: SymbolRelationship[];
  metadata?: {
    language: string;
    loc?: number;
    size?: number;
  };
}

/**
 * Language Parser Interface (Strategy Pattern)
 *
 * Implementa a lógica de parsing específica para cada linguagem.
 */
export interface ILanguageParser {
  /**
   * File extensions supported by this parser
   */
  readonly supportedExtensions: string[];

  /**
   * Parse a file and extract symbols
   */
  parse(filePath: string, content: string): Promise<ParseResult>;

  /**
   * Validate syntax (optional)
   */
  validate?(content: string): Promise<{ isValid: boolean; errors: string[] }>;
}
