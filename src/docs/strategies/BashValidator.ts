import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class BashValidator implements ValidatorStrategy {
  canValidate(language: string): boolean {
    return language === "bash" || language === "sh";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    try {
      await execAsync(`bash -n <<< '${code.replace(/'/g, "'\\''")}'`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        valid: false,
        error: `Shell syntax error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    }
  }
}
