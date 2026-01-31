/**
 * Arch-Guard base configuration and language-specific reserved/special names.
 * Use these to build naming_convention rules that allow constructor and magic
 * method names (e.g. PHP __construct, __destruct) and to generate a starter
 * arch-guard.json with init-arch-guard.
 */

import type { ArchRule } from "./archGuard.js";
import type { Language } from "../indexer/symbol.types.js";

/** Reserved or special method/function names per language that should be excluded from strict naming checks (e.g. camelCase). */
export const RESERVED_NAMES_BY_LANGUAGE: Record<Language, string[]> = {
  php: [
    "__construct",
    "__destruct",
    "__call",
    "__callStatic",
    "__get",
    "__set",
    "__isset",
    "__unset",
    "__sleep",
    "__wakeup",
    "__serialize",
    "__unserialize",
    "__toString",
    "__invoke",
    "__set_state",
    "__clone",
    "__debugInfo",
  ],
  ts: ["constructor"],
  js: ["constructor"],
  python: [
    "__init__",
    "__new__",
    "__del__",
    "__repr__",
    "__str__",
    "__bytes__",
    "__format__",
    "__lt__",
    "__le__",
    "__eq__",
    "__ne__",
    "__gt__",
    "__ge__",
    "__hash__",
    "__bool__",
    "__getattr__",
    "__getattribute__",
    "__setattr__",
    "__delattr__",
    "__dir__",
    "__get__",
    "__set__",
    "__delete__",
    "__set_name__",
    "__init_subclass__",
    "__call__",
    "__len__",
    "__getitem__",
    "__setitem__",
    "__delitem__",
    "__iter__",
    "__reversed__",
    "__contains__",
    "__add__",
    "__sub__",
    "__mul__",
    "__matmul__",
    "__truediv__",
    "__floordiv__",
    "__mod__",
    "__divmod__",
    "__pow__",
    "__lshift__",
    "__rshift__",
    "__and__",
    "__or__",
    "__xor__",
    "__radd__",
    "__rsub__",
    "__rmul__",
    "__rmatmul__",
    "__rtruediv__",
    "__rfloordiv__",
    "__rmod__",
    "__rdivmod__",
    "__rpow__",
    "__rlshift__",
    "__rrshift__",
    "__rand__",
    "__ror__",
    "__rxor__",
    "__iadd__",
    "__isub__",
    "__imul__",
    "__imatmul__",
    "__itruediv__",
    "__ifloordiv__",
    "__imod__",
    "__idivmod__",
    "__ipow__",
    "__ilshift__",
    "__irshift__",
    "__iand__",
    "__ior__",
    "__ixor__",
    "__enter__",
    "__exit__",
    "__await__",
    "__aiter__",
    "__anext__",
    "__aenter__",
    "__aexit__",
  ],
  go: [], // Go has no magic method names; use exported (PascalCase) vs unexported
};

/** All reserved names across languages (union). */
export function getAllReservedNames(languages: Language[]): string[] {
  const set = new Set<string>();
  for (const lang of languages) {
    for (const name of RESERVED_NAMES_BY_LANGUAGE[lang] ?? []) {
      set.add(name);
    }
  }
  return [...set];
}

export interface ArchGuardBaseOptions {
  /** Languages to include (determines reserved names and default rules). */
  languages?: Language[];
  /** Include layer boundary example. */
  layerBoundary?: boolean;
  /** Include forbidden import example. */
  forbiddenImport?: boolean;
  /** Include naming convention rules (with language-specific allowlist). */
  namingConvention?: boolean;
  /** Include metric rules (complexity, params, lines, return type). */
  metricRules?: boolean;
  /** Max cyclomatic complexity (default 10). */
  maxComplexity?: number;
  /** Max parameters per function/method (default 5). */
  maxParameters?: number;
  /** Max lines per symbol (default 80). */
  maxLines?: number;
  /** Require explicit return type for functions/methods. */
  requireReturnType?: boolean;
}

const DEFAULT_LANGUAGES: Language[] = ["ts", "js"];

/**
 * Build default rules for arch-guard.json, including language-aware naming
 * (e.g. PHP __construct allowed) and optional metric rules.
 */
export function buildArchGuardBaseRules(options: ArchGuardBaseOptions = {}): ArchRule[] {
  const {
    languages = DEFAULT_LANGUAGES,
    layerBoundary = true,
    forbiddenImport = true,
    namingConvention = true,
    metricRules = true,
    maxComplexity = 10,
    maxParameters = 5,
    maxLines = 80,
    requireReturnType = false,
  } = options;

  const rules: ArchRule[] = [];
  const reservedNames = getAllReservedNames(languages);

  if (layerBoundary) {
    rules.push({
      name: "domain-no-infrastructure",
      description: "Domain layer must not depend on infrastructure",
      type: "layer_boundary",
      severity: "error",
      config: {
        source: "src/domain/**",
        forbidden: ["src/infrastructure/**", "src/infra/**"],
      },
    });
  }

  if (forbiddenImport) {
    rules.push({
      name: "no-direct-db-in-controllers",
      description: "Controllers must not import DB or repository implementations directly",
      type: "forbidden_import",
      severity: "warning",
      config: {
        scope: "src/**/controllers/**",
        forbidden: ["**/db/**", "**/database/**"],
      },
    });
  }

  if (namingConvention) {
    rules.push({
      name: "class-pascal-case",
      description: "Classes should be PascalCase",
      type: "naming_convention",
      severity: "warning",
      config: {
        kind: "class",
        pattern: "^[A-Z][a-zA-Z0-9]*$",
        allowNames: reservedNames.length > 0 ? reservedNames : undefined,
      },
    });
    rules.push({
      name: "method-camel-case",
      description: "Methods should be camelCase (reserved names like __construct allowed)",
      type: "naming_convention",
      severity: "warning",
      config: {
        kind: "method",
        pattern: "^[a-z][a-zA-Z0-9]*$",
        allowNames: reservedNames.length > 0 ? reservedNames : undefined,
      },
    });
    rules.push({
      name: "function-camel-case",
      description: "Functions should be camelCase",
      type: "naming_convention",
      severity: "warning",
      config: {
        kind: "function",
        pattern: "^[a-z][a-zA-Z0-9]*$",
        allowNames: reservedNames,
      },
    });
  }

  if (metricRules) {
    rules.push({
      name: "max-cyclomatic-complexity",
      description: "Functions/methods should not exceed cyclomatic complexity threshold",
      type: "max_complexity",
      severity: "warning",
      config: { max: maxComplexity },
    });
    rules.push({
      name: "max-parameters",
      description: "Functions/methods should not exceed parameter count",
      type: "max_parameters",
      severity: "warning",
      config: { max: maxParameters },
    });
    rules.push({
      name: "max-lines",
      description: "Symbol body should not exceed line count",
      type: "max_lines",
      severity: "warning",
      config: { max: maxLines },
    });
    if (requireReturnType) {
      rules.push({
        name: "require-return-type",
        description: "Public functions/methods should declare return type",
        type: "missing_return_type",
        severity: "warning",
        config: { scope: "public" },
      });
    }
  }

  return rules;
}

/** Default arch-guard.json content as a JSON string. */
export function getDefaultArchGuardJson(options: ArchGuardBaseOptions = {}): string {
  const rules = buildArchGuardBaseRules(options);
  return JSON.stringify({ rules }, null, 2);
}
