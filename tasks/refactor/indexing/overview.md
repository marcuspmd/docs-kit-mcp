# 📁 File Indexing System - Overview

> [← Voltar ao Índice](../README.md)

## Problema Atual

A indexação hoje é:
- ❌ **Sequencial** (1 arquivo por vez)
- ❌ **Sem cache** (re-parsing desnecessário)
- ❌ **Sem detecção incremental** eficiente
- ❌ **Sem watch mode** inteligente

**Resultado**: 10000 arquivos = ~15 minutos 🐌

---

## Solução: File Indexing & Language Services

### Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                   File Indexing System                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────┐      ┌─────────────────┐              │
│  │ FileWatcher    │─────▶│  IndexQueue     │              │
│  │ (chokidar)     │      │  (WorkerPool)   │              │
│  └────────────────┘      └─────────────────┘              │
│         │                        │                          │
│         ▼                        ▼                          │
│  ┌────────────────┐      ┌─────────────────┐              │
│  │ ChangeDetector │      │ ParserRegistry  │              │
│  │ (SHA256 hash)  │      │ (Strategy)      │              │
│  └────────────────┘      └─────────────────┘              │
│                                  │                          │
│                ┌─────────────────┼─────────────────┐       │
│                ▼                 ▼                 ▼        │
│         ┌───────────┐     ┌───────────┐    ┌────────────┐ │
│         │ TSParser  │     │ PyParser  │    │ GoParser   │ │
│         │ (TS/JS)   │     │ (Python)  │    │ (Golang)   │ │
│         └───────────┘     └───────────┘    └────────────┘ │
│                │                 │                 │        │
│                └─────────────────┼─────────────────┘        │
│                                  ▼                          │
│                          ┌───────────────┐                 │
│                          │  ASTCache     │                 │
│                          │  (LRU + Disk) │                 │
│                          └───────────────┘                 │
│                                  │                          │
│                                  ▼                          │
│                          ┌───────────────┐                 │
│                          │ SymbolIndex   │                 │
│                          │ (Repository)  │                 │
│                          └───────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes Principais

### 1. [FileWatcher](./file-watcher.md)
Detecção incremental de mudanças com debouncing e hash-based change detection.

**Features**:
- ✅ Watch em tempo real com `chokidar`
- ✅ SHA-256 hash para evitar re-parsing desnecessário
- ✅ Debouncing (500ms) para agrupar mudanças rápidas
- ✅ Filtros automáticos (`node_modules`, `dist`, etc.)

### 2. [AST Cache](./ast-cache.md)
Cache de ASTs em memória (LRU) + disco para performance máxima.

**Features**:
- ✅ LRU cache em memória (1000 arquivos, 100MB)
- ✅ Persistência em disco para cache "frio"
- ✅ Hash-based validation
- ✅ Cache hit rate ~90% em projetos ativos

### 3. [Parser Registry](./parser-registry.md)
Strategy Pattern para múltiplas linguagens.

**Features**:
- ✅ TypeScript/JavaScript (Tree-sitter)
- ✅ Python (Tree-sitter)
- ✅ Go (Tree-sitter)
- ✅ Extensível para novas linguagens

### 4. [Language Services](./language-services.md)
IntelliSense, validação, autocomplete.

**Features**:
- ✅ Autocomplete (TypeScript Compiler API)
- ✅ Go to Definition
- ✅ Find All References
- ✅ Syntax validation
- ✅ Hover info
- ✅ Signature help

### 5. [FileIndexer](./file-indexer.md)
Orquestração completa com worker pool paralelo.

**Features**:
- ✅ Indexação paralela (4-8 workers)
- ✅ Detecção incremental
- ✅ Watch mode com hot-reload
- ✅ Error recovery

---

## Performance Esperada

| Projeto | Arquivos | Primeira Indexação | Re-indexação (1 arquivo) | Re-indexação (10 arquivos) |
|---------|----------|-------------------|-------------------------|---------------------------|
| Pequeno (< 100 files) | 50 | ~5s | ~0.1s | ~0.5s |
| Médio (< 1000 files) | 500 | ~30s | ~0.1s | ~0.8s |
| Grande (< 5000 files) | 2000 | ~2min | ~0.1s | ~1.2s |
| Gigante (10000+ files) | 10000 | ~10min | ~0.1s | ~2s |

