export { createDatabase, configureDatabase, type DbOptions } from "./connection.js";
export { CURRENT_SCHEMA_VERSION, SCHEMA_SQL, initializeSchema } from "./schema.js";
export {
  createSymbolRepository,
  rowToSymbol,
  type SymbolRepository,
  type SymbolRow,
} from "./symbolRepository.js";
export { createFileHashRepository, type FileHashRepository } from "./fileHashRepository.js";
export { createPrReviewRepository, type PrReviewRepository } from "./prReviewRepository.js";
export {
  createRelationshipRepository,
  relationshipRowsToSymbolRelationships,
  type RelationshipRepository,
  type RelationshipRow,
} from "./relationshipRepository.js";
export {
  replaceAllArchViolations,
  replaceAllPatterns,
  upsertReaperFindings,
  getAllFindings,
  updateFindingStatus,
  getFindingHistory,
  type ArchViolationRow,
  type PatternRowForInsert,
  type ReaperFindingInput,
  type ReaperFindingRow,
  type ReaperHistoryRow,
  type FindingStatus,
} from "./reportRepositories.js";
