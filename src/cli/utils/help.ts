/**
 * CLI help text
 */

export function printHelp(): void {
  console.log(`docs-kit - Intelligent documentation agent

SETUP
  docs-kit init [dir]                          Create docs.config.js with defaults

INDEX
  docs-kit index [dir] [--db path]             Scan source files, extract symbols &
                       [--docs dir] [--full]   relationships, compute metrics

BUILD
  docs-kit build-site  [--out dir] [--db path] Generate navigable HTML site
                       [--root dir]
  docs-kit build-docs  [--out dir] [--db path] Generate structured Markdown docs
                       [--root dir]

ANALYZE
  docs-kit explain-symbol <symbol>             Explain a symbol (code + docs + LLM)
                       [--docs dir] [--db path]
                       [--cwd dir] [--no-llm]
  docs-kit impact-analysis <symbol>            What breaks if this symbol changes
                       [--max-depth n]
                       [--db path] [--docs dir]
  docs-kit analyze-patterns [--db path]        Detect patterns & SOLID violations

INSPECT
  docs-kit inspect <symbol>                    Show context quality metrics for a
                       [--file path]           symbol (tokens, latency, coverage)
                       [--db path] [--docs dir]
                       [--verbose]

SERVER
  docs-kit serve       [--port 7337]           Start local HTTP API for the site
                       [--db path] [--docs dir] inspector (inspector.html)

  docs-kit --help                              Show this help

Additional tools available as MCP tools in Copilot/Claude (19 tools including
generateDocs, scanFile, askKnowledgeBase, smartCodeReview, and more).
Run: npx docs-kit index && npx docs-kit build-site  to get started.
`);
}
