# 🎯 Nova Arquitetura Proposta

> [← Voltar ao Índice](./README.md)

## 2.1 Estrutura de Diretórios

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

## 2.2 Justificativa das Escolhas

### ✅ Por que `@core/` e `@shared/`?

- **Shared Kernel** do DDD: componentes que pertencem a todos os bounded contexts
- O prefixo `@` indica que são módulos especiais, não domínios de negócio
- Facilita imports: `import { Entity } from '@core/domain/Entity'`

**Exemplo**:
```typescript
// ❌ Antes: confuso
import { Entity } from '../../../core/domain/Entity';

// ✅ Depois: claro
import { Entity } from '@core/domain/Entity';
```

### ✅ Por que `modules/` ao invés de manter a estrutura atual?

| Estrutura Atual | Estrutura Proposta |
|-----------------|-------------------|
| Organização por **tipo técnico** (cli/, server/, storage/) | Organização por **domínio de negócio** (symbol/, documentation/) |
| Dificulta entender o negócio | Código reflete a linguagem ubíqua |
| Dependências cruzadas inevitáveis | Bounded contexts isolados |
| "Onde fica a lógica de indexação?" → 3 pastas | "Onde fica Symbol?" → 1 pasta |

### ✅ Por que `adapters/` separado dos módulos?

- **Ports & Adapters** (Hexagonal Architecture)
- Os adapters são detalhes de infraestrutura, não domínio
- Permite adicionar novos adapters (HTTP, GraphQL) sem tocar no domínio
- CLI e MCP usam os **mesmos use cases** via interface

**Fluxo**:
```
CLI Command → CliAdapter → Use Case → Repository → Database
MCP Tool    → McpAdapter → Use Case → Repository → Database
                            ↑
                    Mesma lógica!
```

### ✅ Por que `infrastructure/persistence/sqlite/`, `/postgres/`?

- **Repository Pattern** com implementações intercambiáveis
- Banco de dados é um **detalhe de implementação**
- Migrar para PostgreSQL = criar novo adapter + alterar config

**Troca de banco**:
```javascript
// docs.config.js
export default {
  database: {
    type: 'postgres',  // Era 'sqlite'
    connection: process.env.DATABASE_URL
  }
}
```

## 2.3 Camadas da Arquitetura

### Clean Architecture (Onion)

```
┌─────────────────────────────────────────────┐
│           Adapters (CLI, MCP, HTTP)         │
│  ┌───────────────────────────────────────┐  │
│  │      Application (Use Cases)          │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │   Domain (Entities, VOs, Rules)│  │  │
│  │  │                                 │  │  │
│  │  │     Regras de Negócio Puras    │  │  │
│  │  │     (Sem dependências)         │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                       │  │
│  │  Infrastructure (DB, Parsers, LLM)   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Regra de Dependência**: Camadas internas **nunca** dependem de externas.

- ✅ `Application` pode usar `Domain`
- ✅ `Infrastructure` pode usar `Domain`
- ❌ `Domain` **NÃO** pode usar `Infrastructure`
- ❌ `Domain` **NÃO** pode usar `Application`

## 2.4 Exemplo Prático: Fluxo de Indexação

### Antes (Atual)

```typescript
// src/cli.ts
import { indexSymbols } from './cli/usecases/index.usecase';
await indexSymbols(); // Tudo acoplado
```

### Depois (DDD)

```typescript
// src/main/cli.ts
const container = setupContainer();
const indexUseCase = container.resolve<IndexProjectUseCase>('IndexProjectUseCase');

const result = await indexUseCase.execute({
  rootPath: process.cwd(),
  fullRebuild: false,
});

if (result.isFailure) {
  console.error(result.error);
  process.exit(1);
}
```

**Use Case (Testável)**:
```typescript
// src/modules/symbol/application/use-cases/IndexProject.usecase.ts
export class IndexProjectUseCase {
  constructor(
    private symbolRepo: ISymbolRepository,
    private fileIndexer: IFileIndexer,
  ) {}

  async execute(input: IndexProjectInput): Promise<Result<IndexProjectOutput>> {
    // 1. Index files
    const indexResult = await this.fileIndexer.indexProject(input.rootPath);

    // 2. Save to repository
    await this.symbolRepo.saveMany(indexResult.symbols);

    return Result.ok({
      filesProcessed: indexResult.filesProcessed,
      symbolsFound: indexResult.symbols.length,
    });
  }
}
```

**Teste Unitário**:
```typescript
describe('IndexProjectUseCase', () => {
  it('should index and save symbols', async () => {
    const mockRepo = new InMemorySymbolRepository();
    const mockIndexer = new MockFileIndexer();
    const useCase = new IndexProjectUseCase(mockRepo, mockIndexer);

    const result = await useCase.execute({ rootPath: '/test' });

    expect(result.isSuccess).toBe(true);
    expect(mockRepo.count()).toBe(10); // 10 símbolos salvos
  });
});
```

## 2.5 Comparação: Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Organização** | Por tipo técnico | Por domínio de negócio |
| **Testabilidade** | Difícil (acoplado) | Fácil (interfaces) |
| **Reusabilidade** | Código duplicado CLI/MCP | Use Cases compartilhados |
| **Manutenibilidade** | Arquivos gigantes | Arquivos pequenos e focados |
| **Escalabilidade** | Preso ao SQLite | Multi-database |
| **Onboarding** | 2-3 dias | 1 dia |

---

> [← Diagnóstico](./01-diagnostico.md) | [Voltar ao Índice](./README.md) | [Próximo: Design Patterns →](./03-design-patterns.md)
