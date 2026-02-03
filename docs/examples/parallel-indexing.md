---
title: "Parallel Indexing"
symbols: ["indexInParallel", "WorkerPool", "ParallelIndexOptions"]
category: "examples"
---

# Parallel Indexing

## Overview

The docs-kit indexer supports **parallel processing** using Node.js Worker Threads to significantly speed up indexing for large codebases. This feature is enabled by default and automatically scales based on your CPU count.

## Key Benefits

- **⚡ Faster indexing**: Process multiple files simultaneously
- **🔒 Safe concurrency**: No SQLite conflicts through batching
- **📊 Auto-scaling**: Uses optimal worker count based on CPU cores
- **✅ Backward compatible**: Falls back to sequential for small projects

## Architecture

```
┌─────────────┐
│   Main      │
│   Thread    │
└─────┬───────┘
      │
      ├─────► Worker 1 ─┐
      ├─────► Worker 2 ─┤
      ├─────► Worker 3 ─┼──► Parse & Extract
      └─────► Worker N ─┘
            │
            ▼
      ┌──────────┐
      │  Batch   │
      │  Write   │
      │  to DB   │
      └──────────┘
```

### How It Works

1. **Task Distribution**: Main thread divides files among worker threads
2. **Parallel Processing**: Each worker:
   - Reads file content
   - Computes SHA-256 hash for incremental indexing
   - Parses AST using Tree-sitter
   - Extracts symbols
   - Serializes results
3. **Aggregation**: Main thread collects all results
4. **Batch Write**: Single transaction writes all symbols to SQLite (avoids conflicts)

## Configuration

### Default Behavior

By default, parallel indexing is **enabled** for projects with > 10 files:

```javascript
// docs.config.js
export default {
  indexing: {
    parallel: true,       // Enable/disable (default: true)
    maxWorkers: undefined // Auto-detect (default: CPU count - 1, max 8)
  }
}
```

### Custom Worker Count

To manually control the number of workers:

```javascript
export default {
  indexing: {
    parallel: true,
    maxWorkers: 4  // Use exactly 4 workers
  }
}
```

### Disable Parallel Indexing

For debugging or small projects:

```javascript
export default {
  indexing: {
    parallel: false  // Force sequential indexing
  }
}
```

## Performance Comparison

### Test Environment
- MacBook Pro M1 (8 cores)
- Project: 500 TypeScript files (~50,000 lines)

| Mode | Workers | Time | Speedup |
|------|---------|------|---------|
| Sequential | 1 | 42s | 1x |
| Parallel | 4 | 12s | **3.5x** |
| Parallel | 8 | 8s | **5.25x** |

## Concurrency & SQLite

### The Challenge

SQLite (via better-sqlite3) doesn't support concurrent writes from multiple connections.

### The Solution

1. **Workers** process files **in memory** (no DB access)
2. **Main thread** performs a **single batch write** after all workers finish
3. **Transactions** ensure atomicity

This approach gives us parallelism **without** SQLite conflicts.

## Implementation Details

### Worker Thread (indexWorker.ts)

Each worker:
- Receives file path + existing hash map
- Skips unchanged files (incremental indexing)
- Parses AST and extracts symbols
- Returns results to main thread

### Coordinator (parallelIndexer.ts)

Manages worker pool:
- Creates N workers based on config
- Distributes tasks via queue
- Collects and aggregates results
- Handles errors gracefully

### Use Case (index.usecase.ts)

Determines strategy:
```typescript
if (parallelEnabled && tsFiles.length > 10) {
  return await indexSymbolsParallel(...);
} else {
  return await indexSymbolsSequential(...);
}
```

## Troubleshooting

### Issue: Indexing Slower with Parallel Mode

**Cause**: Overhead of worker creation for small projects

**Solution**: Disable parallel mode or increase file count threshold:
```javascript
indexing: { parallel: false }
```

### Issue: Out of Memory

**Cause**: Too many workers for available RAM

**Solution**: Reduce `maxWorkers`:
```javascript
indexing: { maxWorkers: 2 }
```

### Issue: TypeScript Compilation Errors

**Cause**: Worker thread requires `.js` files (ESM)

**Solution**: Always run `npm run build` before indexing:
```bash
npm run build
docs-kit index
```

## Future Enhancements

- [ ] Incremental indexing with file watchers
- [ ] Shared memory for large ASTs
- [ ] Progress bar for parallel indexing
- [ ] Adaptive worker scaling based on system load

## Related

- [Indexer Architecture](../modules/indexer.md)
- [Configuration Guide](../README.md#configuration)
- [Performance Tuning](./ci-improvements.md)
