---
title: Languages and Shared Types
module: constants-types
lastUpdated: 2026-05-22
symbols:
  - SUPPORTED_LANGUAGES
  - detectLanguageFromPath
  - normalizeLanguage
---

# Languages and Shared Types

> `src/constants/` e `src/types/` guardam contratos pequenos que precisam ser consistentes em indexer, guards e documentação.

## Linguagens Suportadas

`SUPPORTED_LANGUAGES` é a lista canônica:

- `typescript`
- `javascript`
- `php`
- `python`
- `go`
- `java`
- `rust`

`FILE_EXTENSION_TO_LANGUAGE` e `LANGUAGE_TO_EXTENSIONS` mantêm o mapeamento de extensões. `detectLanguageFromPath()` usa a extensão para identificar a linguagem, e `normalizeLanguage()` preserva aliases legados como `ts`, `js` e `py`.

## Uso no Sistema

- Indexer: escolhe strategy/parser por linguagem.
- Arch-Guard: valida `archGuard.languages[].language` com `LanguageSchema`.
- Config: mantém include/exclude e docs alinhados com linguagens suportadas.

## Declarações Tree-sitter

`src/types/tree-sitter-grammars.d.ts` declara módulos de grammars que não possuem tipos completos publicados. Isso permite compilar imports ESM de parsers como `tree-sitter-go`, `tree-sitter-php`, `tree-sitter-ruby` e `tree-sitter-c-sharp`.

## Manutenção

Ao adicionar uma linguagem:

1. Atualize `SUPPORTED_LANGUAGES` e os mapas de extensão.
2. Adicione ou declare o grammar Tree-sitter necessário.
3. Registre strategy no indexer.
4. Adicione rules de Arch-Guard se a linguagem tiver governança específica.
5. Cubra `detectLanguageFromPath()` e `normalizeLanguage()` nos testes.
