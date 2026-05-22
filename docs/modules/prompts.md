---
title: Prompt Templates
module: prompts
lastUpdated: 2026-05-22
symbols:
  - buildExplainSymbolPrompt
  - buildExplainSymbolPromptForMcp
  - buildImpactAnalysisPrompt
  - buildDescribeInBusinessTermsPrompt
  - buildUpdateSectionPrompt
---

# Prompt Templates

> O módulo `prompts/` centraliza prompts usados por tools, handlers e updates de documentação.

## Templates

| Arquivo                             | Uso                                                          |
| ----------------------------------- | ------------------------------------------------------------ |
| `explainSymbol.prompt.ts`           | Explicação técnica de símbolos e instrução de cache para MCP |
| `impactAnalysis.prompt.ts`          | Análise do raio de impacto de uma mudança                    |
| `describeInBusinessTerms.prompt.ts` | Tradução para linguagem de negócio                           |
| `updateSection.prompt.ts`           | Atualização cirúrgica de seção Markdown                      |

## Convenções

- Prompts recebem objetos tipados em vez de strings soltas.
- `outputLanguage` e `verbosity` vêm da configuração quando aplicável.
- Código fonte é truncado para proteger contexto e custo.
- O prompt MCP de explicação instrui o agente a chamar `updateSymbolExplanation` depois de responder.

## Relação com Config

`resolvePrompts()` em `src/config.ts` permite regras por linguagem ou pattern de arquivo. Use isso para alterar tom ou detalhe por área sem duplicar lógica de prompt.

## Testes

Os templates têm testes em `src/prompts/__tests__/`. Ao mudar estrutura, atualize snapshots/asserções focando em comportamento essencial: presença de símbolo, source, docs, dependências, idioma e instruções finais.
