import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { upsertReaperFindings, getAllFindings } from "../../storage/reportRepositories.js";
import type { FindingStatus } from "../../storage/reportRepositories.js";

export const scanForDeadCodeSchema = {
  docsDir: z.string().default("docs").describe("Docs directory"),
  status: z
    .enum(["active", "false_positive", "ignored", "resolved", "all"])
    .default("active")
    .describe(
      "Filter findings by status. 'active' shows only unreviewed findings (default). 'all' includes suppressed and resolved.",
    ),
};

export function registerScanForDeadCodeTool(server: McpServer, deps: ServerDependencies): void {
  const { registry, symbolRepo, graph, reaper, db } = deps;

  server.registerTool(
    "scanForDeadCode",
    {
      description:
        "Scan for dead code, orphan docs, and broken links. Results are persisted to the database with status management. Use status='all' to include previously suppressed findings.",
      inputSchema: scanForDeadCodeSchema,
    },
    async ({ docsDir, status }) => {
      try {
        await registry.rebuild(docsDir);
        const allSymbols = symbolRepo.findAll();
        const mappings = await registry.findAllMappings();
        const findings = reaper.scan(allSymbols, graph, mappings);

        // Persist findings with smart upsert (preserves false_positive / ignored status)
        upsertReaperFindings(
          db,
          findings.map((f) => ({
            type: f.type,
            target: f.target,
            reason: f.reason,
            suggestedAction: f.suggestedAction,
          })),
        );

        // Query back filtered results so status is always accurate
        const rows = getAllFindings(db, {
          status: status as FindingStatus | "all",
        });

        if (rows.length === 0) {
          return mcpSuccess("No findings match the requested status.");
        }

        const report = rows
          .map(
            (r) =>
              `[${r.type.toUpperCase()}] (id: ${r.id}) ${r.target}\n  Status: ${r.status}${r.notes ? ` | Note: ${r.notes}` : ""}\n  Reason: ${r.reason} (suggested: ${r.suggested_action})\n  First seen: ${r.first_seen_at} | Last seen: ${r.last_seen_at}`,
          )
          .join("\n\n");

        return mcpSuccess(report);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
