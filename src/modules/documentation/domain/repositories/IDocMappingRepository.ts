import type { DocMapping } from "../entities/DocMapping.js";

export interface IDocMappingRepository {
  findBySymbol(symbolName: string): DocMapping[];
  findByDoc(docPath: string): DocMapping[];
  findAll(): DocMapping[];
  save(mapping: DocMapping): void;
  delete(symbolName: string, docPath: string): void;
}
