---
title: Docs - Gestão de Documentação
module: docs
lastUpdated: 2026-02-01
symbols:
  - createDocRegistry
  - createDocUpdater
  - scanFileAndCreateDocs
  - createCodeExampleValidator
---

# Docs - Gestão Inteligente de Documentação

> O módulo Docs gerencia o ciclo de vida da documentação: registro, atualização automática, validação e geração.

## Visão Geral

O módulo Docs (`src/docs/`) fornece:

1. **Doc Registry**: Mapeamento símbolo ↔ documentação
2. **Doc Updater**: Atualização cirúrgica de seções
3. **Doc Scanner**: Detecção de símbolos sem docs
4. **Code Example Validator**: Validação de exemplos de código
5. **Mermaid Generator**: Geração de diagramas
6. **Frontmatter Parser**: Extração de metadados

## Arquitetura

```typescript
DocRegistry
  ↓
frontmatter.parse() → { symbols: string[], ... }
  ↓
DocUpdater.applyChanges() → surgical updates
  ↓
CodeExampleValidator.validateAll() → ValidationResult[]
```

## Componentes

### 1. Doc Registry (`docRegistry.ts`)

Gerencia mapeamento bidirecional entre símbolos e documentação.

**Criação:**
```typescript
function createDocRegistry(db: Database): DocRegistry
```

**Interface:**
```typescript
interface DocRegistry {
  // Rebuild index from docs directory
  rebuild(docsDir: string, options?: { configDocs?: DocConfig }): Promise<void>;

  // Register symbol-doc mapping
  register(mapping: { symbolName: string; docPath: string }): Promise<void>;

  // Find docs for symbol
  findDocBySymbol(symbolName: string): Promise<DocMapping[]>;

  // Find symbols in doc
  findSymbolsByDoc(docPath: string): Promise<DocMapping[]>;

  // Get all registered docs
  findAllDocs(): DocMetadata[];

  // Get all mappings
  findAllMappings(): Promise<DocMapping[]>;
}

interface DocMapping {
  symbolName: string;
  docPath: string;
}

interface DocMetadata {
  path: string;
  title?: string;
  symbols: string[];
  lastUpdated?: string;
  tags?: string[];
}
```

**Rebuild Process:**
```typescript
async rebuild(docsDir: string) {
  // 1. Clear existing mappings
  db.prepare("DELETE FROM doc_mappings").run();
  db.prepare("DELETE FROM doc_metadata").run();

  // 2. Scan all markdown files
  const mdFiles = await fg("**/*.md", { cwd: docsDir });

  // 3. Extract frontmatter and symbols
  for (const file of mdFiles) {
    const content = await fs.readFile(path.join(docsDir, file), "utf-8");
    const parsed = parseFrontmatter(content);

    // Store metadata
    db.prepare(`
      INSERT INTO doc_metadata (path, title, symbols, last_updated, tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      file,
      parsed.metadata.title,
      JSON.stringify(parsed.metadata.symbols || []),
      parsed.metadata.lastUpdated,
      JSON.stringify(parsed.metadata.tags || [])
    );

    // Create mappings
    for (const symbol of parsed.metadata.symbols || []) {
      await this.register({ symbolName: symbol, docPath: file });
    }
  }
}
```

**Usage:**
```typescript
const registry = createDocRegistry(db);
await registry.rebuild("docs");

// Find docs for symbol
const docs = await registry.findDocBySymbol("OrderService");
// => [{ symbolName: "OrderService", docPath: "domain/order-service.md" }]

// Find symbols in doc
const symbols = await registry.findSymbolsByDoc("domain/order-service.md");
// => [{ symbolName: "OrderService", docPath: "..." }, ...]
```

### 2. Frontmatter Parser (`frontmatter.ts`)

Extrai metadados YAML de arquivos Markdown.

**Função:**
```typescript
function parseFrontmatter(content: string): {
  metadata: Record<string, any>;
  body: string;
}
```

**Exemplo:**
```markdown
---
title: Order Service
symbols:
  - OrderService
  - createOrder
  - cancelOrder
lastUpdated: 2024-01-15
tags: [domain, orders]
---

# Order Service

