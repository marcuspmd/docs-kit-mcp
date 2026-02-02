import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { loadConfig } from "./configLoader.js";
import { analyzeChanges } from "./analyzer/changeAnalyzer.js";
import { createDocUpdater } from "./docs/docUpdater.js";
import { createDocRegistry } from "./docs/docRegistry.js";
import { createKnowledgeGraph } from "./knowledge/graph.js";
import { buildRelevantContext } from "./knowledge/contextBuilder.js";
import {
  createSymbolRepository,
  createRelationshipRepository,
  relationshipRowsToSymbolRelationships,
} from "./storage/db.js";
import { createPatternAnalyzer } from "./patterns/patternAnalyzer.js";
import { createEventFlowAnalyzer, formatEventFlowsAsMermaid } from "./events/eventFlowAnalyzer.js";
import { createRagIndex } from "./knowledge/rag.js";
import { createArchGuard } from "./governance/archGuard.js";
import { createReaper } from "./governance/reaper.js";
import { createContextMapper } from "./business/contextMapper.js";
import { createBusinessTranslator } from "./business/businessTranslator.js";
import { createCodeExampleValidator, ValidationResult } from "./docs/codeExampleValidator.js";
import { scanFileAndCreateDocs } from "./docs/docScanner.js";
import { generateMermaid } from "./docs/mermaidGenerator.js";
import { generateProjectStatus, formatProjectStatus } from "./governance/projectStatus.js";
import { performSmartCodeReview } from "./governance/smartCodeReview.js";
import { createLlmProvider } from "./llm/provider.js";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { indexFile } from "./indexer/indexer.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildExplainSymbolContext } from "./handlers/explainSymbol.js";
import { generateExplanationHash } from "./handlers/explainSymbol.js";
import { buildExplainSymbolPromptForMcp } from "./prompts/explainSymbol.prompt.js";
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
const llm = createLlmProvider(config);
const ragIndex = createRagIndex({
  embeddingModel: config.llm.embeddingModel ?? "text-embedding-ada-002",
  db,
  embedFn: (texts: string[]) => llm.embed(texts),
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
const businessTranslator = createBusinessTranslator(llm);
const codeExampleValidator = createCodeExampleValidator();
const server = new McpServer({
  name: "docs-kit",
  version: "1.0.0",
});

server.registerTool(
  "generateDocs",
  {
    description: "Update docs for symbols affected by recent changes",
    inputSchema: {
      base: z.string().default("main").describe("Base ref (e.g. main)"),
      head: z.string().optional().describe("Head ref"),
      dryRun: z.boolean().default(false).describe("Preview without writing"),
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
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

server.registerTool(
  "explainSymbol",
  {
    description:
      "Get the prompt to explain a code symbol. The AI should analyze the prompt and call updateSymbolExplanation with the result.",
    inputSchema: {
      symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
  },
  async ({ symbol: symbolName, docsDir }) => {
    try {
      await registry.rebuild(docsDir);
      const result = await buildExplainSymbolContext(symbolName, {
        projectRoot: config.projectRoot,
        docsDir,
        registry,
        symbolRepo,
        graph,
      });

      if (!result.found) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No symbol or documentation found for: ${symbolName}`,
            },
          ],
        };
      }

      // Return cached explanation if available and valid
      if (result.cachedExplanation && !result.needsUpdate) {
        return {
          content: [
            {
              type: "text" as const,
              text: `## Cached Explanation (still valid)\n\n${result.cachedExplanation}`,
            },
          ],
        };
      }

      // Build prompt with instruction to call updateSymbolExplanation
      const symbols = symbolRepo.findByName(symbolName);
      const sym = symbols[0];

      if (!sym) {
        return {
          content: [{ type: "text" as const, text: result.prompt }],
        };
      }

      // Get dependencies for the prompt
      let sourceCode: string | undefined;
      try {
        const filePath = path.resolve(config.projectRoot, sym.file);
        const fullSource = fs.readFileSync(filePath, "utf-8");
        const lines = fullSource.split("\n").slice(sym.startLine - 1, sym.endLine);
        sourceCode = lines.join("\n");
      } catch {
        /* skip */
      }

      const depRels = graph.getDependencies(sym.id);
      const dependencies = symbolRepo.findByIds(depRels.map((r) => r.targetId));
      const depByRels = graph.getDependents(sym.id);
      const dependents = symbolRepo.findByIds(depByRels.map((r) => r.sourceId));

      // Build prompt for MCP with update instructions
      const prompt = buildExplainSymbolPromptForMcp(
        {
          symbol: sym,
          sourceCode,
          dependencies,
          dependents,
        },
        result.cachedExplanation,
      );

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

server.registerTool(
  "updateSymbolExplanation",
  {
    description:
      "Update the cached explanation for a symbol. Call this after generating an explanation via explainSymbol.",
    inputSchema: {
      symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
      explanation: z.string().describe("The generated explanation to cache"),
    },
  },
  async ({ symbol: symbolName, explanation }) => {
    try {
      const symbols = symbolRepo.findByName(symbolName);
      if (symbols.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Symbol not found: ${symbolName}`,
            },
          ],
        };
      }

      const sym = symbols[0];

      // Generate hash for the current state
      let sourceCode: string | undefined;
      try {
        const filePath = path.resolve(config.projectRoot, sym.file);
        const fullSource = fs.readFileSync(filePath, "utf-8");
        const lines = fullSource.split("\n").slice(sym.startLine - 1, sym.endLine);
        sourceCode = lines.join("\n");
      } catch {
        /* skip */
      }

      const hash = generateExplanationHash(sym.id, sym.startLine, sym.endLine, sourceCode);

      // Update symbol with explanation
      symbolRepo.upsert({
        ...sym,
        explanation,
        explanationHash: hash,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `✓ Explanation cached for ${symbolName}`,
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

server.registerTool(
  "generateMermaid",
  {
    description: "Generate Mermaid diagram for given symbols",
    inputSchema: {
      symbols: z.string().describe("Comma-separated symbol names"),
      type: z
        .enum(["classDiagram", "sequenceDiagram", "flowchart"])
        .default("classDiagram")
        .describe("Diagram type"),
    },
  },
  async ({ symbols: symbolsStr, type: diagramType }) => {
    try {
      const symbolNames = symbolsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const allSymbols = symbolRepo.findAll();
      const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
      const diagram = generateMermaid(
        { symbols: symbolNames, type: diagramType },
        allSymbols,
        allRels,
      );

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

server.registerTool(
  "scanFile",
  {
    description: "Scan a TypeScript file and generate documentation for any undocumented symbols",
    inputSchema: {
      filePath: z.string().describe("Path to the TypeScript file to scan"),
      docsDir: z.string().default("docs").describe("Directory containing documentation files"),
      dbPath: z
        .string()
        .default(".doc-kit/registry.db")
        .describe("Path to the documentation registry database"),
    },
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
        filePath: absoluteFilePath,
        docsDir,
        projectRoot: config.projectRoot,
        symbols,
        registry,
      });

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

server.registerTool(
  "impactAnalysis",
  {
    description: "Analyze what breaks if a symbol changes, using the Knowledge Graph",
    inputSchema: {
      symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
      maxDepth: z.number().default(3).describe("Maximum depth to traverse dependencies"),
    },
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

server.registerTool(
  "analyzePatterns",
  {
    description: "Detect patterns and violations (SOLID, etc.), generate reports",
  },
  async () => {
    try {
      const allSymbols = symbolRepo.findAll();
      const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
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

server.registerTool(
  "generateEventFlow",
  { description: "Simulate event flows and listeners" },
  async () => {
    try {
      const allSymbols = symbolRepo.findAll();
      const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
      const flows = eventFlowAnalyzer.analyze(allSymbols, allRels);
      const diagram = formatEventFlowsAsMermaid(flows);

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

server.registerTool(
  "createOnboarding",
  {
    description: "Generate learning paths using RAG",
    inputSchema: {
      topic: z.string().describe("Topic to generate learning path for"),
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
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

server.registerTool(
  "askKnowledgeBase",
  {
    description: "Conversational Q&A on code + docs",
    inputSchema: {
      question: z.string().describe("Question to ask the knowledge base"),
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
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

server.registerTool(
  "scanForDeadCode",
  {
    description: "Scan for dead code, orphan docs, and broken links",
    inputSchema: {
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
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

server.registerTool(
  "buildTraceabilityMatrix",
  {
    description: "Build Requirements Traceability Matrix from commits and comments",
    inputSchema: {
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
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

server.registerTool(
  "describeInBusinessTerms",
  {
    description:
      "Describe a code symbol in business terms (rules, if/else, outcomes) for product/compliance",
    inputSchema: {
      symbol: z.string().describe("Symbol name (e.g. OrderService.createOrder)"),
      docsDir: z.string().default("docs").describe("Docs directory for existing doc context"),
    },
  },
  async ({ symbol: symbolName, docsDir }) => {
    try {
      await registry.rebuild(docsDir);
      const { readFile } = await import("node:fs/promises");
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
      return {
        content: [{ type: "text" as const, text: description }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "validateExamples",
  {
    description: "Validate code examples in documentation against real code",
    inputSchema: {
      docsDir: z.string().default("docs").describe("Docs directory"),
      docPath: z.string().optional().describe("Specific doc file to validate (optional)"),
    },
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

server.registerTool(
  "smartCodeReview",
  {
    description:
      "Perform comprehensive code review combining architecture analysis, pattern detection, dead code scanning, and documentation validation",
    inputSchema: {
      docsDir: z.string().default("docs").describe("Docs directory"),
      includeExamples: z.boolean().default(true).describe("Include code example validation"),
    },
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

server.registerTool(
  "projectStatus",
  {
    description:
      "Generate comprehensive project status report with documentation coverage, patterns, and metrics",
    inputSchema: {
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
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

server.registerTool(
  "getRelevantContext",
  {
    description:
      "Get comprehensive context for understanding or modifying a symbol or file — combines index, graph, docs, and source code",
    inputSchema: {
      symbol: z.string().optional().describe("Symbol name to get context for"),
      file: z.string().optional().describe("File path to get context for"),
      docsDir: z.string().default("docs").describe("Docs directory"),
    },
  },
  async ({ symbol: symbolName, file: filePath, docsDir }) => {
    try {
      if (!symbolName && !filePath) {
        return {
          content: [{ type: "text" as const, text: "Provide either symbol or file parameter." }],
          isError: true,
        };
      }

      const result = await buildRelevantContext(
        { symbolName, filePath },
        {
          projectRoot: config.projectRoot,
          docsDir,
          registry,
          symbolRepo,
          graph,
        },
      );

      return {
        content: [{ type: "text" as const, text: result.text }],
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
