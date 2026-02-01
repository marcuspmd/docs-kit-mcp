# Docs Kit MCP

living connection between code & knowledge

**docs-kit** é um agente inteligente de documentação (via MCP) para repositórios de código. Ele analisa mudanças no código, mapeia símbolos para documentos Markdown, gera diagramas (Mermaid), mantém um registro de documentação e fornece uma CLI (`doc-guard`) para validar que PRs atualizam a documentação quando necessário.

---

## 🔎 O que é o sistema

- Analisa diferenças de código entre branches/commits e determina se mudanças exigem atualização de documentação.
- Mantém um `DocRegistry` (um banco SQLite) que mapeia símbolos (classes, funções, interfaces) para arquivos de documentação `.md`.
- Exibe avisos/erros quando mudanças exigem docs atualizados (útil como check de CI).
- Fornece ferramentas auxiliares: indexador, analisador de mudanças, gerador de Mermaid, verificadores de arquitetura, e integração com RAG/knowledge graph.

---

## ✅ Funcionalidades principais

- Indexação de símbolos (TypeScript/JS/Python via Tree-sitter)
- Análise de impacto de mudanças (quem precisa ser documentado)
- `doc-guard` CLI para auditar PRs
- Gerador de diagramas Mermaid e ferramentas de atualização de seção
- Base persistente em SQLite (`.doc-kit/registry.db`)

---

## 🛠 Requisitos

- Node.js >= 18
- npm

---

## Começando (Quick Start)

Instale dependências:

```bash
npm install
```

Executar em modo de desenvolvimento (server):

```bash
npm run dev
```

Build (compila TS para `dist/`):

```bash
npm run build
```

Executar testes:

```bash
npm run test
```

Formatar / checar formatação:

```bash
npm run format
npm run format:check
```

---

## 📋 Comandos CLI (`docs-kit`)

Todos os comandos da CLI principal (após `npm run build`, use `docs-kit` ou `node dist/cli.js`):

| Comando | Descrição | Opções principais |
|---------|------------|-------------------|
| `docs-kit init [dir]` | Cria `docs.config.js` com valores padrão | — |
| `docs-kit index [dir]` | Indexa repositório (símbolos, relações, métricas) | `--db`, `--docs`, `--full` |
| `docs-kit build-site` | Gera site HTML estático da documentação | `--out`, `--db`, `--root` |
| `docs-kit build-docs` | Gera documentação em Markdown a partir do índice | `--out`, `--db`, `--root` |
| `docs-kit generate-repo-docs [repo-dir] [docs-dir]` | Gera stubs de docs para símbolos não documentados | — |
| `docs-kit project-status` | Relatório de status (cobertura, padrões, violações) | `--db`, `--docs` |
| `docs-kit smart-code-review` | Revisão de código com múltiplas análises | `--db`, `--docs`, `--no-examples` |
| `docs-kit dead-code` | Detecta código morto e docs órfãs no banco | `--db`, `--docs` |
| `docs-kit --help` | Exibe ajuda | — |

Banco padrão: `--db` usa `.doc-kit/index.db` (index/build-*) ou `.doc-kit/registry.db` (registry/guard). Diretório de docs padrão: `--docs docs`.

---

## 📦 CLI: `doc-guard`

A ferramenta principal para auditoria de documentação. Ela reconstrói o `DocRegistry` com base na pasta `docs` e analisa as mudanças entre `base` e `head`.

Exemplo (após `npm run build`):

```bash
# build e roda o binário diretamente
npm run build
node dist/governance/docGuardBin.js --base main --head feature-branch
```

Opções úteis:

- `--base` (string, default: `main`) — branch/base para comparar
- `--head` (string) — branch/commit head (padrão: `HEAD`)
- `--strict` (boolean, default: true) — falhar (exit code != 0) se houver violações
- `--db-path` (string, default: `.doc-kit/registry.db`) — localização do banco SQLite
- `--docs-dir` (string, default: `docs`) — diretório de documentação

