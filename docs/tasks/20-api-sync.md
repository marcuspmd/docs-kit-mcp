# Task 20 — API Sync (OpenAPI / GraphQL)

> **Status:** pending
> **Layer:** Interface
> **Priority:** Release 2
> **Depends on:** 02, 07
> **Unblocks:** —

## Pain Point
API specifications (OpenAPI/Swagger, GraphQL schemas) drift from the actual code implementation. Endpoints get added or changed but the spec file isn't updated, causing integration failures for API consumers. (`start.md §3.1`: "API Sync: sincroniza especificações OpenAPI/Swagger e GraphQL com o código real").

## Objective
Compare code-defined API endpoints/resolvers against OpenAPI/GraphQL spec files and report discrepancies (missing endpoints, mismatched types, deprecated routes still in spec).

## Technical Hints

```ts
// src/interfaces/apiSync.ts

export interface ApiEndpoint {
  method: string;             // GET, POST, etc.
  path: string;
  parameters: Array<{ name: string; type: string; required: boolean }>;
  responseType?: string;
  symbolId: string;           // linked code symbol
}

export interface ApiDiscrepancy {
  type: "missing_in_spec" | "missing_in_code" | "type_mismatch" | "deprecated";
  endpoint: string;
  details: string;
}

export interface ApiSync {
  extractEndpointsFromCode(symbols: CodeSymbol[]): ApiEndpoint[];
  parseOpenApiSpec(specPath: string): Promise<ApiEndpoint[]>;
  compare(code: ApiEndpoint[], spec: ApiEndpoint[]): ApiDiscrepancy[];
}

export function createApiSync(): ApiSync;
```

## Files Involved
- `src/interfaces/apiSync.ts` — sync logic
- `tests/apiSync.test.ts` — unit tests

## Acceptance Criteria
- [ ] Extracts API endpoints from code symbols (decorators/annotations)
- [ ] Parses OpenAPI 3.x spec files
- [ ] Detects endpoints in code but missing from spec
- [ ] Detects endpoints in spec but missing from code
- [ ] Detects type/parameter mismatches
- [ ] Unit tests with fixture spec + code symbols

## Scenarios / Examples

```ts
const sync = createApiSync();
const codeEndpoints = sync.extractEndpointsFromCode(symbols);
const specEndpoints = await sync.parseOpenApiSpec("openapi.yaml");
const discrepancies = sync.compare(codeEndpoints, specEndpoints);
// [{ type: "missing_in_spec", endpoint: "POST /orders/:id/refund", details: "Exists in code but not in openapi.yaml" }]
```
