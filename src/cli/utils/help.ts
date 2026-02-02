/**
 * CLI help text
 */

export function printHelp(): void {
  console.log(`docs-kit - Intelligent documentation agent

Usage:
  docs-kit init [dir]                                    Create docs.config.js with defaults
  docs-kit index [dir] [--db path] [--docs dir] [--full]
                                                        Index repository (config from cwd; [dir] = folder to index)
  docs-kit build-site [--out dir] [--db path] [--root dir]
                                                        Generate static HTML site
  docs-kit build-docs [--out dir] [--db path] [--root dir]
                                                        Generate Markdown documentation
  docs-kit generate-repo-docs [repo-dir] [docs-dir]     Generate markdown docs
  docs-kit project-status [--db path] [--docs dir]      Generate project status report
  docs-kit smart-code-review [--db path] [--docs dir] [--no-examples]
                                                        Perform comprehensive code review
  docs-kit dead-code [--db path] [--docs dir]            Scan and mark dead code in database
  docs-kit generate-docs [--base ref] [--head ref] [--dry-run] [--docs dir]
                                                        Update docs for symbols affected by changes
  docs-kit explain-symbol <symbol> [--docs dir]          Explain symbol with code + docs context
  docs-kit generate-mermaid <symbols> [--type classDiagram|sequenceDiagram|flowchart]
                                                        Generate Mermaid diagram for symbols
  docs-kit scan-file <file> [--docs dir] [--db path]    Scan file and create docs for symbols
  docs-kit impact-analysis <symbol> [--max-depth n] [--db path] [--docs dir]
                                                        Analyze what breaks if symbol changes
  docs-kit analyze-patterns [--db path]                 Detect patterns and violations
  docs-kit generate-event-flow [--db path]              Simulate event flows and listeners
  docs-kit create-onboarding <topic> [--docs dir] [--db path]
                                                        Generate learning path using RAG
  docs-kit ask-knowledge-base <question> [--docs dir] [--db path]
                                                        Q&A on code + docs (uses LLM)
  docs-kit init-arch-guard [--lang ts|js|php|python|go]              Generate archGuard config snippet
  docs-kit traceability-matrix [--docs dir] [--db path]  Requirements traceability matrix
  docs-kit describe-business <symbol> [--docs dir] [--db path]
                                                        Describe symbol in business terms
  docs-kit validate-examples [--docs dir] [docs-path] [--db path]
                                                        Validate code examples in docs
  docs-kit relevant-context [--symbol name] [--file path] [--docs dir] [--db path]
                                                        Get context for symbol or file
  docs-kit --help                                        Show this help

Commands:
  init               Create docs.config.js with default settings
  index              Scan source files, extract symbols, relationships, metrics
  build-site         Generate navigable HTML documentation from index
  build-docs         Generate structured Markdown documentation from index
  generate-repo-docs Create markdown doc stubs for undocumented symbols
  project-status     Generate comprehensive project status report
  smart-code-review  Perform comprehensive code review with multiple analyses
  generate-docs      Update docs for symbols affected by recent git changes
  explain-symbol     Explain a symbol combining code analysis and existing docs
  generate-mermaid   Generate Mermaid diagram for given symbols
  scan-file          Scan TS file and generate docs for undocumented symbols
  impact-analysis    Analyze impact of changing a symbol (Knowledge Graph)
  analyze-patterns   Detect patterns and violations (SOLID, etc.)
  generate-event-flow Simulate event flows and listeners (Mermaid)
  create-onboarding  Generate learning path using RAG
  ask-knowledge-base Q&A on code + docs (LLM)
  init-arch-guard     Generate archGuard configuration snippet for docs.config.js
  traceability-matrix Requirements traceability matrix
  describe-business  Describe symbol in business terms
  validate-examples  Validate code examples in documentation
  relevant-context   Get comprehensive context for symbol or file
`);
}
