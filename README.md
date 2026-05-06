# Docs Kit MCP

living connection between code & knowledge

**docs-kit** é um agente inteligente de documentação (via MCP) para repositórios de código. Ele usa AST (Tree-sitter) para indexar símbolos, mapeia código para docs Markdown, gera diagramas, mantém um knowledge graph em SQLite e expõe 19 ferramentas MCP para Copilot/Claude. Inclui também um **Context Inspector** interativo para visualizar exatamente o que o agente envia para a IA.

---

## O que é o sistema

- **Indexação semântica** — extrai símbolos (classes, funções, interfaces, DTOs…) de TypeScript/JS/Python/Go/PHP/Dart via Tree-sitter
- **Knowledge graph** — rastreia dependências entre símbolos e mapeia cada símbolo para seu arquivo de doc `.md`
- **19 ferramentas MCP** — disponíveis em Copilot/Claude: `getRelevantContext`, `explainSymbol`, `impactAnalysis`, `smartCodeReview`, `generateDocs`, e mais
- **Docs-Guard** — gate de CI/CD que falha o PR se símbolos foram alterados sem atualizar a documentação
- **Context Inspector** — preview interativo do contexto exato enviado para a IA, com métricas de tokens, latência e cobertura de docs

---

## Funcionalidades principais

- Indexação de símbolos via Tree-sitter (suporte multi-linguagem)
- Análise de impacto: "quem quebra se eu mudar X?"
- `docs-guard` CLI para auditar PRs em CI/CD
- Site estático com dashboard, gráficos de relacionamento, padrões detectados
- **Context Inspector** — nova página interativa no site para inspecionar qualidade do contexto
- Base persistente em SQLite (`.docs-kit/index.db`)

---

## Requisitos

- Node.js >= 18
- npm

---

## Quick Start

```bash
# Instalar dependências
npm install

# Compilar
npm run build

# Indexar o repositório
docs-kit index

# Gerar site estático
docs-kit build-site --out docs-site

# Abrir o inspector interativo (em outro terminal)
docs-kit serve --port 7337
# Abra docs-site/inspector.html no browser
```

Scripts disponíveis:

```bash
npm run build          # Compila TypeScript para dist/
npm run test           # Executa testes
npm run test:coverage  # Testes com relatório de cobertura
npm run format         # Formata código com Prettier
npm run check:deps     # Verifica dependências instaladas
```

---

## Comandos CLI (`docs-kit`)

Após `npm run build`, use `docs-kit` (se instalado/linkado) ou `node dist/cli.js`:

### SETUP

| Comando               | Descrição                                |
| --------------------- | ---------------------------------------- |
| `docs-kit init [dir]` | Cria `docs.config.js` com valores padrão |

### INDEX

| Comando                | Opções                     | Descrição                                        |
| ---------------------- | -------------------------- | ------------------------------------------------ |
| `docs-kit index [dir]` | `--db`, `--docs`, `--full` | Indexa repositório: símbolos, relações, métricas |

### BUILD

| Comando               | Opções                    | Descrição                                                       |
| --------------------- | ------------------------- | --------------------------------------------------------------- |
| `docs-kit build-site` | `--out`, `--db`, `--root` | Gera site HTML estático com dashboard, símbolo pages, inspector |
| `docs-kit build-docs` | `--out`, `--db`, `--root` | Gera documentação estruturada em Markdown                       |

### ANALYZE

| Comando                             | Opções                                | Descrição                                |
| ----------------------------------- | ------------------------------------- | ---------------------------------------- |
| `docs-kit explain-symbol <symbol>`  | `--docs`, `--db`, `--cwd`, `--no-llm` | Explica um símbolo (código + docs + LLM) |
| `docs-kit impact-analysis <symbol>` | `--max-depth`, `--db`, `--docs`       | O que quebra se este símbolo mudar       |
| `docs-kit analyze-patterns`         | `--db`                                | Detecta padrões e violações SOLID        |

### INSPECT

| Comando                     | Opções                                  | Descrição                                                                          |
| --------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs-kit inspect <symbol>` | `--file`, `--db`, `--docs`, `--verbose` | Mostra métricas de qualidade do contexto no terminal (tokens, latência, cobertura) |

### SERVER

| Comando          | Opções                          | Descrição                                         |
| ---------------- | ------------------------------- | ------------------------------------------------- |
| `docs-kit serve` | `--port 7337`, `--db`, `--docs` | Inicia API HTTP local para o inspector interativo |

> Banco padrão: `.docs-kit/index.db`. Docs padrão: `docs/`.

---

## Context Inspector

O **Context Inspector** permite visualizar exatamente o que o docs-kit envia para a IA — tokens estimados, latência, e quais partes do contexto (docs, source, relacionamentos) estão presentes.

### Via browser (interativo)

1. Gere o site: `docs-kit build-site --out docs-site`
2. Inicie o servidor local: `docs-kit serve --port 7337`
3. Abra `docs-site/inspector.html` no browser

A página exibe:

- **Badge de status** — verde quando o servidor está rodando, vermelho com instrução de como iniciar
- **Busca com autocomplete** — digita um símbolo e obtém sugestões em tempo real
- **Métricas**: tokens estimados, total de chars, latência em ms, found: sim/não
- **Badges de cobertura**: docs ✓/✗ · source ✓/✗ · relationships ✓/✗
- **Context completo** — exatamente o texto enviado para a IA, com botão "Copy"
- **Histórico** — últimas 5 buscas salvas no `localStorage`

### Via terminal

```bash
# Contexto completo de um símbolo
docs-kit inspect buildRelevantContext

# Saída:
# Symbol:  buildRelevantContext
# Found:   yes
# ---
# Tokens:  ~847   Chars: 3,388   Elapsed: 12ms
# Docs: ✓   Source: ✓   Relationships: ✓
# --- Context Preview ---
# ...

