import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fastGlob from "fast-glob";
import { parseFrontmatter } from "./frontmatter.js";

export interface DocMapping {
  symbolName: string;
  docPath: string;
  section?: string;
}

export interface DocRegistry {
  rebuild(docsDir: string): Promise<void>;
  findDocBySymbol(symbolName: string): Promise<DocMapping[]>;
  findSymbolsByDoc(docPath: string): Promise<string[]>;
  findAllMappings(): Promise<DocMapping[]>;
  register(mapping: DocMapping): Promise<void>;
  unregister(symbolName: string): Promise<void>;
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS doc_mappings (
  symbol_name TEXT NOT NULL,
  doc_path    TEXT NOT NULL,
  section     TEXT,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (symbol_name, doc_path)
)`;

export function createDocRegistry(db: Database.Database): DocRegistry {
  db.exec(CREATE_TABLE);

  const insertStmt = db.prepare(
    "INSERT OR REPLACE INTO doc_mappings (symbol_name, doc_path, section) VALUES (?, ?, ?)",
  );
  const deleteStmt = db.prepare("DELETE FROM doc_mappings WHERE symbol_name = ?");
  const findBySymbolStmt = db.prepare(
    "SELECT symbol_name, doc_path, section FROM doc_mappings WHERE symbol_name = ?",
  );
  const findByDocStmt = db.prepare("SELECT symbol_name FROM doc_mappings WHERE doc_path = ?");
  const findAllStmt = db.prepare("SELECT symbol_name, doc_path, section FROM doc_mappings");

  return {
    async rebuild(docsDir: string): Promise<void> {
      const mdFiles = await fastGlob("**/*.md", { cwd: docsDir });
      db.exec("DELETE FROM doc_mappings");

      for (const file of mdFiles) {
        const content = await readFile(join(docsDir, file), "utf-8");
        const { frontmatter } = parseFrontmatter(content);
        for (const sym of frontmatter.symbols) {
          insertStmt.run(sym, file, null);
        }
      }
    },

    async findDocBySymbol(symbolName: string): Promise<DocMapping[]> {
      const rows = findBySymbolStmt.all(symbolName) as Array<{
        symbol_name: string;
        doc_path: string;
        section: string | null;
      }>;
      return rows.map((r) => ({
        symbolName: r.symbol_name,
        docPath: r.doc_path,
        section: r.section ?? undefined,
      }));
    },

    async findSymbolsByDoc(docPath: string): Promise<string[]> {
      const rows = findByDocStmt.all(docPath) as Array<{
        symbol_name: string;
      }>;
      return rows.map((r) => r.symbol_name);
    },

    async findAllMappings(): Promise<DocMapping[]> {
      const rows = findAllStmt.all() as Array<{
        symbol_name: string;
        doc_path: string;
        section: string | null;
      }>;
      return rows.map((r) => ({
        symbolName: r.symbol_name,
        docPath: r.doc_path,
        section: r.section ?? undefined,
      }));
    },

    async register(mapping: DocMapping): Promise<void> {
      insertStmt.run(mapping.symbolName, mapping.docPath, mapping.section ?? null);
    },

    async unregister(symbolName: string): Promise<void> {
      deleteStmt.run(symbolName);
    },
  };
}
