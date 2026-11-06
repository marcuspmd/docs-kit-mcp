---
title: Índice de Documentação do docs-kit
lastUpdated: 2026-02-01
---

# Documentação Completa do docs-kit

> Agente de documentação inteligente com análise AST, RAG e integração LLM

## 📚 Visão Geral

O **docs-kit** é um sistema completo de documentação automática que:

- 🔍 **Analisa código** usando Tree-sitter para extração de símbolos
- 📝 **Atualiza docs automaticamente** quando o código muda
- 🤖 **Integra com LLMs** (OpenAI, Claude, Gemini, Ollama)
- 🔗 **Mapeia relacionamentos** entre código e documentação
- 📊 **Valida qualidade** com arch-guard e reaper
- 🔎 **Busca semântica** via RAG (embeddings)
- 🌐 **Gera sites estáticos** navegáveis em HTML

## 🏗️ Arquitetura

**[→ Visão Geral da Arquitetura](./ARCHITECTURE.md)**

Entenda como todos os componentes do sistema trabalham juntos:

- Fluxo de dados completo
- Padrões de design aplicados
- Princípios arquiteturais
- Performance e escalabilidade

## 📖 Documentação por Módulo

### Interface Layer

#### [CLI - Command Line Interface](./modules/cli.md)

Interface de linha de comando com 13 comandos explícitos e um menu interativo:

- `docs-kit index` - Indexa símbolos e relacionamentos
- `docs-kit build-site` - Gera site HTML
- `docs-kit diff` - Gera preview PR-style de mudanças e documentação
- `docs-kit check` - Exibe checks de cobertura, arquitetura e documentação
- `docs-kit inspect` - Mostra métricas de contexto para símbolos e arquivos

#### [MCP Server - Model Context Protocol](./modules/mcp-server.md)

Servidor MCP para integração com LLMs:

- 21 tools registradas
- Integração com Claude Desktop
- Suporte a clientes MCP como Copilot, Claude e ferramentas compatíveis
- Protocolo stdio para comunicação

### Módulos de Suporte

Além dos módulos centrais, o código inclui áreas especializadas que dão sustentação às ferramentas:

- [Handlers](./modules/handlers.md) - pipelines de explicação, cache e resolução de contexto
- [Business Layer](./modules/business.md) - tradução de símbolos para linguagem de negócio e matriz de rastreabilidade
- [Pattern Analyzer](./modules/patterns.md) - detecção de patterns e violações de design
- [Event Flow Analyzer](./modules/events.md) - análise e visualização de fluxos de eventos
- [Interfaces and API Sync](./modules/interfaces.md) - sincronização com contratos externos como OpenAPI
- [Dependency Injection](./modules/di.md) - wiring de serviços com `tsyringe`
- [Prompt Templates](./modules/prompts.md) - prompts tipados para LLM e atualização de docs
- [Languages and Shared Types](./modules/languages-and-types.md) - linguagens suportadas, aliases e declarações Tree-sitter

### Core Services

#### [Indexer - Extração de Símbolos](./modules/indexer.md)

Análise de código via Tree-sitter:

- Parse AST multi-linguagem
- Extração de símbolos (classes, funções, métodos)
- Detecção de relacionamentos
- Coleta de métricas (complexidade, coverage)
- Suporte incremental (file hashing)

#### [Analyzer - Detecção de Mudanças](./modules/analyzer.md)

Análise semântica de mudanças no código:

- Git diff parsing
- AST diff comparison
- Detecção de mudanças semânticas (não só textuais)
- Geração de ChangeImpacts para doc updates

#### [Docs - Gestão de Documentação](./modules/docs.md)

Sistema completo de documentação:

- **DocRegistry**: Mapeamento símbolo ↔ doc
- **DocUpdater**: Atualizações cirúrgicas (section-level)
- **DocScanner**: Detecção de símbolos sem docs
- **CodeExampleValidator**: Validação de exemplos
- **MermaidGenerator**: Geração de diagramas

