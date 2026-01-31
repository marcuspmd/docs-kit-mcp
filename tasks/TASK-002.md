# Task: TASK-002
## Branch: feat/TASK-002

**Description:**
Expand MCP tools: Add impactAnalysis (using Knowledge Graph for dependencies), analyzePatterns (reports of violations SOLID), generateEventFlow (simulation of flows), createOnboarding (paths via RAG), askKnowledgeBase (Q&A conversacional).

**Metadata:**
- **Priority:** High
- **Status:** Done
- **Start Date:** 2026-01-31
- **End Date:**
- **Due Date:** 2026-02-14

**To Do:**
  - [x] 1. Implement impactAnalysis tool 🔴
  > Add tool to analyze what breaks if a symbol changes, using Knowledge Graph.
  >
  > - [x] 1.1 Create function to traverse relationships
  > - [x] 1.2 Add MCP tool in server.ts
  >> [!TIP]
  >> Use graph queries to find dependents.

  ---

  - [x] 2. Implement analyzePatterns tool 🟡
  > Detect patterns and violations (SOLID, etc.), generate reports.
  >> [!NOTE]
  >> Integrate with existing Pattern Analyzer.

  ---

  - [x] 3. Implement generateEventFlow tool 🟡
  > Simulate event flows and listeners.
  >> [!NOTE]
  >> Use Event Flow Analyzer.

  ---

  - [x] 4. Implement createOnboarding tool 🟢
  > Generate learning paths using RAG.
  >> [!IMPORTANT]
  >> Combine Knowledge Graph and RAG for paths.

  ---

  - [x] 5. Implement askKnowledgeBase tool 🟢
  > Conversational Q&A on code + docs.
  >> [!TIP]
  >> Use RAG for semantic search.

  ---

  - [x] 6. Test all new tools 🟡
  > Add unit tests and integration tests for each tool.
  >> [!NOTE]
  >> Ensure MCP protocol compliance.
  ---