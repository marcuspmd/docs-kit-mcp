/**
 * open-site use case — generate + serve the v2 static site locally
 */
import http from "http";
import fs from "fs";
import path from "path";
import { buildSiteUseCase } from "./buildSite.usecase.js";
import { loadConfig } from "../../configLoader.js";
import { createLlmProvider, type LlmProvider } from "../../llm/provider.js";
import { isLlmConfigured } from "../utils/config.js";
import { answerAssistant, type AssistantRequest } from "../../server/assistant.js";

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

/** Handles POST /api/assistant. Returns the answer or throws (message is shown to the user). */
export type AssistantHandler = (req: AssistantRequest) => Promise<string>;

const MAX_BODY_BYTES = 200_000;

export async function serveSite(
  dir: string,
  port: number,
  assistant?: AssistantHandler,
): Promise<http.Server> {
  return serveStatic(dir, port, assistant ?? (await createAssistantHandler(dir, process.cwd())));
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/** Builds the assistant handler from docs.config.js; null-handler errors explain what is missing. */
export async function createAssistantHandler(
  outDir: string,
  configDir: string,
): Promise<AssistantHandler> {
  let llm: LlmProvider | undefined;
  let setupError: string | undefined;
  try {
    const config = await loadConfig(configDir);
    if (!isLlmConfigured(config)) {
      setupError =
        "LLM not configured. Set `llm.provider` and an API key (e.g. GEMINI_API_KEY / OPENROUTER_API_KEY in .env) in docs.config.js.";
    } else {
      llm = createLlmProvider(config);
    }
  } catch (err) {
    setupError = err instanceof Error ? err.message : String(err);
  }
  return async (req) => {
    if (!llm) throw new Error(setupError ?? "LLM not available");
    return answerAssistant(outDir, llm, req);
  };
}

function serveStatic(
  dir: string,
  port: number,
  assistant?: AssistantHandler,
): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url?.split("?")[0] ?? "/";

    if (urlPath === "/api/assistant") {
      if (!assistant || req.method !== "POST") {
        return sendJson(res, assistant ? 405 : 404, { error: "Not available" });
      }
      try {
        const body = (await readJsonBody(req)) as AssistantRequest;
        const answer = await assistant(body);
        return sendJson(res, 200, { answer });
      } catch (err) {
        return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }

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
        const next = port + 1;
        reject(
          new Error(
            `Port ${port} is already in use. Run again on another port (change ${next} as needed):\n\n` +
              `    docs-kit open-site --port ${next}\n\n` +
              `  To see what is using it: lsof -i :${port}`,
          ),
        );
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

  // Fail fast on a busy port, before the (slow) site build
  const probe = await serveStatic(outDir, port);
  await new Promise<void>((resolve) => probe.close(() => resolve()));

  console.log("  Generating docs-kit site v2…");
  await buildSiteUseCase({ outDir, dbPath, rootDir });

  const assistant = await createAssistantHandler(outDir, process.cwd());
  await serveStatic(outDir, port, assistant);

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
