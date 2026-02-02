---
title: Analyzer - Análise de Mudanças
module: analyzer
lastUpdated: 2026-02-01
symbols:
  - analyzeChanges
  - parseGitDiff
  - computeAstDiff
---

# Analyzer - Análise Semântica de Mudanças

> O módulo Analyzer detecta mudanças **semânticas** no código através da comparação de ASTs, indo além de simples diffs textuais.

## Visão Geral

O Analyzer (`src/analyzer/`) é responsável por:

1. **Parsear git diffs** entre branches
2. **Comparar ASTs** (Abstract Syntax Trees) para detectar mudanças semânticas
3. **Identificar símbolos afetados** com contexto preciso
4. **Gerar ChangeImpacts** para atualização de documentação

## Arquitetura

```typescript
analyzeChanges()
  ↓
parseGitDiff() → FileDiff[]
  ↓
computeAstDiff() → AstDiff
  ↓
ChangeImpact[] (symbols + change types)
```

## Componentes

### 1. Git Diff Parser (`gitDiff.ts`)

Parseia output do `git diff` entre duas refs.

**Função principal:**
```typescript
function parseGitDiff(diffOutput: string): FileDiff[]
```

**Tipos:**
```typescript
interface FileDiff {
  file: string;           // Path relativo
  changeType: "added" | "modified" | "deleted" | "renamed";
  oldFile?: string;       // Para renamed
  hunks: DiffHunk[];      // Blocos de mudanças
}

interface DiffHunk {
  oldStart: number;       // Linha inicial no arquivo antigo
  oldLines: number;       // Quantidade de linhas antigas
  newStart: number;       // Linha inicial no arquivo novo
  newLines: number;       // Quantidade de linhas novas
  lines: DiffLine[];      // Linhas modificadas
}

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
}
```

**Exemplo de parsing:**
```diff
diff --git a/src/order.ts b/src/order.ts
index abc123..def456 100644
--- a/src/order.ts
+++ b/src/order.ts
@@ -10,7 +10,8 @@ export class OrderService {
-  async createOrder(data: OrderData) {
+  async createOrder(data: OrderData, options?: CreateOptions) {
+    // Nova lógica
```

Resulta em:
```typescript
{
  file: "src/order.ts",
  changeType: "modified",
  hunks: [{
    oldStart: 10,
    oldLines: 7,
    newStart: 10,
    newLines: 8,
    lines: [
      { type: "remove", content: "  async createOrder(data: OrderData) {", oldLine: 11 },
      { type: "add", content: "  async createOrder(data: OrderData, options?: CreateOptions) {", newLine: 11 },
      { type: "add", content: "    // Nova lógica", newLine: 12 }
    ]
  }]
}
```

**Casos suportados:**
- Arquivos novos (`changeType: "added"`)
- Arquivos deletados (`changeType: "deleted"`)
- Arquivos modificados (`changeType: "modified"`)
- Arquivos renomeados (`changeType: "renamed"`)
- Binary files (ignored)

### 2. AST Diff Computer (`astDiff.ts`)

Compara ASTs de versões antigas e novas do código para detectar mudanças **semânticas**.

**Função principal:**
```typescript
function computeAstDiff(params: {
  oldSource: string;
  newSource: string;
  filePath: string;
  parser: Parser;
}): AstDiff
```

**Tipo de retorno:**
```typescript
interface AstDiff {
  changedSymbols: ChangedSymbol[];
}

interface ChangedSymbol {
  name: string;
  kind: SymbolKind;
  changeType: "added" | "removed" | "signature_changed" | "body_changed";
  oldSignature?: string;
  newSignature?: string;
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
}
```

**Algoritmo:**

1. **Parse both versions:**
   ```typescript
   const oldTree = parser.parse(oldSource);
   const newTree = parser.parse(newSource);
   ```

2. **Extract symbols from both trees:**
   ```typescript
   const oldSymbols = indexFile(filePath, oldSource, parser);
   const newSymbols = indexFile(filePath, newSource, parser);
   ```

