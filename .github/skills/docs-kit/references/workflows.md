# docs-kit MCP — Workflow Examples

End-to-end examples for the most common tasks. Each example shows the exact sequence of tool calls and what to do with the results.

---

## Example 1: Explaining a method to a developer

**Prompt:** "explain how `UserRepository.findByEmail` works"

**Step 1 — Find the symbol**

```
searchSymbols(query: "UserRepository.findByEmail")
```

Result: `UserRepository.findByEmail (method) @ src/repositories/user.repository.ts:34`

**Step 2 — Get explanation**

```
explainSymbol(symbol: "UserRepository.findByEmail")
```

Result: Cached or freshly generated explanation with purpose, parameters, return value, dependencies, and doc links.

**Step 3 — Cache if new**

```
updateSymbolExplanation(
  symbol: "UserRepository.findByEmail",
  explanation: "<the explanation text from step 2>"
)
```

**Answer:** Use the explanation from step 2 directly. Do not open the file.

---

## Example 2: Code review before merging a PR

**Prompt:** "review the changes in this branch before I merge"

**Step 1 — Project baseline**

```
projectStatus()
```

Result: Current doc coverage %, violation count, dead code count. Establishes a baseline.

**Step 2 — Full review**

```
smartCodeReview(docsDir: "docs", includeExamples: true)
```

Result: Architecture violations, pattern issues, dead code candidates, stale doc examples.

**Step 3 — Pattern deep-dive** (if smartCodeReview flags pattern issues)

```
analyzePatterns()
```

Result: SOLID violations with confidence scores, affected symbol groups.

**Answer format:**

```
## Code Review Summary

### Architecture Violations
- [list from smartCodeReview]

### Design Pattern Issues
- [list from analyzePatterns]

### Dead Code Candidates
- [list with confidence scores]

### Documentation Issues
- [stale examples, orphan docs]

### Recommendation
[merge / address issues first / blocker]
```

---

## Example 3: Impact analysis before changing a service

**Prompt:** "I want to change the signature of `PaymentService.processPayment` — what breaks?"

**Step 1 — Confirm symbol**

```
searchSymbols(query: "PaymentService.processPayment", kind: "method")
```

**Step 2 — Traverse dependents**

```
impactAnalysis(symbol: "PaymentService.processPayment", maxDepth: 3)
```

Result: List of dependent symbols at each depth level.

**Step 3 — Visualize**

```
generateMermaid(
  symbols: "PaymentService.processPayment,OrderController,InvoiceService",
  type: "classDiagram"
)
```

Result: Diagram showing dependency chain.

**Answer format:**

```
## Impact Analysis: PaymentService.processPayment

### Direct dependents (high risk)
- OrderController.checkout — calls this method directly
- InvoiceService.generate — relies on return value

### Indirect dependents (medium risk)
- NotificationService — triggered by OrderController

### Suggested change order
1. Update PaymentService.processPayment
2. Update OrderController.checkout
3. Update InvoiceService.generate
4. Verify NotificationService still works

[mermaid diagram]
```

---

## Example 4: Generating docs after a change

**Prompt:** "I just refactored OrderService — update the docs"

**Step 1 — Preview changes**

```
generateDocs(base: "main", head: "HEAD", dryRun: true, docsDir: "docs")
```

Result: List of sections that would be updated.

**Step 2 — Apply if preview looks correct**

```
generateDocs(base: "main", head: "HEAD", dryRun: false, docsDir: "docs")
```

Result: `updated: OrderService.createOrder in docs/modules/orders.md`

**Step 3 — Validate examples**

```
validateExamples(docsDir: "docs")
```

Result: Any examples that are now stale after the refactor.

**Note:** `generateDocs` never creates new doc files — it only updates existing sections. If a new symbol was added with no doc file, use `scanFile` first.

---

## Example 5: Onboarding a new backend engineer

**Prompt:** "create an onboarding guide for a new engineer joining the payments team"

**Step 1 — Generate learning path**

```
createOnboarding(topic: "payments and billing flow")
```

Result: Structured learning path with docs references ordered by complexity.

**Step 2 — Build traceability context**

```
buildTraceabilityMatrix()
```

Result: Map of recent tickets → symbols → docs to show what was recently changed.

**Step 3 — Fill knowledge gaps**

```
askKnowledgeBase(question: "what external payment providers are integrated?")
askKnowledgeBase(question: "how are payment retries handled?")
```

**Answer format:**

```
## Onboarding Guide — Payments Team

### Week 1: Core Concepts
[from createOnboarding]

### Key Symbols to Understand
- PaymentService (service) — [link]
- PaymentRepository (repository) — [link]
- InvoiceService (service) — [link]

### Recent Activity (last 30 days)
[from buildTraceabilityMatrix — tickets and what changed]

### FAQ
[from askKnowledgeBase answers]
```

---

## Example 6: Dead code cleanup sprint

**Prompt:** "find all dead code and orphan docs in this project"

**Step 1 — Full scan**

```
scanForDeadCode(status: "active")
```

Result: List of findings (dead symbols, orphan docs, broken links) with confidence scores.

**Step 2 — Validate each candidate** (for any with confidence < 90%)

```
impactAnalysis(symbol: "SuspectSymbol")
```

Result: If dependents exist, it's a false positive. If none, deletion is safe.

**Step 3 — Mark false positives**

```
updateDeadCodeStatus(target: "SuspectSymbol", status: "false_positive")
```

**Step 4 — Report**

```
## Dead Code Report

### Safe to delete (confidence ≥ 90%, zero dependents)
- LegacyEmailFormatter @ src/utils/legacy.ts:45
- OldPaymentAdapter @ src/adapters/old-payment.ts:12

### Needs manual review (confidence 70–89%)
- OrderHelper @ src/utils/order.ts:89 — used in 1 test only

### Orphan documentation
- docs/modules/deprecated-auth.md — no linked symbols

### False positives (marked, won't reappear)
- SuspectSymbol — used via dynamic dispatch
```

---

## Example 7: Architecture diagram for a domain

**Prompt:** "show me the architecture of the order processing domain"

**Step 1 — Find relevant symbols**

```
searchSymbols(query: "order", layer: "service")
searchSymbols(query: "order", kind: "repository")
```

Results: `OrderService`, `OrderRepository`, `OrderController`, `OrderCreatedEvent`

**Step 2 — Class diagram**

```
generateMermaid(
  symbols: "OrderService,OrderRepository,OrderController,OrderCreatedEvent",
  type: "classDiagram"
)
```

**Step 3 — Event flow** (if events are involved)

```
generateEventFlow()
```

**Answer:** Render both diagrams inline, followed by a brief narrative from `askKnowledgeBase(question: "how does order processing work end to end?")`.

---

## Example 8: Translating technical work for stakeholders

**Prompt:** "explain what OrderService.createOrder does to a product manager"

**Step 1 — Get business description**

```
describeInBusinessTerms(symbol: "OrderService.createOrder")
```

Result: Plain-language description focused on business outcome, not implementation.

**Answer:** Use the business description directly. No code, no jargon, no file paths.
