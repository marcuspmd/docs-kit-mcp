import { describe, it, expect } from "@jest/globals";

describe("generateDocs.tool", () => {
  it("should export tool schema properties", async () => {
    const mod = await import("../generateDocs.tool.js");
    expect(mod.generateDocsSchema).toBeDefined();
    expect(mod.generateDocsSchema.base).toBeDefined();
    expect(mod.generateDocsSchema.head).toBeDefined();
    expect(mod.generateDocsSchema.docsDir).toBeDefined();
    expect(mod.generateDocsSchema.dryRun).toBeDefined();
  });

  it("should export registerGenerateDocsTool function", async () => {
    const mod = await import("../generateDocs.tool.js");
    expect(mod.registerGenerateDocsTool).toBeDefined();
    expect(typeof mod.registerGenerateDocsTool).toBe("function");
  });

  it("should have base parameter required", async () => {
    const mod = await import("../generateDocs.tool.js");
    const schema = mod.generateDocsSchema;
    expect(schema.base).toBeDefined();
  });

  it("should have head parameter optional", async () => {
    const mod = await import("../generateDocs.tool.js");
    const schema = mod.generateDocsSchema;
    expect(schema.head).toBeDefined();
  });

  it("should have docsDir parameter with default", async () => {
    const mod = await import("../generateDocs.tool.js");
    const schema = mod.generateDocsSchema;
    expect(schema.docsDir).toBeDefined();
  });

  it("should have dryRun parameter with default", async () => {
    const mod = await import("../generateDocs.tool.js");
    const schema = mod.generateDocsSchema;
    expect(schema.dryRun).toBeDefined();
  });

  it("should export function with correct name", async () => {
    const mod = await import("../generateDocs.tool.js");
    expect(mod.registerGenerateDocsTool.name).toBe("registerGenerateDocsTool");
  });
});
