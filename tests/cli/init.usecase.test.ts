import { jest } from "@jest/globals";

// Mock configLoader functions
const mockConfigExists = jest.fn();
const mockCreateDefaultConfig = jest.fn();

jest.unstable_mockModule("../../src/configLoader.js", () => ({
  configExists: mockConfigExists,
  createDefaultConfig: mockCreateDefaultConfig,
}));

// Import use case AFTER mocks
const { initUseCase } = await import("../../src/cli/usecases/init.usecase.js");

describe("initUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should skip if config already exists", async () => {
    mockConfigExists.mockReturnValue(true);

    await initUseCase({ rootDir: "." });

    expect(mockConfigExists).toHaveBeenCalledWith(".");
    expect(mockCreateDefaultConfig).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith("  docs.config.js already exists, skipping.");
  });

  it("should create config if it does not exist", async () => {
    mockConfigExists.mockReturnValue(false);
    mockCreateDefaultConfig.mockReturnValue("/test/docs.config.js");

    await initUseCase({ rootDir: "/test" });

    expect(mockConfigExists).toHaveBeenCalledWith("/test");
    expect(mockCreateDefaultConfig).toHaveBeenCalledWith("/test");
    expect(console.log).toHaveBeenCalledWith("  Created /test/docs.config.js");
    expect(console.log).toHaveBeenCalledWith(
      "  Edit it to customize include/exclude patterns and other settings.",
    );
  });

  it("should use default root dir if not provided", async () => {
    mockConfigExists.mockReturnValue(false);
    mockCreateDefaultConfig.mockReturnValue("./docs.config.js");

    await initUseCase({ rootDir: "." });

    expect(mockConfigExists).toHaveBeenCalledWith(".");
    expect(mockCreateDefaultConfig).toHaveBeenCalledWith(".");
  });
});