3. **Compare symbols by name+kind:**
   ```typescript
   const oldMap = new Map(oldSymbols.map(s => [`${s.name}:${s.kind}`, s]));
   const newMap = new Map(newSymbols.map(s => [`${s.name}:${s.kind}`, s]));
   ```

4. **Detect adds/removes:**
   ```typescript
   for (const [key, sym] of newMap) {
     if (!oldMap.has(key)) {
       changedSymbols.push({ ...sym, changeType: "added" });
     }
   }

   for (const [key, sym] of oldMap) {
     if (!newMap.has(key)) {
       changedSymbols.push({ ...sym, changeType: "removed" });
     }
   }
   ```

5. **Detect signature/body changes:**
   ```typescript
   for (const [key, newSym] of newMap) {
     const oldSym = oldMap.get(key);
     if (oldSym) {
       if (oldSym.signature !== newSym.signature) {
         changedSymbols.push({
           ...newSym,
           changeType: "signature_changed",
           oldSignature: oldSym.signature,
           newSignature: newSym.signature
         });
       } else if (/* body hash differs */) {
         changedSymbols.push({
           ...newSym,
           changeType: "body_changed"
         });
       }
     }
   }
   ```

**Vantagens sobre diff textual:**
- Ignora mudanças cosméticas (whitespace, comments)
- Detecta mudanças semânticas precisas
- Identifica symbols afetados com linha exata
- Diferencia mudança de assinatura vs implementação

### 3. Change Analyzer (`changeAnalyzer.ts`)

Orquestra o processo completo de análise.

**Função principal:**
```typescript
async function analyzeChanges(params: {
  repoPath: string;
  base: string;
  head?: string;
}): Promise<ChangeImpact[]>
```

**Tipo de retorno:**
```typescript
interface ChangeImpact {
  symbolName: string;
  symbolKind: SymbolKind;
  file: string;
  changeType: "added" | "removed" | "signature_changed" | "body_changed";
  oldSignature?: string;
  newSignature?: string;
  location: {
    startLine: number;
    endLine: number;
  };
  description: string;  // Human-readable description
}
```

**Fluxo completo:**

```typescript
async function analyzeChanges({ repoPath, base, head }) {
  // 1. Get git diff
  const { stdout } = await execAsync(
    `git diff ${base}${head ? ` ${head}` : ""} --unified=0`,
    { cwd: repoPath }
  );

  // 2. Parse diff
  const fileDiffs = parseGitDiff(stdout);

  // 3. Para cada arquivo modificado
  const allImpacts: ChangeImpact[] = [];

  for (const fileDiff of fileDiffs) {
    if (fileDiff.changeType === "deleted") {
      // Símbolos foram removidos
      const oldSource = await getFileContent(base, fileDiff.file);
      const oldSymbols = indexFile(fileDiff.file, oldSource, parser);

      allImpacts.push(...oldSymbols.map(s => ({
        symbolName: s.name,
        symbolKind: s.kind,
        file: fileDiff.file,
        changeType: "removed" as const,
        location: { startLine: s.startLine, endLine: s.endLine },
        description: `Symbol ${s.name} was removed`
      })));

    } else if (fileDiff.changeType === "added") {
      // Símbolos foram adicionados
      const newSource = await getFileContent(head || "HEAD", fileDiff.file);
      const newSymbols = indexFile(fileDiff.file, newSource, parser);

      allImpacts.push(...newSymbols.map(s => ({
        symbolName: s.name,
        symbolKind: s.kind,
        file: fileDiff.file,
        changeType: "added" as const,
        location: { startLine: s.startLine, endLine: s.endLine },
        description: `Symbol ${s.name} was added`
      })));

    } else if (fileDiff.changeType === "modified") {
      // Compara ASTs
      const oldSource = await getFileContent(base, fileDiff.file);
      const newSource = await getFileContent(head || "HEAD", fileDiff.file);

      const astDiff = computeAstDiff({
        oldSource,
        newSource,
        filePath: fileDiff.file,
        parser
      });

      allImpacts.push(...astDiff.changedSymbols.map(cs => ({
        symbolName: cs.name,
        symbolKind: cs.kind,
        file: cs.location.file,
        changeType: cs.changeType,
        oldSignature: cs.oldSignature,
        newSignature: cs.newSignature,
        location: cs.location,
        description: formatDescription(cs)
      })));
    }
  }

  return allImpacts;
}
```

