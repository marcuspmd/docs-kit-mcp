---
title: Dynamic Relationship Detection
category: feature
lastUpdated: 2026-02-03
---

# Dynamic Relationship Detection

## Problema

O **Reaper** (dead code scanner) estava reportando falsos positivos para símbolos registrados dinamicamente, como:

```typescript
// src/server/tools/explainSymbol.tool.ts
export function registerExplainSymbolTool(server: McpServer, deps: ServerDependencies): void {
  server.registerTool(
    "explainSymbol",  // ← String literal
    { description: "...", inputSchema: {...} },
    async (params) => {
      // Handler implementation
    }
  );
}
```

O símbolo `explainSymbol` existe apenas como **string literal** no código, não como função exportada diretamente. O scanner AST tradicional não detectava esse tipo de relacionamento, resultando em:

❌ **Falso positivo:** "Symbol 'explainSymbol' no longer exists" (orphan_doc)

## Solução: Dynamic Relationship Detector

Criamos um detector agnóstico de linguagem que identifica **padrões de registro dinâmico** via Tree-sitter AST, sem depender de construções específicas de JS/TS.

### Padrões Detectados

```typescript
const REGISTRATION_PATTERNS = [
  // MCP/Plugin systems
  "registerTool", "registerCommand", "registerHandler", "registerProvider",

  // Event systems
  "on", "addEventListener", "subscribe", "listen", "addListener",

  // Routing/HTTP
  "route", "get", "post", "put", "delete", "patch", "use",

  // DI containers
  "register", "bind", "singleton", "transient",

  // Test frameworks
  "describe", "test", "it", "beforeEach", "afterEach"
];
```

### Algoritmo

1. **Detecta chamadas de registro** via AST (call_expression + member_expression)
2. **Extrai nome registrado** do primeiro argumento (string literal ou identifier)
3. **Localiza função container** que faz o registro
4. **Cria relacionamento inverso**: O símbolo registrado **é usado por** a função de registro

```typescript
// Exemplo de relacionamento gerado:
{
  sourceId: "registerExplainSymbolTool",  // Função que registra
  targetId: "explainSymbol",               // Símbolo registrado
  type: "dynamic_call"                     // Tipo de relacionamento
}
```

### Integração

O detector é chamado automaticamente em `relationshipExtractor.ts` durante a indexação:

```typescript
// Static relationships (AST-based: extends, implements, calls)
walkForRelationships(tree.rootNode, file, symsInFile, addRel, strategy);

// Dynamic relationships (registration patterns)
const dynamicRels = detectDynamicRelationships(tree, file, symsInFile);
const convertedRels = dynamicToSymbolRelationships(dynamicRels, symbols);
```

### Benefícios

✅ **Funciona em todas as linguagens** (Python, PHP, Go, Ruby, etc.)
✅ **Detecta padrões comuns** (eventos, rotas, DI, testes)
✅ **Elimina falsos positivos** do Reaper
✅ **Melhora análise de impacto** - símbolos registrados são vistos como "usados"

## Exemplos de Uso

### 1. MCP Tool Registration (TypeScript)

```typescript
server.registerTool("myTool", { ... }, async () => { ... })
// → Relacionamento: registerXxxTool USES myTool
```

### 2. Event Listener (JavaScript)

```javascript
emitter.on("userCreated", handleUserCreated)
// → Relacionamento: setupListeners USES userCreated
```

### 3. HTTP Route (Python FastAPI)

```python
@app.get("/users")
def get_users():
    pass
# → Relacionamento: get_users USES /users
```

### 4. DI Container (PHP Laravel)

```php
$container->bind(UserService::class, UserServiceImpl::class);
// → Relacionamento: bindServices USES UserService
```

## Testing

Para testar o detector isoladamente:

```typescript
import { detectDynamicRelationships } from "./indexer/dynamicRelationshipDetector.js";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

const parser = new Parser();
parser.setLanguage(TypeScript.typescript);

const code = `
  function setup() {
    server.registerTool("myTool", {}, async () => {});
  }
`;

const tree = parser.parse(code);
const rels = detectDynamicRelationships(tree, "test.ts", symbols);
console.log(rels);
// [{ sourceId: "myTool", targetId: "setup", type: "dynamic_registration", ... }]
```

## Roadmap

- [ ] Adicionar mais padrões de registro (GraphQL resolvers, RPC handlers)
- [ ] Detectar decorators (@Injectable, @Component, etc.)
- [ ] Suportar template literals em nomes de registro
- [ ] Métricas de confiança para cada tipo de registro

## Referências

- [src/indexer/dynamicRelationshipDetector.ts](../../src/indexer/dynamicRelationshipDetector.ts) - Implementação
- [src/indexer/relationshipExtractor.ts](../../src/indexer/relationshipExtractor.ts) - Integração
- [src/governance/reaper.ts](../../src/governance/reaper.ts) - Dead code scanner
