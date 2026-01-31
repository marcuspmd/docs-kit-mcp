import OpenAI from "openai";
import { Config } from "../config.js";

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
): Promise<string> {
  if (!config.llm.apiKey) {
    throw new Error("LLM API key not configured. Set OPENAI_API_KEY environment variable.");
  }

  const openai = new OpenAI({
    apiKey: config.llm.apiKey,
  });

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
    const response = await openai.chat.completions.create({
      model: config.llm.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });

    return response.choices[0]?.message?.content?.trim() || input.currentSection;
  } catch (error) {
    console.warn("LLM call failed, falling back to current section:", error);
    return input.currentSection; // Fallback
  }
}