Observação: se a execução terminar com exit code `1`, significa que houve mudanças que exigiam docs e não foram cobertas.

Se preferir usar o bin exposado, você pode instalar/ligar o pacote localmente:

```bash
# instala globalmente (opcional) ou usar `npm link`
npm link
# então
doc-guard --base main --head feature-branch
```

---

## Exemplo de uso programático (TypeScript)

```ts
import Database from "better-sqlite3";
import { runDocGuard } from "./dist/governance/docGuardCli.js";
import { createDocRegistry } from "./dist/docs/docRegistry.js";
import { analyzeChanges } from "./dist/analyzer/changeAnalyzer.js";

const db = new Database('.doc-kit/registry.db');
const registry = createDocRegistry(db);
await registry.rebuild('docs');

const result = await runDocGuard({ repoPath: process.cwd(), base: 'main' }, {
  analyzeChanges,
  registry,
  getChangedFiles: async () => [], // implementa conforme necessidade
});

console.log(result);
```

---

## 🧑‍💻 Exemplos de Uso — CLI, Indexação e Integração MCP

### 1. Indexação manual dos símbolos (rebuild do registro)

```ts
import Database from "better-sqlite3";
import { createDocRegistry } from "./dist/docs/docRegistry.js";

const db = new Database('.doc-kit/registry.db');
const registry = createDocRegistry(db);
await registry.rebuild('docs');
// O registro agora está sincronizado com os arquivos Markdown.
```

### 2. Consulta de símbolos/documentos

```ts
const docs = await registry.findDocBySymbol("OrderService.createOrder");
// → [{ symbolName: "OrderService.createOrder", docPath: "domain/orders.md" }]

const symbols = await registry.findSymbolsByDoc("domain/orders.md");
// → ["OrderService", "OrderService.createOrder", "OrderService.cancelOrder"]
```

### 3. Uso via CLI (doc-guard)

Auditoria de documentação em CI/CD ou local:

```bash
# Após build
npm run build
node dist/governance/docGuardBin.js --base main --head feature-branch

# Ou via npx (se instalado globalmente ou linkado)
npx doc-guard --base origin/main
# Saída típica:
# Doc-Guard: 2 symbol(s) changed without doc updates:
#   - OrderService.createOrder (src/services/order.ts): Linked doc was not updated in this PR
#   - PaymentGateway (src/services/payment.ts): No doc linked to this symbol
# exit code 1
```

Opções principais:
- `--base` (branch base, default: main)
- `--head` (branch/commit head, default: HEAD)
- `--strict` (fail on violation, default: true)
- `--db-path` (caminho do banco, default: .doc-kit/registry.db)
- `--docs-dir` (diretório de docs, default: docs)

### 4. Integração com MCP (VS Code, Copilot, automação)

O agente pode ser exposto como servidor MCP para integração com IDEs e automações:

#### a) Rodando o servidor MCP

```bash
npm run build
node dist/server.js &
# Ou conforme mcp.json:
# node dist/server.js
```

#### b) Exemplos de comandos MCP (VS Code/Copilot ou automação)

No VS Code (via extensão MCP ou Copilot):

```
@docs-kit generateDocs --base main [--dryRun true]
# → "Updated 3 doc sections across 2 files"
# Recomendado: use dryRun: true para revisar antes de aplicar; não commitar direto.

@docs-kit explainSymbol symbol=OrderService.createOrder
# → "OrderService.createOrder cria um novo pedido... [resumo do código + doc]"

@docs-kit generateMermaid symbols=OrderService,PaymentService type=classDiagram
# → (retorna diagrama Mermaid)

@docs-kit projectStatus
# → Comprehensive project status report with coverage, patterns, violations, etc.
```

#### c) Exemplos de automação/pipeline

No CI/CD:

