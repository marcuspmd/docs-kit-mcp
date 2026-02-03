import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../../types.js";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";

// Mock dependencies
const mockRebuild = jest.fn();
const mockRegister = jest.fn();
const mockFindByName = jest.fn();
const mockUpsert = jest.fn();
const mockFindByIds = jest.fn();
const mockGetDependencies = jest.fn();
const mockGetDependents = jest.fn();
const mockReadFileSync = jest.fn();

// Mock Handlers and Prompts
const mockBuildExplainSymbolContext = jest.fn();
const mockGenerateExplanationHash = jest.fn();
const mockBuildPrompt = jest.fn();

jest.unstable_mockModule("../../../handlers/explainSymbol.js", () => ({
  buildExplainSymbolContext: mockBuildExplainSymbolContext,
  generateExplanationHash: mockGenerateExplanationHash,
}));

jest.unstable_mockModule("../../../prompts/explainSymbol.prompt.js", () => ({
  buildExplainSymbolPromptForMcp: mockBuildPrompt,
}));

jest.unstable_mockModule("node:fs", () => ({
  readFileSync: mockReadFileSync,
}));

jest.unstable_mockModule("node:path", () => ({
  resolve: jest.fn((...args: string[]) => args.join("/")),
}));

describe("explainSymbol.tool", () => {
  let registerExplainSymbolTool: typeof import("../explainSymbol.tool.js").registerExplainSymbolTool;
  let registerUpdateSymbolExplanationTool: typeof import("../explainSymbol.tool.js").registerUpdateSymbolExplanationTool;
  
  let mockServer: McpServer;
  let mockDeps: ServerDependencies;
  let toolCallback: Function;
  let updateToolCallback: Function;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../explainSymbol.tool.js");
    registerExplainSymbolTool = mod.registerExplainSymbolTool;
    registerUpdateSymbolExplanationTool = mod.registerUpdateSymbolExplanationTool;

    mockServer = {
      registerTool: jest.fn((name, def, cb) => {
        if (name === "explainSymbol") toolCallback = cb;
        if (name === "updateSymbolExplanation") updateToolCallback = cb;
      }),
    } as unknown as McpServer;

    mockDeps = {
      config: { projectRoot: "/root" },
      registry: { rebuild: mockRebuild },
      symbolRepo: {
        findByName: mockFindByName,
        upsert: mockUpsert,
        findByIds: mockFindByIds,
      },
      graph: {
        getDependencies: mockGetDependencies,
        getDependents: mockGetDependents,
      },
    } as unknown as ServerDependencies;
  });

  describe("explainSymbol", () => {
    it("should return prompt when symbol is found and not cached", async () => {
      registerExplainSymbolTool(mockServer, mockDeps);
      
      const symbol: CodeSymbol = {
        id: "1", name: "MySymbol", kind: "class", file: "src/file.ts", startLine: 1, endLine: 5
      };

      mockRebuild.mockResolvedValue(undefined);
      mockBuildExplainSymbolContext.mockResolvedValue({
        found: true,
        needsUpdate: true,
        cachedExplanation: null,
      });
      mockFindByName.mockReturnValue([symbol]);
      mockGetDependencies.mockReturnValue([]);
      mockGetDependents.mockReturnValue([]);
      mockFindByIds.mockReturnValue([]);
      mockReadFileSync.mockReturnValue("line1\nline2\nline3\nline4\nline5");
      mockBuildPrompt.mockReturnValue("AI Prompt");

      const result = await toolCallback({ symbol: "MySymbol", docsDir: "docs" });

      expect(mockRebuild).toHaveBeenCalledWith("docs");
      expect(mockBuildExplainSymbolContext).toHaveBeenCalled();
      expect(mockBuildPrompt).toHaveBeenCalled();
      expect(result).toEqual({
        content: [{ type: "text", text: "AI Prompt" }],
      });
    });

    it("should return cached explanation if valid", async () => {
      registerExplainSymbolTool(mockServer, mockDeps);

      mockRebuild.mockResolvedValue(undefined);
      mockBuildExplainSymbolContext.mockResolvedValue({
        found: true,
        needsUpdate: false,
        cachedExplanation: "Cached Explanation",
      });

      const result = await toolCallback({ symbol: "MySymbol", docsDir: "docs" });

      expect(result.content[0].text).toContain("Cached Explanation");
    });

    it("should return error if symbol not found", async () => {
      registerExplainSymbolTool(mockServer, mockDeps);

      mockRebuild.mockResolvedValue(undefined);
      mockBuildExplainSymbolContext.mockResolvedValue({ found: false });

      const result = await toolCallback({ symbol: "Missing", docsDir: "docs" });

      expect(result.content[0].text).toContain("No symbol or documentation found");
    });

    it("should handle errors", async () => {
        registerExplainSymbolTool(mockServer, mockDeps);
        mockRebuild.mockRejectedValue(new Error("Registry Error"));
        
        const result = await toolCallback({ symbol: "Error", docsDir: "docs" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Registry Error");
    });
  });

  describe("updateSymbolExplanation", () => {
    it("should update explanation for existing symbol", async () => {
      registerUpdateSymbolExplanationTool(mockServer, mockDeps);
      
      const symbol: CodeSymbol = {
        id: "1", name: "MySymbol", kind: "class", file: "src/file.ts", startLine: 1, endLine: 5
      };

      mockFindByName.mockReturnValue([symbol]);
      mockReadFileSync.mockReturnValue("code");
      mockGenerateExplanationHash.mockReturnValue("hash123");

      const result = await updateToolCallback({ symbol: "MySymbol", explanation: "New Explanation" });

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        id: "1",
        explanation: "New Explanation",
        explanationHash: "hash123"
      }));
      expect(result.content[0].text).toContain("Explanation cached");
    });

    it("should return error if symbol not found", async () => {
      registerUpdateSymbolExplanationTool(mockServer, mockDeps);
      mockFindByName.mockReturnValue([]);

      const result = await updateToolCallback({ symbol: "Missing", explanation: "Exp" });

      expect(result.content[0].text).toContain("Symbol not found");
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });
});
