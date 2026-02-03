import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import type { ChangeImpact } from "../../domain/entities/ChangeImpact.js";

export interface AnalyzeImpactInput {
  baseBranch: string;
  targetBranch?: string;
  rootPath: string;
}

export interface AnalyzeImpactOutput {
  impacts: ChangeImpact[];
  filesChanged: number;
  symbolsAffected: number;
  breakingChanges: number;
}

export class AnalyzeImpactUseCase implements UseCase<AnalyzeImpactInput, AnalyzeImpactOutput> {
  async execute(_input: AnalyzeImpactInput): Promise<Result<AnalyzeImpactOutput>> {
    try {
      return Result.ok({ impacts: [], filesChanged: 0, symbolsAffected: 0, breakingChanges: 0 });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}
