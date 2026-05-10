import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { getFindingHistory } from "../../storage/reportRepositories.js";

export const getDeadCodeHistorySchema = {
  findingId: z
    .string()
    .optional()
    .describe(
      "Scope history to a specific finding ID. Omit to retrieve the full audit trail across all findings.",
    ),
};

export function registerGetDeadCodeHistoryTool(server: McpServer, deps: ServerDependencies): void {
  const { db } = deps;

  server.registerTool(
    "getDeadCodeHistory",
    {
      description:
        "Retrieve the audit history of dead code finding status changes. Provides a chronological delta log of every scan detection and manual status update. Scope to a specific finding ID or omit for the full trail.",
      inputSchema: getDeadCodeHistorySchema,
    },
    async ({ findingId }) => {
      try {
        const rows = getFindingHistory(db, findingId);

        if (rows.length === 0) {
          return mcpSuccess(
            findingId
              ? `No history found for finding '${findingId}'.`
              : "No history recorded yet. Run scanForDeadCode first.",
          );
        }

        const lines = rows.map((r) => {
          const sourceLabel = r.source === "scan" ? "[scan]" : "[user]";
          const arrow =
            r.old_value !== null && r.old_value !== ""
              ? `${r.old_value} → ${r.new_value}`
              : r.new_value;
          return `${r.changed_at} ${sourceLabel} finding:${r.finding_id}  ${r.field}: ${arrow}`;
        });

        const header = findingId
          ? `Audit history for finding ${findingId} (${rows.length} entries):`
          : `Full audit history (${rows.length} entries):`;

        return mcpSuccess(`${header}\n\n${lines.join("\n")}`);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
