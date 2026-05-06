/**
 * inspect use case — show context quality metrics for a symbol or file in the terminal
 */
import "reflect-metadata";
import { createServerDependencies } from "../../server/dependencies.js";
import { buildRelevantContext } from "../../knowledge/contextBuilder.js";

export interface InspectUseCaseInput {
  symbolName?: string;
  filePath?: string;
  docsDir?: string;
  mode?: "compact" | "full";
  verbose?: boolean;
}

export async function inspectUseCase(input: InspectUseCaseInput): Promise<void> {
  const { symbolName, filePath, docsDir = "docs", mode = "full", verbose = false } = input;

  if (!symbolName && !filePath) {
    console.error("Usage: docs-kit inspect <symbol> [--file path] [--verbose]");
    process.exit(1);
  }

  const deps = await createServerDependencies(process.cwd());
  const { config, registry, symbolRepo, graph, llm } = deps;

  const t0 = Date.now();
  const result = await buildRelevantContext(
    { symbolName, filePath, mode },
    {
      projectRoot: config.projectRoot,
      docsDir,
      registry,
      symbolRepo,
      graph,
      estimateTokens:
        typeof llm.estimateTokens === "function" ? llm.estimateTokens.bind(llm) : undefined,
    },
  );
  const elapsedMs = Date.now() - t0;

  const text = result.text;
  const tokenEstimate =
    typeof llm.estimateTokens === "function"
      ? llm.estimateTokens(text)
      : Math.ceil(text.length / 4);

  const hasDocs = text.includes("## Documentation");
  const hasSource = text.includes("## Source Code");
  const hasRelationships = text.includes("## Dependencies") || text.includes("## Dependents");

  const tick = (v: boolean) => (v ? "✓" : "✗");

  const label = symbolName ?? filePath!;
  console.log("");
  console.log(`Symbol:  ${label}`);
  console.log(`Found:   ${result.found ? "yes" : "no"}`);
  console.log(`---`);
  console.log(
    `Tokens:  ~${tokenEstimate}   Chars: ${text.length.toLocaleString()}   Elapsed: ${elapsedMs}ms`,
  );
  console.log(
    `Docs: ${tick(hasDocs)}   Source: ${tick(hasSource)}   Relationships: ${tick(hasRelationships)}`,
  );

  if (verbose || !result.found) {
    console.log("");
    console.log("--- Context ---");
    console.log(text);
  } else {
    const preview = text.slice(0, 500);
    console.log("");
    console.log("--- Context Preview (use --verbose for full output) ---");
    console.log(preview);
    if (text.length > 500) console.log(`… (${text.length - 500} more chars)`);
  }
}
