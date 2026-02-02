/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";
import Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../../src/server/types.js";
import { mcpSuccess, mcpError } from "../../src/server/types.js";
import type { CodeSymbol, SymbolRelationship } from "../../src/indexer/symbol.types.js";
import type { ResolvedConfig } from "../../src/configLoader.js";

// =============================================================================
// MOCK FACTORIES
// =============================================================================

function createMockSymbol(overrides: Partial<CodeSymbol> = {}): CodeSymbol {
  return {
    id: "sym-123",
    name: "TestSymbol",
    kind: "function",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createMockRelationship(overrides: Partial<SymbolRelationship> = {}): SymbolRelationship {
  return {
    sourceId: "sym-1",
    targetId: "sym-2",
    type: "calls",
    ...overrides,
  };
}

function createMockConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    projectRoot: "/tmp/test-project",
    docsDir: "docs",
    dbPath: ":memory:",
    llm: {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4",
    },
    ...overrides,
  } as ResolvedConfig;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function createMockServer(): McpServer & {
  registeredTools: Map<string, { handler: ToolHandler }>;
} {
  const registeredTools = new Map<string, { handler: ToolHandler }>();

  return {
    registeredTools,
    registerTool: jest.fn((name: string, _options: unknown, handler: ToolHandler) => {
      registeredTools.set(name, { handler });
    }),
  } as unknown as McpServer & { registeredTools: Map<string, { handler: ToolHandler }> };
}

function createMockFn<T = any>(returnValue?: T): jest.Mock<() => T> {
  return jest.fn<() => T>().mockReturnValue(returnValue as T);
}

function createMockAsyncFn<T = any>(returnValue?: T): jest.Mock<() => Promise<T>> {
  return jest.fn<() => Promise<T>>().mockResolvedValue(returnValue as T);
}

function createMockDependencies(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  const mockDb = new Database(":memory:");

  const mockSymbolRepo = {
    upsert: jest.fn(),
    findByName: createMockFn([createMockSymbol()]),
    findByFile: createMockFn([]),
    findAll: createMockFn([createMockSymbol()]),
    findByIds: createMockFn([]),
    findByKind: createMockFn([]),
    deleteByFile: jest.fn(),
  };

  const mockRelRepo = {
    upsert: jest.fn(),
    findAll: createMockFn([]),
    findBySourceId: createMockFn([]),
    findByTargetId: createMockFn([]),
    deleteBySourceFile: jest.fn(),
  };

  const mockRegistry = {
    rebuild: createMockAsyncFn(undefined),
    findDocBySymbol: createMockAsyncFn([]),
    findSymbolsByDoc: createMockAsyncFn([]),
    findAllMappings: createMockAsyncFn([]),
    findAllDocs: createMockFn([]),
    findDocByPath: createMockFn(undefined),
    register: createMockAsyncFn(undefined),
    unregister: createMockAsyncFn(undefined),
  };

  const mockGraph = {
    getDependencies: createMockFn([]),
    getDependents: createMockFn([]),
    getImpactRadius: createMockFn([]),
    getCallChain: createMockFn([]),
    findPath: createMockFn([]),
  };

  const mockPatternAnalyzer = {
    analyze: createMockFn([]),
  };

  const mockEventFlowAnalyzer = {
    analyze: createMockFn([]),
  };

  const mockLlm = {
    chat: createMockAsyncFn("LLM response"),
    embed: createMockAsyncFn([[0.1, 0.2, 0.3]]),
  };

  const mockRagIndex = {
    chunkCount: createMockFn(0),
    indexDocs: createMockAsyncFn(undefined),
    search: createMockAsyncFn([]),
  };

  const mockArchGuard = {
    setRules: jest.fn(),
    check: createMockFn([]),
    checkAll: createMockFn([]),
  };

  const mockReaper = {
    scan: createMockFn([]),
  };

  const mockContextMapper = {
    extractRefs: createMockAsyncFn([]),
    buildRTM: createMockAsyncFn([]),
  };

  const mockBusinessTranslator = {
    describeInBusinessTerms: createMockAsyncFn("Business description"),
  };

  const mockCodeExampleValidator = {
    extractExamples: createMockAsyncFn([]),
    validateExample: createMockAsyncFn({ valid: true }),
    validateDoc: createMockAsyncFn([]),
    validateAll: createMockAsyncFn([]),
  };

  return {
    config: createMockConfig(),
    db: mockDb,
    registry: mockRegistry,
    symbolRepo: mockSymbolRepo,
    relRepo: mockRelRepo,
    graph: mockGraph,
    patternAnalyzer: mockPatternAnalyzer,
    eventFlowAnalyzer: mockEventFlowAnalyzer,
    llm: mockLlm,
    ragIndex: mockRagIndex,
    archGuard: mockArchGuard,
    reaper: mockReaper,
    contextMapper: mockContextMapper,
    businessTranslator: mockBusinessTranslator,
    codeExampleValidator: mockCodeExampleValidator,
    ...overrides,
  } as unknown as ServerDependencies;
}

// =============================================================================
// TEST: mcpSuccess & mcpError helpers
// =============================================================================

describe("MCP response helpers", () => {
  describe("mcpSuccess", () => {
    it("creates a success response with text content", () => {
      const result = mcpSuccess("Test message");

      expect(result).toEqual({
        content: [{ type: "text", text: "Test message" }],
      });
    });

    it("handles empty string", () => {
      const result = mcpSuccess("");

      expect(result).toEqual({
        content: [{ type: "text", text: "" }],
      });
    });

    it("handles multiline text", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const result = mcpSuccess(text);

      expect(result.content[0].text).toBe(text);
    });
  });

  describe("mcpError", () => {
    it("creates an error response with message", () => {
      const result = mcpError("Something went wrong");

      expect(result).toEqual({
        content: [{ type: "text", text: "Error: Something went wrong" }],
        isError: true,
      });
    });

    it("prefixes message with Error:", () => {
      const result = mcpError("Test error");

      expect(result.content[0].text).toMatch(/^Error:/);
    });
  });
});

