/**
 * open-site use case — generate + serve the v2 static site locally
 */
import http from "http";
import fs from "fs";
import path from "path";
import { buildSiteUseCase } from "./buildSite.usecase.js";

export interface OpenSiteUseCaseInput {
  port?: number;
  outDir?: string;
  dbPath?: string;
  rootDir?: string;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(dir: string, port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const urlPath = req.url?.split("?")[0] ?? "/";
    let filePath = path.join(dir, urlPath === "/" ? "index.html" : urlPath);

    // SPA fallback — serve index.html for unknown paths
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(dir, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve(server));
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use. Use --port to choose another port.`));
      } else {
        reject(err);
      }
    });
  });
}

export async function openSiteUseCase(input: OpenSiteUseCaseInput = {}): Promise<void> {
  const port = input.port ?? 3000;
  const outDir = input.outDir ?? "docs-site-v2";
  const dbPath = input.dbPath ?? ".docs-kit/index.db";
  const rootDir = input.rootDir ?? ".";

  console.log("  Generating docs-kit site v2…");
  await buildSiteUseCase({ version: "v2", outDir, dbPath, rootDir });

  await serveStatic(outDir, port);

  const url = `http://localhost:${port}`;
  console.log(`\n  docs-kit site v2 running at ${url}`);
  console.log("  Press Ctrl+C to stop.\n");

  // Try to open the browser (best-effort, no hard failure)
  const { exec } = await import("child_process");
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${opener} ${url}`);

  // Keep process alive
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  await new Promise(() => {});
}
