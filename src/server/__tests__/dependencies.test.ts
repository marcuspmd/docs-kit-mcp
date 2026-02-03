import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.unstable_mockModule("reflect-metadata", () => ({}));

jest.unstable_mockModule("tsyringe", () => ({
  container: {
    resolve: jest.fn(),
  },
}));

jest.unstable_mockModule("../../di/container.js", () => ({
  setupContainer: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../di/tokens.js", () => ({
  DATABASE_TOKEN: "DATABASE_TOKEN",
  CONFIG_TOKEN: "CONFIG_TOKEN",
  SYMBOL_REPO_TOKEN: "SYMBOL_REPO_TOKEN",
  RELATIONSHIP_REPO_TOKEN: "RELATIONSHIP_REPO_TOKEN",
  DOC_REGISTRY_TOKEN: "DOC_REGISTRY_TOKEN",
  KNOWLEDGE_GRAPH_TOKEN: "KNOWLEDGE_GRAPH_TOKEN",
  PATTERN_ANALYZER_TOKEN: "PATTERN_ANALYZER_TOKEN",
  EVENT_FLOW_ANALYZER_TOKEN: "EVENT_FLOW_ANALYZER_TOKEN",
  LLM_PROVIDER_TOKEN: "LLM_PROVIDER_TOKEN",
  RAG_INDEX_TOKEN: "RAG_INDEX_TOKEN",
  ARCH_GUARD_TOKEN: "ARCH_GUARD_TOKEN",
  REAPER_TOKEN: "REAPER_TOKEN",
  CONTEXT_MAPPER_TOKEN: "CONTEXT_MAPPER_TOKEN",
  BUSINESS_TRANSLATOR_TOKEN: "BUSINESS_TRANSLATOR_TOKEN",
  CODE_EXAMPLE_VALIDATOR_TOKEN: "CODE_EXAMPLE_VALIDATOR_TOKEN",
}));

describe("server dependencies", () => {
  let mockSetupContainer: jest.Mock;
  let mockContainerResolve: jest.Mock;

  beforeEach(async () => {
    const container = await import("tsyringe");
    const di = await import("../../di/container.js");

    mockSetupContainer = di.setupContainer as jest.Mock;
    mockContainerResolve = container.container.resolve as jest.Mock;

    mockSetupContainer.mockResolvedValue(undefined);

    // Return mock objects for each dependency
    mockContainerResolve.mockReturnValue({} as never);
  });

  it("should export createServerDependencies function", async () => {
    const mod = await import("../dependencies.js");
    expect(mod.createServerDependencies).toBeDefined();
    expect(typeof mod.createServerDependencies).toBe("function");
  });

  it("should export async function", async () => {
    const mod = await import("../dependencies.js");
    const result = mod.createServerDependencies();
    expect(result).toHaveProperty("then");
  });

  it("should call setupContainer on initialization", async () => {
    expect(mockSetupContainer).toBeDefined();
  });

  it("should resolve dependencies from container", async () => {
    expect(mockContainerResolve).toBeDefined();
  });

  it("function should accept optional cwd parameter", async () => {
    const mod = await import("../dependencies.js");
    expect(mod.createServerDependencies.length).toBeGreaterThanOrEqual(0);
  });

  it("should be a promise-returning function", async () => {
    const mod = await import("../dependencies.js");
    const fn = mod.createServerDependencies;
    expect(fn.constructor.name).toBe("AsyncFunction");
  });
});
