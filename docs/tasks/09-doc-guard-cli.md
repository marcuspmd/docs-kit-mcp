# Task 09 — Doc-Guard CLI

> **Status:** pending
> **Layer:** Governance
> **Priority:** MVP
> **Depends on:** 05, 08
> **Unblocks:** 10

## Pain Point
QA engineers and DevOps teams have no CI gate for documentation. Code ships with outdated docs because there's nothing to enforce doc updates alongside code changes. As `start.md §3.2.1 step 5` states: "CI aprova somente se impactos em docs forem tratados".

## Objective
Build a CLI tool that runs in CI, analyzes the current PR/commit for semantic changes, and fails the build if any `docUpdateRequired` change lacks a corresponding doc update.

## Technical Hints

```ts
// src/governance/docGuardCli.ts

export interface DocGuardOptions {
  repoPath: string;
  base: string;          // base ref (e.g., "main")
  head?: string;         // head ref (default: HEAD)
  strict?: boolean;      // fail on any unresolved impact (default: true)
}

export interface DocGuardResult {
  passed: boolean;
  totalChanges: number;
  coveredChanges: number;
  uncoveredChanges: DocGuardViolation[];
}

export interface DocGuardViolation {
  symbolName: string;
  file: string;
  changeType: string;
  docPath?: string;      // linked doc (if any)
  reason: string;        // why it failed
}

export async function runDocGuard(options: DocGuardOptions): Promise<DocGuardResult>;
```

CLI entry point using `parseArgs`:

```ts
#!/usr/bin/env node

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "main" },
    head: { type: "string" },
    strict: { type: "boolean", default: true },
  },
});

const result = await runDocGuard({
  repoPath: process.cwd(),
  base: values.base!,
  head: values.head,
  strict: values.strict,
});

if (!result.passed) {
  console.error(`Doc-Guard: ${result.uncoveredChanges.length} symbol(s) changed without doc updates:`);
  for (const v of result.uncoveredChanges) {
    console.error(`  - ${v.symbolName} (${v.file}): ${v.reason}`);
  }
  process.exit(1);
}
console.log(`Doc-Guard: ${result.coveredChanges}/${result.totalChanges} changes covered.`);
```

The check logic:

```ts
async function runDocGuard(options: DocGuardOptions): Promise<DocGuardResult> {
  const impacts = await analyzeChanges(options);
  const requiring = impacts.filter(i => i.docUpdateRequired);

  // Get list of files changed in the PR (docs)
  const changedFiles = await getChangedFiles(options);
  const changedDocs = changedFiles.filter(f => f.endsWith(".md"));

  const violations: DocGuardViolation[] = [];
  for (const impact of requiring) {
    const mappings = await registry.findDocBySymbol(impact.symbol.name);
    const docTouched = mappings.some(m => changedDocs.includes(m.docPath));
    if (!docTouched) {
      violations.push({
        symbolName: impact.symbol.name,
        file: impact.symbol.file,
        changeType: impact.changeType,
        docPath: mappings[0]?.docPath,
        reason: mappings.length === 0
          ? "No doc linked to this symbol"
          : "Linked doc was not updated in this PR",
      });
    }
  }

  return {
    passed: violations.length === 0,
    totalChanges: requiring.length,
    coveredChanges: requiring.length - violations.length,
    uncoveredChanges: violations,
  };
}
```

## Files Involved
- `src/governance/docGuardCli.ts` — CLI + guard logic
- `package.json` — add `bin` entry for `doc-guard`
- `tests/governance.test.ts` — unit tests

## Acceptance Criteria
- [ ] `doc-guard --base main` exits 0 when all impacted symbols have updated docs
- [ ] Exits 1 with clear error messages when docs are missing
- [ ] Lists each violation with symbol name, file, and reason
- [ ] Supports `--strict=false` to warn without failing
- [ ] Works as an npm bin (`npx doc-guard --base main`)
- [ ] Unit tests with mocked analyzer + registry

## Scenarios / Examples

```bash
# In CI pipeline
npx doc-guard --base origin/main
# Doc-Guard: 2 symbol(s) changed without doc updates:
#   - OrderService.createOrder (src/services/order.ts): Linked doc was not updated in this PR
#   - PaymentGateway (src/services/payment.ts): No doc linked to this symbol
# exit code 1

# After updating docs
npx doc-guard --base origin/main
# Doc-Guard: 3/3 changes covered.
# exit code 0
```
