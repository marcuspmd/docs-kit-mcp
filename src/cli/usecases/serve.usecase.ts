/**
 * serve use case — start local HTTP inspection API
 */
import "reflect-metadata";
import { createServerDependencies } from "../../server/dependencies.js";
import { startHttpServer } from "../../server/http.js";

export interface ServeUseCaseInput {
  port?: number;
  docsDir?: string;
}

export async function serveUseCase(input: ServeUseCaseInput = {}): Promise<void> {
  const port = input.port ?? 7337;
  const docsDir = input.docsDir ?? "docs";

  const deps = await createServerDependencies(process.cwd());

  startHttpServer(deps, port, docsDir);

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nStopping docs-kit server…");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    process.exit(0);
  });

  // Block forever
  await new Promise(() => {});
}
