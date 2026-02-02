---
title: Governance - Qualidade e Compliance
module: governance
lastUpdated: 2026-02-01
symbols:
  - createArchGuard
  - createReaper
  - generateProjectStatus
  - performSmartCodeReview
---

# Governance - Governança de Código

> O módulo Governance fornece ferramentas para garantir qualidade, compliance e manutenibilidade do código.

## Visão Geral

O módulo Governance (`src/governance/`) oferece:

1. **Arch Guard**: Enforça regras arquiteturais e naming conventions
2. **Reaper**: Detecta dead code, orphan docs, broken links
3. **Project Status**: Relatórios abrangentes de saúde do projeto
4. **Smart Code Review**: Code review automatizado multi-dimensional
5. **Doc Guard CLI**: Gate para CI/CD validar docs atualizadas

## Componentes

### 1. Arch Guard (`archGuard.ts`)

Valida arquitetura e conventions configuráveis.

**Criação:**
```typescript
function createArchGuard(): ArchGuard
```

**Interface:**
```typescript
interface ArchGuard {
  setRules(rules: ArchRule[]): void;
  loadRules(path: string): Promise<void>;
  analyze(
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[]
  ): ArchViolation[];
}

interface ArchRule {
  name: string;
  description: string;
  type: RuleType;
  severity: "error" | "warning" | "info";
  config: Record<string, any>;
}

type RuleType =
  | "layer_boundary"       // Enforce layered architecture
  | "forbidden_import"     // Forbidden dependencies
  | "naming_convention"    // Name patterns
  | "max_complexity"       // Complexity threshold
  | "max_parameters"       // Parameter count
  | "max_lines"            // Function/class size
  | "require_tests"        // Test coverage requirement
  | "require_docs";        // Documentation requirement

interface ArchViolation {
  rule: string;
  file: string;
  symbolId?: string;
  message: string;
  severity: "error" | "warning" | "info";
}
```

**Rule Examples:**

**Layer Boundary:**
```json
{
  "name": "NoDomainToPersistence",
  "description": "Domain layer should not import from persistence",
  "type": "layer_boundary",
  "severity": "error",
  "config": {
    "from": "src/domain/**",
    "to": "src/persistence/**",
    "allowed": false
  }
}
```

**Naming Convention:**
```json
{
  "name": "ClassesArePascalCase",
  "description": "Class names must be PascalCase",
  "type": "naming_convention",
  "severity": "warning",
  "config": {
    "kind": "class",
    "pattern": "^[A-Z][a-zA-Z0-9]*$"
  }
}
```

**Max Complexity:**
```json
{
  "name": "MaxComplexity10",
  "description": "Functions should not exceed complexity 10",
  "type": "max_complexity",
  "severity": "warning",
  "config": {
    "threshold": 10
  }
}
```

**Analysis Logic:**
```typescript
function analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]) {
  const violations: ArchViolation[] = [];

  for (const rule of this.rules) {
    switch (rule.type) {
      case "layer_boundary":
        violations.push(...this.checkLayerBoundary(rule, symbols, relationships));
        break;

      case "naming_convention":
        violations.push(...this.checkNaming(rule, symbols));
        break;

      case "max_complexity":
        violations.push(...this.checkComplexity(rule, symbols));
        break;

      case "max_parameters":
        violations.push(...this.checkParameters(rule, symbols));
        break;

      case "max_lines":
        violations.push(...this.checkLines(rule, symbols));
        break;

      case "require_tests":
        violations.push(...this.checkTests(rule, symbols));
        break;
    }
  }

  return violations;
}
```

**Layer Boundary Check:**
```typescript
function checkLayerBoundary(
  rule: ArchRule,
  symbols: CodeSymbol[],
  relationships: SymbolRelationship[]
): ArchViolation[] {
  const violations: ArchViolation[] = [];
  const { from, to, allowed } = rule.config;

  // Convert glob patterns to regex
  const fromPattern = globToRegex(from);
  const toPattern = globToRegex(to);

  for (const rel of relationships) {
    const source = symbols.find(s => s.id === rel.sourceId);
    const target = symbols.find(s => s.id === rel.targetId);

    if (!source || !target) continue;

    const sourceMatches = fromPattern.test(source.file);
    const targetMatches = toPattern.test(target.file);

    if (sourceMatches && targetMatches && !allowed) {
      violations.push({
        rule: rule.name,
        file: source.file,
        symbolId: source.id,
        message: `${source.name} in ${from} imports ${target.name} from ${to}`,
        severity: rule.severity
      });
    }
  }

  return violations;
}
```

