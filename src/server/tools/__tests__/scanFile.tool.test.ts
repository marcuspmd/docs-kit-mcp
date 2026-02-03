import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../../types.js";

// Mocks
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockResolve = jest.fn();
const mockDirname = jest.fn();
const mockIndexFile = jest.fn();
const mockScanFileAndCreateDocs = jest.fn();
const mockSetLanguage = jest.fn();

// Mock Parser class
class MockParser {
  setLanguage = mockSetLanguage;
}

jest.unstable_mockModule("node:fs", () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
}));

jest.unstable_mockModule("node:path", () => ({
  resolve: mockResolve,
  dirname: mockDirname,
}));

jest.unstable_mockModule("tree-sitter", () => ({
  default: MockParser,
}));

jest.unstable_mockModule("tree-sitter-typescript", () => ({
  default: { typescript: "typescript-grammar" },
}));

jest.unstable_mockModule("../../../indexer/indexer.js", () => ({
  indexFile: mockIndexFile,
}));

jest.unstable_mockModule("../../../docs/docScanner.js", () => ({
  scanFileAndCreateDocs: mockScanFileAndCreateDocs,
}));

describe("scanFile.tool", () => {
  let registerScanFileTool: typeof import("../scanFile.tool.js").registerScanFileTool;
  let mockServer: McpServer;
  let mockDeps: ServerDependencies;
  let toolCallback: Function;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../scanFile.tool.js");
    registerScanFileTool = mod.registerScanFileTool;

    mockServer = {
      registerTool: jest.fn((name, def, cb) => {
        if (name === "scanFile") toolCallback = cb;
      }),
    } as unknown as McpServer;

    mockDeps = {
      config: { projectRoot: "/root" },
      registry: {}, // Mock as needed
    } as unknown as ServerDependencies;

    mockResolve.mockImplementation((p) => `/root/${p}`);
    mockDirname.mockReturnValue("/root/db");
  });

  it("should register scanFile tool", () => {
    registerScanFileTool(mockServer, mockDeps);
    expect(mockServer.registerTool).toHaveBeenCalledWith("scanFile", expect.any(Object), expect.any(Function));
  });

  it("should create docs for new symbols", async () => {
    registerScanFileTool(mockServer, mockDeps);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("const x = 1;");
    mockIndexFile.mockReturnValue([{ name: "x" }]);
    mockScanFileAndCreateDocs.mockResolvedValue({
      createdCount: 1,
      createdSymbols: ["x"],
    });

    const result = await toolCallback({ filePath: "src/test.ts", docsDir: "docs", dbPath: "db/reg.db" });

    expect(mockReadFileSync).toHaveBeenCalledWith("/root/src/test.ts", "utf-8");
    expect(mockIndexFile).toHaveBeenCalled();
    expect(mockScanFileAndCreateDocs).toHaveBeenCalled();
    expect(result.content[0].text).toContain("Created documentation for 1 symbols");
    expect(result.content[0].text).toContain("- x");
  });

  it("should handle no new symbols", async () => {
    registerScanFileTool(mockServer, mockDeps);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("const x = 1;");
    mockIndexFile.mockReturnValue([{ name: "x" }]);
    mockScanFileAndCreateDocs.mockResolvedValue({
      createdCount: 0,
      createdSymbols: [],
    });

    const result = await toolCallback({ filePath: "src/test.ts", docsDir: "docs", dbPath: "db/reg.db" });

    expect(result.content[0].text).toContain("No new symbols to document");
  });

  it("should create db directory if missing", async () => {
    registerScanFileTool(mockServer, mockDeps);

    mockExistsSync.mockReturnValue(false); // DB dir missing
    mockReadFileSync.mockReturnValue("const x = 1;");
    mockIndexFile.mockReturnValue([]);
    mockScanFileAndCreateDocs.mockResolvedValue({ createdCount: 0, createdSymbols: [] });

    await toolCallback({ filePath: "src/test.ts", docsDir: "docs", dbPath: "db/reg.db" });

    expect(mockMkdirSync).toHaveBeenCalledWith("/root/db", { recursive: true });
  });

  it("should handle errors", async () => {
    registerScanFileTool(mockServer, mockDeps);
    mockReadFileSync.mockImplementation(() => { throw new Error("File error"); });

    const result = await toolCallback({ filePath: "src/test.ts", docsDir: "docs", dbPath: "db/reg.db" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error scanning file: File error");
  });
});