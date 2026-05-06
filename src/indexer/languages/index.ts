import type { LanguageStrategy } from "./languageStrategy.js";
import { TypeScriptStrategy } from "./typescriptStrategy.js";
import { PhpStrategy } from "./phpStrategy.js";
import { PythonStrategy } from "./pythonStrategy.js";
import { CSharpStrategy } from "./csharpStrategy.js";
import { GoStrategy } from "./goStrategy.js";
import { DefaultStrategy } from "./defaultStrategy.js";

export type { LanguageStrategy, AddRelFn } from "./languageStrategy.js";

const strategies: Record<string, LanguageStrategy> = {
  // TypeScript / JavaScript
  ts: new TypeScriptStrategy(),
  tsx: new TypeScriptStrategy(),
  js: new TypeScriptStrategy(),
  jsx: new TypeScriptStrategy(),
  mjs: new TypeScriptStrategy(),
  cjs: new TypeScriptStrategy(),

  // PHP
  php: new PhpStrategy(),

  // Python
  py: new PythonStrategy(),
  pyw: new PythonStrategy(),

  // C#
  cs: new CSharpStrategy(),

  // Go
  go: new GoStrategy(),
};

const fallback = new DefaultStrategy();

export function getStrategy(language: string | undefined): LanguageStrategy {
  return (language && strategies[language]) || fallback;
}
