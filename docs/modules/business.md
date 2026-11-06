---
title: Business Layer
module: business
lastUpdated: 2026-05-22
symbols:
  - createBusinessTranslator
  - createContextMapper
  - createRTM
---

# Business Layer

> O módulo `business/` traduz sinais técnicos em linguagem de produto, compliance e rastreabilidade.

## Componentes

| Arquivo                 | Papel                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `businessTranslator.ts` | Usa LLM para descrever símbolos em termos de regras, decisões e outcomes de negócio |
| `contextMapper.ts`      | Extrai referências de tickets em commits e comentarios `// ref: ABC-123`            |
| `rtm.ts`                | Exporta uma Requirements Traceability Matrix em Markdown ou CSV                     |

## Business Translator

`createBusinessTranslator(llm)` recebe um provider com `chat()` e gera uma descrição curta do símbolo usando `buildDescribeInBusinessTermsPrompt()`. A tool MCP `describeInBusinessTerms` fornece o símbolo, o trecho de código e documentação existente quando disponível.

Use esse fluxo quando a pergunta for orientada a produto, regra de negócio, auditoria ou compliance. Para explicações técnicas, prefira `explainSymbol`.

## Context Mapper

`createContextMapper(config)` combina duas fontes:

- Git: `git log --pretty=format:%s|||%H --name-only -100`
- Código: comentários no formato `// ref: TICKET-123`

As referências são agrupadas por ticket e enriquecidas com docs vinculadas via `DocRegistry`. Arquivos de teste são separados de símbolos/código por padrão de nome (`.test.` ou `.spec.`).

## RTM

`createRTM(entries)` oferece três operações:

- `getByTicket(ticketId)` para consulta pontual
- `getAll()` para consumo programático
- `export("markdown" | "csv")` para relatórios

## Integrações

- `buildTraceabilityMatrix` expõe a matriz via MCP.
- `describeInBusinessTerms` expõe a tradução de símbolos via MCP.
- O container registra `CONTEXT_MAPPER_TOKEN` e `BUSINESS_TRANSLATOR_TOKEN` para reuso nos serviços.

## Limitações Atuais

- A detecção de tickets assume padrão uppercase como `ABC-123`.
- Referências de commit são limitadas aos últimos 100 commits.
- `symbolId` só é preenchido quando a fonte de referência já carrega esse vínculo; comentários hoje registram arquivo e linha.
