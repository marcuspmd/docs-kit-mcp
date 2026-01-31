#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import { createDocRegistry } from "./docs/docRegistry.js";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { indexFile } from "./indexer/indexer.js";
import { CodeSymbol } from "./indexer/symbol.types.js";
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "generate-repo-docs") {
    const repoDir = args[1] || ".";
    const docsDir = args[2] || "docs";
    const dbPath = args[3] || ".doc-kit/registry.db";
    const excludeDirs = (args[4] || "node_modules,dist,.git,docs,tests,.doc-kit")
      .split(",")
      .map((d) => d.trim());

    await generateRepoDocumentation(repoDir, docsDir, dbPath, excludeDirs);
  } else {
    console.log("Usage:");
    console.log("  generate-repo-docs [repo-dir] [docs-dir] [db-path] [exclude-dirs]");
    console.log("");
    console.log("Examples:");
    console.log("  node dist/cli.js generate-repo-docs");
    process.exit(1);
  }
}

async function generateRepoDocumentation(
  repoDir: string = ".",
  docsDir: string = "docs",
  dbPath: string = ".doc-kit/registry.db",
  excludeDirs: string[] = ["node_modules", "dist", ".git", "docs", "tests", ".doc-kit"],
) {
  console.log("🔍 Iniciando geração completa de documentação do repositório...");

  // Ensure db directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  const registry = createDocRegistry(db);
  await registry.rebuild(docsDir);

  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);

  // Find all .ts files in the repository, excluding specified directories
  const tsFiles: string[] = [];

  function findTsFiles(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!excludeDirs.includes(item)) {
          findTsFiles(fullPath);
        }
      } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
        tsFiles.push(fullPath);
      }
    }
  }

  findTsFiles(repoDir);

  console.log(`📁 Encontrados ${tsFiles.length} arquivos .ts para processar`);

  let totalSymbols = 0;
  let createdDocs = 0;

  for (const filePath of tsFiles) {
    console.log(`\n📄 Processando ${filePath}...`);

    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const symbols = indexFile(filePath, source, parser);

      console.log(`   Encontrados ${symbols.length} símbolos`);

      for (const symbol of symbols) {
        totalSymbols++;
        const mappings = await registry.findDocBySymbol(symbol.name);

        if (mappings.length === 0) {
          // Create a new doc file for this symbol
          const docPath = `domain/${symbol.name}.md`;
          const fullDocPath = path.join(docsDir, docPath);
          const docDir = path.dirname(fullDocPath);

          if (!fs.existsSync(docDir)) {
            fs.mkdirSync(docDir, { recursive: true });
          }

          // Generate description based on symbol analysis
          const description = generateSymbolDescription(symbol);
          const usage = generateUsageExample(symbol);

          // Create initial doc content
          const initialContent = `---
title: ${symbol.name}
symbols:
  - ${symbol.name}
lastUpdated: ${new Date().toISOString().slice(0, 10)}
---

# ${symbol.name}

> ${symbol.name} (${symbol.kind} in ${path.relative(process.cwd(), symbol.file)}).

## Description

${description}

## Usage

${usage}
`;

          fs.writeFileSync(fullDocPath, initialContent, "utf-8");

          // Register the mapping
          await registry.register({
            symbolName: symbol.name,
            docPath,
          });

          createdDocs++;
          console.log(`   ✅ Criado: ${symbol.name} -> ${docPath}`);
        } else {
          console.log(`   ⏭️  Já documentado: ${symbol.name}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Erro ao processar ${filePath}:`, error);
    }
  }

  db.close();

  console.log(`\n🎉 Geração completa finalizada!`);
  console.log(`📊 Estatísticas:`);
  console.log(`   - Arquivos processados: ${tsFiles.length}`);
  console.log(`   - Símbolos encontrados: ${totalSymbols}`);
  console.log(`   - Documentações criadas: ${createdDocs}`);
}

function generateSymbolDescription(symbol: CodeSymbol): string {
  switch (symbol.kind) {
    case "interface":
      return `Interface that defines the structure for ${symbol.name}. It includes properties and methods that implementing classes must provide.`;
    case "class":
      return `Class implementation for ${symbol.name}. ${symbol.signature || ""}`;
    case "function":
      return `Function that ${symbol.signature ? `has the signature: \`${symbol.signature}\`` : "performs a specific operation"}.`;
    case "method":
      return `Method ${symbol.signature ? `with signature: \`${symbol.signature}\`` : ""} that belongs to a class or interface.`;
    case "enum":
      return `Enumeration that defines a set of named constants for ${symbol.name}.`;
    case "type":
      return `Type alias that provides an alternative name for ${symbol.name}.`;
    default:
      return `Code symbol of type ${symbol.kind}.`;
  }
}

function generateUsageExample(symbol: CodeSymbol): string {
  switch (symbol.kind) {
    case "interface":
      return `Implement this interface in classes that need to conform to the ${symbol.name} contract:

\`\`\`typescript
class MyClass implements ${symbol.name} {
  // Implement required properties and methods
}
\`\`\``;
    case "class":
      return `Create instances of this class:

\`\`\`typescript
const instance = new ${symbol.name}();
// Use the instance methods and properties
\`\`\``;
    case "function":
      return `Call this function:

\`\`\`typescript
const result = ${symbol.name}();
// Use the result
\`\`\``;
    case "enum":
      return `Use enum values:

\`\`\`typescript
const value = ${symbol.name}.SomeValue;
// Use the enum value
\`\`\``;
    default:
      return `TODO: Add usage examples here.`;
  }
}

main().catch((err) => {
  console.error("Erro geral:", err);
  process.exit(1);
});
