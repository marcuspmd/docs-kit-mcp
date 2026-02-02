---
title: Indexer - Extração de Símbolos via AST
module: indexer
lastUpdated: 2026-02-01
symbols:
  - indexFile
  - extractRelationships
  - collectMetrics
  - parseLcov
---

# Indexer - Extração e Análise de Código

> O módulo Indexer extrai símbolos, relacionamentos e métricas do código usando Tree-sitter para parsing AST.

## Visão Geral

O Indexer (`src/indexer/`) é responsável por:

1. **Parsear código fonte** em ASTs (Abstract Syntax Trees)
2. **Extrair símbolos** (classes, funções, métodos, interfaces, etc.)
3. **Detectar relacionamentos** (chamadas, heranças, implementações)
4. **Coletar métricas** (complexidade, cobertura, tamanho)
5. **Suportar múltiplas linguagens** via parsers plugáveis

## Arquitetura

```typescript
indexFile() → CodeSymbol[]
  ↓
extractRelationships() → Relationship[]
  ↓
collectMetrics() → CodeSymbol[] (enriched)
  ↓
parseLcov() → LcovFileData[] (coverage)
```

## Componentes

### 1. Symbol Indexer (`indexer.ts`)

Extrai símbolos do código fonte via Tree-sitter AST.

**Função principal:**
```typescript
function indexFile(
  filePath: string,
  source: string,
  parser: Parser
): CodeSymbol[]
```

**CodeSymbol Type:**
```typescript
interface CodeSymbol {
  id: string;              // SHA256(file + name + kind)
  name: string;            // Nome do símbolo
  kind: SymbolKind;        // Tipo: class, function, method, etc.
  file: string;            // Path relativo
  startLine: number;       // Linha inicial (1-based)
  endLine: number;         // Linha final
  signature?: string;      // Assinatura (para funções/métodos)
  visibility?: "public" | "private" | "protected";
  isExported?: boolean;    // Se é exportado
  isAsync?: boolean;       // Se é assíncrono
  isStatic?: boolean;      // Se é estático
  parentId?: string;       // ID do símbolo pai (para métodos)
  source?: "human" | "ai"; // Origem do código
  lastModified?: Date;     // Última modificação

  // Populated later
  pattern?: string;        // Design pattern detected
  doc_ref?: string;        // Link para documentação
  references?: string[];   // Símbolos que este referencia
  referencedBy?: string[]; // Símbolos que referenciam este

  // Metrics (populated by metricsCollector)
  complexity?: number;     // Cyclomatic complexity
  linesOfCode?: number;    // LOC
  coverage?: number;       // Test coverage 0-100
}
```

**SymbolKind:**
```typescript
type SymbolKind =
  | "class"
  | "interface"
  | "function"
  | "method"
  | "property"
  | "enum"
  | "type"
  | "variable"
  | "dto"          // Data Transfer Object
  | "entity"       // Database entity
  | "event"        // Event emitter
  | "listener"     // Event listener
  | "service"      // Service class
  | "repository"   // Repository class
  | "controller"   // Controller class
  | "middleware"   // Middleware function
  | "guard"        // Guard/validator
  | "decorator"    // Decorator
  | "test";        // Test function/suite
```

**Algoritmo de extração:**

```typescript
function indexFile(filePath: string, source: string, parser: Parser) {
  // 1. Parse source code
  const tree = parser.parse(source);

  // 2. Traverse AST
  const symbols: CodeSymbol[] = [];
  const cursor = tree.walk();

  function visit(node: SyntaxNode) {
    switch (node.type) {
      case "class_declaration":
        symbols.push(extractClass(node, source, filePath));
        break;
      case "function_declaration":
        symbols.push(extractFunction(node, source, filePath));
        break;
      case "method_definition":
        symbols.push(extractMethod(node, source, filePath));
        break;
      case "interface_declaration":
        symbols.push(extractInterface(node, source, filePath));
        break;
      // ... outros tipos
    }

    // Recursively visit children
    for (const child of node.children) {
      visit(child);
    }
  }

  visit(cursor.currentNode());

  // 3. Generate IDs
  for (const sym of symbols) {
    sym.id = generateSymbolId(sym.file, sym.name, sym.kind);
  }

  return symbols;
}
```

