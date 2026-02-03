import { jest } from "@jest/globals";
import { CodeSymbol } from "../../../indexer/symbol.types.js";

interface Config {
  include: string[];
  exclude: string[];
  dbPath: string;
  projectRoot: string;
  coverage: { enabled: boolean; lcovPath?: string };
  rag: { enabled: boolean; chunkSize?: number; overlapSize?: number };
  llm: { model: string; embeddingModel?: string };
  archGuard?: { languages: { language: string; preset: string }[] };
}

// Mock modules before importing
const mockSetupContainer = jest.fn();
const mockResolve = jest.fn() as jest.MockedFunction<(token: symbol) => unknown>;

jest.unstable_mockModule("../../../di/container.js", () => ({
  setupContainer: mockSetupContainer,
  resolve: mockResolve,
}));

const mockConfigExists = jest.fn() as jest.MockedFunction<() => boolean>;
const mockCreateDefaultConfig = jest.fn() as jest.MockedFunction<() => string>;
const mockLoadConfig = jest.fn() as jest.MockedFunction<() => Promise<Config>>;

jest.unstable_mockModule("../../../configLoader.js", () => ({
  configExists: mockConfigExists,
  createDefaultConfig: mockCreateDefaultConfig,
  loadConfig: mockLoadConfig,
}));

const mockFg = jest.fn() as jest.MockedFunction<
  (patterns: string[], options?: { ignore: string[] }) => Promise<string[]>
>;
jest.unstable_mockModule("fast-glob", () => ({
  default: mockFg,
}));

const mockFs = {
  existsSync: jest.fn() as jest.MockedFunction<(path: string) => boolean>,
  mkdirSync: jest.fn() as jest.MockedFunction<
    (path: string, options?: { recursive: boolean }) => void
  >,
  readFileSync: jest.fn() as jest.MockedFunction<(path: string, encoding?: string) => string>,
  statSync: jest.fn() as jest.MockedFunction<(path: string) => { mtime: Date }>,
};
jest.unstable_mockModule("node:fs", () => ({
  default: mockFs,
}));

const mockIndexFile = jest.fn();
jest.unstable_mockModule("../../../indexer/indexer.js", () => ({
  indexFile: mockIndexFile,
}));

const mockExtractRelationships = jest.fn();
jest.unstable_mockModule("../../../indexer/relationshipExtractor.js", () => ({
  extractRelationships: mockExtractRelationships,
}));

const mockParseLcov = jest.fn() as jest.MockedFunction<
  () => Promise<{ file: string; lines: number[] }[]>
>;
jest.unstable_mockModule("../../../indexer/lcovCollector.js", () => ({
  parseLcov: mockParseLcov,
}));

const mockCollectMetrics = jest.fn() as jest.MockedFunction<
  (opts: { symbols: CodeSymbol[] }) => CodeSymbol[]
>;
jest.unstable_mockModule("../../../indexer/metricsCollector.js", () => ({
  collectMetrics: mockCollectMetrics,
}));

const mockCreateRagIndex = jest.fn();
jest.unstable_mockModule("../../../knowledge/rag.js", () => ({
  createRagIndex: mockCreateRagIndex,
}));

const mockGenerateExplanationHash = jest.fn();
jest.unstable_mockModule("../../../handlers/explainSymbol.js", () => ({
  generateExplanationHash: mockGenerateExplanationHash,
}));

const mockInitializeSchema = jest.fn();
const mockReplaceAllPatterns = jest.fn();
const mockReplaceAllArchViolations = jest.fn();
const mockReplaceAllReaperFindings = jest.fn();
jest.unstable_mockModule("../../../storage/db.js", () => ({
  initializeSchema: mockInitializeSchema,
  replaceAllPatterns: mockReplaceAllPatterns,
  replaceAllArchViolations: mockReplaceAllArchViolations,
  replaceAllReaperFindings: mockReplaceAllReaperFindings,
}));

const mockHeader = jest.fn();
const mockStep = jest.fn();
const mockDone = jest.fn();
const mockSummary = jest.fn();
const mockResolveConfigPath = jest.fn();
const mockIsLlmConfigured = jest.fn();