Implementation details...
```

Resulta em:
```typescript
{
  metadata: {
    title: "Order Service",
    symbols: ["OrderService", "createOrder", "cancelOrder"],
    lastUpdated: "2024-01-15",
    tags: ["domain", "orders"]
  },
  body: "# Order Service\n\nImplementation details..."
}
```

**Section Extraction:**
```typescript
function extractSections(body: string): Section[] {
  const sections: Section[] = [];
  const lines = body.split("\n");
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect heading
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        level: match[1].length,
        title: match[2],
        startLine: i + 1,
        endLine: -1,
        content: ""
      };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection) {
    currentSection.endLine = lines.length;
    sections.push(currentSection);
  }

  return sections;
}
```

### 3. Doc Updater (`docUpdater.ts`)

Atualiza documentação de forma cirúrgica (section-level updates).

**Criação:**
```typescript
function createDocUpdater(options: {
  dryRun?: boolean;
  llm?: LlmProvider;
}): DocUpdater
```

**Interface:**
```typescript
interface DocUpdater {
  applyChanges(
    impacts: ChangeImpact[],
    registry: DocRegistry,
    docsDir: string,
    config: Config
  ): Promise<UpdateResult[]>;
}

interface UpdateResult {
  symbolName: string;
  docPath: string;
  action: "updated" | "skipped" | "error";
  reason?: string;
}
```

**Update Flow:**
```typescript
async applyChanges(impacts, registry, docsDir, config) {
  const results: UpdateResult[] = [];

  for (const impact of impacts) {
    // 1. Find docs for symbol
    const docs = await registry.findDocBySymbol(impact.symbolName);

    if (docs.length === 0) {
      results.push({
        symbolName: impact.symbolName,
        docPath: "",
        action: "skipped",
        reason: "No doc found"
      });
      continue;
    }

    // 2. For each doc
    for (const doc of docs) {
      const docPath = path.join(docsDir, doc.docPath);
      const content = await fs.readFile(docPath, "utf-8");
      const { metadata, body } = parseFrontmatter(content);

      // 3. Extract sections
      const sections = extractSections(body);

      // 4. Find section for symbol
      const targetSection = sections.find(s =>
        s.title.includes(impact.symbolName)
      );

      if (!targetSection) {
        results.push({
          symbolName: impact.symbolName,
          docPath: doc.docPath,
          action: "skipped",
          reason: "Section not found"
        });
        continue;
      }

      // 5. Generate updated content
      const updatedContent = await this.generateUpdate(
        impact,
        targetSection,
        config
      );

      // 6. Replace section
      const newBody = replaceSection(body, targetSection, updatedContent);

      // 7. Write back (unless dry-run)
      if (!this.options.dryRun) {
        const newContent = `---\n${stringifyFrontmatter(metadata)}\n---\n\n${newBody}`;
        await fs.writeFile(docPath, newContent, "utf-8");
      }

      results.push({
        symbolName: impact.symbolName,
        docPath: doc.docPath,
        action: "updated"
      });
    }
  }

  return results;
}
```

**Generate Update (with LLM):**
```typescript
async generateUpdate(
  impact: ChangeImpact,
  section: Section,
  config: Config
): Promise<string> {
  if (!this.options.llm) {
    // Fallback: template-based
    return this.generateTemplateUpdate(impact, section);
  }

  // Use LLM for intelligent update
  const prompt = `
You are updating documentation for a code symbol that changed.

Symbol: ${impact.symbolName} (${impact.symbolKind})
Change: ${impact.changeType}
${impact.oldSignature ? `Old signature: ${impact.oldSignature}` : ""}
${impact.newSignature ? `New signature: ${impact.newSignature}` : ""}

Current documentation section:
---
${section.content}
---

Generate an updated version of this section that reflects the changes.
Preserve existing examples and context where relevant.
Keep the same heading level and style.
`;

  const response = await this.options.llm.chat([
    { role: "user", content: prompt }
  ]);

  return response || section.content;
}
```

**Section Replacement:**
```typescript
function replaceSection(body: string, section: Section, newContent: string): string {
  const lines = body.split("\n");

  // Find section boundaries
  const startIdx = section.startLine - 1;
  const endIdx = section.endLine;

  // Replace content
  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx);

  return [
    ...before,
    `${"#".repeat(section.level)} ${section.title}`,
    "",
    newContent,
    ...after
  ].join("\n");
}
```

### 4. Doc Scanner (`docScanner.ts`)

Detecta símbolos sem documentação e cria stubs.

**Função:**
```typescript
async function scanFileAndCreateDocs(params: {
  filePath: string;
  docsDir: string;
  projectRoot: string;
  symbols: CodeSymbol[];
  registry: DocRegistry;
}): Promise<{
  createdCount: number;
  createdSymbols: string[];
}>
```

**Fluxo:**
```typescript
async function scanFileAndCreateDocs({ filePath, docsDir, symbols, registry }) {
  const created: string[] = [];

  for (const symbol of symbols) {
    // Check if already documented
    const docs = await registry.findDocBySymbol(symbol.name);

    if (docs.length > 0) {
      continue; // Already documented
    }

    // Generate doc path
    const docPath = `domain/${symbol.name}.md`;
    const fullPath = path.join(docsDir, docPath);

    // Create directory if needed
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Generate initial content
    const content = generateDocStub(symbol, filePath);

    // Write file
    await fs.writeFile(fullPath, content, "utf-8");

    // Register mapping
    await registry.register({
      symbolName: symbol.name,
      docPath
    });

    created.push(symbol.name);
  }

  return {
    createdCount: created.length,
    createdSymbols: created
  };
}
```

**Doc Stub Generation:**
```typescript
function generateDocStub(symbol: CodeSymbol, filePath: string): string {
  const relPath = path.relative(process.cwd(), filePath);

  return `---
title: ${symbol.name}
symbols:
  - ${symbol.name}
lastUpdated: ${new Date().toISOString().slice(0, 10)}
---

# ${symbol.name}

> ${symbol.name} (${symbol.kind} in ${relPath}).

## Description

TODO: Add description for ${symbol.name}

${symbol.signature ? `\n## Signature\n\n\`\`\`typescript\n${symbol.signature}\n\`\`\`\n` : ""}

## Usage

\`\`\`typescript
// TODO: Add usage example
\`\`\`

## Notes

- TODO: Add implementation notes
${symbol.complexity ? `- Complexity: ${symbol.complexity}` : ""}
${symbol.coverage !== undefined ? `- Test coverage: ${symbol.coverage.toFixed(1)}%` : ""}
`;
}
```

### 5. Code Example Validator (`codeExampleValidator.ts`)

Valida exemplos de código na documentação contra código real.

**Criação:**
```typescript
function createCodeExampleValidator(): CodeExampleValidator
```

**Interface:**
```typescript
interface CodeExampleValidator {
  validateAll(docsDir: string): Promise<ValidationResult[]>;
  validateDoc(docPath: string): Promise<ValidationResult[]>;
}

