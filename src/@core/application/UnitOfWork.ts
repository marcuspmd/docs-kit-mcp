/**
 * Unit of Work Pattern
 *
 * Maintains a list of objects affected by a business transaction
 * and coordinates the writing out of changes.
 */
export interface UnitOfWork {
  /**
   * Start a new transaction
   */
  begin(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Simple implementation for synchronous SQLite transactions
 */
export interface SyncUnitOfWork {
  transaction<T>(fn: () => T): T;
}
