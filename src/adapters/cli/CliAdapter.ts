import type { IndexProjectUseCase } from "../../modules/symbol/application/use-cases/IndexProject.usecase.js";
import type { FindSymbolUseCase } from "../../modules/symbol/application/use-cases/FindSymbol.usecase.js";
import type { ExplainSymbolUseCase } from "../../modules/symbol/application/use-cases/ExplainSymbol.usecase.js";
import type { BuildDocsUseCase } from "../../modules/documentation/application/use-cases/BuildDocs.usecase.js";
import type { BuildSiteUseCase } from "../../modules/documentation/application/use-cases/BuildSite.usecase.js";

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
          rootPath: (args.path as string) ?? ".",
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
      },
      execute: async (args) => {
        const result = await this.deps.buildSite.execute({
          rootPath: (args.path as string) ?? ".",
          outputDir: (args.output as string) ?? "docs-site",
        });
        if (result.isSuccess) {
          console.log(`Generated ${result.value.pagesGenerated} pages`);
        } else {
          console.error("Build failed:", result.error.message);
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

    const parsedArgs = this.parseArgs(args.slice(1), cmd.options ?? {});
    await cmd.execute(parsedArgs);
  }

  private parseArgs(args: string[], options: CliCommand["options"]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, opt] of Object.entries(options ?? {})) {
      result[key] = opt.default;
    }
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--")) {
        const key = arg.slice(2);
        result[key] = args[++i] ?? true;
      } else if (arg.startsWith("-")) {
        const alias = arg.slice(1);
        const entry = Object.entries(options ?? {}).find(([, o]) => o.alias === alias);
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
