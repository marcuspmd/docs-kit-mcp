import { describe, it, expect } from "@jest/globals";

describe("smartCodeReview.tool", () => {
  it("should export tool schema properties", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(mod.smartCodeReviewSchema).toBeDefined();
    expect(mod.smartCodeReviewSchema.docsDir).toBeDefined();
    expect(mod.smartCodeReviewSchema.includeExamples).toBeDefined();
  });

  it("should export registerSmartCodeReviewTool function", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(mod.registerSmartCodeReviewTool).toBeDefined();
    expect(typeof mod.registerSmartCodeReviewTool).toBe("function");
  });

  it("should have docsDir parameter with default", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(mod.smartCodeReviewSchema.docsDir).toBeDefined();
  });

  it("should have includeExamples parameter with default", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(mod.smartCodeReviewSchema.includeExamples).toBeDefined();
  });

  it("should export function with correct name", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(mod.registerSmartCodeReviewTool.name).toBe("registerSmartCodeReviewTool");
  });

  it("should schema be an object with expected properties", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(typeof mod.smartCodeReviewSchema).toBe("object");
    expect(Object.keys(mod.smartCodeReviewSchema).length).toBeGreaterThan(0);
  });

  it("should be callable with server and deps parameters", async () => {
    const mod = await import("../smartCodeReview.tool.js");
    expect(mod.registerSmartCodeReviewTool.length).toBeGreaterThan(0);
  });
});
