import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpError, mcpSuccess } from "../types.js";

export const getFileOutlineSchema = {
  file: z.string().describe("File path to outline"),
};

export function registerGetFileOutlineTool(server: McpServer, deps: ServerDependencies): void {
  const { symbolRepo } = deps;

  server.registerTool(
    "getFileOutline",
    {
      description: "Get a compact map of indexed symbols in a file without source code.",
      inputSchema: getFileOutlineSchema,
    },
    async ({ file }) => {
      try {
        const symbols = symbolRepo.findByFile(file);
        if (symbols.length === 0) {
          return mcpSuccess(`No symbols indexed for: ${file}`);
        }

        const lines = symbols.map((symbol) => {
          const name = symbol.qualifiedName ?? symbol.name;
          const signature = symbol.signature ? `: ${symbol.signature}` : "";
          const summary = symbol.summary ? ` // ${symbol.summary}` : "";
          return `L${symbol.startLine}-${symbol.endLine} [${symbol.kind}] ${name}${signature}${summary}`;
        });

        return mcpSuccess(`# ${file}\n\n${lines.join("\n")}`);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
