---
title: Handlers
module: handlers
lastUpdated: 2026-05-22
symbols:
  - buildExplainSymbolContext
  - cacheSymbolExplanation
  - readSymbolSourceCode
  - generateExplanationHash
---

# Handlers

> O módulo `handlers/` concentra pipelines reutilizáveis que ficam entre tools/CLI e os serviços centrais.

## Responsabilidade

Atualmente o módulo contém o pipeline de explicação de símbolos. Ele monta o contexto necessário para `explainSymbol`, reaproveita cache quando a explicação ainda está válida e expõe funções que podem ser usadas tanto pelo servidor MCP quanto pela CLI.

## Fluxo Principal

```text
symbol name
  -> symbolRepo.findByName()
  -> registry.findDocBySymbol()
  -> read source slice from projectRoot
  -> graph.getDependencies()/getDependents()
  -> validate cached explanation hash
  -> buildExplainSymbolPrompt()
```

## Cache de Explicações

`generateExplanationHash()` combina `symbolId`, linhas inicial/final e código fonte atual. Quando o hash salvo em `explanationHash` bate com o hash atual, `buildExplainSymbolContext()` retorna `cachedExplanation` e evita gerar um prompt novo.

Quando o agente gera uma nova explicação, `cacheSymbolExplanation()` persiste a explicação com um novo hash. Isso mantém respostas rápidas para símbolos estáveis e invalida automaticamente o cache quando o trecho muda.

## Integrações

- `src/server/tools/explainSymbol.tool.ts` usa `buildExplainSymbolContext()` e orienta o agente a chamar `updateSymbolExplanation`.
- `src/cli/usecases/explainSymbol.usecase.ts` reutiliza o mesmo pipeline para saída no terminal.
- `src/cli/usecases/indexing/persistence.ts` preserva explicações válidas durante reindexação incremental.

## Cuidados de Manutenção

- Sempre resolva paths a partir de `projectRoot` para evitar leituras relativas ao processo errado.
- Não trate ausência de arquivo como erro fatal; o índice pode apontar para símbolos removidos ou worktrees incompletos.
- Se novos campos entrarem no prompt, atualize o hash apenas se eles afetarem a validade semântica da explicação.
