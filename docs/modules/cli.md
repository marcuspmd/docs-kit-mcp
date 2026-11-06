---
title: CLI (Command Line Interface)
module: cli
lastUpdated: 2026-05-11
symbols:
  - main
  - runInit
  - runIndex
  - runBuildSite
  - runBuildDocs
  - runDiff
  - runImpactAnalysis
  - runAnalyzePatterns
---

# CLI - Command Line Interface

> O módulo CLI fornece uma interface de linha de comando completa para todas as funcionalidades do docs-kit.

## Visão Geral

O CLI (`src/cli.ts`) é o ponto de entrada principal para interação com o docs-kit via terminal. Ele oferece comandos para indexação de código, geração de documentação, análise de qualidade, e muito mais.

## Arquitetura

```typescript
main() → parseArgs() → runCommand()
  ├─> runInit()            // Inicializa projeto
  ├─> runIndex()           // Indexação de símbolos
  ├─> runBuildSite()       // Geração de site HTML
  ├─> runBuildDocs()       // Geração de Markdown
  ├─> runProjectTree()     // Snapshot da árvore do projeto
  ├─> runDiff()            // Preview de diff Git
  ├─> runImpactAnalysis()  // Análise de impacto
  ├─> runAnalyzePatterns() // Análise de patterns
  ├─> runExplainSymbol()   // Explicação de símbolo
  ├─> runCheck()           // Checks locais
  ├─> runInspect()         // Métricas de contexto
  ├─> runOpenSite()        // Gera e serve site v2
  └─> runServe()           // API HTTP local do inspector
```

## Comandos Disponíveis

Fonte de verdade: o dispatch em `src/cli.ts`. O binário atual expõe 13 comandos explícitos e, quando executado sem argumentos em um terminal interativo, abre o menu TUI.

| Grupo        | Comandos                                                |
| ------------ | ------------------------------------------------------- |
| Setup        | `init`                                                  |
| Index        | `index`                                                 |
| Build        | `build-site`, `build-docs`, `project-tree`              |
| Diff Preview | `diff`                                                  |
| Analyze      | `explain-symbol`, `impact-analysis`, `analyze-patterns` |
| Check        | `check`                                                 |
| Inspect      | `inspect`                                               |
| Server       | `open-site`, `serve`                                    |
| Interactive  | sem comando, apenas `docs-kit` em TTY                   |

### `docs-kit index [dir]`

Indexa o repositório extraindo símbolos, relacionamentos e métricas.

**Opções:**

- `--db <path>`: Caminho do banco de dados SQLite (padrão: `.docs-kit/index.db`)
- `--docs <dir>`: Diretório de documentação (padrão: `docs`)
- `--full`: Força rebuild completo, ignorando cache de arquivos
- `--site`: Gera e serve o site v2 após indexar
- `--port <n>`: Porta usada com `--site` (padrão: `3000`)
- `--out <dir>`: Diretório do site usado com `--site` (padrão: `docs-site-v2`)

**Fluxo de Execução:**

1. **Carrega configuração** do `docs.config.js`
2. **Escaneia arquivos** usando patterns include/exclude do config
3. **Parse AST** com Tree-sitter para cada arquivo
4. **Extrai símbolos** (classes, funções, interfaces, etc.)
5. **Extrai relacionamentos** (chamadas, extensões, implementações)
6. **Coleta métricas** (complexidade, cobertura de testes)
7. **Detecta patterns** (design patterns, SOLID violations)
8. **Persiste no SQLite** com transações otimizadas
9. **Escaneia docs** e popula `doc_mappings`
10. **Executa governance** (arch-guard + reaper)
11. **Popula RAG index** (embeddings para busca semântica)

**Otimizações:**

- **Incremental indexing**: Usa SHA256 hash para detectar arquivos modificados
- **File hash tracking**: Tabela `file_hashes` evita re-indexação
- **Batch inserts**: Usa transações do SQLite para performance

**Exemplo:**

```bash
# Indexação básica
docs-kit index

# Indexa subdiretório específico
docs-kit index ./src/analyzer

# Rebuild completo
docs-kit index --full

# Custom database path
docs-kit index --db ./custom/path.db
```

### `docs-kit build-site`

Gera site HTML estático navegável.

**Opções:**

- `--out <dir>`: Diretório de saída (padrão: `docs-site`)
- `--db <path>`: Database path
- `--root <dir>`: Diretório raiz do projeto

**Saída:**

