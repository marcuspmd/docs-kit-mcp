/**
 * Result Pattern for handling success/failure outcomes
 *
 * Provides a type-safe way to handle operations that can fail
 * without throwing exceptions for expected failures.
 */
export class Result<T, E = Error> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _value?: T;
  private readonly _error?: E;

  private constructor(isSuccess: boolean, value?: T, error?: E) {
    if (isSuccess && error !== undefined) {
      throw new Error("Cannot have error with success result");
    }

    if (!isSuccess && error === undefined) {
      throw new Error("Must have error with failure result");
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._value = value;
    this._error = error;
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error("Cannot get value from failed result. Check isSuccess first.");
    }
    return this._value as T;
  }

  public get error(): E {
    if (!this.isFailure) {
      throw new Error("Cannot get error from successful result. Check isFailure first.");
    }
    return this._error as E;
  }

  public getOrElse(defaultValue: T): T {
    return this.isSuccess ? (this._value as T) : defaultValue;
  }

  public map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure) {
      return Result.fail<U, E>(this._error as E);
    }
    return Result.ok<U, E>(fn(this._value as T));
  }

  public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isFailure) {
      return Result.fail<U, E>(this._error as E);
    }
    return fn(this._value as T);
  }

  public static ok<U, E = Error>(value: U): Result<U, E> {
    return new Result<U, E>(true, value, undefined);
  }

  public static fail<U, E = Error>(error: E): Result<U, E> {
    return new Result<U, E>(false, undefined, error);
  }

  public static combine<E = Error>(results: Result<unknown, E>[]): Result<void, E> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail<void, E>(result._error as E);
      }
    }
    return Result.ok<void, E>(undefined);
  }

  public static fromTry<T, E = Error>(fn: () => T): Result<T, E> {
    try {
      return Result.ok<T, E>(fn());
    } catch (error) {
      return Result.fail<T, E>(error as E);
    }
  }

  public static async fromPromise<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
    try {
      const value = await promise;
      return Result.ok<T, E>(value);
    } catch (error) {
      return Result.fail<T, E>(error as E);
    }
  }
}
