# Configuração MCP para IA - docs-kit

Este documento explica como configurar uma IA (como Claude, GitHub Copilot, ou outros clientes MCP) para usar o sistema docs-kit via Model Context Protocol (MCP).

## 🚀 Visão Geral

O docs-kit fornece um servidor MCP que permite que IAs analisem código TypeScript e gerem documentação inteligente usando ferramentas especializadas.

## 🛠️ Ferramentas MCP Disponíveis

### 1. `generateDocs`
Atualiza documentação baseada em mudanças no código.
- **Parâmetros**: `base`, `head`, `dryRun`, `docsDir`

### 2. `explainSymbol`
Explica um símbolo de código combinando análise e documentação existente.
- **Parâmetros**: `symbol`, `docsDir`

### 3. `generateMermaid`
Gera diagramas Mermaid para símbolos.
- **Parâmetros**: `symbols`, `type` (classDiagram, sequenceDiagram, flowchart)

### 4. `scanFile`
Escaneia arquivo TypeScript e gera documentação para símbolos não documentados.
- **Parâmetros**: `filePath`, `docsDir`, `dbPath`

## ⚙️ Configuração para Diferentes IAs

### Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docs-kit": {
      "command": "node",
      "args": ["/caminho/para/docs-kit/dist/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### VS Code + GitHub Copilot

1. Instale a extensão MCP para VS Code
2. Configure o servidor no `settings.json`:

```json
{
  "mcp.servers": {
    "docs-kit": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/server.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Outros Clientes MCP

Para qualquer cliente MCP compatível:

```json
{
  "name": "docs-kit",
  "command": "node",
  "args": ["caminho/para/dist/server.js"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 📋 Workflow Recomendado para IA

### 1. Análise Inicial
```
1. Use scanFile para arquivos novos
2. Use explainSymbol para entender símbolos existentes
3. Use generateMermaid para visualizar relacionamentos
```

### 2. Geração de Documentação
```
1. Gere documentação básica com generate-repo-docs
2. Use explainSymbol para enriquecer descrições
3. Use generateMermaid para adicionar diagramas
4. Use generateDocs para atualizar baseado em mudanças
```

### 3. Melhoria Contínua
```
1. Monitore mudanças com generateDocs (base/head)
2. Atualize documentação quando código mudar
3. Mantenha diagramas sincronizados
```

## 🎯 Exemplos de Uso com IA

### Documentar uma Nova Classe

```
IA: "Vou documentar a classe UserService."

1. scanFile(filePath: "src/services/UserService.ts")
2. explainSymbol(symbol: "UserService")
3. generateMermaid(symbols: "UserService", type: "classDiagram")
```

### Atualizar Documentação Após Mudanças

```
IA: "Código mudou, vou atualizar a documentação."

1. generateDocs(base: "main", head: "HEAD", dryRun: false)
```

### Explicar um Símbolo Complexo

```
IA: "Preciso explicar como funciona o analyzeChanges."

1. explainSymbol(symbol: "analyzeChanges")
2. generateMermaid(symbols: "analyzeChanges,*", type: "sequenceDiagram")
```

## 🔧 Comandos CLI para Teste

```bash
# Gerar documentação básica
npm run generate-docs

# Melhorar documentação com MCP (limitado)
node dist/cli.js improve-docs-with-mcp 5

# Iniciar servidor MCP manualmente
node dist/server.js
```

## 📚 Estrutura de Documentação

A documentação é organizada em:
- `docs/domain/` - Documentação por símbolo
- `docs/tasks/` - Documentação de tarefas
- Frontmatter YAML com metadados
- Markdown com descrições e exemplos

## 🚨 Troubleshooting

### Servidor não inicia
- Verifique se `dist/server.js` existe (rode `npm run build`)
- Verifique dependências: `npm install`

### Ferramentas não funcionam
- Verifique se o banco de dados existe: `.doc-kit/registry.db`
- Verifique permissões de arquivo

### IA não conecta
- Verifique caminho absoluto para o executável
- Teste conexão manual: `node dist/server.js`

## 🔄 Próximos Passos

1. **Integração Automática**: Configurar hooks de git para atualização automática
2. **Qualidade de IA**: Melhorar prompts para gerar documentação mais rica
3. **Templates Customizáveis**: Permitir templates específicos por projeto
4. **Validação**: Adicionar validação automática da documentação gerada

---

Para mais informações, consulte a documentação do projeto ou abra uma issue.