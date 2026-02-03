/**
 * Symbol kind enumeration
 */
export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "interface"
  | "type"
  | "variable"
  | "constant"
  | "enum"
  | "property"
  | "namespace"
  | "module"
  | "decorator"
  | "event"
  | "service"
  | "controller"
  | "repository"
  | "entity"
  | "dto"
  | "usecase"
  | "listener"
  | "unknown";

/**
 * Language types supported
 */
export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "csharp"
  | "rust"
  | "unknown";

/**
 * Architecture layer types
 */
export type ArchitectureLayer =
  | "presentation"
  | "application"
  | "domain"
  | "infrastructure"
  | "unknown";

/**
 * Relationship type between symbols
 */
export type RelationshipType =
  | "imports"
  | "exports"
  | "extends"
  | "implements"
  | "uses"
  | "calls"
  | "instantiates"
  | "decorates"
  | "injects"
  | "emits"
  | "listens";

/**
 * File location information
 */
export interface FileLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

/**
 * Symbol signature information
 */
export interface SymbolSignature {
  parameters?: string[];
  returnType?: string;
  typeParameters?: string[];
  modifiers?: string[];
}

/**
 * Documentation mapping info
 */
export interface DocMappingInfo {
  symbolId: string;
  docPath: string;
  section?: string;
}

/**
 * Configuration schema type
 */
export interface DocsKitConfig {
  rootPath: string;
  outputDir: string;
  include: string[];
  exclude: string[];
  database: {
    type: "sqlite" | "postgres";
    path?: string;
    connectionString?: string;
  };
  llm?: {
    provider: "openai" | "claude" | "ollama" | "gemini";
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
}
