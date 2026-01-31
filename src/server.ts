import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { ConfigSchema } from "./config.js";
import { analyzeChanges } from "./analyzer/changeAnalyzer.js";
import { createDocUpdater } from "./docs/docUpdater.js";
import { createDocRegistry } from "./docs/docRegistry.js";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { indexFile } from "./indexer/indexer.js";
import * as fs from "node:fs";
import * as path from "node:path";
import "dotenv/config";

const config = ConfigSchema.parse({
  projectRoot: process.cwd(),
  llm: {
    apiKey: process.env.OPENAI_API_KEY,
  },
});

const db = new Database(config.dbPath);
const registry = createDocRegistry(db);

const server = new McpServer({
  name: "docs-agent",
  version: "1.0.0",
});

server.tool(
  "generateDocs",
  "Update docs for symbols affected by recent changes",
  {
    base: z.string().default("main").describe("Base ref (e.g. main)"),
    head: z.string().optional().describe("Head ref"),
    dryRun: z.boolean().default(false).describe("Preview without writing"),
    docsDir: z.string().default("docs").describe("Docs directory"),
  },
  async ({ base, head, dryRun, docsDir }) => {
    try {
      await registry.rebuild(docsDir);
      const impacts = await analyzeChanges({
        repoPath: config.projectRoot,
        base,
        head,
      });
      const updater = createDocUpdater({ dryRun });
      const results = await updater.applyChanges(impacts, registry, docsDir, config);

      const summary = results
        .filter((r) => r.action !== "skipped")
        .map((r) => `${r.action}: ${r.symbolName} in ${r.docPath}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: summary || "No doc updates needed.",
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "explainSymbol",
  "Explain a code symbol combining code analysis and existing docs",
  {
    symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
    docsDir: z.string().default("docs").describe("Docs directory"),
  },
  async ({ symbol, docsDir }) => {
    try {
      await registry.rebuild(docsDir);
      const mappings = await registry.findDocBySymbol(symbol);

      if (mappings.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No documentation found for symbol: ${symbol}`,
            },
          ],
        };
      }

      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { parseSections } = await import("./docs/docUpdater.js");

      const parts: string[] = [`# ${symbol}\n`];
      for (const mapping of mappings) {
        const content = await readFile(join(docsDir, mapping.docPath), "utf-8");
        const sections = parseSections(content);
        const baseName = symbol.includes(".") ? symbol.split(".").pop()! : symbol;
        const section = sections.find((s) => s.heading === symbol || s.heading === baseName);
        if (section) {
          parts.push(`From \`${mapping.docPath}\`:\n\n${section.content}`);
        } else {
          parts.push(`Linked doc: \`${mapping.docPath}\` (no matching section found)`);
        }
      }

      return {
        content: [{ type: "text" as const, text: parts.join("\n\n") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "generateMermaid",
  "Generate Mermaid diagram for given symbols",
  {
    symbols: z.string().describe("Comma-separated symbol names"),
    type: z
      .enum(["classDiagram", "sequenceDiagram", "flowchart"])
      .default("classDiagram")
      .describe("Diagram type"),
  },
  async ({ symbols: symbolsStr, type: diagramType }) => {
    try {
      const symbolNames = symbolsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let diagram: string;

      if (diagramType === "classDiagram") {
        const lines = ["classDiagram"];
        for (const name of symbolNames) {
          if (name.includes(".")) {
            const [cls, method] = name.split(".");
            lines.push(`    ${cls} : +${method}()`);
          } else {
            lines.push(`    class ${name}`);
          }
        }
        // Add relationships between top-level classes
        const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
        for (let i = 0; i < classes.length - 1; i++) {
          lines.push(`    ${classes[i]} --> ${classes[i + 1]} : uses`);
        }
        diagram = lines.join("\n");
      } else if (diagramType === "sequenceDiagram") {
        const lines = ["sequenceDiagram"];
        const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
        for (let i = 0; i < classes.length - 1; i++) {
          lines.push(`    ${classes[i]}->>+${classes[i + 1]}: call`);
          lines.push(`    ${classes[i + 1]}-->>-${classes[i]}: response`);
        }
        diagram = lines.join("\n");
      } else {
        const lines = ["flowchart LR"];
        const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
        for (const cls of classes) {
          lines.push(`    ${cls}[${cls}]`);
        }
        for (let i = 0; i < classes.length - 1; i++) {
          lines.push(`    ${classes[i]} --> ${classes[i + 1]}`);
        }
        diagram = lines.join("\n");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `\`\`\`mermaid\n${diagram}\n\`\`\``,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  "scanFile",
  "Scan a TypeScript file and generate documentation for any undocumented symbols",
  {
    filePath: z.string().describe("Path to the TypeScript file to scan"),
    docsDir: z.string().default("docs").describe("Directory containing documentation files"),
    dbPath: z
      .string()
      .default(".doc-kit/registry.db")
      .describe("Path to the documentation registry database"),
  },
  async ({ filePath: filePathParam, docsDir, dbPath }) => {
    try {
      const absoluteFilePath = path.resolve(filePathParam);

      // Ensure db directory exists
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const source = fs.readFileSync(absoluteFilePath, "utf-8");
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const symbols = indexFile(absoluteFilePath, source, parser);

      let createdCount = 0;
      const createdSymbols: string[] = [];

      for (const symbol of symbols) {
        const mappings = await registry.findDocBySymbol(symbol.name);
        if (mappings.length === 0) {
          // Create a new doc file for this symbol
          const docPath = `domain/${symbol.name}.md`;
          const fullDocPath = path.join(docsDir, docPath);
          const docDir = path.dirname(fullDocPath);
          if (!fs.existsSync(docDir)) {
            fs.mkdirSync(docDir, { recursive: true });
          }

          // Create initial doc content
          const initialContent = `---
title: ${symbol.name}
symbols:
  - ${symbol.name}
lastUpdated: ${new Date().toISOString().slice(0, 10)}
---

# ${symbol.name}

> TODO: Document \`${symbol.name}\` (${symbol.kind} in ${path.relative(process.cwd(), symbol.file)}).

## Description

TODO: Add description here.

## Usage

TODO: Add usage examples here.
`;

          fs.writeFileSync(fullDocPath, initialContent, "utf-8");

          // Register the mapping
          await registry.register({
            symbolName: symbol.name,
            docPath,
          });

          createdCount++;
          createdSymbols.push(symbol.name);
        }
      }

      if (createdCount === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No new symbols to document in ${filePathParam}. All symbols are already documented.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Created documentation for ${createdCount} symbols in ${filePathParam}:\n${createdSymbols.map((s) => `- ${s}`).join("\n")}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text" as const, text: `Error scanning file: ${(err as Error).message}` },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