// =============================================================================
// TEST: analyzePatterns.tool.ts
// =============================================================================

describe("analyzePatterns tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerAnalyzePatternsTool } =
      await import("../../src/server/tools/analyzePatterns.tool.js");
    registerAnalyzePatternsTool(server, deps);
  });

  it("registers the analyzePatterns tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "analyzePatterns",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns patterns report when patterns are found", async () => {
    const mockPatterns = [
      {
        kind: "solid-srp",
        confidence: 0.85,
        symbols: ["sym-123"],
        violations: ["Method has too many responsibilities"],
      },
    ];
    (deps.patternAnalyzer.analyze as jest.Mock).mockReturnValue(mockPatterns);
    (deps.symbolRepo.findAll as jest.Mock).mockReturnValue([createMockSymbol()]);

    const handler = server.registeredTools.get("analyzePatterns")?.handler;
    const result = await handler!({});

    expect(result.content[0].text).toContain("SOLID-SRP");
    expect(result.content[0].text).toContain("85%");
    expect(result.content[0].text).toContain("TestSymbol");
  });

  it("returns no patterns message when none found", async () => {
    (deps.patternAnalyzer.analyze as jest.Mock).mockReturnValue([]);

    const handler = server.registeredTools.get("analyzePatterns")?.handler;
    const result = await handler!({});

    expect(result.content[0].text).toBe("No patterns detected.");
  });

  it("returns error on exception", async () => {
    (deps.symbolRepo.findAll as jest.Mock).mockImplementation(() => {
      throw new Error("Database error");
    });

    const handler = server.registeredTools.get("analyzePatterns")?.handler;
    const result = await handler!({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Database error");
  });
});

// =============================================================================
// TEST: askKnowledgeBase.tool.ts
// =============================================================================

