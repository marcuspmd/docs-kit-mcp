import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { ConfigSchema } from "./config.js";
import { analyzeChanges } from "./analyzer/changeAnalyzer.js";
import { createDocUpdater } from "./docs/docUpdater.js";
import { createDocRegistry } from "./docs/docRegistry.js";
import { createKnowledgeGraph } from "./knowledge/graph.js";
import { createSymbolRepository, createRelationshipRepository } from "./storage/db.js";
import { createPatternAnalyzer } from "./patterns/patternAnalyzer.js";
import { createEventFlowAnalyzer } from "./events/eventFlowAnalyzer.js";
import { createRagIndex } from "./knowledge/rag.js";
import { createArchGuard } from "./governance/archGuard.js";
import { createReaper } from "./governance/reaper.js";
import { createContextMapper } from "./business/contextMapper.js";
import { createCodeExampleValidator, ValidationResult } from "./docs/codeExampleValidator.js";
import { generateProjectStatus, formatProjectStatus } from "./governance/projectStatus.js";
import OpenAI from "openai";
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
const symbolRepo = createSymbolRepository(db);
const relRepo = createRelationshipRepository(db);
const graph = createKnowledgeGraph(db);
const patternAnalyzer = createPatternAnalyzer();
const eventFlowAnalyzer = createEventFlowAnalyzer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ragIndex = createRagIndex({
  embeddingModel: "text-embedding-ada-002",
  embedFn: async (texts: string[]) => {
    const res = await openai.embeddings.create({ model: "text-embedding-ada-002", input: texts });
    return res.data.map((d) => d.embedding);
  },
});
const archGuard = createArchGuard();

// Set default rules
archGuard.setRules([
  {
    name: "ClassNaming",
    description: "Classes should be PascalCase",
    type: "naming_convention",
    severity: "warning",
    config: { pattern: "^[A-Z][a-zA-Z0-9]*$", kind: "class" },
  },
  {
    name: "MethodNaming",
    description: "Methods should be camelCase",
    type: "naming_convention",
    severity: "warning",
    config: { pattern: "^[a-z][a-zA-Z0-9]*$", kind: "method" },
  },
  {
    name: "FunctionNaming",
    description: "Functions should be camelCase",
    type: "naming_convention",
    severity: "warning",
    config: { pattern: "^[a-z][a-zA-Z0-9]*$", kind: "function" },
  },
]);
const reaper = createReaper();
const contextMapper = createContextMapper();
const codeExampleValidator = createCodeExampleValidator();
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

