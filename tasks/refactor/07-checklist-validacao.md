# ✅ Checklist de Validação Final

> [← Voltar ao Índice](./README.md)

Use este checklist ao final de cada fase para garantir qualidade.

## 🏗️ Arquitetura

### Separação de Responsabilidades
- [ ] Nenhum import direto de `better-sqlite3` fora de `infrastructure/persistence/sqlite/`
- [ ] Nenhum import direto de `Parser` (Tree-sitter) fora de `infrastructure/parsers/`
- [ ] Nenhum import do `fs` fora de `infrastructure/`
- [ ] Nenhuma lógica de negócio em `adapters/`
- [ ] Nenhuma lógica de apresentação em `modules/*/application/`

### Dependências
- [ ] Nenhum import circular entre módulos
- [ ] Domain layer não depende de Application ou Infrastructure
- [ ] Application layer depende apenas de Domain interfaces
- [ ] Infrastructure implementa interfaces de Domain
- [ ] Adapters dependem apenas de Application Use Cases

### Repository Pattern
- [ ] Todos os repositories implementam interface `IRepository<T, ID>`
- [ ] Cada repository tem implementação InMemory para testes
- [ ] Cada repository tem testes de integração com DB real
- [ ] Nenhum SQL fora dos repositories
- [ ] Mappers separados (Persistence DTO ↔ Domain Entity)

---

## 🧪 Testabilidade

### Cobertura
- [ ] Cobertura geral > 85%
- [ ] Domain layer > 95%
- [ ] Application layer > 90%
- [ ] Infrastructure layer > 80%

### Tipos de Testes
- [ ] Todos os Value Objects têm testes unitários
- [ ] Todas as Entities têm testes unitários
- [ ] Todos os Use Cases têm testes com InMemoryRepository
- [ ] Todos os Repositories têm testes de integração
- [ ] Adapters têm testes end-to-end

### Qualidade dos Testes
- [ ] Testes unitários < 100ms cada
- [ ] Testes de integração < 1s cada
- [ ] Nenhum teste depende de ordem de execução
- [ ] Nenhum teste depende de arquivos externos (exceto fixtures)
- [ ] Todos os testes têm AAA (Arrange, Act, Assert)

---

## 🧹 Código Limpo

### Tamanho de Arquivos
- [ ] Nenhum arquivo > 200 linhas
- [ ] Nenhuma função > 30 linhas
- [ ] Nenhuma classe > 300 linhas
- [ ] Máximo 3 níveis de indentação

### Naming
- [ ] Value Objects terminam com VO ou são descritivos (`SymbolId`, não `Id`)
- [ ] Entities são substantivos (`CodeSymbol`, `Document`)
- [ ] Use Cases terminam com `.usecase.ts` (`IndexProject.usecase.ts`)
- [ ] Repositories começam com `I` (interfaces) ou terminam com `Repository`
- [ ] Nomes auto-descritivos (sem comentários explicativos necessários)

### Code Smells
- [ ] Sem código morto ou comentado
- [ ] Sem `console.log` em produção
- [ ] Sem `any` (exceto casos justificados)
- [ ] Sem `@ts-ignore` sem comentário explicativo
- [ ] Sem números mágicos (usar constantes)

### Complexidade
- [ ] Complexidade ciclomática < 10 em todas as funções
- [ ] Nenhuma função com > 4 parâmetros (usar objeto)
- [ ] Nenhum `if-else` aninhado > 2 níveis

---

## 🎯 Funcionalidades

### CLI Commands
- [ ] `docs-kit init` funcionando
- [ ] `docs-kit index` funcionando (full + incremental)
- [ ] `docs-kit build-docs` funcionando
- [ ] `docs-kit build-site` funcionando
- [ ] `docs-kit explain-symbol <name>` funcionando
- [ ] `docs-kit impact-analysis <symbol>` funcionando
- [ ] `docs-kit analyze-patterns` funcionando
- [ ] `docs-kit --help` mostrando todos os comandos

### MCP Server
- [ ] Tool: `index` funcionando
- [ ] Tool: `explainSymbol` funcionando
- [ ] Tool: `getRelevantContext` funcionando
- [ ] Tool: `impactAnalysis` funcionando
- [ ] Tool: `analyzePatterns` funcionando
- [ ] Tool: `smartCodeReview` funcionando
- [ ] Tool: `buildDocs` funcionando
- [ ] Tool: `projectStatus` funcionando

### Regression Tests
- [ ] Site gerado é idêntico ao anterior (diff HTML)
- [ ] Índice SQLite tem mesmo schema
- [ ] Performance igual ou melhor (benchmarks)
- [ ] Nenhuma feature removida acidentalmente

