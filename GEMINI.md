# Docs Kit (docs-kit) - Project Context

## Project Overview

**docs-kit** is an intelligent documentation agent and MCP (Model Context Protocol) server designed to bridge the gap between code and documentation. It analyzes code changes, maps symbols to Markdown documents, generates diagrams, and enforces documentation governance.

Key capabilities include:
*   **Intelligent Indexing:** Uses Tree-sitter to parse and index code symbols across multiple languages (TS, JS, Python, Go, PHP, Dart, etc.).
*   **Change Analysis:** Detects code changes and identifies which documentation needs updating.
*   **Documentation Governance:** `docs-guard` CLI ensures PRs include necessary documentation updates.
*   **RAG & Knowledge Graph:** Builds a local knowledge graph and RAG index for semantic search and context-aware answers.
*   **Site Generation:** Generates static documentation sites with Mermaid diagrams and symbol relationships.

## Key Files & Directories

*   `src/`: Source code for the CLI, MCP server, indexer, and other modules.
    *   `src/cli.ts`: CLI entry point.
    *   `src/server.ts`: MCP server entry point.
    *   `src/governance/`: Logic for `docs-guard` and architectural rules.
    *   `src/indexer/`: Code parsing and symbol extraction logic.
    *   `src/docs/`: Documentation management and registry.
*   `docs/`: The project's own documentation (managed by `docs-kit`).
*   `docs.config.js`: Configuration file for `docs-kit` in a project.
*   `.docs-kit/`: Default directory for the SQLite database (`registry.db` or `index.db`).
*   `package.json`: Dependencies and scripts.

## Building and Running

### Setup

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Check dependencies (optional):
    ```bash
    npm run check:deps
    ```

### Development & Build

*   **Build Project:**
    ```bash
    npm run build
    ```
*   **Run Development Server:**
    ```bash
    npm run dev
    ```
*   **Format Code:**
    ```bash
    npm run format
    ```

### Testing

*   **Run Tests:**
    ```bash
    npm run test
    ```
*   **Run Tests with Coverage:**
    ```bash
    npm run test:coverage
    ```

### CLI Usage

The project exports two binaries: `docs-kit` and `docs-guard`.

*   **Run CLI (via npm script):**
    ```bash
    npm run cli -- <command> [options]
    # Example: npm run cli -- index
    ```
*   **Run via Node (after build):**
    ```bash
    node dist/cli.js <command>
    ```

**Common Commands:**
*   `init`: Initialize configuration.
*   `index`: Index the codebase.
*   `build-site`: Generate the static site.
*   `project-status`: Generate a status report.
*   `smart-code-review`: Perform an AI-assisted code review.

### Governance Tool (docs-guard)

Used for validating documentation in CI/CD.

```bash
# Direct execution
node dist/governance/docGuardBin.js --base main --head HEAD
```

## Development Conventions

*   **Language:** TypeScript (Node.js >= 18).
*   **Architecture:** Layered architecture (Interface, Core, Knowledge, Analysis, Governance, Integration).
*   **Database:** SQLite (via `better-sqlite3`) for storing the symbol registry and knowledge graph.
*   **Parsing:** Tree-sitter is used for robust code parsing.
*   **LLM Integration:** Supports OpenAI, Claude, Gemini, and Ollama via the `LlmProvider` interface.
*   **Testing:** Jest is used for unit and integration testing.
*   **Style:** Prettier and ESLint are used for code formatting and linting.
*   **Documentation:** The project uses itself to document itself. Core documentation is in `docs/` and linked to code symbols via `DocRegistry`.