server.tool(
  "impactAnalysis",
  "Analyze what breaks if a symbol changes, using the Knowledge Graph",
  {
    symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
    maxDepth: z.number().default(3).describe("Maximum depth to traverse dependencies"),
  },
  async ({ symbol, maxDepth }) => {
    try {
      const symbols = symbolRepo.findByName(symbol);
      if (symbols.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No symbol found with name: ${symbol}`,
            },
          ],
        };
      }

      // For simplicity, take the first match
      const targetSymbol = symbols[0];
      const impactedIds = graph.getImpactRadius(targetSymbol.id, maxDepth);
      const impactedSymbols = symbolRepo.findByIds(impactedIds);

      const impactList = impactedSymbols
        .map((s) => `- ${s.name} (${s.kind} in ${s.file})`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Changing ${targetSymbol.name} (${targetSymbol.kind}) would impact:\n${impactList || "No other symbols."}`,
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
  "analyzePatterns",
  "Detect patterns and violations (SOLID, etc.), generate reports",
  {},
  async () => {
    try {
      const allSymbols = symbolRepo.findAll();
      const allRels = relRepo.findAll().map((r) => ({
        sourceId: r.source_id,
        targetId: r.target_id,
        type: r.type,
      }));
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

      return {
        content: [
          {
            type: "text" as const,
            text: report || "No patterns detected.",
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

server.tool("generateEventFlow", "Simulate event flows and listeners", {}, async () => {
  try {
    const allSymbols = symbolRepo.findAll();
    const allRels = relRepo.findAll().map((r) => ({
      sourceId: r.source_id,
      targetId: r.target_id,
      type: r.type,
    }));
    const flows = eventFlowAnalyzer.analyze(allSymbols, allRels);

    const lines = ["sequenceDiagram"];
    for (const flow of flows) {
      lines.push(`    participant ${flow.event.name}`);
      for (const emitter of flow.emitters) {
        lines.push(`    participant ${emitter.name}`);
      }
      for (const listener of flow.listeners) {
        lines.push(`    participant ${listener.name}`);
      }

      for (const emitter of flow.emitters) {
        lines.push(`    ${emitter.name}->>+${flow.event.name}: emit`);
        for (const listener of flow.listeners) {
          lines.push(`    ${flow.event.name}->>+${listener.name}: notify`);
          lines.push(`    ${listener.name}-->>-${flow.event.name}: handle`);
        }
        lines.push(`    ${flow.event.name}-->>-${emitter.name}: emitted`);
      }
    }

    const diagram = lines.join("\n");

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
});

server.tool(
  "createOnboarding",
  "Generate learning paths using RAG",
  {
    topic: z.string().describe("Topic to generate learning path for"),
    docsDir: z.string().default("docs").describe("Docs directory"),
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

      return {
        content: [
          {
            type: "text" as const,
            text: `Learning path for "${topic}":\n\n${path}`,
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
  "askKnowledgeBase",
  "Conversational Q&A on code + docs",
  {
    question: z.string().describe("Question to ask the knowledge base"),
    docsDir: z.string().default("docs").describe("Docs directory"),
  },
  async ({ question, docsDir }) => {
    try {
      if (ragIndex.chunkCount() === 0) {
        await ragIndex.indexDocs(docsDir);
      }
      const results = await ragIndex.search(question, 5);
      const context = results.map((r) => `${r.source}:\n${r.content}`).join("\n\n");

      const prompt = `Based on the following context, answer the question. If the context doesn't contain enough information, say so.\n\nContext:\n${context}\n\nQuestion: ${question}`;

      const res = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      });

      const answer = res.choices[0]?.message?.content || "No answer generated.";

      return {
        content: [
          {
            type: "text" as const,
            text: answer,
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
  "analyzeArchitecture",
  "Analyze code for architecture violations and naming conventions",
  {},
  async () => {
    try {
      const allSymbols = symbolRepo.findAll();
      const allRels = relRepo.findAll().map((r) => ({
        sourceId: r.source_id,
        targetId: r.target_id,
        type: r.type,
      }));
      const violations = archGuard.analyze(allSymbols, allRels);

      const report = violations
        .map((v) => `[${v.severity.toUpperCase()}] ${v.rule}: ${v.message} (${v.file})`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: report || "No architecture violations found.",
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
  "scanForDeadCode",
  "Scan for dead code, orphan docs, and broken links",
  {
    docsDir: z.string().default("docs").describe("Docs directory"),
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

      return {
        content: [
          {
            type: "text" as const,
            text: report || "No dead code or orphan docs found.",
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
  "buildTraceabilityMatrix",
  "Build Requirements Traceability Matrix from commits and comments",
  {
    docsDir: z.string().default("docs").describe("Docs directory"),
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

      return {
        content: [
          {
            type: "text" as const,
            text: report || "No traceability entries found.",
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
  "validateExamples",
  "Validate code examples in documentation against real code",
  {
    docsDir: z.string().default("docs").describe("Docs directory"),
    docPath: z.string().optional().describe("Specific doc file to validate (optional)"),
  },
  async ({ docsDir, docPath }) => {
    try {
      let results: ValidationResult[];
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

      return {
        content: [
          {
            type: "text" as const,
            text: `${summary}\n\n${report || "No code examples found."}`,
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
  "projectStatus",
  "Generate comprehensive project status report with documentation coverage, patterns, and metrics",
  {
    docsDir: z.string().default("docs").describe("Docs directory"),
  },
  async ({ docsDir }) => {
    try {
      const result = await generateProjectStatus(
        { docsDir },
        {
          symbolRepo,
          relRepo,
          registry,
          patternAnalyzer,
          archGuard,
          reaper,
          graph,
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: formatProjectStatus(result),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error generating status report: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
