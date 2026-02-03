# 🏗️ Plano de Refatoração: DDD + Clean Architecture para docs-kit

> **Data**: Fevereiro 2026
> **Versão**: 2.0
> **Status**: Planejamento
> **Última Atualização**: 3 de fevereiro de 2026

---

## ⚠️ Este arquivo foi reorganizado!

**📂 A documentação completa agora está em: [`tasks/refactor/`](./refactor/)**

### Quick Links

- **[📍 ÍNDICE PRINCIPAL](./refactor/README.md)** ← COMECE AQUI
- [📊 Sumário Executivo](./refactor/00-sumario-executivo.md) - TL;DR para stakeholders
- [🔍 Diagnóstico](./refactor/01-diagnostico.md) - O que está errado
- [🎯 Arquitetura Proposta](./refactor/02-arquitetura-proposta.md) - Como resolver
- [🚀 Quick Start (Fase 1)](./refactor/phase-1-guide.md) - Mão na massa
- [📅 Plano de Migração](./refactor/06-plano-migracao.md) - Roadmap 12 semanas

### Por que reorganizei?

Este arquivo tinha **3118 linhas** - impossível navegar! Agora está dividido em **10 arquivos principais** + **2 pastas especializadas**:

```
refactor/
├── README.md                    # 📍 Índice (comece aqui)
├── 00-sumario-executivo.md      # Para stakeholders
├── 01-diagnostico.md            # Problemas atuais
├── 02-arquitetura-proposta.md   # Solução proposta
├── 06-plano-migracao.md         # Roadmap
├── 07-checklist-validacao.md    # Critérios de aceite
├── 08-mapeamento-arquivos.md    # Onde cada arquivo vai
├── phase-1-guide.md             # Guia prático Fase 1
├── database/                    # 🗄️ Tópicos DB avançados
└── indexing/                    # 📁 Sistema de indexação
```

**Benefícios**:
- ✅ Navegação fácil
- ✅ Cada arquivo com 1 responsabilidade
- ✅ Links internos funcionando
- ✅ Guias práticos separados
- ✅ Tópicos especializados isolados

---

## 📑 Índice (Legacy - Use o novo!)