**Helper: `getFileContent(ref, file)`**
```typescript
async function getFileContent(ref: string, file: string): Promise<string> {
  const { stdout } = await execAsync(`git show ${ref}:${file}`);
  return stdout;
}
```

**Helper: `formatDescription(cs)`**
```typescript
function formatDescription(cs: ChangedSymbol): string {
  switch (cs.changeType) {
    case "added":
      return `Symbol ${cs.name} (${cs.kind}) was added`;
    case "removed":
      return `Symbol ${cs.name} (${cs.kind}) was removed`;
    case "signature_changed":
      return `Signature of ${cs.name} changed from "${cs.oldSignature}" to "${cs.newSignature}"`;
    case "body_changed":
      return `Implementation of ${cs.name} was modified`;
  }
}
```

## Casos de Uso

### 1. Doc Updates no CI/CD

```bash
# No PR build
docs-kit generate-docs --base main --head $PR_BRANCH
```

Atualiza automaticamente docs para símbolos modificados.

### 2. Code Review Automation

```typescript
const impacts = await analyzeChanges({
  repoPath: ".",
  base: "main",
  head: "feature/new-api"
});

// Identifica breaking changes
const breakingChanges = impacts.filter(i =>
  i.changeType === "signature_changed" ||
  i.changeType === "removed"
);

if (breakingChanges.length > 0) {
  console.warn("⚠️  Breaking changes detected:");
  for (const bc of breakingChanges) {
    console.warn(`  - ${bc.description}`);
  }
}
```

### 3. Impact Analysis

```typescript
// Quais símbolos foram afetados por este commit?
const impacts = await analyzeChanges({
  repoPath: ".",
  base: "HEAD~1",
  head: "HEAD"
});

console.log(`${impacts.length} symbols affected by this commit`);
```

## Limitações e Melhorias Futuras

**Limitações atuais:**
- Suporta apenas TypeScript (via Tree-sitter-typescript)
- Não detecta mudanças em comments/JSDoc
- Não rastreia renomeações de símbolos

**Melhorias planejadas:**
- [ ] Multi-language support (PHP, Python, Go)
- [ ] Detect symbol renames (via heuristics)
- [ ] Track comment changes for re-doc
- [ ] Parallel processing de arquivos
- [ ] Cache de ASTs para performance

## Performance

**Otimizações:**
- Usa `--unified=0` no git diff para reduzir output
- Parseia apenas arquivos modificados
- Index symbols é incremental (reusa cache)

**Benchmarks (exemplo):**
- 100 arquivos modificados: ~5s
- 1000 arquivos: ~45s
- Bottleneck: `git show` I/O

## Testing

Testes em `tests/changeAnalyzer.test.ts`:

```typescript
describe("analyzeChanges", () => {
  it("detecta adição de símbolo", async () => {
    // Mock git diff output
    // Mock git show output
    const impacts = await analyzeChanges({...});
    expect(impacts).toContainEqual({
      symbolName: "newFunction",
      changeType: "added"
    });
  });

  it("detecta mudança de assinatura", async () => {
    // ...
  });
});
```

## Integração com Doc Updater

O output de `analyzeChanges()` é consumido diretamente pelo `DocUpdater`:

```typescript
const impacts = await analyzeChanges({...});
const updater = createDocUpdater({...});
await updater.applyChanges(impacts, registry, docsDir, config);
```

O `DocUpdater` usa `ChangeImpact[]` para:
1. Localizar docs relacionados via registry
2. Atualizar seções específicas (nunca cria novos arquivos)
3. Preservar contexto existente

## Referências

- [Indexer](./indexer.md) - Extração de símbolos via Tree-sitter
- [Doc Updater](./docs.md#docupdater) - Atualização de documentação
- [Tree-sitter](https://tree-sitter.github.io/) - Parser AST
