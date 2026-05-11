import { jest } from "@jest/globals";
import fs from "node:fs";
import type { ChangeImpact, CodeSymbol } from "../../../indexer/symbol.types.js";

const mockDb = { close: jest.fn() };
const mockRegistry = { rebuild: jest.fn() };
const mockSetupContainer = jest.fn();
const mockResolve = jest.fn((token: symbol) =>
  token === Symbol.for("DATABASE") ? mockDb : mockRegistry,
);
const mockGetGitChangedFiles = jest.fn();
const mockAnalyzeChanges = jest.fn();
const mockApplyChanges = jest.fn();
const mockCreateDocUpdater = jest.fn(() => ({ applyChanges: mockApplyChanges }));
const mockEvaluateDocGuard = jest.fn();
const mockLoadSiteData = jest.fn();
const mockGenerateSiteV2 = jest.fn();

jest.unstable_mockModule("../../../configLoader.js", () => ({
  loadConfig: jest.fn(async () => ({
    projectRoot: "/repo",
    rootDir: "src",
    output: { site: "docs-site", docs: "docs-output" },
    dbPath: ".docs-kit/index.db",
    docs: [],
    llm: { maxTokens: 2000, temperature: 0.7 },
  })),
}));

jest.unstable_mockModule("../../../di/container.js", () => ({
  setupContainer: mockSetupContainer,
  resolve: mockResolve,
}));

jest.unstable_mockModule("../../../analyzer/gitDiff.js", () => ({
  getGitChangedFiles: mockGetGitChangedFiles,
}));

jest.unstable_mockModule("../../../analyzer/changeAnalyzer.js", () => ({
  analyzeChanges: mockAnalyzeChanges,
}));

jest.unstable_mockModule("../../../docs/docUpdater.js", () => ({
  createDocUpdater: mockCreateDocUpdater,
}));

jest.unstable_mockModule("../../../governance/docGuardCli.js", () => ({
  evaluateDocGuard: mockEvaluateDocGuard,
  formatResult: jest.fn(() => "docs-guard: ok"),
}));

jest.unstable_mockModule("../../../site/dataLoader.js", () => ({
  loadSiteData: mockLoadSiteData,
}));

jest.unstable_mockModule("../../../site/v2Generator.js", () => ({
  generateSiteV2: mockGenerateSiteV2,
}));

const { diffUseCase } = await import("../diff.usecase.js");

function makeSymbol(): CodeSymbol {
  return {
    id: "symbol",
    name: "ChangedSymbol",
    kind: "function",
    file: "src/changed.ts",
    startLine: 1,
    endLine: 4,
  };
}

function makeImpact(): ChangeImpact {
  return {
    symbol: makeSymbol(),
    changeType: "signature_changed",
    diff: "+ changed",
    docUpdateRequired: true,
  };
}

describe("diffUseCase", () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let stdoutWriteSpy: jest.SpiedFunction<typeof process.stdout.write>;
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as never);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    const impact = makeImpact();
    mockGetGitChangedFiles.mockResolvedValue(["src/changed.ts"] as never);
    mockAnalyzeChanges.mockResolvedValue([impact] as never);
    mockApplyChanges.mockResolvedValue([
      {
        docPath: "docs/changed.md",
        symbolName: "ChangedSymbol",
        action: "updated",
        diff: "+ docs",
      },
    ] as never);
    mockEvaluateDocGuard.mockResolvedValue({
      passed: true,
      totalChanges: 1,
      coveredChanges: 1,
      uncoveredChanges: [],
    } as never);
    mockLoadSiteData.mockReturnValue({
      symbols: [impact.symbol],
      relationships: [],
      patterns: [],
      files: [impact.symbol.file],
      archViolations: [],
      reaperFindings: [],
      docEntries: [{ path: "docs/changed.md" }],
      docsConfigDir: null,
    });
    mockGenerateSiteV2.mockResolvedValue({
      symbolPages: 1,
      filePages: 1,
      totalFiles: 4,
      classCount: 0,
      moduleCount: 1,
      dataFile: "docs-site-diff/site-data.json",
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("generates a merge-base diff preview site", async () => {
    await diffUseCase({ base: "master", dbPath: "index.db" });

    expect(mockSetupContainer).toHaveBeenCalled();
    expect(mockRegistry.rebuild).toHaveBeenCalledWith("docs");
    expect(mockGetGitChangedFiles).toHaveBeenCalledWith(
      expect.objectContaining({ base: "master", range: "merge-base" }),
    );
    expect(mockAnalyzeChanges).toHaveBeenCalledWith(
      expect.objectContaining({ base: "master", range: "merge-base" }),
    );
    expect(mockCreateDocUpdater).toHaveBeenCalledWith({ dryRun: true });
    expect(mockGenerateSiteV2).toHaveBeenCalledWith(
      expect.objectContaining({
        outDir: "docs-site-diff",
        diff: expect.objectContaining({ base: "master", range: "merge-base" }),
      }),
    );
    expect(processExitSpy).not.toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("exits after generating the site when strict mode fails", async () => {
    mockEvaluateDocGuard.mockResolvedValue({
      passed: false,
      totalChanges: 1,
      coveredChanges: 0,
      uncoveredChanges: [
        {
          symbolName: "ChangedSymbol",
          file: "src/changed.ts",
          changeType: "signature_changed",
          reason: "Linked doc was not updated in this PR",
        },
      ],
    } as never);

    await diffUseCase({ base: "master", strict: true });

    expect(mockGenerateSiteV2).toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