**Helper: `extractClass()`**
```typescript
function extractClass(node: SyntaxNode, source: string, file: string): CodeSymbol {
  const nameNode = node.childForFieldName("name");
  const name = source.slice(nameNode.startIndex, nameNode.endIndex);

  const modifiers = node.children
    .filter(c => c.type === "export_statement" || c.type === "abstract_keyword");

  return {
    id: "", // Set later
    name,
    kind: "class",
    file,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    isExported: modifiers.some(m => m.type === "export_statement"),
    visibility: "public"
  };
}
```

**Helper: `extractFunction()`**
```typescript
function extractFunction(node: SyntaxNode, source: string, file: string): CodeSymbol {
  const nameNode = node.childForFieldName("name");
  const name = source.slice(nameNode.startIndex, nameNode.endIndex);

  // Extract signature
  const paramsNode = node.childForFieldName("parameters");
  const returnTypeNode = node.childForFieldName("return_type");

  let signature = name;
  if (paramsNode) {
    signature += source.slice(paramsNode.startIndex, paramsNode.endIndex);
  }
  if (returnTypeNode) {
    signature += ": " + source.slice(returnTypeNode.startIndex, returnTypeNode.endIndex);
  }

  return {
    id: "",
    name,
    kind: "function",
    file,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    signature,
    isExported: hasExportModifier(node),
    isAsync: hasAsyncModifier(node)
  };
}
```

**Symbol ID Generation:**
```typescript
import { createHash } from "crypto";

function generateSymbolId(file: string, name: string, kind: SymbolKind): string {
  const input = `${file}::${name}::${kind}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
```

### 2. Relationship Extractor (`relationshipExtractor.ts`)

Detecta relacionamentos entre símbolos.

**Função principal:**
```typescript
function extractRelationships(params: {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  sources: Map<string, string>;
}): Relationship[]
```

**Relationship Type:**
```typescript
interface Relationship {
  sourceId: string;        // ID do símbolo origem
  targetId: string;        // ID do símbolo destino
  type: RelationshipType;  // Tipo de relacionamento
  location?: {             // Onde ocorre
    file: string;
    line: number;
  };
}

type RelationshipType =
  | "calls"           // Função A chama função B
  | "extends"         // Classe A extends classe B
  | "implements"      // Classe A implements interface B
  | "imports"         // Módulo A importa módulo B
  | "instantiates"    // Função A cria instância de classe B
  | "references"      // Símbolo A referencia símbolo B
  | "contains";       // Classe A contém método B
