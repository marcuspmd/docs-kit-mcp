import type { ISymbolRepository } from "../../../domain/repositories/ISymbolRepository.js";
import type { CodeSymbol } from "../../../domain/entities/CodeSymbol.js";
import type { SymbolKindType } from "../../../domain/value-objects/SymbolKind.js";

/**
 * In-Memory Symbol Repository Implementation
 *
 * Useful for testing and development.
 */
export class InMemorySymbolRepository implements ISymbolRepository {
  private symbols: Map<string, CodeSymbol> = new Map();

  upsert(symbol: CodeSymbol): void {
    this.symbols.set(symbol.id, symbol);
  }

  upsertMany(symbols: CodeSymbol[]): void {
    for (const symbol of symbols) {
      this.upsert(symbol);
    }
  }

  findById(id: string): CodeSymbol | undefined {
    return this.symbols.get(id);
  }

  findByIds(ids: string[]): CodeSymbol[] {
    return ids.map((id) => this.symbols.get(id)).filter((s): s is CodeSymbol => s !== undefined);
  }

  findByName(name: string): CodeSymbol[] {
    return Array.from(this.symbols.values()).filter(
      (s) => s.name === name || s.qualifiedName === name,
    );
  }

  findAll(): CodeSymbol[] {
    return Array.from(this.symbols.values());
  }

  findByFile(file: string): CodeSymbol[] {
    return Array.from(this.symbols.values()).filter((s) => s.file === file);
  }

  findByKind(kind: SymbolKindType): CodeSymbol[] {
    return Array.from(this.symbols.values()).filter((s) => s.kind === kind);
  }

  deleteByFile(file: string): void {
    for (const [id, symbol] of this.symbols) {
      if (symbol.file === file) {
        this.symbols.delete(id);
      }
    }
  }

  clear(): void {
    this.symbols.clear();
  }

  count(): number {
    return this.symbols.size;
  }
}