- `index.html`: Página principal com estatísticas
- `symbols/*.html`: Página para cada símbolo
- `files/*.html`: Página para cada arquivo fonte
- `docs.html`: Lista de documentação
- `patterns.html`: Patterns detectados
- `governance.html`: Arch violations + reaper findings
- `relationships.html`: Grafo de relacionamentos

**Exemplo:**

```bash
docs-kit build-site --out ./public
```

### `docs-kit build-docs`

Gera documentação Markdown estruturada.

**Exemplo:**

```bash
docs-kit build-docs --out ./docs-output
```

### `docs-kit project-tree [dir]`

Gera um snapshot Markdown da estrutura de pastas e arquivos do projeto para contexto de LLMs.

**Opções:**

- `--out <file>`: Arquivo de saída (padrão: `STRUCTURE.md`). Use `--out -` para imprimir no terminal.
- `--depth <n>`: Profundidade máxima da árvore (padrão: `4`).
- `--include <glob,csv>`: Globs adicionais para filtrar entradas quando não estiver em modo source-only.
- `--exclude <glob,csv>`: Globs extras para omitir da árvore.
- `--dirs-only`: Mostra apenas diretórios.
- `--source-only`: Usa os patterns `include` do `docs.config.js` para focar em arquivos fonte.
- `--max-entries-per-dir <n>`: Limita a quantidade de itens exibidos por diretório.

**Exemplo:**

```bash
# Gera STRUCTURE.md na raiz do projeto
docs-kit project-tree

# Gera uma árvore curta, só com diretórios
docs-kit project-tree --dirs-only --depth 2

# Imprime no terminal para redirecionar ou colar em um prompt
docs-kit project-tree --out - --source-only
```

### `docs-kit diff <base>`

Gera um preview de documentação e site limitado ao diff Git da branch atual contra a base informada.

**Opções:**

- `--head <ref>`: Ref head para comparar (padrão: `HEAD`)
- `--out <dir>`: Diretório do site v2 filtrado (padrão: `docs-site-diff`)
- `--db <path>`: Database path (padrão: `.docs-kit/index.db`)
- `--docs <dir>`: Diretório de documentação (padrão: `docs`)
- `--strict`: Retorna exit code 1 se o Docs-Guard encontrar violações
- `--ai-review`: Gera resumo de code review por IA quando houver provider LLM configurado

**Fluxo:**

1. Usa comparação PR-style `base...HEAD` via merge-base
2. Calcula símbolos impactados semanticamente pelo diff
3. Gera preview dry-run das mudanças de documentação sem escrever arquivos `.md`
4. Avalia Docs-Guard para encontrar símbolos alterados sem documentação atualizada
5. Gera site v2 filtrado em `docs-site-diff/` com painel de Diff Preview
6. Mostra preview PR-style por símbolo, pareando o diff do código com o diff dry-run que entraria na documentação/site
7. Exibe diff lado a lado com números de linha, findings por símbolo e, com `--ai-review`, um resumo de code review por IA

**Exemplo:**

```bash
docs-kit diff master

# Em CI, falha quando houver violações de Docs-Guard
docs-kit diff master --strict

# Gera resumo de code review por IA se um provider LLM estiver configurado
docs-kit diff master --ai-review
```

### `docs-kit explain-symbol <symbol>`

Explica um símbolo combinando código + docs.

**Opções:**

- `--docs <dir>`: Diretório de documentação (padrão: `docs`)
- `--db <path>`: Caminho do banco SQLite
- `--cwd <dir>`: Diretório base para resolução de paths
- `--no-llm`: Não chama provider LLM, retorna contexto/prompt local

**Exemplo:**

```bash
docs-kit explain-symbol OrderService.createOrder
```

### `docs-kit impact-analysis <symbol>`

Analisa o raio de impacto de mudanças em um símbolo.

**Opções:**

- `--max-depth <n>`: Profundidade máxima (padrão: 3)

**Exemplo:**

```bash
docs-kit impact-analysis createOrder --max-depth 5
```

### `docs-kit analyze-patterns`

Detecta design patterns e violations.

**Exemplo:**

```bash
docs-kit analyze-patterns
```

### `docs-kit check`

Executa checks locais de cobertura, arquitetura e documentação sobre o banco indexado.

**Opções:**

