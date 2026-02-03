# 🏗️ Refatoração: DDD + Clean Architecture

> **Status**: Em Planejamento
> **Versão**: 1.1
> **Data**: Fevereiro 2026

## 📋 Índice Geral

### Documentação Principal

1. **[Diagnóstico](./01-diagnostico.md)** - Análise da estrutura atual e problemas identificados
2. **[Arquitetura Proposta](./02-arquitetura-proposta.md)** - Nova estrutura de diretórios e justificativas
3. **[Design Patterns](./03-design-patterns.md)** - Padrões arquiteturais utilizados
4. **[Modelagem de Domínio](./04-modelagem-dominio.md)** - Value Objects, Entities e Aggregates
5. **[Estratégia de Testes](./05-estrategia-testes.md)** - Pirâmide de testes e exemplos
6. **[Plano de Migração](./06-plano-migracao.md)** - Fase a fase (12 semanas)
7. **[Checklist de Validação](./07-checklist-validacao.md)** - Critérios de aceite
8. **[Mapeamento de Arquivos](./08-mapeamento-arquivos.md)** - Onde cada arquivo vai parar

### Tópicos Especiais

#### 🗄️ Database

- **[Connection Management](./database/connection-management.md)** - Singleton + Factory + Pool Pattern
- **[Unit of Work](./database/unit-of-work.md)** - Transações cross-repository
- **[Migrations](./database/migrations.md)** - Schema versioning e rollback
- **[Backup & Restore](./database/backup-restore.md)** - Estratégias de backup
- **[Performance & Monitoring](./database/performance.md)** - Otimização e observabilidade
- **[Production Considerations](./database/production.md)** - Concorrência, locks, troubleshooting

#### 📁 File Indexing

- **[Overview](./indexing/overview.md)** - Arquitetura do sistema de indexação
- **[FileWatcher](./indexing/file-watcher.md)** - Detecção incremental de mudanças
- **[AST Cache](./indexing/ast-cache.md)** - LRU + Disk persistence
- **[Parser Registry](./indexing/parser-registry.md)** - Strategy Pattern para múltiplas linguagens
- **[Language Services](./indexing/language-services.md)** - IntelliSense e validações
- **[FileIndexer](./indexing/file-indexer.md)** - Orquestração completa
- **[Performance](./indexing/performance.md)** - Benchmarks e otimizações

## 🎯 Resumo Executivo

### Principais Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Organização** | Por tipo técnico | Por domínio de negócio |
| **Banco de dados** | Acoplado ao SQLite | Agnóstico (Repository Pattern) |
| **CLI vs MCP** | Código duplicado | Use Cases compartilhados |
| **Testabilidade** | Difícil | Fácil (interfaces + mocks) |
| **Arquivos** | Grandes (300-600 linhas) | Pequenos (<200 linhas) |
| **Performance** | Indexação lenta | 40x mais rápido (paralelo + cache) |

### Benefícios Esperados

- ✅ **Cobertura de Testes**: De ~77% para >90%
- ✅ **Performance DB**: 5-5000x mais rápido (connection pooling)
- ✅ **Performance Indexação**: 40x mais rápido (cache + paralelo)
- ✅ **Onboarding**: Novo dev entende em 1 dia
- ✅ **Extensibilidade**: Novo banco = 1 novo adapter
- ✅ **Manutenibilidade**: 1 responsabilidade por arquivo

### 📅 Timeline

| Fase | Duração | Objetivo |
|------|---------|----------|
| **Fase 1** | 2 semanas | Fundação (estrutura base) |
| **Fase 2** | 2 semanas | Módulo Symbol |
| **Fase 3** | 2 semanas | Módulo Documentation |
| **Fase 4** | 2 semanas | Adapters Unificados |
| **Fase 5** | 2 semanas | Módulos Restantes |
| **Fase 6** | 2 semanas | Multi-Database |
| **Total** | **12 semanas** | Refatoração completa |

## 🚀 Quick Start

### Para Executar a Migração

1. **Leia o [Diagnóstico](./01-diagnostico.md)** para entender os problemas atuais
2. **Revise a [Arquitetura Proposta](./02-arquitetura-proposta.md)** e aprove
3. **Crie branch**: `git checkout -b refactor/ddd-architecture`
4. **Siga o [Plano de Migração](./06-plano-migracao.md)** fase por fase
5. **Use o [Checklist](./07-checklist-validacao.md)** para validar cada fase

### Para Estudar Design Patterns

- **Repository Pattern**: Ver [Design Patterns](./03-design-patterns.md#31-repository-pattern)
- **Use Case Pattern**: Ver [Design Patterns](./03-design-patterns.md#32-use-case-pattern)
- **Database Singleton**: Ver [Database/Connection](./database/connection-management.md)
- **Unit of Work**: Ver [Database/UoW](./database/unit-of-work.md)
- **File Indexing**: Ver [Indexing/Overview](./indexing/overview.md)

### Para Implementar Features

- **Multi-Database**: Ver [Database/Connection](./database/connection-management.md)
- **Indexação Paralela**: Ver [Indexing/FileIndexer](./indexing/file-indexer.md)
- **Language Services**: Ver [Indexing/LanguageServices](./indexing/language-services.md)
- **Migrations**: Ver [Database/Migrations](./database/migrations.md)

## 📝 Convenções

- 📦 = Bounded Context / Módulo
- ✅ = Implementado
- 🚧 = Em Progresso
- ⭐ = Novo / Importante
- ❌ = Problema Identificado

## 🔗 Links Úteis

- [Domain-Driven Design (DDD)](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [SOLID Principles](https://www.digitalocean.com/community/conceptual_articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design)

---

> **Próximo Passo**: Leia o [Diagnóstico](./01-diagnostico.md) para entender os problemas atuais.
