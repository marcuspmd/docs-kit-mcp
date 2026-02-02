import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const buildTraceabilityMatrixSchema = {
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerBuildTraceabilityMatrixTool(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const { config, registry, contextMapper } = deps;

  server.registerTool(
    "buildTraceabilityMatrix",
    {
      description: "Build Requirements Traceability Matrix from commits and comments",
      inputSchema: buildTraceabilityMatrixSchema,
    },
    async ({ docsDir }) => {
      try {
        await registry.rebuild(docsDir);
        const refs = await contextMapper.extractRefs(config.projectRoot);
        const rtm = await contextMapper.buildRTM(refs, registry);

        const report = rtm
          .map((entry) => {
            const symbols = entry.symbols.join(", ");
            const tests = entry.tests.join(", ");
            const docs = entry.docs.join(", ");
            return `**${entry.ticketId}**\n- Symbols: ${symbols || "None"}\n- Tests: ${tests || "None"}\n- Docs: ${docs || "None"}`;
          })
          .join("\n\n");

        return mcpSuccess(report || "No traceability entries found.");
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
