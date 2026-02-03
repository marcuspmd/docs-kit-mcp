import { describe, expect, it } from "@jest/globals";
import {
  SUPPORTED_LANGUAGES,
  LanguageSchema,
  FILE_EXTENSION_TO_LANGUAGE,
  LANGUAGE_TO_EXTENSIONS,
  LEGACY_LANGUAGE_ALIASES,
  detectLanguageFromPath,
  isSupportedLanguage,
  getExtensionsForLanguage,
  normalizeLanguage,
  type Language,
} from "../languages.js";

describe("languages constants", () => {
  describe("SUPPORTED_LANGUAGES", () => {
    it("should contain all supported languages", () => {
      expect(SUPPORTED_LANGUAGES).toEqual([
        "typescript",
        "javascript",
        "php",
        "python",
        "go",
        "java",
        "rust",
      ]);
    });
  });

  describe("LanguageSchema", () => {
    it("should validate supported languages", () => {
      expect(LanguageSchema.parse("typescript")).toBe("typescript");
      expect(LanguageSchema.parse("javascript")).toBe("javascript");
      expect(LanguageSchema.parse("php")).toBe("php");
      expect(LanguageSchema.parse("python")).toBe("python");
      expect(LanguageSchema.parse("go")).toBe("go");
      expect(LanguageSchema.parse("java")).toBe("java");
      expect(LanguageSchema.parse("rust")).toBe("rust");
    });

    it("should reject unsupported languages", () => {
      expect(() => LanguageSchema.parse("c++")).toThrow();
      expect(() => LanguageSchema.parse("ruby")).toThrow();
    });
  });

  describe("FILE_EXTENSION_TO_LANGUAGE", () => {
    it("should map TypeScript extensions", () => {
      expect(FILE_EXTENSION_TO_LANGUAGE.ts).toBe("typescript");
      expect(FILE_EXTENSION_TO_LANGUAGE.tsx).toBe("typescript");
      expect(FILE_EXTENSION_TO_LANGUAGE.mts).toBe("typescript");
      expect(FILE_EXTENSION_TO_LANGUAGE.cts).toBe("typescript");
    });

    it("should map JavaScript extensions", () => {
      expect(FILE_EXTENSION_TO_LANGUAGE.js).toBe("javascript");
      expect(FILE_EXTENSION_TO_LANGUAGE.jsx).toBe("javascript");
      expect(FILE_EXTENSION_TO_LANGUAGE.mjs).toBe("javascript");
      expect(FILE_EXTENSION_TO_LANGUAGE.cjs).toBe("javascript");
    });

    it("should map other language extensions", () => {
      expect(FILE_EXTENSION_TO_LANGUAGE.php).toBe("php");
      expect(FILE_EXTENSION_TO_LANGUAGE.py).toBe("python");
      expect(FILE_EXTENSION_TO_LANGUAGE.pyw).toBe("python");
      expect(FILE_EXTENSION_TO_LANGUAGE.go).toBe("go");
      expect(FILE_EXTENSION_TO_LANGUAGE.java).toBe("java");
      expect(FILE_EXTENSION_TO_LANGUAGE.rs).toBe("rust");
    });
  });

  describe("LANGUAGE_TO_EXTENSIONS", () => {
    it("should map languages to their extensions", () => {
      expect(LANGUAGE_TO_EXTENSIONS.typescript).toEqual(["ts", "tsx", "mts", "cts"]);
      expect(LANGUAGE_TO_EXTENSIONS.javascript).toEqual(["js", "jsx", "mjs", "cjs"]);
      expect(LANGUAGE_TO_EXTENSIONS.php).toEqual(["php"]);
      expect(LANGUAGE_TO_EXTENSIONS.python).toEqual(["py", "pyw"]);
      expect(LANGUAGE_TO_EXTENSIONS.go).toEqual(["go"]);
      expect(LANGUAGE_TO_EXTENSIONS.java).toEqual(["java"]);
      expect(LANGUAGE_TO_EXTENSIONS.rust).toEqual(["rs"]);
    });
  });

  describe("detectLanguageFromPath", () => {
    it("should detect TypeScript files", () => {
      expect(detectLanguageFromPath("src/file.ts")).toBe("typescript");
      expect(detectLanguageFromPath("src/component.tsx")).toBe("typescript");
      expect(detectLanguageFromPath("src/module.mts")).toBe("typescript");
      expect(detectLanguageFromPath("src/config.cts")).toBe("typescript");
    });

    it("should detect JavaScript files", () => {
      expect(detectLanguageFromPath("src/file.js")).toBe("javascript");
      expect(detectLanguageFromPath("src/component.jsx")).toBe("javascript");
      expect(detectLanguageFromPath("src/module.mjs")).toBe("javascript");
      expect(detectLanguageFromPath("src/config.cjs")).toBe("javascript");
    });

    it("should detect other language files", () => {
      expect(detectLanguageFromPath("src/service.php")).toBe("php");
      expect(detectLanguageFromPath("src/script.py")).toBe("python");
      expect(detectLanguageFromPath("src/app.pyw")).toBe("python");
      expect(detectLanguageFromPath("src/main.go")).toBe("go");
      expect(detectLanguageFromPath("src/Main.java")).toBe("java");
      expect(detectLanguageFromPath("src/main.rs")).toBe("rust");
    });

    it("should handle case insensitive extensions", () => {
      expect(detectLanguageFromPath("src/file.TS")).toBe("typescript");
      expect(detectLanguageFromPath("src/file.JS")).toBe("javascript");
      expect(detectLanguageFromPath("src/file.PY")).toBe("python");
    });

    it("should return null for files without extension", () => {
      expect(detectLanguageFromPath("Makefile")).toBeNull();
      expect(detectLanguageFromPath("README")).toBeNull();
      expect(detectLanguageFromPath("README.")).toBeNull();
      expect(detectLanguageFromPath("src/file")).toBeNull();
    });

    it("should return null for unknown extensions", () => {
      expect(detectLanguageFromPath("file.txt")).toBeNull();
      expect(detectLanguageFromPath("file.cpp")).toBeNull();
      expect(detectLanguageFromPath("file.rb")).toBeNull();
    });
  });

  describe("isSupportedLanguage", () => {
    it("should return true for supported languages", () => {
      expect(isSupportedLanguage("typescript")).toBe(true);
      expect(isSupportedLanguage("javascript")).toBe(true);
      expect(isSupportedLanguage("php")).toBe(true);
      expect(isSupportedLanguage("python")).toBe(true);
      expect(isSupportedLanguage("go")).toBe(true);
      expect(isSupportedLanguage("java")).toBe(true);
      expect(isSupportedLanguage("rust")).toBe(true);
    });

    it("should return false for unsupported languages", () => {
      expect(isSupportedLanguage("c++")).toBe(false);
      expect(isSupportedLanguage("ruby")).toBe(false);
      expect(isSupportedLanguage("swift")).toBe(false);
      expect(isSupportedLanguage("kotlin")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isSupportedLanguage("")).toBe(false);
    });
  });

  describe("getExtensionsForLanguage", () => {
    it("should return extensions for TypeScript", () => {
      const extensions = getExtensionsForLanguage("typescript");
      expect(extensions).toEqual(["ts", "tsx", "mts", "cts"]);
    });

    it("should return extensions for JavaScript", () => {
      const extensions = getExtensionsForLanguage("javascript");
      expect(extensions).toEqual(["js", "jsx", "mjs", "cjs"]);
    });

    it("should return extensions for PHP", () => {
      const extensions = getExtensionsForLanguage("php");
      expect(extensions).toEqual(["php"]);
    });

    it("should return extensions for Python", () => {
      const extensions = getExtensionsForLanguage("python");
      expect(extensions).toEqual(["py", "pyw"]);
    });

    it("should return extensions for Go", () => {
      const extensions = getExtensionsForLanguage("go");
      expect(extensions).toEqual(["go"]);
    });

    it("should return extensions for Java", () => {
      const extensions = getExtensionsForLanguage("java");
      expect(extensions).toEqual(["java"]);
    });

    it("should return extensions for Rust", () => {
      const extensions = getExtensionsForLanguage("rust");
      expect(extensions).toEqual(["rs"]);
    });
  });

  describe("LEGACY_LANGUAGE_ALIASES", () => {
    it("should contain legacy aliases", () => {
      expect(LEGACY_LANGUAGE_ALIASES).toEqual({
        ts: "typescript",
        js: "javascript",
        py: "python",
      });
    });
  });

  describe("normalizeLanguage", () => {
    it("should return canonical language for already canonical input", () => {
      expect(normalizeLanguage("typescript")).toBe("typescript");
      expect(normalizeLanguage("javascript")).toBe("javascript");
      expect(normalizeLanguage("php")).toBe("php");
      expect(normalizeLanguage("python")).toBe("python");
      expect(normalizeLanguage("go")).toBe("go");
      expect(normalizeLanguage("java")).toBe("java");
      expect(normalizeLanguage("rust")).toBe("rust");
    });

    it("should normalize legacy aliases", () => {
      expect(normalizeLanguage("ts")).toBe("typescript");
      expect(normalizeLanguage("js")).toBe("javascript");
      expect(normalizeLanguage("py")).toBe("python");
    });

    it("should handle case insensitive legacy aliases", () => {
      expect(normalizeLanguage("TS")).toBe("typescript");
      expect(normalizeLanguage("JS")).toBe("javascript");
      expect(normalizeLanguage("PY")).toBe("python");
    });

    it("should return null for unsupported languages", () => {
      expect(normalizeLanguage("cpp")).toBeNull();
      expect(normalizeLanguage("ruby")).toBeNull();
      expect(normalizeLanguage("swift")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(normalizeLanguage("")).toBeNull();
    });
  });
});
