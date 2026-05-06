import type { CodeSymbol } from "../indexer/symbol.types.js";

export interface ExplainSymbolInput {
  symbol: CodeSymbol;
  sourceCode?: string;
  docContent?: string;
  dependencies?: CodeSymbol[];
  dependents?: CodeSymbol[];
  maxSourceLines?: number;
  outputLanguage?: string;
  verbosity?: "brief" | "detailed";
}

const DEFAULT_MAX_SOURCE_LINES = 80;

function truncateSourceCode(sourceCode: string, maxSourceLines: number): string {
  const lines = sourceCode.split("\n");
  if (lines.length <= maxSourceLines) return sourceCode;
  return `${lines.slice(0, maxSourceLines).join("\n")}\n// ... (+${lines.length - maxSourceLines} lines)`;
}

export function buildExplainSymbolPrompt(input: ExplainSymbolInput): string {
  const {
    symbol,
    sourceCode,
    docContent,
    dependencies,
    dependents,
    maxSourceLines = DEFAULT_MAX_SOURCE_LINES,
    outputLanguage = "pt-BR",
    verbosity = "detailed",
  } = input;

  const parts: string[] = [
    `You are a senior software engineer explaining code to a teammate. Provide a clear, thorough explanation.`,
    ``,
    `## Symbol: ${symbol.qualifiedName || symbol.name}`,
    `- **Kind**: ${symbol.kind}`,
    `- **File**: ${symbol.file}:${symbol.startLine}-${symbol.endLine}`,
  ];

  if (symbol.signature) parts.push(`- **Signature**: \`${symbol.signature}\``);
  if (symbol.layer) parts.push(`- **Layer**: ${symbol.layer}`);
  if (symbol.pattern) parts.push(`- **Pattern**: ${symbol.pattern}`);
  if (symbol.extends) parts.push(`- **Extends**: ${symbol.extends}`);
  if (symbol.implements?.length) parts.push(`- **Implements**: ${symbol.implements.join(", ")}`);
  if (symbol.deprecated) parts.push(`- **DEPRECATED**`);

  if (sourceCode) {
    parts.push(``, `## Source Code`, "```", truncateSourceCode(sourceCode, maxSourceLines), "```");
  }

  if (docContent) {
    parts.push(``, `## Existing Documentation`, docContent);
  }

  if (dependencies?.length) {
    parts.push(``, `## Dependencies (this symbol uses):`);
    for (const dep of dependencies) {
      parts.push(`- ${dep.name} (${dep.kind} in ${dep.file})`);
    }
  }

  if (dependents?.length) {
    parts.push(``, `## Dependents (use this symbol):`);
    for (const dep of dependents) {
      parts.push(`- ${dep.name} (${dep.kind} in ${dep.file})`);
    }
  }

  parts.push(``, `## Instructions`);
  if (verbosity === "brief") {
    parts.push(`Explain purpose, behavior, usage, dependencies, and gotchas concisely.`);
  } else {
    parts.push(
      `Provide:`,
      `1. **Purpose**: What this ${symbol.kind} does and why it exists`,
      `2. **How it works**: Key logic, algorithms, or patterns used`,
      `3. **Dependencies**: How it relates to the symbols listed above`,
      `4. **Usage**: How other code should use this symbol`,
      `5. **Gotchas**: Any non-obvious behavior, edge cases, or caveats`,
    );
  }
  parts.push(`**Responda em ${outputLanguage}**`);

  return parts.join("\n");
}

/**
 * Build the prompt for MCP with instructions to update the explanation cache.
 */
export function buildExplainSymbolPromptForMcp(
  input: ExplainSymbolInput,
  cachedExplanation?: string,
): string {
  const basePrompt = buildExplainSymbolPrompt(input);

  if (cachedExplanation) {
    return `${basePrompt}

## Cached Explanation
The following explanation is cached. If the symbol has changed, provide a fresh explanation:

${cachedExplanation}

---

**Important**: After providing your explanation, you MUST call the docs-kit 'updateSymbolExplanation' tool to update the cache with your response. Pass the symbol name and your explanation to that tool.`;
  }

  return `${basePrompt}

---

**Important**: After providing your explanation, you MUST call the docs-kit 'updateSymbolExplanation' tool to cache your response for future use. Pass the symbol name and your explanation to that tool.`;
}