interface ValidationResult {
  docPath: string;
  example: CodeExample;
  valid: boolean;
  error?: string;
}

interface CodeExample {
  language: string;
  code: string;
  lineStart: number;
  lineEnd: number;
}
```

**Validation Flow:**
```typescript
async validateAll(docsDir: string) {
  const results: ValidationResult[] = [];
  const mdFiles = await fg("**/*.md", { cwd: docsDir });

  for (const file of mdFiles) {
    const docResults = await this.validateDoc(path.join(docsDir, file));
    results.push(...docResults);
  }

  return results;
}

async validateDoc(docPath: string) {
  const content = await fs.readFile(docPath, "utf-8");
  const examples = extractCodeExamples(content);
  const results: ValidationResult[] = [];

  for (const example of examples) {
    // Get validator for language
    const validator = this.getValidator(example.language);

    if (!validator) {
      results.push({
        docPath,
        example,
        valid: false,
        error: `No validator for language: ${example.language}`
      });
      continue;
    }

    // Validate
    try {
      const valid = await validator.validate(example.code);
      results.push({ docPath, example, valid });
    } catch (err) {
      results.push({
        docPath,
        example,
        valid: false,
        error: err.message
      });
    }
  }

  return results;
}
```

**Validators (Strategy Pattern):**
```typescript
// src/docs/strategies/TypeScriptValidator.ts
export class TypeScriptValidator implements ValidatorStrategy {
  async validate(code: string): Promise<boolean> {
    // Use TypeScript compiler API
    const result = ts.transpileModule(code, {
      compilerOptions: {
        noEmit: true,
        skipLibCheck: true
      }
    });

    return result.diagnostics?.length === 0;
  }
}