- `--checks <csv>`: Lista entre `coverage`, `architecture`, `documentation`. Sem flag em TTY, abre multiselect interativo.
- `--db <path>`: Caminho do banco SQLite (padrão: `.docs-kit/index.db`)
- `--docs <dir>`: Diretório de docs (padrão: `docs`)

**Exemplo:**

```bash
docs-kit check --checks coverage,documentation
```

### `docs-kit inspect <symbol>`

Mostra métricas de qualidade do contexto montado para um símbolo ou arquivo.

**Opções:**

- `--file <path>`: Inspeciona contexto por arquivo em vez de símbolo
- `--docs <dir>`: Diretório de docs (padrão: `docs`)
- `--mode compact|full`: Nível de detalhe do contexto
- `--verbose`: Imprime o contexto completo

**Exemplo:**

```bash
docs-kit inspect buildRelevantContext
docs-kit inspect --file src/knowledge/contextBuilder.ts --verbose
```

### `docs-kit open-site`

Gera o site v2, serve localmente e tenta abrir o browser.

**Opções:**

- `--port <n>`: Porta local (padrão: `3000`)
- `--out <dir>`: Diretório do site (padrão: `docs-site-v2`)
- `--db <path>`: Caminho do banco SQLite
- `--root <dir>`: Raiz do projeto usada para links e arquivos

**Exemplo:**

```bash
docs-kit open-site --port 3000
```

### `docs-kit serve`

Inicia a API HTTP local usada pelo Context Inspector.

**Opções:**

- `--port <n>`: Porta local (padrão: `7337`)
- `--docs <dir>`: Diretório de docs (padrão: `docs`)

**Exemplo:**

```bash
docs-kit serve --port 7337
```

## Funcionalidades Disponíveis via MCP

Algumas operações são expostas como tools MCP, não como comandos CLI diretos no binário atual: `generateDocs`, `scanFile`, `generateMermaid`, `generateEventFlow`, `createOnboarding`, `askKnowledgeBase`, `buildTraceabilityMatrix`, `describeInBusinessTerms`, `validateExamples`, `smartCodeReview`, `projectStatus`, `getRelevantContext`, `searchSymbols`, `getFileOutline`, `scanForDeadCode`, `updateDeadCodeStatus` e `getDeadCodeHistory`. Consulte [MCP Server](./mcp-server.md) para schemas e uso.

## Helpers e Utilitários

### `step(msg)` / `done(detail?)`

Progress feedback formatado.

### `header(title)`

Cabeçalho de seção.

### `summary(lines)`

Tabela de sumário alinhada.

### `parseArgs(args, flags)`

Parser de argumentos CLI com suporte a flags booleanas e valores.

### `resolveConfigPath(path, configDir, default)`

Resolve paths relativos ao diretório do config (project root).

## Integração com Config

O CLI sempre carrega `docs.config.js` do diretório atual (`process.cwd()`), mesmo quando indexando subdiretórios. Isso garante que:

- Include/exclude patterns são consistentes
- Paths de saída são relativos ao projeto
- Configuração de LLM é centralizada

## Tratamento de Erros

- **Arquivo não encontrado**: Mensagens claras com caminho esperado
- **Index errors**: Agrupa por mensagem de erro para evitar spam
- **Database missing**: Sugere executar `docs-kit index` primeiro
- **Config missing**: Cria automaticamente `docs.config.js` com defaults

## Performance

**Incremental indexing:**

- Usa `file_hashes` table para skip de arquivos não modificados
- Rebuild completo com `--full` flag

**Batch operations:**

- SQLite transactions para upserts
- Paralelização de Tree-sitter parsing (futuro)

## Extensibilidade

Para adicionar novo comando:

1. Adicione case no switch de `main()`
2. Implemente função `runMyCommand(args: string[])`
3. Use `parseArgs()` para flags
4. Adicione entry em `printHelp()`

## Exemplo Completo de Workflow

```bash
# 1. Inicializa projeto
docs-kit init

# 2. Indexa código
docs-kit index --full

# 3. Gera site
docs-kit build-site

# 4. Analisa qualidade
docs-kit check

# 5. Inspeciona contexto de símbolo/arquivo
docs-kit inspect buildRelevantContext

# 6. Analisa padrões e violações SOLID
docs-kit analyze-patterns

# 7. Gera preview de docs após mudanças
git checkout feature/new-api
docs-kit diff main --site
```

## Referências

- [Config Loader](./config.md)
- [Indexer](./indexer.md)
- [Doc Registry](./docs.md#docregistry)
- [Governance](./governance.md)
