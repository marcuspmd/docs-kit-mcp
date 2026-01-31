import type { Config } from "../config.js";
import type { LlmProvider } from "../llm/provider.js";

/**
 * Generate updated documentation section using LLM
 */

export interface UpdateSectionPromptInput {
  symbolName: string;
  changeType: string;
  diff: string;
  currentSection: string;
}

export async function buildUpdateSectionPrompt(
  input: UpdateSectionPromptInput,
  config: Config,
  llm?: LlmProvider,
): Promise<string> {
  if (!llm) {
    const { createLlmProvider } = await import("../llm/provider.js");
    llm = createLlmProvider(config);
  }

  const prompt = `You are an expert technical writer updating documentation for a software project.

Given the following information about a code change:

Symbol: ${input.symbolName}
Change Type: ${input.changeType}
Code Diff:
${input.diff}

Current Documentation Section:
${input.currentSection}

Please update the documentation section to accurately reflect the code changes. Preserve the existing structure and formatting. Focus on semantic changes, not just line-by-line diffs. Be concise but comprehensive.

Updated section:`;

  try {
    return await llm.chat([{ role: "user", content: prompt }], {
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });
  } catch (error) {
    console.warn("LLM call failed, falling back to current section:", error);
    return input.currentSection;
  }
}
