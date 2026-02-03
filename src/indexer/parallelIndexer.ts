import { Worker } from "node:worker_threads";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Parser from "tree-sitter";
import type { CodeSymbol } from "./symbol.types.js";
import type { WorkerTask, WorkerResult } from "./indexWorker.js";
import type { FileHashRepository } from "../storage/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ================== Types ================== */

export interface ParallelIndexOptions {
  files: Array<{ filePath: string; relPath: string }>;
  configDir: string;
  fileHashRepo: FileHashRepository;
  fullRebuild: boolean;
  maxWorkers?: number;
}

export interface ParallelIndexResult {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>; // reconstructed from sources
  sources: Map<string, string>; // relPath -> source code
  errors: Array<{ file: string; error: string }>;
  skippedCount: number;
  hashes: Map<string, string>; // relPath -> hash
}

/* ================== Worker Pool Manager ================== */

export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: (result: WorkerResult) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    private readonly workerPath: string,
    private readonly maxWorkers: number,
    private readonly existingHashes: Map<string, string>,
    private readonly fullRebuild: boolean,
  ) {}

  async initialize(): Promise<void> {
    // Create workers
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(this.workerPath);
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  async executeTask(task: Omit<WorkerTask, "existingHash" | "fullRebuild">): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task: task as WorkerTask, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.shift()!;
      const queueItem = this.taskQueue.shift()!;

      const messageHandler = (result: WorkerResult) => {
        worker.off("message", messageHandler);
        worker.off("error", errorHandler);
        this.availableWorkers.push(worker);
        queueItem.resolve(result);
        this.processQueue();
      };

      const errorHandler = (error: Error) => {
        worker.off("message", messageHandler);
        worker.off("error", errorHandler);
        this.availableWorkers.push(worker);
        queueItem.reject(error);
        this.processQueue();
      };

      worker.once("message", messageHandler);
      worker.once("error", errorHandler);

      // Send task to worker with hash info
      const taskWithHash: WorkerTask = {
        ...queueItem.task,
        existingHash: this.existingHashes.get(queueItem.task.relPath),
        fullRebuild: this.fullRebuild,
      };
      worker.postMessage(taskWithHash);
    }
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.availableWorkers = [];
  }
}

/* ================== Parallel Indexer ================== */

export async function indexInParallel(options: ParallelIndexOptions): Promise<ParallelIndexResult> {
  const { files, fileHashRepo, fullRebuild, maxWorkers } = options;

  // Determine worker count (default: CPU count - 1, min 1, max 8)
  const defaultWorkers = Math.max(1, Math.min(cpus().length - 1, 8));
  const workerCount = maxWorkers ?? defaultWorkers;

  // Load existing hashes for incremental indexing
  const existingHashes = new Map<string, string>();
  if (!fullRebuild) {
    const all = fileHashRepo.getAll();
    for (const { filePath, contentHash } of all) {
      existingHashes.set(filePath, contentHash);
    }
  }

  // Initialize worker pool
  const workerPath = join(__dirname, "indexWorker.js");
  const pool = new WorkerPool(workerPath, workerCount, existingHashes, fullRebuild);

  await pool.initialize();

  // Process files in parallel
  const results: ParallelIndexResult = {
    symbols: [],
    trees: new Map(),
    sources: new Map(),
    errors: [],
    skippedCount: 0,
    hashes: new Map(),
  };

  try {
    const taskPromises = files.map(({ filePath, relPath }) => {
      return pool.executeTask({ filePath, relPath });
    });

    const workerResults = await Promise.all(taskPromises);

    // Aggregate results
    for (const result of workerResults) {
      if (result.skipped) {
        results.skippedCount++;
        continue;
      }

      if (!result.success) {
        results.errors.push({
          file: result.relPath,
          error: result.error ?? "Unknown error",
        });
        continue;
      }

      if (result.symbols) {
        results.symbols.push(...result.symbols);
      }

      if (result.source) {
        results.sources.set(result.relPath, result.source);
      }

      if (result.hash) {
        results.hashes.set(result.relPath, result.hash);
      }
    }
  } finally {
    await pool.terminate();
  }

  return results;
}