```

**Algoritmo:**

```typescript
function extractRelationships({ symbols, trees, sources }) {
  const relationships: Relationship[] = [];
  const symbolByName = new Map(symbols.map(s => [s.name, s]));

  for (const [file, tree] of trees) {
    const source = sources.get(file)!;
    const fileSymbols = symbols.filter(s => s.file === file);

    // 1. Detect method calls
    const callNodes = queryNodes(tree, "(call_expression) @call");
    for (const callNode of callNodes) {
      const calleeName = extractCalleeName(callNode, source);
      const target = symbolByName.get(calleeName);

      if (target) {
        // Find which symbol contains this call
        const caller = findContainingSymbol(callNode, fileSymbols);
        if (caller) {
          relationships.push({
            sourceId: caller.id,
            targetId: target.id,
            type: "calls",
            location: {
              file,
              line: callNode.startPosition.row + 1
            }
          });
        }
      }
    }

    // 2. Detect class extensions
    const classNodes = queryNodes(tree, "(class_declaration) @class");
    for (const classNode of classNodes) {
      const extendsNode = classNode.childForFieldName("extends");
      if (extendsNode) {
        const baseClassName = extractTypeName(extendsNode, source);
        const baseClass = symbolByName.get(baseClassName);
        const derivedClass = fileSymbols.find(s =>
          s.kind === "class" &&
          s.startLine === classNode.startPosition.row + 1
        );

        if (baseClass && derivedClass) {
          relationships.push({
            sourceId: derivedClass.id,
            targetId: baseClass.id,
            type: "extends"
          });
        }
      }
    }

    // 3. Detect interface implementations
    const implNodes = queryNodes(tree, "(implements_clause) @impl");
    for (const implNode of implNodes) {
      // Similar logic...
    }

    // 4. Detect imports
    const importNodes = queryNodes(tree, "(import_statement) @import");
    for (const importNode of importNodes) {
      // Track module-level dependencies
      const importedNames = extractImportedNames(importNode, source);
      for (const name of importedNames) {
        const target = symbolByName.get(name);
        if (target) {
          relationships.push({
            sourceId: `module::${file}`,
            targetId: target.id,
            type: "imports"
          });
        }
      }
    }

    // 5. Parent-child relationships (methods in classes)
    for (const sym of fileSymbols) {
      if (sym.kind === "method" && sym.parentId) {
        relationships.push({
          sourceId: sym.parentId,
          targetId: sym.id,
          type: "contains"
        });
      }
    }
  }

  return relationships;
}
```

**Helper: `queryNodes()`**
Tree-sitter query syntax:
```typescript
function queryNodes(tree: Parser.Tree, pattern: string): SyntaxNode[] {
  const query = new Parser.Query(tree.language, pattern);
  const captures = query.captures(tree.rootNode);
  return captures.map(c => c.node);
}
```

### 3. Metrics Collector (`metricsCollector.ts`)

Calcula métricas de qualidade de código.

**Função principal:**
```typescript
function collectMetrics(params: {
  symbols: CodeSymbol[];
  trees: Map<string, Parser.Tree>;
  coverage?: LcovFileData[];
}): CodeSymbol[]
```

**Métricas coletadas:**

**1. Cyclomatic Complexity:**
```typescript
function calculateComplexity(node: SyntaxNode): number {
  let complexity = 1; // Base complexity

  // Add 1 for each branching statement
  const branches = [
    "if_statement",
    "while_statement",
    "for_statement",
    "switch_statement",
    "case_clause",
    "catch_clause",
    "conditional_expression", // ternary
    "logical_expression"      // && ||
  ];

  function visit(n: SyntaxNode) {
    if (branches.includes(n.type)) {
      complexity++;
    }
    for (const child of n.children) {
      visit(child);
    }
  }

  visit(node);
  return complexity;
}
```

**2. Lines of Code:**
```typescript
function calculateLOC(symbol: CodeSymbol): number {
  return symbol.endLine - symbol.startLine + 1;
}
```

**3. Test Coverage (via LCOV):**
```typescript
function enrichWithCoverage(
  symbols: CodeSymbol[],
  coverage: LcovFileData[]
): void {
  const coverageByFile = new Map(coverage.map(c => [c.file, c]));

  for (const sym of symbols) {
    const fileCoverage = coverageByFile.get(sym.file);
    if (!fileCoverage) continue;

    // Calculate coverage for symbol's line range
    const { startLine, endLine } = sym;
    let coveredLines = 0;
    let totalLines = 0;

    for (const line of fileCoverage.lines) {
      if (line.line >= startLine && line.line <= endLine) {
        totalLines++;
        if (line.hit > 0) {
          coveredLines++;
        }
      }
    }

    sym.coverage = totalLines > 0
      ? (coveredLines / totalLines) * 100
      : undefined;
  }
}
```

### 4. LCOV Parser (`lcovCollector.ts`)

Parseia arquivos LCOV de coverage reports.

**Função principal:**
```typescript
function parseLcov(lcovPath: string): Promise<LcovFileData[]>
```

**LcovFileData Type:**
```typescript
interface LcovFileData {
  file: string;           // Source file path
  lines: LcovLineData[];  // Line coverage
  functions: LcovFunctionData[];
  branches: LcovBranchData[];
}