### Analysis Layer

#### [Governance - Qualidade e Compliance](./modules/governance.md)

Ferramentas de governança de código:

- **Arch Guard**: Enforça regras arquiteturais
- **Reaper**: Detecta dead code e orphan docs
- **Project Status**: Relatórios de saúde
- **Smart Code Review**: Review automatizado
- **Doc Guard**: Gate para CI/CD

#### [Knowledge - Grafo e RAG](./modules/knowledge.md)

Sistema de conhecimento inteligente:

- **Knowledge Graph**: Grafo de dependências
- **RAG Index**: Busca semântica via embeddings
- **Context Builder**: Monta contexto para LLMs
- Impact analysis e traceability

### Integration Layer

#### [LLM - Abstração de Provedores](./modules/llm.md)

Interface unificada para múltiplos LLMs:

- **Providers**: OpenAI, Claude, Gemini, Ollama
- **Strategy Pattern**: Troca transparente
- **Factory**: Criação baseada em config
- Chat e embeddings padronizados

#### [Storage - Persistência SQLite](./modules/storage.md)

Camada de persistência:

- **Schema Management**: Criação e migração
- **Repository Pattern**: Abstrações para dados
- **Prepared Statements**: Performance otimizada
- **Transactions**: Operações atômicas

### Output Layer

#### [Site - Geração de Documentação](./modules/site.md)

Geradores de documentação estática:

- **HTML Generator**: Sites navegáveis
- **Markdown Generator**: Docs estruturadas
- **Smart Diagrams**: Mermaid automático
- **Search Index**: Busca client-side

## 🚀 Quick Start

### Instalação

```bash
npm install -g docs-kit
```

ou clone o repositório:

```bash
git clone https://github.com/marcuspmd/docs-kit
cd docs-kit
npm install
npm run build
npm link
```

### Uso Básico

```bash
# 1. Inicializar projeto
docs-kit init

# 2. Indexar código
docs-kit index

# 3. Gerar site
docs-kit build-site

# 4. Abrir site
open docs-site/index.html
```

### Configuração

Crie `docs.config.js`:

```javascript
export default {
  projectRoot: ".",
  include: ["src/**/*.ts"],
  exclude: ["**/node_modules/**", "**/dist/**"],
  dbPath: ".docs-kit/index.db",
  llm: {
    provider: "openai",
    model: "gpt-4-turbo",
    embeddingModel: "text-embedding-ada-002",
  },
  // Regras de governança arquitetural
  archGuard: {
    languages: [
      {
        language: "typescript",
        ignorePaths: ["**/*.test.ts", "**/__tests__/**"],
        overrideRules: [{ code: "typescript:max_complexity", config: { max: 12 } }],
      },
      {
        language: "javascript",
        excludeRules: ["typescript:missing_return_type"],
      },
    ],
  },
};
```

**Dica:** configure `archGuard.languages` em `docs.config.js` e rode `docs-kit check --checks architecture` para validar as regras contra o índice.

## 🔄 Workflows Comuns

### Workflow 1: Documentar Novo Projeto

```bash
# Inicializar
docs-kit init

# Indexar código
docs-kit index

# Escanear arquivos sem docs
docs-kit explain-symbol main

# Gerar site
docs-kit build-site
```

### Workflow 2: Atualizar Docs Após Mudanças

```bash
# Atualizar índice
docs-kit index

# Gerar docs para mudanças
docs-kit diff main --head feature/new-api

# Validar docs
docs-kit validate-examples

# Regenerar site
docs-kit build-site
```

### Workflow 3: Code Review Automatizado

```bash
# Análise completa
docs-kit check

# Status do projeto
docs-kit inspect buildRelevantContext

# Detectar dead code
docs-kit analyze-patterns

# Validar arquitetura
docs-kit analyze-patterns
```

### Workflow 4: Q&A sobre o Código

