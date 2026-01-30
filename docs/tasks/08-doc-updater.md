# Task 08 — Doc Updater

> **Status:** pending
> **Layer:** Documentation
> **Priority:** MVP
> **Depends on:** 05, 07
> **Unblocks:** 09

## Pain Point
Developers dread updating docs because they don't know which section to change, and manual edits often break formatting or miss related sections. The system should surgically update only the affected section, preserving everything else (as stated in `start.md §3.1`: "atualiza e remove seções específicas, sem criar docs novas nem mexer no resto").

## Objective
Given a `ChangeImpact` and the linked doc file, update or remove the specific section(s) related to the changed symbol — without touching other content or creating new files.

## Technical Hints

```ts
// src/docs/docUpdater.ts

import { ChangeImpact } from "../indexer/symbol.types";
import { DocMapping } from "./docRegistry";

export interface UpdateResult {
  docPath: string;
  symbolName: string;
  action: "updated" | "removed" | "skipped";
  sectionHeading?: string;
  diff?: string;               // before/after of the changed section
}

export interface DocUpdater {
  /**
   * Update doc sections for impacted symbols.
   * - "modified" / "added" → update or append section content
   * - "removed" → remove the section
   * Never creates new .md files.
   */
  applyChanges(
    impacts: ChangeImpact[],
    registry: DocRegistry
  ): Promise<UpdateResult[]>;
}

export function createDocUpdater(options?: { dryRun?: boolean }): DocUpdater;
```

Section detection by heading — find the heading that matches the symbol name:

```ts
interface MarkdownSection {
  heading: string;
  level: number;
  startLine: number;
  endLine: number;      // line before next same-or-higher-level heading
  content: string;
}

function parseSections(markdown: string): MarkdownSection[];
```

Update strategy:

```ts
async applyChanges(impacts, registry) {
  const results: UpdateResult[] = [];

  for (const impact of impacts.filter(i => i.docUpdateRequired)) {
    const mappings = await registry.findDocBySymbol(impact.symbol.name);
    if (mappings.length === 0) { results.push({ ...skipped }); continue; }

    for (const mapping of mappings) {
      const markdown = await readFile(mapping.docPath, "utf-8");
      const sections = parseSections(markdown);

      if (impact.changeType === "removed") {
        const updated = removeSection(markdown, sections, impact.symbol.name);
        await writeFile(mapping.docPath, updated);
        results.push({ action: "removed", ... });
      } else {
        // Generate updated content (placeholder for LLM prompt in future)
        const updated = updateSection(markdown, sections, impact.symbol.name, impact);
        await writeFile(mapping.docPath, updated);
        results.push({ action: "updated", ... });
      }
    }
  }
  return results;
}
```

The `updateSection` function in MVP can use a template-based approach. Post-MVP will integrate LLM via `updateSectionPrompt` (ref: `start.md §3.2.1 step 3`).

## Files Involved
- `src/docs/docUpdater.ts` — section-level updater
- `src/prompts/updateSection.prompt.ts` — prompt template (stub in MVP)
- `tests/docs.test.ts` — unit tests

## Acceptance Criteria
- [ ] Updates the correct section when a symbol is modified
- [ ] Removes the correct section when a symbol is deleted
- [ ] Never creates new `.md` files
- [ ] Never modifies sections unrelated to the changed symbol
- [ ] Supports `dryRun` mode that returns diffs without writing
- [ ] Handles docs with no matching section (returns `skipped`)
- [ ] Unit tests with markdown fixtures

## Scenarios / Examples

```ts
const updater = createDocUpdater({ dryRun: false });
const results = await updater.applyChanges(impacts, registry);
// [
//   { docPath: "docs/domain/orders.md", symbolName: "createOrder", action: "updated",
//     sectionHeading: "## createOrder" },
//   { docPath: "docs/domain/orders.md", symbolName: "legacyMethod", action: "removed" }
// ]
```
