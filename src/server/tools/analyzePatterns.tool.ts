import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { relationshipRowsToSymbolRelationships } from "../../storage/db.js";

export function registerAnalyzePatternsTool(server: McpServer, deps: ServerDependencies): void {
  const { symbolRepo, relRepo, patternAnalyzer } = deps;

  server.registerTool(
    "analyzePatterns",
    {
      description: "Detect patterns and violations (SOLID, etc.), generate reports",
    },
    async () => {
      try {
        const allSymbols = symbolRepo.findAll();
        const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
        const patterns = patternAnalyzer.analyze(allSymbols, allRels);

        const report = patterns
          .map((p) => {
            const symbolNames = p.symbols
              .map((id) => allSymbols.find((s) => s.id === id)?.name || id)
              .join(", ");
            const violations = p.violations.map((v) => `- ${v}`).join("\n");
            return `**${p.kind.toUpperCase()}** (confidence: ${(p.confidence * 100).toFixed(0)}%)\nSymbols: ${symbolNames}\nViolations:\n${violations || "None"}`;
          })
          .join("\n\n");

        return mcpSuccess(report || "No patterns detected.");
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