**Naming Convention Check:**
```typescript
function checkNaming(rule: ArchRule, symbols: CodeSymbol[]): ArchViolation[] {
  const violations: ArchViolation[] = [];
  const { kind, pattern } = rule.config;
  const regex = new RegExp(pattern);

  for (const sym of symbols) {
    if (sym.kind === kind && !regex.test(sym.name)) {
      violations.push({
        rule: rule.name,
        file: sym.file,
        symbolId: sym.id,
        message: `${sym.name} does not match pattern ${pattern}`,
        severity: rule.severity
      });
    }
  }

  return violations;
}
```

**Base Rules Generator:**
```typescript
// src/governance/archGuardBase.ts
export function buildArchGuardBaseRules(options: {
  languages: ("ts" | "js" | "php" | "python" | "go")[];
  metricRules?: boolean;
  maxComplexity?: number;
  maxParameters?: number;
  maxLines?: number;
}): ArchRule[] {
  const rules: ArchRule[] = [];

  // Add language-specific naming conventions
  if (options.languages.includes("ts") || options.languages.includes("js")) {
    rules.push({
      name: "ClassNaming",
      description: "Classes should be PascalCase",
      type: "naming_convention",
      severity: "warning",
      config: { pattern: "^[A-Z][a-zA-Z0-9]*$", kind: "class" }
    });
  }

  if (options.languages.includes("php")) {
    rules.push({
      name: "ClassNaming",
      description: "Classes should be PascalCase",
      type: "naming_convention",
      severity: "warning",
      config: { pattern: "^[A-Z][a-zA-Z0-9]*$", kind: "class" }
    });
  }

  // Add metric rules
  if (options.metricRules) {
    rules.push({
      name: "MaxComplexity",
      description: `Max complexity ${options.maxComplexity}`,
      type: "max_complexity",
      severity: "warning",
      config: { threshold: options.maxComplexity || 10 }
    });
  }

  return rules;
}
```

### 2. Reaper (`reaper.ts`)

Detecta código e documentação mortos/órfãos.

**Criação:**
```typescript
function createReaper(): Reaper
```

**Interface:**
```typescript
interface Reaper {
  scan(
    symbols: CodeSymbol[],
    graph: KnowledgeGraph,
    docMappings: DocMapping[]
  ): ReaperFinding[];

  markDeadCode(
    symbolRepo: SymbolRepository,
    findings: ReaperFinding[]
  ): void;
}

interface ReaperFinding {
  type: "dead_code" | "orphan_doc" | "broken_link" | "undocumented";
  target: string;           // Symbol name or doc path
  reason: string;
  suggestedAction: string;
}
```

**Scan Logic:**
```typescript
function scan(symbols, graph, docMappings) {
  const findings: ReaperFinding[] = [];

  // 1. Dead Code Detection
  const deadCodeSymbols = this.findDeadCode(symbols, graph);
  for (const sym of deadCodeSymbols) {
    findings.push({
      type: "dead_code",
      target: sym.name,
      reason: `Symbol ${sym.name} is not referenced by any other code`,
      suggestedAction: "Remove if truly unused, or export if it's a public API"
    });
  }

  // 2. Orphan Doc Detection
  const orphanDocs = this.findOrphanDocs(docMappings, symbols);
  for (const doc of orphanDocs) {
    findings.push({
      type: "orphan_doc",
      target: doc.docPath,
      reason: `Documentation ${doc.docPath} references non-existent symbols`,
      suggestedAction: "Update symbol references or remove doc"
    });
  }

  // 3. Broken Links
  const brokenLinks = this.findBrokenLinks(docMappings);
  for (const link of brokenLinks) {
    findings.push({
      type: "broken_link",
      target: link.from,
      reason: `Doc ${link.from} links to non-existent ${link.to}`,
      suggestedAction: "Fix link target"
    });
  }

  // 4. Undocumented Public Symbols
  const undocumented = this.findUndocumented(symbols, docMappings);
  for (const sym of undocumented) {
    findings.push({
      type: "undocumented",
      target: sym.name,
      reason: `Public symbol ${sym.name} has no documentation`,
      suggestedAction: "Create documentation or mark as internal"
    });
  }

  return findings;
}
```

**Dead Code Detection:**
```typescript
function findDeadCode(symbols: CodeSymbol[], graph: KnowledgeGraph): CodeSymbol[] {
  const dead: CodeSymbol[] = [];

  for (const sym of symbols) {
    // Skip entry points (exported symbols)
    if (sym.isExported) continue;

    // Check if symbol is referenced
    const dependents = graph.getDependents(sym.id);

    if (dependents.length === 0) {
      // Not referenced by anything
      dead.push(sym);
    }
  }

  return dead;
}
```

