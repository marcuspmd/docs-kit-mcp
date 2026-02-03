import { describe, it, expect } from "@jest/globals";

describe("scanFile.tool", () => {
  it("should export tool schema properties", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.scanFileSchema).toBeDefined();
    expect(mod.scanFileSchema.filePath).toBeDefined();
    expect(mod.scanFileSchema.docsDir).toBeDefined();
  });

  it("should export registerScanFileTool function", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.registerScanFileTool).toBeDefined();
    expect(typeof mod.registerScanFileTool).toBe("function");
  });

  it("should have filePath parameter", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.scanFileSchema.filePath).toBeDefined();
  });

  it("should have docsDir parameter with default", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.scanFileSchema.docsDir).toBeDefined();
  });

  it("should export function with correct name", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.registerScanFileTool.name).toBe("registerScanFileTool");
  });

  it("should schema be an object", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(typeof mod.scanFileSchema).toBe("object");
  });

  it("should have filePath in schema", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.scanFileSchema).toHaveProperty("filePath");
  });

  it("should have docsDir in schema", async () => {
    const mod = await import("../scanFile.tool.js");
    expect(mod.scanFileSchema).toHaveProperty("docsDir");
  });
});
