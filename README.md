# doc-kit 🚀

**doc-kit** é um agente inteligente de documentação (via MCP) para repositórios de código. Ele analisa mudanças no código, mapeia símbolos para documentos Markdown, gera diagramas (Mermaid), mantém um registro de documentação e fornece uma CLI (`doc-guard`) para validar que PRs atualizam a documentação quando necessário.

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

---

## Licença

MIT

---

> Para detalhes de implementação e tarefas concluídas, veja `docs/tasks/` (fluxo de trabalho, design e decisões). 💡
