/**
 * MCP Server Entry Point
 *
 * This file starts the docs-kit MCP server.
 * All tools are defined in src/server/tools/ directory.
 * Server configuration and dependencies are in src/server/.
 */
import "reflect-metadata";
import { startServer } from "./server/index.js";

await startServer();
