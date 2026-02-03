import type { Document } from "../entities/Document.js";

export interface IDocumentRepository {
  findByPath(path: string): Document | undefined;
  findBySymbol(symbolName: string): Document[];
  findAll(): Document[];
  save(document: Document): void;
  delete(path: string): void;
}
