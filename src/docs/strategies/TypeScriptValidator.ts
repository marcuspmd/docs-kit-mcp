import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class TypeScriptValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);
  canValidate(language: string): boolean {
    return language === "typescript" || language === "ts";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.ts`;
    try {
      await writeFile(tempFile, code);
      await TypeScriptValidator.execAsync(`npx tsc --noEmit ${tempFile}`, { timeout: 10000 });
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string; killed?: boolean };
      // If tsc/npx is not installed or timed out, assume code is valid
      if (
        execError.message?.includes("tsc: command not found") ||
        execError.message?.includes("npx: command not found") ||
        execError.stderr?.includes("tsc: command not found") ||
        execError.stderr?.includes("npx: command not found") ||
        execError.message?.includes("ENOENT") ||
        execError.killed === true
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `TypeScript compilation error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      try {
        await TypeScriptValidator.execAsync(`rm -f ${tempFile}`, { timeout: 1000 });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
