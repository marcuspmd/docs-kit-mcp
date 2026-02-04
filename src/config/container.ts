import Database from "better-sqlite3";
import Parser from "tree-sitter";
import TypeScriptLanguage from "tree-sitter-typescript";
import PhpLanguage from "tree-sitter-php";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  SqliteSymbolRepository,
  SqliteRelationshipRepository,
  SqliteFileHashRepository,
} from "../modules/symbol/infrastructure/persistence/sqlite/index.js";
import {
  InMemorySymbolRepository,
  InMemoryRelationshipRepository,
  InMemoryFileHashRepository,
} from "../modules/symbol/infrastructure/persistence/memory/index.js";
import { IndexProjectUseCase } from "../modules/symbol/application/use-cases/IndexProject.usecase.js";
import {
  FindSymbolUseCase,
  GetSymbolByIdUseCase,
} from "../modules/symbol/application/use-cases/FindSymbol.usecase.js";
import { ExplainSymbolUseCase } from "../modules/symbol/application/use-cases/ExplainSymbol.usecase.js";
import { BuildDocsUseCase } from "../modules/documentation/application/use-cases/BuildDocs.usecase.js";
import { BuildSiteUseCase } from "../modules/documentation/application/use-cases/BuildSite.usecase.js";
import { AnalyzeImpactUseCase } from "../modules/analysis/application/use-cases/AnalyzeImpact.usecase.js";
import { GitDiffParser } from "../modules/analysis/infrastructure/GitDiffParser.js";
import { AstDiffAnalyzer } from "../modules/analysis/infrastructure/AstDiffAnalyzer.js";
import {
  FileIndexer,
  ParserRegistry,
  TypeScriptParser,
  PhpParser,
} from "../modules/symbol/infrastructure/parsers/index.js";
import { createLlmProvider, type ILlmProvider } from "../modules/llm/index.js";
import type { ISymbolRepository } from "../modules/symbol/domain/repositories/ISymbolRepository.js";
import type { IRelationshipRepository } from "../modules/symbol/domain/repositories/IRelationshipRepository.js";
import type { IFileHashRepository } from "../modules/symbol/domain/repositories/IFileHashRepository.js";
import type { IFileIndexer } from "../modules/symbol/infrastructure/parsers/IFileIndexer.js";

export interface ContainerConfig {
  database: { type: "sqlite" | "memory"; path?: string };
  fileIndexer?: IFileIndexer;
  llm?: {
    provider: "openai" | "claude" | "gemini" | "ollama";
    model: string;
    apiKey?: string;
  };
}

export interface Container {
  symbolRepo: ISymbolRepository;
  relationshipRepo: IRelationshipRepository;
  fileHashRepo: IFileHashRepository;
  indexProject: IndexProjectUseCase;
  findSymbol: FindSymbolUseCase;
  getSymbolById: GetSymbolByIdUseCase;
  explainSymbol: ExplainSymbolUseCase;
  buildDocs: BuildDocsUseCase;
  buildSite: BuildSiteUseCase;
  analyzeImpact: AnalyzeImpactUseCase;
  llmProvider?: ILlmProvider;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS symbols (id TEXT PRIMARY KEY, name TEXT, qualified_name TEXT, kind TEXT, file TEXT, start_line INTEGER, end_line INTEGER, parent TEXT, visibility TEXT, exported INTEGER, language TEXT, doc_ref TEXT, summary TEXT, doc_comment TEXT, tags TEXT, domain TEXT, bounded_context TEXT, sym_extends TEXT, sym_implements TEXT, uses_traits TEXT, sym_references TEXT, referenced_by TEXT, layer TEXT, metrics TEXT, pattern TEXT, violations TEXT, deprecated INTEGER, since TEXT, stability TEXT, generated INTEGER, source TEXT, last_modified TEXT, signature TEXT, explanation TEXT, explanation_hash TEXT);
CREATE TABLE IF NOT EXISTS relationships (source_id TEXT, target_id TEXT, type TEXT, PRIMARY KEY (source_id, target_id));
CREATE TABLE IF NOT EXISTS file_hashes (file_path TEXT PRIMARY KEY, content_hash TEXT, last_indexed_at TEXT);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
`;

/**
 * Setup Parser Registry with all supported parsers
 */
function setupParserRegistry(): ParserRegistry {
  const registry = new ParserRegistry();

  // Create and configure TypeScript parser
  const tsParser = new Parser();
  tsParser.setLanguage(TypeScriptLanguage.typescript as unknown as Parser.Language);
  registry.register("typescript", new TypeScriptParser(tsParser));

  // Create and configure PHP parser
  const phpParser = new Parser();
  phpParser.setLanguage(PhpLanguage.php as unknown as Parser.Language);
  registry.register("php", new PhpParser(phpParser));

  return registry;
}

export function createContainer(config: ContainerConfig): Container {
  let symbolRepo: ISymbolRepository;
  let relationshipRepo: IRelationshipRepository;
  let fileHashRepo: IFileHashRepository;

  if (config.database.type === "sqlite") {
    const dbPath = config.database.path ?? ".docs-kit/index.db";
    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA);
    symbolRepo = new SqliteSymbolRepository(db);
    relationshipRepo = new SqliteRelationshipRepository(db);
    fileHashRepo = new SqliteFileHashRepository(db);
  } else {
    symbolRepo = new InMemorySymbolRepository();
    relationshipRepo = new InMemoryRelationshipRepository();
    fileHashRepo = new InMemoryFileHashRepository();
  }

  // Setup parser registry and file indexer
  const parserRegistry = setupParserRegistry();
  const fileIndexer = config.fileIndexer ?? new FileIndexer(parserRegistry, fileHashRepo);

  // Setup LLM provider if configured
  let llmProvider: ILlmProvider | undefined;
  if (config.llm) {
    try {
      llmProvider = createLlmProvider(config.llm);
    } catch (error) {
      console.warn("Failed to create LLM provider:", error);
    }
  }

  // Setup analysis infrastructure
  const gitDiffParser = new GitDiffParser();
  const astDiffAnalyzer = new AstDiffAnalyzer(fileIndexer);

  return {
    symbolRepo,
    relationshipRepo,
    fileHashRepo,
    llmProvider,
    indexProject: new IndexProjectUseCase(symbolRepo, relationshipRepo, fileHashRepo, fileIndexer),
    findSymbol: new FindSymbolUseCase(symbolRepo),
    getSymbolById: new GetSymbolByIdUseCase(symbolRepo),
    explainSymbol: new ExplainSymbolUseCase(symbolRepo, relationshipRepo, llmProvider),
    buildDocs: new BuildDocsUseCase(symbolRepo, llmProvider),
    buildSite: new BuildSiteUseCase(),
    analyzeImpact: new AnalyzeImpactUseCase(
      symbolRepo,
      relationshipRepo,
      gitDiffParser,
      astDiffAnalyzer,
    ),
  };
}
