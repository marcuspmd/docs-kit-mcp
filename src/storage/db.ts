export { createDatabase, configureDatabase, type DbOptions } from "./connection.js";
export { CURRENT_SCHEMA_VERSION, SCHEMA_SQL, initializeSchema } from "./schema.js";
export {
  createSymbolRepository,
  rowToSymbol,
  type SymbolRepository,
  type SymbolRow,
} from "./symbolRepository.js";
export { createFileHashRepository, type FileHashRepository } from "./fileHashRepository.js";
export {
  createRelationshipRepository,
  relationshipRowsToSymbolRelationships,
  type RelationshipRepository,
  type RelationshipRow,
} from "./relationshipRepository.js";
export {
  replaceAllArchViolations,
  replaceAllPatterns,
  replaceAllReaperFindings,
  type ArchViolationRow,
  type PatternRowForInsert,
  type ReaperFindingRow,
} from "./reportRepositories.js";