**Orphan Doc Detection:**
```typescript
function findOrphanDocs(
  docMappings: DocMapping[],
  symbols: CodeSymbol[]
): DocMapping[] {
  const orphans: DocMapping[] = [];
  const symbolNames = new Set(symbols.map(s => s.name));

  for (const mapping of docMappings) {
    if (!symbolNames.has(mapping.symbolName)) {
      orphans.push(mapping);
    }
  }

  return orphans;
}
```

### 3. Project Status (`projectStatus.ts`)

Gera relatórios abrangentes de saúde do projeto.

**Função:**
```typescript
async function generateProjectStatus(
  options: { docsDir: string },
  services: {
    symbolRepo: SymbolRepository;
    relRepo: RelationshipRepository;
    registry: DocRegistry;
    patternAnalyzer: PatternAnalyzer;
    archGuard: ArchGuard;
    reaper: Reaper;
    graph: KnowledgeGraph;
  }
): Promise<ProjectStatus>
```

**ProjectStatus Type:**
```typescript
interface ProjectStatus {
  timestamp: string;

  // Overview
  totalSymbols: number;
  totalFiles: number;
  totalRelationships: number;

  // Documentation
  documentedSymbols: number;
  documentationCoverage: number;  // %
  totalDocs: number;
  orphanDocs: number;

  // Symbols by kind
  symbolsByKind: Record<SymbolKind, number>;

  // Visibility
  publicSymbols: number;
  privateSymbols: number;

  // Patterns
  patternsDetected: number;
  patternViolations: number;

  // Violations
  archViolations: {
    error: number;
    warning: number;
    info: number;
    total: number;
  };

  // Dead code
  deadCodeSymbols: number;

  // Metrics
  avgComplexity: number;
  avgLinesOfCode: number;
  avgCoverage: number;

  // Top issues
  topComplexFunctions: Array<{ name: string; complexity: number }>;
  lowCoverageSymbols: Array<{ name: string; coverage: number }>;
}
```

**Generation Logic:**
```typescript
async function generateProjectStatus(options, services) {
  const { symbolRepo, relRepo, registry, patternAnalyzer, archGuard, reaper, graph } = services;

  // Load data
  const allSymbols = symbolRepo.findAll();
  const allRels = relationshipRowsToSymbolRelationships(relRepo.findAll());
  await registry.rebuild(options.docsDir);
  const docMappings = await registry.findAllMappings();

  // Run analyses
  const patterns = patternAnalyzer.analyze(allSymbols, allRels);
  const archViolations = archGuard.analyze(allSymbols, allRels);
  const reaperFindings = reaper.scan(allSymbols, graph, docMappings);

  // Calculate metrics
  const documentedSymbols = new Set(docMappings.map(m => m.symbolName)).size;
  const documentationCoverage = (documentedSymbols / allSymbols.length) * 100;

  const complexitySum = allSymbols
    .filter(s => s.complexity)
    .reduce((sum, s) => sum + (s.complexity || 0), 0);
  const avgComplexity = complexitySum / allSymbols.filter(s => s.complexity).length;

  // Group by kind
  const symbolsByKind: Record<string, number> = {};
  for (const sym of allSymbols) {
    symbolsByKind[sym.kind] = (symbolsByKind[sym.kind] || 0) + 1;
  }

  // Top issues
  const topComplexFunctions = allSymbols
    .filter(s => s.complexity && s.complexity > 0)
    .sort((a, b) => (b.complexity || 0) - (a.complexity || 0))
    .slice(0, 10)
    .map(s => ({ name: s.name, complexity: s.complexity! }));

  return {
    timestamp: new Date().toISOString(),
    totalSymbols: allSymbols.length,
    totalFiles: new Set(allSymbols.map(s => s.file)).size,
    totalRelationships: allRels.length,
    documentedSymbols,
    documentationCoverage,
    totalDocs: registry.findAllDocs().length,
    orphanDocs: reaperFindings.filter(f => f.type === "orphan_doc").length,
    symbolsByKind,
    publicSymbols: allSymbols.filter(s => s.isExported).length,
    privateSymbols: allSymbols.filter(s => !s.isExported).length,
    patternsDetected: patterns.length,
    patternViolations: patterns.reduce((sum, p) => sum + p.violations.length, 0),
    archViolations: {
      error: archViolations.filter(v => v.severity === "error").length,
      warning: archViolations.filter(v => v.severity === "warning").length,
      info: archViolations.filter(v => v.severity === "info").length,
      total: archViolations.length
    },
    deadCodeSymbols: reaperFindings.filter(f => f.type === "dead_code").length,
    avgComplexity,
    avgLinesOfCode: allSymbols.reduce((sum, s) => sum + (s.linesOfCode || 0), 0) / allSymbols.length,
    avgCoverage: allSymbols.filter(s => s.coverage).reduce((sum, s) => sum + (s.coverage || 0), 0) / allSymbols.filter(s => s.coverage).length,
    topComplexFunctions,
    lowCoverageSymbols: []
  };
}
```

