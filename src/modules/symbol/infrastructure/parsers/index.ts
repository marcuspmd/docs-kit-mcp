export { ParserRegistry } from "./ParserRegistry.js";
export { FileIndexer } from "./FileIndexer.js";
export type { IFileIndexer, FileIndexResult } from "./IFileIndexer.js";

// Strategies
export { TypeScriptParser } from "./strategies/TypeScriptParser.js";
export type { ILanguageParser, ParseResult } from "./strategies/ILanguageParser.js";
