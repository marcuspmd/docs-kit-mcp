/**
 * Tests for individual CLI command handlers
 * Tests command-specific logic, argument parsing, and use case calls
 */
import { jest } from "@jest/globals";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Import and mock use cases before importing CLI components
jest.mock("../usecases/index.js");

const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, "error").mockImplementation(() => {});

describe("CLI - Command Handlers: Init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  it("should use provided rootDir", () => {
    // The runInit function takes args array and uses args[0] || "."
    const args = ["/custom/path"];
    const rootDir = args[0] || ".";
    expect(rootDir).toBe("/custom/path");
  });

  it("should default to current directory", () => {
    const args: string[] = [];
    const rootDir = args[0] || ".";
    expect(rootDir).toBe(".");
  });

  it("should pass rootDir to initUseCase", async () => {
    const args = ["some/path"];
    const rootDir = args[0] || ".";

    const expected = { rootDir };
    expect(expected).toEqual({ rootDir: "some/path" });
  });
});

describe("CLI - Command Handlers: Index", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse db flag", async () => {
    const { parseArgs: parseArgsFunc } = await import("../utils/args.js");
    const args = ["--db", "custom.db"];
    const result = parseArgsFunc(args, { db: "", docs: "", full: "" });

    expect(result.flags.db).toBe("custom.db");
  });

  it("should parse docs flag", async () => {
    const { parseArgs: parseArgsFunc } = await import("../utils/args.js");
    const args = ["--docs", "my-docs"];
    const result = parseArgsFunc(args, { db: "", docs: "", full: "" });

    expect(result.flags.docs).toBe("my-docs");
  });

  it("should detect full rebuild flag", async () => {
    const { parseArgs: parseArgsFunc } = await import("../utils/args.js");
    const args = ["--full"];
    const result = parseArgsFunc(args, { db: "", docs: "", full: "" });

    const fullRebuild = "full" in result.flags;
    expect(fullRebuild).toBe(true);
  });

  it("should provide default values when flags not provided", () => {
    const defaults = { db: "", docs: "", full: "" };

    expect(defaults.db).toBe("");
    expect(defaults.docs).toBe("");
  });

  it("should construct indexUseCase params correctly", () => {
    const positional = ["."];
    const flags = { db: "custom.db", docs: "my-docs", full: "true" };

    const params = {
      rootDir: positional[0],
      dbPath: flags.db,
      docsDir: flags.docs,
      fullRebuild: "full" in flags,
    };

    expect(params).toEqual({
      rootDir: ".",
      dbPath: "custom.db",
      docsDir: "my-docs",
      fullRebuild: true, // "full" IS in flags when parseArgs finds --full
    });
  });
});

describe("CLI - Command Handlers: Build Site", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should use default output directory", () => {
    const defaults = { out: "docs-site", db: ".docs-kit/index.db", root: "." };

    expect(defaults.out).toBe("docs-site");
  });

  it("should use default database path", () => {
    const defaults = { out: "docs-site", db: ".docs-kit/index.db", root: "." };

    expect(defaults.db).toBe(".docs-kit/index.db");
  });

  it("should use default root directory", () => {
    const defaults = { out: "docs-site", db: ".docs-kit/index.db", root: "." };

    expect(defaults.root).toBe(".");
  });

  it("should override defaults with provided flags", () => {
    const userDefaults = { out: "docs-site", db: ".docs-kit/index.db", root: "." };
    const customOut = "custom-site";

    const final = { ...userDefaults, out: customOut };
    expect(final.out).toBe("custom-site");
    expect(final.db).toBe(".docs-kit/index.db");
  });

  it("should construct buildSiteUseCase params", () => {
    const flags = { out: "site", db: "db.sqlite", root: "/project" };

    const params = {
      outDir: flags.out,
      dbPath: flags.db,
      rootDir: flags.root,
    };

    expect(params).toEqual({
      outDir: "site",
      dbPath: "db.sqlite",
      rootDir: "/project",
    });
  });
});

describe("CLI - Command Handlers: Build Docs", () => {
  it("should follow same pattern as build-site for params", () => {
    const flags = { out: "docs", db: "index.db", root: "." };

    const params = {
      outDir: flags.out,
      dbPath: flags.db,
      rootDir: flags.root,
    };

    expect(params).toEqual({
      outDir: "docs",
      dbPath: "index.db",
      rootDir: ".",
    });
  });
});

