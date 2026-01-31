import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class TypeScriptValidator implements ValidatorStrategy {
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
      await execAsync(`npx tsc --noEmit ${tempFile}`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        valid: false,
        error: `TypeScript compilation error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      await execAsync(`rm -f ${tempFile}`);
    }
  }
}
