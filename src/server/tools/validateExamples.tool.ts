import { z } from "zod";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const validateExamplesSchema = {
  docsDir: z.string().default("docs").describe("Docs directory"),
  docPath: z.string().optional().describe("Specific doc file to validate (optional)"),
};

export function registerValidateExamplesTool(server: McpServer, deps: ServerDependencies): void {
  const { codeExampleValidator } = deps;

  server.registerTool(
    "validateExamples",
    {
      description: "Validate code examples in documentation against real code",
      inputSchema: validateExamplesSchema,
    },
    async ({ docsDir, docPath }) => {
      try {
        let results;
        if (docPath) {
          results = await codeExampleValidator.validateDoc(path.join(docsDir, docPath));
        } else {
          results = await codeExampleValidator.validateAll(docsDir);
        }

        const report = results
          .map((r) => {
            const status = r.valid ? "✅ PASS" : "❌ FAIL";
            const error = r.error ? ` - ${r.error}` : "";
            return `${status} ${r.docPath}:${r.example.lineStart}-${r.example.lineEnd} (${r.example.language})${error}`;
          })
          .join("\n");

        const summary = `${results.filter((r) => r.valid).length}/${results.length} examples passed validation.`;

        return mcpSuccess(`${summary}\n\n${report || "No code examples found."}`);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
