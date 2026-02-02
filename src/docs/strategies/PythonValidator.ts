import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class PythonValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);
  canValidate(language: string): boolean {
    return language === "python" || language === "py";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.py`;
    try {
      await writeFile(tempFile, code);
      await PythonValidator.execAsync(`python3 -m py_compile ${tempFile}`, { timeout: 5000 });
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        valid: false,
        error: `Python syntax error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      try {
        await PythonValidator.execAsync(`rm -f ${tempFile}`, { timeout: 1000 });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
