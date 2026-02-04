import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import type { ISiteGenerator } from "../../domain/services/index.js";

export interface BuildSiteInput {
  /**
   * Path to the database file
   */
  dbPath: string;

  /**
   * Output directory for the generated site
   */
  outputDir: string;

  /**
   * Root directory of the project (for resolving source files)
   */
  rootPath?: string;
}

export interface BuildSiteOutput {
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
   * Number of documentation entries processed
   */
  docEntries: number;

  /**
   * Path to the generated site
   */
  outputPath: string;
}

/**
 * BuildSite Use Case
 *
 * Generates a static documentation site from indexed symbols and relationships.
 * This use case orchestrates the site generation process using the ISiteGenerator service.
 */
export class BuildSiteUseCase implements UseCase<BuildSiteInput, BuildSiteOutput> {
  constructor(private readonly siteGenerator: ISiteGenerator) {}

  async execute(input: BuildSiteInput): Promise<Result<BuildSiteOutput>> {
    try {
      // Delegate to site generator service
      const result = await this.siteGenerator.generate({
        dbPath: input.dbPath,
        outDir: input.outputDir,
        rootDir: input.rootPath,
      });

      return result;
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
