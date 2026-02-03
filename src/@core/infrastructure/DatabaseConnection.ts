import Database from "better-sqlite3";

/**
 * Database Connection Interface
 *
 * Abstracts database connections to allow different implementations
 * (SQLite, PostgreSQL, MySQL, etc.)
 */
export interface DatabaseConnection {
  isConnected(): boolean;
  disconnect(): void;
}

/**
 * SQLite-specific connection interface
 */
export interface SqliteConnection extends DatabaseConnection {
  getDb(): Database.Database;
}

/**
 * Database Factory for creating connections
 */
export interface DatabaseFactory {
  create(): DatabaseConnection;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  type: "sqlite" | "postgres" | "mysql";
  path?: string; // For SQLite
  connectionString?: string; // For PostgreSQL/MySQL
  poolSize?: number;
}

/**
 * SQLite Database Connection Implementation (Singleton)
 */
export class SqliteDatabaseConnection implements SqliteConnection {
  private static instance: SqliteDatabaseConnection | null = null;
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  public static getInstance(dbPath: string): SqliteDatabaseConnection {
    if (!SqliteDatabaseConnection.instance) {
      SqliteDatabaseConnection.instance = new SqliteDatabaseConnection(dbPath);
    }
    return SqliteDatabaseConnection.instance;
  }

  public static resetInstance(): void {
    if (SqliteDatabaseConnection.instance?.db) {
      SqliteDatabaseConnection.instance.db.close();
    }
    SqliteDatabaseConnection.instance = null;
  }

  public getDb(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
    }
    return this.db;
  }

  public isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  public disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
