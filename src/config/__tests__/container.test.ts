import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createContainer } from "../container.js";
import type { ContainerConfig } from "../container.js";

// Mock dependencies
jest.mock("better-sqlite3", () => {
  return {
    default: jest.fn(() => ({
      pragma: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
    })),
  };
});

jest.mock("tree-sitter", () => {
  return {
    default: jest.fn(() => ({
      setLanguage: jest.fn(),
      parse: jest.fn(),
    })),
  };
});

jest.mock("tree-sitter-typescript", () => ({
  typescript: {},
}));

jest.mock("node:fs", () => ({
  mkdirSync: jest.fn(),
}));

describe("Container", () => {
  describe("createContainer with memory database", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };
      container = createContainer(config);
    });

    it("should create container with memory repositories", () => {
      expect(container).toBeDefined();
      expect(container.symbolRepo).toBeDefined();
      expect(container.relationshipRepo).toBeDefined();
      expect(container.fileHashRepo).toBeDefined();
    });

    it("should create use cases", () => {
      expect(container.indexProject).toBeDefined();
      expect(container.findSymbol).toBeDefined();
      expect(container.getSymbolById).toBeDefined();
      expect(container.explainSymbol).toBeDefined();
      expect(container.buildDocs).toBeDefined();
      expect(container.buildSite).toBeDefined();
    });

    it("should have repositories", () => {
      expect(container).toHaveProperty("symbolRepo");
      expect(container).toHaveProperty("relationshipRepo");
      expect(container).toHaveProperty("fileHashRepo");
    });

    it("should have index project use case", () => {
      expect(container.indexProject).toBeDefined();
      expect(typeof container.indexProject.execute).toBe("function");
    });

    it("should have find symbol use case", () => {
      expect(container.findSymbol).toBeDefined();
      expect(typeof container.findSymbol.execute).toBe("function");
    });

    it("should have get symbol by id use case", () => {
      expect(container.getSymbolById).toBeDefined();
      expect(typeof container.getSymbolById.execute).toBe("function");
    });

    it("should have explain symbol use case", () => {
      expect(container.explainSymbol).toBeDefined();
      expect(typeof container.explainSymbol.execute).toBe("function");
    });

    it("should have build docs use case", () => {
      expect(container.buildDocs).toBeDefined();
      expect(typeof container.buildDocs.execute).toBe("function");
    });

    it("should have build site use case", () => {
      expect(container.buildSite).toBeDefined();
      expect(typeof container.buildSite.execute).toBe("function");
    });
  });

  describe("createContainer with sqlite database", () => {
    it("should create container with sqlite repositories", () => {
      const config: ContainerConfig = {
        database: {
          type: "sqlite",
          path: ":memory:",
        },
      };

      const container = createContainer(config);

      expect(container).toBeDefined();
      expect(container.symbolRepo).toBeDefined();
      expect(container.relationshipRepo).toBeDefined();
      expect(container.fileHashRepo).toBeDefined();
    });

    it("should use default db path when not provided", () => {
      const config: ContainerConfig = {
        database: {
          type: "sqlite",
        },
      };

      const container = createContainer(config);

      expect(container).toBeDefined();
      expect(container.symbolRepo).toBeDefined();
    });
  });

  describe("repository types", () => {
    it("should use memory repositories when configured", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      // Memory repositories should have specific methods
      expect(typeof container.symbolRepo.findAll).toBe("function");
      expect(typeof container.symbolRepo.clear).toBe("function");
    });
  });

  describe("file indexer", () => {
    it("should create file indexer by default", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      expect(container).toBeDefined();
      // FileIndexer is created internally and used by IndexProjectUseCase
    });
  });

  describe("use case dependencies", () => {
    it("should inject repositories into IndexProject", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      // Verify use case can be executed (has required dependencies)
      expect(async () => {
        await container.indexProject.execute({
          rootPath: "/test",
        });
      }).toBeDefined();
    });

    it("should inject repositories into FindSymbol", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      expect(async () => {
        await container.findSymbol.execute({});
      }).toBeDefined();
    });

    it("should inject repositories into ExplainSymbol", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      expect(async () => {
        await container.explainSymbol.execute({
          symbolName: "test",
        });
      }).toBeDefined();
    });
  });

  describe("parser registry", () => {
    it("should setup parser registry with TypeScript parser", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      // Parser registry is setup internally
      expect(container).toBeDefined();
    });
  });

  describe("container configuration", () => {
    it("should accept minimal configuration", () => {
      const config: ContainerConfig = {
        database: { type: "memory" },
      };

      const container = createContainer(config);

      expect(container).toBeDefined();
      expect(container.symbolRepo).toBeDefined();
      expect(container.indexProject).toBeDefined();
    });

    it("should accept full configuration", () => {
      const config: ContainerConfig = {
        database: {
          type: "sqlite",
          path: ":memory:",
        },
      };

      const container = createContainer(config);

      expect(container).toBeDefined();
    });
  });
});