jest.unstable_mockModule("../../utils/index.js", () => ({
  header: mockHeader,
  step: mockStep,
  done: mockDone,
  summary: mockSummary,
  resolveConfigPath: mockResolveConfigPath,
  isLlmConfigured: mockIsLlmConfigured,
}));

// Mock Parser
const mockParse = jest.fn();
const MockParser = jest.fn().mockImplementation(() => ({
  parse: mockParse,
  setLanguage: jest.fn(),
}));
jest.unstable_mockModule("tree-sitter", () => ({
  default: MockParser,
}));

// Mock governance modules
const mockBuildLanguageGuardResult = jest.fn();
jest.unstable_mockModule("../../../governance/languageGuardManager.js", () => ({
  buildLanguageGuardResult: mockBuildLanguageGuardResult,
}));

const mockBuildArchGuardBaseRules = jest.fn();
jest.unstable_mockModule("../../../governance/archGuardBase.js", () => ({
  buildArchGuardBaseRules: mockBuildArchGuardBaseRules,
}));

// Import after mocks
const { indexUseCase } = await import("../index.usecase.js");

describe("indexUseCase", () => {
  let mockDb: {
    close: jest.MockedFunction<() => void>;
    prepare: jest.MockedFunction<(sql: string) => { run: jest.Mock; all: jest.Mock }>;
    transaction: jest.MockedFunction<(fn: () => void) => () => void>;
  };
  let mockSymbolRepo: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByFile: jest.Mock;
    deleteByFile: jest.Mock;
    upsert: jest.Mock;
  };
  let mockRelRepo: {
    findAll: jest.Mock;
    deleteBySource: jest.Mock;
    upsert: jest.Mock;
  };
  let mockFileHashRepo: {
    getAll: jest.Mock;
    get: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    clear: jest.Mock;
  };
  let mockPatternAnalyzer: { analyze: jest.Mock };
  let mockRegistry: { rebuild: jest.Mock; findAllDocs: jest.Mock };
  let mockGraph: Record<string, unknown>;
  let mockArchGuard: { setRules: jest.Mock; analyze: jest.Mock };
  let mockReaper: { scan: jest.Mock };
  let mockLlm: { embed: jest.MockedFunction<(texts: string[]) => Promise<number[][]>> };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      close: jest.fn() as jest.MockedFunction<() => void>,
      prepare: jest.fn() as jest.MockedFunction<
        (sql: string) => { run: jest.Mock; all: jest.Mock }
      >,
      transaction: jest.fn() as jest.MockedFunction<(fn: () => void) => () => void>,
    };

    mockDb.transaction.mockImplementation((fn: () => void) => {
      return () => fn();
    });

    mockDb.prepare.mockReturnValue({
      run: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    });

    mockSymbolRepo = {
      findAll: jest.fn().mockReturnValue([]),
      findById: jest.fn().mockReturnValue(null),
      findByFile: jest.fn().mockReturnValue([]),
      deleteByFile: jest.fn(),
      upsert: jest.fn(),
    };

    mockRelRepo = {
      findAll: jest.fn().mockReturnValue([]),
      deleteBySource: jest.fn(),
      upsert: jest.fn(),
    };

    mockFileHashRepo = {
      getAll: jest.fn().mockReturnValue([]),
      get: jest.fn().mockReturnValue(null),
      upsert: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    };

    mockPatternAnalyzer = {
      analyze: jest.fn().mockReturnValue([]),
    };

    mockRegistry = {
      rebuild: jest.fn(),
      findAllDocs: jest.fn().mockReturnValue([]),
    };

    mockGraph = {};

    mockArchGuard = {
      setRules: jest.fn(),
      analyze: jest.fn().mockReturnValue([]),
    };

    mockReaper = {
      scan: jest.fn().mockReturnValue([]),
    };

    mockLlm = {
      embed: jest.fn() as jest.MockedFunction<(texts: string[]) => Promise<number[][]>>,
    };

    mockLlm.embed.mockResolvedValue([[0.1, 0.2]]);

    mockResolve.mockImplementation((token: symbol) => {
      if (token === Symbol.for("DATABASE")) return mockDb;
      if (token === Symbol.for("SYMBOL_REPO")) return mockSymbolRepo;
      if (token === Symbol.for("RELATIONSHIP_REPO")) return mockRelRepo;
      if (token === Symbol.for("FILE_HASH_REPO")) return mockFileHashRepo;
      if (token === Symbol.for("PATTERN_ANALYZER")) return mockPatternAnalyzer;
      if (token === Symbol.for("DOC_REGISTRY")) return mockRegistry;
      if (token === Symbol.for("KNOWLEDGE_GRAPH")) return mockGraph;
      if (token === Symbol.for("ARCH_GUARD")) return mockArchGuard;
      if (token === Symbol.for("REAPER")) return mockReaper;
      if (token === Symbol.for("LLM_PROVIDER")) return mockLlm;
      return null;
    });

    mockConfigExists.mockReturnValue(true);
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: ["**/node_modules/**"],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
    });

    mockResolveConfigPath.mockReturnValue(".docs-kit/index.db");
    mockIsLlmConfigured.mockReturnValue(false);

    mockFg.mockResolvedValue([]);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockReturnValue("const x = 1;");
    mockFs.statSync.mockReturnValue({ mtime: new Date() });

    mockIndexFile.mockReturnValue([]);
    mockExtractRelationships.mockReturnValue([]);
    mockCollectMetrics.mockImplementation((opts: { symbols: CodeSymbol[] }) => opts.symbols);
    mockParse.mockReturnValue({});
    mockBuildArchGuardBaseRules.mockReturnValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create default config if not exists", async () => {
    mockConfigExists.mockReturnValue(false);
    mockCreateDefaultConfig.mockReturnValue("/test/docs.config.js");

    await indexUseCase({ rootDir: "." });

    expect(mockCreateDefaultConfig).toHaveBeenCalled();
  });

  it("should setup container with correct paths", async () => {
    await indexUseCase({ rootDir: "." });

    expect(mockSetupContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        dbPath: ".docs-kit/index.db",
      }),
    );
  });

  it("should scan for source files", async () => {
    mockFg.mockResolvedValue(["src/index.ts", "src/utils.ts"]);

    await indexUseCase({ rootDir: "." });

    expect(mockFg).toHaveBeenCalledWith(
      ["**/*.ts"],
      expect.objectContaining({
        ignore: ["**/node_modules/**"],
      }),
    );
  });

  it("should clear hashes on fullRebuild", async () => {
    await indexUseCase({ rootDir: ".", fullRebuild: true });

    expect(mockFileHashRepo.clear).toHaveBeenCalled();
  });

  it("should close database at the end", async () => {
    await indexUseCase({ rootDir: "." });

    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should detect and remove stale files", async () => {
    mockFileHashRepo.getAll.mockReturnValue([
      { filePath: "src/old-file.ts" },
      { filePath: "src/existing.ts" },
    ]);
    mockFg.mockResolvedValue(["src/existing.ts"]);

    await indexUseCase({ rootDir: "." });

    expect(mockSymbolRepo.deleteByFile).toHaveBeenCalledWith("src/old-file.ts");
    expect(mockRelRepo.deleteBySource).toHaveBeenCalledWith("src/old-file.ts");
    expect(mockFileHashRepo.delete).toHaveBeenCalledWith("src/old-file.ts");
  });

  it("should skip unchanged files in incremental mode", async () => {
    mockFg.mockResolvedValue(["src/unchanged.ts"]);
    mockFileHashRepo.get.mockReturnValue({
      contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
    mockFs.readFileSync.mockReturnValue("");

    await indexUseCase({ rootDir: "." });

    expect(mockIndexFile).not.toHaveBeenCalled();
  });

  it("should index new files", async () => {
    mockFg.mockResolvedValue(["src/new-file.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "TestClass", kind: "class", file: "src/new-file.ts" },
    ]);

    await indexUseCase({ rootDir: "." });

    expect(mockIndexFile).toHaveBeenCalled();
    expect(mockSymbolRepo.upsert).toHaveBeenCalled();
  });

  it("should extract relationships", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([{ id: "sym-1", name: "A", kind: "class", file: "src/test.ts" }]);
    mockExtractRelationships.mockReturnValue([
      { sourceId: "sym-1", targetId: "sym-2", type: "uses" },
    ]);

    await indexUseCase({ rootDir: "." });

    expect(mockExtractRelationships).toHaveBeenCalled();
    expect(mockRelRepo.upsert).toHaveBeenCalled();
  });

  it("should detect patterns", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "UserService", kind: "class", file: "src/test.ts" },
    ]);
    mockPatternAnalyzer.analyze.mockReturnValue([
      { kind: "singleton", symbols: ["sym-1"], confidence: 0.9, violations: [] },
    ]);

    await indexUseCase({ rootDir: "." });

    expect(mockPatternAnalyzer.analyze).toHaveBeenCalled();
    expect(mockReplaceAllPatterns).toHaveBeenCalled();
  });

  it("should run governance checks", async () => {
    await indexUseCase({ rootDir: "." });

    expect(mockArchGuard.analyze).toHaveBeenCalled();
    expect(mockReaper.scan).toHaveBeenCalled();
    expect(mockReplaceAllArchViolations).toHaveBeenCalled();
    expect(mockReplaceAllReaperFindings).toHaveBeenCalled();
  });

  it("should scan docs directory if exists", async () => {
    mockFs.existsSync.mockImplementation((p: string) => {
      if (p.includes("docs")) return true;
      return true;
    });

    await indexUseCase({ rootDir: "." });

    expect(mockRegistry.rebuild).toHaveBeenCalled();
  });

  it("should use custom dbPath", async () => {
    await indexUseCase({ rootDir: ".", dbPath: "/custom/path/index.db" });

    expect(mockResolveConfigPath).toHaveBeenCalledWith(
      "/custom/path/index.db",
      expect.any(String),
      ".docs-kit/index.db",
    );
  });

  it("should create db directory if not exists", async () => {
    mockFs.existsSync.mockImplementation((p: string) => {
      if (p.includes(".docs-kit")) return false;
      return true;
    });

    await indexUseCase({ rootDir: "." });

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ recursive: true }),
    );
  });

  it("should report summary at the end", async () => {
    await indexUseCase({ rootDir: "." });

    expect(mockHeader).toHaveBeenCalledWith("Index Summary");
    expect(mockSummary).toHaveBeenCalled();
  });

  // Additional tests for full coverage

  it("should hash files in fullRebuild mode", async () => {
    mockFg.mockResolvedValue(["src/file.ts"]);
    mockFs.readFileSync.mockReturnValue("const y = 2;");
    mockIndexFile.mockReturnValue([]);

    await indexUseCase({ rootDir: ".", fullRebuild: true });

    expect(mockFileHashRepo.upsert).toHaveBeenCalled();
  });

  it("should handle index errors gracefully", async () => {
    mockFg.mockResolvedValue(["src/bad-file.ts"]);
    mockFs.readFileSync.mockImplementation((_p: string) => {
      throw new Error("File read error");
    });

    await indexUseCase({ rootDir: "." });

    // Should not throw, errors are collected
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should populate references for source and target symbols", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "A", kind: "class", file: "src/test.ts" },
      { id: "sym-2", name: "B", kind: "class", file: "src/test.ts" },
    ]);
    mockExtractRelationships.mockReturnValue([
      { sourceId: "sym-1", targetId: "sym-2", type: "uses" },
    ]);

    await indexUseCase({ rootDir: "." });

    expect(mockSymbolRepo.upsert).toHaveBeenCalled();
  });

  it("should load coverage data when enabled", async () => {
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: true, lcovPath: "coverage/lcov.info" },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
    });
    mockFs.existsSync.mockReturnValue(true);
    mockParseLcov.mockResolvedValue([{ file: "src/test.ts", lines: [] }]);

    await indexUseCase({ rootDir: "." });

    expect(mockParseLcov).toHaveBeenCalled();
  });

  it("should warn when lcov file not found", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: true, lcovPath: "coverage/lcov.info" },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
    });
    mockFs.existsSync.mockImplementation((p: string) => {
      if (p.includes("lcov")) return false;
      return true;
    });

    await indexUseCase({ rootDir: "." });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("lcov file not found"));
    consoleSpy.mockRestore();
  });

  it("should handle lcov parse errors", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: true, lcovPath: "coverage/lcov.info" },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
    });
    mockFs.existsSync.mockReturnValue(true);
    mockParseLcov.mockRejectedValue(new Error("Parse error"));

    await indexUseCase({ rootDir: "." });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse lcov"));
    consoleSpy.mockRestore();
  });

  it("should preserve explanation when hash matches", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "A", kind: "class", file: "src/test.ts", startLine: 1, endLine: 10 },
    ]);
    mockSymbolRepo.findById.mockReturnValue({
      id: "sym-1",
      explanation: "Existing explanation",
      explanationHash: "hash-123",
    });
    mockFs.readFileSync.mockReturnValue("class A {}");
    mockGenerateExplanationHash.mockReturnValue("hash-123");

    await indexUseCase({ rootDir: "." });

    expect(mockSymbolRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: "Existing explanation",
      }),
    );
  });

  it("should clear explanation when hash does not match", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "A", kind: "class", file: "src/test.ts", startLine: 1, endLine: 10 },
    ]);
    mockSymbolRepo.findById.mockReturnValue({
      id: "sym-1",
      explanation: "Old explanation",
      explanationHash: "old-hash",
    });
    mockFs.readFileSync.mockReturnValue("class A { updated }");
    mockGenerateExplanationHash.mockReturnValue("new-hash");

    await indexUseCase({ rootDir: "." });

    expect(mockSymbolRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: undefined,
        explanationHash: undefined,
      }),
    );
  });

  it("should handle explanation hash check errors", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "A", kind: "class", file: "src/test.ts", startLine: 1, endLine: 10 },
    ]);
    mockSymbolRepo.findById.mockReturnValue({
      id: "sym-1",
      explanation: "Explanation",
      explanationHash: "hash",
    });

    let readCount = 0;
    mockFs.readFileSync.mockImplementation((_p: string) => {
      readCount++;
      // First read (indexing) succeeds, second read (hash check) fails
      if (readCount === 1) {
        return "const x = 1;";
      }
      throw new Error("File not found");
    });

    await indexUseCase({ rootDir: "." });

    expect(mockSymbolRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: undefined,
        explanationHash: undefined,
      }),
    );
  });

  it("should process doc mappings", async () => {
    const mockPreparedStatement = {
      run: jest.fn(),
      all: jest.fn().mockReturnValue([{ symbol_name: "TestClass", doc_path: "docs/test.md" }]),
    };
    mockDb.prepare.mockReturnValue(mockPreparedStatement);
    mockRegistry.findAllDocs.mockReturnValue([{ path: "docs/test.md" }]);

    await indexUseCase({ rootDir: "." });

    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it("should use language-specific arch guard when configured", async () => {
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
      archGuard: {
        languages: [{ language: "typescript", preset: "strict" }],
      },
    });
    mockBuildLanguageGuardResult.mockReturnValue({
      rules: [],
      filterViolations: (v: unknown[]) => v,
    });

    await indexUseCase({ rootDir: "." });

    expect(mockBuildLanguageGuardResult).toHaveBeenCalled();
  });

  it("should display arch violations when present", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    mockArchGuard.analyze.mockReturnValue([
      { rule: "no-any", file: "src/test.ts", message: "Avoid any", severity: "error" },
    ]);

    await indexUseCase({ rootDir: "." });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Arch Guard violations"));
    consoleSpy.mockRestore();
  });

  it("should truncate violations list when more than 15", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const violations = Array.from({ length: 20 }, (_, i) => ({
      rule: `rule-${i}`,
      file: `src/file${i}.ts`,
      message: `Message ${i}`,
      severity: "error",
    }));
    mockArchGuard.analyze.mockReturnValue(violations);

    await indexUseCase({ rootDir: "." });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("... and 5 more"));
    consoleSpy.mockRestore();
  });

  it("should populate RAG index when enabled and LLM configured", async () => {
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: true, chunkSize: 500, overlapSize: 50 },
      llm: { model: "gpt-4", embeddingModel: "text-embedding-ada-002" },
    });
    mockIsLlmConfigured.mockReturnValue(true);
    const mockRagIndex = {
      indexSymbols: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      indexDocs: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      chunkCount: jest.fn() as jest.MockedFunction<() => number>,
    };
    mockRagIndex.indexSymbols.mockResolvedValue(undefined);
    mockRagIndex.indexDocs.mockResolvedValue(undefined);
    mockRagIndex.chunkCount.mockReturnValue(10);
    mockCreateRagIndex.mockReturnValue(mockRagIndex);

    await indexUseCase({ rootDir: "." });

    expect(mockCreateRagIndex).toHaveBeenCalled();
    expect(mockRagIndex.indexSymbols).toHaveBeenCalled();
  });

  it("should handle RAG index errors gracefully", async () => {
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: true },
      llm: { model: "gpt-4" },
    });
    mockIsLlmConfigured.mockReturnValue(true);
    mockCreateRagIndex.mockImplementation(() => {
      throw new Error("RAG init failed");
    });

    await indexUseCase({ rootDir: "." });

    expect(mockDone).toHaveBeenCalledWith(expect.stringContaining("skipped"));
  });

  it("should report summary with kind counts", async () => {
    mockFg.mockResolvedValue(["src/test.ts"]);
    mockFileHashRepo.get.mockReturnValue(null);
    mockIndexFile.mockReturnValue([
      { id: "sym-1", name: "A", kind: "class", file: "src/test.ts" },
      { id: "sym-2", name: "B", kind: "class", file: "src/test.ts" },
      { id: "sym-3", name: "fn", kind: "function", file: "src/test.ts" },
    ]);

    await indexUseCase({ rootDir: "." });

    expect(mockSummary).toHaveBeenCalledWith(
      expect.arrayContaining([expect.arrayContaining(["Symbols", 3])]),
    );
  });

  it("should use language guard and filter violations when archGuard.languages is configured", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
      archGuard: {
        languages: [{ language: "typescript", preset: "strict" }],
      },
    });

    const mockViolations = [
      { rule: "no-any", file: "src/test.ts", message: "Avoid any", severity: "error" },
    ];
    mockArchGuard.analyze.mockReturnValue(mockViolations);
    mockBuildLanguageGuardResult.mockReturnValue({
      rules: [{ name: "no-any" }],
      filterViolations: (v: unknown[]) => v,
    });

    await indexUseCase({ rootDir: "." });

    expect(mockBuildLanguageGuardResult).toHaveBeenCalled();
    expect(mockArchGuard.setRules).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Arch Guard violations"));
    consoleSpy.mockRestore();
  });

  it("should handle more than 15 violations with language guard", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: false },
      llm: { model: "gpt-4" },
      archGuard: {
        languages: [{ language: "typescript", preset: "strict" }],
      },
    });

    const violations = Array.from({ length: 20 }, (_, i) => ({
      rule: `rule-${i}`,
      file: `src/file${i}.ts`,
      message: `Message ${i}`,
      severity: "error",
    }));
    mockArchGuard.analyze.mockReturnValue(violations);
    mockBuildLanguageGuardResult.mockReturnValue({
      rules: [],
      filterViolations: (v: unknown[]) => v,
    });

    await indexUseCase({ rootDir: "." });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("... and 5 more"));
    consoleSpy.mockRestore();
  });

  it("should index docs in RAG when docs directory exists", async () => {
    mockLoadConfig.mockResolvedValue({
      include: ["**/*.ts"],
      exclude: [],
      dbPath: ".docs-kit/index.db",
      projectRoot: "/test",
      coverage: { enabled: false },
      rag: { enabled: true },
      llm: { model: "gpt-4" },
    });
    mockIsLlmConfigured.mockReturnValue(true);
    mockFs.existsSync.mockReturnValue(true);
    const mockRagIndex = {
      indexSymbols: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      indexDocs: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      chunkCount: jest.fn() as jest.MockedFunction<() => number>,
    };
    mockRagIndex.indexSymbols.mockResolvedValue(undefined);
    mockRagIndex.indexDocs.mockResolvedValue(undefined);
    mockRagIndex.chunkCount.mockReturnValue(10);
    mockCreateRagIndex.mockReturnValue(mockRagIndex);

    await indexUseCase({ rootDir: "." });

    expect(mockRagIndex.indexDocs).toHaveBeenCalled();
  });

  it("should report errors when indexing fails for multiple files", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockFg.mockResolvedValue([
      "src/bad1.ts",
      "src/bad2.ts",
      "src/bad3.ts",
      "src/bad4.ts",
      "src/bad5.ts",
      "src/bad6.ts",
    ]);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error("Cannot read file");
    });

    await indexUseCase({ rootDir: "." });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Index errors"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("... and 1 more"));
    consoleSpy.mockRestore();
  });
});
