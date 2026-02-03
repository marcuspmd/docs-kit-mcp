/**
 * Shared Language Constants
 * Single source of truth for supported languages across the codebase.
 */

import { z } from "zod";

/**
 * Supported programming languages in the docs-kit system.
 * This is the canonical list used across indexer, guards, and documentation.
 */
export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "php",
  "python",
  "go",
  "java",
  "rust",
] as const;

/**
 * Language type derived from the canonical list.
 */
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Zod schema for language validation.
 */
export const LanguageSchema = z.enum(SUPPORTED_LANGUAGES);

/**
 * File extension to language mapping.
 * Used by indexer and guards to detect language from file path.
 */
export const FILE_EXTENSION_TO_LANGUAGE: Record<string, Language> = {
  // TypeScript
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",

  // JavaScript
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",

  // PHP
  php: "php",

  // Python
  py: "python",
  pyw: "python",

  // Go
  go: "go",

  // Java
  java: "java",

  // Rust
  rs: "rust",
} as const;

/**
 * Language to file extensions mapping (inverse of FILE_EXTENSION_TO_LANGUAGE).
 * Used for glob patterns and file discovery.
 */
export const LANGUAGE_TO_EXTENSIONS: Record<Language, readonly string[]> = {
  typescript: ["ts", "tsx", "mts", "cts"],
  javascript: ["js", "jsx", "mjs", "cjs"],
  php: ["php"],
  python: ["py", "pyw"],
  go: ["go"],
  java: ["java"],
  rust: ["rs"],
} as const;

/**
 * Detect language from file path based on extension.
 * Returns null if extension is not recognized.
 *
 * @param filePath - Path to the file
 * @returns Language or null
 */
export function detectLanguageFromPath(filePath: string): Language | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  return FILE_EXTENSION_TO_LANGUAGE[ext] ?? null;
}

/**
 * Check if a language is supported.
 *
 * @param language - Language to check
 * @returns True if supported
 */
export function isSupportedLanguage(language: string): language is Language {
  return SUPPORTED_LANGUAGES.includes(language as Language);
}

/**
 * Get all file extensions for a language.
 *
 * @param language - Language to get extensions for
 * @returns Array of file extensions
 */
export function getExtensionsForLanguage(language: Language): readonly string[] {
  return LANGUAGE_TO_EXTENSIONS[language];
}

/**
 * Legacy aliases for backward compatibility.
 * Maps old indexer language codes to canonical names.
 */
export const LEGACY_LANGUAGE_ALIASES: Record<string, Language> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
} as const;

/**
 * Normalize language code (handles legacy aliases).
 *
 * @param languageCode - Language code (can be legacy or canonical)
 * @returns Canonical language name or null
 */
export function normalizeLanguage(languageCode: string): Language | null {
  // Check if it's already canonical
  if (isSupportedLanguage(languageCode)) {
    return languageCode;
  }

  // Check legacy aliases
  const canonical = LEGACY_LANGUAGE_ALIASES[languageCode.toLowerCase()];
  return canonical ?? null;
}