// Similar for: JavaScriptValidator, PythonValidator, PHPValidator, etc.
```

### 6. Mermaid Generator (`mermaidGenerator.ts`)

Gera diagramas Mermaid a partir de símbolos.

**Função:**
```typescript
function generateMermaid(
  params: {
    symbols: string[];
    type: "classDiagram" | "sequenceDiagram" | "flowchart";
  },
  allSymbols: CodeSymbol[],
  allRelationships: SymbolRelationship[]
): string
```

**Class Diagram:**
```typescript
function generateClassDiagram(symbols: CodeSymbol[], rels: SymbolRelationship[]): string {
  let diagram = "classDiagram\n";

  for (const sym of symbols.filter(s => s.kind === "class" || s.kind === "interface")) {
    // Add class
    diagram += `  class ${sym.name}\n`;

    // Add methods
    const methods = symbols.filter(s =>
      s.kind === "method" && s.parentId === sym.id
    );
    for (const method of methods) {
      const visibility = method.visibility === "private" ? "-" : "+";
      diagram += `  ${sym.name} : ${visibility}${method.name}()\n`;
    }
  }

  // Add relationships
  for (const rel of rels) {
    const source = symbols.find(s => s.id === rel.sourceId);
    const target = symbols.find(s => s.id === rel.targetId);

    if (source && target) {
      if (rel.type === "extends") {
        diagram += `  ${target.name} <|-- ${source.name}\n`;
      } else if (rel.type === "implements") {
        diagram += `  ${target.name} <|.. ${source.name}\n`;
      } else if (rel.type === "calls") {
        diagram += `  ${source.name} --> ${target.name} : calls\n`;
      }
    }
  }

  return diagram;
}
```

**Sequence Diagram:**
```typescript
function generateSequenceDiagram(symbols: CodeSymbol[], rels: SymbolRelationship[]): string {
  let diagram = "sequenceDiagram\n";

  // Find entry point (usually exported functions)
  const entryPoints = symbols.filter(s => s.isExported && s.kind === "function");

  for (const entry of entryPoints) {
    diagram += `  User->>+${entry.name}: call\n`;

    // Trace calls
    const calls = rels.filter(r => r.sourceId === entry.id && r.type === "calls");
    for (const call of calls) {
      const target = symbols.find(s => s.id === call.targetId);
      if (target) {
        diagram += `  ${entry.name}->>+${target.name}: invoke\n`;
        diagram += `  ${target.name}-->>-${entry.name}: return\n`;
      }
    }

    diagram += `  ${entry.name}-->>-User: result\n`;
  }

  return diagram;
}
```

## Auto-Discovery

O módulo também suporta auto-discovery de documentação:

```typescript
// src/docs/autoDiscovery.ts
async function discoverDocs(params: {
  projectRoot: string;
  docsDir: string;
}): Promise<DiscoveryResult> {
  // 1. Scan for common doc patterns
  const patterns = [
    "docs/**/*.md",
    "README*.md",
    "ARCHITECTURE.md",
    "CONTRIBUTING.md"
  ];

  // 2. Extract symbols from frontmatter
  // 3. Infer relationships from file structure
  // 4. Detect orphan docs (docs without symbols)

  return {
    registered: [...],
    orphans: [...],
    suggestions: [...]
  };
}
```

## Best Practices

**Frontmatter:**
- Sempre incluir `symbols` array
- Usar `lastUpdated` para tracking
- Tags para categorização

**Section Structure:**
- Heading nível 2 (`##`) para símbolos principais
- Manter uma seção por símbolo
- Incluir exemplos de uso

**Updates:**
- Prefer surgical updates over full regeneration
- Preserve user-written content
- Use LLM for context-aware updates

## Referências

- [Doc Registry Schema](../domain/docs-registry.md)
- [Frontmatter Spec](../examples/frontmatter.md)
- [Mermaid Syntax](https://mermaid.js.org/)
