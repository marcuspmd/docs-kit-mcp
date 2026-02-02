import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "dotenv/config";
import { createServerDependencies } from "./dependencies.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Create and configure the MCP server
 */
export function createMcpServer(): McpServer {
  return new McpServer({
    name: "docs-kit",
    version: "1.0.0",
  });
}

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  const deps = await createServerDependencies(process.cwd());
  const server = createMcpServer();

  registerAllTools(server, deps);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Export types and dependencies for external use
export type { ServerDependencies } from "./types.js";
export { createServerDependencies } from "./dependencies.js";
export { registerAllTools } from "./tools/index.js";
export { mcpSuccess, mcpError } from "./types.js";
