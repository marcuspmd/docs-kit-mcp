/**
 * Business Translator: generates business-language descriptions from code (if/else, rules).
 * Used for product/compliance stakeholders and RTM narratives.
 * @see start.md §3.1 Camada de Negócio, §5.1 Business Translator
 */

import type { CodeSymbol } from "../indexer/symbol.types.js";
import { buildDescribeInBusinessTermsPrompt } from "../prompts/describeInBusinessTerms.prompt.js";

export interface LlmChat {
  chat(
    messages: Array<{ role: string; content: string }>,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
}

export interface BusinessTranslator {
  /**
   * Generates a description in business terms for the given symbol and source code.
   * Uses LLM to translate technical logic (if/else, rules) into plain language.
   */
  describeInBusinessTerms(
    symbol: Pick<CodeSymbol, "name" | "kind">,
    sourceCode: string,
    existingContext?: string,
  ): Promise<string>;
}

export function createBusinessTranslator(llm: LlmChat): BusinessTranslator {
  return {
    async describeInBusinessTerms(symbol, sourceCode, existingContext) {
      const prompt = buildDescribeInBusinessTermsPrompt({
        symbolName: symbol.name,
        kind: symbol.kind,
        sourceCode,
        existingContext,
      });

      const answer =
        (await llm.chat([{ role: "user", content: prompt }], { maxTokens: 512, temperature: 0.3 })) ||
        "No business description generated.";

      return answer.trim();
    },
  };
}
