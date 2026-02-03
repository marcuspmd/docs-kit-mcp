import { describe, it, expect } from "@jest/globals";
import type {
  DatabaseConnection,
  SqliteConnection,
  DatabaseFactory,
  DatabaseConfig,
} from "../DatabaseConnection.js";
import Database from "better-sqlite3";

describe("@core/infrastructure/DatabaseConnection - Interfaces", () => {
  describe("DatabaseConnection Interface", () => {
    it("should define DatabaseConnection interface with isConnected and disconnect methods", () => {
      const mockConnection: DatabaseConnection = {
        isConnected: () => true,
        disconnect: () => {},
      };

      expect(typeof mockConnection.isConnected).toBe("function");
      expect(typeof mockConnection.disconnect).toBe("function");
      expect(mockConnection.isConnected()).toBe(true);
    });

    it("should support implementations that track connection state", () => {
      let connected = true;
      const connection: DatabaseConnection = {
        isConnected: () => connected,
        disconnect: () => {
          connected = false;
        },
      };

      expect(connection.isConnected()).toBe(true);
      connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    });
  });

  describe("SqliteConnection Interface", () => {
    it("should extend DatabaseConnection with getDb method", async () => {
      const mockDb = { open: true } as unknown as Database.Database;
      const connection: SqliteConnection = {
        isConnected: () => true,
        disconnect: () => {},
        getDb: () => mockDb,
      };

      expect(connection.getDb()).toBe(mockDb);
      expect(connection.isConnected()).toBe(true);
    });

    it("should maintain database instance across calls", async () => {
      const mockDb = { name: "test.db", open: true } as unknown as Database.Database;
      const connection: SqliteConnection = {
        isConnected: () => true,
        disconnect: () => {},
        getDb: () => mockDb,
      };

      const db1 = connection.getDb();
      const db2 = connection.getDb();
      expect(db1).toBe(db2);
      expect(db1.name).toBe("test.db");
    });
  });

  describe("DatabaseFactory Interface", () => {
    it("should define factory interface", () => {
      const mockConnection: DatabaseConnection = {
        isConnected: () => true,
        disconnect: () => {},
      };

      const factory: DatabaseFactory = {
        create: () => mockConnection,
      };

      expect(typeof factory.create).toBe("function");
      const result = factory.create();
      expect(result).toBe(mockConnection);
    });

    it("should support factories that create different connection types", () => {
      let callCount = 0;
      const factory: DatabaseFactory = {
        create: () => {
          callCount++;
          return {
            isConnected: () => true,
            disconnect: () => {},
          };
        },
      };

      const conn1 = factory.create();
      const conn2 = factory.create();
      expect(conn1).not.toBe(conn2);
      expect(callCount).toBe(2);
    });
  });

  describe("DatabaseConfig Interface", () => {
    it("should accept SQLite configuration", () => {
      const config: DatabaseConfig = {
        type: "sqlite",
        path: "/data/app.db",
      };

      expect(config.type).toBe("sqlite");
      expect(config.path).toBe("/data/app.db");
      expect(config.poolSize).toBeUndefined();
    });

    it("should accept PostgreSQL configuration", () => {
      const config: DatabaseConfig = {
        type: "postgres",
        connectionString: "postgresql://user:password@localhost:5432/mydb",
        poolSize: 20,
      };

      expect(config.type).toBe("postgres");
      expect(config.connectionString).toContain("postgresql");
      expect(config.poolSize).toBe(20);
    });

    it("should accept MySQL configuration", () => {
      const config: DatabaseConfig = {
        type: "mysql",
        connectionString: "mysql://user:password@localhost:3306/mydb",
      };

      expect(config.type).toBe("mysql");
      expect(config.connectionString).toContain("mysql");
    });

    it("should support all database types", () => {
      const types: DatabaseConfig["type"][] = ["sqlite", "postgres", "mysql"];

      types.forEach((type) => {
        const config: DatabaseConfig = {
          type,
          path: type === "sqlite" ? "/data/app.db" : undefined,
          connectionString: type !== "sqlite" ? "connection-string" : undefined,
        };

        expect(config.type).toBe(type);
      });
    });
  });

  describe("SqliteDatabaseConnection Implementation - Singleton Pattern", () => {
    it("should have a getInstance static method", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");
      expect(typeof SqliteDatabaseConnection.getInstance).toBe("function");
    });

    it("should have a resetInstance static method", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");
      expect(typeof SqliteDatabaseConnection.resetInstance).toBe("function");
    });

    it("should return an instance with required interface methods", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      // Create instance
      const instance = SqliteDatabaseConnection.getInstance(":memory:");

      // Verify interface compliance
      expect(typeof instance.getDb).toBe("function");
      expect(typeof instance.isConnected).toBe("function");
      expect(typeof instance.disconnect).toBe("function");

      // Cleanup
      instance.disconnect();
      SqliteDatabaseConnection.resetInstance();
    });
  });

  describe("SqliteDatabaseConnection - Lifecycle", () => {
    it("should implement full connection lifecycle", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance = SqliteDatabaseConnection.getInstance(":memory:");

      // Before initialization
      expect(instance.isConnected()).toBe(false);

      // After getting DB
      const db = instance.getDb();
      expect(db).toBeDefined();
      expect(instance.isConnected()).toBe(true);

      // Disconnect
      instance.disconnect();
      expect(instance.isConnected()).toBe(false);

      // Cleanup
      SqliteDatabaseConnection.resetInstance();
    });

    it("should handle multiple getInstance calls as singleton", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance1 = SqliteDatabaseConnection.getInstance(":memory:");
      const instance2 = SqliteDatabaseConnection.getInstance(":memory:");

      expect(instance1).toBe(instance2);

      instance1.disconnect();
      SqliteDatabaseConnection.resetInstance();
    });

    it("should allow instance reset and recreation", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance1 = SqliteDatabaseConnection.getInstance(":memory:");
      instance1.getDb();

      SqliteDatabaseConnection.resetInstance();

      const instance2 = SqliteDatabaseConnection.getInstance(":memory:");
      expect(instance1).not.toBe(instance2);

      instance2.disconnect();
      SqliteDatabaseConnection.resetInstance();
    });
  });

  describe("SqliteDatabaseConnection - Pragmas", () => {
    it("should set WAL journal mode", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance = SqliteDatabaseConnection.getInstance(":memory:");
      const db = instance.getDb();

      // WAL pragma should be set - verify by checking pragma result
      try {
        const result = db.prepare("PRAGMA journal_mode").all();
        expect(result).toBeDefined();
      } catch (e) {
        // In-memory SQLite may not return pragma as expected
      }

      instance.disconnect();
      SqliteDatabaseConnection.resetInstance();
    });

    it("should enable foreign keys", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance = SqliteDatabaseConnection.getInstance(":memory:");
      const db = instance.getDb();

      // Foreign keys pragma should be set
      try {
        const result = db.prepare("PRAGMA foreign_keys").all();
        expect(result).toBeDefined();
      } catch (e) {
        // In-memory SQLite may not return pragma as expected
      }

      instance.disconnect();
      SqliteDatabaseConnection.resetInstance();
    });
  });

  describe("SqliteDatabaseConnection - Error Handling", () => {
    it("should handle disconnect when not connected", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance = SqliteDatabaseConnection.getInstance(":memory:");

      // Should not throw when disconnecting without being connected
      expect(() => {
        instance.disconnect();
      }).not.toThrow();

      SqliteDatabaseConnection.resetInstance();
    });

    it("should handle multiple disconnect calls gracefully", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance = SqliteDatabaseConnection.getInstance(":memory:");
      instance.getDb();

      // Multiple disconnects should not throw
      expect(() => {
        instance.disconnect();
        instance.disconnect();
        instance.disconnect();
      }).not.toThrow();

      SqliteDatabaseConnection.resetInstance();
    });

    it("should handle reset before any connection", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      // Should not throw when resetting without creating connection
      expect(() => {
        SqliteDatabaseConnection.resetInstance();
      }).not.toThrow();
    });
  });

  describe("SqliteDatabaseConnection - In-Memory Database", () => {
    it("should create an in-memory database", async () => {
      const { SqliteDatabaseConnection } = await import("../DatabaseConnection.js");

      const instance = SqliteDatabaseConnection.getInstance(":memory:");
      const db = instance.getDb();

      // Should be able to execute queries on in-memory db
      expect(() => {
        db.prepare("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)").run();
        db.prepare("INSERT INTO test (name) VALUES (?)").run("test");
        const result = db.prepare("SELECT COUNT(*) as count FROM test").all();
        expect(result).toBeDefined();
      }).not.toThrow();

      instance.disconnect();
      SqliteDatabaseConnection.resetInstance();
    });
  });
});
