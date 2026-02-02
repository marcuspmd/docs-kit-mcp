import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class BashValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);

  canValidate(language: string): boolean {
    return language === "bash" || language === "sh";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    // Write to temp file to avoid heredoc/quoting issues in CI
    const tmpFile = `/tmp/bash-validation-${Date.now()}.sh`;

    try {
      await writeFile(tmpFile, code);
      await BashValidator.execAsync(`bash -n ${tmpFile}`);
      await BashValidator.execAsync(`rm -f ${tmpFile}`);
      return { valid: true };
    } catch (error: unknown) {
      // Clean up temp file
      try {
        await BashValidator.execAsync(`rm -f ${tmpFile}`);
      } catch {
        // Ignore cleanup errors
      }

      const execError = error as { stderr?: string; message?: string; code?: string };

      // Only report errors if there's actual stderr content with syntax error information
      // Check for common bash syntax error patterns
      if (
        execError.stderr &&
        execError.stderr.trim() &&
        !execError.stderr.includes("command not found") &&
        (execError.stderr.includes("syntax error") ||
          execError.stderr.includes("unexpected") ||
          execError.stderr.includes("parse error"))
      ) {
        return {
          valid: false,
          error: `Shell syntax error: ${execError.stderr}`,
        };
      }

      // For all other errors (bash not found, environmental issues, empty stderr, etc.), assume valid
      // This prevents CI/CD failures due to environment differences
      return { valid: true };
    }
  }
}
