import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fastGlob from "fast-glob";
import {
  ValidatorStrategy,
  TypeScriptValidator,
  JavaScriptValidator,
  BashValidator,
  PHPValidator,
  DartValidator,
  FlutterValidator,
  PythonValidator,
  GoValidator,
  RustValidator,
  DefaultValidator,
} from "./strategies/index.js";

export interface CodeExample {
  language: string;
  code: string;
  lineStart: number;
  lineEnd: number;
}

export interface ValidationResult {
  docPath: string;
  example: CodeExample;
  valid: boolean;
  error?: string;
}

export interface CodeExampleValidator {
  extractExamples(docPath: string): Promise<CodeExample[]>;
  validateExample(example: CodeExample, context?: string): Promise<ValidationResult>;
  validateDoc(docPath: string): Promise<ValidationResult[]>;
  validateAll(docsDir: string): Promise<ValidationResult[]>;
}

function extractCodeBlocks(content: string): CodeExample[] {
  const lines = content.split("\n");
  const examples: CodeExample[] = [];
  let inCodeBlock = false;
  let currentLanguage = "";
  let codeLines: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        // Start of code block
        inCodeBlock = true;
        currentLanguage = line.slice(3).trim();
        codeLines = [];
        startLine = i + 1;
      } else {
        // End of code block
        inCodeBlock = false;
        if (codeLines.length > 0) {
          examples.push({
            language: currentLanguage,
            code: codeLines.join("\n"),
            lineStart: startLine,
            lineEnd: i,
          });
        }
      }
    } else if (inCodeBlock) {
      codeLines.push(line);
    }
  }

  return examples;
}

export function createCodeExampleValidator(): CodeExampleValidator {
  const strategies: ValidatorStrategy[] = [
    new TypeScriptValidator(),
    new JavaScriptValidator(),
    new BashValidator(),
    new PHPValidator(),
    new DartValidator(),
    new FlutterValidator(),
    new PythonValidator(),
    new GoValidator(),
    new RustValidator(),
    new DefaultValidator(),
  ];

  function getValidator(language: string): ValidatorStrategy {
    return strategies.find((strategy) => strategy.canValidate(language))!;
  }

  return {
    async extractExamples(docPath: string): Promise<CodeExample[]> {
      const content = await readFile(docPath, "utf-8");
      return extractCodeBlocks(content);
    },

    async validateExample(example: CodeExample, context?: string): Promise<ValidationResult> {
      const result: ValidationResult = {
        docPath: context || "",
        example,
        valid: true,
      };

      try {
        const validator = getValidator(example.language);
        const validationResult = await validator.validate(example.code);

        result.valid = validationResult.valid;
        if (!validationResult.valid) {
          result.error = validationResult.error;
        }
      } catch (error: unknown) {
        const execError = error as { message?: string };
        result.valid = false;
        result.error = `Validation error: ${execError.message || "Unknown error"}`;
      }

      return result;
    },

    async validateDoc(docPath: string): Promise<ValidationResult[]> {
      console.log(`Extracting examples from ${docPath}...`);
      const examples = await this.extractExamples(docPath);
      console.log(`Found ${examples.length} examples in ${docPath}`);
      const results: ValidationResult[] = [];

      for (const example of examples) {
        console.log(`Validating example ${example.language} (${example.lineStart}-${example.lineEnd})...`);
        const result = await this.validateExample(example, docPath);
        console.log(`Example validation result: ${result.valid ? 'valid' : 'invalid'}`);
        results.push(result);
      }

      return results;
    },

    async validateAll(docsDir: string): Promise<ValidationResult[]> {
      console.log(`Finding markdown files in ${docsDir}...`);
      const mdFiles = await fastGlob("**/*.md", { cwd: docsDir });
      console.log(`Found ${mdFiles.length} markdown files`);
      const allResults: ValidationResult[] = [];

      for (const file of mdFiles) {
        console.log(`Validating file: ${file}`);
        const results = await this.validateDoc(join(docsDir, file));
        console.log(`File ${file} has ${results.length} examples`);
        allResults.push(...results);
      }

      console.log(`Total validation results: ${allResults.length}`);
      return allResults;
    },
  };
}
