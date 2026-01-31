# Task 16 — Arch Guard

> **Status:** done
> **Layer:** Governance
> **Priority:** Release 1
> **Depends on:** 02, 12, 15
> **Unblocks:** —

## Pain Point
Architecture rules (layer boundaries, import restrictions, naming conventions) are documented but never enforced automatically. Over time, the architecture "rots" as violations accumulate. (`start.md §3.1`: "Arch Guard: aplica regras de arquitetura (camadas, imports proibidos, convenções de nomes)").

## Objective
Enforce configurable architecture rules (layer constraints, forbidden imports, naming conventions) and report violations in CI/PRs.

## Technical Hints

```ts
// src/governance/archGuard.ts

export interface ArchRule {
  name: string;
  description: string;
  type: "layer_boundary" | "forbidden_import" | "naming_convention";
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
  analyze(symbols: CodeSymbol[], relationships: SymbolRelationship[]): ArchViolation[];
}

export function createArchGuard(): ArchGuard;
```

Example rule config (`.arch-guard.json`):

```json
{
  "rules": [
    {
      "name": "domain-no-infra",
      "type": "layer_boundary",
      "config": {
        "source": "src/domain/**",
        "forbidden": ["src/infrastructure/**", "src/controllers/**"]
      }
    }
  ]
}
```

## Files Involved
- `src/governance/archGuard.ts` — rule engine
- `tests/governance.test.ts` — unit tests

## Acceptance Criteria
- [ ] Loads rules from config file
- [ ] Detects layer boundary violations (domain importing infra)
- [ ] Detects forbidden import patterns
- [ ] Reports violations with file, symbol, and rule name
- [ ] Configurable severity (error vs warning)
- [ ] Unit tests for each rule type

## Scenarios / Examples

```ts
const guard = createArchGuard();
await guard.loadRules(".arch-guard.json");
const violations = guard.analyze(symbols, relationships);
// [{ rule: "domain-no-infra", file: "src/domain/order.ts", message: "Imports from src/infrastructure/db.ts" }]
```
