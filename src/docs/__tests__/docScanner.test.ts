import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import type { DocRegistry } from "../docRegistry.js";

// Mock dependencies
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();

jest.unstable_mockModule("node:fs", () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}));

jest.unstable_mockModule("node:path", () => ({
  join: jest.fn((...args: string[]) => args.join("/")),
  dirname: jest.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  relative: jest.fn((from: string, to: string) => to.replace(from, "").replace(/^\//, "")),
}));

describe("docScanner", () => {
  let scanFileAndCreateDocs: typeof import("../docScanner.js").scanFileAndCreateDocs;
  let DEFAULT_INITIAL_CONTENT: typeof import("../docScanner.js").DEFAULT_INITIAL_CONTENT;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../docScanner.js");
    scanFileAndCreateDocs = mod.scanFileAndCreateDocs;
    DEFAULT_INITIAL_CONTENT = mod.DEFAULT_INITIAL_CONTENT;
  });

  it("should export DEFAULT_INITIAL_CONTENT template", () => {
    expect(DEFAULT_INITIAL_CONTENT).toBeDefined();
    const symbol: CodeSymbol = {
      name: "TestSymbol",
      kind: "class",
      file: "/root/src/test.ts",
      startLine: 1,
      endLine: 10,
    };
    const content = DEFAULT_INITIAL_CONTENT(symbol, "src/test.ts");
    expect(content).toContain("title: TestSymbol");
    expect(content).toContain("# TestSymbol");
  });

  it("should create docs for symbols without mappings", async () => {
    const mockRegistry = {
      findDocBySymbol: jest.fn().mockResolvedValue([]), // No existing docs
      register: jest.fn().mockResolvedValue(undefined),
    } as unknown as DocRegistry;

    const symbols: CodeSymbol[] = [
      {
        name: "TestSymbol",
        kind: "class",
        file: "/root/src/test.ts",
        startLine: 1,
        endLine: 10,
      },
    ];

    mockExistsSync.mockReturnValue(false); // Dir does not exist

    const result = await scanFileAndCreateDocs({
      docsDir: "/root/docs",
      projectRoot: "/root",
      symbols,
      registry: mockRegistry,
    });

    expect(result.createdCount).toBe(1);
    expect(result.createdSymbols).toEqual(["TestSymbol"]);
    expect(mockRegistry.findDocBySymbol).toHaveBeenCalledWith("TestSymbol");
    expect(mockMkdirSync).toHaveBeenCalledWith("/root/docs/domain", { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/root/docs/domain/TestSymbol.md",
      expect.stringContaining("title: TestSymbol"),
      "utf-8"
    );
    expect(mockRegistry.register).toHaveBeenCalledWith({
      symbolName: "TestSymbol",
      docPath: "domain/TestSymbol.md",
    });
  });

  it("should skip symbols that already have mappings", async () => {
    const mockRegistry = {
      findDocBySymbol: jest.fn().mockResolvedValue([{ docPath: "some/doc.md" }]), // Existing doc
      register: jest.fn(),
    } as unknown as DocRegistry;

    const symbols: CodeSymbol[] = [
      {
        name: "ExistingSymbol",
        kind: "class",
        file: "/root/src/existing.ts",
        startLine: 1,
        endLine: 10,
      },
    ];

    const result = await scanFileAndCreateDocs({
      docsDir: "/root/docs",
      projectRoot: "/root",
      symbols,
      registry: mockRegistry,
    });

    expect(result.createdCount).toBe(0);
    expect(result.createdSymbols).toEqual([]);
    expect(mockRegistry.findDocBySymbol).toHaveBeenCalledWith("ExistingSymbol");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockRegistry.register).not.toHaveBeenCalled();
  });

  it("should not create directory if it already exists", async () => {
    const mockRegistry = {
      findDocBySymbol: jest.fn().mockResolvedValue([]),
      register: jest.fn().mockResolvedValue(undefined),
    } as unknown as DocRegistry;

    const symbols: CodeSymbol[] = [
      {
        name: "TestSymbol",
        kind: "class",
        file: "/root/src/test.ts",
        startLine: 1,
        endLine: 10,
      },
    ];

    mockExistsSync.mockReturnValue(true); // Dir exists

    await scanFileAndCreateDocs({
      docsDir: "/root/docs",
      projectRoot: "/root",
      symbols,
      registry: mockRegistry,
    });

    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});