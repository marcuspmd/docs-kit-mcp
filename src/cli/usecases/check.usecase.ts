import "reflect-metadata";
import * as p from "@clack/prompts";
import { setupContainer, resolve } from "../../di/container.js";
import {
  SYMBOL_REPO_TOKEN,
  RELATIONSHIP_REPO_TOKEN,
  DOC_REGISTRY_TOKEN,
  ARCH_GUARD_TOKEN,
} from "../../di/tokens.js";
import type { ArchGuard, ArchViolation } from "../../governance/archGuard.js";
import type { DocRegistry } from "../../docs/docRegistry.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import { assertDatabaseExists, resolveConfigPath } from "../utils/index.js";
import { loadConfig } from "../../configLoader.js";
import { colors } from "../utils/colors.js";

type CheckType = "coverage" | "architecture" | "documentation";

export interface CheckUseCaseParams {
  dbPath?: string;
  docsDir?: string;
  rootDir?: string;
  checks?: CheckType[];
}

export async function checkUseCase(params: CheckUseCaseParams): Promise<void> {
  const configDir = process.cwd();
  const config = await loadConfig(configDir);
  const dbPath = resolveConfigPath(params.dbPath, configDir, config.dbPath);
  const docsDir = params.docsDir ?? "docs";

  assertDatabaseExists(dbPath);

  let checks = params.checks;

  if (!checks && process.stdin.isTTY) {
    p.intro(colors.bold("docs-kit check"));
    const selected = await p.multiselect<CheckType>({
      message: "Selecione as verificações:",
      options: [
        { value: "coverage", label: "Coverage", hint: "símbolos com cobertura < 50%" },
        { value: "architecture", label: "Architecture", hint: "violações de regras de arquitetura" },
        { value: "documentation", label: "Documentation", hint: "símbolos sem doc vinculada" },
      ],
      initialValues: ["coverage", "architecture"],
    });
    if (p.isCancel(selected)) {
      p.cancel("Cancelado.");
      process.exit(0);
    }
    checks = selected;
    p.outro("");
  }

  const activeChecks: CheckType[] = checks ?? ["coverage", "architecture", "documentation"];

  await setupContainer({ dbPath });

  const symbolRepo = resolve<{ findAll(): CodeSymbol[] }>(SYMBOL_REPO_TOKEN);
  const relRepo = resolve<{ findAll(): Array<{ source_id: string; target_id: string; type: string }> }>(
    RELATIONSHIP_REPO_TOKEN,
  );
  const registry = resolve<DocRegistry>(DOC_REGISTRY_TOKEN);
  const archGuard = resolve<ArchGuard>(ARCH_GUARD_TOKEN);

  const allSymbols = symbolRepo.findAll();
  const allRels = relRepo.findAll().map((r) => ({
    sourceId: r.source_id,
    targetId: r.target_id,
    type: r.type,
  }));

  if (activeChecks.includes("coverage")) {
    renderCoverageSection(allSymbols);
  }

  if (activeChecks.includes("architecture")) {
    const violations = archGuard.analyze(allSymbols, allRels);
    renderArchSection(violations);
  }

  if (activeChecks.includes("documentation")) {
    await registry.rebuild(docsDir);
    const mappings = await registry.findAllMappings();
    renderDocsSection(allSymbols, mappings);
  }
}

