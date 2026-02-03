import type { Result } from "../domain/Result.js";

/**
 * Base interface for all Use Cases
 *
 * Use Cases represent application-specific business rules.
 * They orchestrate the flow of data and apply business rules
 * to achieve a specific goal.
 */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput>>;
}

/**
 * Use Case without input
 */
export interface UseCaseNoInput<TOutput> {
  execute(): Promise<Result<TOutput>>;
}
