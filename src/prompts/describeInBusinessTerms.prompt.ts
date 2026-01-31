/**
 * Prompt for describing code in business terms (rules, if/else, outcomes).
 * Used by Business Translator to generate natural-language descriptions for product/compliance.
 */

export interface DescribeInBusinessTermsInput {
  /** Symbol name (e.g. OrderService.createOrder) */
  symbolName: string;
  /** Kind of symbol (class, method, function, etc.) */
  kind: string;
  /** Source code snippet of the symbol */
  sourceCode: string;
  /** Optional existing doc or comment for context */
  existingContext?: string;
}

/**
 * Builds a prompt that asks the LLM to describe the given code in business terms:
 * rules, conditions (if/else), outcomes, and user-facing behavior.
 */
export function buildDescribeInBusinessTermsPrompt(input: DescribeInBusinessTermsInput): string {
  const { symbolName, kind, sourceCode, existingContext } = input;

  const parts: string[] = [
    "You are a business analyst translating technical code into clear business language for product and compliance stakeholders.",
    "",
    "## Task",
    "Describe the following code in business terms: focus on rules, conditions (if/else), outcomes, and what happens from a user or business process perspective. Avoid jargon; use plain language.",
    "",
    "## Symbol",
    `- **Name**: ${symbolName}`,
    `- **Kind**: ${kind}`,
    "",
    "## Source Code",
    "```",
    sourceCode,
    "```",
  ];

  if (existingContext) {
    parts.push("", "## Existing context (doc or comment)", existingContext);
  }

  parts.push(
    "",
    "## Output",
    "Provide a short paragraph (2–5 sentences) describing:",
    "- What business rule or process this code implements",
    "- Main conditions and their outcomes",
    "- Any important edge cases or validations from a business perspective",
  );

  return parts.join("\n");
}
