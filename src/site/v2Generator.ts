import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { createSiteDataBundle } from "./dataBundle.js";
import { loadSiteData } from "./dataLoader.js";

export interface GenerateSiteV2Options {
  dbPath?: string;
  db?: Database.Database;
  outDir: string;
  rootDir?: string;
  generatedAt?: string;
}

export interface GenerateSiteV2Result {
  symbolPages: number;
  filePages: number;
  totalFiles: number;
  classCount: number;
  moduleCount: number;
  dataFile: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveReactAppRoot(): string {
  const candidates = [
    path.resolve(__dirname, "..", "..", "site-v2"),
    path.resolve(process.cwd(), "site-v2"),
  ];

  const appRoot = candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));
  if (!appRoot) {
    throw new Error("React v2 site source not found. Expected site-v2/index.html.");
  }

  return appRoot;
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;

  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    total += entry.isDirectory() ? countFiles(fullPath) : 1;
  }
  return total;
}

async function buildReactApp(outDir: string): Promise<void> {
  const { build } = await import("vite");
  await build({
    root: resolveReactAppRoot(),
    base: "./",
    logLevel: "silent",
    build: {
      outDir: path.resolve(outDir),
      emptyOutDir: true,
    },
  });
}

export async function generateSiteV2(
  options: GenerateSiteV2Options,
): Promise<GenerateSiteV2Result> {
  const ownsDb = !options.db;
  const db = options.db ?? new Database(options.dbPath!, { readonly: true });

  try {
    const data = loadSiteData(db, options.rootDir);
    const bundle = createSiteDataBundle(data, options.generatedAt, options.rootDir);

    await buildReactApp(options.outDir);

    const dataFile = path.join(options.outDir, "site-data.json");
    fs.writeFileSync(dataFile, JSON.stringify(bundle, null, 2), "utf-8");

    return {
      symbolPages: data.symbols.length,
      filePages: data.files.length,
      totalFiles: countFiles(options.outDir),
      classCount: bundle.complexity.classes.length,
      moduleCount: bundle.complexity.modules.length,
      dataFile,
    };
  } finally {
    if (ownsDb) db.close();
  }
}
