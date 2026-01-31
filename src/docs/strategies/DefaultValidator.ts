export interface ValidatorStrategy {
  canValidate(language: string): boolean;
  validate(code: string): Promise<{ valid: boolean; error?: string }>;
}

export class DefaultValidator implements ValidatorStrategy {
  canValidate(_language: string): boolean {
    return true; // Fallback for any language
  }

  async validate(code: string): Promise<{ valid: boolean; error?: string }> {
    if (!code.trim()) {
      return { valid: false, error: "Empty code block" };
    }
    return { valid: true }; // Accept unknown languages if not empty
  }
}
