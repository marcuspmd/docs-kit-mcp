# Arch-Guard: Tipos de regras e referência

O Arch-Guard aplica regras de arquitetura e qualidade sobre o índice de símbolos (e relações). As regras são definidas em `arch-guard.json` na raiz do projeto. Use `docs-kit init-arch-guard --lang php` (ou `ts`, `js`, `python`, `go`) para gerar uma base com padrões corretos por linguagem (ex.: PHP `__construct` permitido em convenções de nome).

---

## Visão geral dos tipos de regra

| Tipo | Descrição | Dados usados |
|------|-----------|---------------|
| `layer_boundary` | Camada X não pode depender de camada Y | `relationships`, `file` |
| `forbidden_import` | Proibir dependências por path ou nome | `relationships`, `file`, `name` |
| `naming_convention` | Nomes devem seguir regex; permite exceções (ex.: `__construct`) | `name`, `kind`, `file` |
| `max_complexity` | Limite de complexidade ciclomática | `metrics.cyclomaticComplexity` |
| `max_parameters` | Limite de parâmetros por função/método | `metrics.parameterCount` |
| `max_lines` | Limite de linhas por símbolo | `metrics.linesOfCode` ou `endLine - startLine` |
| `missing_return_type` | Exigir tipo de retorno declarado | `signature`, `kind`, `visibility` |

---

## Opção comum: `ignore`

Em **qualquer regra** você pode definir `ignore` no `config` para não aplicar a regra a certos arquivos ou paths.

| Campo | Tipo | Descrição |
|-------|------|------------|
| `ignore` | string[] | Globs (ex.: `**/tests/**`, `0.Presentation/auth/tests/**`) ou regex (ex.: `/.*\/tests\/.*/`). Arquivos cujo path bater com algum item são ignorados por essa regra. |

- **Glob:** mesmo padrão do resto do Arch-Guard (ex.: `**/tests/**`, `0.Presentation/**/TestCase.php`).
- **Regex:** string entre barras, ex.: `/.*\/tests\/.*/` para qualquer path contendo `/tests/`.

**Exemplo:** não exigir PascalCase em classes de testes (TestCase, etc.):

```json
{
  "name": "class-pascal-case",
  "type": "naming_convention",
  "config": {
    "kind": "class",
    "pattern": "^[A-Z][a-zA-Z0-9]*$",
    "ignore": ["**/tests/**", "**/TestCase.php", "0.Presentation/auth/tests/**"]
  }
}
```

---

## 1. `layer_boundary`

**Objetivo:** Garantir que uma camada (por glob de arquivo) não dependa de outra.

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `source` | string | sim | Glob dos arquivos da camada que não pode importar (ex.: `src/domain/**`) |
| `forbidden` | string[] | sim | Globs dos arquivos/camadas proibidos como dependência |
| `ignore` | string[] | não | Globs ou regex de paths a ignorar (não aplicar a regra) |

**Exemplo:**

```json
{
  "name": "domain-no-infra",
  "description": "Domain must not depend on infrastructure",
  "type": "layer_boundary",
  "severity": "error",
  "config": {
    "source": "src/domain/**",
    "forbidden": ["src/infrastructure/**", "src/controllers/**"]
  }
}
```

---

## 2. `forbidden_import`

**Objetivo:** Proibir dependências por path ou nome do alvo (em qualquer camada ou só em `scope`).

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `forbidden` | string[] | sim | Globs de path ou nome (ex.: `node_modules/lodash/**`, `console*`) |
| `scope` | string | não | Se definido, só símbolos nesses arquivos são checados (glob) |
| `ignore` | string[] | não | Globs ou regex de paths a ignorar |

**Exemplo:**

```json
{
  "name": "no-lodash",
  "type": "forbidden_import",
  "severity": "error",
  "config": { "forbidden": ["node_modules/lodash/**"] }
}
```

```json
{
  "name": "no-db-in-controllers",
  "type": "forbidden_import",
  "config": {
    "scope": "src/controllers/**",
    "forbidden": ["src/db/**", "src/database/**"]
  }
}
```

---

## 3. `naming_convention`

**Objetivo:** Nomes de símbolos devem seguir um padrão (regex). Suporta **exceções** por linguagem (ex.: PHP `__construct`, Python `__init__`).

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `pattern` | string | sim | Regex (sem barras). Ex.: `^[A-Z][a-zA-Z0-9]*$` para PascalCase |
| `kind` | string | não | Filtrar por `kind` (ex.: `class`, `method`, `function`) |
| `file` | string | não | Glob: regra só vale nesses arquivos |
| `allowNames` | string[] | não | Nomes permitidos mesmo fora do padrão (ex.: `__construct`, `constructor`) |
| `excludeNames` | string[] | não | Mesmo efeito que `allowNames`; ambos são somados para exceções |
| `ignore` | string[] | não | Globs ou regex de paths a ignorar (ex.: `**/tests/**`, `**/TestCase.php`) |

**Exemplo (classes PascalCase, métodos camelCase com exceções para PHP):**

```json
{
  "name": "class-pascal-case",
  "type": "naming_convention",
  "severity": "warning",
  "config": {
    "kind": "class",
    "pattern": "^[A-Z][a-zA-Z0-9]*$"
  }
}
```

