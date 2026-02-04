import type { Result } from "../../../../@core/domain/Result.js";

/**
 * Site generation options
 */
export interface SiteGenerationOptions {
  /**
   * Path to the database file
   */
  dbPath: string;

  /**
   * Output directory for generated site
   */
  outDir: string;

  /**
   * Root directory of the project (for resolving source files)
   */
  rootDir?: string;
}

/**
 * Site generation result
 */
export interface SiteGenerationResult {
  /**
   * Number of symbol pages generated
   */
  symbolPages: number;

  /**
   * Number of file pages generated
   */
  filePages: number;

  /**
   * Total number of files generated
   */
  totalFiles: number;

  /**
   * Generated documentation entries
   */
  docEntries: number;

  /**
   * Path to the generated site
   */
  outputPath: string;
}

/**
 * Site Generator Interface
 *
 * Responsible for generating a static HTML documentation site from indexed symbols.
 */
export interface ISiteGenerator {
  /**
   * Generate a static documentation site
   *
   * @param options - Site generation options
   * @returns Result containing site generation statistics or error
   */
  generate(options: SiteGenerationOptions): Promise<Result<SiteGenerationResult>>;
}
