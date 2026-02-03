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

const mockRelationshipRowsToSymbolRelationships = jest.fn();
jest.unstable_mockModule("../../../storage/db.js", () => ({
  relationshipRowsToSymbolRelationships: mockRelationshipRowsToSymbolRelationships,
}));

// Import after mocks
const { analyzePatternsUseCase } = await import("../analyzePatterns.usecase.js");

describe("analyzePatternsUseCase", () => {
  let mockDb: { close: jest.Mock };
  let mockSymbolRepo: { findAll: jest.Mock };
  let mockRelRepo: { findAll: jest.Mock };
  let mockPatternAnalyzer: { analyze: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = { close: jest.fn() };

    mockSymbolRepo = {
      findAll: jest.fn().mockReturnValue([
        { id: "sym-1", name: "UserService", kind: "class", file: "src/user.ts" },
        { id: "sym-2", name: "UserRepository", kind: "interface", file: "src/user.ts" },
        { id: "sym-3", name: "OrderService", kind: "class", file: "src/order.ts" },
      ]),
    };

    mockRelRepo = {
      findAll: jest.fn().mockReturnValue([
        { source_id: "sym-1", target_id: "sym-2", type: "implements" },
        { source_id: "sym-3", target_id: "sym-2", type: "uses" },
      ]),
    };

    mockPatternAnalyzer = {
      analyze: jest.fn().mockReturnValue([
        {
          kind: "repository-pattern",
          symbols: ["sym-1", "sym-2"],
          confidence: 0.9,
          violations: [],
        },
      ]),
    };

    mockResolve.mockImplementation((token: unknown) => {
      if (token === Symbol.for("DATABASE")) return mockDb;
      if (token === Symbol.for("SYMBOL_REPO")) return mockSymbolRepo;
      if (token === Symbol.for("RELATIONSHIP_REPO")) return mockRelRepo;
      if (token === Symbol.for("PATTERN_ANALYZER")) return mockPatternAnalyzer;
      return null;
    });

    mockLoadConfig.mockResolvedValue({
      dbPath: ".docs-kit/index.db",
    });

    mockResolveConfigPath.mockReturnValue(".docs-kit/index.db");

    mockRelationshipRowsToSymbolRelationships.mockImplementation((rows: unknown[]) => rows);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should analyze patterns successfully", async () => {
    const result = await analyzePatternsUseCase({});

    expect(mockSetupContainer).toHaveBeenCalled();
    expect(mockSymbolRepo.findAll).toHaveBeenCalled();
    expect(mockRelRepo.findAll).toHaveBeenCalled();
    expect(mockPatternAnalyzer.analyze).toHaveBeenCalled();
    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0].kind).toBe("repository-pattern");
    expect(result.totalSymbols).toBe(3);
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should use custom dbPath", async () => {
    await analyzePatternsUseCase({ dbPath: "/custom/db.sqlite" });

    expect(mockResolveConfigPath).toHaveBeenCalledWith(
      "/custom/db.sqlite",
      expect.any(String),
      ".docs-kit/index.db",
    );
  });

  it("should return empty patterns when none found", async () => {
    mockPatternAnalyzer.analyze.mockReturnValue([]);

    const result = await analyzePatternsUseCase({});

    expect(result.patterns).toHaveLength(0);
    expect(result.totalSymbols).toBe(3);
  });

  it("should close database even if analysis fails", async () => {
    mockPatternAnalyzer.analyze.mockImplementation(() => {
      throw new Error("Analysis error");
    });

    try {
      await analyzePatternsUseCase({});
    } catch {
      // Expected
    }

    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should handle empty repository", async () => {
    mockSymbolRepo.findAll.mockReturnValue([]);
    mockRelRepo.findAll.mockReturnValue([]);
    mockPatternAnalyzer.analyze.mockReturnValue([]);

    const result = await analyzePatternsUseCase({});

    expect(result.patterns).toHaveLength(0);
    expect(result.totalSymbols).toBe(0);
  });

  it("should detect multiple patterns", async () => {
    mockPatternAnalyzer.analyze.mockReturnValue([
      { kind: "repository-pattern", symbols: ["sym-1", "sym-2"], confidence: 0.9, violations: [] },
      { kind: "factory-pattern", symbols: ["sym-3"], confidence: 0.85, violations: [] },
      {
        kind: "singleton-pattern",
        symbols: ["sym-1"],
        confidence: 0.95,
        violations: ["missing-private-constructor"],
      },
    ]);

    const result = await analyzePatternsUseCase({});

    expect(result.patterns).toHaveLength(3);
    expect(result.patterns[2].violations).toContain("missing-private-constructor");
  });
});
