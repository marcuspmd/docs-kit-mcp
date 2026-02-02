import * as fs from "node:fs";
import * as path from "node:path";
import type { CodeSymbol } from "../indexer/symbol.types.js";
import type { DocRegistry } from "./docRegistry.js";

export interface ScanFileOptions {
  docsDir: string;
  projectRoot: string;
  symbols: CodeSymbol[];
  registry: DocRegistry;
}

export interface ScanFileResult {
  createdCount: number;
  createdSymbols: string[];
}

const DEFAULT_INITIAL_CONTENT = (symbol: CodeSymbol, relativeFile: string) => `---
title: ${symbol.name}
symbols:
  - ${symbol.name}
lastUpdated: ${new Date().toISOString().slice(0, 10)}
---

# ${symbol.name}

> TODO: Document \`${symbol.name}\` (${symbol.kind} in ${relativeFile}).

## Description

TODO: Add description here.

## Usage

TODO: Add usage examples here.
`;

/**
 * For each symbol in the list that has no doc mapping, create a doc file and register it.
 * Reusable by MCP server and CLI.
 */
export async function scanFileAndCreateDocs(options: ScanFileOptions): Promise<ScanFileResult> {
  const { docsDir, projectRoot, symbols, registry } = options;

  const createdSymbols: string[] = [];
  let createdCount = 0;

  for (const symbol of symbols) {
    const mappings = await registry.findDocBySymbol(symbol.name);
    if (mappings.length > 0) continue;

    const docPath = `domain/${symbol.name}.md`;
    const fullDocPath = path.join(docsDir, docPath);
    const docDir = path.dirname(fullDocPath);

    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }

    const relativeFile = path.relative(projectRoot, symbol.file);
    const initialContent = DEFAULT_INITIAL_CONTENT(symbol, relativeFile);
    fs.writeFileSync(fullDocPath, initialContent, "utf-8");

    await registry.register({
      symbolName: symbol.name,
      docPath,
    });

    createdCount++;
    createdSymbols.push(symbol.name);
  }

  return { createdCount, createdSymbols };
}
