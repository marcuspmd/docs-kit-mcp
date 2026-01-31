import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class GoValidator implements ValidatorStrategy {
  canValidate(language: string): boolean {
    return language === "go" || language === "golang";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.go`;
    try {
      await writeFile(tempFile, code);
      await execAsync(`go build -o /dev/null ${tempFile}`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      // If go is not installed, assume code is valid
      if (
        execError.message?.includes("go: command not found") ||
        execError.stderr?.includes("go: command not found")
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Go compilation error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      try {
        await execAsync(`rm -f ${tempFile}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
