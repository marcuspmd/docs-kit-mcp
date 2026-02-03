# TypeScript Guards

Implementação de regras de arquitetura específicas para TypeScript/JavaScript, seguindo o padrão estabelecido pelos [PHP Guards](../php/README.md).

## Estrutura

```
src/governance/guards/typescript/
├── rules/
│   ├── __tests__/
│   ├── namingConvention.ts      # Regras de nomenclatura (classes, interfaces, funções, etc.)
│   ├── maxComplexity.ts          # Limite de complexidade ciclomática
│   ├── maxParameters.ts          # Limite de parâmetros em funções
│   ├── maxLines.ts               # Limite de linhas em funções e classes
│   ├── missingReturnType.ts      # Enforcement de tipos de retorno explícitos
│   ├── forbiddenImport.ts        # Prevenção de imports não desejados
│   ├── layerBoundary.ts          # Enforcement de limites entre camadas arquiteturais
│   └── index.ts                  # Agregador de rules
├── typeScriptGuards.ts           # API de alto nível
└── __tests__/
    └── typeScriptGuards.test.ts  # Testes dos guards
```

## Regras Implementadas

### 1. **Naming Convention** (7 regras)
- `typescript:naming_class` - Classes devem ser PascalCase
- `typescript:naming_interface` - Interfaces devem ser PascalCase (com suffix Interface opcional)
- `typescript:naming_type` - Type aliases devem ser PascalCase
- `typescript:naming_method` - Métodos devem ser camelCase
- `typescript:naming_function` - Funções devem ser camelCase
- `typescript:naming_constant` - Constantes devem ser UPPER_SNAKE_CASE
- `typescript:naming_variable` - Variáveis devem ser camelCase

### 2. **Layer Boundary** (2 regras)
- `typescript:layer_boundary` - Enforcement padrão de limites entre camadas
- `typescript:layer_boundary_strict` - Enforcement rigoroso (mínimos cross-cutting imports)

**Camadas padrão:**
- presentation: controllers, pages, components
- application: services, use-cases
- domain: domain entities
- infrastructure: repositories, database

### 3. **Forbidden Imports** (3 regras)
- `typescript:forbidden_import_internal` - Previne imports de módulos internos/private
- `typescript:forbidden_import_barrel` - Previne imports circulares via índices
- `typescript:forbidden_import_external` - Previne imports de packages não autorizados

### 4. **Max Complexity** (2 regras)
- `typescript:max_complexity` - Complexidade máxima de 10 (warning)
- `typescript:max_complexity_strict` - Complexidade máxima de 5 (error)

### 5. **Max Parameters** (2 regras)
- `typescript:max_parameters` - Máximo 5 parâmetros (warning)
- `typescript:max_parameters_strict` - Máximo 3 parâmetros (error)

### 6. **Max Lines** (2 regras)
- `typescript:max_lines` - Funções não devem exceder 50 linhas
- `typescript:max_lines_class` - Classes não devem exceder 200 linhas

### 7. **Missing Return Type** (2 regras)
- `typescript:missing_return_type` - Functions/methods exportadas devem ter tipo de retorno explícito
- `typescript:missing_return_type_strict` - Todas as functions/methods devem ter tipo de retorno

## API de Alto Nível

### Funções Principais

```typescript
// Obter todas as regras disponíveis
getTypeScriptAvailableRules(): LanguageRule[]

// Obter códigos de todas as regras
getTypeScriptAvailableCodes(): string[]

// Filtrar regras por código (whitelist)
filterTypeScriptRulesByCodes(codes?: string[]): LanguageRule[]

// Obter uma regra específica por código
getTypeScriptRuleByCode(code: string): LanguageRule | undefined

// Verificar se uma regra existe
hasTypeScriptRule(code: string): boolean

// Obter regras por categoria
getTypeScriptRulesByCategory(category: keyof typeof TS_RULE_CATEGORIES): LanguageRule[]

// Converter LanguageRule para ArchRule (com overrides opcionais)
toArchRule(
  rule: LanguageRule,
  configOverride?: Record<string, unknown>,
  severityOverride?: "error" | "warning"
): ArchRule
```

### Categorias de Regras

```typescript
TS_RULE_CATEGORIES = {
  naming: [/* 7 rules */],
  layerBoundary: [/* 2 rules */],
  forbiddenImport: [/* 3 rules */],
  metrics: [/* 6 rules */],
  returnType: [/* 2 rules */],
}
```

## Integração com ArchGuard

As regras TypeScript são integradas ao `languageGuardManager.ts`:

```typescript
// O manager detecta automaticamente TypeScript/JavaScript
const language = detectLanguageFromPath("src/services/userService.ts"); // "typescript"

// E expõe as regras através da API canônica
const rules = getAvailableRulesForLanguage("typescript");
const hasRule = hasRuleForLanguage("typescript", "typescript:naming_class"); // true
```

## Uso em Configuração

```javascript
// docs.config.js
export default {
  archGuard: {
    languages: [
      {
        language: "typescript",
        rules: [
          "typescript:naming_class",
          "typescript:naming_interface",
          "typescript:max_complexity",
        ],
        overrideRules: [
          {
            code: "typescript:max_complexity",
            severity: "error",
            config: { max: 7 }
          }
        ],
        ignorePaths: [
          "**/dist/**",
          "**/build/**",
          "**/*.test.ts"
        ]
      }
    ]
  }
}
```

## Testes

Todos os TypeScript Guards incluem testes abrangentes:

```bash
npm test -- typeScriptGuards
```

**Cobertura de testes:**
- Validação da estrutura de regras
- Filtros por código
- Busca individual
- Categorização
- Conversão para ArchRule
- Suporte a TypeScript e JavaScript

## Próximas Extensões

Possíveis regras adicionais para o futuro:
- `typescript:async_consistency` - Enforce async/await patterns
- `typescript:type_narrowing` - Enforce type guards
- `typescript:error_handling` - Enforce try/catch patterns
- `typescript:import_sorting` - Enforce import organization
- `typescript:performance` - Detect performance anti-patterns
