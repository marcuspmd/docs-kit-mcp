import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { indexFile } from "../../indexer/indexer.js";
import { scanFileAndCreateDocs } from "../../docs/docScanner.js";

export const scanFileSchema = {
  filePath: z.string().describe("Path to the TypeScript file to scan"),
  docsDir: z.string().default("docs").describe("Directory containing documentation files"),
  dbPath: z
    .string()
    .default(".docs-kit/registry.db")
    .describe("Path to the documentation registry database"),
};

export function registerScanFileTool(server: McpServer, deps: ServerDependencies): void {
  const { config, registry } = deps;

  server.registerTool(
    "scanFile",
    {
      description: "Scan a TypeScript file and generate documentation for any undocumented symbols",
      inputSchema: scanFileSchema,
    },
    async ({ filePath: filePathParam, docsDir, dbPath }) => {
      try {
        const absoluteFilePath = path.resolve(filePathParam);

        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        const source = fs.readFileSync(absoluteFilePath, "utf-8");
        const parser = new Parser();
        parser.setLanguage(TypeScript.typescript);
        const symbols = indexFile(absoluteFilePath, source, parser);

        const { createdCount, createdSymbols } = await scanFileAndCreateDocs({
          docsDir,
          projectRoot: config.projectRoot,
          symbols,
          registry,
        });

        if (createdCount === 0) {
          return mcpSuccess(
            `No new symbols to document in ${filePathParam}. All symbols are already documented.`,
          );
        }

        return mcpSuccess(
          `Created documentation for ${createdCount} symbols in ${filePathParam}:\n${createdSymbols.map((s) => `- ${s}`).join("\n")}`,
        );
      } catch (err) {
        return mcpError(`Error scanning file: ${(err as Error).message}`);
      }
    },
  );
}
