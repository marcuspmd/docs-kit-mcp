import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { ConfigSchema } from "./config.js";
import { analyzeChanges } from "./analyzer/changeAnalyzer.js";
import { createDocUpdater } from "./docs/docUpdater.js";
import { createDocRegistry } from "./docs/docRegistry.js";
const config = ConfigSchema.parse({
    projectRoot: process.cwd(),
});
const db = new Database(config.dbPath);
const registry = createDocRegistry(db);
const server = new McpServer({
    name: "docs-agent",
    version: "1.0.0",
});
server.tool("generateDocs", "Update docs for symbols affected by recent changes", {
    base: z.string().default("main").describe("Base ref (e.g. main)"),
    head: z.string().optional().describe("Head ref"),
    dryRun: z.boolean().default(false).describe("Preview without writing"),
    docsDir: z.string().default("docs").describe("Docs directory"),
}, async ({ base, head, dryRun, docsDir }) => {
    try {
        await registry.rebuild(docsDir);
        const impacts = await analyzeChanges({
            repoPath: config.projectRoot,
            base,
            head,
        });
        const updater = createDocUpdater({ dryRun });
        const results = await updater.applyChanges(impacts, registry, docsDir);
        const summary = results
            .filter((r) => r.action !== "skipped")
            .map((r) => `${r.action}: ${r.symbolName} in ${r.docPath}`)
            .join("\n");
        return {
            content: [
                {
                    type: "text",
                    text: summary || "No doc updates needed.",
                },
            ],
        };
    }
    catch (err) {
        return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
        };
    }
});
server.tool("explainSymbol", "Explain a code symbol combining code analysis and existing docs", {
    symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
    docsDir: z.string().default("docs").describe("Docs directory"),
}, async ({ symbol, docsDir }) => {
    try {
        await registry.rebuild(docsDir);
        const mappings = await registry.findDocBySymbol(symbol);
        if (mappings.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No documentation found for symbol: ${symbol}`,
                    },
                ],
            };
        }
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { parseSections } = await import("./docs/docUpdater.js");
        const parts = [`# ${symbol}\n`];
        for (const mapping of mappings) {
            const content = await readFile(join(docsDir, mapping.docPath), "utf-8");
            const sections = parseSections(content);
            const baseName = symbol.includes(".") ? symbol.split(".").pop() : symbol;
            const section = sections.find((s) => s.heading === symbol || s.heading === baseName);
            if (section) {
                parts.push(`From \`${mapping.docPath}\`:\n\n${section.content}`);
            }
            else {
                parts.push(`Linked doc: \`${mapping.docPath}\` (no matching section found)`);
            }
        }
        return {
            content: [{ type: "text", text: parts.join("\n\n") }],
        };
    }
    catch (err) {
        return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
        };
    }
});
server.tool("generateMermaid", "Generate Mermaid diagram for given symbols", {
    symbols: z.string().describe("Comma-separated symbol names"),
    type: z
        .enum(["classDiagram", "sequenceDiagram", "flowchart"])
        .default("classDiagram")
        .describe("Diagram type"),
}, async ({ symbols: symbolsStr, type: diagramType }) => {
    try {
        const symbolNames = symbolsStr.split(",").map((s) => s.trim()).filter(Boolean);
        let diagram;
        if (diagramType === "classDiagram") {
            const lines = ["classDiagram"];
            for (const name of symbolNames) {
                if (name.includes(".")) {
                    const [cls, method] = name.split(".");
                    lines.push(`    ${cls} : +${method}()`);
                }
                else {
                    lines.push(`    class ${name}`);
                }
            }
            // Add relationships between top-level classes
            const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
            for (let i = 0; i < classes.length - 1; i++) {
                lines.push(`    ${classes[i]} --> ${classes[i + 1]} : uses`);
            }
            diagram = lines.join("\n");
        }
        else if (diagramType === "sequenceDiagram") {
            const lines = ["sequenceDiagram"];
            const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
            for (let i = 0; i < classes.length - 1; i++) {
                lines.push(`    ${classes[i]}->>+${classes[i + 1]}: call`);
                lines.push(`    ${classes[i + 1]}-->>-${classes[i]}: response`);
            }
            diagram = lines.join("\n");
        }
        else {
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
                    type: "text",
                    text: `\`\`\`mermaid\n${diagram}\n\`\`\``,
                },
            ],
        };
    }
    catch (err) {
        return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
        };
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
