---
title: Event Flow Analyzer
module: events
lastUpdated: 2026-05-22
symbols:
  - createEventFlowAnalyzer
  - formatEventFlowsAsMermaid
  - EventFlow
---

# Event Flow Analyzer

> O módulo `events/` transforma eventos, emissores e listeners indexados em fluxos navegáveis e diagramas Mermaid.

## Modelo

Um `EventFlow` contém:

- `event`: símbolo do evento
- `emitters`: símbolos que usam ou instanciam o evento
- `listeners`: listeners associados por relacionamento ou convenção de nome
- `complete`: `true` quando há pelo menos um emitter e um listener

## Detecção

`createEventFlowAnalyzer().analyze(symbols, relationships)` procura símbolos com kind `event` e `listener`.

Emitters são símbolos com relacionamento `uses` ou `instantiates` apontando para o evento, exceto listeners. Listeners são detectados por relacionamento direto com o evento ou por nome compatível, removendo sufixos como `Event`, `Listener`, `Handler` e `Subscriber`.

## Mermaid

`formatEventFlowsAsMermaid()` gera um `sequenceDiagram` com participantes para evento, emitters e listeners. O fluxo mostra emissão, notificação e retorno de handling.

## Integrações

- `generateEventFlow` expõe diagramas via MCP.
- `patternAnalyzer` usa eventos/listeners como sinal para o pattern Observer.
- O site pode renderizar Mermaid gerado a partir desse formato.

## Limitações Atuais

- Não modela ordem real de execução assíncrona.
- Não diferencia múltiplos buses/event dispatchers.
- Relacionamentos incompletos no índice podem deixar flows como `complete: false`.
