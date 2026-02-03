# 🔍 Diagnóstico da Estrutura Atual

> [← Voltar ao Índice](./README.md)

## 1.1 Problemas Identificados

### ❌ Duplicação de Lógica CLI/MCP

```
src/cli/usecases/explainSymbol.usecase.ts  → Lógica para CLI
src/server/tools/explainSymbol.tool.ts     → Mesma lógica duplicada para MCP
src/handlers/explainSymbol.ts              → Handler compartilhado (parcial)
```

**Problema**: Três arquivos para o mesmo caso de uso, com código duplicado e divergências.

**Impacto**:
- Manutenção duplicada
- Bugs surgem em uma interface mas não na outra
- Dificuldade para adicionar novas features
- Testes precisam cobrir dois caminhos diferentes

### ❌ Acoplamento Forte com SQLite

```typescript
// src/storage/db.ts - Acoplado diretamente ao better-sqlite3
import Database from "better-sqlite3";

export function createSymbolRepository(db: Database.Database): SymbolRepository {
  // ...
}
```

**Problema**: Impossível trocar para PostgreSQL/MySQL sem reescrever todo o código.

**Impacto**:
- Preso ao SQLite para sempre
- Impossível escalar para cenários multiusuário (PostgreSQL)
- Testes precisam de banco real (lento)
- Difícil mockar em testes unitários

### ❌ Arquivos Gigantes e Difíceis de Testar

| Arquivo | Linhas | Responsabilidades |
|---------|--------|-------------------|
| `index.usecase.ts` | 600+ | Indexação, parsing, métricas, governance, RAG |
| `db.ts` | 500+ | Schema, 4 repositories, queries |
| `indexer.ts` | 400+ | AST walk, metadata, layer detection |

**Problema**: Arquivos com múltiplas responsabilidades impossíveis de testar isoladamente.

**Impacto**:
- Difícil entender o que o código faz
- Impossível testar isoladamente
- Alto risco de bugs ao alterar
- Onboarding de novos desenvolvedores é lento

### ❌ Container DI Monolítico

```typescript
// src/di/container.ts - 100+ linhas de setup
export async function setupContainer(...) {
  // 16 dependências registradas manualmente
  // Lógica de negócio misturada com configuração
}
```

**Problema**: Difícil mockar dependências em testes.

**Impacto**:
- Testes de integração são obrigatórios (lentos)
- Impossível fazer testes unitários puros
- Setup de testes é complexo
- Difícil adicionar novos módulos

## 1.2 Bounded Contexts Identificados

Após análise do código, identificamos **5 domínios (bounded contexts) distintos**:

| Bounded Context | Responsabilidade | Arquivos Atuais |
|-----------------|------------------|-----------------|
| **Symbol** 📦 | Indexação, parsing AST, extração de símbolos | `indexer/`, `patterns/` |
| **Documentation** 📄 | Registro de docs, frontmatter, geração de site | `docs/`, `site/` |
| **Knowledge** 🧠 | Grafo de conhecimento, RAG, contexto | `knowledge/` |
| **Governance** 🛡️ | ArchGuard, Reaper, validações | `governance/` |
| **Analysis** 🔬 | Diff, impacto, code review | `analyzer/`, `business/` |

### Por que são Bounded Contexts?

Cada um deles:
- ✅ Tem **linguagem ubíqua** própria (vocabulário do domínio)
- ✅ Pode evoluir **independentemente**
- ✅ Tem equipe/responsável diferente (em projetos grandes)
- ✅ Pode ter **persistência própria** (diferentes bancos/schemas)

### Relacionamentos entre Contextos

```
┌──────────┐
│  Symbol  │───┐
└──────────┘   │
       │       │
       ▼       ▼
┌──────────────────┐      ┌──────────┐
│  Documentation   │─────▶│Knowledge │
└──────────────────┘      └──────────┘
       │                        │
       ▼                        ▼
┌──────────────────┐      ┌──────────┐
│   Governance     │      │ Analysis │
└──────────────────┘      └──────────┘
```

- **Symbol** → **Documentation**: Símbolos mapeados para docs
- **Documentation** → **Knowledge**: Docs alimentam grafo de conhecimento
- **Symbol** → **Analysis**: Análise de impacto usa símbolos
- **Knowledge** → **Analysis**: Contexto para análises

## 1.3 Métricas Atuais

### Cobertura de Testes

```
✅ All files         : 77.09%  (antes da refatoração)
```

**Áreas com baixa cobertura**:
- `src/cli/usecases/index.usecase.ts`: ~30% (muito complexo para testar)
- `src/storage/db.ts`: ~50% (acoplado ao SQLite)
- `src/di/container.ts`: 0% (difícil mockar)

### Complexidade Ciclomática

| Arquivo | Função | Complexidade |
|---------|--------|--------------|
| `cli.ts` | `main` | 12 (⚠️ alto) |
| `gitDiff.ts` | `parseGitDiff` | 29 (❌ muito alto) |
| `docRegistry.ts` | `createDocRegistry` | 24 (❌ muito alto) |
| `indexer.ts` | `indexFile` | 15 (⚠️ alto) |

**Meta**: Complexidade < 10 em todas as funções

### Tamanho de Arquivos

| Arquivo | LOC | Meta |
|---------|-----|------|
| `index.usecase.ts` | 600+ | < 200 |
| `db.ts` | 500+ | < 200 |
| `indexer.ts` | 400+ | < 200 |
| `docRegistry.ts` | 300+ | < 200 |

## 1.4 Problemas de Performance

### Indexação Lenta

**Situação atual**:
- Indexação sequencial (1 arquivo por vez)
- Sem cache de AST
- Re-parsing desnecessário em watch mode
- Sem detecção incremental eficiente

**Impacto**:
- 10000 arquivos = ~10-15 minutos
- Watch mode lento (re-indexa tudo)
- UX ruim para desenvolvedores

### Database Overhead

**Situação atual**:
- Nova conexão a cada operação (overhead de 50ms)
- Sem prepared statement cache
- Transações pequenas repetidas
- Sem connection pooling

**Impacto**:
- Queries simples levam 5ms (deveria ser 0.5ms)
- Bulk inserts lentos (sem batch)
- Concorrência ruim (locks frequentes)

## 1.5 Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Vendor lock-in (SQLite) | Alta | Alto | Repository Pattern |
| Escalabilidade limitada | Média | Alto | Multi-database support |
| Dificuldade de testes | Alta | Médio | DI + Interfaces |
| Código Legacy crescente | Alta | Alto | Refatoração contínua |
| Performance degrada | Média | Médio | Benchmarks + Monitoring |

## 1.6 Conclusão

A arquitetura atual funcionou bem para MVP, mas está atingindo seus limites:

❌ **Problemas críticos**:
1. Código duplicado (CLI/MCP)
2. Acoplamento forte (SQLite)
3. Baixa testabilidade
4. Performance subótima

✅ **O que já funciona**:
1. Features completas e estáveis
2. Testes existentes (77% coverage)
3. Arquitetura modular (parcial)

🎯 **Próximo passo**: [Ver Arquitetura Proposta](./02-arquitetura-proposta.md)

---

> [← Voltar ao Índice](./README.md) | [Próximo: Arquitetura Proposta →](./02-arquitetura-proposta.md)
