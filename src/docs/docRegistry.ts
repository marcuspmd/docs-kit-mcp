import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fastGlob from "fast-glob";
import { parseFrontmatter } from "./frontmatter.js";
import type { DocEntry } from "../config.js";

export interface DocMapping {
  symbolName: string;
  docPath: string;
  section?: string;
}

/** Registered document for RAG/viewing (independent of symbol mappings) */
export interface RegisteredDoc {
  path: string;
  title: string;
  name: string;
  category: string;
  module: string;
  previous?: string;
  next?: string;
  showOnMenu?: boolean;
}

export interface RebuildOptions {
  /** Optional doc entries from config (docs.config.js docs array) */
  configDocs?: DocEntry[];
}

export interface DocRegistry {
  rebuild(docsDir: string, options?: RebuildOptions): Promise<void>;
  findDocBySymbol(symbolName: string): Promise<DocMapping[]>;
  findSymbolsByDoc(docPath: string): Promise<string[]>;
  findAllMappings(): Promise<DocMapping[]>;
  register(mapping: DocMapping): Promise<void>;
  unregister(symbolName: string): Promise<void>;
  /** Get all registered docs (from config) */
  findAllDocs(): RegisteredDoc[];
  /** Get a registered doc by path */
  findDocByPath(docPath: string): RegisteredDoc | undefined;
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS doc_mappings (
  symbol_name TEXT NOT NULL,
  doc_path    TEXT NOT NULL,
  section     TEXT,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (symbol_name, doc_path)
)`;

const CREATE_DOCS_TABLE = `
CREATE TABLE IF NOT EXISTS registered_docs (
  path        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  module      TEXT NOT NULL,
  previous    TEXT,
  next        TEXT,
  show_on_menu INTEGER DEFAULT 0,
  updated_at  TEXT DEFAULT (datetime('now'))
)`;

export function createDocRegistry(db: Database.Database): DocRegistry {
  db.exec(CREATE_TABLE);
  db.exec(CREATE_DOCS_TABLE);

  const insertStmt = db.prepare(
    "INSERT OR REPLACE INTO doc_mappings (symbol_name, doc_path, section) VALUES (?, ?, ?)",
  );
  const deleteStmt = db.prepare("DELETE FROM doc_mappings WHERE symbol_name = ?");
  const findBySymbolStmt = db.prepare(
    "SELECT symbol_name, doc_path, section FROM doc_mappings WHERE symbol_name = ?",
  );
  const findByDocStmt = db.prepare("SELECT symbol_name FROM doc_mappings WHERE doc_path = ?");
  const findAllStmt = db.prepare("SELECT symbol_name, doc_path, section FROM doc_mappings");

  // Registered docs statements
  const insertDocStmt = db.prepare(
    "INSERT OR REPLACE INTO registered_docs (path, title, name, category, module, previous, next, show_on_menu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const findAllDocsStmt = db.prepare(
    "SELECT path, title, name, category, module, previous, next, show_on_menu FROM registered_docs ORDER BY category, title",
  );
  const findDocByPathStmt = db.prepare(
    "SELECT path, title, name, category, module, previous, next, show_on_menu FROM registered_docs WHERE path = ?",
  );

  return {
    async rebuild(docsDir: string, options?: RebuildOptions): Promise<void> {
      const mdFiles = await fastGlob("**/*.md", { cwd: docsDir });
      db.exec("DELETE FROM doc_mappings");
      db.exec("DELETE FROM registered_docs");

      // 1. Register all docs from config (for RAG/viewing)
      const configDocs = options?.configDocs ?? [];
      for (const doc of configDocs) {
        insertDocStmt.run(
          doc.path,
          doc.title ?? doc.name ?? doc.path,
          doc.name ?? doc.path,
          doc.category ?? "general",
          doc.module ?? "Main",
          doc.previous ?? null,
          doc.next ?? null,
          doc.showOnMenu ? 1 : 0,
        );

        // Also register symbol mappings if provided
        if (doc.symbols && doc.symbols.length > 0) {
          for (const sym of doc.symbols) {
            insertStmt.run(sym, doc.path, null);
          }
        }
      }

      // 2. Scan markdown files for frontmatter symbols (these can add more mappings)
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

    findAllDocs(): RegisteredDoc[] {
      const rows = findAllDocsStmt.all() as Array<{
        path: string;
        title: string;
        name: string;
        category: string;
        module: string;
        previous: string | null;
        next: string | null;
        show_on_menu: number;
      }>;
      return rows.map((r) => ({
        path: r.path,
        title: r.title,
        name: r.name,
        category: r.category,
        module: r.module,
        previous: r.previous ?? undefined,
        next: r.next ?? undefined,
        showOnMenu: r.show_on_menu === 1,
      }));
    },

    findDocByPath(docPath: string): RegisteredDoc | undefined {
      const row = findDocByPathStmt.get(docPath) as
        | {
            path: string;
            title: string;
            name: string;
            category: string;
            module: string;
            previous: string | null;
            next: string | null;
            show_on_menu: number;
          }
        | undefined;
      if (!row) return undefined;
      return {
        path: row.path,
        title: row.title,
        name: row.name,
        category: row.category,
        module: row.module,
        previous: row.previous ?? undefined,
        next: row.next ?? undefined,
        showOnMenu: row.show_on_menu === 1,
      };
    },
  };
}
