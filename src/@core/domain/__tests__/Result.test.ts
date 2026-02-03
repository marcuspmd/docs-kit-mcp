import { describe, it, expect, jest } from "@jest/globals";
import { Result } from "../Result.js";

describe("Result Pattern", () => {
  describe("static ok()", () => {
    it("should create success result", () => {
      const result = Result.ok<string>("success");

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
    });

    it("should create success result with any type", () => {
      const resultString = Result.ok<string>("hello");
      const resultNumber = Result.ok<number>(42);
      const resultObject = Result.ok<{ id: string }>({ id: "test" });

      expect(resultString.isSuccess).toBe(true);
      expect(resultNumber.isSuccess).toBe(true);
      expect(resultObject.isSuccess).toBe(true);
    });

    it("should create success result with undefined value", () => {
      const result = Result.ok<void>(undefined);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it("should create success result with null value", () => {
      const result = Result.ok<null>(null);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe("static fail()", () => {
    it("should create failure result with Error", () => {
      const error = new Error("Something went wrong");
      const result = Result.fail<string>(error);

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it("should create failure result with custom error type", () => {
      class CustomError {
        constructor(public message: string) {}
      }

      const error = new CustomError("Custom error");
      const result = Result.fail<string, CustomError>(error);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toBe("Custom error");
    });

    it("should create failure result with string error", () => {
      const result = Result.fail<string, string>("error message");

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("error message");
    });
  });

  describe("value getter", () => {
    it("should get value from success result", () => {
      const result = Result.ok<string>("hello");

      expect(result.value).toBe("hello");
    });

    it("should throw error when getting value from failure result", () => {
      const error = new Error("Failed");
      const result = Result.fail<string>(error);

      expect(() => result.value).toThrow(
        "Cannot get value from failed result. Check isSuccess first.",
      );
    });

    it("should get value with complex type", () => {
      interface User {
        id: string;
        name: string;
      }

      const user: User = { id: "1", name: "John" };
      const result = Result.ok<User>(user);

      expect(result.value).toEqual(user);
      expect(result.value.name).toBe("John");
    });

    it("should get undefined value", () => {
      const result = Result.ok<void>(undefined);

      expect(result.value).toBeUndefined();
    });

    it("should get null value", () => {
      const result = Result.ok<null>(null);

      expect(result.value).toBeNull();
    });
  });

  describe("error getter", () => {
    it("should get error from failure result", () => {
      const error = new Error("Failed operation");
      const result = Result.fail<string>(error);

      expect(result.error).toBe(error);
      expect(result.error.message).toBe("Failed operation");
    });

    it("should throw error when getting error from success result", () => {
      const result = Result.ok<string>("success");

      expect(() => result.error).toThrow(
        "Cannot get error from successful result. Check isFailure first.",
      );
    });

    it("should get custom error type", () => {
      class ValidationError {
        constructor(
          public field: string,
          public reason: string,
        ) {}
      }

      const error = new ValidationError("email", "invalid format");
      const result = Result.fail<string, ValidationError>(error);

      expect(result.error.field).toBe("email");
      expect(result.error.reason).toBe("invalid format");
    });
  });

  describe("getOrElse()", () => {
    it("should return value for success result", () => {
      const result = Result.ok<string>("actual");

      expect(result.getOrElse("default")).toBe("actual");
    });

    it("should return default value for failure result", () => {
      const error = new Error("Failed");
      const result = Result.fail<string>(error);

      expect(result.getOrElse("default")).toBe("default");
    });

    it("should work with complex types", () => {
      interface Config {
        apiUrl: string;
        timeout: number;
      }

      const defaultConfig: Config = { apiUrl: "http://localhost", timeout: 5000 };
      const actualConfig: Config = { apiUrl: "http://api.example.com", timeout: 10000 };

      const successResult = Result.ok<Config>(actualConfig);
      const failureResult = Result.fail<Config>(new Error("Config load failed"));

      expect(successResult.getOrElse(defaultConfig)).toEqual(actualConfig);
      expect(failureResult.getOrElse(defaultConfig)).toEqual(defaultConfig);
    });

    it("should return undefined as default", () => {
      const result = Result.fail<string>(new Error("Failed"));

      expect(result.getOrElse(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe("map()", () => {
    it("should transform success result", () => {
      const result = Result.ok<number>(5).map((n) => n * 2);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(10);
    });

    it("should not execute map on failure result", () => {
      const error = new Error("Failed");
      const mapFn = jest.fn((n: number) => n * 2);
      const result = Result.fail<number>(error).map(mapFn);

      expect(mapFn).not.toHaveBeenCalled();
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it("should support chained mapping", () => {
      const result = Result.ok<number>(5)
        .map((n) => n * 2)
        .map((n) => n + 3)
        .map((n) => n.toString());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe("13");
    });

    it("should map string to different type", () => {
      const result = Result.ok<string>("hello").map((s) => s.length);

      expect(result.value).toBe(5);
    });

    it("should map to object", () => {
      const result = Result.ok<string>("hello").map((s) => ({
        text: s,
        length: s.length,
      }));

      expect(result.value).toEqual({ text: "hello", length: 5 });
    });

    it("should preserve error through failed map chain", () => {
      const error = new Error("Initial failure");
      const result = Result.fail<number>(error)
        .map((n) => n * 2)
        .map((n) => n + 3);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe("flatMap()", () => {
    it("should flatten nested result on success", () => {
      const result = Result.ok<number>(5).flatMap((n) => Result.ok<string>(n.toString()));

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe("5");
    });

    it("should return failure from inner result", () => {
      const innerError = new Error("Inner failure");
      const result = Result.ok<number>(5).flatMap(() => Result.fail<string>(innerError));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(innerError);
    });

    it("should not execute flatMap on failure", () => {
      const error = new Error("Initial failure");
      const flatMapFn = jest.fn(() => Result.ok("success"));
      const result = Result.fail<number>(error).flatMap(flatMapFn);

      expect(flatMapFn).not.toHaveBeenCalled();
      expect(result.isFailure).toBe(true);
    });

    it("should support chained flatMap", () => {
      const result = Result.ok<number>(5)
        .flatMap((n) => Result.ok<number>(n * 2))
        .flatMap((n) => Result.ok<string>(n.toString()))
        .flatMap((s) => Result.ok<number>(s.length));

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(2);
    });

    it("should stop chain on first failure", () => {
      const error = new Error("Chain breaks here");
      const fn3 = jest.fn((_s: string) => Result.ok<number>(0));

      const result = Result.ok<number>(5)
        .flatMap((n) => Result.ok<number>(n * 2))
        .flatMap(() => Result.fail<string>(error))
        .flatMap(fn3);

      expect(fn3).not.toHaveBeenCalled();
      expect(result.error).toBe(error);
    });

    it("should validate intermediate results", () => {
      const result = Result.ok<number>(5).flatMap((n) => {
        if (n > 10) {
          return Result.ok<number>(n);
        }
        return Result.fail<number>(new Error("Number too small"));
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toBe("Number too small");
    });
  });

  describe("static combine()", () => {
    it("should return ok when all results are success", () => {
      const results = [Result.ok<number>(1), Result.ok<number>(2), Result.ok<number>(3)];

      const combined = Result.combine(results);

      expect(combined.isSuccess).toBe(true);
    });

    it("should return first failure when any result fails", () => {
      const error1 = new Error("First error");
      const error2 = new Error("Second error");
      const results = [
        Result.ok<number>(1),
        Result.fail<number>(error1),
        Result.fail<number>(error2),
      ];

      const combined = Result.combine(results);

      expect(combined.isFailure).toBe(true);
      expect(combined.error).toBe(error1);
    });

    it("should handle empty array", () => {
      const results: Array<Result<number>> = [];

      const combined = Result.combine(results);

      expect(combined.isSuccess).toBe(true);
    });

    it("should handle single success result", () => {
      const results = [Result.ok<number>(42)];

      const combined = Result.combine(results);

      expect(combined.isSuccess).toBe(true);
    });

    it("should handle single failure result", () => {
      const error = new Error("Single failure");
      const results = [Result.fail<number>(error)];

      const combined = Result.combine(results);

      expect(combined.isFailure).toBe(true);
      expect(combined.error).toBe(error);
    });

    it("should work with custom error types", () => {
      class ValidationError {
        constructor(public field: string) {}
      }

      const error = new ValidationError("email");
      const results: Array<Result<string, ValidationError>> = [
        Result.ok<string, ValidationError>("valid"),
        Result.fail<string, ValidationError>(error),
      ];

      const combined = Result.combine<ValidationError>(results);

      expect(combined.error.field).toBe("email");
    });

    it("should return void value on success", () => {
      const results = [Result.ok<number>(1)];

      const combined = Result.combine(results);

      expect(combined.value).toBeUndefined();
    });
  });

  describe("static fromTry()", () => {
    it("should wrap successful function execution", () => {
      const result = Result.fromTry(() => 5 * 2);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(10);
    });

    it("should catch thrown errors", () => {
      const result = Result.fromTry(() => {
        throw new Error("Function failed");
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toBe("Function failed");
    });

    it("should work with complex functions", () => {
      const result = Result.fromTry(() => {
        const obj = { a: 1, b: 2 };
        return Object.keys(obj).length;
      });

      expect(result.value).toBe(2);
    });

    it("should execute function synchronously", () => {
      let executed = false;

      Result.fromTry(() => {
        executed = true;
        return "done";
      });

      expect(executed).toBe(true);
    });

    it("should catch various error types", () => {
      const resultTypeError = Result.fromTry(() => {
        const x: unknown = null;
        return (x as { prop: string }).prop;
      });

      expect(resultTypeError.isFailure).toBe(true);
    });
  });

  describe("static fromPromise()", () => {
    it("should resolve successful promise", async () => {
      const promise = Promise.resolve("success");
      const result = await Result.fromPromise(promise);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe("success");
    });

    it("should catch rejected promise", async () => {
      const error = new Error("Promise rejected");
      const promise = Promise.reject(error);
      const result = await Result.fromPromise(promise);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it("should handle async operations", async () => {
      const result = await Result.fromPromise(
        new Promise((resolve) => {
          setTimeout(() => resolve("delayed"), 10);
        }),
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe("delayed");
    });

    it("should handle promise rejection with value", async () => {
      const result = await Result.fromPromise(
        new Promise((_, reject) => {
          reject("string error");
        }),
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("string error");
    });

    it("should work with complex types", async () => {
      interface ApiResponse {
        data: string;
        status: number;
      }

      const promise = Promise.resolve<ApiResponse>({
        data: "test data",
        status: 200,
      });

      const result = await Result.fromPromise(promise);

      expect(result.value.data).toBe("test data");
      expect(result.value.status).toBe(200);
    });

    it("should handle promise that resolves with object", async () => {
      const obj = { id: 1, name: "test" };
      const result = await Result.fromPromise(Promise.resolve(obj));

      expect(result.value).toEqual(obj);
    });
  });

  describe("Constructor validation", () => {
    it("should throw error when creating success with error", () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Constructor = Result as any;
        new Constructor(true, "value", new Error("error"));
      }).toThrow("Cannot have error with success result");
    });

    it("should throw error when creating failure without error", () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Constructor = Result as any;
        new Constructor(false, "value", undefined);
      }).toThrow("Must have error with failure result");
    });
  });

  describe("Integration scenarios", () => {
    it("should handle validation workflow", () => {
      const validate = (email: string): Result<string> => {
        if (!email.includes("@")) {
          return Result.fail(new Error("Invalid email"));
        }
        return Result.ok(email);
      };

      const normalizeEmail = (email: string): Result<string> => {
        return Result.ok(email.toLowerCase());
      };

      const result = validate("Test@Example.COM")
        .flatMap((email) => normalizeEmail(email))
        .map((email) => ({ normalized: email, length: email.length }));

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        normalized: "test@example.com",
        length: 16,
      });
    });

    it("should handle error recovery", () => {
      const result = Result.fail<number>(new Error("Failed")).flatMap(
        () => Result.ok(42), // Default value
      );

      // After flatMap on failure, result should still be failure
      expect(result.isFailure).toBe(true);

      // But we can use getOrElse
      expect(Result.fail<number>(new Error("Failed")).getOrElse(42)).toBe(42);
    });

    it("should handle parsing and validation", () => {
      const parseJson = (json: string): Result<unknown> => {
        return Result.fromTry(() => JSON.parse(json));
      };

      const validate = (obj: unknown): Result<{ name: string }> => {
        if (
          typeof obj === "object" &&
          obj !== null &&
          "name" in obj &&
          typeof (obj as Record<string, unknown>).name === "string"
        ) {
          return Result.ok(obj as { name: string });
        }
        return Result.fail(new Error("Invalid object structure"));
      };

      const result = parseJson('{"name":"John"}').flatMap(validate);

      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe("John");
    });
  });
});