describe("askKnowledgeBase tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerAskKnowledgeBaseTool } =
      await import("../../src/server/tools/askKnowledgeBase.tool.js");
    registerAskKnowledgeBaseTool(server, deps);
  });

  it("registers the askKnowledgeBase tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "askKnowledgeBase",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("indexes docs when chunk count is zero", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockReturnValue(0);
    (deps.ragIndex.search as jest.Mock).mockResolvedValue([
      { source: "docs/api.md", content: "API documentation", score: 0.9 },
    ]);
    (deps.llm.chat as jest.Mock).mockResolvedValue("The answer is 42");

    const handler = server.registeredTools.get("askKnowledgeBase")?.handler;
    await handler!({ question: "What is the meaning of life?", docsDir: "docs" });

    expect(deps.ragIndex.indexDocs).toHaveBeenCalledWith("docs");
  });

  it("skips indexing when chunks exist", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockReturnValue(100);
    (deps.ragIndex.search as jest.Mock).mockResolvedValue([]);
    (deps.llm.chat as jest.Mock).mockResolvedValue("Answer");

    const handler = server.registeredTools.get("askKnowledgeBase")?.handler;
    await handler!({ question: "Test question", docsDir: "docs" });

    expect(deps.ragIndex.indexDocs).not.toHaveBeenCalled();
  });

  it("returns LLM answer based on search results", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockReturnValue(10);
    (deps.ragIndex.search as jest.Mock).mockResolvedValue([
      { source: "docs/guide.md", content: "Guide content", score: 0.95 },
    ]);
    (deps.llm.chat as jest.Mock).mockResolvedValue("Here is your answer based on context");

    const handler = server.registeredTools.get("askKnowledgeBase")?.handler;
    const result = await handler!({ question: "How do I use this?", docsDir: "docs" });

    expect(result.content[0].text).toBe("Here is your answer based on context");
    expect(deps.llm.chat).toHaveBeenCalled();
  });

  it("returns error on exception", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockImplementation(() => {
      throw new Error("RAG error");
    });

    const handler = server.registeredTools.get("askKnowledgeBase")?.handler;
    const result = await handler!({ question: "Test", docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("RAG error");
  });
});

// =============================================================================
// TEST: buildTraceabilityMatrix.tool.ts
// =============================================================================

describe("buildTraceabilityMatrix tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerBuildTraceabilityMatrixTool } =
      await import("../../src/server/tools/buildTraceabilityMatrix.tool.js");
    registerBuildTraceabilityMatrixTool(server, deps);
  });

  it("registers the buildTraceabilityMatrix tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "buildTraceabilityMatrix",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("rebuilds registry and builds RTM", async () => {
    const mockRTM = [
      {
        ticketId: "JIRA-123",
        symbols: ["OrderService.createOrder"],
        tests: ["OrderService.test.ts"],
        docs: ["docs/orders.md"],
      },
    ];
    (deps.contextMapper.extractRefs as jest.Mock).mockResolvedValue([]);
    (deps.contextMapper.buildRTM as jest.Mock).mockResolvedValue(mockRTM);

    const handler = server.registeredTools.get("buildTraceabilityMatrix")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(deps.registry.rebuild).toHaveBeenCalledWith("docs");
    expect(result.content[0].text).toContain("JIRA-123");
    expect(result.content[0].text).toContain("OrderService.createOrder");
  });

  it("returns no entries message when RTM is empty", async () => {
    (deps.contextMapper.extractRefs as jest.Mock).mockResolvedValue([]);
    (deps.contextMapper.buildRTM as jest.Mock).mockResolvedValue([]);

    const handler = server.registeredTools.get("buildTraceabilityMatrix")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.content[0].text).toBe("No traceability entries found.");
  });

  it("returns error on exception", async () => {
    (deps.registry.rebuild as jest.Mock).mockRejectedValue(new Error("Registry error"));

    const handler = server.registeredTools.get("buildTraceabilityMatrix")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Registry error");
  });
});

// =============================================================================
// TEST: createOnboarding.tool.ts
// =============================================================================

describe("createOnboarding tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerCreateOnboardingTool } =
      await import("../../src/server/tools/createOnboarding.tool.js");
    registerCreateOnboardingTool(server, deps);
  });

  it("registers the createOnboarding tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "createOnboarding",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("generates learning path from search results", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockReturnValue(10);
    (deps.ragIndex.search as jest.Mock).mockResolvedValue([
      { source: "docs/intro.md", content: "Introduction to the project", score: 0.95 },
      { source: "docs/setup.md", content: "Setup instructions", score: 0.85 },
    ]);

    const handler = server.registeredTools.get("createOnboarding")?.handler;
    const result = await handler!({ topic: "getting started", docsDir: "docs" });

    expect(result.content[0].text).toContain("Learning path");
    expect(result.content[0].text).toContain("docs/intro.md");
    expect(result.content[0].text).toContain("docs/setup.md");
  });

  it("indexes docs when chunk count is zero", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockReturnValue(0);
    (deps.ragIndex.search as jest.Mock).mockResolvedValue([]);

    const handler = server.registeredTools.get("createOnboarding")?.handler;
    await handler!({ topic: "test topic", docsDir: "docs" });

    expect(deps.ragIndex.indexDocs).toHaveBeenCalledWith("docs");
  });

  it("returns error on exception", async () => {
    (deps.ragIndex.chunkCount as jest.Mock).mockImplementation(() => {
      throw new Error("Index error");
    });

    const handler = server.registeredTools.get("createOnboarding")?.handler;
    const result = await handler!({ topic: "test", docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Index error");
  });
});

