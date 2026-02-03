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

const mockBuildImpactAnalysisPrompt = jest.fn();
jest.unstable_mockModule("../../../prompts/impactAnalysis.prompt.js", () => ({
  buildImpactAnalysisPrompt: mockBuildImpactAnalysisPrompt,
}));

// Import after mocks
const { impactAnalysisUseCase } = await import("../impactAnalysis.usecase.js");

describe("impactAnalysisUseCase", () => {
  let mockDb: { close: jest.Mock };
  let mockSymbolRepo: { findByName: jest.Mock; findByIds: jest.Mock };
  let mockGraph: { getImpactRadius: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock database
    mockDb = { close: jest.fn() };

    // Setup mock symbol repository
    mockSymbolRepo = {
      findByName: jest.fn().mockReturnValue([
        {
          id: "sym-order-service",
          name: "OrderService",
          kind: "class",
          file: "src/services/order.ts",
          startLine: 1,
          endLine: 100,
        },
      ]),
      findByIds: jest.fn().mockReturnValue([
        {
          id: "sym-order-repository",
          name: "OrderRepository",
          kind: "interface",
          file: "src/repositories/order.ts",
          startLine: 1,
          endLine: 30,
        },
        {
          id: "sym-payment-gateway",
          name: "PaymentGateway",
          kind: "interface",
          file: "src/gateways/payment.ts",
          startLine: 1,
          endLine: 25,
        },
      ]),
    };

    // Setup mock knowledge graph
    mockGraph = {
      getImpactRadius: jest.fn().mockReturnValue(["sym-order-repository", "sym-payment-gateway"]),
    };

    // Mock container resolution using Symbol.for() to match the real tokens
    mockResolve.mockImplementation((token: unknown) => {
      if (token === Symbol.for("DATABASE")) return mockDb;
      if (token === Symbol.for("SYMBOL_REPO")) return mockSymbolRepo;
      if (token === Symbol.for("KNOWLEDGE_GRAPH")) return mockGraph;
      return null;
    });

    // Mock config
    mockLoadConfig.mockResolvedValue({
      dbPath: ".docs-kit/index.db",
      includePatterns: ["src/**/*.ts"],
    } as never);

    mockResolveConfigPath.mockReturnValue(".docs-kit/index.db");
    mockBuildImpactAnalysisPrompt.mockReturnValue("Impact analysis prompt for OrderService");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should analyze impact radius successfully", async () => {
    const result = await impactAnalysisUseCase({ symbolName: "OrderService" });

    expect(mockSetupContainer).toHaveBeenCalled();
    expect(mockSymbolRepo.findByName).toHaveBeenCalledWith("OrderService");
    expect(mockGraph.getImpactRadius).toHaveBeenCalledWith("sym-order-service", 3);
    expect(mockBuildImpactAnalysisPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        maxDepth: 3,
      }),
    );
    expect(result).toBe("Impact analysis prompt for OrderService");
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should use custom maxDepth", async () => {
    const result = await impactAnalysisUseCase({ symbolName: "OrderService", maxDepth: 5 });

    expect(mockGraph.getImpactRadius).toHaveBeenCalledWith("sym-order-service", 5);
    expect(result).toBe("Impact analysis prompt for OrderService");
  });

  it("should throw error when symbol name is empty", async () => {
    await expect(impactAnalysisUseCase({ symbolName: "" })).rejects.toThrow(
      "Symbol name is required",
    );
  });

  it("should return not found message when symbol does not exist", async () => {
    mockSymbolRepo.findByName.mockReturnValue([]);

    const result = await impactAnalysisUseCase({ symbolName: "NonExistentSymbol" });

    expect(result).toBe("No symbol found with name: NonExistentSymbol");
  });

  it("should close database even if analysis fails", async () => {
    mockGraph.getImpactRadius.mockImplementation(() => {
      throw new Error("Graph error");
    });

    try {
      await impactAnalysisUseCase({ symbolName: "OrderService" });
    } catch {
      // Expected
    }

    expect(mockDb.close).toHaveBeenCalled();
  });

  it("should handle symbols with no dependencies", async () => {
    mockGraph.getImpactRadius.mockReturnValue([]);
    mockSymbolRepo.findByIds.mockReturnValue([]);

    const result = await impactAnalysisUseCase({ symbolName: "OrderService" });

    expect(mockSymbolRepo.findByIds).toHaveBeenCalledWith([]);
    expect(mockBuildImpactAnalysisPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        impactedSymbols: [],
        maxDepth: 3,
      }),
    );
    expect(result).toBe("Impact analysis prompt for OrderService");
  });
});
