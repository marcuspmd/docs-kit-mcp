---
title: Dependency Injection
module: di
lastUpdated: 2026-05-22
symbols:
  - setupContainer
  - resetContainer
  - resolve
---

# Dependency Injection

> O módulo `di/` registra serviços compartilhados em um container `tsyringe` para CLI, servidor e testes.

## Tokens

`tokens.ts` define `Symbol.for(...)` para dependências centrais:

- database e config
- repositórios de símbolos, relações e hashes
- registry de documentação
- knowledge graph e RAG index
- analyzers de patterns e eventos
- providers LLM
- arch-guard, reaper e validadores
- camada business

## Setup

`setupContainer()` executa a sequência padrão:

1. Carrega `docs.config.js` com `loadConfig()`
2. Abre SQLite e inicializa schema
3. Registra repositories e services leaf
4. Cria provider LLM com `createLlmProvider()`
5. Configura RAG com embedder do provider
6. Expande regras `archGuard.languages` ou aplica regras default
7. Registra business translator, context mapper e validator de exemplos

## Regras de Uso

- Importe `reflect-metadata` antes de usar o container.
- Use `resetContainer()` em testes para evitar vazamento de estado entre suites.
- Prefira `resolve<T>(TOKEN)` nos use cases, mantendo o wiring fora da regra de negócio.
- Ao adicionar um serviço novo, crie token, registre em `setupContainer()` e cubra em `src/di/__tests__/container.test.ts`.
