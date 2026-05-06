/**
 * Local HTTP API server for the docs-kit site inspector.
 * Uses built-in node:http — no extra dependencies.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildRelevantContext } from "../knowledge/contextBuilder.js";
import type { ServerDependencies } from "./types.js";

const VERSION = "0.1.0";

function setCorsHeaders(res: ServerResponse, origin: string): void {
  // Only allow localhost origins
  if (
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    origin === "null"
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "null");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function parseQuery(url: string): Record<string, string> {
  try {
    const u = new URL(url, "http://localhost");
    const out: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  } catch {
    return {};
  }
}

function getPath(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0];
  }
}

/**
 * Create and start the HTTP inspection server.
 * Returns a stop function that closes the server.
 */
export function startHttpServer(
  deps: ServerDependencies,
  port: number,
  docsDir: string,
): () => void {
  const { config, registry, symbolRepo, graph, llm } = deps;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const origin = (req.headers["origin"] as string) ?? "null";
    setCorsHeaders(res, origin);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const pathname = getPath(req.url ?? "/");
    const query = parseQuery(req.url ?? "/");

    try {
      // --- GET /api/health ---
      if (pathname === "/api/health") {
        sendJson(res, 200, { status: "ok", version: VERSION });
        return;
      }

      // --- GET /api/stats ---
      if (pathname === "/api/stats") {
        const all = symbolRepo.findAll();
        sendJson(res, 200, {
          totalSymbols: all.length,
          version: VERSION,
        });
        return;
      }

      // --- GET /api/symbols/search?q=...&limit=10 ---
      if (pathname === "/api/symbols/search") {
        const q = query["q"] ?? "";
        const limit = Math.min(parseInt(query["limit"] ?? "10", 10) || 10, 50);
        if (!q) {
          sendJson(res, 400, { error: "Missing query parameter: q" });
          return;
        }
        const results = symbolRepo.search({ query: q, limit });
        sendJson(res, 200, {
          results: results.map((s) => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            file: s.file,
            startLine: s.startLine,
            layer: s.layer,
            summary: s.summary,
          })),
        });
        return;
      }

      // --- GET /api/context?symbol=...&file=...&mode=compact|full&maxContextChars=N ---
      if (pathname === "/api/context") {
        const symbolName = query["symbol"] || undefined;
        const filePath = query["file"] || undefined;
        const mode = (query["mode"] === "full" ? "full" : "compact") as "compact" | "full";
        const maxContextChars = parseInt(query["maxContextChars"] ?? "20000", 10) || 20_000;
        const maxSourceLines = parseInt(query["maxSourceLines"] ?? "80", 10) || 80;

        if (!symbolName && !filePath) {
          sendJson(res, 400, { error: "Provide either 'symbol' or 'file' query parameter." });
          return;
        }

        const t0 = Date.now();
        const result = await buildRelevantContext(
          { symbolName, filePath, mode, maxSourceLines, maxContextChars },
          {
            projectRoot: config.projectRoot,
            docsDir,
            registry,
            symbolRepo,
            graph,
            estimateTokens:
              typeof llm.estimateTokens === "function" ? llm.estimateTokens.bind(llm) : undefined,
          },
        );
        const elapsedMs = Date.now() - t0;

        // Derive coverage flags from context text
        const text = result.text;
        const hasDocs = text.includes("## Documentation");
        const hasSource = text.includes("## Source Code");
        const hasRelationships = text.includes("## Dependencies") || text.includes("## Dependents");

        const tokenEstimate =
          typeof llm.estimateTokens === "function"
            ? llm.estimateTokens(text)
            : Math.ceil(text.length / 4);

        sendJson(res, 200, {
          found: result.found,
          text: result.text,
          charCount: text.length,
          tokenEstimate,
          elapsedMs,
          hasDocs,
          hasSource,
          hasRelationships,
        });
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      console.error("[docs-kit serve] Error:", err);
      sendJson(res, 500, { error: (err as Error).message });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`docs-kit inspector API running at http://localhost:${port}`);
    console.log(`  GET /api/health`);
    console.log(`  GET /api/context?symbol=<name>&mode=compact|full`);
    console.log(`  GET /api/symbols/search?q=<query>`);
    console.log(`\nOpen docs-site/inspector.html in your browser to use the visual inspector.`);
    console.log(`Press Ctrl+C to stop.`);
  });

  return () => {
    server.close();
  };
}
