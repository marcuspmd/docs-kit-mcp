/**
 * Base Repository Interface
 *
 * Repositories mediate between the domain and data mapping layers.
 * They provide a collection-like interface for accessing domain objects.
 */
export interface Repository<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  save(entity: TEntity): Promise<void>;
  saveMany(entities: TEntity[]): Promise<void>;
  delete(id: TId): Promise<void>;
  exists(id: TId): Promise<boolean>;
}

/**
 * Synchronous Repository variant for SQLite
 */
export interface SyncRepository<TEntity, TId = string> {
  findById(id: TId): TEntity | null;
  findAll(): TEntity[];
  save(entity: TEntity): void;
  saveMany(entities: TEntity[]): void;
  delete(id: TId): void;
  exists(id: TId): boolean;
}

/**
 * Query Repository for read-only operations with filtering
 */
export interface QueryRepository<TEntity, TFilter = object> {
  find(filter: TFilter): Promise<TEntity[]>;
  findOne(filter: TFilter): Promise<TEntity | null>;
  count(filter?: TFilter): Promise<number>;
}
