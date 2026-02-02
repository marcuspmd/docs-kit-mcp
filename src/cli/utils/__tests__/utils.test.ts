import { jest } from "@jest/globals";
import { parseArgs } from "../args.js";
import { resolveConfigPath } from "../path.js";
import { isLlmConfigured } from "../config.js";
import { step, done, header, summary } from "../logger.js";

describe("CLI Utils", () => {
  describe("parseArgs", () => {
    test("parses positional arguments", () => {
      const result = parseArgs(["index", "src"], {});
      expect(result.positional).toEqual(["index", "src"]);
      expect(result.flags).toEqual({});
    });

    test("parses flag with value", () => {
      const result = parseArgs(["--db", "path/to/db"], {});
      expect(result.positional).toEqual([]);
      expect(result.flags).toEqual({ db: "path/to/db" });
    });

    test("parses flag without value as true", () => {
      const result = parseArgs(["--full"], {});
      expect(result.positional).toEqual([]);
      expect(result.flags).toEqual({ full: "true" });
    });

    test("combines positional and flags", () => {
      const result = parseArgs(["index", "src", "--db", "custom.db", "--full"], {});
      expect(result.positional).toEqual(["index", "src"]);
      expect(result.flags).toEqual({ db: "custom.db", full: "true" });
    });

    test("preserves default flags", () => {
      const result = parseArgs(["--custom", "value"], { default: "yes" });
      expect(result.flags).toEqual({ default: "yes", custom: "value" });
    });

    test("allows flags to override defaults", () => {
      const result = parseArgs(["--default", "no"], { default: "yes" });
      expect(result.flags).toEqual({ default: "no" });
    });
  });

  describe("resolveConfigPath", () => {
    test("resolves relative path from configDir", () => {
      const result = resolveConfigPath("db/index.db", "/project", ".docs-kit/index.db");
      expect(result).toBe("/project/db/index.db");
    });

    test("returns absolute path as-is", () => {
      const result = resolveConfigPath("/absolute/path/db", "/project", ".docs-kit/index.db");
      expect(result).toBe("/absolute/path/db");
    });

    test("uses default when pathValue is undefined", () => {
      const result = resolveConfigPath(undefined, "/project", ".docs-kit/index.db");
      expect(result).toBe("/project/.docs-kit/index.db");
    });

    test("uses default when pathValue is empty string", () => {
      const result = resolveConfigPath("", "/project", ".docs-kit/index.db");
      expect(result).toBe("/project/.docs-kit/index.db");
    });

    test("handles Windows-style absolute paths", () => {
      const result = resolveConfigPath("C:/absolute/path", "/project", "default.db");
      // On Windows this will be absolute, on Unix it's relative
      // We check if it's treated appropriately by path.isAbsolute
      expect(result.includes("C:/absolute/path") || result.includes("/project/C:")).toBe(true);
    });
  });

  describe("isLlmConfigured", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test("returns false for none provider", () => {
      const config = {
        llm: { provider: "none" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(false);
    });

    test("returns true for ollama with baseUrl", () => {
      const config = {
        llm: { provider: "ollama" as const, baseUrl: "http://localhost:11434", apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(true);
    });

    test("returns false for ollama without baseUrl", () => {
      const config = {
        llm: { provider: "ollama" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(false);
    });

    test("returns true for openai with apiKey", () => {
      const config = {
        llm: { provider: "openai" as const, baseUrl: undefined, apiKey: "sk-test" },
      };
      expect(isLlmConfigured(config)).toBe(true);
    });

    test("returns true for openai with env variable", () => {
      process.env.OPENAI_API_KEY = "sk-from-env";
      const config = {
        llm: { provider: "openai" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(true);
    });

    test("returns false for openai without apiKey", () => {
      delete process.env.OPENAI_API_KEY;
      const config = {
        llm: { provider: "openai" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(false);
    });

    test("returns true for gemini with apiKey", () => {
      const config = {
        llm: { provider: "gemini" as const, baseUrl: undefined, apiKey: "gemini-key" },
      };
      expect(isLlmConfigured(config)).toBe(true);
    });

    test("returns true for gemini with env variable", () => {
      process.env.GEMINI_API_KEY = "gemini-from-env";
      const config = {
        llm: { provider: "gemini" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(true);
    });

    test("returns true for claude with env variable", () => {
      process.env.VOYAGE_API_KEY = "voyage-key";
      const config = {
        llm: { provider: "claude" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(true);
    });

    test("returns false for claude without env variable", () => {
      delete process.env.VOYAGE_API_KEY;
      const config = {
        llm: { provider: "claude" as const, baseUrl: undefined, apiKey: undefined },
      };
      expect(isLlmConfigured(config)).toBe(false);
    });
  });

  describe("logger utils", () => {
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let stdoutWriteSpy: jest.SpiedFunction<typeof process.stdout.write>;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      stdoutWriteSpy.mockRestore();
    });

    test("step writes message without newline", () => {
      step("Processing files");
      expect(stdoutWriteSpy).toHaveBeenCalledWith("  -> Processing files...");
    });

    test("done prints without detail", () => {
      done();
      expect(consoleLogSpy).toHaveBeenCalledWith(" done");
    });

    test("done prints with detail", () => {
      done("100 files processed");
      expect(consoleLogSpy).toHaveBeenCalledWith(" 100 files processed");
    });

    test("header prints formatted title", () => {
      header("Build Summary");
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, "\n" + "=".repeat(50));
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, "  Build Summary");
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, "=".repeat(50) + "\n");
    });

    test("summary prints formatted table", () => {
      summary([
        ["Files", 100],
        ["Symbols", 500],
        ["Database", "/path/to/db"],
      ]);
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy.mock.calls[0][0]).toMatch(/Files\s+:\s+100/);
      expect(consoleLogSpy.mock.calls[1][0]).toMatch(/Symbols\s+:\s+500/);
      expect(consoleLogSpy.mock.calls[2][0]).toMatch(/Database\s+:\s+\/path\/to\/db/);
    });

    test("summary aligns columns properly", () => {
      summary([
        ["Short", 1],
        ["Very Long Label", 2],
        ["Mid", 3],
      ]);
      const calls = consoleLogSpy.mock.calls.map((c) => c[0] as string);
      const lengths = calls.map((line) => line.indexOf(":"));
      // All colons should align at the same position
      expect(lengths[0]).toBe(lengths[1]);
      expect(lengths[1]).toBe(lengths[2]);
    });
  });
});
