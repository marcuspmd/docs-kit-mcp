---
title: Pattern Analyzer
module: patterns
lastUpdated: 2026-05-22
symbols:
  - createPatternAnalyzer
  - PatternAnalyzer
  - DetectedPattern
---

# Pattern Analyzer

> O módulo `patterns/` detecta padrões arquiteturais e registra violações leves para orientar revisão e governança.

## Padrões Detectados

| Pattern      | Sinais usados                                                                       | Exemplos de violação                                             |
| ------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `observer`   | Símbolos `event` e `listener`, relação entre evento e listener ou nomes compatíveis | Evento sem listener                                              |
| `factory`    | Métodos `create`, `build`, `make`, `from`, `of` ou `new` que instanciam tipos       | Método com nome de factory sem instanciação não é reportado      |
| `singleton`  | Construtor privado e/ou accessor estático como `instance`/`getInstance`             | Accessor sem construtor privado; construtor privado sem accessor |
| `strategy`   | Interfaces implementadas por duas ou mais classes                                   | Interface sem consumidor detectado                               |
| `repository` | Kind `repository` ou classe `*Repository`, métodos CRUD e relação com entity        | Sem método CRUD ou sem entity associada                          |

## Saída

Cada `DetectedPattern` contém:

- `kind`: pattern detectado
- `symbols`: ids dos símbolos envolvidos
- `confidence`: pontuação de 0 a 1
- `violations`: observações para revisão

## Integrações

- `docs-kit analyze-patterns` executa a análise no terminal.
- `analyzePatterns` expõe a análise via MCP.
- `smartCodeReview` e `projectStatus` usam os resultados como parte do relatório de qualidade.
- `replaceAllPatterns()` persiste os patterns durante a indexação.

## Manutenção

- Prefira sinais combinados de AST e relacionamentos para reduzir falsos positivos.
- Use confidence menor quando a heurística depende só de nomes.
- Ao adicionar um pattern, inclua testes em `src/patterns/__tests__/patterns.test.ts` e atualize esta página.
