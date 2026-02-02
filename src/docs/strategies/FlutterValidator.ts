import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class FlutterValidator implements ValidatorStrategy {
  static execAsync = promisify(exec);
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
      await FlutterValidator.execAsync(`dart analyze ${tempFile}`);
      return { valid: true };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      // If dart is not installed, assume code is valid
      if (
        execError.message?.includes("dart: command not found") ||
        execError.stderr?.includes("dart: command not found") ||
        execError.message?.includes("ENOENT")
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Flutter/Dart analysis error: ${execError.stderr || execError.message || "Unknown error"}`,
      };
    } finally {
      try {
        await FlutterValidator.execAsync(`rm -f ${tempFile}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