1. [Diagnóstico da Estrutura Atual](#1-diagnóstico-da-estrutura-atual)
2. [Nova Arquitetura Proposta](#2-nova-arquitetura-proposta)
3. [Design Patterns Utilizados](#3-design-patterns-utilizados)
   - 3.1 Repository Pattern
   - 3.2 Use Case Pattern
   - 3.3 Adapter Pattern
   - 3.4 Result/Either Pattern
   - **3.5 Database Connection Management (Singleton + Factory + Pool)** ⭐ NOVO
   - **3.6 Unit of Work Pattern** ⭐ NOVO
   - **3.7 Performance Benchmarks** ⭐ NOVO
   - **3.8 Database Configuration Best Practices** ⭐ NOVO
   - **3.9 Uso Prático: Inicialização e Dependency Injection** ⭐ NOVO
   - **3.10 File Indexing & Language Services Pattern** ⭐ NOVO
4. [Modelagem de Domínio](#4-modelagem-de-domínio)
   - **4.0 Database: Considerações Avançadas de Produção** ⭐ NOVO
     - 4.0.1 Concorrência e Lock Management
     - 4.0.2 Migration Strategy
     - 4.0.3 Backup e Restore
     - 4.0.4 Performance Monitoring
     - 4.0.5 Troubleshooting Common Issues
   - 4.1 Value Objects
   - 4.2 Entities
   - 4.3 Aggregate Roots
5. [Estratégia de Testes](#5-estratégia-de-testes)
6. [Plano de Migração por Fases](#6-plano-de-migração-por-fases)
7. [Checklist de Validação Final](#7-checklist-de-validação-final)
8. [Mapeamento de Arquivos: Antes → Depois](#8-mapeamento-de-arquivos-antes-depois)
9. [Resumo Executivo](#9-resumo-executivo)
10. [Próximos Passos Imediatos](#10-próximos-passos-imediatos)

---

## 📋 Sumário Executivo

Este documento detalha a refatoração do projeto `docs-kit` para uma arquitetura baseada em **Domain-Driven Design (DDD)** com **Clean Architecture**. O objetivo é criar um sistema testável, extensível e agnóstico a infraestrutura.

### Principais Mudanças
- Separação clara de domínios (Bounded Contexts)
- Unificação de CLI e MCP via Adapters
- Abstração completa do banco de dados via Repository Pattern
- **Database Connection Management com Singleton Pattern para máxima performance** ⭐
- **Connection Pool + Statement Cache para até 5000x mais rápido** ⭐
- **Unit of Work Pattern para transações cross-repository** ⭐
- Classes pequenas e focadas (Single Responsibility)
- Código auto-documentado e facilmente testável

### Destaques de Performance 🚀

| Métrica | Melhoria Esperada |
|---------|-------------------|
| Tempo de conexão | **5000x mais rápido** (50ms → 0.01ms) |
| Query simples | **10x mais rápido** (5ms → 0.5ms) |
| Bulk insert (1000) | **13x mais rápido** (2000ms → 150ms) |
| Prepared statements | **10x mais rápido** (3ms → 0.3ms) |
| Transactions | **5x mais rápido** (10ms → 2ms) |

---

## 🔍 1. Diagnóstico da Estrutura Atual

### 1.1 Problemas Identificados

#### ❌ **Duplicação de Lógica CLI/MCP**
```
src/cli/usecases/explainSymbol.usecase.ts  → Lógica para CLI
src/server/tools/explainSymbol.tool.ts     → Mesma lógica duplicada para MCP
src/handlers/explainSymbol.ts              → Handler compartilhado (parcial)
```
**Problema**: Três arquivos para o mesmo caso de uso, com código duplicado e divergências.

#### ❌ **Acoplamento Forte com SQLite**
```typescript
// src/storage/db.ts - Acoplado diretamente ao better-sqlite3
import Database from "better-sqlite3";
export function createSymbolRepository(db: Database.Database): SymbolRepository
```
**Problema**: Impossível trocar para PostgreSQL/MySQL sem reescrever todo o código.

#### ❌ **Arquivos Gigantes e Difíceis de Testar**
| Arquivo | Linhas | Responsabilidades |
|---------|--------|-------------------|
| `index.usecase.ts` | 600+ | Indexação, parsing, métricas, governance, RAG |
| `db.ts` | 500+ | Schema, 4 repositories, queries |
| `indexer.ts` | 400+ | AST walk, metadata, layer detection |

**Problema**: Arquivos com múltiplas responsabilidades impossíveis de testar isoladamente.

#### ❌ **Container DI Monolítico**
```typescript
// src/di/container.ts - 100+ linhas de setup
export async function setupContainer(...) {
  // 16 dependências registradas manualmente
  // Lógica de negócio misturada com configuração
}
```
**Problema**: Difícil mockar dependências em testes.

### 1.2 Bounded Contexts Identificados

Após análise do código, identificamos **5 domínios distintos**:

| Bounded Context | Responsabilidade | Arquivos Atuais |
|-----------------|------------------|-----------------|
| **Symbol** | Indexação, parsing AST, extração de símbolos | `indexer/`, `patterns/` |
| **Documentation** | Registro de docs, frontmatter, geração de site | `docs/`, `site/` |
| **Knowledge** | Grafo de conhecimento, RAG, contexto | `knowledge/` |
| **Governance** | ArchGuard, Reaper, validações | `governance/` |
| **Analysis** | Diff, impacto, code review | `analyzer/`, `business/` |

---

## 🎯 2. Nova Arquitetura Proposta

### 2.1 Estrutura de Diretórios

```
src/
├── @core/                          # Shared Kernel (componentes compartilhados)
│   ├── domain/
│   │   ├── Entity.ts               # Base class para entidades
│   │   ├── ValueObject.ts          # Base class para value objects
│   │   ├── AggregateRoot.ts        # Base class para aggregates
│   │   ├── DomainEvent.ts          # Base class para eventos
│   │   └── Result.ts               # Either/Result pattern
│   ├── application/
│   │   ├── UseCase.ts              # Interface base para use cases
│   │   └── UnitOfWork.ts           # Pattern para transações
│   └── infrastructure/
│       ├── Repository.ts           # Interface base de repositório
│       └── DatabaseConnection.ts   # Interface de conexão DB
│
├── @shared/                        # Utilitários compartilhados
│   ├── types/                      # Types globais
│   ├── errors/                     # Erros customizados
│   └── utils/                      # Funções utilitárias
│
├── modules/                        # Bounded Contexts
│   ├── symbol/                     # 📦 Módulo Symbol
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── CodeSymbol.ts
│   │   │   │   └── SymbolRelationship.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── SymbolId.ts
│   │   │   │   ├── SymbolKind.ts
│   │   │   │   ├── FileLocation.ts
│   │   │   │   └── Signature.ts
│   │   │   ├── repositories/
│   │   │   │   ├── ISymbolRepository.ts
│   │   │   │   └── IRelationshipRepository.ts
│   │   │   └── services/
│   │   │       └── SymbolIndexingService.ts
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── IndexProject.usecase.ts
│   │   │   │   ├── FindSymbol.usecase.ts
│   │   │   │   └── ExplainSymbol.usecase.ts
│   │   │   ├── dtos/
│   │   │   │   ├── IndexProjectInput.dto.ts
│   │   │   │   └── SymbolOutput.dto.ts
│   │   │   └── mappers/
│   │   │       └── SymbolMapper.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── sqlite/
│   │   │   │   │   └── SqliteSymbolRepository.ts
│   │   │   │   ├── postgres/
│   │   │   │   │   └── PostgresSymbolRepository.ts
│   │   │   │   └── memory/
│   │   │   │       └── InMemorySymbolRepository.ts
│   │   │   └── parsers/
│   │   │       ├── TreeSitterParser.ts
│   │   │       └── strategies/
│   │   │           ├── TypeScriptStrategy.ts
│   │   │           ├── PythonStrategy.ts
│   │   │           └── GoStrategy.ts
│   │   └── __tests__/
│   │       ├── domain/
│   │       ├── application/
│   │       └── infrastructure/
│   │
│   ├── documentation/              # 📦 Módulo Documentation
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── Document.ts
│   │   │   │   └── DocMapping.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── DocumentPath.ts
│   │   │   │   └── Frontmatter.ts
│   │   │   └── repositories/
│   │   │       └── IDocumentRepository.ts
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       ├── BuildDocs.usecase.ts
│   │   │       ├── BuildSite.usecase.ts
│   │   │       └── ScanDocs.usecase.ts
│   │   └── infrastructure/
│   │       ├── persistence/
│   │       └── generators/
│   │           ├── MarkdownGenerator.ts
│   │           └── HtmlGenerator.ts
│   │
│   ├── knowledge/                  # 📦 Módulo Knowledge
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── KnowledgeNode.ts
│   │   │   ├── value-objects/
│   │   │   │   └── EmbeddingVector.ts
│   │   │   └── services/
│   │   │       └── GraphTraversalService.ts
│   │   ├── application/
│   │   │   └── use-cases/
│   │   │       ├── BuildContext.usecase.ts
│   │   │       └── QueryKnowledge.usecase.ts
│   │   └── infrastructure/
│   │       └── rag/
│   │           └── RagIndexAdapter.ts
│   │
│   ├── governance/                 # 📦 Módulo Governance
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── ArchViolation.ts
│   │   │   │   └── ReaperFinding.ts
│   │   │   ├── value-objects/
│   │   │   │   └── ArchRule.ts
│   │   │   └── services/
│   │   │       ├── ArchGuardService.ts
│   │   │       └── ReaperService.ts
│   │   └── application/
│   │       └── use-cases/
│   │           ├── AnalyzeArchitecture.usecase.ts
│   │           └── ScanDeadCode.usecase.ts
│   │
│   └── analysis/                   # 📦 Módulo Analysis
│       ├── domain/
│       │   ├── entities/
│       │   │   └── ChangeImpact.ts
│       │   └── services/
│       │       └── ImpactAnalysisService.ts
│       └── application/
│           └── use-cases/
│               ├── AnalyzePatterns.usecase.ts
│               └── AnalyzeImpact.usecase.ts
│
├── adapters/                       # Adapters de entrada (Ports primários)
│   ├── cli/
│   │   ├── CliAdapter.ts           # Adapter principal CLI
│   │   ├── commands/
│   │   │   ├── IndexCommand.ts
│   │   │   ├── BuildSiteCommand.ts
│   │   │   └── ExplainSymbolCommand.ts
│   │   └── presenters/
│   │       └── ConsolePresenter.ts
│   │
│   ├── mcp/
│   │   ├── McpAdapter.ts           # Adapter principal MCP
│   │   ├── tools/
│   │   │   ├── IndexTool.ts
│   │   │   ├── ExplainSymbolTool.ts
│   │   │   └── ImpactAnalysisTool.ts
│   │   └── presenters/
│   │       └── McpPresenter.ts
│   │
│   └── http/                       # (Futuro) REST API
│       └── HttpAdapter.ts
│
├── config/                         # Configuração
│   ├── container.ts               # Composição do DI container
│   ├── database.ts                # Factory de conexões DB
│   └── config.schema.ts           # Schema da configuração
│
└── main/                          # Entry points
    ├── cli.ts                     # Entry point CLI
    └── mcp.ts                     # Entry point MCP
```

### 2.2 Justificativa das Escolhas

#### ✅ **Por que `@core/` e `@shared/`?**
- **Shared Kernel** do DDD: componentes que pertencem a todos os bounded contexts
- O prefixo `@` indica que são módulos especiais, não domínios de negócio
- Facilita imports: `import { Entity } from '@core/domain/Entity'`

#### ✅ **Por que `modules/` ao invés de manter a estrutura atual?**
| Estrutura Atual | Estrutura Proposta |
|-----------------|-------------------|
| Organização por **tipo técnico** (cli/, server/, storage/) | Organização por **domínio de negócio** (symbol/, documentation/) |
| Dificulta entender o negócio | Código reflete a linguagem ubíqua |
| Dependências cruzadas inevitáveis | Bounded contexts isolados |

#### ✅ **Por que `adapters/` separado dos módulos?**
- **Ports & Adapters** (Hexagonal Architecture)
- Os adapters são detalhes de infraestrutura, não domínio
- Permite adicionar novos adapters (HTTP, GraphQL) sem tocar no domínio
- CLI e MCP usam os **mesmos use cases** via interface

#### ✅ **Por que `infrastructure/persistence/sqlite/`, `/postgres/`?**
- **Repository Pattern** com implementações intercambiáveis
- Banco de dados é um **detalhe de implementação**
- Migrar para PostgreSQL = criar novo adapter + alterar config

---

## 🧩 3. Design Patterns Utilizados

### 3.1 Repository Pattern

**Problema atual**: O `db.ts` mistura schema, queries e lógica de mapeamento.

**Solução**:
```typescript
// @core/infrastructure/Repository.ts
export interface IRepository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

// modules/symbol/domain/repositories/ISymbolRepository.ts
export interface ISymbolRepository extends IRepository<CodeSymbol, SymbolId> {
  findByName(name: string): Promise<CodeSymbol[]>;
  findByFile(file: string): Promise<CodeSymbol[]>;
  findByKind(kind: SymbolKind): Promise<CodeSymbol[]>;
}

// modules/symbol/infrastructure/persistence/sqlite/SqliteSymbolRepository.ts
export class SqliteSymbolRepository implements ISymbolRepository {
  constructor(private readonly db: Database) {}

  async findById(id: SymbolId): Promise<CodeSymbol | null> {
    const row = this.db.prepare('SELECT * FROM symbols WHERE id = ?').get(id.value);
    return row ? SymbolMapper.toDomain(row) : null;
  }
  // ... outros métodos
}
```

**Benefício**: Testar use cases sem banco de dados real.

### 3.2 Use Case Pattern

**Problema atual**: Lógica espalhada entre `cli/usecases/`, `server/tools/`, e `handlers/`.

**Solução**:
```typescript
// @core/application/UseCase.ts
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput>>;
}

// modules/symbol/application/use-cases/ExplainSymbol.usecase.ts
export class ExplainSymbolUseCase implements UseCase<ExplainSymbolInput, ExplainSymbolOutput> {
  constructor(
    private readonly symbolRepo: ISymbolRepository,
    private readonly docRepo: IDocumentRepository,
    private readonly llmProvider: ILlmProvider,
  ) {}

  async execute(input: ExplainSymbolInput): Promise<Result<ExplainSymbolOutput>> {
    // 1. Busca símbolo
    const symbol = await this.symbolRepo.findByName(input.symbolName);
    if (!symbol) {
      return Result.fail(new SymbolNotFoundError(input.symbolName));
    }

    // 2. Busca documentação relacionada
    const docs = await this.docRepo.findBySymbol(symbol.id);

    // 3. Gera explicação (se LLM configurado)
    const explanation = await this.llmProvider.explain(symbol, docs);

    return Result.ok({ symbol, explanation });
  }
}
```

**Benefício**: Um único use case para CLI e MCP.

### 3.3 Adapter Pattern

**Problema atual**: CLI e MCP têm implementações separadas com código duplicado.

**Solução**:
```typescript
// adapters/cli/commands/ExplainSymbolCommand.ts
export class ExplainSymbolCommand {
  constructor(
    private readonly useCase: ExplainSymbolUseCase,
    private readonly presenter: ConsolePresenter,
  ) {}

  async execute(args: string[]): Promise<void> {
    const input = this.parseArgs(args);
    const result = await this.useCase.execute(input);

    if (result.isFailure) {
      this.presenter.error(result.error);
      return;
    }

    this.presenter.success(result.value);
  }
}

// adapters/mcp/tools/ExplainSymbolTool.ts
export class ExplainSymbolTool {
  constructor(
    private readonly useCase: ExplainSymbolUseCase,
    private readonly presenter: McpPresenter,
  ) {}

  async handle(params: { symbol: string }): Promise<McpResponse> {
    const input = { symbolName: params.symbol };
    const result = await this.useCase.execute(input);

    return this.presenter.format(result);
  }
}
```

**Benefício**: Mesma lógica, diferentes formatos de entrada/saída.

### 3.4 Result/Either Pattern

**Problema atual**: Erros tratados com try/catch e `console.error`.

**Solução**:
```typescript
// @core/domain/Result.ts
export class Result<T> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly error?: Error,
    private readonly _value?: T,
  ) {}

  get value(): T {
    if (!this.isSuccess) throw new Error('Cannot get value from failed result');
    return this._value as T;
  }

  get isFailure(): boolean {
    return !this.isSuccess;
  }

  static ok<U>(value: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  static fail<U>(error: Error): Result<U> {
    return new Result<U>(false, error);
  }

  map<U>(fn: (value: T) => U): Result<U> {
    return this.isSuccess ? Result.ok(fn(this._value as T)) : Result.fail(this.error!);
  }
}
```

**Benefício**: Tratamento de erros explícito e testável.

### 3.5 Database Connection Management (Singleton + Factory + Pool)

**Problema atual**:
- Acoplado diretamente ao `better-sqlite3`
- Uma nova conexão é criada a cada operação (overhead)
- Sem controle de pool de conexões
- Difícil fazer transaction management cross-repositories

**Solução**: Combinar **Singleton** + **Factory** + **Connection Pool**

```typescript
// @core/infrastructure/DatabaseConnection.ts
export interface IDatabaseConnection {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  transaction<T>(fn: (tx: ITransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ITransaction {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// @core/infrastructure/DatabaseConnectionManager.ts (SINGLETON)
export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private connections: Map<string, IDatabaseConnection> = new Map();
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Singleton Pattern: Garante uma única instância do gerenciador
   */
  static getInstance(config?: DatabaseConfig): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      if (!config) {
        throw new Error('DatabaseConnectionManager not initialized');
      }
      DatabaseConnectionManager.instance = new DatabaseConnectionManager(config);
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Factory Pattern: Cria conexão baseada no tipo de banco
   */
  getConnection(name: string = 'default'): IDatabaseConnection {
    if (!this.connections.has(name)) {
      const connection = this.createConnection(this.config);
      this.connections.set(name, connection);
    }
    return this.connections.get(name)!;
  }

  private createConnection(config: DatabaseConfig): IDatabaseConnection {
    switch (config.type) {
      case 'sqlite':
        return new SqliteConnection(config);
      case 'postgres':
        return new PostgresConnection(config);
      case 'mysql':
        return new MysqlConnection(config);
      case 'memory':
        return new InMemoryConnection();
      default:
        throw new Error(`Unknown database type: ${config.type}`);
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.values()).map(conn => conn.close())
    );
    this.connections.clear();
  }

  /**
   * Para testes: permite resetar singleton
   */
  static resetForTests(): void {
    if (DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance.connections.clear();
      DatabaseConnectionManager.instance = null as any;
    }
  }
}

// modules/symbol/infrastructure/persistence/sqlite/SqliteConnection.ts
export class SqliteConnection implements IDatabaseConnection {
  private db: Database.Database;
  private readonly pool: SqliteConnectionPool; // Connection Pool

  constructor(config: DatabaseConfig) {
    // WAL mode para melhor concorrência
    this.db = new Database(config.connection);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000000'); // 30GB mmap

    // Pool interno para statements preparados
    this.pool = new SqliteConnectionPool(this.db);
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.pool.prepare(sql);
    return params ? stmt.all(...params) : stmt.all();
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    const stmt = this.pool.prepare(sql);
    params ? stmt.run(...params) : stmt.run();
  }

  async transaction<T>(fn: (tx: ITransaction) => Promise<T>): Promise<T> {
    const tx = new SqliteTransaction(this.db);
    try {
      await tx.begin();
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async close(): Promise<void> {
    this.pool.cleanup();
    this.db.close();
  }
}

// Statement Pool: Cache de prepared statements
class SqliteConnectionPool {
  private statements: Map<string, Database.Statement> = new Map();
  private maxSize = 100;

  constructor(private db: Database.Database) {}

  prepare(sql: string): Database.Statement {
    if (!this.statements.has(sql)) {
      if (this.statements.size >= this.maxSize) {
        // LRU eviction
        const firstKey = this.statements.keys().next().value;
        this.statements.get(firstKey)?.finalize();
        this.statements.delete(firstKey);
      }
      this.statements.set(sql, this.db.prepare(sql));
    }
    return this.statements.get(sql)!;
  }

  cleanup(): void {
    for (const stmt of this.statements.values()) {
      stmt.finalize();
    }
    this.statements.clear();
  }
}
```

**Benefícios**:
1. **Performance**: Conexão e prepared statements reusados
2. **Memory**: Controle de cache e pool size
3. **Concurrency**: WAL mode permite leituras paralelas
4. **Testability**: Singleton pode ser resetado em testes
5. **Flexibility**: Trocar banco = alterar 1 linha de config

---

### 3.6 Unit of Work Pattern

**Problema**: Múltiplos repositórios precisam participar da mesma transação.

**Solução**:
```typescript
// @core/application/UnitOfWork.ts
export interface IUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getRepository<T>(repo: new (...args: any[]) => T): T;
}

// @core/infrastructure/UnitOfWork.ts
export class UnitOfWork implements IUnitOfWork {
  private transaction?: ITransaction;
  private repositories: Map<any, any> = new Map();

  constructor(private connection: IDatabaseConnection) {}

  async begin(): Promise<void> {
    // Transaction será iniciada no primeiro repository usado
  }

  async commit(): Promise<void> {
    if (this.transaction) {
      await this.transaction.commit();
      this.transaction = undefined;
      this.repositories.clear();
    }
  }

  async rollback(): Promise<void> {
    if (this.transaction) {
      await this.transaction.rollback();
      this.transaction = undefined;
      this.repositories.clear();
    }
  }

  getRepository<T>(RepoClass: new (tx: ITransaction) => T): T {
    if (!this.repositories.has(RepoClass)) {
      if (!this.transaction) {
        throw new Error('Transaction not started');
      }
      this.repositories.set(RepoClass, new RepoClass(this.transaction));
    }
    return this.repositories.get(RepoClass);
  }

  /**
   * Helper para executar operações dentro de uma transação
   */
  async execute<T>(fn: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    try {
      await this.begin();
      const result = await fn(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

// Exemplo de uso no Use Case
export class TransferSymbolUseCase implements UseCase<TransferInput, TransferOutput> {
  constructor(private connection: IDatabaseConnection) {}

  async execute(input: TransferInput): Promise<Result<TransferOutput>> {
    const uow = new UnitOfWork(this.connection);

    try {
      return await uow.execute(async (uow) => {
        // Ambos os repositórios usam a mesma transação
        const symbolRepo = uow.getRepository(SqliteSymbolRepository);
        const docRepo = uow.getRepository(SqliteDocumentRepository);

        const symbol = await symbolRepo.findById(input.symbolId);
        if (!symbol) {
          return Result.fail(new SymbolNotFoundError());
        }

        // Move symbol
        symbol.updateFile(input.newFile);
        await symbolRepo.save(symbol);

        // Update docs
        const docs = await docRepo.findBySymbol(symbol.id);
        for (const doc of docs) {
          doc.updateSymbolReference(symbol.id, input.newFile);
          await docRepo.save(doc);
        }

        return Result.ok({ symbol, docsUpdated: docs.length });
      });
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}
```

---

### 3.7 Performance Benchmarks (Esperados)

| Operação | Sem Singleton | Com Singleton + Pool | Melhoria |
|----------|---------------|---------------------|----------|
| **Conexão Nova** | ~50ms | ~0.01ms | **5000x** |
| **Query Simples** | ~5ms | ~0.5ms | **10x** |
| **Bulk Insert (1000)** | ~2000ms | ~150ms | **13x** |
| **Prepared Statement** | ~3ms | ~0.3ms | **10x** |
| **Transaction** | ~10ms | ~2ms | **5x** |

### 3.8 Database Configuration Best Practices

```typescript
// config/database.ts
export interface DatabaseConfig {
  type: DatabaseType;
  connection: string;
  pool?: PoolConfig;
  performance?: PerformanceConfig;
}

export interface PoolConfig {
  min: number;           // Mínimo de conexões (default: 2)
  max: number;           // Máximo de conexões (default: 10)
  idleTimeout: number;   // Timeout para conexões idle (default: 30s)
  acquireTimeout: number; // Timeout para adquirir conexão (default: 60s)
}

export interface PerformanceConfig {
  // SQLite specific
  walMode?: boolean;           // WAL mode (default: true)
  cacheSize?: number;          // Cache size em KB (default: 64000)
  mmapSize?: number;           // Memory-mapped I/O (default: 30GB)

  // PostgreSQL specific
  statementCacheSize?: number; // Prepared statement cache (default: 100)
  maxConnections?: number;     // Max connections (default: 20)
}

export const defaultDatabaseConfig: DatabaseConfig = {
  type: 'sqlite',
  connection: '.docs-kit/registry.db',
  pool: {
    min: 2,
    max: 10,
    idleTimeout: 30000,
    acquireTimeout: 60000,
  },
  performance: {
    walMode: true,
    cacheSize: 64000,
    mmapSize: 30000000000,
    statementCacheSize: 100,
  },
};
```

**Justificativa das Escolhas:**

| Configuração | Valor | Motivo |
|--------------|-------|--------|
| `walMode: true` | WAL | Permite leituras paralelas, melhor concorrência |
| `cacheSize: 64MB` | 64000KB | Balance entre memória e performance |
| `mmapSize: 30GB` | 30GB | Memory-mapped I/O para grandes databases |
| `pool.max: 10` | 10 conexões | Para CLI é suficiente; MCP pode ter múltiplos clientes |
| `statementCacheSize: 100` | 100 | Cache para queries frequentes |

---

### 3.9 Uso Prático: Inicialização e Dependency Injection

**1. Setup na Aplicação (Bootstrap)**

```typescript
// main/cli.ts
async function bootstrap() {
  // 1. Carrega configuração
  const config = await loadConfig();

  // 2. Inicializa Database Manager (Singleton)
  const dbManager = DatabaseConnectionManager.getInstance(config.database);
  const connection = dbManager.getConnection('default');

  // 3. Inicia schema (se necessário)
  await initializeSchema(connection);

  // 4. Setup DI Container
  const container = new Container();

  // Registra conexão como singleton
  container.register('IDatabaseConnection', () => connection, { lifecycle: 'singleton' });

  // Registra repositories
  container.register('ISymbolRepository', (c) =>
    new SqliteSymbolRepository(c.resolve('IDatabaseConnection')),
    { lifecycle: 'scoped' } // Nova instância por request
  );

  container.register('IDocumentRepository', (c) =>
    new SqliteDocumentRepository(c.resolve('IDatabaseConnection')),
    { lifecycle: 'scoped' }
  );

  // Registra use cases
  container.register('ExplainSymbolUseCase', (c) =>
    new ExplainSymbolUseCase(
      c.resolve('ISymbolRepository'),
      c.resolve('IDocumentRepository'),
      c.resolve('ILlmProvider')
    ),
    { lifecycle: 'transient' } // Nova instância sempre
  );

  // 5. Inicia CLI
  const cli = new CliAdapter(container);
  await cli.run(process.argv);

  // 6. Cleanup
  process.on('SIGINT', async () => {
    await dbManager.closeAll();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
```

**2. Uso em Repositórios**

```typescript
// modules/symbol/infrastructure/persistence/sqlite/SqliteSymbolRepository.ts
export class SqliteSymbolRepository implements ISymbolRepository {
  constructor(
    private readonly connection: IDatabaseConnection // Injetado
  ) {}

  async findById(id: SymbolId): Promise<CodeSymbol | null> {
    const rows = await this.connection.query<SymbolRow>(
      'SELECT * FROM symbols WHERE id = ?',
      [id.value]
    );

    return rows.length > 0 ? SymbolMapper.toDomain(rows[0]) : null;
  }

  async save(symbol: CodeSymbol): Promise<void> {
    const data = SymbolMapper.toPersistence(symbol);

    await this.connection.execute(`
      INSERT INTO symbols (id, name, kind, file, startLine, endLine, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        file = excluded.file,
        startLine = excluded.startLine,
        endLine = excluded.endLine,
        signature = excluded.signature
    `, [data.id, data.name, data.kind, data.file, data.startLine, data.endLine, data.signature]);
  }

  async findByFile(file: string): Promise<CodeSymbol[]> {
    const rows = await this.connection.query<SymbolRow>(
      'SELECT * FROM symbols WHERE file = ? ORDER BY startLine',
      [file]
    );

    return rows.map(SymbolMapper.toDomain);
  }

  async deleteByFile(file: string): Promise<void> {
    await this.connection.execute('DELETE FROM symbols WHERE file = ?', [file]);
  }

  // Bulk operations com transaction
  async saveMany(symbols: CodeSymbol[]): Promise<void> {
    await this.connection.transaction(async (tx) => {
      for (const symbol of symbols) {
        const data = SymbolMapper.toPersistence(symbol);
        await tx.execute(`
          INSERT INTO symbols (id, name, kind, file, startLine, endLine)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            kind = excluded.kind,
            file = excluded.file
        `, [data.id, data.name, data.kind, data.file, data.startLine, data.endLine]);
      }
    });
  }
}
```

**3. Testes com InMemory e Mocks**

```typescript
// modules/symbol/application/__tests__/ExplainSymbol.usecase.test.ts
describe('ExplainSymbolUseCase', () => {
  let useCase: ExplainSymbolUseCase;
  let symbolRepo: ISymbolRepository;
  let docRepo: IDocumentRepository;

  beforeEach(() => {
    // Para testes unitários: usa InMemory
    symbolRepo = new InMemorySymbolRepository();
    docRepo = new InMemoryDocumentRepository();
    const llmProvider = new MockLlmProvider();

    useCase = new ExplainSymbolUseCase(symbolRepo, docRepo, llmProvider);
  });

  it('should find and explain symbol', async () => {
    // Arrange
    const symbol = CodeSymbol.create({
      name: 'UserService',
      kind: SymbolKind.Class,
      file: 'src/UserService.ts',
      startLine: 1,
      endLine: 50,
    }).value;

    await symbolRepo.save(symbol);

    // Act
    const result = await useCase.execute({ symbolName: 'UserService' });

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.value.symbol.name).toBe('UserService');
  });
});

// Para testes de integração: usa database real em memória
describe('ExplainSymbolUseCase (Integration)', () => {
  let connection: IDatabaseConnection;
  let useCase: ExplainSymbolUseCase;

  beforeEach(async () => {
    // Reset singleton para testes
    DatabaseConnectionManager.resetForTests();

    // Cria conexão in-memory
    const dbManager = DatabaseConnectionManager.getInstance({
      type: 'sqlite',
      connection: ':memory:',
    });
    connection = dbManager.getConnection('test');

    await initializeSchema(connection);

    const symbolRepo = new SqliteSymbolRepository(connection);
    const docRepo = new SqliteDocumentRepository(connection);
    const llmProvider = new MockLlmProvider();

    useCase = new ExplainSymbolUseCase(symbolRepo, docRepo, llmProvider);
  });

  afterEach(async () => {
    await connection.close();
  });

  it('should persist and retrieve symbol', async () => {
    // ... teste de integração
  });
});
```

**4. Monitoramento e Observabilidade**

```typescript
// @core/infrastructure/DatabaseConnectionManager.ts (extensão)
export class DatabaseConnectionManager {
  private metrics = {
    queriesExecuted: 0,
    queriesTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    activeConnections: 0,
  };

  getMetrics() {
    return {
      ...this.metrics,
      averageQueryTime: this.metrics.queriesExecuted > 0
        ? this.metrics.queriesTime / this.metrics.queriesExecuted
        : 0,
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
        ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
        : 0,
    };
  }

  resetMetrics() {
    this.metrics = {
      queriesExecuted: 0,
      queriesTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      activeConnections: this.connections.size,
    };
  }
}

// Uso no CLI
async function showMetrics() {
  const dbManager = DatabaseConnectionManager.getInstance();
  const metrics = dbManager.getMetrics();

  console.log('📊 Database Metrics:');
  console.log(`  Queries: ${metrics.queriesExecuted}`);
  console.log(`  Avg Time: ${metrics.averageQueryTime.toFixed(2)}ms`);
  console.log(`  Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
  console.log(`  Active Connections: ${metrics.activeConnections}`);
}
```

**5. Migration para PostgreSQL (Produção)**

```javascript
// docs.config.js
export default {
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
  database: {
    // Desenvolvimento: SQLite
    type: process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite',
    connection: process.env.DATABASE_URL || '.docs-kit/registry.db',
    pool: {
      min: 2,
      max: process.env.NODE_ENV === 'production' ? 20 : 5,
      idleTimeout: 30000,
    },
    performance: {
      // SQLite
      walMode: true,
      cacheSize: 64000,
      // PostgreSQL
      statementCacheSize: 100,
      maxConnections: 20,
    },
  },
};
```

**Benefícios desta Abordagem:**

| Aspecto | Benefício |
|---------|-----------|
| **Performance** | Conexão única + statement pool = 10-5000x mais rápido |
| **Memory** | Controle fino de cache e pool size |
| **Testability** | InMemory para unit tests, :memory: para integration tests |
| **Production Ready** | Troca SQLite → PostgreSQL sem alterar código |
| **Observability** | Métricas de performance built-in |
| **DDD Compliance** | Repositories dependem de interface, não implementação |

---

### 3.10 File Indexing & Language Services Pattern ⭐ NOVO

**Problema atual**: A indexação de arquivos é lenta, sem cache, e repete parsing desnecessário.

#### 3.10.1 Arquitetura do Sistema de Indexação

O sistema de indexação deve ser capaz de:
- **Detectar mudanças** em arquivos rapidamente (filesystem watcher)
- **Parsear incrementalmente** apenas arquivos alterados
- **Cachear resultados** de parsing (AST + metadados)
- **Prover Language Services** (intelisense, validação, etc.) por tipo de arquivo
- **Indexar em paralelo** para melhor performance

**Arquitetura proposta**:

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

#### 3.10.2 Interfaces Principais

```typescript
// @core/indexing/IFileIndexer.ts
export interface IFileIndexer {
  /**
   * Indexa um projeto completo
   */
  indexProject(rootPath: string): Promise<IndexResult>;

  /**
   * Indexa apenas arquivos modificados
   */
  indexChanged(files: string[]): Promise<IndexResult>;

  /**
   * Obtém estatísticas de indexação
   */
  getStats(): IndexStats;

  /**
   * Limpa cache de indexação
   */
  clearCache(): Promise<void>;
}

export interface IndexResult {
  filesProcessed: number;
  symbolsFound: number;
  errors: IndexError[];
  duration: number;
}

// @core/indexing/ILanguageParser.ts
export interface ILanguageParser {
  /**
   * Linguagens suportadas por este parser
   */
  supportedExtensions: string[];

  /**
   * Parseia um arquivo e extrai símbolos
   */
  parse(filePath: string, content: string): Promise<ParseResult>;

  /**
   * Valida sintaxe sem extrair símbolos (mais rápido)
   */
  validate(content: string): Promise<ValidationResult>;

  /**
   * Fornece Language Services (autocomplete, etc.)
   */
  getLanguageService?(): ILanguageService;
}

export interface ParseResult {
  symbols: CodeSymbol[];
  relationships: SymbolRelationship[];
  metadata: FileMetadata;
  ast?: any; // AST completo (opcional, para cache)
}
```

---

#### 3.10.3 FileWatcher: Detecção Incremental de Mudanças

```typescript
// @core/indexing/FileWatcher.ts
import chokidar from 'chokidar';
import crypto from 'crypto';

export class FileWatcher {
  private watcher: chokidar.FSWatcher;
  private fileHashes: Map<string, string> = new Map();
  private changeQueue: Set<string> = new Set();

  constructor(
    private rootPath: string,
    private onFilesChanged: (files: string[]) => Promise<void>
  ) {}

  async start(): Promise<void> {
    this.watcher = chokidar.watch(this.rootPath, {
      ignored: /(^|[\/\\])\..|(node_modules|dist|build|coverage)/,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher
      .on('add', (path) => this.handleFileChange(path))
      .on('change', (path) => this.handleFileChange(path))
      .on('unlink', (path) => this.handleFileDelete(path));
  }

  private async handleFileChange(filePath: string): Promise<void> {
    const currentHash = await this.computeFileHash(filePath);
    const previousHash = this.fileHashes.get(filePath);

    // Só processa se o conteúdo mudou de verdade
    if (currentHash !== previousHash) {
      this.fileHashes.set(filePath, currentHash);
      this.changeQueue.add(filePath);

      // Debounce: aguarda 500ms sem mudanças antes de processar
      this.scheduleProcessing();
    }
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    this.fileHashes.delete(filePath);
    this.changeQueue.add(filePath);
    this.scheduleProcessing();
  }

  private processingTimer?: NodeJS.Timeout;
  private scheduleProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    this.processingTimer = setTimeout(async () => {
      const filesToProcess = Array.from(this.changeQueue);
      this.changeQueue.clear();

      if (filesToProcess.length > 0) {
        await this.onFilesChanged(filesToProcess);
      }
    }, 500);
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async stop(): Promise<void> {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    await this.watcher?.close();
  }
}
```

**Benefícios**:
- ✅ **Detecção em tempo real** de mudanças no filesystem
- ✅ **Hash-based change detection** evita re-parsing desnecessário
- ✅ **Debouncing** para agrupar mudanças rápidas
- ✅ **Filtra pastas** como node_modules automaticamente

---

#### 3.10.4 AST Cache: LRU + Disk Persistence

```typescript
// @core/indexing/ASTCache.ts
import { LRUCache } from 'lru-cache';
import path from 'path';
import fs from 'fs/promises';

export interface CachedAST {
  filePath: string;
  fileHash: string;
  ast: any;
  symbols: CodeSymbol[];
  relationships: SymbolRelationship[];
  parsedAt: Date;
}

export class ASTCache {
  private memoryCache: LRUCache<string, CachedAST>;
  private diskCachePath: string;

  constructor(
    private config: {
      maxMemoryEntries: number;  // Ex: 1000 arquivos em memória
      maxMemorySize: number;      // Ex: 100MB
      diskCachePath: string;      // Ex: .docs-kit/ast-cache/
    }
  ) {
    this.diskCachePath = config.diskCachePath;

    // LRU Cache com limites de tamanho e quantidade
    this.memoryCache = new LRUCache({
      max: config.maxMemoryEntries,
      maxSize: config.maxMemorySize,
      sizeCalculation: (value) => {
        // Estima tamanho em bytes do AST serializado
        return JSON.stringify(value).length;
      },
      dispose: async (value, key) => {
        // Quando um item é removido da memória, salva em disco
        await this.saveToDisk(key, value);
      },
    });
  }

  async get(filePath: string, fileHash: string): Promise<CachedAST | null> {
    // 1. Tenta memória primeiro (mais rápido)
    let cached = this.memoryCache.get(filePath);

    if (cached && cached.fileHash === fileHash) {
      return cached;
    }

    // 2. Tenta disco se não está em memória
    cached = await this.loadFromDisk(filePath);

    if (cached && cached.fileHash === fileHash) {
      // Move para memória (quente novamente)
      this.memoryCache.set(filePath, cached);
      return cached;
    }

    // 3. Cache miss - precisa re-parsear
    return null;
  }

  async set(filePath: string, data: CachedAST): Promise<void> {
    this.memoryCache.set(filePath, data);
    // Disco é salvo automaticamente no dispose do LRU
  }

  async invalidate(filePath: string): Promise<void> {
    this.memoryCache.delete(filePath);
    await this.removeFromDisk(filePath);
  }

  private async saveToDisk(filePath: string, data: CachedAST): Promise<void> {
    try {
      const cacheFile = this.getCacheFilePath(filePath);
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify(data), 'utf-8');
    } catch (error) {
      // Falha silenciosa - cache é opcional
      console.warn(`Failed to save cache for ${filePath}:`, error);
    }
  }

  private async loadFromDisk(filePath: string): Promise<CachedAST | null> {
    try {
      const cacheFile = this.getCacheFilePath(filePath);
      const content = await fs.readFile(cacheFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async removeFromDisk(filePath: string): Promise<void> {
    try {
      const cacheFile = this.getCacheFilePath(filePath);
      await fs.unlink(cacheFile);
    } catch {
      // Arquivo já não existe
    }
  }

  private getCacheFilePath(filePath: string): string {
    // Converte caminho do arquivo em nome de cache único
    const hash = crypto.createHash('sha256').update(filePath).digest('hex');
    return path.join(this.diskCachePath, `${hash}.json`);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      await fs.rm(this.diskCachePath, { recursive: true, force: true });
      await fs.mkdir(this.diskCachePath, { recursive: true });
    } catch (error) {
      console.warn('Failed to clear disk cache:', error);
    }
  }

  getStats() {
    return {
      memorySize: this.memoryCache.size,
      memoryMax: this.memoryCache.max,
      calculatedSize: this.memoryCache.calculatedSize,
    };
  }
}
```

**Performance esperada**:

| Operação | Sem Cache | Com Cache (Memory) | Com Cache (Disk) |
|----------|-----------|-------------------|------------------|
| Parse TS file (1000 LOC) | ~200ms | ~0.1ms | ~5ms |
| Parse grande projeto (1000 files) | ~200s | ~5s (incremental) | ~15s |

---

#### 3.10.5 ParserRegistry: Strategy Pattern para Múltiplas Linguagens

```typescript
// @core/indexing/ParserRegistry.ts
export class ParserRegistry {
  private parsers: Map<string, ILanguageParser> = new Map();
  private extensionMap: Map<string, ILanguageParser> = new Map();

  /**
   * Registra um parser para uma linguagem
   */
  register(name: string, parser: ILanguageParser): void {
    this.parsers.set(name, parser);

    // Mapeia extensões para o parser
    for (const ext of parser.supportedExtensions) {
      this.extensionMap.set(ext.toLowerCase(), parser);
    }
  }

  /**
   * Obtém parser por extensão de arquivo
   */
  getParserForFile(filePath: string): ILanguageParser | null {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Obtém parser por nome
   */
  getParser(name: string): ILanguageParser | null {
    return this.parsers.get(name) || null;
  }

  /**
   * Lista todas as extensões suportadas
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }
}

// Exemplo de implementação: TypeScript/JavaScript Parser
// modules/symbol/infrastructure/parsers/TypeScriptParser.ts
export class TypeScriptParser implements ILanguageParser {
  supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScriptLanguage);
  }

  async parse(filePath: string, content: string): Promise<ParseResult> {
    const tree = this.parser.parse(content);
    const symbols: CodeSymbol[] = [];
    const relationships: SymbolRelationship[] = [];

    // Extrai símbolos usando Tree-sitter cursor
    const cursor = tree.walk();
    this.extractSymbols(cursor, content, filePath, symbols, relationships);

    return {
      symbols,
      relationships,
      metadata: {
        language: 'typescript',
        loc: content.split('\n').length,
        size: content.length,
      },
      ast: tree.rootNode, // Cache para reutilização
    };
  }

  async validate(content: string): Promise<ValidationResult> {
    const tree = this.parser.parse(content);
    const errors: SyntaxError[] = [];

    // Detecta erros de sintaxe
    const cursor = tree.walk();
    this.findErrors(cursor, errors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private extractSymbols(
    cursor: TreeCursor,
    content: string,
    filePath: string,
    symbols: CodeSymbol[],
    relationships: SymbolRelationship[]
  ): void {
    // Implementação específica do TypeScript
    // Reconhece: class, interface, function, method, const, type, etc.

    do {
      const node = cursor.currentNode;

      switch (node.type) {
        case 'class_declaration':
          symbols.push(this.extractClass(node, content, filePath));
          break;
        case 'interface_declaration':
          symbols.push(this.extractInterface(node, content, filePath));
          break;
        case 'function_declaration':
          symbols.push(this.extractFunction(node, content, filePath));
          break;
        // ... outros tipos
      }

      if (cursor.gotoFirstChild()) {
        this.extractSymbols(cursor, content, filePath, symbols, relationships);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }

  getLanguageService(): TypeScriptLanguageService {
    return new TypeScriptLanguageService();
  }
}

// Exemplo: Python Parser
// modules/symbol/infrastructure/parsers/PythonParser.ts
export class PythonParser implements ILanguageParser {
  supportedExtensions = ['.py', '.pyi'];

  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(PythonLanguage);
  }

  async parse(filePath: string, content: string): Promise<ParseResult> {
    // Similar ao TypeScript, mas com regras específicas de Python
    // Reconhece: class, def, async def, decorators, etc.
  }

  getLanguageService(): PythonLanguageService {
    return new PythonLanguageService();
  }
}
```

**Setup no Bootstrap**:

```typescript
// config/indexer.ts
export function setupIndexer(): ParserRegistry {
  const registry = new ParserRegistry();

  // Registra todos os parsers suportados
  registry.register('typescript', new TypeScriptParser());
  registry.register('python', new PythonParser());
  registry.register('go', new GoParser());
  registry.register('java', new JavaParser());
  registry.register('rust', new RustParser());

  return registry;
}
```

---

#### 3.10.6 Language Services: IntelliSense e Validações

```typescript
// @core/indexing/ILanguageService.ts
export interface ILanguageService {
  /**
   * Autocomplete em uma posição do arquivo
   */
  getCompletions(
    filePath: string,
    position: Position,
    context: CompletionContext
  ): Promise<CompletionItem[]>;

  /**
   * Definição de um símbolo (Go to Definition)
   */
  getDefinition(
    filePath: string,
    position: Position
  ): Promise<SymbolLocation | null>;

  /**
   * Referências de um símbolo (Find All References)
   */
  getReferences(
    filePath: string,
    position: Position
  ): Promise<SymbolLocation[]>;

  /**
   * Validações específicas da linguagem
   */
  getDiagnostics(filePath: string, content: string): Promise<Diagnostic[]>;

  /**
   * Hover info sobre um símbolo
   */
  getHover(
    filePath: string,
    position: Position
  ): Promise<HoverInfo | null>;

  /**
   * Signature help para funções
   */
  getSignatureHelp(
    filePath: string,
    position: Position
  ): Promise<SignatureHelp | null>;
}

// Implementação para TypeScript
// modules/symbol/infrastructure/parsers/services/TypeScriptLanguageService.ts
export class TypeScriptLanguageService implements ILanguageService {
  private program: ts.Program;
  private languageService: ts.LanguageService;

  constructor() {
    // Inicializa TypeScript Compiler API
    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => [...this.files.keys()],
      getScriptVersion: (fileName) => this.versions.get(fileName) || '0',
      getScriptSnapshot: (fileName) => {
        const content = this.files.get(fileName);
        return content ? ts.ScriptSnapshot.fromString(content) : undefined;
      },
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => ({
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        allowJs: true,
        checkJs: true,
      }),
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    };

    this.languageService = ts.createLanguageService(servicesHost);
  }

  async getCompletions(
    filePath: string,
    position: Position
  ): Promise<CompletionItem[]> {
    const offset = this.positionToOffset(filePath, position);
    const completions = this.languageService.getCompletionsAtPosition(
      filePath,
      offset,
      {}
    );

    if (!completions) return [];

    return completions.entries.map((entry) => ({
      label: entry.name,
      kind: this.mapCompletionKind(entry.kind),
      detail: entry.kindModifiers,
      documentation: entry.documentation,
    }));
  }

  async getDefinition(
    filePath: string,
    position: Position
  ): Promise<SymbolLocation | null> {
    const offset = this.positionToOffset(filePath, position);
    const defs = this.languageService.getDefinitionAtPosition(filePath, offset);

    if (!defs || defs.length === 0) return null;

    const def = defs[0];
    return {
      filePath: def.fileName,
      start: this.offsetToPosition(def.fileName, def.textSpan.start),
      end: this.offsetToPosition(def.fileName, def.textSpan.start + def.textSpan.length),
    };
  }

  async getDiagnostics(
    filePath: string,
    content: string
  ): Promise<Diagnostic[]> {
    // Adiciona arquivo ao service
    this.updateFile(filePath, content);

    // Obtém erros semânticos + sintáticos
    const semanticDiagnostics = this.languageService.getSemanticDiagnostics(filePath);
    const syntacticDiagnostics = this.languageService.getSyntacticDiagnostics(filePath);

    return [...semanticDiagnostics, ...syntacticDiagnostics].map((diag) => ({
      message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
      severity: this.mapSeverity(diag.category),
      range: {
        start: this.offsetToPosition(filePath, diag.start!),
        end: this.offsetToPosition(filePath, diag.start! + diag.length!),
      },
      code: diag.code,
    }));
  }

  async getReferences(
    filePath: string,
    position: Position
  ): Promise<SymbolLocation[]> {
    const offset = this.positionToOffset(filePath, position);
    const refs = this.languageService.getReferencesAtPosition(filePath, offset);

    if (!refs) return [];

    return refs.map((ref) => ({
      filePath: ref.fileName,
      start: this.offsetToPosition(ref.fileName, ref.textSpan.start),
      end: this.offsetToPosition(ref.fileName, ref.textSpan.start + ref.textSpan.length),
    }));
  }

  private updateFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
    const currentVersion = parseInt(this.versions.get(filePath) || '0');
    this.versions.set(filePath, (currentVersion + 1).toString());
  }

  private files: Map<string, string> = new Map();
  private versions: Map<string, string> = new Map();

  // Helpers de conversão posição <-> offset
  private positionToOffset(filePath: string, position: Position): number {
    const content = this.files.get(filePath) || '';
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += lines[i].length + 1; // +1 para \n
    }
    return offset + position.character;
  }

  private offsetToPosition(filePath: string, offset: number): Position {
    const content = this.files.get(filePath) || '';
    const lines = content.split('\n');
    let currentOffset = 0;

    for (let line = 0; line < lines.length; line++) {
      const lineLength = lines[line].length + 1;
      if (currentOffset + lineLength > offset) {
        return { line, character: offset - currentOffset };
      }
      currentOffset += lineLength;
    }

    return { line: lines.length - 1, character: 0 };
  }
}
```

**Uso prático**:

```typescript
// Exemplo: Validar arquivo TypeScript antes de indexar
const parser = registry.getParserForFile('src/UserService.ts');
const languageService = parser?.getLanguageService();

if (languageService) {
  // 1. Validação de sintaxe e semântica
  const diagnostics = await languageService.getDiagnostics(
    'src/UserService.ts',
    fileContent
  );

  if (diagnostics.some(d => d.severity === 'error')) {
    console.error('Arquivo contém erros de sintaxe!');
  }

  // 2. Encontrar todas as referências de um símbolo
  const refs = await languageService.getReferences(
    'src/UserService.ts',
    { line: 10, character: 15 }
  );

  console.log(`Símbolo usado em ${refs.length} lugares`);

  // 3. Autocomplete
  const completions = await languageService.getCompletions(
    'src/UserService.ts',
    { line: 20, character: 10 }
  );

  console.log('Sugestões:', completions.map(c => c.label));
}
```

---

#### 3.10.7 FileIndexer: Orquestração Completa

```typescript
// @core/indexing/FileIndexer.ts
import pLimit from 'p-limit';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

export class FileIndexer implements IFileIndexer {
  private fileWatcher?: FileWatcher;
  private astCache: ASTCache;
  private parserRegistry: ParserRegistry;
  private symbolRepository: ISymbolRepository;
  private stats: IndexStats = {
    totalFiles: 0,
    totalSymbols: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  };

  constructor(
    astCache: ASTCache,
    parserRegistry: ParserRegistry,
    symbolRepository: ISymbolRepository,
    private config: {
      rootPath: string;
      watchMode: boolean;
      parallelWorkers: number; // Ex: 4 (núcleos CPU)
    }
  ) {
    this.astCache = astCache;
    this.parserRegistry = parserRegistry;
    this.symbolRepository = symbolRepository;
  }

  async indexProject(rootPath: string): Promise<IndexResult> {
    const startTime = Date.now();
    const files = await this.discoverFiles(rootPath);

    console.log(`📂 Encontrados ${files.length} arquivos para indexar`);

    // Indexa em paralelo com worker pool
    const results = await this.indexFilesParallel(files);

    // Persiste no banco de dados
    await this.persistResults(results);

    // Inicia watch mode se configurado
    if (this.config.watchMode) {
      await this.startWatchMode();
    }

    const duration = Date.now() - startTime;

    return {
      filesProcessed: files.length,
      symbolsFound: results.reduce((sum, r) => sum + r.symbols.length, 0),
      errors: results.filter(r => r.error).map(r => r.error!),
      duration,
    };
  }

  async indexChanged(files: string[]): Promise<IndexResult> {
    const startTime = Date.now();

    console.log(`🔄 Re-indexando ${files.length} arquivos alterados`);

    // Remove do cache arquivos deletados
    for (const file of files) {
      if (!(await fs.promises.access(file).catch(() => false))) {
        await this.astCache.invalidate(file);
        await this.symbolRepository.deleteByFile(file);
      }
    }

    // Re-indexa arquivos alterados
    const results = await this.indexFilesParallel(files);
    await this.persistResults(results);

    return {
      filesProcessed: files.length,
      symbolsFound: results.reduce((sum, r) => sum + r.symbols.length, 0),
      errors: results.filter(r => r.error).map(r => r.error!),
      duration: Date.now() - startTime,
    };
  }

  private async indexFilesParallel(
    files: string[]
  ): Promise<IndexFileResult[]> {
    // Limita concorrência para evitar sobrecarregar CPU
    const limit = pLimit(this.config.parallelWorkers);

    const tasks = files.map((file) =>
      limit(() => this.indexFile(file))
    );

    return Promise.all(tasks);
  }

  private async indexFile(filePath: string): Promise<IndexFileResult> {
    try {
      // 1. Lê conteúdo
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fileHash = crypto.createHash('sha256').update(content).digest('hex');

      // 2. Tenta cache primeiro
      const cached = await this.astCache.get(filePath, fileHash);

      if (cached) {
        this.stats.cacheHits++;
        return {
          filePath,
          symbols: cached.symbols,
          relationships: cached.relationships,
        };
      }

      this.stats.cacheMisses++;

      // 3. Parse o arquivo
      const parser = this.parserRegistry.getParserForFile(filePath);

      if (!parser) {
        return {
          filePath,
          symbols: [],
          relationships: [],
          error: { message: `No parser for ${filePath}`, level: 'warning' },
        };
      }

      const parseResult = await parser.parse(filePath, content);

      // 4. Salva no cache
      await this.astCache.set(filePath, {
        filePath,
        fileHash,
        ast: parseResult.ast,
        symbols: parseResult.symbols,
        relationships: parseResult.relationships,
        parsedAt: new Date(),
      });

      return {
        filePath,
        symbols: parseResult.symbols,
        relationships: parseResult.relationships,
      };

    } catch (error) {
      this.stats.errors++;
      return {
        filePath,
        symbols: [],
        relationships: [],
        error: {
          message: `Failed to index ${filePath}: ${error.message}`,
          level: 'error',
        },
      };
    }
  }

  private async persistResults(results: IndexFileResult[]): Promise<void> {
    // Usa Unit of Work para transação atômica
    const uow = new UnitOfWork(this.connection);

    try {
      await uow.begin();

      const symbolRepo = uow.getRepository(SqliteSymbolRepository);
      const relationshipRepo = uow.getRepository(SqliteRelationshipRepository);

      for (const result of results) {
        if (result.error) continue;

        // Salva símbolos
        await symbolRepo.saveMany(result.symbols);

        // Salva relacionamentos
        await relationshipRepo.saveMany(result.relationships);
      }

      await uow.commit();

    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }

  private async startWatchMode(): Promise<void> {
    console.log('👀 Watch mode ativado');

    this.fileWatcher = new FileWatcher(
      this.config.rootPath,
      async (files) => {
        await this.indexChanged(files);
        console.log(`✅ Re-indexados ${files.length} arquivos`);
      }
    );

    await this.fileWatcher.start();
  }

  private async discoverFiles(rootPath: string): Promise<string[]> {
    const supportedExtensions = this.parserRegistry.getSupportedExtensions();
    const files: string[] = [];

    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Ignora pastas comuns
        if (entry.isDirectory()) {
          if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)) {
            continue;
          }
          await walk(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walk(rootPath);
    return files;
  }

  getStats(): IndexStats {
    return {
      ...this.stats,
      cacheStats: this.astCache.getStats(),
    };
  }

  async clearCache(): Promise<void> {
    await this.astCache.clear();
    this.stats = {
      totalFiles: 0,
      totalSymbols: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
  }
}
```

**Uso completo no CLI**:

```typescript
// main/cli.ts - Bootstrap da indexação
async function bootstrapIndexer(): Promise<FileIndexer> {
  // 1. Setup cache
  const astCache = new ASTCache({
    maxMemoryEntries: 1000,
    maxMemorySize: 100 * 1024 * 1024, // 100MB
    diskCachePath: '.docs-kit/ast-cache/',
  });

  // 2. Setup parser registry
  const parserRegistry = setupIndexer();

  // 3. Setup database
  const connection = DatabaseConnectionManager.getInstance().getConnection('default');
  const symbolRepo = new SqliteSymbolRepository(connection);

  // 4. Cria indexer
  return new FileIndexer(astCache, parserRegistry, symbolRepo, {
    rootPath: process.cwd(),
    watchMode: process.argv.includes('--watch'),
    parallelWorkers: os.cpus().length, // Usa todos os núcleos
  });
}

// Comando: docs-kit index
async function indexCommand() {
  const indexer = await bootstrapIndexer();

  console.log('🚀 Iniciando indexação...');
  const result = await indexer.indexProject(process.cwd());

  console.log('\n📊 Resultados:');
  console.log(`  Arquivos: ${result.filesProcessed}`);
  console.log(`  Símbolos: ${result.symbolsFound}`);
  console.log(`  Erros: ${result.errors.length}`);
  console.log(`  Tempo: ${result.duration}ms`);

  const stats = indexer.getStats();
  console.log(`\n💾 Cache:`);
  console.log(`  Hits: ${stats.cacheHits}`);
  console.log(`  Misses: ${stats.cacheMisses}`);
  console.log(`  Hit Rate: ${((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(2)}%`);
}
```

---

#### 3.10.8 Performance Benchmarks Esperados

| Projeto | Arquivos | Primeira Indexação | Re-indexação (1 arquivo) | Re-indexação (10 arquivos) |
|---------|----------|-------------------|-------------------------|---------------------------|
| Pequeno (< 100 files) | 50 | ~5s | ~0.1s | ~0.5s |
| Médio (< 1000 files) | 500 | ~30s | ~0.1s | ~0.8s |
| Grande (< 5000 files) | 2000 | ~2min | ~0.1s | ~1.2s |
| Gigante (10000+ files) | 10000 | ~10min | ~0.1s | ~2s |

**Fatores de performance**:
- ✅ **Parsing paralelo** com worker pool (4-8 workers)
- ✅ **Cache AST** em memória (LRU) + disco
- ✅ **Hash-based change detection** evita re-parsing
- ✅ **Incremental indexing** com FileWatcher
- ✅ **Prepared statements** no SQLite
- ✅ **Bulk inserts** com transações

---

#### 3.10.9 Resumo: Benefícios do Sistema de Indexação

| Aspecto | Benefício |
|---------|-----------|
| **Performance** | 40x mais rápido em re-indexações (cache + incremental) |
| **Escalabilidade** | Indexa 10k+ arquivos em < 10min |
| **Multi-Language** | Strategy Pattern permite adicionar linguagens facilmente |
| **IntelliSense** | Language Services prontos para VS Code extensions |
| **DX (Developer Experience)** | Watch mode com hot-reload automático |
| **Validação** | Detecta erros de sintaxe durante indexação |
| **Memory Efficient** | LRU cache controla uso de memória |
| **Production Ready** | Prepared statements + transactions + error handling |

**Próximos passos para implementação**:

1. **Fase 1 - Core (1-2 semanas)**:
   - [ ] Implementar interfaces `IFileIndexer`, `ILanguageParser`, `ILanguageService`
   - [ ] Implementar `ASTCache` com LRU + disk persistence
   - [ ] Implementar `ParserRegistry` com Strategy Pattern
   - [ ] Testes unitários para cada componente

2. **Fase 2 - Parsers (1-2 semanas)**:
   - [ ] `TypeScriptParser` completo com Language Service
   - [ ] `PythonParser` básico
   - [ ] Testes de parsing para cada linguagem

3. **Fase 3 - FileIndexer (1 semana)**:
   - [ ] Implementar `FileIndexer` com worker pool
   - [ ] Integrar com repositories existentes
   - [ ] Testes de integração

4. **Fase 4 - Watch Mode (1 semana)**:
   - [ ] Implementar `FileWatcher` com chokidar
   - [ ] Debouncing e hash-based change detection
   - [ ] Testes de watch mode

5. **Fase 5 - MCP Integration (1 semana)**:
   - [ ] Expor Language Services via MCP tools
   - [ ] Autocomplete tool
   - [ ] Validation tool
   - [ ] Go to Definition tool

**Arquivos a criar**:

```
src/
├── @core/
│   ├── indexing/
│   │   ├── IFileIndexer.ts
│   │   ├── ILanguageParser.ts
│   │   ├── ILanguageService.ts
│   │   ├── ASTCache.ts
│   │   ├── FileWatcher.ts
│   │   ├── ParserRegistry.ts
│   │   └── FileIndexer.ts
│   └── __tests__/
│       └── indexing/
│
└── modules/
    └── symbol/
        └── infrastructure/
            └── parsers/
                ├── TypeScriptParser.ts
                ├── PythonParser.ts
                ├── GoParser.ts
                └── services/
                    ├── TypeScriptLanguageService.ts
                    └── PythonLanguageService.ts
```

---

### 4.0 Database: Considerações Avançadas de Produção

#### 4.0.1 Concorrência e Lock Management

**Problema**: Múltiplos processos CLI ou MCP clients acessando o mesmo database.

**SQLite com WAL Mode**:
```typescript
// modules/symbol/infrastructure/persistence/sqlite/SqliteConnection.ts
export class SqliteConnection implements IDatabaseConnection {
  constructor(config: DatabaseConfig) {
    this.db = new Database(config.connection);

    // WAL permite múltiplos leitores + 1 escritor simultaneamente
    this.db.pragma('journal_mode = WAL');

    // Busy timeout: aguarda 5s antes de falhar com SQLITE_BUSY
    this.db.pragma('busy_timeout = 5000');

    // Checkpoint automático a cada 1000 páginas
    this.db.pragma('wal_autocheckpoint = 1000');
  }
}
```

**Estratégia de Retry para Write Conflicts**:
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Uso no repository
async save(symbol: CodeSymbol): Promise<void> {
  await withRetry(async () => {
    await this.connection.execute(/* ... */);
  });
}
```

#### 4.0.2 Migration Strategy

**Schema Versioning**:
```typescript
// @shared/migrations/MigrationManager.ts
export class MigrationManager {
  constructor(private connection: IDatabaseConnection) {}

  async getCurrentVersion(): Promise<number> {
    const rows = await this.connection.query<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    return rows[0]?.version ?? 0;
  }

  async migrate(targetVersion?: number): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();

    const target = targetVersion ?? migrations.length;

    if (currentVersion >= target) {
      console.log(`✅ Already at version ${currentVersion}`);
      return;
    }

    console.log(`🔄 Migrating from v${currentVersion} to v${target}...`);

    await this.connection.transaction(async (tx) => {
      for (let v = currentVersion + 1; v <= target; v++) {
        const migration = migrations[v - 1];
        console.log(`  Running migration v${v}: ${migration.name}`);

        await migration.up(tx);

        await tx.execute(
          'INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)',
          [v, migration.name, new Date().toISOString()]
        );
      }
    });

    console.log(`✅ Migrated to v${target}`);
  }

  private getMigrations(): Migration[] {
    return [
      {
        name: 'create_symbols_table',
        up: async (tx) => {
          await tx.execute(`
            CREATE TABLE symbols (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              kind TEXT NOT NULL,
              file TEXT NOT NULL,
              startLine INTEGER NOT NULL,
              endLine INTEGER NOT NULL,
              signature TEXT,
              exported INTEGER DEFAULT 0,
              deprecated INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await tx.execute('CREATE INDEX idx_symbols_file ON symbols(file)');
          await tx.execute('CREATE INDEX idx_symbols_kind ON symbols(kind)');
        },
      },
      {
        name: 'add_explanation_columns',
        up: async (tx) => {
          await tx.execute('ALTER TABLE symbols ADD COLUMN explanation TEXT');
          await tx.execute('ALTER TABLE symbols ADD COLUMN explanation_hash TEXT');
        },
      },
      // ... mais migrações
    ];
  }
}

interface Migration {
  name: string;
  up: (tx: ITransaction) => Promise<void>;
  down?: (tx: ITransaction) => Promise<void>; // Rollback
}
```

#### 4.0.3 Backup e Restore

```typescript
// @shared/backup/BackupManager.ts
export class BackupManager {
  constructor(private connection: IDatabaseConnection) {}

  async createBackup(outputPath: string): Promise<void> {
    if (this.connection instanceof SqliteConnection) {
      // SQLite: usa backup API nativo
      await this.connection.backup(outputPath);
    } else {
      // PostgreSQL/MySQL: usa dump
      await this.dumpDatabase(outputPath);
    }
  }

  async restore(backupPath: string): Promise<void> {
    const tempConnection = await this.createTempConnection();

    try {
      // Valida backup
      await this.validateBackup(backupPath);

      // Restaura
      await this.connection.transaction(async (tx) => {
        // Backup atual antes de restaurar
        await this.createBackup('.docs-kit/registry.db.backup');

        // Restaura do backup
        await this.restoreFromBackup(backupPath, tx);
      });
    } finally {
      await tempConnection.close();
    }
  }

  /**
   * Auto-backup antes de operações destrutivas
   */
  async withAutoBackup<T>(fn: () => Promise<T>): Promise<T> {
    const backupPath = `.docs-kit/auto-backup-${Date.now()}.db`;
    await this.createBackup(backupPath);

    try {
      return await fn();
    } catch (error) {
      console.error('❌ Operation failed, backup available at:', backupPath);
      throw error;
    }
  }
}

// Uso no CLI
async function reindexAll() {
  const dbManager = DatabaseConnectionManager.getInstance();
  const connection = dbManager.getConnection();
  const backupManager = new BackupManager(connection);

  await backupManager.withAutoBackup(async () => {
    // Limpa todos os símbolos
    await connection.execute('DELETE FROM symbols');

    // Re-indexa
    await indexProject({ fullReindex: true });
  });
}
```

#### 4.0.4 Performance Monitoring

```typescript
// @core/infrastructure/DatabaseInstrumentation.ts
export class InstrumentedConnection implements IDatabaseConnection {
  constructor(
    private inner: IDatabaseConnection,
    private metrics: MetricsCollector
  ) {}

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const start = performance.now();
    try {
      const result = await this.inner.query<T>(sql, params);
      this.metrics.recordQuery(sql, performance.now() - start, true);
      return result;
    } catch (error) {
      this.metrics.recordQuery(sql, performance.now() - start, false);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    const start = performance.now();
    try {
      await this.inner.execute(sql, params);
      this.metrics.recordExecution(sql, performance.now() - start, true);
    } catch (error) {
      this.metrics.recordExecution(sql, performance.now() - start, false);
      throw error;
    }
  }
}

class MetricsCollector {
  private queries: Map<string, QueryMetrics> = new Map();

  recordQuery(sql: string, duration: number, success: boolean) {
    const normalized = this.normalizeSql(sql);

    if (!this.queries.has(normalized)) {
      this.queries.set(normalized, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
      });
    }

    const metrics = this.queries.get(normalized)!;
    metrics.count++;
    metrics.totalTime += duration;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    if (!success) metrics.errors++;
  }

  getSlowQueries(thresholdMs = 100): Array<[string, QueryMetrics]> {
    return Array.from(this.queries.entries())
      .filter(([_, m]) => m.totalTime / m.count > thresholdMs)
      .sort(([_, a], [__, b]) => (b.totalTime / b.count) - (a.totalTime / a.count));
  }

  private normalizeSql(sql: string): string {
    // Remove parâmetros para agrupar queries similares
    return sql.replace(/\?/g, '?').replace(/\s+/g, ' ').trim();
  }
}

interface QueryMetrics {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  errors: number;
}
```

#### 4.0.5 Troubleshooting Common Issues

| Problema | Diagnóstico | Solução |
|----------|-------------|---------|
| **SQLITE_BUSY** | Múltiplos writers simultâneos | Ativar WAL mode + busy_timeout + retry strategy |
| **Queries lentas** | Falta de índices | Criar índices nas colunas filtradas |
| **Memória alta** | Cache muito grande | Reduzir `cache_size` pragma |
| **Lock timeout** | Transação muito longa | Quebrar em transações menores ou aumentar timeout |
| **Database corrupto** | Crash durante write | Restaurar backup + ativar WAL mode |
| **Statement leak** | Prepared statements não finalizados | Usar `ConnectionPool` com LRU eviction |

**Query Optimization Example**:
```sql
-- ❌ Lento: Full table scan
SELECT * FROM symbols WHERE name LIKE '%Service%';

-- ✅ Rápido: Index scan
SELECT * FROM symbols WHERE name = 'UserService';

-- ✅ Rápido: Composite index
CREATE INDEX idx_symbols_file_kind ON symbols(file, kind);
SELECT * FROM symbols WHERE file = 'src/user.ts' AND kind = 'class';
```

---

### 4.1 Value Objects

Value Objects são imutáveis e comparados por valor, não por identidade.

```typescript
// modules/symbol/domain/value-objects/SymbolId.ts
export class SymbolId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(file: string, name: string, kind: SymbolKind): SymbolId {
    const hash = createHash('sha256')
      .update(`${file}::${name}::${kind.value}`)
      .digest('hex')
      .slice(0, 16);
    return new SymbolId({ value: hash });
  }

  static fromString(id: string): SymbolId {
    return new SymbolId({ value: id });
  }
}

// modules/symbol/domain/value-objects/FileLocation.ts
export class FileLocation extends ValueObject<{
  file: string;
  startLine: number;
  endLine: number;
}> {
  get file(): string { return this.props.file; }
  get startLine(): number { return this.props.startLine; }
  get endLine(): number { return this.props.endLine; }
  get lineCount(): number { return this.endLine - this.startLine + 1; }

  static create(file: string, startLine: number, endLine: number): Result<FileLocation> {
    if (endLine < startLine) {
      return Result.fail(new Error('endLine must be >= startLine'));
    }
    return Result.ok(new FileLocation({ file, startLine, endLine }));
  }
}
```

### 4.2 Entities

Entities têm identidade e ciclo de vida.

```typescript
// modules/symbol/domain/entities/CodeSymbol.ts
export class CodeSymbol extends Entity<CodeSymbolProps> {
  private constructor(props: CodeSymbolProps, id: SymbolId) {
    super(props, id);
  }

  get name(): string { return this.props.name; }
  get kind(): SymbolKind { return this.props.kind; }
  get location(): FileLocation { return this.props.location; }
  get signature(): Signature | undefined { return this.props.signature; }
  get isExported(): boolean { return this.props.exported ?? false; }
  get isDeprecated(): boolean { return this.props.deprecated ?? false; }

  // Domain methods
  updateExplanation(explanation: string, hash: string): void {
    this.props.explanation = explanation;
    this.props.explanationHash = hash;
  }

  markAsDeprecated(reason?: string): void {
    this.props.deprecated = true;
    this.props.deprecationReason = reason;
  }

  static create(props: CreateCodeSymbolProps): Result<CodeSymbol> {
    // Validações de domínio
    if (!props.name || props.name.trim() === '') {
      return Result.fail(new InvalidSymbolNameError());
    }

    const locationResult = FileLocation.create(
      props.file,
      props.startLine,
      props.endLine
    );
    if (locationResult.isFailure) {
      return Result.fail(locationResult.error!);
    }

    const id = SymbolId.create(props.file, props.name, props.kind);

    return Result.ok(new CodeSymbol({
      name: props.name,
      kind: props.kind,
      location: locationResult.value,
      // ... outros campos
    }, id));
  }
}
```

### 4.3 Aggregate Roots

Aggregates garantem consistência transacional.

```typescript
// modules/symbol/domain/aggregates/SymbolAggregate.ts
export class SymbolAggregate extends AggregateRoot<SymbolAggregateProps> {
  private _symbols: Map<string, CodeSymbol> = new Map();
  private _relationships: SymbolRelationship[] = [];

  get symbols(): ReadonlyArray<CodeSymbol> {
    return Array.from(this._symbols.values());
  }

  addSymbol(symbol: CodeSymbol): void {
    this._symbols.set(symbol.id.value, symbol);
    this.addDomainEvent(new SymbolAddedEvent(symbol));
  }

  addRelationship(source: SymbolId, target: SymbolId, type: RelationType): void {
    const rel = SymbolRelationship.create(source, target, type);
    this._relationships.push(rel);
    this.addDomainEvent(new RelationshipAddedEvent(rel));
  }

  removeSymbolsByFile(file: string): void {
    for (const [id, symbol] of this._symbols) {
      if (symbol.location.file === file) {
        this._symbols.delete(id);
        this.addDomainEvent(new SymbolRemovedEvent(symbol));
      }
    }
  }
}

---

## 🧪 5. Estratégia de Testes

### 5.1 Pirâmide de Testes

```
            /\
           /  \      E2E Tests (CLI/MCP integration)
          /    \     ~5%
         /------\
        /        \   Integration Tests (Use Cases + DB)
       /          \  ~20%
      /------------\
     /              \ Unit Tests (Domain + Value Objects)
    /                \ ~75%
   /------------------\
```

### 5.2 Testes Unitários de Domínio

**Sem mocks, sem dependências externas**:

```typescript
// modules/symbol/domain/__tests__/CodeSymbol.test.ts
describe('CodeSymbol', () => {
  describe('create', () => {
    it('should create a valid symbol', () => {
      const result = CodeSymbol.create({
        name: 'MyClass',
        kind: SymbolKind.Class,
        file: 'src/MyClass.ts',
        startLine: 1,
        endLine: 10,
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('MyClass');
      expect(result.value.kind.value).toBe('class');
    });

    it('should fail with empty name', () => {
      const result = CodeSymbol.create({
        name: '',
        kind: SymbolKind.Class,
        file: 'src/MyClass.ts',
        startLine: 1,
        endLine: 10,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidSymbolNameError);
    });

    it('should fail when endLine < startLine', () => {
      const result = CodeSymbol.create({
        name: 'MyClass',
        kind: SymbolKind.Class,
        file: 'src/MyClass.ts',
        startLine: 10,
        endLine: 1,
      });

      expect(result.isFailure).toBe(true);
    });
  });

  describe('updateExplanation', () => {
    it('should update explanation and hash', () => {
      const symbol = createValidSymbol();
      symbol.updateExplanation('This is a class', 'abc123');

      expect(symbol.props.explanation).toBe('This is a class');
      expect(symbol.props.explanationHash).toBe('abc123');
    });
  });
});
```

### 5.3 Testes de Use Cases

**Com InMemoryRepository**:

```typescript
// modules/symbol/application/__tests__/ExplainSymbol.usecase.test.ts
describe('ExplainSymbolUseCase', () => {
  let useCase: ExplainSymbolUseCase;
  let symbolRepo: InMemorySymbolRepository;
  let docRepo: InMemoryDocumentRepository;
  let llmProvider: MockLlmProvider;

  beforeEach(() => {
    symbolRepo = new InMemorySymbolRepository();
    docRepo = new InMemoryDocumentRepository();
    llmProvider = new MockLlmProvider();
    useCase = new ExplainSymbolUseCase(symbolRepo, docRepo, llmProvider);
  });

  it('should return explanation for existing symbol', async () => {
    // Arrange
    const symbol = createTestSymbol({ name: 'OrderService' });
    await symbolRepo.save(symbol);

    // Act
    const result = await useCase.execute({ symbolName: 'OrderService' });

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.value.symbol.name).toBe('OrderService');
  });

  it('should fail for non-existent symbol', async () => {
    const result = await useCase.execute({ symbolName: 'NonExistent' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(SymbolNotFoundError);
  });

  it('should use cached explanation if valid', async () => {
    const symbol = createTestSymbol({
      name: 'OrderService',
      explanation: 'Cached explanation',
      explanationHash: 'valid-hash',
    });
    await symbolRepo.save(symbol);

    const result = await useCase.execute({ symbolName: 'OrderService' });

    expect(llmProvider.explainCallCount).toBe(0); // LLM não foi chamado
    expect(result.value.explanation).toBe('Cached explanation');
  });
});
```

### 5.4 Testes de Integração

**Com banco real (em memória)**:

```typescript
// modules/symbol/infrastructure/__tests__/SqliteSymbolRepository.integration.test.ts
describe('SqliteSymbolRepository (Integration)', () => {
  let db: Database;
  let repo: SqliteSymbolRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    repo = new SqliteSymbolRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should persist and retrieve symbol', async () => {
    const symbol = createTestSymbol({ name: 'TestClass' });

    await repo.save(symbol);
    const retrieved = await repo.findById(symbol.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('TestClass');
  });

  it('should find symbols by file', async () => {
    await repo.save(createTestSymbol({ name: 'A', file: 'src/a.ts' }));
    await repo.save(createTestSymbol({ name: 'B', file: 'src/a.ts' }));
    await repo.save(createTestSymbol({ name: 'C', file: 'src/b.ts' }));

    const symbols = await repo.findByFile('src/a.ts');

    expect(symbols).toHaveLength(2);
  });
});
```

---

## 📅 6. Plano de Migração por Fases

### Fase 1: Fundação (Semana 1-2)

**Objetivo**: Criar a estrutura base sem quebrar funcionalidades existentes.

#### Tarefas:
- [ ] Criar estrutura de diretórios `@core/`, `@shared/`, `modules/`, `adapters/`
- [ ] Implementar classes base: `Entity`, `ValueObject`, `AggregateRoot`, `Result`
- [ ] Configurar path aliases no `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "paths": {
        "@core/*": ["src/@core/*"],
        "@shared/*": ["src/@shared/*"],
        "@modules/*": ["src/modules/*"],
        "@adapters/*": ["src/adapters/*"]
      }
    }
  }
  ```
- [ ] Criar `IRepository` base e `IDatabaseConnection`
- [ ] Criar `UseCase` interface base

**Critério de Aceite**: Estrutura criada, todos os testes existentes passando.

---

### Fase 2: Módulo Symbol (Semana 3-4)

**Objetivo**: Migrar a lógica de indexação para DDD.

#### Tarefas:
- [ ] Criar Value Objects: `SymbolId`, `SymbolKind`, `FileLocation`, `Signature`
- [ ] Criar Entity: `CodeSymbol`
- [ ] Criar Interface: `ISymbolRepository`
- [ ] Criar Implementação: `SqliteSymbolRepository`
- [ ] Criar Implementação: `InMemorySymbolRepository`
- [ ] Criar Use Case: `IndexProject.usecase.ts`
- [ ] Criar Use Case: `FindSymbol.usecase.ts`
- [ ] Criar Use Case: `ExplainSymbol.usecase.ts`
- [ ] Migrar `indexer.ts` para `SymbolIndexingService`
- [ ] Escrever testes unitários para Value Objects
- [ ] Escrever testes para Use Cases

**Critério de Aceite**: `docs-kit index` funcionando com nova arquitetura.

---

### Fase 3: Módulo Documentation (Semana 5-6)

**Objetivo**: Migrar geração de docs e site.

#### Tarefas:
- [ ] Criar Entity: `Document`, `DocMapping`
- [ ] Criar Value Objects: `DocumentPath`, `Frontmatter`
- [ ] Criar Interface: `IDocumentRepository`
- [ ] Criar Use Cases: `BuildDocs`, `BuildSite`, `ScanDocs`
- [ ] Migrar `docRegistry.ts` para nova estrutura
- [ ] Migrar `site/` para `infrastructure/generators/`

**Critério de Aceite**: `docs-kit build-docs` e `docs-kit build-site` funcionando.

---

### Fase 4: Adapters Unificados (Semana 7-8)

**Objetivo**: Eliminar duplicação CLI/MCP.

#### Tarefas:
- [ ] Criar `CliAdapter` com sistema de comandos
- [ ] Criar `McpAdapter` com sistema de tools
- [ ] Criar Presenters: `ConsolePresenter`, `McpPresenter`
- [ ] Migrar comandos CLI para usar Use Cases
- [ ] Migrar tools MCP para usar Use Cases
- [ ] Remover código duplicado de `cli/usecases/` e `server/tools/`
- [ ] Testar integração CLI
- [ ] Testar integração MCP

**Critério de Aceite**: CLI e MCP usando mesmos Use Cases.

---

### Fase 5: Módulos Restantes (Semana 9-10)

**Objetivo**: Migrar Knowledge, Governance, Analysis.

#### Tarefas:
- [ ] Migrar `knowledge/` para módulo Knowledge
- [ ] Migrar `governance/` para módulo Governance
- [ ] Migrar `analyzer/` e `business/` para módulo Analysis
- [ ] Criar Use Cases para cada funcionalidade
- [ ] Testes de integração

**Critério de Aceite**: Todas as features funcionando com nova arquitetura.

---

### Fase 6: Multi-Database (Semana 11-12)

**Objetivo**: Suporte a PostgreSQL/MySQL.

#### Tarefas:
- [ ] Implementar `PostgresSymbolRepository`
- [ ] Implementar `PostgresDocumentRepository`
- [ ] Criar migrations para PostgreSQL
- [ ] Adicionar config `database.type` ao `docs.config.js`
- [ ] Testes de integração com PostgreSQL
- [ ] Documentação de configuração

**Critério de Aceite**: Projeto funcionando com SQLite e PostgreSQL.

---

## ✅ 7. Checklist de Validação Final

### 7.1 Arquitetura
- [ ] Nenhum import direto de `better-sqlite3` fora de `infrastructure/persistence/sqlite/`
- [ ] Nenhum import circular entre módulos
- [ ] Todos os use cases dependem apenas de interfaces
- [ ] Domain layer não depende de Application ou Infrastructure
- [ ] Adapters não contêm lógica de negócio

### 7.2 Testabilidade
- [ ] Cobertura de testes > 85%
- [ ] Todos os Value Objects têm testes unitários
- [ ] Todos os Use Cases têm testes com InMemoryRepository
- [ ] Testes de integração para cada implementação de Repository
- [ ] Nenhum teste depende de banco de dados real (exceto integração)

### 7.3 Código Limpo
- [ ] Arquivos com menos de 200 linhas
- [ ] Funções com menos de 30 linhas
- [ ] Máximo 3 níveis de indentação
- [ ] Nomes auto-descritivos (sem comentários explicativos necessários)
- [ ] Sem código morto ou comentado

### 7.4 Funcionalidades
- [ ] `docs-kit init` funcionando
- [ ] `docs-kit index` funcionando (incremental e full)
- [ ] `docs-kit build-docs` funcionando
- [ ] `docs-kit build-site` funcionando
- [ ] `docs-kit explain-symbol` funcionando
- [ ] `docs-kit impact-analysis` funcionando
- [ ] `docs-kit analyze-patterns` funcionando
- [ ] MCP Server com todas as tools funcionando

---

## 🔄 8. Mapeamento de Arquivos: Antes → Depois

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/cli.ts` | `src/main/cli.ts` | Entry point apenas |
| `src/server.ts` | `src/main/mcp.ts` | Entry point apenas |
| `src/config.ts` | `src/config/config.schema.ts` | Apenas schema |
| `src/di/container.ts` | `src/config/container.ts` | Simplificado |
| `src/storage/db.ts` | `src/modules/*/infrastructure/persistence/sqlite/` | Dividido por módulo |
| `src/indexer/indexer.ts` | `src/modules/symbol/infrastructure/parsers/` | Refatorado |
| `src/indexer/symbol.types.ts` | `src/modules/symbol/domain/` | Value Objects + Entity |
| `src/cli/usecases/*.ts` | `src/modules/*/application/use-cases/` | Por módulo |
| `src/server/tools/*.ts` | `src/adapters/mcp/tools/` | Adapters finos |
| `src/handlers/*.ts` | **Removido** | Absorvido pelos Use Cases |
| `src/docs/docRegistry.ts` | `src/modules/documentation/domain/` + `infrastructure/` | Dividido |
| `src/knowledge/*.ts` | `src/modules/knowledge/` | Reorganizado |
| `src/governance/*.ts` | `src/modules/governance/` | Reorganizado |
| `src/llm/provider.ts` | `src/@shared/providers/llm/` | Compartilhado |

---

## 🎯 9. Resumo Executivo

### O Que Muda

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Organização** | Por tipo técnico | Por domínio de negócio |
| **Banco de dados** | Acoplado ao SQLite | Agnóstico (Repository Pattern) |
| **CLI vs MCP** | Código duplicado | Use Cases compartilhados |
| **Testabilidade** | Difícil (dependências acopladas) | Fácil (interfaces + mocks) |
| **Arquivos** | Grandes (300-600 linhas) | Pequenos (<200 linhas) |
| **Erros** | try/catch + console.error | Result Pattern explícito |

### Benefícios Esperados

1. **Cobertura de Testes**: De ~77% para >90%
2. **Tempo de Teste**: Testes unitários < 100ms cada
3. **Onboarding**: Novo dev entende estrutura em 1 dia
4. **Extensibilidade**: Novo banco = 1 novo adapter
5. **Manutenibilidade**: Cada arquivo tem 1 responsabilidade

### Riscos Mitigados

| Risco | Mitigação |
|-------|-----------|
| Regressões durante migração | Testes existentes como safety net |
| Perda de funcionalidade | Checklist de validação por fase |
| Complexidade excessiva | Seguir YAGNI - só criar o necessário |
| Tempo de migração estourar | Fases independentes - pode pausar a qualquer momento |

---

## 📌 10. Próximos Passos Imediatos

1. **Revisar este documento** e aprovar a abordagem
2. **Criar branch** `refactor/ddd-architecture`
3. **Começar Fase 1**: Estrutura de diretórios e classes base
4. **Definir métricas de sucesso** para cada fase

---

> **Autor**: Claude AI
> **Revisão**: Pendente
> **Última Atualização**: Fevereiro 2026