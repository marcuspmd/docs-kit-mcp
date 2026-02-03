import { describe, it, expect } from "@jest/globals";
import {
  DomainError,
  EntityNotFoundError,
  InvalidArgumentError,
  ValidationError,
  FileSystemError,
  ParserError,
  RepositoryError,
  ConfigurationError,
} from "../DomainErrors.js";

describe("DomainError Classes", () => {
  describe("DomainError base class", () => {
    class TestError extends DomainError {
      constructor(message: string) {
        super(message, "TEST_ERROR");
      }
    }

    it("should create domain error with message and code", () => {
      const error = new TestError("Test error message");

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("TEST_ERROR");
    });

    it("should set error name to class name", () => {
      const error = new TestError("Test");

      expect(error.name).toBe("TestError");
    });

    it("should have timestamp", () => {
      const beforeCreation = new Date();
      const error = new TestError("Test");
      const afterCreation = new Date();

      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it("should capture stack trace", () => {
      const error = new TestError("Test");

      expect(error.stack).toBeDefined();
    });

    it("should extend Error", () => {
      const error = new TestError("Test");

      expect(error instanceof Error).toBe(true);
    });
  });

  describe("EntityNotFoundError", () => {
    it("should create with entity name and id", () => {
      const error = new EntityNotFoundError("User", "123");

      expect(error.message).toBe("User with id '123' not found");
      expect(error.code).toBe("ENTITY_NOT_FOUND");
      expect(error.name).toBe("EntityNotFoundError");
    });

    it("should work with different entity types", () => {
      const userError = new EntityNotFoundError("User", "user-123");
      const productError = new EntityNotFoundError("Product", "prod-456");

      expect(userError.message).toContain("User");
      expect(productError.message).toContain("Product");
    });

    it("should handle special characters in id", () => {
      const error = new EntityNotFoundError("Document", "doc-2024-01-15");

      expect(error.message).toContain("doc-2024-01-15");
    });
  });

  describe("InvalidArgumentError", () => {
    it("should create with message", () => {
      const error = new InvalidArgumentError("Email must be valid");

      expect(error.message).toBe("Email must be valid");
      expect(error.code).toBe("INVALID_ARGUMENT");
      expect(error.name).toBe("InvalidArgumentError");
    });

    it("should work with descriptive messages", () => {
      const error = new InvalidArgumentError("Age must be between 18 and 120");

      expect(error.message).toContain("Age");
      expect(error.message).toContain("18");
      expect(error.message).toContain("120");
    });
  });

  describe("ValidationError", () => {
    it("should create with message and empty issues", () => {
      const error = new ValidationError("Validation failed");

      expect(error.message).toBe("Validation failed");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.issues).toEqual([]);
    });

    it("should create with message and issues", () => {
      const issues = ["Field 'name' is required", "Field 'email' is invalid"];
      const error = new ValidationError("Multiple validation errors", issues);

      expect(error.message).toBe("Multiple validation errors");
      expect(error.issues).toEqual(issues);
      expect(error.issues.length).toBe(2);
    });

    it("should preserve all issues", () => {
      const issues = ["Name too short", "Email already exists", "Age must be positive"];
      const error = new ValidationError("Form validation failed", issues);

      expect(error.issues).toContain("Name too short");
      expect(error.issues).toContain("Email already exists");
      expect(error.issues).toContain("Age must be positive");
    });

    it("should handle single issue", () => {
      const error = new ValidationError("Validation failed", ["Only one issue"]);

      expect(error.issues.length).toBe(1);
      expect(error.issues[0]).toBe("Only one issue");
    });
  });

  describe("FileSystemError", () => {
    it("should create with message and path", () => {
      const error = new FileSystemError("File not found", "/path/to/file.txt");

      expect(error.message).toBe("File not found");
      expect(error.path).toBe("/path/to/file.txt");
      expect(error.code).toBe("FILE_SYSTEM_ERROR");
    });

    it("should work with different file paths", () => {
      const fileError = new FileSystemError("Permission denied", "/home/user/config.json");
      const dirError = new FileSystemError("Directory not found", "/data/backup");

      expect(fileError.path).toBe("/home/user/config.json");
      expect(dirError.path).toBe("/data/backup");
    });

    it("should handle relative paths", () => {
      const error = new FileSystemError("Not a directory", "./src/index.ts");

      expect(error.path).toBe("./src/index.ts");
    });
  });

  describe("ParserError", () => {
    it("should create with message and file path", () => {
      const error = new ParserError("Syntax error on line 42", "src/main.ts");

      expect(error.message).toBe("Syntax error on line 42");
      expect(error.filePath).toBe("src/main.ts");
      expect(error.code).toBe("PARSER_ERROR");
      expect(error.language).toBeUndefined();
    });

    it("should create with message, file path and language", () => {
      const error = new ParserError("Expected semicolon", "app.ts", "typescript");

      expect(error.message).toBe("Expected semicolon");
      expect(error.filePath).toBe("app.ts");
      expect(error.language).toBe("typescript");
    });

    it("should support different languages", () => {
      const tsError = new ParserError("Type error", "main.ts", "typescript");
      const jsError = new ParserError("Reference error", "main.js", "javascript");
      const pyError = new ParserError("Indent error", "main.py", "python");

      expect(tsError.language).toBe("typescript");
      expect(jsError.language).toBe("javascript");
      expect(pyError.language).toBe("python");
    });

    it("should handle file paths with line/column info in message", () => {
      const error = new ParserError("Error at line 10, column 5", "src/utils/parse.ts");

      expect(error.message).toContain("line 10");
      expect(error.filePath).toBe("src/utils/parse.ts");
    });
  });

  describe("RepositoryError", () => {
    it("should create with message and operation", () => {
      const error = new RepositoryError("Failed to connect to database", "SELECT");

      expect(error.message).toBe("Failed to connect to database");
      expect(error.operation).toBe("SELECT");
      expect(error.code).toBe("REPOSITORY_ERROR");
    });

    it("should support different operations", () => {
      const selectError = new RepositoryError("Query timeout", "SELECT");
      const insertError = new RepositoryError("Duplicate key error", "INSERT");
      const deleteError = new RepositoryError("Referential integrity error", "DELETE");

      expect(selectError.operation).toBe("SELECT");
      expect(insertError.operation).toBe("INSERT");
      expect(deleteError.operation).toBe("DELETE");
    });

    it("should handle custom operation names", () => {
      const error = new RepositoryError("Transaction failed", "BATCH_UPDATE");

      expect(error.operation).toBe("BATCH_UPDATE");
    });
  });

  describe("ConfigurationError", () => {
    it("should create with message", () => {
      const error = new ConfigurationError("Missing required environment variable: DB_URL");

      expect(error.message).toBe("Missing required environment variable: DB_URL");
      expect(error.code).toBe("CONFIGURATION_ERROR");
    });

    it("should work with detailed configuration messages", () => {
      const error = new ConfigurationError(
        "Invalid configuration: 'port' must be a number between 1 and 65535",
      );

      expect(error.message).toContain("port");
      expect(error.message).toContain("65535");
    });
  });

  describe("Error inheritance chain", () => {
    const errors: DomainError[] = [
      new EntityNotFoundError("Test", "123"),
      new InvalidArgumentError("test"),
      new ValidationError("test"),
      new FileSystemError("test", "/path"),
      new ParserError("test", "file.ts"),
      new RepositoryError("test", "SELECT"),
      new ConfigurationError("test"),
    ];

    it("should all extend DomainError", () => {
      errors.forEach((error) => {
        expect(error instanceof DomainError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });
    });

    it("should all have code", () => {
      errors.forEach((error) => {
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe("string");
        expect(error.code.length).toBeGreaterThan(0);
      });
    });

    it("should all have timestamp", () => {
      errors.forEach((error) => {
        expect(error.timestamp).toBeInstanceOf(Date);
      });
    });

    it("should have unique codes", () => {
      const codes = errors.map((e) => e.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("Error handling scenarios", () => {
    it("should be catchable as Error", () => {
      const error = new EntityNotFoundError("User", "123");

      expect(() => {
        throw error;
      }).toThrow(Error);
    });

    it("should be catchable as specific DomainError", () => {
      const error = new ValidationError("test", ["issue"]);

      expect(() => {
        throw error;
      }).toThrow(ValidationError);
    });

    it("should be serializable for logging", () => {
      const error = new ParserError("Syntax error", "main.ts", "typescript");

      const logged = {
        name: error.name,
        message: error.message,
        code: error.code,
        timestamp: error.timestamp.toISOString(),
      };

      expect(logged.name).toBe("ParserError");
      expect(logged.code).toBe("PARSER_ERROR");
    });
  });
});
