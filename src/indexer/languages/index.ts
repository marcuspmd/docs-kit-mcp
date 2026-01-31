import type { LanguageStrategy } from "./languageStrategy.js";
import { TypeScriptStrategy } from "./typescriptStrategy.js";
import { PhpStrategy } from "./phpStrategy.js";
import { DefaultStrategy } from "./defaultStrategy.js";

export type { LanguageStrategy, AddRelFn } from "./languageStrategy.js";

const strategies: Record<string, LanguageStrategy> = {
  ts: new TypeScriptStrategy(),
  js: new TypeScriptStrategy(),
  php: new PhpStrategy(),
};

const fallback = new DefaultStrategy();

export function getStrategy(language: string | undefined): LanguageStrategy {
  return (language && strategies[language]) || fallback;
}
