import { z } from "zod";
import * as path from "node:path";
import { readFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";

export const describeInBusinessTermsSchema = {
  symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
  docsDir: z.string().default("docs").describe("Docs directory for existing doc context"),
};

export function registerDescribeInBusinessTermsTool(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const { config, registry, symbolRepo, businessTranslator } = deps;

  server.registerTool(
    "describeInBusinessTerms",
    {
      description:
        "Describe a code symbol in business terms (rules, if/else, outcomes) for product/compliance",
      inputSchema: describeInBusinessTermsSchema,
    },
    async ({ symbol: symbolName, docsDir }) => {
      try {
        await registry.rebuild(docsDir);
        const symbols = symbolRepo.findByName(symbolName);
        if (symbols.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No symbol found: ${symbolName}` }],
            isError: true,
          };
        }
        const sym = symbols[0];
        const filePath = path.resolve(config.projectRoot, sym.file);
        let sourceCode = "";
        try {
          const fullSource = await readFile(filePath, "utf-8");
          const lines = fullSource.split("\n").slice(sym.startLine - 1, sym.endLine);
          sourceCode = lines.join("\n");
        } catch {
          return {
            content: [{ type: "text" as const, text: `Could not read source for: ${sym.file}` }],
            isError: true,
          };
        }
        let existingContext: string | undefined;
        const mappings = await registry.findDocBySymbol(symbolName);
        for (const m of mappings) {
          try {
            existingContext = await readFile(path.join(docsDir, m.docPath), "utf-8");
            break;
          } catch {
            /* skip */
          }
        }
        const description = await businessTranslator.describeInBusinessTerms(
          { name: sym.name, kind: sym.kind },
          sourceCode,
          existingContext,
        );
        return mcpSuccess(description);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
