import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import type { ISymbolRepository } from "../../../symbol/domain/repositories/ISymbolRepository.js";
import type { ILlmProvider } from "../../../llm/domain/ILlmProvider.js";
import type { CodeSymbol } from "../../../symbol/domain/entities/CodeSymbol.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface BuildDocsInput {
  rootPath: string;
  outputDir: string;
  symbolIds?: string[];
}

export interface BuildDocsOutput {
  filesGenerated: number;
  symbolsDocumented: number;
  errors: string[];
}

/**
 * BuildDocs Use Case
 *
 * Generates documentation for indexed symbols using LLM.
 */
export class BuildDocsUseCase implements UseCase<BuildDocsInput, BuildDocsOutput> {
  constructor(
    private readonly symbolRepo: ISymbolRepository,
    private readonly llmProvider?: ILlmProvider,
  ) {}

  async execute(input: BuildDocsInput): Promise<Result<BuildDocsOutput>> {
    try {
      const errors: string[] = [];
      let filesGenerated = 0;
      let symbolsDocumented = 0;

      // Get symbols to document
      const symbolsToDocument = input.symbolIds
        ? this.symbolRepo.findByIds(input.symbolIds)
        : this.symbolRepo.findAll();

      if (symbolsToDocument.length === 0) {
        return Result.ok({
          filesGenerated: 0,
          symbolsDocumented: 0,
          errors: ["No symbols found to document"],
        });
      }

      // Group symbols by file/module
      const symbolsByFile = new Map<string, typeof symbolsToDocument>();
      for (const symbol of symbolsToDocument) {
        const symbols = symbolsByFile.get(symbol.file) || [];
        symbols.push(symbol);
        symbolsByFile.set(symbol.file, symbols);
      }

      // Generate documentation for each file
      for (const [filePath, symbols] of symbolsByFile) {
        try {
          const docContent = await this.generateFileDocumentation(filePath, symbols);

          // Write documentation file
          const docPath = this.getDocPath(input.outputDir, filePath);
          const docDir = dirname(docPath);

          if (!existsSync(docDir)) {
            mkdirSync(docDir, { recursive: true });
          }

          writeFileSync(docPath, docContent, "utf-8");
          filesGenerated++;
          symbolsDocumented += symbols.length;
        } catch (error) {
          errors.push(
            `Failed to generate docs for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return Result.ok({
        filesGenerated,
        symbolsDocumented,
        errors,
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  /**
   * Generate documentation content for a file
   */
  private async generateFileDocumentation(
    filePath: string,
    symbols: CodeSymbol[],
  ): Promise<string> {
    let content = `# ${filePath}\n\n`;
    content += `> Generated documentation for ${symbols.length} symbols\n\n`;

    // Read source file
    let sourceContent: string | undefined;
    try {
      sourceContent = readFileSync(filePath, "utf-8");
    } catch {
      // File may not be accessible
    }

    // Document each symbol
    for (const symbol of symbols) {
      content += `## ${symbol.name}\n\n`;
      content += `**Kind:** \`${symbol.kind}\`\n\n`;

      if (symbol.qualifiedName) {
        content += `**Qualified Name:** \`${symbol.qualifiedName}\`\n\n`;
      }

      if (symbol.signature) {
        content += `**Signature:**\n\`\`\`typescript\n${symbol.signature.toValue()}\n\`\`\`\n\n`;
      }

      // Use existing documentation or generate with LLM
      if (symbol.docComment) {
        content += `${symbol.docComment}\n\n`;
      } else if (this.llmProvider && sourceContent) {
        try {
          const sourceLines = sourceContent.split("\n");
          const symbolSource = sourceLines.slice(symbol.startLine - 1, symbol.endLine).join("\n");

          const explanation = await this.llmProvider.chat([
            {
              role: "system",
              content:
                "You are a technical documentation writer. Generate clear, concise documentation for code symbols.",
            },
            {
              role: "user",
              content: `Provide documentation for this ${symbol.kind}:\n\n\`\`\`\n${symbolSource}\n\`\`\``,
            },
          ]);

          content += `${explanation}\n\n`;
        } catch (error) {
          content += `*Error generating documentation: ${error instanceof Error ? error.message : String(error)}*\n\n`;
        }
      } else {
        content += `*No documentation available*\n\n`;
      }

      content += "---\n\n";
    }

    return content;
  }

  /**
   * Get documentation file path for a source file
   */
  private getDocPath(outputDir: string, filePath: string): string {
    // Convert src/modules/foo/bar.ts -> docs/files/src--modules--foo--bar.md
    const normalized = filePath.replace(/\//g, "--").replace(/\\/g, "--").replace(/\.ts$/, ".md");
    return join(outputDir, "files", normalized);
  }
}
