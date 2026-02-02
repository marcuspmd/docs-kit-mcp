import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { generateMermaid } from "../../docs/mermaidGenerator.js";
import { relationshipRowsToSymbolRelationships } from "../../storage/db.js";

export const generateMermaidSchema = {
  symbols: z.string().describe("Comma-separated symbol names"),
  type: z
    .enum(["classDiagram", "sequenceDiagram", "flowchart"])
    .default("classDiagram")
    .describe("Diagram type"),
};

export function registerGenerateMermaidTool(server: McpServer, deps: ServerDependencies): void {
  const { symbolRepo, relRepo } = deps;

  server.registerTool(
    "generateMermaid",
    {
      description: "Generate Mermaid diagram for given symbols",
      inputSchema: generateMermaidSchema,
    },
    async ({ symbols: symbolsStr, type: diagramType }) => {
      try {
        const symbolNames = symbolsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const allSymbols = symbolRepo.findAll();
        const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
        const diagram = generateMermaid(
          { symbols: symbolNames, type: diagramType },
          allSymbols,
          allRels,
        );

        return mcpSuccess(`\`\`\`mermaid\n${diagram}\n\`\`\``);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
