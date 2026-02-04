import { jest } from "@jest/globals";

// Mock fs/promises
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWriteFile = jest.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFile = jest.fn() as any;
jest.mock("node:fs/promises", () => ({
  writeFile: mockWriteFile,
  readFile: mockReadFile,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecAsync = jest.fn() as any;

import { BashValidator } from "../strategies/BashValidator.js";
import { DartValidator } from "../strategies/DartValidator.js";
import { DefaultValidator } from "../strategies/DefaultValidator.js";
import { FlutterValidator } from "../strategies/FlutterValidator.js";
import { GoValidator } from "../strategies/GoValidator.js";
import { JavaScriptValidator } from "../strategies/JavaScriptValidator.js";
import { PHPValidator } from "../strategies/PHPValidator.js";
import { PythonValidator } from "../strategies/PythonValidator.js";
import { RustValidator } from "../strategies/RustValidator.js";
import { TypeScriptValidator } from "../strategies/TypeScriptValidator.js";

// Mock the static execAsync
BashValidator.execAsync = mockExecAsync;
DartValidator.execAsync = mockExecAsync;
FlutterValidator.execAsync = mockExecAsync;
GoValidator.execAsync = mockExecAsync;
JavaScriptValidator.execAsync = mockExecAsync;
PHPValidator.execAsync = mockExecAsync;
PythonValidator.execAsync = mockExecAsync;
RustValidator.execAsync = mockExecAsync;
TypeScriptValidator.execAsync = mockExecAsync;

describe("Validator Strategies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("BashValidator", () => {
    const validator = new BashValidator();

    it("canValidate returns true for bash and sh", () => {
      expect(validator.canValidate("bash")).toBe(true);
      expect(validator.canValidate("sh")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid bash code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // bash -n
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm -f
      const code = 'echo "Hello World"';
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    }, 10000);

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("rejects whitespace-only code", async () => {
      const result = await validator.validate("   \n\t  ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles bash syntax errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      // Mock the execAsync to reject for invalid bash syntax
      const error = { stderr: "bash: syntax error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // bash -n fails
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm -f
      const code = "invalid bash syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Shell syntax error: bash: syntax error");
    });

    it("assumes valid for environmental errors (no stderr)", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      // Mock execAsync to reject with no stderr (environmental issue)
      const error = { message: "Command failed", code: "1" };
      mockExecAsync.mockRejectedValueOnce(error); // bash -n
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm -f
      const code = 'echo "test"';
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("assumes valid when bash is not found", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      // Mock execAsync to reject with command not found
      const error = { stderr: "bash: command not found", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // bash -n
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm -f
      const code = 'echo "test"';
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("cleans up temp file on success", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // bash -n
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm -f
      const code = 'echo "test"';
      await validator.validate(code);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^rm -f \/tmp\/bash-validation-\d+\.sh$/),
        { timeout: 1000 },
      );
    });

    it("cleans up temp file on error", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = { stderr: "bash: syntax error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // bash -n
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm -f
      const code = "invalid code";
      await validator.validate(code);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^rm -f \/tmp\/bash-validation-\d+\.sh$/),
        { timeout: 1000 },
      );
    });
  });

  describe("DartValidator", () => {
    const validator = new DartValidator();

    it("canValidate returns true for dart", () => {
      expect(validator.canValidate("dart")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid dart code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // dart analyze
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "void main() {\n  print('Hello World');\n}";
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles dart compilation errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = {
        stderr: "dart: syntax error",
        message: "Command failed: dart analyze /tmp/example-1769892392525.dart",
      };
      mockExecAsync.mockRejectedValueOnce(error); // dart analyze
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "invalid dart syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Dart analysis error: dart: syntax error");
    });
  });

  describe("DefaultValidator", () => {
    const validator = new DefaultValidator();

    it("canValidate returns true for any language", () => {
      expect(validator.canValidate("typescript")).toBe(true);
      expect(validator.canValidate("unknown")).toBe(true);
      expect(validator.canValidate("")).toBe(true);
    });

    it("validates any non-empty code", async () => {
      const result = await validator.validate("some code");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("rejects whitespace-only code", async () => {
      const result = await validator.validate("   \n\t  ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });
  });

  describe("FlutterValidator", () => {
    const validator = new FlutterValidator();

    it("canValidate returns true for flutter", () => {
      expect(validator.canValidate("flutter")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
      expect(validator.canValidate("javascript")).toBe(false);
    });

    it("validates valid flutter code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // dart analyze
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "void main() {\n  print('Hello Flutter');\n}";
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles flutter compilation errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = {
        stderr: "flutter: syntax error",
        message: "Command failed: dart analyze /tmp/example-1769892393432.dart",
      };
      mockExecAsync.mockRejectedValueOnce(error); // dart analyze
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "invalid flutter syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Flutter/Dart analysis error: flutter: syntax error");
    });
  });

  describe("GoValidator", () => {
    const validator = new GoValidator();

    it("canValidate returns true for go", () => {
      expect(validator.canValidate("go")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid go code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // go build
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello World")\n}';
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles go compilation errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = { stderr: "go: syntax error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // for go build
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid go syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Go compilation error: go: syntax error");
    });
  });

  describe("JavaScriptValidator", () => {
    const validator = new JavaScriptValidator();

    it("canValidate returns true for javascript and js", () => {
      expect(validator.canValidate("javascript")).toBe(true);
      expect(validator.canValidate("js")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid javascript code", async () => {
      const code = "const x = 42; console.log(x);";
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles javascript syntax errors", async () => {
      const error = { stderr: "", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // for node --check
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid js syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("JavaScript syntax error:");
    });
  });

  describe("PHPValidator", () => {
    const validator = new PHPValidator();

    it("canValidate returns true for php", () => {
      expect(validator.canValidate("php")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid php code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // php -l
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "<?php\necho 'Hello World';\n?>";
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles php syntax errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = { stderr: "php: syntax error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // for php -l
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid php syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("PHP syntax error: php: syntax error");
    });
  });

  describe("PythonValidator", () => {
    const validator = new PythonValidator();

    it("canValidate returns true for python and py", () => {
      expect(validator.canValidate("python")).toBe(true);
      expect(validator.canValidate("py")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("javascript")).toBe(false);
    });

    it("validates valid python code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // python3 -m py_compile
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "print('Hello World')";
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles python syntax errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = { stderr: "python: syntax error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // for python3 -m py_compile
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid python syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Python syntax error:");
    });
  });

  describe("RustValidator", () => {
    const validator = new RustValidator();

    it("canValidate returns true for rust and rs", () => {
      expect(validator.canValidate("rust")).toBe(true);
      expect(validator.canValidate("rs")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("typescript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid rust code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rustc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = 'fn main() {\n    println!("Hello World");\n}';
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles rust compilation errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = { stderr: "rustc: syntax error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // for rustc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid rust syntax {{{";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Rust compilation error: rustc: syntax error");
    });
  });

  describe("TypeScriptValidator", () => {
    const validator = new TypeScriptValidator();

    it("canValidate returns true for typescript and ts", () => {
      expect(validator.canValidate("typescript")).toBe(true);
      expect(validator.canValidate("ts")).toBe(true);
    });

    it("canValidate returns false for other languages", () => {
      expect(validator.canValidate("javascript")).toBe(false);
      expect(validator.canValidate("python")).toBe(false);
    });

    it("validates valid typescript code", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // tsc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // rm
      const code = "const x: number = 42; console.log(x);";
      const result = await validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty code", async () => {
      const result = await validator.validate("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty code block");
    });

    it("handles typescript compilation errors", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = {
        stderr: "tsc: compilation error",
        message: "Command failed: npx tsc --noEmit /tmp/example-1769892396409.ts",
      };
      mockExecAsync.mockRejectedValueOnce(error); // for tsc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "const x: number = 'invalid';";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("TypeScript compilation error: tsc: compilation error");
    });

    it("handles typescript errors with no stderr or message", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockRejectedValueOnce({}); // for tsc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid code";
      const result = await validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("TypeScript compilation error: Unknown error");
    });

    it("cleans up temp file on success", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for tsc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "const x: number = 42;";
      await validator.validate(code);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(
          /^npx tsc --noEmit --lib es2015 --skipLibCheck --skipDefaultLibCheck \/tmp\/example-\d+\.ts$/,
        ),
        { timeout: 10000 },
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^rm -f \/tmp\/example-\d+\.ts$/),
        { timeout: 1000 },
      );
    });

    it("cleans up temp file on error", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);
      const error = { stderr: "tsc error", message: "Command failed" };
      mockExecAsync.mockRejectedValueOnce(error); // for tsc
      mockExecAsync.mockResolvedValueOnce({ stdout: "", stderr: "" }); // for rm
      const code = "invalid code";
      await validator.validate(code);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(
          /^npx tsc --noEmit --lib es2015 --skipLibCheck --skipDefaultLibCheck \/tmp\/example-\d+\.ts$/,
        ),
        { timeout: 10000 },
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^rm -f \/tmp\/example-\d+\.ts$/),
        { timeout: 1000 },
      );
    });
  });
});
