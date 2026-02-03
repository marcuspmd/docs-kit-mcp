import { parentPort } from "node:worker_threads";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import Parser from "tree-sitter";
import { indexFile } from "./indexer.js";
import type { CodeSymbol } from "./symbol.types.js";

/* ================== Worker Types ================== */

export interface WorkerTask {
  filePath: string;
  relPath: string;
  existingHash?: string;
  fullRebuild: boolean;
}

export interface WorkerResult {
  success: boolean;
  relPath: string;
  symbols?: CodeSymbol[];
  hash?: string;
  source?: string;
  lastModified?: Date;
  error?: string;
  skipped?: boolean;
}

/* ================== Worker Entry Point ================== */

if (parentPort) {
  parentPort.on("message", (task: WorkerTask) => {
    try {
      const result = processFile(task);
      parentPort!.postMessage(result);
    } catch (error) {
      const result: WorkerResult = {
        success: false,
        relPath: task.relPath,
        error: error instanceof Error ? error.message : String(error),
      };
      parentPort!.postMessage(result);
    }
  });
}

/* ================== File Processing ================== */

function processFile(task: WorkerTask): WorkerResult {
  const { filePath, relPath, existingHash, fullRebuild } = task;

  try {
    const source = readFileSync(filePath, "utf-8");
    const hash = createHash("sha256").update(source).digest("hex");

    // Incremental: skip unchanged files
    if (!fullRebuild && existingHash && existingHash === hash) {
      return {
        success: true,
        relPath,
        skipped: true,
      };
    }

    // Parse and extract symbols
    const parser = new Parser();
    const symbols = indexFile(relPath, source, parser);

    // Add metadata
    const stat = statSync(filePath);
    for (const sym of symbols) {
      sym.lastModified = stat.mtime;
      sym.source = "human";
    }

    return {
      success: true,
      relPath,
      symbols,
      hash,
      source,
      lastModified: stat.mtime,
    };
  } catch (error) {
    return {
      success: false,
      relPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
