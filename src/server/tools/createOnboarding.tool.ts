import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const createOnboardingSchema = {
  topic: z.string().describe("Topic to generate learning path for"),
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerCreateOnboardingTool(server: McpServer, deps: ServerDependencies): void {
  const { ragIndex } = deps;

  server.registerTool(
    "createOnboarding",
    {
      description: "Generate learning paths using RAG",
      inputSchema: createOnboardingSchema,
    },
    async ({ topic, docsDir }) => {
      try {
        if (ragIndex.chunkCount() === 0) {
          await ragIndex.indexDocs(docsDir);
        }
        const results = await ragIndex.search(topic, 10);

        const path = results
          .map(
            (r, i) =>
              `${i + 1}. ${r.source} (score: ${(r.score * 100).toFixed(0)}%)\n   ${r.content.slice(0, 200)}...`,
          )
          .join("\n\n");

        return mcpSuccess(`Learning path for "${topic}":\n\n${path}`);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
