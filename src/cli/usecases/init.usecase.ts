import { configExists, createDefaultConfig } from "../../configLoader.js";

/**
 * Init command - Creates docs.config.js with default settings
 */
export interface InitUseCaseParams {
  rootDir: string;
}

export async function initUseCase(params: InitUseCaseParams): Promise<void> {
  const { rootDir } = params;

  if (configExists(rootDir)) {
    console.log("  docs.config.js already exists, skipping.");
    return;
  }

  const configPath = createDefaultConfig(rootDir);
  console.log(`  Created ${configPath}`);
  console.log("  Edit it to customize include/exclude patterns and other settings.");
}
