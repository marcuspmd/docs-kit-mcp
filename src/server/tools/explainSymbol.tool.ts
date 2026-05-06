import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { buildExplainSymbolContext, cacheSymbolExplanation } from "../../handlers/explainSymbol.js";
import { buildExplainSymbolPromptForMcp } from "../../prompts/explainSymbol.prompt.js";

export const explainSymbolSchema = {
  symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerExplainSymbolTool(server: McpServer, deps: ServerDependencies): void {
  const { config, registry, symbolRepo, graph } = deps;

  server.registerTool(
    "explainSymbol",
    {
      description:
        "Get the prompt to explain a code symbol. The AI should analyze the prompt and call updateSymbolExplanation with the result.",
      inputSchema: explainSymbolSchema,
    },
    async ({ symbol: symbolName, docsDir }) => {
      try {
        await registry.rebuild(docsDir);
        const result = await buildExplainSymbolContext(symbolName, {
          projectRoot: config.projectRoot,
          docsDir,
          registry,
          symbolRepo,
          graph,
        });

        if (!result.found) {
          return mcpSuccess(`No symbol or documentation found for: ${symbolName}`);
        }

        // Return cached explanation if available and valid
        if (result.cachedExplanation && !result.needsUpdate) {
          return mcpSuccess(`## Cached Explanation (still valid)\n\n${result.cachedExplanation}`);
        }

        // Build prompt with instruction to call updateSymbolExplanation
        if (!result.symbol) {
          return mcpSuccess(result.prompt);
        }

        // Build prompt for MCP with update instructions
        const prompt = buildExplainSymbolPromptForMcp(
          {
            symbol: result.symbol,
            sourceCode: result.sourceCode,
            dependencies: result.dependencies,
            dependents: result.dependents,
            outputLanguage: config.outputLanguage,
            verbosity: config.promptVerbosity,
          },
          result.cachedExplanation,
        );

        return mcpSuccess(prompt);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}

export const updateSymbolExplanationSchema = {
  symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
  explanation: z.string().describe("The generated explanation to cache"),
};

export function registerUpdateSymbolExplanationTool(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const { config, symbolRepo } = deps;

  server.registerTool(
    "updateSymbolExplanation",
    {
      description:
        "Update the cached explanation for a symbol. Call this after generating an explanation via explainSymbol.",
      inputSchema: updateSymbolExplanationSchema,
    },
    async ({ symbol: symbolName, explanation }) => {
      try {
        const symbols = symbolRepo.findByName(symbolName);
        if (symbols.length === 0) {
          return mcpSuccess(`Symbol not found: ${symbolName}`);
        }

        const sym = symbols[0];
        await cacheSymbolExplanation(symbolRepo, sym, explanation, config.projectRoot);

        return mcpSuccess(`✓ Explanation cached for ${symbolName}`);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