### 4. Smart Code Review (`smartCodeReview.ts`)

Code review automatizado combinando múltiplas análises.

**Função:**
```typescript
async function performSmartCodeReview(
  options: { docsDir: string; includeExamples: boolean },
  services: {
    symbolRepo: SymbolRepository;
    relRepo: RelationshipRepository;
    registry: DocRegistry;
    patternAnalyzer: PatternAnalyzer;
    archGuard: ArchGuard;
    reaper: Reaper;
    graph: KnowledgeGraph;
    codeExampleValidator?: CodeExampleValidator;
  }
): Promise<string>
```

**Report Sections:**
1. Architecture violations
2. Dead code findings
3. Pattern violations
4. Documentation drift
5. Code example validation (optional)

**Example Output:**
```markdown
# Smart Code Review Report

## Architecture Violations (15)

### Errors (3)
- NoDomainToPersistence: OrderService in src/domain/ imports UserRepository from src/persistence/
- ...

### Warnings (12)
- ClassNaming: orderservice does not match pattern ^[A-Z][a-zA-Z0-9]*$
- ...

## Dead Code (7)

- `calculateTax`: Symbol is not referenced by any other code
  Action: Remove if truly unused, or export if it's a public API
- ...

## Pattern Violations (5)

- SOLID/SRP: OrderService has too many responsibilities (confidence: 85%)
  - Handles payment processing
  - Sends notifications
  - Manages inventory

## Documentation Drift (12)

- OrderService.createOrder: Signature changed but docs not updated
- PaymentService: No documentation found

## Code Examples (23 validated)

- ✅ docs/order-service.md:45-52 (typescript)
- ❌ docs/payment.md:30-35 (typescript) - Syntax error: Unexpected token
- ...

---

**Summary:**
- Total issues: 62
- Critical: 3
- Warnings: 47
- Info: 12
```

### 5. Doc Guard CLI (`docGuardCli.ts`)

Gate para CI/CD validar docs atualizadas.

**Função:**
```typescript
async function runDocGuard(options: {
  base: string;
  head?: string;
  dbPath: string;
  docsDir: string;
}): Promise<{ passed: boolean; message: string }>
```

**CI/CD Integration:**
```yaml
# .github/workflows/pr.yml
- name: Check docs updated
  run: npx docs-kit doc-guard --base main --head ${{ github.sha }}
```

**Logic:**
```typescript
async function runDocGuard({ base, head, dbPath, docsDir }) {
  // 1. Analyze changes
  const impacts = await analyzeChanges({ repoPath: ".", base, head });

  // 2. Load registry
  const db = new Database(dbPath);
  const registry = createDocRegistry(db);
  await registry.rebuild(docsDir);

  // 3. Check cada impact tem doc atualizada
  const missing: string[] = [];

  for (const impact of impacts) {
    const docs = await registry.findDocBySymbol(impact.symbolName);

    if (docs.length === 0) {
      missing.push(impact.symbolName);
      continue;
    }

    // Verifica se doc foi modificada no mesmo PR/commit
    for (const doc of docs) {
      const docPath = path.join(docsDir, doc.docPath);
      const docModified = await isFileModifiedInRange(docPath, base, head);

      if (!docModified) {
        missing.push(`${impact.symbolName} (doc: ${doc.docPath})`);
      }
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      message: `The following symbols changed but docs were not updated:\n${missing.join("\n")}`
    };
  }

  return {
    passed: true,
    message: "All changed symbols have updated documentation"
  };
}
```

## Best Practices

**Arch Guard:**
- Start with base rules, customize gradually
- Use `warning` severity for stylistic rules
- Reserve `error` for critical arch violations

**Reaper:**
- Run regularly (weekly) to keep codebase clean
- Review findings before deleting (false positives)
- Mark intentional "unused" symbols (e.g., future APIs)

**Project Status:**
- Track metrics over time (trend analysis)
- Set coverage targets (e.g., 80% documented)
- Include in sprint retrospectives

## Referências

- [Arch Guard Rules](../examples/arch-guard.json)
- [CI/CD Integration](../examples/github-actions.yml)
- [Pattern Detection](./patterns.md)
