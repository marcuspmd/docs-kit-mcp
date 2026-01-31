import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { loadConfig } from "./configLoader.js";
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
import { performSmartCodeReview } from "./governance/smartCodeReview.js";
import OpenAI from "openai";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { indexFile } from "./indexer/indexer.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildExplainSymbolPrompt } from "./prompts/explainSymbol.prompt.js";
import { buildImpactAnalysisPrompt } from "./prompts/impactAnalysis.prompt.js";
import { buildSmartCodeReviewPrompt } from "./prompts/smartCodeReview.prompt.js";
import { buildCodeReviewPrompt } from "./prompts/codeReview.prompt.js";
import "dotenv/config";

const config = await loadConfig(process.cwd());

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
  db,
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
  async ({ symbol: symbolName, docsDir }) => {
    try {
      await registry.rebuild(docsDir);

      // Find symbol in index
      const symbols = symbolRepo.findByName(symbolName);
      const mappings = await registry.findDocBySymbol(symbolName);

      if (symbols.length === 0 && mappings.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No symbol or documentation found for: ${symbolName}`,
            },
          ],
        };
      }

      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");

      // Get doc content
      let docContent: string | undefined;
      for (const mapping of mappings) {
        try {
          docContent = await readFile(join(docsDir, mapping.docPath), "utf-8");
          break;
        } catch { /* skip */ }
      }

      // Get source code and dependencies if we have the symbol in index
      let sourceCode: string | undefined;
      let dependencies: typeof symbols = [];
      let dependents: typeof symbols = [];
      const sym = symbols[0];

      if (sym) {
        try {
          const filePath = path.resolve(config.projectRoot, sym.file);
          const fullSource = await readFile(filePath, "utf-8");
          const lines = fullSource.split("\n").slice(sym.startLine - 1, sym.endLine);
          sourceCode = lines.join("\n");
        } catch { /* skip */ }

        // Get dependencies from graph
        const depRels = graph.getDependencies(sym.id);
        dependencies = symbolRepo.findByIds(depRels.map((r) => r.targetId));
        const depByRels = graph.getDependents(sym.id);
        dependents = symbolRepo.findByIds(depByRels.map((r) => r.sourceId));
      }

      // Build rich prompt for LLM
      const prompt = buildExplainSymbolPrompt({
        symbol: sym || { id: "", name: symbolName, kind: "function", file: "unknown", startLine: 0, endLine: 0 } as any,
        sourceCode,
        docContent,
        dependencies,
        dependents,
      });

      return {
        content: [{ type: "text" as const, text: prompt }],
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

      const targetSymbol = symbols[0];
      const impactedIds = graph.getImpactRadius(targetSymbol.id, maxDepth);
      const impactedSymbols = symbolRepo.findByIds(impactedIds);

      const prompt = buildImpactAnalysisPrompt({
        targetSymbol,
        impactedSymbols,
        maxDepth,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: prompt,
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
  "smartCodeReview",
  "Perform comprehensive code review combining architecture analysis, pattern detection, dead code scanning, and documentation validation",
  {
    docsDir: z.string().default("docs").describe("Docs directory"),
    includeExamples: z.boolean().default(true).describe("Include code example validation"),
  },
  async ({ docsDir, includeExamples }) => {
    try {
      const result = await performSmartCodeReview(
        { docsDir, includeExamples },
        {
          symbolRepo,
          relRepo,
          registry,
          patternAnalyzer,
          archGuard,
          reaper,
          graph,
          codeExampleValidator,
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error performing smart code review: ${(err as Error).message}`,
          },
        ],
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

server.tool(
  "getRelevantContext",
  "Get comprehensive context for understanding or modifying a symbol or file — combines index, graph, docs, and source code",
  {
    symbol: z.string().optional().describe("Symbol name to get context for"),
    file: z.string().optional().describe("File path to get context for"),
    docsDir: z.string().default("docs").describe("Docs directory"),
  },
  async ({ symbol: symbolName, file: filePath, docsDir }) => {
    try {
      if (!symbolName && !filePath) {
        return {
          content: [{ type: "text" as const, text: "Provide either symbol or file parameter." }],
          isError: true,
        };
      }

      const { readFile } = await import("node:fs/promises");
      const parts: string[] = [];
      let targetSymbols: ReturnType<typeof symbolRepo.findByName> = [];

      if (symbolName) {
        targetSymbols = symbolRepo.findByName(symbolName);
      } else if (filePath) {
        targetSymbols = symbolRepo.findByFile(filePath);
      }

      if (targetSymbols.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No symbols found for: ${symbolName || filePath}` }],
        };
      }

      // 1. Symbol info
      parts.push(`# Context for ${symbolName || filePath}\n`);
      parts.push(`## Symbols (${targetSymbols.length})\n`);
      for (const sym of targetSymbols) {
        parts.push(`### ${sym.qualifiedName || sym.name}`);
        parts.push(`- Kind: ${sym.kind}`);
        parts.push(`- File: ${sym.file}:${sym.startLine}-${sym.endLine}`);
        if (sym.signature) parts.push(`- Signature: \`${sym.signature}\``);
        if (sym.layer) parts.push(`- Layer: ${sym.layer}`);
        if (sym.pattern) parts.push(`- Pattern: ${sym.pattern}`);
        if (sym.summary) parts.push(`- Summary: ${sym.summary}`);
        parts.push(``);
      }

      // 2. Dependencies (1 level)
      const allDepIds = new Set<string>();
      const allDependentIds = new Set<string>();
      for (const sym of targetSymbols) {
        const deps = graph.getDependencies(sym.id);
        for (const d of deps) allDepIds.add(d.targetId);
        const dependents = graph.getDependents(sym.id);
        for (const d of dependents) allDependentIds.add(d.sourceId);
      }

      const depSymbols = symbolRepo.findByIds([...allDepIds]);
      const dependentSymbols = symbolRepo.findByIds([...allDependentIds]);

      if (depSymbols.length > 0) {
        parts.push(`## Dependencies (${depSymbols.length})\n`);
        for (const dep of depSymbols) {
          parts.push(`- ${dep.name} (${dep.kind} in ${dep.file})`);
        }
        parts.push(``);
      }

      if (dependentSymbols.length > 0) {
        parts.push(`## Dependents (${dependentSymbols.length})\n`);
        for (const dep of dependentSymbols) {
          parts.push(`- ${dep.name} (${dep.kind} in ${dep.file})`);
        }
        parts.push(``);
      }

      // 3. Mapped docs
      await registry.rebuild(docsDir);
      const docParts: string[] = [];
      for (const sym of targetSymbols) {
        const mappings = await registry.findDocBySymbol(sym.name);
        for (const m of mappings) {
          try {
            const content = await readFile(path.join(docsDir, m.docPath), "utf-8");
            docParts.push(`### ${m.docPath}\n${content.slice(0, 2000)}`);
          } catch { /* skip */ }
        }
      }
      if (docParts.length > 0) {
        parts.push(`## Documentation\n`);
        parts.push(...docParts);
        parts.push(``);
      }

      // 4. Source code of relevant files
      const relevantFiles = new Set(targetSymbols.map((s) => s.file));
      parts.push(`## Source Code\n`);
      for (const file of relevantFiles) {
        try {
          const absPath = path.resolve(config.projectRoot, file);
          const source = await readFile(absPath, "utf-8");
          const lines = source.split("\n");
          // Only include lines around the symbols in this file
          const fileSymbols = targetSymbols.filter((s) => s.file === file);
          const minLine = Math.max(0, Math.min(...fileSymbols.map((s) => s.startLine)) - 3);
          const maxLine = Math.min(lines.length, Math.max(...fileSymbols.map((s) => s.endLine)) + 3);
          parts.push(`### ${file}:${minLine + 1}-${maxLine}`);
          parts.push("```");
          parts.push(lines.slice(minLine, maxLine).join("\n"));
          parts.push("```\n");
        } catch { /* skip */ }
      }

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
