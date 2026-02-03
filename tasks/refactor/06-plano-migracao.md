# 📅 Plano de Migração por Fases

> [← Voltar ao Índice](./README.md)

## Timeline Geral

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Fase 1   │ Fase 2   │ Fase 3   │ Fase 4   │ Fase 5   │ Fase 6   │
│ 2 sem    │ 2 sem    │ 2 sem    │ 2 sem    │ 2 sem    │ 2 sem    │
│ Fundação │ Symbol   │ Docs     │ Adapters │ Restante │ Multi-DB │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
   ✓ Base    ✓ Core     ✓ Site    ✓ CLI/MCP  ✓ All     ✓ Postgres
```

---

## Fase 1: Fundação (Semanas 1-2)

### 🎯 Objetivo
Criar a estrutura base sem quebrar funcionalidades existentes.

### 📋 Tarefas

#### 1.1 Estrutura de Diretórios
- [ ] Criar `src/@core/domain/`
- [ ] Criar `src/@core/application/`
- [ ] Criar `src/@core/infrastructure/`
- [ ] Criar `src/@shared/types/`
- [ ] Criar `src/@shared/errors/`
- [ ] Criar `src/@shared/utils/`
- [ ] Criar `src/modules/` (vazio por enquanto)
- [ ] Criar `src/adapters/` (vazio por enquanto)
- [ ] Criar `src/config/`
- [ ] Criar `src/main/`

#### 1.2 Classes Base
- [ ] Implementar `@core/domain/Entity.ts`
- [ ] Implementar `@core/domain/ValueObject.ts`
- [ ] Implementar `@core/domain/AggregateRoot.ts`
- [ ] Implementar `@core/domain/Result.ts`
- [ ] Escrever testes para classes base

#### 1.3 Interfaces Core
- [ ] Implementar `@core/application/UseCase.ts`
- [ ] Implementar `@core/application/UnitOfWork.ts`
- [ ] Implementar `@core/infrastructure/Repository.ts`
- [ ] Implementar `@core/infrastructure/DatabaseConnection.ts`

#### 1.4 Configuração TypeScript
- [ ] Adicionar path aliases no `tsconfig.json`:
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

#### 1.5 Documentação
- [ ] Criar `docs/ARCHITECTURE.md`
- [ ] Criar `docs/CONTRIBUTION_GUIDE.md`
- [ ] Atualizar `README.md` com nova estrutura

### ✅ Critério de Aceite
- Estrutura criada
- Todos os testes existentes passando
- Build não quebrado
- Nenhuma funcionalidade afetada

### ⏱️ Tempo Estimado
**10-15 horas** (1-2 semanas part-time)

---

## Fase 2: Módulo Symbol (Semanas 3-4)

### 🎯 Objetivo
Migrar a lógica de indexação para DDD.

### 📋 Tarefas

#### 2.1 Domain Layer
- [ ] Criar `modules/symbol/domain/value-objects/SymbolId.ts`
- [ ] Criar `modules/symbol/domain/value-objects/SymbolKind.ts`
- [ ] Criar `modules/symbol/domain/value-objects/FileLocation.ts`
- [ ] Criar `modules/symbol/domain/value-objects/Signature.ts`
- [ ] Criar `modules/symbol/domain/entities/CodeSymbol.ts`
- [ ] Criar `modules/symbol/domain/entities/SymbolRelationship.ts`
- [ ] Escrever testes unitários para Value Objects
- [ ] Escrever testes unitários para Entities

#### 2.2 Repository Interfaces
- [ ] Criar `modules/symbol/domain/repositories/ISymbolRepository.ts`
- [ ] Criar `modules/symbol/domain/repositories/IRelationshipRepository.ts`
- [ ] Criar `modules/symbol/domain/repositories/IFileHashRepository.ts`

#### 2.3 Application Layer
- [ ] Criar `modules/symbol/application/use-cases/IndexProject.usecase.ts`
- [ ] Criar `modules/symbol/application/use-cases/FindSymbol.usecase.ts`
- [ ] Criar `modules/symbol/application/use-cases/ExplainSymbol.usecase.ts`
- [ ] Criar DTOs: `IndexProjectInput.dto.ts`, `SymbolOutput.dto.ts`
- [ ] Criar `modules/symbol/application/mappers/SymbolMapper.ts`
- [ ] Escrever testes para Use Cases (com InMemoryRepository)

#### 2.4 Infrastructure Layer
- [ ] Criar `modules/symbol/infrastructure/persistence/memory/InMemorySymbolRepository.ts`
- [ ] Criar `modules/symbol/infrastructure/persistence/sqlite/SqliteSymbolRepository.ts`
- [ ] Migrar código de `src/storage/db.ts` → novo repository
- [ ] Escrever testes de integração

#### 2.5 Parser Refactoring
- [ ] Criar `modules/symbol/infrastructure/parsers/TreeSitterParser.ts`
- [ ] Migrar `src/indexer/indexer.ts` → `SymbolIndexingService.ts`
- [ ] Migrar language strategies
- [ ] Escrever testes para parsers

#### 2.6 Integration
- [ ] Atualizar `src/cli/usecases/index.usecase.ts` para usar novo Use Case
- [ ] Manter compatibilidade com código legado
- [ ] Testes end-to-end

### ✅ Critério de Aceite
- `docs-kit index` funcionando com nova arquitetura
- Cobertura de testes > 85% no módulo Symbol
- Nenhuma regressão funcional
- Performance igual ou melhor

### ⏱️ Tempo Estimado
**20-25 horas** (2 semanas part-time)

---

## Fase 3: Módulo Documentation (Semanas 5-6)

### 🎯 Objetivo
Migrar geração de docs e site.

### 📋 Tarefas

#### 3.1 Domain Layer
- [ ] Criar `modules/documentation/domain/entities/Document.ts`
- [ ] Criar `modules/documentation/domain/entities/DocMapping.ts`
- [ ] Criar `modules/documentation/domain/value-objects/DocumentPath.ts`
- [ ] Criar `modules/documentation/domain/value-objects/Frontmatter.ts`
- [ ] Criar `modules/documentation/domain/repositories/IDocumentRepository.ts`

#### 3.2 Application Layer
- [ ] Criar `modules/documentation/application/use-cases/BuildDocs.usecase.ts`
- [ ] Criar `modules/documentation/application/use-cases/BuildSite.usecase.ts`
- [ ] Criar `modules/documentation/application/use-cases/ScanDocs.usecase.ts`

#### 3.3 Infrastructure Layer
- [ ] Criar `modules/documentation/infrastructure/persistence/sqlite/SqliteDocumentRepository.ts`
- [ ] Migrar `src/docs/docRegistry.ts` para nova estrutura
- [ ] Criar `modules/documentation/infrastructure/generators/MarkdownGenerator.ts`
- [ ] Criar `modules/documentation/infrastructure/generators/HtmlGenerator.ts`
- [ ] Migrar `src/site/` para generators

#### 3.4 Integration
- [ ] Atualizar CLI commands
- [ ] Atualizar MCP tools
- [ ] Testes end-to-end

### ✅ Critério de Aceite
- `docs-kit build-docs` funcionando
- `docs-kit build-site` funcionando
- Site gerado idêntico ao anterior
- Cobertura > 85%

### ⏱️ Tempo Estimado
**15-20 horas** (2 semanas part-time)

---

## Fase 4: Adapters Unificados (Semanas 7-8)

### 🎯 Objetivo
Eliminar duplicação CLI/MCP.

### 📋 Tarefas

#### 4.1 CLI Adapter
- [ ] Criar `adapters/cli/CliAdapter.ts`
- [ ] Criar `adapters/cli/commands/IndexCommand.ts`
- [ ] Criar `adapters/cli/commands/BuildSiteCommand.ts`
- [ ] Criar `adapters/cli/commands/ExplainSymbolCommand.ts`
- [ ] Criar `adapters/cli/presenters/ConsolePresenter.ts`

#### 4.2 MCP Adapter
- [ ] Criar `adapters/mcp/McpAdapter.ts`
- [ ] Criar `adapters/mcp/tools/IndexTool.ts`
- [ ] Criar `adapters/mcp/tools/ExplainSymbolTool.ts`
- [ ] Criar `adapters/mcp/tools/ImpactAnalysisTool.ts`
- [ ] Criar `adapters/mcp/presenters/McpPresenter.ts`

#### 4.3 Cleanup
- [ ] Remover `src/cli/usecases/` (código migrado)
- [ ] Remover `src/server/tools/` (código migrado)
- [ ] Remover `src/handlers/` (absorvido pelos Use Cases)
- [ ] Atualizar imports

#### 4.4 Integration
- [ ] Testar todos os comandos CLI
- [ ] Testar todas as tools MCP
- [ ] Verificar que ambos usam mesmos Use Cases

### ✅ Critério de Aceite
- CLI e MCP funcionando perfeitamente
- Zero código duplicado
- Testes de integração passando
- Documentação atualizada

### ⏱️ Tempo Estimado
**15-20 horas** (2 semanas part-time)

---

## Fase 5: Módulos Restantes (Semanas 9-10)

### 🎯 Objetivo
Migrar Knowledge, Governance, Analysis.

### 📋 Tarefas

#### 5.1 Módulo Knowledge
- [ ] Migrar `src/knowledge/` → `modules/knowledge/`
- [ ] Criar Domain Layer (entities, VOs)
- [ ] Criar Use Cases
- [ ] Criar Infrastructure (RAG adapter)

#### 5.2 Módulo Governance
- [ ] Migrar `src/governance/` → `modules/governance/`
- [ ] Criar Domain Layer
- [ ] Criar Use Cases
- [ ] Testes

#### 5.3 Módulo Analysis
- [ ] Migrar `src/analyzer/` → `modules/analysis/`
- [ ] Migrar `src/business/` → `modules/analysis/`
- [ ] Criar Use Cases
- [ ] Testes

### ✅ Critério de Aceite
- Todas as features funcionando
- Nenhum código legado restante (exceto temporário)
- Cobertura > 85% em todos os módulos

### ⏱️ Tempo Estimado
**20-25 horas** (2 semanas part-time)

---

## Fase 6: Multi-Database (Semanas 11-12)

### 🎯 Objetivo
Suporte a PostgreSQL/MySQL.

### 📋 Tarefas

#### 6.1 PostgreSQL Support
- [ ] Criar `modules/*/infrastructure/persistence/postgres/`
- [ ] Implementar `PostgresSymbolRepository`
- [ ] Implementar `PostgresDocumentRepository`
- [ ] Criar migrations para PostgreSQL

#### 6.2 Configuration
- [ ] Adicionar `database.type` ao config schema
- [ ] Criar factory de conexões
- [ ] Documentar configuração

#### 6.3 Testing
- [ ] Testes de integração com PostgreSQL
- [ ] Testes de migração SQLite → PostgreSQL
- [ ] Performance benchmarks

#### 6.4 Documentation
- [ ] Guia de migração de banco
- [ ] Comparação SQLite vs PostgreSQL
- [ ] Best practices de produção

### ✅ Critério de Aceite
- Projeto funcionando com SQLite e PostgreSQL
- Migração automática de dados
- Performance igual ou melhor
- Documentação completa

### ⏱️ Tempo Estimado
**15-20 horas** (2 semanas part-time)

---

## Estratégia de Rollout

### Abordagem Gradual

```
┌─────────────────────────────────────────────────┐
│  Fase 1-2: Fundação + Symbol (Crítico)         │
│  ├─ Branch: refactor/phase-1-2                 │
│  ├─ Review: Minuciosa                          │
│  └─ Merge: Após todos os testes passarem       │
├─────────────────────────────────────────────────┤
│  Fase 3-4: Docs + Adapters                     │
│  ├─ Branch: refactor/phase-3-4                 │
│  ├─ Base: phase-1-2                            │
│  └─ Merge: Feature flags para rollback         │
├─────────────────────────────────────────────────┤
│  Fase 5: Módulos Restantes                     │
│  ├─ Branch: refactor/phase-5                   │
│  └─ Merge: Final cleanup                       │
├─────────────────────────────────────────────────┤
│  Fase 6: Multi-Database (Opcional)             │
│  ├─ Branch: feature/postgres-support           │
│  └─ Merge: Quando necessário                   │
└─────────────────────────────────────────────────┘
```

### Rollback Plan

Cada fase tem rollback independente:

1. **Branch separado** por fase
2. **Feature flags** para funcionalidades críticas
3. **Testes de regressão** automáticos
4. **Backup de dados** antes de migrations

### Comunicação

- **Daily**: Commit messages descritivos
- **Weekly**: Status update (checklist progress)
- **Per Phase**: Review + retrospectiva

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Regressões | Média | Alto | Testes automatizados + CI/CD |
| Tempo estoura | Alta | Médio | Fases independentes (pode pausar) |
| Conflitos de merge | Média | Médio | Rebase frequente + comunicação |
| Performance degrada | Baixa | Alto | Benchmarks antes/depois |

---

> [← Arquitetura Proposta](./02-arquitetura-proposta.md) | [Voltar ao Índice](./README.md) | [Próximo: Checklist →](./07-checklist-validacao.md)
