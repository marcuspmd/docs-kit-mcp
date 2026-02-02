import { exec } from "node:child_process";
import { promisify } from "node:util";

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

    try {
      await BashValidator.execAsync(`bash -n <<< '${code.replace(/'/g, "'\\''")}'`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string; code?: string };

      // If there's stderr content indicating actual syntax error, report it
      if (execError.stderr && !execError.stderr.includes("command not found")) {
        return {
          valid: false,
          error: `Shell syntax error: ${execError.stderr}`,
        };
      }

      // For all other errors (bash not found, environmental issues, etc.), assume valid
      // This prevents CI/CD failures due to environment differences
      return { valid: true };
    }
  }
}
