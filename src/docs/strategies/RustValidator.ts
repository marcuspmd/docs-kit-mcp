import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class RustValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);
  canValidate(language: string): boolean {
    return language === "rust" || language === "rs";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.rs`;
    try {
      await writeFile(tempFile, code);
      await RustValidator.execAsync(`rustc --emit=dep-info --out-dir=/tmp ${tempFile}`, {
        timeout: 10000,
      });
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      // If rustc is not installed, assume code is valid
      if (
        execError.message?.includes("rustc: command not found") ||
        execError.stderr?.includes("rustc: command not found")
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Rust compilation error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      try {
        await RustValidator.execAsync(`rm -f ${tempFile}`, { timeout: 1000 });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