---

## 🗄️ Database

### Connection Management
- [ ] Singleton pattern implementado
- [ ] Connection pool configurável
- [ ] Prepared statement cache funcionando
- [ ] WAL mode ativado (SQLite)
- [ ] Busy timeout configurado

### Transactions
- [ ] Unit of Work implementado
- [ ] Transações atômicas (rollback em erro)
- [ ] Nenhum deadlock em testes
- [ ] Retry logic para SQLITE_BUSY

### Migrations
- [ ] Schema versioning implementado
- [ ] Migrations testadas (up + down)
- [ ] Backup automático antes de migração
- [ ] Suporte a rollback

---

## 📊 Performance

### Database
- [ ] Conexão: < 1ms (com pool)
- [ ] Query simples: < 1ms
- [ ] Bulk insert (1000): < 200ms
- [ ] Transaction: < 5ms

### Indexação
- [ ] Projeto pequeno (100 files): < 10s
- [ ] Projeto médio (1000 files): < 60s
- [ ] Projeto grande (5000 files): < 5min
- [ ] Re-indexação (1 file): < 500ms

### Site Generation
- [ ] Build docs: < 5s
- [ ] Build HTML: < 10s
- [ ] Site completo: < 15s

---

## 📝 Documentação

### Código
- [ ] Todos os módulos têm README.md
- [ ] Todas as interfaces têm JSDoc
- [ ] Todos os Use Cases têm descrição
- [ ] Exemplos de uso em comentários

### Projeto
- [ ] `docs/ARCHITECTURE.md` atualizado
- [ ] `docs/CONTRIBUTION_GUIDE.md` criado
- [ ] `README.md` com nova estrutura
- [ ] Guia de migração de banco (se Fase 6)

### API
- [ ] MCP tools documentados
- [ ] CLI commands documentados
- [ ] Exemplos práticos em docs/

---

## 🔒 Segurança

### Input Validation
- [ ] Todos os inputs validados (Use Case DTOs)
- [ ] SQL injection prevenido (prepared statements)
- [ ] Path traversal prevenido (validação de caminhos)
- [ ] Nenhum `eval()` ou `Function()` em runtime

### Secrets
- [ ] Nenhuma chave hardcoded
- [ ] `.env` não commitado
- [ ] API keys via environment variables
- [ ] Nenhum token em logs

---

## 🚀 Deploy

### Build
- [ ] `npm run build` sem erros
- [ ] `npm run build` sem warnings críticos
- [ ] Bundle size razoável (< 5MB)
- [ ] Tree-shaking funcionando

### CI/CD
- [ ] Testes rodam em CI
- [ ] Linting passa em CI
- [ ] Coverage report gerado
- [ ] Build artifacts publicados

### Production Ready
- [ ] Error handling completo
- [ ] Logging estruturado
- [ ] Metrics/observability (se necessário)
- [ ] Graceful shutdown implementado

---

## ✅ Checklist por Fase

### Fase 1: Fundação
- [ ] Estrutura de diretórios criada
- [ ] Classes base implementadas e testadas
- [ ] Path aliases configurados
- [ ] Nenhum teste quebrado

### Fase 2: Symbol Module
- [ ] Domain layer completo (VOs + Entities)
- [ ] Repositories implementados (InMemory + SQLite)
- [ ] Use Cases testados
- [ ] `docs-kit index` funcionando

### Fase 3: Documentation Module
- [ ] Domain layer completo
- [ ] Generators implementados
- [ ] `docs-kit build-site` funcionando
- [ ] Site idêntico ao anterior

### Fase 4: Adapters
- [ ] CLI adapter completo
- [ ] MCP adapter completo
- [ ] Código legado removido
- [ ] Zero duplicação

### Fase 5: Restante
- [ ] Knowledge module migrado
- [ ] Governance module migrado
- [ ] Analysis module migrado
- [ ] Todas as features funcionando

### Fase 6: Multi-Database
- [ ] PostgreSQL support implementado
- [ ] Migrations funcionando
- [ ] Testes com ambos os bancos
- [ ] Documentação de produção

---

## 🎯 Definition of Done

Uma fase só está completa quando:

1. ✅ Todos os itens do checklist marcados
2. ✅ Cobertura de testes > 85%
3. ✅ Build passa sem warnings
4. ✅ Code review aprovado
5. ✅ Documentação atualizada
6. ✅ Performance igual ou melhor
7. ✅ Nenhuma regressão funcional

---

> [← Plano de Migração](./06-plano-migracao.md) | [Voltar ao Índice](./README.md) | [Próximo: Mapeamento →](./08-mapeamento-arquivos.md)
