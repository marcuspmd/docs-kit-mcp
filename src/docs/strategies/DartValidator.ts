import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class DartValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);

  canValidate(language: string): boolean {
    return language === "dart";
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.dart`;
    try {
      await writeFile(tempFile, code);
      await DartValidator.execAsync(`dart analyze ${tempFile}`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        valid: false,
        error: `Dart analysis error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      await DartValidator.execAsync(`rm -f ${tempFile}`);
    }
  }
}
