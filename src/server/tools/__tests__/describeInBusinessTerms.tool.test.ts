import { describe, it, expect } from "@jest/globals";

describe("describeInBusinessTerms.tool", () => {
  it("should export tool schema properties", async () => {
    const mod = await import("../describeInBusinessTerms.tool.js");
    expect(mod.describeInBusinessTermsSchema).toBeDefined();
    expect(mod.describeInBusinessTermsSchema.symbol).toBeDefined();
    expect(mod.describeInBusinessTermsSchema.docsDir).toBeDefined();
  });

  it("should export registerDescribeInBusinessTermsTool function", async () => {
    const mod = await import("../describeInBusinessTerms.tool.js");
    expect(mod.registerDescribeInBusinessTermsTool).toBeDefined();
    expect(typeof mod.registerDescribeInBusinessTermsTool).toBe("function");
  });

  it("should have symbol parameter", async () => {
    const mod = await import("../describeInBusinessTerms.tool.js");
    expect(mod.describeInBusinessTermsSchema.symbol).toBeDefined();
  });

  it("should have docsDir parameter with default", async () => {
    const mod = await import("../describeInBusinessTerms.tool.js");
    expect(mod.describeInBusinessTermsSchema.docsDir).toBeDefined();
  });

  it("should export function with correct name", async () => {
    const mod = await import("../describeInBusinessTerms.tool.js");
    expect(mod.registerDescribeInBusinessTermsTool.name).toBe(
      "registerDescribeInBusinessTermsTool",
    );
  });
});
