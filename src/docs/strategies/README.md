# Code Example Validators

Esta pasta contém as estratégias de validação para diferentes linguagens de programação suportadas pelo validador de exemplos de código.

## Estrutura

- `ValidatorStrategy.ts` - Interface base para todas as estratégias de validação
- `TypeScriptValidator.ts` - Validação de código TypeScript usando o compilador TSC
- `JavaScriptValidator.ts` - Validação de código JavaScript usando Node.js --check
- `BashValidator.ts` - Validação de scripts Bash usando bash -n
- `PHPValidator.ts` - Validação de código PHP usando php -l
- `DartValidator.ts` - Validação de código Dart usando dart analyze
- `FlutterValidator.ts` - Validação de código Flutter/Dart usando dart analyze
- `DefaultValidator.ts` - Validador padrão para linguagens não suportadas
- `index.ts` - Exporta todas as estratégias e interfaces

## Linguagens Suportadas

- **TypeScript** (`typescript`, `ts`) - Compilação com TSC
- **JavaScript** (`javascript`, `js`) - Verificação de sintaxe com Node.js
- **Bash** (`bash`, `sh`) - Verificação de sintaxe com bash -n
- **PHP** (`php`) - Verificação de sintaxe com php -l
- **Dart** (`dart`) - Análise com dart analyze
- **Flutter** (`flutter`) - Análise com dart analyze (compatível com Dart)

## Como adicionar uma nova linguagem

1. Crie um novo arquivo `{Language}Validator.ts`
2. Implemente a interface `ValidatorStrategy`
3. Adicione a exportação no arquivo `index.ts`
4. Registre a nova estratégia no array `strategies` em `codeExampleValidator.ts`

## Regras de validação

- Todos os validadores rejeitam blocos de código vazios
- Cada validador usa ferramentas nativas da linguagem para validação
- Erros são capturados e retornados com mensagens descritivas