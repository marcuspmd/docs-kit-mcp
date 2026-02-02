import { jest } from "@jest/globals";
import fs from "node:fs";

// Mock generateSite BEFORE importing the use case
const mockGenerateSite = jest.fn();

jest.unstable_mockModule("../../src/site/generator.js", () => ({
  generateSite: mockGenerateSite,
}));

// Now import the use case after mocks are set up
const { buildSiteUseCase } = await import("../../src/cli/usecases/buildSite.usecase.js");

describe("buildSiteUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(process, "exit").mockImplementation((() => {}) as never);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should fail if database does not exist", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    await buildSiteUseCase({
      dbPath: "/test/index.db",
      outDir: "docs-site",
      rootDir: ".",
    });

    expect(fs.existsSync).toHaveBeenCalledWith("/test/index.db");
    expect(console.error).toHaveBeenCalledWith("Error: Database not found at /test/index.db");
    expect(console.error).toHaveBeenCalledWith('Run "docs-kit index" first to create the index.');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockGenerateSite).not.toHaveBeenCalled();
  });

  it("should generate site if database exists", async () => {
    mockGenerateSite.mockReturnValue({
      symbolPages: 10,
      filePages: 5,
      totalFiles: 15,
    });

    await buildSiteUseCase({
      dbPath: "/test/index.db",
      outDir: "docs-site",
      rootDir: ".",
    });

    expect(fs.existsSync).toHaveBeenCalledWith("/test/index.db");
    expect(mockGenerateSite).toHaveBeenCalledWith({
      dbPath: "/test/index.db",
      outDir: "docs-site",
      rootDir: ".",
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Open docs-site/index.html"));
  });

  it("should use default parameters", async () => {
    mockGenerateSite.mockReturnValue({
      symbolPages: 0,
      filePages: 0,
      totalFiles: 0,
    });

    await buildSiteUseCase({});

    expect(mockGenerateSite).toHaveBeenCalledWith({
      dbPath: ".docs-kit/index.db",
      outDir: "docs-site",
      rootDir: ".",
    });
  });
});
