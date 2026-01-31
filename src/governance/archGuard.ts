import { readFile } from "node:fs/promises";
import type { CodeSymbol, SymbolRelationship } from "../indexer/symbol.types.js";

export interface ArchRule {
  name: string;
  description?: string;
  type: "layer_boundary" | "forbidden_import" | "naming_convention";
  severity?: "error" | "warning";
  config: Record<string, unknown>;
}

export interface ArchViolation {
  rule: string;
  file: string;
  symbolId?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ArchGuard {
  loadRules(configPath: string): Promise<void>;
  setRules(rules: ArchRule[]): void;
  analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]): ArchViolation[];
}

function matchGlob(pattern: string, value: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");
  return new RegExp(`^${regex}$`).test(value);
}

function matchAnyGlob(patterns: string[], value: string): boolean {
  return patterns.some((p) => matchGlob(p, value));
}

function checkLayerBoundary(
  rule: ArchRule,
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
): ArchViolation[] {
  const source = rule.config.source as string;
  const forbidden = rule.config.forbidden as string[];
  const severity = rule.severity ?? "error";
  const violations: ArchViolation[] = [];

  const sourceSymbols = symbols.filter((s) => matchGlob(source, s.file));
  const sourceIds = new Set(sourceSymbols.map((s) => s.id));

  for (const rel of relationships) {
    if (!sourceIds.has(rel.sourceId)) continue;
    const target = byId.get(rel.targetId);
    if (!target) continue;
    if (matchAnyGlob(forbidden, target.file)) {
      const src = byId.get(rel.sourceId)!;
      violations.push({
        rule: rule.name,
        file: src.file,
        symbolId: src.id,
        message: `'${src.name}' in ${src.file} depends on '${target.name}' in forbidden layer ${target.file}`,
        severity,
      });
    }
  }

  return violations;
}

function checkForbiddenImport(
  rule: ArchRule,
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[],
  byId: Map<string, CodeSymbol>,
): ArchViolation[] {
  const forbidden = rule.config.forbidden as string[];
  const scope = rule.config.scope as string | undefined;
  const severity = rule.severity ?? "error";
  const violations: ArchViolation[] = [];

  const scopedSymbols = scope ? symbols.filter((s) => matchGlob(scope, s.file)) : symbols;
  const scopedIds = new Set(scopedSymbols.map((s) => s.id));

  for (const rel of relationships) {
    if (!scopedIds.has(rel.sourceId)) continue;
    const target = byId.get(rel.targetId);
    if (!target) continue;
    if (matchAnyGlob(forbidden, target.file) || matchAnyGlob(forbidden, target.name)) {
      const src = byId.get(rel.sourceId)!;
      violations.push({
        rule: rule.name,
        file: src.file,
        symbolId: src.id,
        message: `'${src.name}' uses forbidden dependency '${target.name}'`,
        severity,
      });
    }
  }

  return violations;
}

function checkNamingConvention(rule: ArchRule, symbols: CodeSymbol[]): ArchViolation[] {
  const pattern = new RegExp(rule.config.pattern as string);
  const kind = rule.config.kind as string | undefined;
  const fileGlob = rule.config.file as string | undefined;
  const severity = rule.severity ?? "warning";
  const violations: ArchViolation[] = [];

  for (const sym of symbols) {
    if (kind && sym.kind !== kind) continue;
    if (fileGlob && !matchGlob(fileGlob, sym.file)) continue;
    if (!pattern.test(sym.name)) {
      violations.push({
        rule: rule.name,
        file: sym.file,
        symbolId: sym.id,
        message: `'${sym.name}' does not match naming convention /${rule.config.pattern as string}/`,
        severity,
      });
    }
  }

  return violations;
}

export function createArchGuard(): ArchGuard {
  let rules: ArchRule[] = [];

  return {
    async loadRules(configPath) {
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content) as { rules: ArchRule[] };
      rules = parsed.rules;
    },

    setRules(newRules) {
      rules = newRules;
    },

    analyze(symbols, relationships) {
      const byId = new Map(symbols.map((s) => [s.id, s]));
      const violations: ArchViolation[] = [];

      for (const rule of rules) {
        switch (rule.type) {
          case "layer_boundary":
            violations.push(...checkLayerBoundary(rule, symbols, relationships, byId));
            break;
          case "forbidden_import":
            violations.push(...checkForbiddenImport(rule, symbols, relationships, byId));
            break;
          case "naming_convention":
            violations.push(...checkNamingConvention(rule, symbols));
            break;
        }
      }

      return violations;
    },
  };
}
