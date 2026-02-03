/**
 * Base class for Domain Errors
 *
 * All domain-specific errors should extend this class.
 */
export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Entity not found error
 */
export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id: string) {
    super(`${entityName} with id '${id}' not found`, "ENTITY_NOT_FOUND");
  }
}

/**
 * Invalid argument error
 */
export class InvalidArgumentError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_ARGUMENT");
  }
}

/**
 * Validation error with multiple issues
 */
export class ValidationError extends DomainError {
  public readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message, "VALIDATION_ERROR");
    this.issues = issues;
  }
}

/**
 * File system related error
 */
export class FileSystemError extends DomainError {
  public readonly path: string;

  constructor(message: string, path: string) {
    super(message, "FILE_SYSTEM_ERROR");
    this.path = path;
  }
}

/**
 * Parser error
 */
export class ParserError extends DomainError {
  public readonly filePath: string;
  public readonly language?: string;

  constructor(message: string, filePath: string, language?: string) {
    super(message, "PARSER_ERROR");
    this.filePath = filePath;
    this.language = language;
  }
}

/**
 * Repository error
 */
export class RepositoryError extends DomainError {
  public readonly operation: string;

  constructor(message: string, operation: string) {
    super(message, "REPOSITORY_ERROR");
    this.operation = operation;
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends DomainError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
  }
}
