import type { IndexProjectUseCase } from "../../modules/symbol/application/use-cases/IndexProject.usecase.js";
import type { FindSymbolUseCase } from "../../modules/symbol/application/use-cases/FindSymbol.usecase.js";
import type { ExplainSymbolUseCase } from "../../modules/symbol/application/use-cases/ExplainSymbol.usecase.js";
import type { BuildDocsUseCase } from "../../modules/documentation/application/use-cases/BuildDocs.usecase.js";
import type { BuildSiteUseCase } from "../../modules/documentation/application/use-cases/BuildSite.usecase.js";
import type { AnalyzeImpactUseCase } from "../../modules/analysis/application/use-cases/AnalyzeImpact.usecase.js";

export interface CliCommand {
  name: string;
  description: string;
  options?: Record<
    string,
    { alias?: string; description: string; required?: boolean; default?: unknown }
  >;
  execute(args: Record<string, unknown>): Promise<void>;
}

export interface CliAdapterDeps {
  indexProject: IndexProjectUseCase;
  findSymbol: FindSymbolUseCase;
  explainSymbol: ExplainSymbolUseCase;
  buildDocs: BuildDocsUseCase;
  buildSite: BuildSiteUseCase;
  analyzeImpact: AnalyzeImpactUseCase;
}

/**
 * CLI Adapter
 *
 * Adapts use cases for CLI consumption.
 */
export class CliAdapter {
  private commands: Map<string, CliCommand> = new Map();

  constructor(private readonly deps: CliAdapterDeps) {
    this.registerCommands();
  }

  private registerCommands(): void {
    this.commands.set("index", {
      name: "index",
      description: "Index project symbols",
      options: {
        path: { alias: "p", description: "Root path to index", default: "." },
        rebuild: { alias: "r", description: "Force full rebuild", default: false },
      },
      execute: async (args) => {
        const result = await this.deps.indexProject.execute({
          rootPath: args.path as string,
          fullRebuild: args.rebuild as boolean,
        });
        if (result.isSuccess) {
          console.log(
            `Indexed ${result.value.symbolsFound} symbols from ${result.value.filesProcessed} files`,
          );
        } else {
          console.error("Index failed:", result.error.message);
        }
      },
    });

    this.commands.set("build-site", {
      name: "build-site",
      description: "Build documentation site",
      options: {
        path: { alias: "p", description: "Root path", default: "." },
        output: { alias: "o", description: "Output directory", default: "docs-site" },
        db: { alias: "d", description: "Database path", default: ".docs-kit/index.db" },
      },
      execute: async (args) => {
        const result = await this.deps.buildSite.execute({
          dbPath: args.db as string,
          outputDir: args.output as string,
          rootPath: args.path as string,
        });
        if (result.isSuccess) {
          console.log(`✅ Site generated successfully!`);
          console.log(`   Symbol pages: ${result.value.symbolPages}`);
          console.log(`   File pages: ${result.value.filePages}`);
          console.log(`   Total files: ${result.value.totalFiles}`);
          console.log(`   Doc entries: ${result.value.docEntries}`);
          console.log(`   Output: ${result.value.outputPath}`);
        } else {
          console.error("Build failed:", result.error.message);
        }
      },
    });

    this.commands.set("build-docs", {
      name: "build-docs",
      description: "Generate documentation for symbols",
      options: {
        path: { alias: "p", description: "Root path", default: "." },
        output: { alias: "o", description: "Output directory", default: "docs-output" },
      },
      execute: async (args) => {
        const result = await this.deps.buildDocs.execute({
          rootPath: args.path as string,
          outputDir: args.output as string,
        });
        if (result.isSuccess) {
          console.log(
            `Generated ${result.value.filesGenerated} files documenting ${result.value.symbolsDocumented} symbols`,
          );
          if (result.value.errors.length > 0) {
            console.warn(`Encountered ${result.value.errors.length} errors`);
          }
        } else {
          console.error("Build docs failed:", result.error.message);
        }
      },
    });

    this.commands.set("analyze-impact", {
      name: "analyze-impact",
      description: "Analyze impact of code changes",
      options: {
        base: { alias: "b", description: "Base branch/ref", required: true },
        target: { alias: "t", description: "Target branch/ref (default: current)" },
        path: { alias: "p", description: "Root path", default: "." },
      },
      execute: async (args) => {
        const result = await this.deps.analyzeImpact.execute({
          baseBranch: args.base as string,
          targetBranch: args.target as string | undefined,
          rootPath: args.path as string,
        });
        if (result.isSuccess) {
          console.log(`\nImpact Analysis:`);
          console.log(`  Files changed: ${result.value.filesChanged}`);
          console.log(`  Symbols affected: ${result.value.symbolsAffected}`);
          console.log(`  Breaking changes: ${result.value.breakingChanges}`);
          console.log(`\nImpacts:`);
          for (const impact of result.value.impacts.slice(0, 10)) {
            console.log(`  - ${impact.symbolName} (${impact.changeType}) - ${impact.severity}`);
            if (impact.reason) {
              console.log(`    ${impact.reason}`);
            }
          }
          if (result.value.impacts.length > 10) {
            console.log(`  ... and ${result.value.impacts.length - 10} more`);
          }
        } else {
          console.error("Analysis failed:", result.error.message);
        }
      },
    });

    this.commands.set("explain", {
      name: "explain",
      description: "Explain a symbol",
      options: {
        name: { alias: "n", description: "Symbol name", required: true },
        force: { alias: "f", description: "Force regenerate", default: false },
      },
      execute: async (args) => {
        const result = await this.deps.explainSymbol.execute({
          symbolName: args.name as string,
          forceRegenerate: args.force as boolean,
        });
        if (result.isSuccess) {
          console.log(result.value.explanation);
        } else {
          console.error("Explain failed:", result.error.message);
        }
      },
    });
  }

  async run(args: string[]): Promise<void> {
    const command = args[0];
    if (!command || command === "--help" || command === "-h") {
      this.showHelp();
      return;
    }

    const cmd = this.commands.get(command);
    if (!cmd) {
      console.error(`Unknown command: ${command}`);
      this.showHelp();
      process.exit(1);
    }

    const parsedArgs = this.parseArgs(args.slice(1), cmd.options);
    await cmd.execute(parsedArgs);
  }

  private parseArgs(args: string[], options: CliCommand["options"]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (!options) return result;
    for (const [key, opt] of Object.entries(options)) {
      result[key] = opt.default;
    }
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--")) {
        const key = arg.slice(2);
        result[key] = args[++i] ?? true;
      } else if (arg.startsWith("-")) {
        const alias = arg.slice(1);
        const entry = Object.entries(options).find(([, o]) => o.alias === alias);
        if (entry) result[entry[0]] = args[++i] ?? true;
      }
    }
    return result;
  }

  private showHelp(): void {
    console.log("docs-kit - Code Documentation Agent\n");
    console.log("Commands:");
    for (const [name, cmd] of this.commands) {
      console.log(`  ${name.padEnd(15)} ${cmd.description}`);
    }
  }
}