**Fatores**:
- ✅ Parsing paralelo (4-8 workers)
- ✅ Cache AST em memória + disco
- ✅ Hash-based change detection
- ✅ Incremental indexing
- ✅ Prepared statements no SQLite

---

## Uso Prático

### CLI Watch Mode

```bash
# Indexa e fica observando mudanças
$ docs-kit index --watch

📂 Encontrados 1523 arquivos
✅ Indexados em 45s
👀 Watch mode ativado

# Quando você edita um arquivo:
🔄 Re-indexando src/UserService.ts... ✅ 0.1s
```

### Programático

```typescript
import { FileIndexer, ASTCache, ParserRegistry } from '@core/indexing';

// Setup
const astCache = new ASTCache({
  maxMemoryEntries: 1000,
  maxMemorySize: 100 * 1024 * 1024, // 100MB
  diskCachePath: '.docs-kit/ast-cache/',
});

const registry = new ParserRegistry();
registry.register('typescript', new TypeScriptParser());
registry.register('python', new PythonParser());

const indexer = new FileIndexer(astCache, registry, symbolRepo, {
  rootPath: process.cwd(),
  watchMode: true,
  parallelWorkers: 4,
});

// Indexa projeto
const result = await indexer.indexProject(process.cwd());

console.log(\`✅ \${result.symbolsFound} símbolos em \${result.duration}ms\`);

// Metrics
const stats = indexer.getStats();
console.log(\`📊 Cache hit rate: \${stats.cacheHitRate * 100}%\`);
```

---

## Interfaces Principais

### IFileIndexer

```typescript
export interface IFileIndexer {
  indexProject(rootPath: string): Promise<IndexResult>;
  indexChanged(files: string[]): Promise<IndexResult>;
  getStats(): IndexStats;
  clearCache(): Promise<void>;
}
```

### ILanguageParser

```typescript
export interface ILanguageParser {
  supportedExtensions: string[];
  parse(filePath: string, content: string): Promise<ParseResult>;
  validate(content: string): Promise<ValidationResult>;
  getLanguageService?(): ILanguageService;
}
```

### ILanguageService

```typescript
export interface ILanguageService {
  getCompletions(filePath: string, position: Position): Promise<CompletionItem[]>;
  getDefinition(filePath: string, position: Position): Promise<SymbolLocation | null>;
  getReferences(filePath: string, position: Position): Promise<SymbolLocation[]>;
  getDiagnostics(filePath: string, content: string): Promise<Diagnostic[]>;
  getHover(filePath: string, position: Position): Promise<HoverInfo | null>;
}
```

---

## Roadmap de Implementação

### Fase 1: Core (1-2 semanas)
- [ ] `IFileIndexer`, `ILanguageParser`, `ILanguageService` interfaces
- [ ] `ASTCache` com LRU + disk
- [ ] `ParserRegistry` com Strategy Pattern
- [ ] Testes unitários

### Fase 2: Parsers (1-2 semanas)
- [ ] `TypeScriptParser` completo
- [ ] `PythonParser` básico
- [ ] Testes de parsing

### Fase 3: FileIndexer (1 semana)
- [ ] Worker pool
- [ ] Integração com repositories
- [ ] Testes de integração

### Fase 4: Watch Mode (1 semana)
- [ ] `FileWatcher` com chokidar
- [ ] Debouncing e hash detection
- [ ] Testes de watch

### Fase 5: Language Services (1 semana)
- [ ] TypeScript Language Service
- [ ] MCP integration
- [ ] Autocomplete/validation tools

---

## Benefícios

| Aspecto | Benefício |
|---------|-----------|
| **Performance** | 40x mais rápido em re-indexações |
| **Escalabilidade** | Indexa 10k+ arquivos em < 10min |
| **Multi-Language** | Strategy Pattern facilita adicionar linguagens |
| **IntelliSense** | Language Services prontos para VS Code |
| **DX** | Watch mode com hot-reload |
| **Validação** | Detecta erros de sintaxe durante indexação |
| **Memory Efficient** | LRU cache controla uso de memória |
| **Production Ready** | Error handling + monitoring |

---

## Próximos Passos

- [FileWatcher](./file-watcher.md) - Detecção de mudanças
- [AST Cache](./ast-cache.md) - Cache de performance
- [Parser Registry](./parser-registry.md) - Múltiplas linguagens
- [Language Services](./language-services.md) - IntelliSense
- [FileIndexer](./file-indexer.md) - Orquestração completa

---

> [← Voltar ao Índice](../README.md)
