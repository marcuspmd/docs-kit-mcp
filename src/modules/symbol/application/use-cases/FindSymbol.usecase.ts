import type { UseCase } from "../../../../@core/application/UseCase.js";
import { Result } from "../../../../@core/domain/Result.js";
import type { ISymbolRepository } from "../../domain/repositories/ISymbolRepository.js";
import type { FindSymbolInput, SymbolOutput } from "../dtos/symbol.dto.js";
import { SymbolMapper } from "../mappers/SymbolMapper.js";
import { EntityNotFoundError } from "../../../../@shared/errors/DomainErrors.js";

/**
 * FindSymbol Use Case
 *
 * Finds symbols based on various criteria.
 */
export class FindSymbolUseCase implements UseCase<FindSymbolInput, SymbolOutput[]> {
  constructor(private readonly symbolRepo: ISymbolRepository) {}

  async execute(input: FindSymbolInput): Promise<Result<SymbolOutput[]>> {
    try {
      let symbols = [];

      if (input.id) {
        const symbol = this.symbolRepo.findById(input.id);
        symbols = symbol ? [symbol] : [];
      } else if (input.name) {
        symbols = this.symbolRepo.findByName(input.name);
      } else if (input.file) {
        symbols = this.symbolRepo.findByFile(input.file);
      } else if (input.kind) {
        symbols = this.symbolRepo.findByKind(input.kind);
      } else {
        symbols = this.symbolRepo.findAll();
      }

      return Result.ok(SymbolMapper.toDtoList(symbols));
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}

/**
 * GetSymbolById Use Case
 *
 * Gets a single symbol by ID.
 */
export class GetSymbolByIdUseCase implements UseCase<string, SymbolOutput> {
  constructor(private readonly symbolRepo: ISymbolRepository) {}

  async execute(id: string): Promise<Result<SymbolOutput>> {
    try {
      const symbol = this.symbolRepo.findById(id);
      if (!symbol) {
        return Result.fail(new EntityNotFoundError("Symbol", id));
      }
      return Result.ok(SymbolMapper.toDto(symbol));
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}
