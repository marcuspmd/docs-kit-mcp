import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import type { ISymbolRepository } from "../../domain/repositories/ISymbolRepository.js";
import type { IRelationshipRepository } from "../../domain/repositories/IRelationshipRepository.js";
import type { ExplainSymbolInput, ExplainSymbolOutput } from "../dtos/symbol.dto.js";
import { SymbolMapper } from "../mappers/SymbolMapper.js";
import { EntityNotFoundError } from "../../../../@shared/errors/DomainErrors.js";
import type { ILlmProvider } from "../../../../@shared/types/llm.js";
import * as fs from "node:fs";

/**
 * ExplainSymbol Use Case
 *
 * Generates an AI-powered explanation for a symbol.
 */
export class ExplainSymbolUseCase implements UseCase<ExplainSymbolInput, ExplainSymbolOutput> {
  constructor(
    private readonly symbolRepo: ISymbolRepository,
    private readonly relationshipRepo: IRelationshipRepository,
    private readonly llmProvider?: ILlmProvider,
  ) {}

  async execute(input: ExplainSymbolInput): Promise<Result<ExplainSymbolOutput>> {
    try {
      // Find symbol by name
      const symbols = this.symbolRepo.findByName(input.symbolName);
      if (symbols.length === 0) {
        return Result.fail(new EntityNotFoundError("Symbol", input.symbolName));
      }

      const symbol = symbols[0];
      const symbolDto = SymbolMapper.toDto(symbol);

      // Check if explanation already exists and is valid
      if (symbol.explanation && !input.forceRegenerate) {
        return Result.ok({
          symbol: symbolDto,
          explanation: symbol.explanation,
        });
      }

      // Get source code
      let sourceCode: string | undefined;
      try {
        const content = fs.readFileSync(symbol.file, "utf-8");
        const lines = content.split("\n");
        sourceCode = lines.slice(symbol.startLine - 1, symbol.endLine).join("\n");
      } catch {
        // File may not be accessible
      }

      // Get relationships
      const sourceRels = this.relationshipRepo.findBySource(symbol.id);
      const targetRels = this.relationshipRepo.findByTarget(symbol.id);

      const callerIds = targetRels.filter((r) => r.type === "calls").map((r) => r.sourceId);
      const calleeIds = sourceRels.filter((r) => r.type === "calls").map((r) => r.targetId);
      const implementorIds = targetRels
        .filter((r) => r.type === "implements")
        .map((r) => r.sourceId);

      const callers = this.symbolRepo.findByIds(callerIds);
      const callees = this.symbolRepo.findByIds(calleeIds);
      const implementors = this.symbolRepo.findByIds(implementorIds);

      // Generate explanation via LLM if available
      let explanation = symbol.explanation ?? "No explanation available.";
      if (this.llmProvider && (input.forceRegenerate || !symbol.explanation)) {
        const prompt = this.buildExplainPrompt(symbol, sourceCode, callers, callees);
        const response = await this.llmProvider.complete(prompt);
        explanation = response;

        // Update symbol with explanation (would need to save back)
        // This is handled by the repository in a separate transaction
      }

      return Result.ok({
        symbol: symbolDto,
        explanation,
        sourceCode,
        relationships: {
          callers: SymbolMapper.toDtoList(callers),
          callees: SymbolMapper.toDtoList(callees),
          implementors: SymbolMapper.toDtoList(implementors),
        },
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  private buildExplainPrompt(
    symbol: { name: string; kind: string; file: string; docComment?: string },
    sourceCode?: string,
    callers?: { name: string }[],
    callees?: { name: string }[],
  ): string {
    let prompt = `Explain the following ${symbol.kind} "${symbol.name}" from ${symbol.file}:\n\n`;

    if (symbol.docComment) {
      prompt += `Documentation:\n${symbol.docComment}\n\n`;
    }

    if (sourceCode) {
      prompt += `Source code:\n\`\`\`\n${sourceCode}\n\`\`\`\n\n`;
    }

    if (callers && callers.length > 0) {
      prompt += `Called by: ${callers.map((c) => c.name).join(", ")}\n`;
    }

    if (callees && callees.length > 0) {
      prompt += `Calls: ${callees.map((c) => c.name).join(", ")}\n`;
    }

    prompt += "\nProvide a clear, concise explanation of what this code does and its purpose.";

    return prompt;
  }
}