# Output completo
docs-kit inspect buildRelevantContext --verbose

# Por arquivo
docs-kit inspect --file src/knowledge/contextBuilder.ts
```

### API HTTP (para integração)

Quando `docs-kit serve` está rodando:

```bash
# Status
curl http://localhost:7337/api/health

# Contexto de um símbolo
curl "http://localhost:7337/api/context?symbol=buildRelevantContext&mode=compact"
# → { found, text, tokenEstimate, charCount, elapsedMs, hasDocs, hasSource, hasRelationships }

# Busca de símbolos
curl "http://localhost:7337/api/symbols/search?q=Registry&limit=10"
```

---

## Ferramentas MCP (Copilot / Claude)

O servidor MCP expõe **19 ferramentas** acessíveis via Copilot ou Claude. Inicie o servidor:

```bash
npm run build
node dist/server.js &
# ou configure via mcp.json
```

Principais ferramentas:

| Ferramenta                | Descrição                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getRelevantContext`      | Contexto completo para um símbolo ou arquivo (combina index, graph, docs, source)                                                                                        |
| `explainSymbol`           | Explica um símbolo em linguagem natural (LLM)                                                                                                                            |
| `impactAnalysis`          | Analisa o impacto de mudar um símbolo                                                                                                                                    |
| `generateDocs`            | Atualiza seções de docs para símbolos afetados por mudanças git                                                                                                          |
| `smartCodeReview`         | Revisão de código com múltiplas perspectivas                                                                                                                             |
| `scanFile`                | Indexa um arquivo e cria docs para símbolos não documentados                                                                                                             |
| `analyzePatterns`         | Detecta padrões de design e violações SOLID                                                                                                                              |
| `askKnowledgeBase`        | Q&A sobre código + docs (RAG + LLM)                                                                                                                                      |
| `buildTraceabilityMatrix` | Rastreabilidade requisito → código                                                                                                                                       |
| `searchSymbols`           | Busca de símbolos por nome/padrão                                                                                                                                        |
| `getFileOutline`          | Estrutura/outline de um arquivo                                                                                                                                          |
| …e mais                   | `generateMermaid`, `createOnboarding`, `describeInBusinessTerms`, `validateExamples`, `projectStatus`, `generateEventFlow`, `scanForDeadCode`, `updateSymbolExplanation` |

---

## CLI: `docs-guard`

Gate de CI/CD que falha o build se símbolos foram alterados sem atualizar a documentação correspondente.

```bash
npm run build
node dist/governance/docGuardBin.js --base main --head feature-branch

# Ou via npm link
npm link
docs-guard --base main --head feature-branch
```

Opções:

| Flag         | Padrão                  | Descrição                        |
| ------------ | ----------------------- | -------------------------------- |
| `--base`     | `main`                  | Branch/commit base para comparar |
| `--head`     | `HEAD`                  | Branch/commit head               |
| `--strict`   | `true`                  | Exit code 1 se houver violações  |
| `--db-path`  | `.docs-kit/registry.db` | Banco SQLite                     |
| `--docs-dir` | `docs`                  | Diretório de documentação        |

Saída típica quando há violações:

```
docs-guard: 2 symbol(s) changed without doc updates:
  - OrderService.createOrder (src/services/order.ts): Linked doc was not updated
  - PaymentGateway (src/services/payment.ts): No doc linked to this symbol
exit code 1
```

---

## Estrutura do projeto

```
src/
├── cli.ts              # Entrypoint da CLI (9 comandos)
├── server.ts           # Entrypoint do servidor MCP
├── analyzer/           # Git diff + AST diff → ChangeImpact[]
├── indexer/            # Tree-sitter: extração de símbolos e métricas
├── docs/               # DocRegistry, frontmatter parser, validadores de código
├── knowledge/          # Knowledge graph, contextBuilder (getRelevantContext)
├── governance/         # docs-guard CLI, arch-guard, reaper
├── llm/                # Provider abstraction (OpenAI, Claude, Ollama, Gemini)
├── server/             # MCP tools (19) + HTTP API (serve)
│   ├── http.ts         # API HTTP para o inspector (node:http nativo)
│   └── tools/          # Um arquivo por ferramenta MCP
├── site/               # Gerador de site estático (HTML + inspector.html)
└── storage/            # SQLite: símbolos, relacionamentos, registry
docs/                   # Documentação do projeto
.docs-kit/              # Banco SQLite gerado (index.db, registry.db)
```

---

## docs-config.json

Lista os documentos Markdown que aparecem na página **Docs** do site. Coloque na raiz do projeto (não dentro de `src/`):

```json
{
  "docs": [
    {
      "path": "docs/domain/arch-guard-rules.md",
      "title": "Arch Guard Rules",
      "name": "arch-guard-rules",
      "category": "domain"
    }
  ]
}
```

Campos disponíveis:

| Campo           | Descrição                                               |
| --------------- | ------------------------------------------------------- |
| `path`          | Caminho do doc no site (ex: `docs/examples/example.md`) |
| `title`         | Título exibido no índice e navegação                    |
| `name`          | Nome curto (opcional)                                   |
| `category`      | Agrupa docs na lista (ex: `domain`, `api`)              |
| `module`        | Tag para agrupar vários docs no mesmo módulo            |
| `prev` / `next` | Navegação sequencial entre docs                         |
| `sourcePath`    | Se o arquivo estiver em outro caminho ou repositório    |

---

## Contribuindo

1. Abra uma issue descrevendo a proposta
2. Crie uma branch de feature
3. Adicione/atualize testes: `npm run test`
4. Formate: `npm run format`
5. Submeta um pull request

---

## Licença

MIT
