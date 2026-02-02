import { jest } from "@jest/globals";
import fs from "node:fs";

// Mock mdGenerator
const mockGenerateDocs = jest.fn();
jest.unstable_mockModule("../../../site/mdGenerator.js", () => ({
  generateDocs: mockGenerateDocs,
}));

// Mock the DI container to avoid loadConfig side effects
jest.unstable_mockModule("../../../di/container.js", () => ({
  setupContainer: jest.fn(),
  resolve: jest.fn().mockReturnValue({ close: jest.fn() }),
}));

// Import use case AFTER mocks
const { buildDocsUseCase } = await import("../buildDocs.usecase.js");

describe("buildDocsUseCase", () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;
  let stdoutWriteSpy: jest.SpiedFunction<typeof process.stdout.write>;
  let existsSyncSpy: jest.SpiedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as never);
    stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    existsSyncSpy = jest.spyOn(fs, "existsSync");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    existsSyncSpy.mockRestore();
    mockGenerateDocs.mockClear();
  });

  test("generates docs successfully with default parameters", async () => {
    existsSyncSpy.mockReturnValue(true);
    mockGenerateDocs.mockReturnValue({
      symbolPages: 10,
      filePages: 5,
      totalFiles: 15,
    });

    await buildDocsUseCase({});

    expect(existsSyncSpy).toHaveBeenCalledWith(".docs-kit/index.db");
    expect(mockGenerateDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        outDir: "docs-output",
        rootDir: ".",
      }),
    );
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  test("generates docs with custom parameters", async () => {
    existsSyncSpy.mockReturnValue(true);
    mockGenerateDocs.mockReturnValue({
      symbolPages: 20,
      filePages: 10,
      totalFiles: 30,
    });

    await buildDocsUseCase({
      outDir: "custom-docs",
      dbPath: "custom/db.db",
      rootDir: "/custom/root",
    });

    expect(existsSyncSpy).toHaveBeenCalledWith("custom/db.db");
    expect(mockGenerateDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        outDir: "custom-docs",
        rootDir: "/custom/root",
      }),
    );
  });

  test("exits with error when database does not exist", async () => {
    existsSyncSpy.mockReturnValue(false);

    await buildDocsUseCase({ dbPath: "missing.db" });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Database not found at missing.db");
    expect(consoleErrorSpy).toHaveBeenCalledWith('Run "docs-kit index" first to create the index.');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test("displays correct summary", async () => {
    existsSyncSpy.mockReturnValue(true);
    mockGenerateDocs.mockReturnValue({
      symbolPages: 42,
      filePages: 17,
      totalFiles: 59,
    });

    await buildDocsUseCase({ outDir: "my-docs" });

    // Verify summary was printed
    const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
    const summaryOutput = logCalls.join("\n");
    expect(summaryOutput).toContain("Symbol page");
    expect(summaryOutput).toContain("File pages");
    expect(summaryOutput).toContain("Total files");
  });

  test("prints steps during execution", async () => {
    existsSyncSpy.mockReturnValue(true);
    mockGenerateDocs.mockReturnValue({
      symbolPages: 5,
      filePages: 3,
      totalFiles: 8,
    });

    await buildDocsUseCase({});

    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining("Reading index from SQLite"),
    );
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining("Generating Markdown pages"),
    );
  });

  test("prints output directory in summary", async () => {
    existsSyncSpy.mockReturnValue(true);
    mockGenerateDocs.mockReturnValue({
      symbolPages: 1,
      filePages: 1,
      totalFiles: 2,
    });

    await buildDocsUseCase({ outDir: "my-docs" });

    const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
    const output = logCalls.join("\n");
    expect(output).toContain("my-docs");
    expect(output).toMatch(/Open.*my-docs.*README\.md/);
  });
});