interface LcovLineData {
  line: number;   // Line number
  hit: number;    // Times hit
}

interface LcovFunctionData {
  name: string;
  line: number;
  hit: number;
}

interface LcovBranchData {
  line: number;
  block: number;
  branch: number;
  taken: number;
}
```

**Parsing example:**
```lcov
SF:src/indexer/indexer.ts
FN:10,indexFile
FNDA:5,indexFile
FNF:1
FNH:1
DA:11,5
DA:12,5
DA:13,0
LF:3
LH:2
end_of_record
```

Resulta em:
```typescript
{
  file: "src/indexer/indexer.ts",
  functions: [{ name: "indexFile", line: 10, hit: 5 }],
  lines: [
    { line: 11, hit: 5 },
    { line: 12, hit: 5 },
    { line: 13, hit: 0 }
  ],
  branches: []
}
```

## Language Support

### Current Languages

**TypeScript/JavaScript:**
- Parser: `tree-sitter-typescript`
- Symbols: class, interface, function, method, enum, type
- Relationships: calls, extends, implements, imports

### Adding New Languages

1. **Install parser:**
```bash
npm install tree-sitter-python
```

2. **Create language parser:**
```typescript
// src/indexer/languages/PythonParser.ts
import Python from "tree-sitter-python";

export class PythonParser implements LanguageParser {
  setLanguage(parser: Parser) {
    parser.setLanguage(Python);
  }

  extractSymbols(tree: Parser.Tree, source: string, file: string): CodeSymbol[] {
    // Implement Python-specific extraction
    const symbols: CodeSymbol[] = [];

    // Classes
    const classNodes = queryNodes(tree, "(class_definition) @class");
    for (const node of classNodes) {
      symbols.push(extractPythonClass(node, source, file));
    }

    // Functions
    const funcNodes = queryNodes(tree, "(function_definition) @func");
    for (const node of funcNodes) {
      symbols.push(extractPythonFunction(node, source, file));
    }

    return symbols;
  }
}
```

3. **Register in indexer:**
```typescript
const languageParsers = {
  ".ts": new TypeScriptParser(),
  ".tsx": new TypeScriptParser(),
  ".js": new JavaScriptParser(),
  ".py": new PythonParser(),
  ".php": new PHPParser(),
  // ...
};
```

## Performance

**Otimizações:**
- **Incremental indexing**: File hash tracking evita re-parse
- **Parallel processing**: Future improvement (worker threads)
- **Query caching**: Tree-sitter queries são compiladas uma vez

**Benchmarks:**
- 1000 arquivos TS: ~30s indexing
- 10000 símbolos: ~2s relationship extraction
- Bottleneck: I/O (read files)

## Testing

Testes em `tests/indexer/`:

```typescript
describe("indexFile", () => {
  it("extrai classes", () => {
    const source = "export class Foo {}";
    const symbols = indexFile("test.ts", source, parser);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({
      name: "Foo",
      kind: "class",
      isExported: true
    });
  });

  it("extrai funções async", () => {
    const source = "export async function bar() {}";
    const symbols = indexFile("test.ts", source, parser);
    expect(symbols[0].isAsync).toBe(true);
  });
});
```

## Integration

O Indexer é usado por:
- **CLI** (`docs-kit index`): Indexação bulk
- **Analyzer**: Comparação de ASTs
- **Doc Scanner**: Find undocumented symbols
- **Pattern Analyzer**: Detect design patterns

## Referências

- [Tree-sitter](https://tree-sitter.github.io/)
- [Tree-sitter TypeScript](https://github.com/tree-sitter/tree-sitter-typescript)
- [LCOV format](http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php)
- [Symbol Types](../domain/symbol-types.md)