function renderCoverageSection(symbols: CodeSymbol[]): void {
  printHeader("Coverage Check");

  const withCoverage = symbols.filter((s) => s.metrics?.testCoverage !== undefined);

  if (withCoverage.length === 0) {
    console.log(`  ${colors.dim("Nenhum dado de cobertura encontrado. Execute o indexer com LCOV configurado.")}\n`);
    return;
  }

  const low = withCoverage.filter((s) => {
    const cov = s.metrics?.testCoverage?.coveragePercent ?? 0;
    return cov > 0 && cov < 50;
  });
  const uncovered = withCoverage.filter((s) => (s.metrics?.testCoverage?.coveragePercent ?? 0) === 0);
  const partial = withCoverage.filter((s) => {
    const cov = s.metrics?.testCoverage?.coveragePercent ?? 0;
    return cov >= 50 && cov < 80;
  });
  const full = withCoverage.filter((s) => (s.metrics?.testCoverage?.coveragePercent ?? 0) >= 80);

  if (uncovered.length > 0) {
    console.log(`  ${colors.bold(colors.none("SEM COBERTURA"))}`);
    renderSymbolsByFile(uncovered, (s) => {
      const pct = s.metrics?.testCoverage?.coveragePercent ?? 0;
      return colors.none(`${pct}%`);
    });
  }

  if (low.length > 0) {
    console.log(`  ${colors.bold(colors.low("BAIXA COBERTURA  (< 50%)"))}`);
    renderSymbolsByFile(low, (s) => {
      const pct = s.metrics?.testCoverage?.coveragePercent ?? 0;
      return colors.low(`${pct.toFixed(0)}%`);
    });
  }

  if (partial.length > 0) {
    console.log(`  ${colors.bold(colors.partial("PARCIAL  (50–79%)"))}`);
    renderSymbolsByFile(partial, (s) => {
      const pct = s.metrics?.testCoverage?.coveragePercent ?? 0;
      return colors.partial(`${pct.toFixed(0)}%`);
    });
  }

  const summaryParts = [
    uncovered.length > 0 ? colors.none(`${uncovered.length} sem cobertura`) : null,
    low.length > 0 ? colors.low(`${low.length} baixa`) : null,
    partial.length > 0 ? colors.partial(`${partial.length} parcial`) : null,
    full.length > 0 ? colors.full(`${full.length} completa`) : null,
  ].filter(Boolean);

  console.log(`\n  Resumo: ${summaryParts.join(", ")}\n`);
}

function renderArchSection(violations: ArchViolation[]): void {
  printHeader("Architecture Check");

  if (violations.length === 0) {
    console.log(`  ${colors.tick()} Nenhuma violação encontrada.\n`);
    return;
  }

  for (const v of violations) {
    const severity = v.severity === "error" ? colors.error("error") : colors.warn("warning");
    const file = colors.dim(v.file);
    console.log(`  ${severity}   ${file}`);
    console.log(`          ${v.message}`);
  }

  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;
  const parts = [
    errors > 0 ? colors.error(`${errors} erro(s)`) : null,
    warnings > 0 ? colors.warn(`${warnings} aviso(s)`) : null,
  ].filter(Boolean);

  console.log(`\n  Resumo: ${parts.join(", ")}\n`);
}

function renderDocsSection(
  symbols: CodeSymbol[],
  mappings: Array<{ symbolName: string; docPath: string }>,
): void {
  printHeader("Documentation Check");

  const documentedNames = new Set(mappings.map((m) => m.symbolName));
  const undocumented = symbols.filter((s) => !documentedNames.has(s.name));

  if (undocumented.length === 0) {
    console.log(`  ${colors.tick()} Todos os símbolos têm documentação vinculada.\n`);
    return;
  }

  console.log(`  ${colors.bold(colors.warn("SEM DOC LINK"))}`);
  renderSymbolsByFile(undocumented, (s) => colors.dim(s.kind));

  const pct = symbols.length > 0 ? ((mappings.length / symbols.length) * 100).toFixed(1) : "0.0";
  const color = parseFloat(pct) >= 80 ? colors.full : parseFloat(pct) >= 50 ? colors.partial : colors.low;
  console.log(`\n  Cobertura: ${color(`${mappings.length}/${symbols.length} símbolos (${pct}%)`)}\n`);
}

function renderSymbolsByFile(
  symbols: CodeSymbol[],
  badge: (s: CodeSymbol) => string,
): void {
  const byFile = new Map<string, CodeSymbol[]>();
  for (const s of symbols) {
    const file = s.file ?? "unknown";
    const list = byFile.get(file) ?? [];
    list.push(s);
    byFile.set(file, list);
  }
  for (const [file, syms] of byFile) {
    console.log(`  ${colors.dim(file)}`);
    for (const s of syms) {
      const name = s.name.padEnd(30);
      const kind = s.kind.padEnd(12);
      console.log(`    ${name} ${colors.dim(kind)} ${badge(s)}`);
    }
  }
  console.log("");
}

function printHeader(title: string): void {
  const line = "═".repeat(50);
  console.log(`\n${colors.bold(line)}`);
  console.log(`  ${colors.bold(title)}`);
  console.log(`${colors.bold(line)}\n`);
}
