---
title: CLI (Command Line Interface)
module: cli
lastUpdated: 2026-02-03
symbols:
  - main
  - runInit
  - runIndex
  - runBuildSite
  - runBuildDocs
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
  ├─> runImpactAnalysis()  // Análise de impacto
  └─> runAnalyzePatterns() // Análise de patterns
```

## Comandos Disponíveis

### `docs-kit index [dir]`

Indexa o repositório extraindo símbolos, relacionamentos e métricas.

**Opções:**
- `--db <path>`: Caminho do banco de dados SQLite (padrão: `.docs-kit/index.db`)
- `--docs <dir>`: Diretório de documentação (padrão: `docs`)
- `--full`: Força rebuild completo, ignorando cache de arquivos

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

### `docs-kit generate-docs`

Atualiza documentação para símbolos afetados por mudanças no git.

**Opções:**
- `--base <ref>`: Branch base (padrão: `main`)
- `--head <ref>`: Branch head (padrão: HEAD)
- `--dry-run`: Preview sem escrever arquivos
- `--docs <dir>`: Diretório de docs

**Fluxo:**
1. Analisa diff entre base e head
2. Detecta símbolos modificados semanticamente
3. Localiza documentação relacionada via registry
4. Atualiza seções específicas (nunca cria novos arquivos)

**Exemplo:**
```bash
# Review docs para PR
docs-kit generate-docs --base main --head feature/new-api --dry-run

# Atualiza docs efetivamente
docs-kit generate-docs --base main --head feature/new-api
```

### `docs-kit project-status`

Gera relatório completo de status do projeto.

**Métricas incluídas:**
- Cobertura de documentação (% de símbolos)
- Símbolos públicos vs privados
- Patterns detectados
- Arch violations (por severidade)
- Dead code (via Reaper)
- Test coverage (via LCOV)
- Complexity metrics (médias)

**Exemplo:**
```bash
docs-kit project-status
```

### `docs-kit smart-code-review`

Code review abrangente combinando múltiplas análises.

**Opções:**
- `--no-examples`: Desabilita validação de code examples

**Análises incluídas:**
- Architecture violations (arch-guard)
- Dead code detection (reaper)
- Pattern violations (SOLID, etc.)
- Documentation drift
- Code example validation

**Exemplo:**
```bash
docs-kit smart-code-review
```

### `docs-kit explain-symbol <symbol>`

Explica um símbolo combinando código + docs.

**Exemplo:**
```bash
docs-kit explain-symbol OrderService.createOrder
```

### `docs-kit generate-mermaid <symbols>`

Gera diagrama Mermaid para símbolos.

**Opções:**
- `--type classDiagram|sequenceDiagram|flowchart`: Tipo de diagrama

**Exemplo:**
```bash
docs-kit generate-mermaid "OrderService,PaymentService" --type classDiagram
```

### `docs-kit scan-file <file>`

Escaneia arquivo TypeScript e cria docs para símbolos sem documentação.

**Exemplo:**
```bash
docs-kit scan-file src/indexer/indexer.ts
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

### `docs-kit generate-event-flow`

Simula event flows e listeners (diagrama Mermaid).

**Exemplo:**
```bash
docs-kit generate-event-flow
```

### `docs-kit create-onboarding <topic>`

Gera learning path usando RAG.

**Exemplo:**
```bash
docs-kit create-onboarding "authentication"
```

### `docs-kit ask-knowledge-base <question>`

Q&A conversacional sobre código + docs.

**Exemplo:**
```bash
docs-kit ask-knowledge-base "Como funciona a indexação incremental?"
```

### `docs-kit init-arch-guard`

Gera `arch-guard.json` base com regras específicas da linguagem.

**Opções:**
- `--lang ts|js|php|python|go`: Linguagem
- `--out <path>`: Arquivo de saída

**Exemplo:**
```bash
docs-kit init-arch-guard --lang ts --out arch-guard.json
```

### `docs-kit traceability-matrix`

Gera matriz de rastreabilidade (requisitos → código → testes → docs).

**Exemplo:**
```bash
docs-kit traceability-matrix
```

### `docs-kit describe-business <symbol>`

Descreve símbolo em termos de negócio (para product/compliance).

**Exemplo:**
```bash
docs-kit describe-business calculateTax
```

### `docs-kit validate-examples`

Valida code examples na documentação contra código real.

**Exemplo:**
```bash
# Valida todos os docs
docs-kit validate-examples

# Valida doc específico
docs-kit validate-examples domain/order-service.md
```

### `docs-kit relevant-context`

Obtém contexto abrangente para entender ou modificar código.

**Opções:**
- `--symbol <name>`: Símbolo
- `--file <path>`: Arquivo

**Exemplo:**
```bash
docs-kit relevant-context --symbol OrderService
docs-kit relevant-context --file src/indexer/indexer.ts
```

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
docs-kit smart-code-review

# 5. Valida docs
docs-kit validate-examples

# 6. Status do projeto
docs-kit project-status

# 7. Atualiza docs após mudanças
git checkout feature/new-api
docs-kit generate-docs --base main
```

## Referências

- [Config Loader](./config.md)
- [Indexer](./indexer.md)
- [Doc Registry](./docs.md#docregistry)
- [Governance](./governance.md)
