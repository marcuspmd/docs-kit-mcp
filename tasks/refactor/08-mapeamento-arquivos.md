# 🔄 Mapeamento de Arquivos: Antes → Depois

> [← Voltar ao Índice](./README.md)

Este guia mostra onde cada arquivo atual vai parar na nova arquitetura.

---

## Entry Points

| Arquivo Atual | Novo Local | Motivo |
|---------------|------------|--------|
| `src/cli.ts` | `src/main/cli.ts` | Entry point puro, sem lógica |
| `src/server.ts` | `src/main/mcp.ts` | Entry point MCP Server |

---

## Core & Config

| Arquivo Atual | Novo Local | Motivo |
|---------------|------------|--------|
| `src/config.ts` | `src/config/config.schema.ts` | Apenas schema Zod |
| `src/configLoader.ts` | `src/config/configLoader.ts` | Mantém |
| `src/di/container.ts` | `src/config/container.ts` | Simplificado |

---

## Módulo Symbol

### Domain

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/indexer/symbol.types.ts` | 📦 **Dividido em**: | |
| - `type SymbolKind` | `src/modules/symbol/domain/value-objects/SymbolKind.ts` | VO |
| - `type CodeSymbol` | `src/modules/symbol/domain/entities/CodeSymbol.ts` | Entity |
| - `type SymbolRelationship` | `src/modules/symbol/domain/entities/SymbolRelationship.ts` | Entity |

### Application

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/cli/usecases/index.usecase.ts` | 📦 **Dividido em**: | |
| - `indexSymbols()` | `src/modules/symbol/application/use-cases/IndexProject.usecase.ts` | Use Case |
| - `explainSymbol()` | `src/modules/symbol/application/use-cases/ExplainSymbol.usecase.ts` | Use Case |
| `src/handlers/explainSymbol.ts` | **Removido** | Absorvido pelo Use Case |