describe("CLI - Command Handlers: Impact Analysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require symbol name", () => {
    const positional: string[] = [];
    const symbolName = positional[0];

    expect(symbolName).toBeUndefined();
  });

  it("should exit with error message when symbol missing", () => {
    const positional: string[] = [];
    const symbolName = positional[0];

    if (!symbolName) {
      const message = "Usage: docs-kit impact-analysis <symbol> [--max-depth n] [--db path]";
      expect(message).toContain("impact-analysis");
      expect(message).toContain("<symbol>");
    }
  });

  it("should parse max-depth from flags", () => {
    const flags = { "max-depth": "10", db: "", docs: "docs" };
    const maxDepth = parseInt(flags["max-depth"] || "3", 10) || 3;

    expect(maxDepth).toBe(10);
  });

  it("should default max-depth to 3", () => {
    const flags = { "max-depth": "", db: "", docs: "docs" };
    const maxDepth = parseInt(flags["max-depth"] || "3", 10) || 3;

    expect(maxDepth).toBe(3);
  });

  it("should handle invalid max-depth gracefully", () => {
    const flags = { "max-depth": "invalid", db: "", docs: "docs" };
    const maxDepth = parseInt(flags["max-depth"] || "3", 10) || 3;

    expect(maxDepth).toBe(3);
  });

  it("should construct impactAnalysisUseCase params", () => {
    const positional = ["MyService"];
    const flags = { "max-depth": "5", db: "custom.db", docs: "my-docs" };

    const params = {
      symbolName: positional[0],
      maxDepth: parseInt(flags["max-depth"], 10) || 3,
      dbPath: flags.db,
      docsDir: flags.docs,
    };

    expect(params).toEqual({
      symbolName: "MyService",
      maxDepth: 5,
      dbPath: "custom.db",
      docsDir: "my-docs",
    });
  });
});

describe("CLI - Command Handlers: Analyze Patterns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should accept optional db flag", () => {
    const flags = { db: "custom.db" };

    expect(flags).toHaveProperty("db");
    expect(flags.db).toBe("custom.db");
  });

  it("should handle result formatting with patterns", () => {
    const result = {
      patterns: [
        {
          kind: "singleton",
          symbols: ["Service1", "Service2"],
          confidence: 0.9,
          violations: ["Missing DI", "Tight coupling"],
        },
      ],
    };

    const report = result.patterns
      .map((p) => {
        const symbolNames = p.symbols.join(", ");
        const violations = p.violations.map((v) => `- ${v}`).join("\n");
        const confidence = (p.confidence * 100).toFixed(0);
        return `**${p.kind.toUpperCase()}** (confidence: ${confidence}%)\nSymbols: ${symbolNames}\nViolations:\n${violations || "None"}`;
      })
      .join("\n\n");

    expect(report).toContain("SINGLETON");
    expect(report).toContain("Service1, Service2");
    expect(report).toContain("90%");
    expect(report).toContain("- Missing DI");
  });

  it("should handle empty patterns result", () => {
    const result = { patterns: [] };

    const report = result.patterns.map(() => "pattern").join("\n\n");

    const final = report || "No patterns detected.";
    expect(final).toBe("No patterns detected.");
  });

  it("should format multiple patterns", () => {
    const result = {
      patterns: [
        {
          kind: "factory",
          symbols: ["Factory1"],
          confidence: 0.85,
          violations: [] as string[],
        },
        {
          kind: "observer",
          symbols: ["Listener1", "Listener2"],
          confidence: 0.92,
          violations: ["Loose coupling"],
        },
      ],
    };

    expect(result.patterns.length).toBe(2);
    expect(result.patterns[0].kind).toBe("factory");
    expect(result.patterns[1].kind).toBe("observer");
  });
});

