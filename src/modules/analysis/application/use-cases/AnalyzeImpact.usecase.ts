import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import { ChangeImpact } from "../../domain/entities/ChangeImpact.js";
import type { ISymbolRepository } from "../../../symbol/domain/repositories/ISymbolRepository.js";
import type { IRelationshipRepository } from "../../../symbol/domain/repositories/IRelationshipRepository.js";
import { GitDiffParser } from "../../infrastructure/GitDiffParser.js";
import { AstDiffAnalyzer } from "../../infrastructure/AstDiffAnalyzer.js";

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

/**
 * AnalyzeImpact Use Case
 *
 * Analyzes the impact of code changes between two git refs.
 * Detects semantic changes using AST diff and calculates impact radius.
 */
export class AnalyzeImpactUseCase implements UseCase<AnalyzeImpactInput, AnalyzeImpactOutput> {
  constructor(
    private readonly symbolRepo: ISymbolRepository,
    private readonly relationshipRepo: IRelationshipRepository,
    private readonly gitDiffParser: GitDiffParser,
    private readonly astDiffAnalyzer: AstDiffAnalyzer,
  ) {}

  async execute(input: AnalyzeImpactInput): Promise<Result<AnalyzeImpactOutput>> {
    try {
      const impacts: ChangeImpact[] = [];

      // Get git diff
      const fileDiffs = await this.gitDiffParser.getDiff(
        input.baseBranch,
        input.targetBranch,
        input.rootPath,
      );

      if (fileDiffs.length === 0) {
        return Result.ok({
          impacts: [],
          filesChanged: 0,
          symbolsAffected: 0,
          breakingChanges: 0,
        });
      }

      // Analyze each changed file
      for (const fileDiff of fileDiffs) {
        // Skip non-source files
        if (!this.isSourceFile(fileDiff.filePath)) {
          continue;
        }

        try {
          // Get old content
          const oldContent = await this.astDiffAnalyzer.getOldFileContent(
            fileDiff.filePath,
            input.baseBranch,
          );

          // Analyze AST changes
          const symbolChanges = await this.astDiffAnalyzer.analyzeFileChanges(
            fileDiff.filePath,
            oldContent,
          );

          // Convert to ChangeImpact entities
          for (const change of symbolChanges) {
            // Calculate impact radius (symbols that depend on this one)
            const directImpacts = this.relationshipRepo
              .findBySource(change.symbol.id)
              .map((rel) => rel.targetId);

            const indirectImpacts = this.calculateIndirectImpacts(directImpacts, 2);

            const impact = ChangeImpact.create({
              symbolId: change.symbol.id,
              symbolName: change.symbol.name,
              changeType: change.changeType,
              diff: change.diff,
              breakingChange: change.breakingChange,
              severity: change.severity,
              docUpdateRequired: this.requiresDocUpdate(change.changeType),
              directImpacts,
              indirectImpacts,
              reason: change.reason,
            });

            impacts.push(impact);
          }
        } catch (error) {
          console.error(`Failed to analyze file ${fileDiff.filePath}:`, error);
        }
      }

      // Calculate statistics
      const breakingChanges = impacts.filter((i) => i.breakingChange).length;
      const symbolsAffected = new Set(impacts.map((i) => i.symbolId)).size;

      return Result.ok({
        impacts,
        filesChanged: fileDiffs.length,
        symbolsAffected,
        breakingChanges,
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  /**
   * Check if file is a source file we can analyze
   */
  private isSourceFile(filePath: string): boolean {
    const sourceExtensions = [".ts", ".js", ".tsx", ".jsx", ".php", ".py", ".go"];
    return sourceExtensions.some((ext) => filePath.endsWith(ext));
  }

  /**
   * Determine if a change type requires documentation update
   */
  private requiresDocUpdate(changeType: string): boolean {
    return ["added", "signature_changed", "removed", "behavior_changed"].includes(changeType);
  }

  /**
   * Calculate indirect impacts (transitive dependencies)
   */
  private calculateIndirectImpacts(directImpacts: string[], depth: number): string[] {
    if (depth === 0 || directImpacts.length === 0) {
      return [];
    }

    const indirect: Set<string> = new Set();

    for (const symbolId of directImpacts) {
      const nextLevel = this.relationshipRepo.findBySource(symbolId).map((rel) => rel.targetId);

      nextLevel.forEach((id: string) => indirect.add(id));
    }

    const indirectArray = Array.from(indirect);

    // Recursively calculate next level
    if (depth > 1) {
      const deeper = this.calculateIndirectImpacts(indirectArray, depth - 1);
      deeper.forEach((id) => indirect.add(id));
    }

    return Array.from(indirect);
  }
}
