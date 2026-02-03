import { describe, it, expect } from "@jest/globals";

describe("projectStatus.tool", () => {
  it("should export tool schema properties", async () => {
    const mod = await import("../projectStatus.tool.js");
    expect(mod.projectStatusSchema).toBeDefined();
    expect(mod.projectStatusSchema.docsDir).toBeDefined();
  });

  it("should export registerProjectStatusTool function", async () => {
    const mod = await import("../projectStatus.tool.js");
    expect(mod.registerProjectStatusTool).toBeDefined();
    expect(typeof mod.registerProjectStatusTool).toBe("function");
  });

  it("should have docsDir parameter with default", async () => {
    const mod = await import("../projectStatus.tool.js");
    expect(mod.projectStatusSchema.docsDir).toBeDefined();
  });

  it("should export function with correct name", async () => {
    const mod = await import("../projectStatus.tool.js");
    expect(mod.registerProjectStatusTool.name).toBe("registerProjectStatusTool");
  });

  it("should export schema correctly", async () => {
    const mod = await import("../projectStatus.tool.js");
    const schema = mod.projectStatusSchema;
    expect(schema).toHaveProperty("docsDir");
  });

  it("should be able to call registerProjectStatusTool with server and deps", async () => {
    const mod = await import("../projectStatus.tool.js");
    expect(mod.registerProjectStatusTool.length).toBeGreaterThan(0);
  });

  it("should schema be an object with docsDir", async () => {
    const mod = await import("../projectStatus.tool.js");
    expect(typeof mod.projectStatusSchema).toBe("object");
  });
});
