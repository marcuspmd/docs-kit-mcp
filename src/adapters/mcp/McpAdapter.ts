import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { IndexProjectUseCase } from "../../modules/symbol/application/use-cases/IndexProject.usecase.js";
import type { ExplainSymbolUseCase } from "../../modules/symbol/application/use-cases/ExplainSymbol.usecase.js";
import type { BuildSiteUseCase } from "../../modules/documentation/application/use-cases/BuildSite.usecase.js";

export interface McpAdapterDeps {
  indexProject: IndexProjectUseCase;
  explainSymbol: ExplainSymbolUseCase;
  buildSite: BuildSiteUseCase;
}

/**
 * MCP Server Adapter
 *
 * Exposes use cases as MCP tools.
 */
export class McpAdapter {
  private server: Server;

  constructor(private readonly deps: McpAdapterDeps) {
    this.server = new Server(
      { name: "docs-kit", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "index_project",
          description: "Index project symbols for documentation",
          inputSchema: {
            type: "object",
            properties: {
              rootPath: { type: "string", description: "Root path to index" },
              fullRebuild: { type: "boolean", description: "Force full rebuild" },
            },
            required: ["rootPath"],
          },
        },
        {
          name: "explain_symbol",
          description: "Get AI explanation for a code symbol",
          inputSchema: {
            type: "object",
            properties: {
              symbolName: { type: "string", description: "Name of the symbol" },
              forceRegenerate: { type: "boolean", description: "Force regenerate explanation" },
            },
            required: ["symbolName"],
          },
        },
        {
          name: "build_site",
          description: "Build documentation site",
          inputSchema: {
            type: "object",
            properties: {
              rootPath: { type: "string", description: "Root path" },
              outputDir: { type: "string", description: "Output directory" },
            },
            required: ["rootPath"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "index_project": {
          const result = await this.deps.indexProject.execute({
            rootPath: (args?.rootPath as string) ?? ".",
            fullRebuild: args?.fullRebuild as boolean,
          });
          if (result.isSuccess) {
            return { content: [{ type: "text", text: JSON.stringify(result.value, null, 2) }] };
          }
          return {
            content: [{ type: "text", text: `Error: ${result.error.message}` }],
            isError: true,
          };
        }

        case "explain_symbol": {
          const result = await this.deps.explainSymbol.execute({
            symbolName: args?.symbolName as string,
            forceRegenerate: args?.forceRegenerate as boolean,
          });
          if (result.isSuccess) {
            return { content: [{ type: "text", text: result.value.explanation }] };
          }
          return {
            content: [{ type: "text", text: `Error: ${result.error.message}` }],
            isError: true,
          };
        }

        case "build_site": {
          const result = await this.deps.buildSite.execute({
            rootPath: (args?.rootPath as string) ?? ".",
            outputDir: (args?.outputDir as string) ?? "docs-site",
          });
          if (result.isSuccess) {
            return { content: [{ type: "text", text: JSON.stringify(result.value, null, 2) }] };
          }
          return {
            content: [{ type: "text", text: `Error: ${result.error.message}` }],
            isError: true,
          };
        }

        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP server started");
  }
}
