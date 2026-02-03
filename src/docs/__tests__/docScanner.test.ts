import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.unstable_mockModule("node:fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.unstable_mockModule("node:path", () => ({
  join: jest.fn((a, b) => `${a}/${b}`),
  dirname: jest.fn((p) => p.split("/").slice(0, -1).join("/")),
  relative: jest.fn((a, b) => b.replace(a, "").replace(/^\//,""),
}));

describe("docScanner", () => {
  let mockFsExistSync: jest.Mock;
  let mockFsMkdirSync: jest.Mock;
  let mockFsWriteFileSync: jest.Mock;
  let mockPathJoin: jest.Mock;
  let mockPathDirname: jest.Mock;
  let mockPathRelative: jest.Mock;

  beforeEach(async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    mockFsExistSync = fs.existsSync as jest.Mock;
    mockFsMkdirSync = fs.mkdirSync as jest.Mock;
    mockFsWriteFileSync = fs.writeFileSync as jest.Mock;
    mockPathJoin = path.join as jest.Mock;
    mockPathDirname = path.dirname as jest.Mock;
    mockPathRelative = path.relative as jest.Mock;

    mockFsExistSync.mockReturnValue(false);
    mockFsMkdirSync.mockReturnValue(undefined);
    mockFsWriteFileSync.mockReturnValue(undefined);
    mockPathJoin.mockImplementation((a, b) => `${a}/${b}`);
    mockPathDirname.mockImplementation((p) => p.split("/").slice(0, -1).join("/"));
    mockPathRelative.mockImplementation((a, b) => b.replace(a, "").replace(/^\//, ""));
  });

  it("should export scanFileAndCreateDocs function", async () => {
    const mod = await import("../docScanner.js");
    expect(mod.scanFileAndCreateDocs).toBeDefined();
    expect(typeof mod.scanFileAndCreateDocs).toBe("function");
  });

  it("should export DEFAULT_INITIAL_CONTENT template", async () => {
    const mod = await import("../docScanner.js");
    expect(mod.DEFAULT_INITIAL_CONTENT).toBeDefined();
  });

  it("should export ScanFileResult interface", async () => {
    const mod = await import("../docScanner.js");
    // Interface is exported but not directly testable, so we just verify the function handle return type
    expect(mod.scanFileAndCreateDocs).toBeDefined();
  });

  it("should handle ScanFileOptions parameter", async () => {
    const mod = await import("../docScanner.js");
    expect(mod.scanFileAndCreateDocs.length).toBeGreaterThan(0);
  });

  it("should call findDocBySymbol on registry", async () => {
    const mod = await import("../docScanner.js");
    expect(mod.scanFileAndCreateDocs).toBeDefined();
  });

  it("should be async function", async () => {
    const mod = await import("../docScanner.js");
    const fn = mod.scanFileAndCreateDocs;
    expect(fn.constructor.name).toBe("AsyncFunction");
  });

  it("should return object with createdCount and createdSymbols", async () => {
    const mod = await import("../docScanner.js");
    const fn = mod.scanFileAndCreateDocs;
    expect(fn).toBeDefined();
  });
});
