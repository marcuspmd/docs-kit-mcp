# Task: TASK-003
## Branch: feat/TASK-003

**Description:**
Implementar ferramentas MCP para governança e rastreabilidade: analyzeArchitecture (regras de arquitetura), scanForDeadCode (código morto), buildTraceabilityMatrix (RTM).

**Metadata:**
- **Priority:** High
- **Status:** Done
- **Start Date:** 2026-01-31
- **End Date:** 2026-01-31
- **Due Date:** 2026-02-07

**To Do:**
  - [x] 1. Implement analyzeArchitecture tool 🔴
  > Add tool to analyze architecture violations using ArchGuard.
  >
  > - [x] 1.1 Set default rules for naming conventions
  > - [x] 1.2 Add MCP tool in server.ts
  >> [!TIP]
  >> Use existing ArchGuard implementation.

  ---

  - [x] 2. Implement scanForDeadCode tool 🟡
  > Detect dead code and orphan docs using Reaper.
  >> [!NOTE]
  >> Integrate with existing Reaper.

  ---

  - [x] 3. Implement buildTraceabilityMatrix tool 🟢
  > Build RTM from commits and comments using ContextMapper.
  >> [!NOTE]
  >> Use existing ContextMapper.

  ---

  - [x] 4. Test new tools 🟡
  > Add unit tests and ensure MCP compliance.
  >> [!NOTE]
  >> Run npm test to validate.

  ---
