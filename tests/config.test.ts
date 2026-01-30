import { ConfigSchema } from "../src/config.js";

describe("ConfigSchema", () => {
  it("should parse minimal config with defaults", () => {
    const config = ConfigSchema.parse({ projectRoot: "/tmp/test" });

    expect(config.projectRoot).toBe("/tmp/test");
    expect(config.respectGitignore).toBe(true);
    expect(config.maxFileSize).toBe(512_000);
    expect(config.include).toContain("**/*.ts");
    expect(config.exclude).toContain("**/node_modules/**");
    expect(config.promptRules).toEqual([]);
    expect(config.defaultPrompts.symbolPrompt).toBeDefined();
  });

  it("should reject promptRule without language or pattern", () => {
    expect(() =>
      ConfigSchema.parse({
        projectRoot: "/tmp",
        promptRules: [{ name: "bad rule" }],
      }),
    ).toThrow();
  });
});
