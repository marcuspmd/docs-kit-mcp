import { extname } from "node:path";
import type { ILanguageParser } from "./strategies/ILanguageParser.js";

/**
 * Parser Registry
 *
 * Manages language parsers using the Strategy pattern.
 * Allows registration of parsers and selection based on file extension.
 */
export class ParserRegistry {
  private parsers: Map<string, ILanguageParser> = new Map();
  private extensionMap: Map<string, ILanguageParser> = new Map();

  /**
   * Register a parser for a language
   */
  register(name: string, parser: ILanguageParser): void {
    this.parsers.set(name, parser);

    // Map extensions to parser
    for (const ext of parser.supportedExtensions) {
      this.extensionMap.set(ext.toLowerCase(), parser);
    }
  }

  /**
   * Get parser by file extension
   */
  getParserForFile(filePath: string): ILanguageParser | null {
    const ext = extname(filePath).toLowerCase();
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Get parser by name
   */
  getParser(name: string): ILanguageParser | null {
    return this.parsers.get(name) || null;
  }

  /**
   * List all supported extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Check if a file is supported
   */
  isSupported(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return this.extensionMap.has(ext);
  }
}