```json
{
  "name": "method-camel-case",
  "type": "naming_convention",
  "severity": "warning",
  "config": {
    "kind": "method",
    "pattern": "^[a-z][a-zA-Z0-9]*$",
    "allowNames": ["__construct", "__destruct", "__toString", "constructor"]
  }
}
```

**Como o nome é avaliado:** O padrão é aplicado ao **nome curto** do símbolo em todas as regras de naming (class-pascal-case, method-camel-case, function-camel-case). Se o índice tiver `qualifiedName`, só o último segmento é comparado ao padrão: `\Namespace\Classe` ou `module.Classe` → `Classe` (para classes); `Classe.metodo` ou `Classe::metodo` → `metodo` (para métodos); `module.funcao` → `funcao` (para funções). Assim getters/setters como `getCode`, `setName` passam na regra camelCase.

**Nomes reservados por linguagem:** O comando `init-arch-guard --lang php` já gera regras com `allowNames` preenchido com os métodos mágicos de PHP. Para outras linguagens, use `--lang ts`, `js`, `python` ou `go`; a base inclui os nomes especiais (ex.: Python `__init__`, TS/JS `constructor`).

---

## 4. `max_complexity`

**Objetivo:** Limitar a complexidade ciclomática de funções/métodos (reduzir ramificações excessivas).

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `max` | number | sim | Valor máximo permitido (ex.: 10) |
| `kind` | string | não | Filtrar por `kind` (ex.: `method`, `function`) |
| `file` | string | não | Glob: regra só nesses arquivos |

**Exemplo:**

```json
{
  "name": "max-cyclomatic-complexity",
  "type": "max_complexity",
  "severity": "warning",
  "config": { "max": 10 }
}
```

**Requisito:** Índice com métricas (`docs-kit index` com collector de métricas). O campo usado é `symbol.metrics.cyclomaticComplexity`.

---

## 5. `max_parameters`

**Objetivo:** Limitar o número de parâmetros de funções/métodos (evitar assinaturas longas).

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `max` | number | sim | Número máximo de parâmetros (ex.: 5) |
| `kind` | string | não | Filtrar por `kind` |
| `file` | string | não | Glob: regra só nesses arquivos |

**Exemplo:**

```json
{
  "name": "max-parameters",
  "type": "max_parameters",
  "severity": "warning",
  "config": { "max": 5 }
}
```

**Requisito:** Índice com métricas. O campo usado é `symbol.metrics.parameterCount`.

---

## 6. `max_lines`

**Objetivo:** Limitar o tamanho do corpo do símbolo (linhas).

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `max` | number | sim | Número máximo de linhas (ex.: 80) |
| `kind` | string | não | Filtrar por `kind` |
| `file` | string | não | Glob: regra só nesses arquivos |

**Exemplo:**

```json
{
  "name": "max-lines",
  "type": "max_lines",
  "severity": "warning",
  "config": { "max": 80 }
}
```

**Dados:** Usa `symbol.metrics.linesOfCode` se existir; senão `endLine - startLine + 1`.

---

## 7. `missing_return_type`

**Objetivo:** Exigir que funções/métodos (ou só os públicos) declarem tipo de retorno.

**Config:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `scope` | string | não | `"all"` (padrão) ou `"public"` — em `public` só símbolos com `visibility === "public"` são checados |
| `kind` | string | não | Filtrar por `kind` (ex.: `method`, `function`) |
| `file` | string | não | Glob: regra só nesses arquivos |

**Exemplo:**

```json
{
  "name": "require-return-type",
  "type": "missing_return_type",
  "severity": "warning",
  "config": { "scope": "public" }
}
```

**Detecção:** Baseada em `symbol.signature`. Considera “com retorno” se após o `)` da assinatura existir anotação de tipo (ex.: `): Type`, `): void`). Depende do indexer preencher `signature` com o retorno quando disponível na AST.

---

## Severidade

Todas as regras aceitam:

- **`severity`** (opcional): `"error"` ou `"warning"`. Padrão: `layer_boundary` e `forbidden_import` costumam usar `"error"`; as demais costumam usar `"warning"`.

---

## Gerando uma base por linguagem

```bash
docs-kit init-arch-guard --lang php --out arch-guard.json
```

Isso cria um `arch-guard.json` com:

- Regras de camada e import proibido de exemplo
- Convenções de nome para classe/método/função com **allowNames** preenchidos com os nomes especiais da linguagem (ex.: PHP `__construct`, Python `__init__`)
- Regras de métricas: `max_complexity`, `max_parameters`, `max_lines` (e opcionalmente `missing_return_type`)

Opções úteis:

- `--lang ts|js|php|python|go` — linguagem (ts/js compartilham base)
- `--out path` — arquivo de saída (padrão: `arch-guard.json` na raiz)

Depois você pode editar `arch-guard.json` para ajustar limites, adicionar regras ou restringir por `file`/`kind`.

---

## Estrutura do arquivo de configuração

```json
{
  "rules": [
    {
      "name": "unique-rule-name",
      "description": "Optional description",
      "type": "layer_boundary | forbidden_import | naming_convention | max_complexity | max_parameters | max_lines | missing_return_type",
      "severity": "error | warning",
      "config": { ... }
    }
  ]
}
```

O Arch-Guard é usado no **smart-code-review**, **project-status** e em fluxos que carregam `arch-guard.json` e chamam `archGuard.analyze(symbols, relationships)`.