// =============================================================================
// TEST: describeInBusinessTerms.tool.ts
// =============================================================================

describe("describeInBusinessTerms tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerDescribeInBusinessTermsTool } =
      await import("../../src/server/tools/describeInBusinessTerms.tool.js");
    registerDescribeInBusinessTermsTool(server, deps);
  });

  it("registers the describeInBusinessTerms tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "describeInBusinessTerms",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("returns error when symbol not found", async () => {
    (deps.symbolRepo.findByName as jest.Mock).mockReturnValue([]);

    const handler = server.registeredTools.get("describeInBusinessTerms")?.handler;
    const result = await handler!({ symbol: "NonExistent", docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No symbol found");
  });

  it("returns error on exception", async () => {
    (deps.registry.rebuild as jest.Mock).mockRejectedValue(new Error("Rebuild error"));

    const handler = server.registeredTools.get("describeInBusinessTerms")?.handler;
    const result = await handler!({ symbol: "Test", docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rebuild error");
  });
});

// =============================================================================
// TEST: generateEventFlow.tool.ts
// =============================================================================

describe("generateEventFlow tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerGenerateEventFlowTool } =
      await import("../../src/server/tools/generateEventFlow.tool.js");
    registerGenerateEventFlowTool(server, deps);
  });

  it("registers the generateEventFlow tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "generateEventFlow",
      expect.objectContaining({
        description: expect.any(String),
      }),
      expect.any(Function),
    );
  });

  it("generates mermaid diagram from event flows", async () => {
    // Mock proper EventFlow structure with CodeSymbol objects
    const mockEvent = createMockSymbol({ id: "evt-1", name: "OrderCreated", kind: "event" });
    const mockEmitter = createMockSymbol({ id: "svc-1", name: "OrderService", kind: "class" });
    const mockListener = createMockSymbol({
      id: "lst-1",
      name: "NotificationHandler",
      kind: "listener",
    });

    (deps.eventFlowAnalyzer.analyze as jest.Mock).mockReturnValue([
      {
        event: mockEvent,
        emitters: [mockEmitter],
        listeners: [mockListener],
        complete: true,
      },
    ]);

    const handler = server.registeredTools.get("generateEventFlow")?.handler;
    const result = await handler!({});

    expect(result.content[0].text).toContain("mermaid");
  });

  it("returns error on exception", async () => {
    (deps.symbolRepo.findAll as jest.Mock).mockImplementation(() => {
      throw new Error("Symbol error");
    });

    const handler = server.registeredTools.get("generateEventFlow")?.handler;
    const result = await handler!({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Symbol error");
  });
});

// =============================================================================
// TEST: generateMermaid.tool.ts
// =============================================================================

describe("generateMermaid tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerGenerateMermaidTool } =
      await import("../../src/server/tools/generateMermaid.tool.js");
    registerGenerateMermaidTool(server, deps);
  });

  it("registers the generateMermaid tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "generateMermaid",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("generates class diagram by default", async () => {
    (deps.symbolRepo.findAll as jest.Mock).mockReturnValue([
      createMockSymbol({ name: "OrderService", kind: "class" }),
    ]);

    const handler = server.registeredTools.get("generateMermaid")?.handler;
    const result = await handler!({ symbols: "OrderService", type: "classDiagram" });

    expect(result.content[0].text).toContain("mermaid");
  });

  it("parses comma-separated symbols", async () => {
    (deps.symbolRepo.findAll as jest.Mock).mockReturnValue([
      createMockSymbol({ name: "OrderService", kind: "class" }),
      createMockSymbol({ name: "PaymentService", kind: "class" }),
    ]);

    const handler = server.registeredTools.get("generateMermaid")?.handler;
    const result = await handler!({
      symbols: "OrderService, PaymentService",
      type: "classDiagram",
    });

    expect(result.content[0].text).toContain("mermaid");
  });

  it("returns error on exception", async () => {
    (deps.symbolRepo.findAll as jest.Mock).mockImplementation(() => {
      throw new Error("DB error");
    });

    const handler = server.registeredTools.get("generateMermaid")?.handler;
    const result = await handler!({ symbols: "Test", type: "classDiagram" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DB error");
  });
});

// =============================================================================
// TEST: getRelevantContext.tool.ts
// =============================================================================

