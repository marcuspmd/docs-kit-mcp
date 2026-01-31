# 📊 Comando projectStatus - Demonstração

Este comando gera um relatório abrangente do status do projeto, incluindo:

## Métricas Principais
- **Cobertura de Documentação**: Porcentagem de símbolos documentados
- **Tipos de Símbolos**: Distribuição por tipo (classes, funções, interfaces, etc.)
- **Padrões Detectados**: Instâncias de padrões de design identificados
- **Violações de Arquitetura**: Problemas encontrados nas regras definidas
- **Problemas de Qualidade**: Código morto, documentação órfã, etc.

## Exemplo de Uso

```bash
# No VS Code/Copilot
@docs-agent projectStatus

# Ou via CLI MCP
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "projectStatus", "arguments": {}}}' | node dist/server.js
```

## Exemplo de Saída

```
# 📊 Project Status Report

## 📈 Documentation Coverage
- Total Symbols: 517
- Documented Symbols: 234
- Coverage: 45.3%

## 🔧 Symbol Types
- class: 89
- function: 156
- interface: 43
- method: 198
- enum: 12

## 🎯 Detected Patterns
- observer: 5 instances
- factory: 3 instances
- singleton: 2 instances

## ⚠️ Architecture Violations
- warning: 12 issues
- error: 2 issues

## 🧹 Code Quality Issues
- dead_code: 8 items
- orphan_doc: 3 items

## 📊 Relationships
- Total Relationships: 342
- Average References per Symbol: 0.7
```

## Benefícios

- **Visão Geral Rápida**: Entenda o estado atual da documentação e código
- **Identificação de Problemas**: Localize áreas que precisam de atenção
- **Métricas Quantitativas**: Acompanhe progresso ao longo do tempo
- **Suporte à Governança**: Base para decisões sobre melhorias no projeto