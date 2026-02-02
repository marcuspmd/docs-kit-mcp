import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const askKnowledgeBaseSchema = {
  question: z.string().describe("Question to ask the knowledge base"),
  docsDir: z.string().default("docs").describe("Docs directory"),
};

export function registerAskKnowledgeBaseTool(server: McpServer, deps: ServerDependencies): void {
  const { ragIndex, llm } = deps;

  server.registerTool(
    "askKnowledgeBase",
    {
      description: "Conversational Q&A on code + docs",
      inputSchema: askKnowledgeBaseSchema,
    },
    async ({ question, docsDir }) => {
      try {
        if (ragIndex.chunkCount() === 0) {
          await ragIndex.indexDocs(docsDir);
        }
        const results = await ragIndex.search(question, 5);
        const context = results.map((r) => `${r.source}:\n${r.content}`).join("\n\n");

        const prompt = `Based on the following context, answer the question. If the context doesn't contain enough information, say so.\n\nContext:\n${context}\n\nQuestion: ${question}`;

        const answer =
          (await llm.chat([{ role: "user", content: prompt }])) || "No answer generated.";

        return mcpSuccess(answer);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
