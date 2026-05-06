import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LayerSchema, SymbolKindSchema } from "../../indexer/symbol.types.js";
import type { ServerDependencies } from "../types.js";
import { mcpError, mcpSuccess } from "../types.js";

export const searchSymbolsSchema = {
  query: z.string().optional().describe("Partial symbol name or qualified name to search"),
  kind: SymbolKindSchema.optional().describe("Filter by symbol kind"),
  layer: LayerSchema.optional().describe("Filter by architectural layer"),
  limit: z.number().default(20).describe("Maximum number of symbols to return"),
};

export function registerSearchSymbolsTool(server: McpServer, deps: ServerDependencies): void {
  const { symbolRepo } = deps;

  server.registerTool(
    "searchSymbols",
    {
      description: "Search indexed symbols by partial name, kind, or architectural layer.",
      inputSchema: searchSymbolsSchema,
    },
    async ({ query, kind, layer, limit }) => {
      try {
        const symbols = symbolRepo.search({ query, kind, layer, limit });
        if (symbols.length === 0) {
          return mcpSuccess("Nenhum símbolo encontrado.");
        }

        const lines = symbols.map((symbol) => {
          const name = symbol.qualifiedName ?? symbol.name;
          const summary = symbol.summary ? ` — ${symbol.summary}` : "";
          return `- ${name} (${symbol.kind}) @ ${symbol.file}:${symbol.startLine}${summary}`;
        });

        return mcpSuccess(lines.join("\n"));
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