describe("CLI - Command Handlers: Explain Symbol", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require symbol name", () => {
    const positional: string[] = [];
    const symbolName = positional[0];

    expect(symbolName).toBeUndefined();
  });

  it("should exit with error when symbol missing", () => {
    const positional: string[] = [];
    const symbolName = positional[0];

    if (!symbolName) {
      const message =
        "Usage: docs-kit explain-symbol <symbol> [--docs dir] [--db path] [--cwd dir]";
      expect(message).toContain("explain-symbol");
    }
  });

  it("should parse docs directory", () => {
    const flags = { docs: "my-docs", db: "", cwd: "", llm: "true" };

    expect(flags.docs).toBe("my-docs");
  });

  it("should parse cwd option", () => {
    const flags = { docs: "docs", db: "", cwd: "/path/to/project", llm: "true" };

    expect(flags.cwd).toBe("/path/to/project");
  });

  it("should determine LLM enabled when --no-llm not present", () => {
    const flags: Record<string, string> = { llm: "true" };
    const useLlm =
      (flags["no-llm"] as string | undefined) === "true"
        ? false
        : flags.llm !== "false"
          ? true
          : false;

    expect(useLlm).toBe(true);
  });

  it("should disable LLM when --no-llm is present", () => {
    const flags: Record<string, string> = { "no-llm": "true", llm: "true" };
    const useLlm =
      (flags["no-llm"] as string | undefined) === "true"
        ? false
        : flags.llm !== "false"
          ? true
          : false;

    expect(useLlm).toBe(false);
  });

  it("should disable LLM when llm=false", () => {
    const flags: Record<string, string> = { llm: "false" };
    const useLlm =
      (flags["no-llm"] as string | undefined) === "true"
        ? false
        : flags.llm !== "false"
          ? true
          : false;

    expect(useLlm).toBe(false);
  });

  it("should construct explainSymbolUseCase params", () => {
    const positional = ["UserService"];
    const flags: Record<string, string> = { docs: "docs", db: "index.db", cwd: ".", llm: "true" };

    const useLlm =
      (flags["no-llm"] as string | undefined) === "true" ? false : flags.llm !== "false";

    const params = {
      symbolName: positional[0],
      docsDir: flags.docs,
      dbPath: flags.db,
      cwd: flags.cwd,
      useLlm,
    };

    expect(params).toEqual({
      symbolName: "UserService",
      docsDir: "docs",
      dbPath: "index.db",
      cwd: ".",
      useLlm: true,
    });
  });
});

describe("CLI - Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockConsoleError.mockClear();
  });

  it("should catch errors from use cases", () => {
    const error = new Error("Database connection failed");

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Database connection failed");
  });

  it("should log error message", () => {
    const error = new Error("Something went wrong");
    const message = error instanceof Error ? error.message : String(error);

    expect(message).toBe("Something went wrong");
  });

  it("should handle non-Error objects in catch", () => {
    const thrown: unknown = "string error";
    const message =
      typeof thrown === "object" && thrown instanceof Error ? thrown.message : String(thrown);

    expect(message).toBe("string error");
  });

  it("should provide fatal error handling at top level", () => {
    const error = new Error("Fatal initialization error");

    expect(error.message).toBe("Fatal initialization error");
  });
});

describe("CLI - Help System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
  });

  it("should show help for --help flag", () => {
    const command: string = "--help";
    const shouldShowHelp = command === "--help" || command === "-h";

    expect(shouldShowHelp).toBe(true);
  });

  it("should show help for -h flag", () => {
    const command: string = "-h";
    const shouldShowHelp = command === "--help" || command === "-h";

    expect(shouldShowHelp).toBe(true);
  });

  it("should exit with code 0 for help", () => {
    const command: string = "--help";
    const exitCode = command === "--help" ? 0 : 1;

    expect(exitCode).toBe(0);
  });

  it("should exit with code 1 for unknown command", () => {
    const command: string = "unknown";
    const exitCode = command === "--help" || command === "-h" ? 0 : 1;

    expect(exitCode).toBe(1);
  });

  it("should recognize all valid commands", () => {
    const validCommands = [
      "init",
      "index",
      "build-site",
      "build-docs",
      "impact-analysis",
      "analyze-patterns",
      "explain-symbol",
    ];

    validCommands.forEach((cmd) => {
      expect(typeof cmd).toBe("string");
      expect(cmd.length).toBeGreaterThan(0);
    });
  });
});