```bash
npx doc-guard --base origin/main
# Falha se houver símbolos alterados sem doc correspondente
```

---

## 🔗 Referências rápidas

- [docs/tasks/07-doc-registry.done.md](docs/tasks/07-doc-registry.done.md) — exemplos de uso do DocRegistry
- [docs/tasks/09-doc-guard-cli.done.md](docs/tasks/09-doc-guard-cli.done.md) — exemplos de uso CLI
- [docs/tasks/10-mcp-server.done.md](docs/tasks/10-mcp-server.done.md) — exemplos de integração MCP

---

---

## Estrutura do projeto (resumo)

- `src/` — código-fonte (indexer, analyzer, docs, governance, server, etc.)
- `docs/` — documentação do projeto (onde `DocRegistry` aponta)
- `tests/` — testes automatizados
- `schema.sql` — esquema inicial do banco

---

## Contribuindo

1. Abra uma issue descrevendo a proposta
2. Crie uma branch de feature
3. Adicione/atualize testes e rode `npm run test`
4. Formate com `npm run format` e submeta um pull request

Para lista completa de comandos CLI, veja a seção [Comandos CLI](#-comandos-cli-docs-kit) acima.


   docs-kit init-arch-guard --lang ts --out arch-guard.json
   # editar arch-guard.json se quiser
   docs-kit index
   docs-kit build-site

### docs-config.json (página Docs do site)

O `docs-config.json` é procurado **sempre na raiz de onde você roda o comando** (`process.cwd()`). O argumento do comando (ex.: `docs-kit index src`) não altera onde o config é procurado: coloque o arquivo na raiz do projeto (não dentro de `src/`). Ele lista documentos Markdown que aparecem na página **Docs** do site, com **nome**, **título** e **categoria**, e navegação na lateral direita.

- **path**: caminho do doc no site (ex.: `docs/cip/cip-polling-confirmation.md`). Pode ter `../` no início; será normalizado (ex.: `../docs/cip/foo.md` vira `docs/cip/foo.md`). O gerador procura o arquivo em: raiz do projeto (cwd), depois `cwd/docs/<path>`, depois `--root/<path>` e `--root/docs/<path>`.
- **title**: título exibido no índice e na navegação.
- **name**: nome curto (opcional).
- **category**: agrupa docs na lista e na sidebar (ex.: `domain`, `api`).
- **module** (opcional): tag para agrupar vários docs no mesmo módulo; aparece como badge na lista e na seção "By module" da sidebar e do índice.
- **prev** (opcional): path do doc anterior (para navegação sequencial). Se preenchido, aparece "← Previous" na sidebar e no rodapé da página do doc.
- **next** (opcional): path do doc seguinte (para navegação sequencial). Se preenchido, aparece "Next →" na sidebar e no rodapé da página do doc.
- **sourcePath** (opcional): se o arquivo estiver em outro lugar (outro repositório ou path), use `sourcePath`. Se começar com `../`, é resolvido em relação ao diretório onde está o `docs-config.json`; caso contrário, em relação à raiz do projeto (e a `--root`). O conteúdo é copiado para `out/<path>`.

Exemplo (copie para `docs-config.json` e ajuste):

```json
{
  "docs": [
    {
      "path": "docs/domain/arch-guard-rules.md",
      "title": "Arch Guard Rules",
      "name": "arch-guard-rules",
      "category": "domain"
    },
    {
      "path": "docs/domain/other-doc.md",
      "title": "Outro Doc",
      "category": "domain",
      "sourcePath": "../outro-repo/docs/other-doc.md"
    }
  ]
}
```

Os docs referenciados por símbolos (`doc_ref`) continuam aparecendo; entradas do config são mescladas (e podem definir título/categoria para esses paths).

---

## Licença

MIT

---

> Para detalhes de implementação e tarefas concluídas, veja `docs/tasks/` (fluxo de trabalho, design e decisões). 💡
