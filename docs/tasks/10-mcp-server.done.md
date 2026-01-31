# Task 10 — MCP Server

> **Status:** done
> **Layer:** Interface
> **Priority:** MVP
> **Depends on:** 05, 08, 09
> **Unblocks:** —

## Pain Point
All the analysis and doc-update logic is useless if developers can't invoke it from their editor. The MCP protocol enables VS Code / Copilot integration so developers can trigger doc updates, explain symbols, and generate diagrams without leaving their IDE (`start.md §4.2, §6.1`).

## Objective
Implement an MCP server that exposes the core tools: `generateDocs`, `explainSymbol`, `generateMermaid`, plus future stubs for `analyzePatterns` and `generateEventFlow`.

## Technical Hints

```ts
// src/server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "docs-kit",
  version: "1.0.0",
});

server.tool("generateDocs", {
  description: "Update docs for symbols affected by recent changes",
  parameters: {
    base: { type: "string", description: "Base ref (e.g. main)", default: "main" },
    head: { type: "string", description: "Head ref", optional: true },
    dryRun: { type: "boolean", description: "Preview without writing", default: false },
  },
  handler: async (params) => {
    const impacts = await analyzeChanges({ repoPath: ".", base: params.base, head: params.head });
    const results = await docUpdater.applyChanges(impacts, registry);
    return { impacts: impacts.length, updates: results };
  },
});

server.tool("explainSymbol", {
  description: "Explain a code symbol combining code analysis and existing docs",
  parameters: {
    symbol: { type: "string", description: "Symbol name (e.g. OrderService.createOrder)" },
  },
  handler: async (params) => {
    // Lookup symbol in index + find linked doc
    // Return combined explanation
  },
});

server.tool("generateMermaid", {
  description: "Generate Mermaid diagram for given symbols",
  parameters: {
    symbols: { type: "string", description: "Comma-separated symbol names" },
    type: { type: "string", description: "Diagram type: classDiagram, sequenceDiagram, flowchart" },
  },
  handler: async (params) => {
    // Generate Mermaid syntax based on symbol relationships
  },
});

// Start server
server.start();
```

Server configuration from `mcp.json`:

```json
{
  "name": "docs-kit",
  "description": "Intelligent documentation agent via MCP",
  "command": "node",
  "args": ["dist/server.js"],
  "env": { "NODE_ENV": "production" }
}
```

## Files Involved
- `src/server.ts` — MCP server entry point
- `src/config.ts` — configuration loader
- `mcp.json` — MCP descriptor
- `tests/` — integration tests for tool handlers

## Acceptance Criteria
- [ ] Server starts and registers tools via MCP protocol
- [ ] `generateDocs` tool triggers the full analysis → update pipeline
- [ ] `explainSymbol` returns meaningful output for known symbols
- [ ] `generateMermaid` produces valid Mermaid syntax
- [ ] Server handles errors gracefully (returns error messages, doesn't crash)
- [ ] `node dist/server.js &` starts the server in background (per CLAUDE.md)
- [ ] Integration test verifying tool registration and basic invocation

## Scenarios / Examples

```
# VS Code / Copilot usage
@docs-kit generateDocs --base main
→ "Updated 3 doc sections across 2 files"

@docs-kit explainSymbol symbol=OrderService.createOrder
→ "OrderService.createOrder creates a new order... [combined from code + docs]"

@docs-kit generateMermaid symbols=OrderService,PaymentService type=classDiagram
→ ```mermaid
   classDiagram
     OrderService --> PaymentService : uses
     OrderService : +createOrder()
     PaymentService : +charge()
   ```
```
