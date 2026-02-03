import Database from "better-sqlite3";
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
import type { ISymbolRepository } from "../modules/symbol/domain/repositories/ISymbolRepository.js";
import type { IRelationshipRepository } from "../modules/symbol/domain/repositories/IRelationshipRepository.js";
import type { IFileHashRepository } from "../modules/symbol/domain/repositories/IFileHashRepository.js";
import type { IFileIndexer } from "../modules/symbol/infrastructure/parsers/IFileIndexer.js";

export interface ContainerConfig {
  database: { type: "sqlite" | "memory"; path?: string };
  fileIndexer?: IFileIndexer;
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
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS symbols (id TEXT PRIMARY KEY, name TEXT, qualified_name TEXT, kind TEXT, file TEXT, start_line INTEGER, end_line INTEGER, parent TEXT, visibility TEXT, exported INTEGER, language TEXT, doc_ref TEXT, summary TEXT, doc_comment TEXT, tags TEXT, domain TEXT, bounded_context TEXT, sym_extends TEXT, sym_implements TEXT, uses_traits TEXT, sym_references TEXT, referenced_by TEXT, layer TEXT, metrics TEXT, pattern TEXT, violations TEXT, deprecated INTEGER, since TEXT, stability TEXT, generated INTEGER, source TEXT, last_modified TEXT, signature TEXT, explanation TEXT, explanation_hash TEXT);
CREATE TABLE IF NOT EXISTS relationships (source_id TEXT, target_id TEXT, type TEXT, PRIMARY KEY (source_id, target_id));
CREATE TABLE IF NOT EXISTS file_hashes (file_path TEXT PRIMARY KEY, content_hash TEXT, last_indexed_at TEXT);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
`;

export function createContainer(config: ContainerConfig): Container {
  let symbolRepo: ISymbolRepository;
  let relationshipRepo: IRelationshipRepository;
  let fileHashRepo: IFileHashRepository;

  if (config.database.type === "sqlite") {
    const db = new Database(config.database.path ?? ".docs-kit/index.db");
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

  const stubIndexer: IFileIndexer = {
    discoverFiles: async () => [],
    indexFile: async () => ({ symbols: [], relationships: [], skipped: true }),
    getSupportedExtensions: () => [".ts", ".js"],
  };

  return {
    symbolRepo,
    relationshipRepo,
    fileHashRepo,
    indexProject: new IndexProjectUseCase(
      symbolRepo,
      relationshipRepo,
      fileHashRepo,
      config.fileIndexer ?? stubIndexer,
    ),
    findSymbol: new FindSymbolUseCase(symbolRepo),
    getSymbolById: new GetSymbolByIdUseCase(symbolRepo),
    explainSymbol: new ExplainSymbolUseCase(symbolRepo, relationshipRepo),
    buildDocs: new BuildDocsUseCase(),
    buildSite: new BuildSiteUseCase(),
  };
}
