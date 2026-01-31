import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class FlutterValidator implements ValidatorStrategy {
  canValidate(language: string): boolean {
    return language === "flutter" || language === "dart"; // Flutter usa Dart
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }

    const tempFile = `/tmp/example-${Date.now()}.dart`;
    try {
      await writeFile(tempFile, code);
      // Para Flutter, usamos dart analyze que funciona tanto para Dart quanto Flutter
      await execAsync(`dart analyze ${tempFile}`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        valid: false,
        error: `Flutter/Dart analysis error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      await execAsync(`rm -f ${tempFile}`);
    }
  }
}
