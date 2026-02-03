import { jest } from "@jest/globals";
import type { ResolvedConfig } from "../../configLoader.js";
import {
  ARCH_GUARD_TOKEN,
  BUSINESS_TRANSLATOR_TOKEN,
  CODE_EXAMPLE_VALIDATOR_TOKEN,
  CONFIG_TOKEN,
  CONTEXT_MAPPER_TOKEN,
  DATABASE_TOKEN,
  DOC_REGISTRY_TOKEN,
  EVENT_FLOW_ANALYZER_TOKEN,
  FILE_HASH_REPO_TOKEN,
  KNOWLEDGE_GRAPH_TOKEN,
  LLM_PROVIDER_TOKEN,
  PATTERN_ANALYZER_TOKEN,
  RAG_INDEX_TOKEN,
  REAPER_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  SYMBOL_REPO_TOKEN,
} from "../tokens.js";

const mockLoadConfig = jest.fn<(workspaceRoot: string) => Promise<ResolvedConfig>>();
const mockInitializeSchema = jest.fn();
const mockCreateSymbolRepository = jest.fn();
const mockCreateRelationshipRepository = jest.fn();
const mockCreateFileHashRepository = jest.fn();
const mockCreateDocRegistry = jest.fn();
const mockCreateKnowledgeGraph = jest.fn();
const mockCreatePatternAnalyzer = jest.fn();
const mockCreateEventFlowAnalyzer = jest.fn();
const mockCreateRagIndex = jest.fn();
const mockCreateArchGuard = jest.fn();
const mockExpandAllLanguageGuards = jest.fn();
const mockCreateReaper = jest.fn();
const mockCreateContextMapper = jest.fn();
const mockCreateBusinessTranslator = jest.fn();
const mockCreateCodeExampleValidator = jest.fn();
const mockCreateLlmProvider = jest.fn();

const mockDb = { name: "db" };
const MockDatabase = jest.fn(() => mockDb);

jest.unstable_mockModule("better-sqlite3", () => ({
  default: MockDatabase,
}));

jest.unstable_mockModule("../../configLoader.js", () => ({
  loadConfig: mockLoadConfig,
}));

jest.unstable_mockModule("../../storage/db.js", () => ({
  initializeSchema: mockInitializeSchema,
  createSymbolRepository: mockCreateSymbolRepository,
  createRelationshipRepository: mockCreateRelationshipRepository,
  createFileHashRepository: mockCreateFileHashRepository,
}));

jest.unstable_mockModule("../../docs/docRegistry.js", () => ({
  createDocRegistry: mockCreateDocRegistry,
}));

jest.unstable_mockModule("../../knowledge/graph.js", () => ({
  createKnowledgeGraph: mockCreateKnowledgeGraph,
}));

jest.unstable_mockModule("../../patterns/patternAnalyzer.js", () => ({
  createPatternAnalyzer: mockCreatePatternAnalyzer,
}));

jest.unstable_mockModule("../../events/eventFlowAnalyzer.js", () => ({
  createEventFlowAnalyzer: mockCreateEventFlowAnalyzer,
}));

jest.unstable_mockModule("../../knowledge/rag.js", () => ({
  createRagIndex: mockCreateRagIndex,
}));

jest.unstable_mockModule("../../governance/archGuard.js", () => ({
  createArchGuard: mockCreateArchGuard,
}));

jest.unstable_mockModule("../../governance/languageGuardManager.js", () => ({
  expandAllLanguageGuards: mockExpandAllLanguageGuards,
}));

jest.unstable_mockModule("../../governance/reaper.js", () => ({
  createReaper: mockCreateReaper,
}));

jest.unstable_mockModule("../../business/contextMapper.js", () => ({
  createContextMapper: mockCreateContextMapper,
}));

jest.unstable_mockModule("../../business/businessTranslator.js", () => ({
  createBusinessTranslator: mockCreateBusinessTranslator,
}));

