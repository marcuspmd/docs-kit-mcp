import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDependencies } from "../types.js";
import { mcpSuccess, mcpError } from "../types.js";
import { updateFindingStatus } from "../../storage/reportRepositories.js";
import type { FindingStatus } from "../../storage/reportRepositories.js";

export const updateDeadCodeStatusSchema = {
  id: z.string().describe("Finding ID (shown in scanForDeadCode output)"),
  status: z
    .enum(["active", "false_positive", "ignored"])
    .describe(
      "'false_positive' — mark as not dead code (suppressed from future scans). 'ignored' — known but intentionally not addressed. 'active' — reopen a previously suppressed finding.",
    ),
  notes: z
    .string()
    .optional()
    .describe("Optional explanation for the status change (e.g. 'Exported for plugin API')"),
};

export function registerUpdateDeadCodeStatusTool(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const { db } = deps;

  server.registerTool(
    "updateDeadCodeStatus",
    {
      description:
        "Update the status of a dead code finding. Use 'false_positive' to suppress a finding that is not actually dead, 'ignored' to acknowledge but defer it, or 'active' to reopen it. The change is recorded in the audit history.",
      inputSchema: updateDeadCodeStatusSchema,
    },
    async ({ id, status, notes }) => {
      try {
        const updated = updateFindingStatus(db, id, status as FindingStatus, notes);

        if (!updated) {
          return mcpError(
            `Finding '${id}' not found. Run scanForDeadCode to see available finding IDs.`,
          );
        }

        const noteText = notes ? ` Note: "${notes}"` : "";
        return mcpSuccess(
          `Finding ${id} status updated to '${status}'.${noteText}\nChange recorded in audit history.`,
        );
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
