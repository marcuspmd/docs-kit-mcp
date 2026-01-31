/**
 * Stub for MVP — will be replaced with LLM-based section generation post-MVP.
 * See start.md §3.2.1 step 3.
 */

export interface UpdateSectionPromptInput {
  symbolName: string;
  changeType: string;
  diff: string;
  currentSection: string;
}

export function buildUpdateSectionPrompt(_input: UpdateSectionPromptInput): string {
  return ""; // MVP: template-based updates handled directly in docUpdater
}
