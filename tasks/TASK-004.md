# Task: TASK-004
## Branch: feat/TASK-004

**Description:**
Implementar Executable Docs (validação de exemplos de código em docs) e docs-guard CLI (gate no CI para impedir drift de documentação).

**Metadata:**
- **Priority:** High
- **Status:** Done
- **Start Date:** 2026-01-31
- **End Date:** 2026-01-31
- **Due Date:** 2026-02-14

**To Do:**
  - [x] 1. Implement Executable Docs 🔴
  > Validate code examples in docs against real code.
  >
  > - [x] 1.1 Extract code blocks from docs
  > - [x] 1.2 Run examples and check for errors
  > - [x] 1.3 Add MCP tool for validation
  >> [!TIP]
  >> Use existing codeExampleValidator.ts.

  ---

  - [x] 2. Implement docs-guard CLI 🟡
  > CI gate that fails build if semantic changes lack doc updates.
  >
  > - [x] 2.1 Create CLI command for audit
  > - [x] 2.2 Integrate with Change Analyzer
  > - [x] 2.3 Add failure logic for unhandled impacts
  >> [!NOTE]
  >> Use existing docGuardCli.ts and docGuardBin.ts.

  ---

  - [x] 3. Test and integrate 🟡
  > Add tests and ensure CI integration.
  >> [!NOTE]
  >> Run npm test and test CLI.

  ---