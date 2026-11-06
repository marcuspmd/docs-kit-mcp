import { jest } from "@jest/globals";
import fs from "node:fs";

const mockGenerateSiteV2 = jest.fn();

jest.unstable_mockModule("../../../site/v2Generator.js", () => ({
  generateSiteV2: mockGenerateSiteV2,
}));

jest.unstable_mockModule("../../../di/container.js", () => ({
  setupContainer: jest.fn(),
  resolve: jest.fn().mockReturnValue({ close: jest.fn() }),
}));

const { buildSiteUseCase } = await import("../buildSite.usecase.js");

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
      outDir: "docs-site-v2",
      rootDir: ".",
    });

    expect(fs.existsSync).toHaveBeenCalledWith("/test/index.db");
    expect(console.error).toHaveBeenCalledWith("Error: Database not found at /test/index.db");
    expect(console.error).toHaveBeenCalledWith('Run "docs-kit index" first to create the index.');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockGenerateSiteV2).not.toHaveBeenCalled();
  });

  it("should generate the v2 site when database exists", async () => {
    mockGenerateSiteV2.mockResolvedValue({
      symbolPages: 10,
      filePages: 5,
      totalFiles: 4,
      classCount: 3,
      moduleCount: 2,
      dataFile: "docs-site-v2/site-data.json",
    });

    await buildSiteUseCase({
      dbPath: "/test/index.db",
      outDir: "docs-site-v2",
      rootDir: ".",
    });

    expect(mockGenerateSiteV2).toHaveBeenCalledWith(
      expect.objectContaining({
        outDir: "docs-site-v2",
        rootDir: ".",
      }),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Open docs-site-v2/index.html"),
    );
  });

  it("should use default parameters", async () => {
    mockGenerateSiteV2.mockResolvedValue({
      symbolPages: 0,
      filePages: 0,
      totalFiles: 0,
      classCount: 0,
      moduleCount: 0,
      dataFile: "docs-site-v2/site-data.json",
    });

    await buildSiteUseCase({});

    expect(mockGenerateSiteV2).toHaveBeenCalledWith(
      expect.objectContaining({
        outDir: "docs-site-v2",
        rootDir: "src",
      }),
    );
  });
});