describe("getRelevantContext tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerGetRelevantContextTool } =
      await import("../../src/server/tools/getRelevantContext.tool.js");
    registerGetRelevantContextTool(server, deps);
  });

  it("registers the getRelevantContext tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "getRelevantContext",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("returns error when neither symbol nor file provided", async () => {
    const handler = server.registeredTools.get("getRelevantContext")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Provide either symbol or file");
  });
});

// =============================================================================
// TEST: impactAnalysis.tool.ts
// =============================================================================

describe("impactAnalysis tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerImpactAnalysisTool } =
      await import("../../src/server/tools/impactAnalysis.tool.js");
    registerImpactAnalysisTool(server, deps);
  });

  it("registers the impactAnalysis tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "impactAnalysis",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("returns message when symbol not found", async () => {
    (deps.symbolRepo.findByName as jest.Mock).mockReturnValue([]);

    const handler = server.registeredTools.get("impactAnalysis")?.handler;
    const result = await handler!({ symbol: "NonExistent", maxDepth: 3 });

    expect(result.content[0].text).toContain("No symbol found");
  });

  it("analyzes impact radius for found symbol", async () => {
    const mockSymbol = createMockSymbol({ name: "OrderService" });
    (deps.symbolRepo.findByName as jest.Mock).mockReturnValue([mockSymbol]);
    (deps.graph.getImpactRadius as jest.Mock).mockReturnValue(["sym-1", "sym-2"]);
    (deps.symbolRepo.findByIds as jest.Mock).mockReturnValue([
      createMockSymbol({ id: "sym-1", name: "Dependent1" }),
      createMockSymbol({ id: "sym-2", name: "Dependent2" }),
    ]);

    const handler = server.registeredTools.get("impactAnalysis")?.handler;
    const result = await handler!({ symbol: "OrderService", maxDepth: 3 });

    expect(deps.graph.getImpactRadius).toHaveBeenCalledWith(mockSymbol.id, 3);
    expect(result.content[0].text).toBeDefined();
  });

  it("returns error on exception", async () => {
    (deps.symbolRepo.findByName as jest.Mock).mockImplementation(() => {
      throw new Error("Lookup error");
    });

    const handler = server.registeredTools.get("impactAnalysis")?.handler;
    const result = await handler!({ symbol: "Test", maxDepth: 3 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Lookup error");
  });
});

// =============================================================================
// TEST: projectStatus.tool.ts
// =============================================================================

describe("projectStatus tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerProjectStatusTool } =
      await import("../../src/server/tools/projectStatus.tool.js");
    registerProjectStatusTool(server, deps);
  });

  it("registers the projectStatus tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "projectStatus",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });
});

// =============================================================================
// TEST: scanFile.tool.ts
// =============================================================================

describe("scanFile tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerScanFileTool } = await import("../../src/server/tools/scanFile.tool.js");
    registerScanFileTool(server, deps);
  });

  it("registers the scanFile tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "scanFile",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });
});

// =============================================================================
// TEST: scanForDeadCode.tool.ts
// =============================================================================

describe("scanForDeadCode tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerScanForDeadCodeTool } =
      await import("../../src/server/tools/scanForDeadCode.tool.js");
    registerScanForDeadCodeTool(server, deps);
  });

  it("registers the scanForDeadCode tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "scanForDeadCode",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("scans for dead code and orphan docs", async () => {
    (deps.reaper.scan as jest.Mock).mockReturnValue([
      {
        type: "dead_code",
        target: "unusedFunction",
        reason: "No callers found",
        suggestedAction: "Remove",
      },
    ]);

    const handler = server.registeredTools.get("scanForDeadCode")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(deps.registry.rebuild).toHaveBeenCalledWith("docs");
    expect(result.content[0].text).toContain("DEAD_CODE");
    expect(result.content[0].text).toContain("unusedFunction");
  });

  it("returns no findings message when clean", async () => {
    (deps.reaper.scan as jest.Mock).mockReturnValue([]);

    const handler = server.registeredTools.get("scanForDeadCode")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.content[0].text).toBe("No dead code or orphan docs found.");
  });

  it("returns error on exception", async () => {
    (deps.registry.rebuild as jest.Mock).mockRejectedValue(new Error("Scan error"));

    const handler = server.registeredTools.get("scanForDeadCode")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Scan error");
  });
});

// =============================================================================
// TEST: smartCodeReview.tool.ts
// =============================================================================

