import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { relationshipRowsToSymbolRelationships } from "../../storage/db.js";
import { formatEventFlowsAsMermaid } from "../../events/eventFlowAnalyzer.js";

export function registerGenerateEventFlowTool(server: McpServer, deps: ServerDependencies): void {
  const { symbolRepo, relRepo, eventFlowAnalyzer } = deps;

  server.registerTool(
    "generateEventFlow",
    { description: "Simulate event flows and listeners" },
    async () => {
      try {
        const allSymbols = symbolRepo.findAll();
        const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
        const flows = eventFlowAnalyzer.analyze(allSymbols, allRels);
        const diagram = formatEventFlowsAsMermaid(flows);

        return mcpSuccess(`\`\`\`mermaid\n${diagram}\n\`\`\``);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