### Infrastructure

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/storage/db.ts` | 📦 **Dividido em**: | |
| - `createSymbolRepository()` | `src/modules/symbol/infrastructure/persistence/sqlite/SqliteSymbolRepository.ts` | Repository |
| - `createRelationshipRepository()` | `src/modules/symbol/infrastructure/persistence/sqlite/SqliteRelationshipRepository.ts` | Repository |
| - `createFileHashRepository()` | `src/modules/symbol/infrastructure/persistence/sqlite/SqliteFileHashRepository.ts` | Repository |
| `src/indexer/indexer.ts` | 📦 **Dividido em**: | |
| - `indexFile()` | `src/modules/symbol/infrastructure/parsers/TreeSitterParser.ts` | Parser |
| - `extractSymbols()` | `src/modules/symbol/infrastructure/parsers/strategies/TypeScriptStrategy.ts` | Strategy |
| `src/indexer/languages/*.ts` | `src/modules/symbol/infrastructure/parsers/strategies/` | Mantém estrutura |
| `src/patterns/` | `src/modules/symbol/domain/services/PatternDetectionService.ts` | Domain Service |

---

## Módulo Documentation

### Domain

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/docs/docRegistry.ts` | 📦 **Dividido em**: | |
| - `type DocMapping` | `src/modules/documentation/domain/entities/Document.ts` | Entity |
| - `type Frontmatter` | `src/modules/documentation/domain/value-objects/Frontmatter.ts` | VO |

### Application

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/cli/usecases/buildSite.usecase.ts` | `src/modules/documentation/application/use-cases/BuildSite.usecase.ts` | Use Case |
| `src/cli/usecases/buildDocs.usecase.ts` | `src/modules/documentation/application/use-cases/BuildDocs.usecase.ts` | Use Case |
| `src/cli/usecases/scanFile.usecase.ts` | `src/modules/documentation/application/use-cases/ScanDocs.usecase.ts` | Use Case |

### Infrastructure

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/storage/db.ts` (parte docs) | `src/modules/documentation/infrastructure/persistence/sqlite/SqliteDocumentRepository.ts` | Repository |
| `src/site/generator.ts` | `src/modules/documentation/infrastructure/generators/HtmlGenerator.ts` | Generator |
| `src/site/templates/*.ts` | `src/modules/documentation/infrastructure/generators/templates/` | Templates |
| `src/docs/docUpdater.ts` | `src/modules/documentation/infrastructure/generators/MarkdownGenerator.ts` | Generator |
| `src/docs/mermaidGenerator.ts` | `src/modules/documentation/infrastructure/generators/MermaidDiagramGenerator.ts` | Generator |

---

## Módulo Knowledge

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/knowledge/contextBuilder.ts` | 📦 **Dividido em**: | |
| - Domain entities | `src/modules/knowledge/domain/entities/KnowledgeNode.ts` | Entity |
| - Build logic | `src/modules/knowledge/application/use-cases/BuildContext.usecase.ts` | Use Case |
| `src/knowledge/relationshipExtractor.ts` | `src/modules/knowledge/domain/services/RelationshipExtractionService.ts` | Domain Service |
| `src/knowledge/symbolGraph.ts` | `src/modules/knowledge/domain/services/GraphTraversalService.ts` | Domain Service |

---

## Módulo Governance

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/governance/archGuard.ts` | 📦 **Dividido em**: | |
| - Rules domain | `src/modules/governance/domain/value-objects/ArchRule.ts` | VO |
| - Validation | `src/modules/governance/domain/services/ArchGuardService.ts` | Service |
| - Use case | `src/modules/governance/application/use-cases/AnalyzeArchitecture.usecase.ts` | Use Case |
| `src/governance/reaper.ts` | 📦 **Dividido em**: | |
| - Findings | `src/modules/governance/domain/entities/ReaperFinding.ts` | Entity |
| - Service | `src/modules/governance/domain/services/ReaperService.ts` | Service |
| - Use case | `src/modules/governance/application/use-cases/ScanDeadCode.usecase.ts` | Use Case |
| `src/governance/docGuard.ts` | `src/modules/governance/application/use-cases/ValidateDocs.usecase.ts` | Use Case |
| `src/governance/smartCodeReview.ts` | `src/modules/governance/application/use-cases/SmartCodeReview.usecase.ts` | Use Case |

---

## Módulo Analysis

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/analyzer/astDiff.ts` | `src/modules/analysis/domain/services/AstDiffService.ts` | Domain Service |
| `src/analyzer/changeAnalyzer.ts` | `src/modules/analysis/domain/services/ChangeAnalysisService.ts` | Domain Service |
| `src/analyzer/gitDiff.ts` | `src/modules/analysis/infrastructure/git/GitDiffParser.ts` | Infrastructure |
| `src/business/businessTranslator.ts` | `src/modules/analysis/application/use-cases/TranslateToBusinessTerms.usecase.ts` | Use Case |
| `src/business/contextMapper.ts` | `src/modules/analysis/domain/services/ContextMappingService.ts` | Domain Service |
| `src/business/rtm.ts` | `src/modules/analysis/application/use-cases/BuildRTM.usecase.ts` | Use Case |

---

## Adapters

### CLI

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/cli/usecases/*.usecase.ts` | **Removido** | Use Cases movidos para modules |
| `src/cli/utils/args.ts` | `src/adapters/cli/utils/args.ts` | Helper CLI |
| `src/cli/utils/help.ts` | `src/adapters/cli/commands/HelpCommand.ts` | Command |
| `src/cli/utils/logger.ts` | `src/adapters/cli/presenters/ConsolePresenter.ts` | Presenter |
| **Novo** | `src/adapters/cli/CliAdapter.ts` | Adapter principal |
| **Novo** | `src/adapters/cli/commands/IndexCommand.ts` | Thin wrapper do Use Case |

### MCP

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/server/tools/*.tool.ts` | **Removido** | Lógica absorvida pelos Use Cases |
| **Novo** | `src/adapters/mcp/McpAdapter.ts` | Adapter principal |
| **Novo** | `src/adapters/mcp/tools/IndexTool.ts` | Thin wrapper do Use Case |
| **Novo** | `src/adapters/mcp/presenters/McpPresenter.ts` | Formata resultado para MCP |

---

## Shared & Core

| Arquivo Atual | Novo Local | Observação |
|---------------|------------|------------|
| `src/types/*.ts` | `src/@shared/types/` | Types globais |
| `src/constants/*.ts` | `src/@shared/constants/` | Constantes |
| `src/llm/provider.ts` | `src/@shared/providers/llm/LlmProvider.ts` | Provider abstrato |
| `src/llm/providers/*.ts` | `src/@shared/providers/llm/providers/` | Implementações |
| `src/events/*.ts` | `src/@core/domain/events/` | Domain Events |

---

## Arquivos Removidos

Serão **deletados** após migração completa:

- ❌ `src/cli/usecases/*.usecase.ts` → Movidos para `modules/*/application/use-cases/`
- ❌ `src/server/tools/*.tool.ts` → Substituídos por thin adapters
- ❌ `src/handlers/*.ts` → Lógica absorvida pelos Use Cases
- ❌ `src/storage/db.ts` → Dividido em repositories específicos
- ❌ `src/di/container.ts` → Simplificado em `config/container.ts`

---

## Arquivos Criados do Zero

### Classes Base (@core)
- `src/@core/domain/Entity.ts`
- `src/@core/domain/ValueObject.ts`
- `src/@core/domain/AggregateRoot.ts`
- `src/@core/domain/Result.ts`
- `src/@core/application/UseCase.ts`
- `src/@core/application/UnitOfWork.ts`
- `src/@core/infrastructure/Repository.ts`
- `src/@core/infrastructure/DatabaseConnection.ts`

### Adapters
- `src/adapters/cli/CliAdapter.ts`
- `src/adapters/mcp/McpAdapter.ts`
- Todos os `Command` e `Tool` files

### Config & DI
- `src/config/container.ts`
- `src/config/database.ts`

---

## Resumo de Impacto

| Categoria | Antes | Depois | Delta |
|-----------|-------|--------|-------|
| **Arquivos totais** | ~150 | ~200 | +50 |
| **LOC médio/arquivo** | ~250 | ~100 | -60% |
| **Diretórios principais** | 12 | 20 | +8 |
| **Imports cross-module** | ~80 | ~20 | -75% |

**Por que mais arquivos?**
- Arquivos grandes → múltiplos arquivos pequenos
- 1 responsabilidade por arquivo
- Melhor organização e testabilidade

---

> [← Checklist](./07-checklist-validacao.md) | [Voltar ao Índice](./README.md)
