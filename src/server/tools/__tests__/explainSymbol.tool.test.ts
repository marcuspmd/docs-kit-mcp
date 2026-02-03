import { describe, it, expect } from "@jest/globals";

describe("explainSymbol.tool", () => {
  it("should export schema for explainSymbol", async () => {
    const mod = await import("../explainSymbol.tool.js");
    expect(mod.explainSymbolSchema).toBeDefined();
    expect(mod.explainSymbolSchema.symbol).toBeDefined();
    expect(mod.explainSymbolSchema.docsDir).toBeDefined();
  });

  it("should export registerExplainSymbolTool function", async () => {
    const mod = await import("../explainSymbol.tool.js");
    expect(mod.registerExplainSymbolTool).toBeDefined();
    expect(typeof mod.registerExplainSymbolTool).toBe("function");
  });

  it("should export schema for updateSymbolExplanation", async () => {
    const mod = await import("../explainSymbol.tool.js");
    expect(mod.updateSymbolExplanationSchema).toBeDefined();
    expect(mod.updateSymbolExplanationSchema.symbol).toBeDefined();
    expect(mod.updateSymbolExplanationSchema.explanation).toBeDefined();
  });

  it("should export registerUpdateSymbolExplanationTool function", async () => {
    const mod = await import("../explainSymbol.tool.js");
    expect(mod.registerUpdateSymbolExplanationTool).toBeDefined();
    expect(typeof mod.registerUpdateSymbolExplanationTool).toBe("function");
  });

  it("should have symbol description in schema", async () => {
    const mod = await import("../explainSymbol.tool.js");
    const schema = mod.explainSymbolSchema;
    expect(schema.symbol).toBeDefined();
  });

  it("should have docsDir with default value", async () => {
    const mod = await import("../explainSymbol.tool.js");
    const schema = mod.explainSymbolSchema;
    expect(schema.docsDir).toBeDefined();
  });

  it("should have update function exported", async () => {
    const mod = await import("../explainSymbol.tool.js");
    expect(mod.registerUpdateSymbolExplanationTool).toBeDefined();
  });
});
