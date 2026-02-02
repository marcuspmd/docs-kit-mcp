import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class PHPValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);
  canValidate(language: string): boolean {
    return language === "php";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.php`;
    try {
      await writeFile(tempFile, code);
      await PHPValidator.execAsync(`php -l ${tempFile}`, { timeout: 5000 });
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        valid: false,
        error: `PHP syntax error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      try {
        await PHPValidator.execAsync(`rm -f ${tempFile}`, { timeout: 1000 });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
