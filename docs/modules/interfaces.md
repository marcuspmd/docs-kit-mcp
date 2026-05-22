---
title: Interfaces and API Sync
module: interfaces
lastUpdated: 2026-05-22
symbols:
  - createApiSync
  - ApiEndpoint
  - ApiDiscrepancy
---

# Interfaces and API Sync

> O módulo `interfaces/` compara contratos externos, como OpenAPI, com endpoints detectados no código.

## OpenAPI Sync

`createApiSync()` oferece quatro operações:

| Operação                            | Descrição                                                              |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `extractEndpointsFromCode(symbols)` | Procura controllers e métodos com tags `GET /path`, `POST /path`, etc. |
| `parseOpenApiSpec(specPath)`        | Lê JSON ou YAML e delega para `parseOpenApiObject()`                   |
| `parseOpenApiObject(spec)`          | Extrai endpoints a partir de `paths` OpenAPI                           |
| `compare(code, spec)`               | Retorna discrepâncias entre código e spec                              |

## Normalização

Paths OpenAPI como `/users/{id}` são normalizados para `/users/:id`, o mesmo formato esperado para comparação com tags do código.

Tipos de resposta são extraídos de `200` ou `201`, priorizando `application/json`. Quando há `$ref`, o nome curto depois da última barra é usado como `responseType`.

## Tipos de Discrepância

- `missing_in_spec`: existe no código, mas não no contrato
- `missing_in_code`: existe no contrato, mas não no código
- `type_mismatch`: parâmetros ou resposta divergem
- `deprecated`: reservado para evolução de regras de depreciação

## Cuidados de Qualidade

- Validar specs malformadas antes de comparar evita relatórios silenciosamente incompletos.
- Tags de código precisam seguir o padrão `METHOD /path` para serem detectadas.
- Ao ampliar suporte para GraphQL ou outros contratos, mantenha `ApiEndpoint` como modelo intermediário.
