import fs from "node:fs";

export function assertDatabaseExists(dbPath: string): void {
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Database not found at ${dbPath}`);
    console.error(`Run "docs-kit index" first to create the index.`);
    process.exit(1);
  }
}