jest.unstable_mockModule("../../docs/codeExampleValidator.js", () => ({
  createCodeExampleValidator: mockCreateCodeExampleValidator,
}));

jest.unstable_mockModule("../../llm/provider.js", () => ({
  createLlmProvider: mockCreateLlmProvider,
}));

const createConfig = (overrides: Partial<ResolvedConfig> = {}): ResolvedConfig =>
  ({
    projectRoot: "/repo",
    include: ["src/**/*.ts"],
    exclude: ["node_modules/**"],
    respectGitignore: true,
    maxFileSize: 512_000,
    dbPath: "/repo/.docs-kit/index.db",
    promptRules: [],
    docs: [],
    coverage: { enabled: false, lcovPath: "coverage/lcov.info" },
    rag: { enabled: false, chunkSize: 500, overlapSize: 50 },
    defaultPrompts: {
      symbolPrompt: "symbol",
      docPrompt: "doc",
      changePrompt: "change",
    },
    llm: {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4",
      maxTokens: 2000,
      temperature: 0.2,
    },
    archGuard: undefined,
    ...overrides,
  }) as ResolvedConfig;

describe("setupContainer", () => {
  const mockSymbolRepo = { type: "symbol" };
  const mockRelationshipRepo = { type: "relationship" };
  const mockFileHashRepo = { type: "file-hash" };
  const mockDocRegistry = { type: "registry" };
  const mockGraph = { type: "graph" };
  const mockPatternAnalyzer = { type: "pattern" };
  const mockEventFlowAnalyzer = { type: "event" };
  const mockRagIndex = { type: "rag" };
  const mockReaper = { type: "reaper" };
  const mockContextMapper = { type: "context" };
  const mockBusinessTranslator = { type: "translator" };
  const mockCodeExampleValidator = { type: "validator" };

  const mockLlm = {
    embed: jest.fn<(...args: [string[]]) => Promise<number[][]>>().mockResolvedValue([[0.1, 0.2]]),
    chat: jest.fn(),
  };

  const mockArchGuard = {
    setRules: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateSymbolRepository.mockReturnValue(mockSymbolRepo);
    mockCreateRelationshipRepository.mockReturnValue(mockRelationshipRepo);
    mockCreateFileHashRepository.mockReturnValue(mockFileHashRepo);
    mockCreateDocRegistry.mockReturnValue(mockDocRegistry);
    mockCreateKnowledgeGraph.mockReturnValue(mockGraph);
    mockCreatePatternAnalyzer.mockReturnValue(mockPatternAnalyzer);
    mockCreateEventFlowAnalyzer.mockReturnValue(mockEventFlowAnalyzer);
    mockCreateRagIndex.mockReturnValue(mockRagIndex);
    mockCreateReaper.mockReturnValue(mockReaper);
    mockCreateContextMapper.mockReturnValue(mockContextMapper);
    mockCreateBusinessTranslator.mockReturnValue(mockBusinessTranslator);
    mockCreateCodeExampleValidator.mockReturnValue(mockCodeExampleValidator);
    mockCreateLlmProvider.mockReturnValue(mockLlm);
    mockCreateArchGuard.mockReturnValue(mockArchGuard);
  });

  it("registra dependências e aplica regras padrão", async () => {
    // Arrange
    const config = createConfig();
    mockLoadConfig.mockResolvedValue(config);

    const { setupContainer, resolve, container } = await import("../container.js");

    // Act
    await setupContainer({ cwd: "/repo", dbPath: "/custom/db.sqlite" });

    // Assert
    expect(mockLoadConfig).toHaveBeenCalledWith("/repo");
    expect(MockDatabase).toHaveBeenCalledWith("/custom/db.sqlite");
    expect(mockInitializeSchema).toHaveBeenCalledWith(mockDb);

    expect(resolve(CONFIG_TOKEN)).toBe(config);
    expect(resolve(DATABASE_TOKEN)).toBe(mockDb);
    expect(resolve(SYMBOL_REPO_TOKEN)).toBe(mockSymbolRepo);
    expect(resolve(RELATIONSHIP_REPO_TOKEN)).toBe(mockRelationshipRepo);
    expect(resolve(FILE_HASH_REPO_TOKEN)).toBe(mockFileHashRepo);
    expect(resolve(DOC_REGISTRY_TOKEN)).toBe(mockDocRegistry);
    expect(resolve(KNOWLEDGE_GRAPH_TOKEN)).toBe(mockGraph);
    expect(resolve(PATTERN_ANALYZER_TOKEN)).toBe(mockPatternAnalyzer);
    expect(resolve(EVENT_FLOW_ANALYZER_TOKEN)).toBe(mockEventFlowAnalyzer);
    expect(resolve(LLM_PROVIDER_TOKEN)).toBe(mockLlm);
    expect(resolve(RAG_INDEX_TOKEN)).toBe(mockRagIndex);
    expect(resolve(ARCH_GUARD_TOKEN)).toBe(mockArchGuard);
    expect(resolve(REAPER_TOKEN)).toBe(mockReaper);
    expect(resolve(CONTEXT_MAPPER_TOKEN)).toBe(mockContextMapper);
    expect(resolve(BUSINESS_TRANSLATOR_TOKEN)).toBe(mockBusinessTranslator);
    expect(resolve(CODE_EXAMPLE_VALIDATOR_TOKEN)).toBe(mockCodeExampleValidator);

    const ragArgs = mockCreateRagIndex.mock.calls[0]?.[0] as
      | { embeddingModel: string; embedFn: (texts: string[]) => Promise<unknown> }
      | undefined;
    expect(ragArgs).toBeDefined();
    if (!ragArgs) {
      throw new Error("createRagIndex não recebeu argumentos");
    }
    expect(ragArgs.embeddingModel).toBe("text-embedding-ada-002");
    await ragArgs.embedFn(["hello"]);
    expect(mockLlm.embed).toHaveBeenCalledWith(["hello"]);

    expect(mockCreateContextMapper).toHaveBeenCalledWith(config);
    expect(mockCreateBusinessTranslator).toHaveBeenCalledWith(mockLlm);
    expect(mockCreateCodeExampleValidator).toHaveBeenCalled();

    const setRulesArgs = mockArchGuard.setRules.mock.calls[0]?.[0];
    expect(setRulesArgs).toBeDefined();
    if (!setRulesArgs) {
      throw new Error("ArchGuard.setRules não recebeu regras");
    }
    expect(setRulesArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "ClassNaming" }),
        expect.objectContaining({ name: "MethodNaming" }),
        expect.objectContaining({ name: "FunctionNaming" }),
      ]),
    );

    const resetSpy = jest.spyOn(container, "reset");
    await setupContainer({ cwd: "/repo" });
    expect(resetSpy).toHaveBeenCalled();
    resetSpy.mockRestore();
  });

  it("expande regras de linguagem quando configurado", async () => {
    // Arrange
    const config = createConfig({
      archGuard: { languages: [{ language: "typescript" }] },
    });
    mockLoadConfig.mockResolvedValue(config);

    const expandedRules = [{ name: "LanguageRule" }];
    mockExpandAllLanguageGuards.mockReturnValue(expandedRules);

    const { setupContainer } = await import("../container.js");

    // Act
    await setupContainer({ cwd: "/repo" });

    // Assert
    expect(mockExpandAllLanguageGuards).toHaveBeenCalledWith(config.archGuard);
    expect(mockArchGuard.setRules).toHaveBeenCalledWith(expandedRules);
  });
});

describe("resetContainer", () => {
  it("limpa o container do tsyringe", async () => {
    // Arrange
    const { container, resetContainer } = await import("../container.js");
    const resetSpy = jest.spyOn(container, "reset");

    // Act
    resetContainer();

    // Assert
    expect(resetSpy).toHaveBeenCalled();
    resetSpy.mockRestore();
  });
});