```bash
# Via CLI
docs-kit explain-symbol AuthService

# Via MCP (Claude Desktop)
# Use a tool "askKnowledgeBase" diretamente no chat
```

## 🧪 Testing

```bash
# Rodar todos os testes
npm test

# Testes específicos
npm test -- analyzer.test.ts

# Com coverage
npm test -- --coverage
```

## 📊 Métricas e Análises

### Análise de Impacto

```bash
docs-kit impact-analysis OrderService --max-depth 3
```

Mostra todos os símbolos afetados se `OrderService` mudar.

### Matriz de Rastreabilidade

```bash
Use a tool MCP `buildTraceabilityMatrix`.
```

Liga tickets → símbolos → testes → docs.

### Event Flow

```bash
Use a tool MCP `generateEventFlow`.
```

Gera diagrama de event emitters e listeners.

### Padrões de Design

```bash
docs-kit analyze-patterns
```

Detecta patterns (Factory, Singleton, etc.) e violations (SOLID).

## 🔌 Integrações

### CI/CD (GitHub Actions)

```yaml
- name: Check docs updated
  run: docs-kit docs-guard --base main --head ${{ github.sha }}
```

### Claude Desktop (MCP)

```json
{
  "mcpServers": {
    "docs-kit": {
      "command": "node",
      "args": ["/path/to/docs-kit/dist/server.js"],
      "cwd": "/path/to/project"
    }
  }
}
```

### VS Code Extension (Futuro)

Comandos planejados:

- Explain Symbol at Cursor
- Generate Docs for File
- Update Documentation
- Search Knowledge Base

## 🎯 Best Practices

### Frontmatter

Sempre inclua `symbols` no frontmatter:

```markdown
---
title: Order Service
symbols:
  - OrderService
  - createOrder
lastUpdated: 2024-01-15
---
```

### Documentação Incremental

Use `docs-kit scan-file` para documentar progressivamente:

```bash
# Documenta um arquivo por vez
Use a tool MCP `scanFile` para documentar um arquivo por vez.
```

### Arch Guard

Inicie com regras base e customize:

```bash
Configure `archGuard` em `docs.config.js` e rode `docs-kit check --checks architecture`.
```

### RAG Index

Mantenha o índice atualizado:

```bash
# Reindexar após mudanças
docs-kit index
```

## 🐛 Troubleshooting

### Problema: "Database not found"

```bash
# Solução: Indexar primeiro
docs-kit index
```

### Problema: "No symbol found"

```bash
# Verificar se arquivo está nos patterns include
cat docs.config.js

# Reindexar com --full
docs-kit index --full
```

### Problema: "LLM API error"

```bash
# Verificar environment variables
echo $OPENAI_API_KEY

# Testar com Ollama local
# Editar docs.config.js:
# llm: { provider: "ollama", ... }
```

## 📝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -am 'Add nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

MIT

## 🤝 Suporte

- **Issues**: [GitHub Issues](https://github.com/marcuspmd/docs-kit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/marcuspmd/docs-kit/discussions)
- **Email**: support@docs-kit.dev

## 🗺️ Roadmap

### v1.1 (Q2 2026)

- [ ] VS Code Extension
- [ ] Approximate NN para RAG (FAISS)
- [ ] Worker threads para parallel parsing
- [ ] Python, PHP, Go support

### v1.2 (Q3 2026)

- [ ] Web UI (dashboard)
- [ ] Realtime doc updates
- [ ] Team collaboration features
- [ ] Docker support

### v2.0 (Q4 2026)

- [ ] Cloud-hosted version
- [ ] Multi-repo support
- [ ] Advanced analytics
- [ ] API for integrations

## 🙏 Agradecimentos

- [Tree-sitter](https://tree-sitter.github.io/) - AST parsing
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite binding
- [Model Context Protocol](https://modelcontextprotocol.io/) - LLM integration
- Comunidade open source

---

**docs-kit** - Documentação inteligente e sempre atualizada 🚀
