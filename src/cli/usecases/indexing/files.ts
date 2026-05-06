import path from "node:path";
import fg from "fast-glob";
import type { ResolvedConfig } from "../../../configLoader.js";
import type {
  FileHashRepository,
  RelationshipRepository,
  SymbolRepository,
} from "../../../storage/db.js";
import { done, step } from "../../utils/index.js";

export async function findSourceFiles(config: ResolvedConfig, rootDir: string) {
  step("Scanning for source files");
  const relativeFiles = await fg(config.include, {
    cwd: path.resolve(rootDir),
    ignore: config.exclude,
    absolute: false,
  });
  const tsFiles = relativeFiles.map((file) => path.join(rootDir, file));
  done(`found ${tsFiles.length} files`);
  return { tsFiles, relativeFiles };
}

export async function cleanupRemovedFiles(
  fileHashRepo: FileHashRepository,
  symbolRepo: SymbolRepository,
  relRepo: RelationshipRepository,
  relativeFiles: string[],
  configDir: string,
  rootDir: string,
) {
  const knownFiles = fileHashRepo.getAll();
  const currentFileSet = new Set(
    relativeFiles.map((file) => path.relative(configDir, path.resolve(rootDir, file))),
  );
  const removedFiles: string[] = [];

  for (const { filePath: knownPath } of knownFiles) {
    if (!currentFileSet.has(knownPath)) {
      removedFiles.push(knownPath);
      symbolRepo.deleteByFile(knownPath);
      relRepo.deleteBySource(knownPath);
      relRepo.deleteBySource(`module::${knownPath}`);
      fileHashRepo.delete(knownPath);
    }
  }

  if (removedFiles.length > 0) {
    console.log(`  -> Removed ${removedFiles.length} stale files from index`);
  }
}
