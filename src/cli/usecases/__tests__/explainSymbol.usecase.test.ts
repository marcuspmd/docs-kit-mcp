import { jest } from "@jest/globals";

// Mock modules before importing the use case
const mockSetupContainer = jest.fn();
const mockResolve = jest.fn();

jest.unstable_mockModule("../../../di/container.js", () => ({
  setupContainer: mockSetupContainer,
  resolve: mockResolve,
}));

const mockLoadConfig = jest.fn();
jest.unstable_mockModule("../../../configLoader.js", () => ({
  loadConfig: mockLoadConfig,
}));

const mockResolveConfigPath = jest.fn();
jest.unstable_mockModule("../../utils/index.js", () => ({
  resolveConfigPath: mockResolveConfigPath,
}));

const mockBuildExplainSymbolContext = jest.fn();
const mockGenerateExplanationHash = jest.fn();
jest.unstable_mockModule("../../../handlers/explainSymbol.js", () => ({
  buildExplainSymbolContext: mockBuildExplainSymbolContext,
  generateExplanationHash: mockGenerateExplanationHash,
}));

const mockReadFile = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => ({
  readFile: mockReadFile,
}));

// Import after mocks
const { explainSymbolUseCase } = await import("../explainSymbol.usecase.js");

describe("explainSymbolUseCase", () => {
  let mockDb: { close: jest.Mock };
  let mockSymbolRepo: { findByName: jest.Mock; upsert: jest.Mock };
  let mockRegistry: Record<string, unknown>;
  let mockGraph: Record<string, unknown>;
  let mockLlm: { chat: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = { close: jest.fn() };

    mockSymbolRepo = {
      findByName: jest.fn().mockReturnValue([
        {
          id: "sym-1",
          name: "UserService",
          kind: "class",
          file: "src/user.ts",
          startLine: 10,
          endLine: 50,
        },
      ]),
      upsert: jest.fn(),
    };

    mockRegistry = {};
    mockGraph = {};

    mockLlm = {
      chat: jest.fn().mockResolvedValue("This is the LLM explanation for UserService."),
    };

    mockResolve.mockImplementation((token: unknown) => {
      if (token === Symbol.for("DATABASE")) return mockDb;
      if (token === Symbol.for("SYMBOL_REPO")) return mockSymbolRepo;
      if (token === Symbol.for("DOC_REGISTRY")) return mockRegistry;
      if (token === Symbol.for("KNOWLEDGE_GRAPH")) return mockGraph;
      if (token === Symbol.for("LLM_PROVIDER")) return mockLlm;
      return null;
    });

    mockLoadConfig.mockResolvedValue({
      dbPath: ".docs-kit/index.db",
      llm: {
        apiKey: "test-key",
        model: "gpt-4",
        maxTokens: 2000,
        temperature: 0.7,
      },
    });

    mockResolveConfigPath.mockReturnValue(".docs-kit/index.db");

    mockBuildExplainSymbolContext.mockResolvedValue({
      found: true,
      prompt: "Explain the UserService class...",
      needsUpdate: true,
    });

    mockGenerateExplanationHash.mockReturnValue("hash-123");
    mockReadFile.mockResolvedValue("class UserService { }");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw error when symbol name is empty", async () => {
    await expect(explainSymbolUseCase({ symbolName: "" })).rejects.toThrow(
      "Symbol name is required",
    );
  });

  it("should return not found message when symbol does not exist", async () => {
    mockBuildExplainSymbolContext.mockResolvedValue({
      found: false,
    });

    const result = await explainSymbolUseCase({ symbolName: "NonExistent" });

    expect(result).toContain("Symbol not found");
    expect(result).toContain("NonExistent");
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should return cached explanation when valid", async () => {
    mockBuildExplainSymbolContext.mockResolvedValue({
      found: true,
      cachedExplanation: "Cached explanation for UserService",
      needsUpdate: false,
    });

    const result = await explainSymbolUseCase({ symbolName: "UserService" });

    expect(result).toContain("Cached Explanation");
    expect(result).toContain("Cached explanation for UserService");
    expect(mockLlm.chat).not.toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should return prompt without LLM when useLlm is false", async () => {
    const result = await explainSymbolUseCase({ symbolName: "UserService", useLlm: false });

    expect(result).toBe("Explain the UserService class...");
    expect(mockLlm.chat).not.toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should return prompt with warning when API key not configured", async () => {
    mockLoadConfig.mockResolvedValue({
      dbPath: ".docs-kit/index.db",
      llm: {
        model: "gpt-4",
        maxTokens: 2000,
        temperature: 0.7,
      },
    });
    delete process.env.OPENAI_API_KEY;

    const result = await explainSymbolUseCase({ symbolName: "UserService" });

    expect(result).toContain("Explain the UserService class...");
    expect(result).toContain("LLM API key not configured");
    expect(mockLlm.chat).not.toHaveBeenCalled();
  });

  it("should call LLM and cache explanation", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const result = await explainSymbolUseCase({ symbolName: "UserService" });

    expect(result).toBe("This is the LLM explanation for UserService.");
    expect(mockLlm.chat).toHaveBeenCalledWith(
      [{ role: "user", content: "Explain the UserService class..." }],
      expect.objectContaining({
        maxTokens: 2000,
        temperature: 0.7,
      }),
    );
    expect(mockSymbolRepo.upsert).toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should return prompt when LLM call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockLlm.chat.mockRejectedValue(new Error("LLM API error"));

    const result = await explainSymbolUseCase({ symbolName: "UserService" });

    expect(result).toBe("Explain the UserService class...");
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should close database even if operation fails", async () => {
    mockBuildExplainSymbolContext.mockRejectedValue(new Error("Build context error"));

    try {
      await explainSymbolUseCase({ symbolName: "UserService" });
    } catch {
      // Expected
    }

    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should use custom cwd and docsDir", async () => {
    mockBuildExplainSymbolContext.mockResolvedValue({
      found: true,
      prompt: "Explain...",
      needsUpdate: true,
    });

    await explainSymbolUseCase({
      symbolName: "UserService",
      cwd: "/custom/path",
      docsDir: "custom-docs",
      useLlm: false,
    });

    expect(mockBuildExplainSymbolContext).toHaveBeenCalledWith(
      "UserService",
      expect.objectContaining({
        projectRoot: "/custom/path",
        docsDir: "custom-docs",
      }),
    );
  });

  it("should return warning message when no prompt generated", async () => {
    mockBuildExplainSymbolContext.mockResolvedValue({
      found: true,
      prompt: undefined,
      needsUpdate: false,
    });

    const result = await explainSymbolUseCase({ symbolName: "UserService" });

    expect(result).toContain("Could not generate explanation");
  });
});
