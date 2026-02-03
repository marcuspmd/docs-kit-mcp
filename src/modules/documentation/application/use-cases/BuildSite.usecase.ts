import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";

export interface BuildSiteInput {
  rootPath: string;
  outputDir: string;
  templateDir?: string;
}

export interface BuildSiteOutput {
  pagesGenerated: number;
  assetsGenerated: number;
  errors: string[];
}

/**
 * BuildSite Use Case
 *
 * Generates a static documentation site.
 */
export class BuildSiteUseCase implements UseCase<BuildSiteInput, BuildSiteOutput> {
  async execute(_input: BuildSiteInput): Promise<Result<BuildSiteOutput>> {
    try {
      // TODO: Implement site generation logic
      return Result.ok({
        pagesGenerated: 0,
        assetsGenerated: 0,
        errors: [],
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}
