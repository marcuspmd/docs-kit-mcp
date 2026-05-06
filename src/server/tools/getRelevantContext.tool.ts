import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { buildRelevantContext } from "../../knowledge/contextBuilder.js";

export const getRelevantContextSchema = {
  symbol: z.string().optional().describe("Symbol name to get context for"),
  file: z.string().optional().describe("File path to get context for"),
  docsDir: z.string().default("docs").describe("Docs directory"),
  mode: z.enum(["compact", "full"]).default("compact").describe("Context detail level"),
  maxSourceLines: z.number().default(80).describe("Maximum source lines to include in full mode"),
  maxDocChars: z.number().optional().describe("Maximum characters to include from each mapped doc"),
  maxContextChars: z.number().default(20_000).describe("Maximum total context characters"),
};

export function registerGetRelevantContextTool(server: McpServer, deps: ServerDependencies): void {
  const { config, registry, symbolRepo, graph, llm } = deps;

  server.registerTool(
    "getRelevantContext",
    {
      description:
        "Get comprehensive context for understanding or modifying a symbol or file — combines index, graph, docs, and source code",
      inputSchema: getRelevantContextSchema,
    },
    async ({
      symbol: symbolName,
      file: filePath,
      docsDir,
      mode,
      maxSourceLines,
      maxDocChars,
      maxContextChars,
    }) => {
      try {
        if (!symbolName && !filePath) {
          return {
            content: [{ type: "text" as const, text: "Provide either symbol or file parameter." }],
            isError: true,
          };
        }

        const result = await buildRelevantContext(
          { symbolName, filePath, mode, maxSourceLines, maxDocChars, maxContextChars },
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

        return mcpSuccess(result.text);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
