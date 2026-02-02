import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const scanForDeadCodeSchema = {
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerScanForDeadCodeTool(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const { registry, symbolRepo, graph, reaper } = deps;

  server.registerTool(
    "scanForDeadCode",
    {
      description: "Scan for dead code, orphan docs, and broken links",
      inputSchema: scanForDeadCodeSchema,
    },
    async ({ docsDir }) => {
      try {
        await registry.rebuild(docsDir);
        const allSymbols = symbolRepo.findAll();
        const mappings = await registry.findAllMappings();
        const findings = reaper.scan(allSymbols, graph, mappings);

        const report = findings
          .map(
            (f) =>
              `[${f.type.toUpperCase()}] ${f.target}: ${f.reason} (suggested: ${f.suggestedAction})`,
          )
          .join("\n");

        return mcpSuccess(report || "No dead code or orphan docs found.");
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