describe("smartCodeReview tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerSmartCodeReviewTool } =
      await import("../../src/server/tools/smartCodeReview.tool.js");
    registerSmartCodeReviewTool(server, deps);
  });

  it("registers the smartCodeReview tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "smartCodeReview",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });
});

// =============================================================================
// TEST: validateExamples.tool.ts
// =============================================================================

describe("validateExamples tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerValidateExamplesTool } =
      await import("../../src/server/tools/validateExamples.tool.js");
    registerValidateExamplesTool(server, deps);
  });

  it("registers the validateExamples tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "validateExamples",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("validates all docs when no docPath provided", async () => {
    (deps.codeExampleValidator.validateAll as jest.Mock).mockResolvedValue([
      {
        valid: true,
        docPath: "docs/guide.md",
        example: { language: "typescript", lineStart: 10, lineEnd: 15 },
      },
    ]);

    const handler = server.registeredTools.get("validateExamples")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(deps.codeExampleValidator.validateAll).toHaveBeenCalledWith("docs");
    expect(result.content[0].text).toContain("1/1 examples passed");
  });

  it("validates specific doc when docPath provided", async () => {
    (deps.codeExampleValidator.validateDoc as jest.Mock).mockResolvedValue([
      {
        valid: false,
        docPath: "docs/api.md",
        example: { language: "typescript", lineStart: 5, lineEnd: 8 },
        error: "Syntax error",
      },
    ]);

    const handler = server.registeredTools.get("validateExamples")?.handler;
    const result = await handler!({ docsDir: "docs", docPath: "api.md" });

    expect(deps.codeExampleValidator.validateDoc).toHaveBeenCalledWith("docs/api.md");
    expect(result.content[0].text).toContain("0/1 examples passed");
    expect(result.content[0].text).toContain("FAIL");
  });

  it("returns no examples message when none found", async () => {
    (deps.codeExampleValidator.validateAll as jest.Mock).mockResolvedValue([]);

    const handler = server.registeredTools.get("validateExamples")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.content[0].text).toContain("No code examples found");
  });

  it("returns error on exception", async () => {
    (deps.codeExampleValidator.validateAll as jest.Mock).mockRejectedValue(
      new Error("Validation error"),
    );

    const handler = server.registeredTools.get("validateExamples")?.handler;
    const result = await handler!({ docsDir: "docs" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation error");
  });
});

// =============================================================================
// TEST: explainSymbol.tool.ts
// =============================================================================

describe("explainSymbol tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerExplainSymbolTool, registerUpdateSymbolExplanationTool } =
      await import("../../src/server/tools/explainSymbol.tool.js");
    registerExplainSymbolTool(server, deps);
    registerUpdateSymbolExplanationTool(server, deps);
  });

  it("registers the explainSymbol tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "explainSymbol",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("registers the updateSymbolExplanation tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "updateSymbolExplanation",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });
});

// =============================================================================
// TEST: generateDocs.tool.ts
// =============================================================================

describe("generateDocs tool", () => {
  let server: ReturnType<typeof createMockServer>;
  let deps: ServerDependencies;

  beforeEach(async () => {
    server = createMockServer();
    deps = createMockDependencies();

    const { registerGenerateDocsTool } =
      await import("../../src/server/tools/generateDocs.tool.js");
    registerGenerateDocsTool(server, deps);
  });

  it("registers the generateDocs tool", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "generateDocs",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });
});

// =============================================================================
// TEST: tools/index.ts - registerAllTools
// =============================================================================

describe("registerAllTools", () => {
  it("registers all tools on the server", async () => {
    const server = createMockServer();
    const deps = createMockDependencies();

    const { registerAllTools } = await import("../../src/server/tools/index.js");
    registerAllTools(server, deps);

    // Verify all expected tools are registered
    const expectedTools = [
      "generateDocs",
      "scanFile",
      "validateExamples",
      "explainSymbol",
      "updateSymbolExplanation",
      "describeInBusinessTerms",
      "getRelevantContext",
      "impactAnalysis",
      "analyzePatterns",
      "smartCodeReview",
      "generateMermaid",
      "generateEventFlow",
      "createOnboarding",
      "askKnowledgeBase",
      "scanForDeadCode",
      "buildTraceabilityMatrix",
      "projectStatus",
    ];

    for (const toolName of expectedTools) {
      expect(server.registeredTools.has(toolName)).toBe(true);
    }

    expect(server.registerTool).toHaveBeenCalledTimes(expectedTools.length);
  });
});
