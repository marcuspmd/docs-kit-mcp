---
title: Auto-Discovery de Documentação
symbols: []
---

# Auto-Discovery de Documentação

## O que é Auto-Discovery?

O recurso de auto-discovery permite que você configure uma pasta inteira para ter seus arquivos markdown automaticamente indexados e vinculados, sem precisar listar cada arquivo individualmente na configuração.

## Como Usar

No seu `docs.config.js`, você pode adicionar uma entrada com `autoDiscovery: true`:

```javascript
export default {
  // ... outras configurações
  docs: [
    // Documentos específicos (configuração manual)
    {
      path: "./docs/domain/arch-guard-rules.md",
      title: "Arch Guard Rules",
      name: "arch-guard-rules",
      category: "domain",
      module: "Main",
      symbols: ["createArchGuard", "ArchGuard"],
      next: "docs/domain/projectStatus.md",
      showOnMenu: true
    },

    // Auto-discovery: descobre todos os .md recursivamente
    {
      path: "./docs/examples/",
      autoDiscovery: true,
      showOnMenu: true
    }
  ],
};
```

## O que é Gerado Automaticamente?

Quando você usa `autoDiscovery: true`, o sistema gera automaticamente:

### 1. **module**
Derivado da estrutura de diretórios:
- `./docs/examples/file.md` → `"examples"`
- `./docs/examples/advanced/file.md` → `"examples/advanced"`

### 2. **name**
Nome do arquivo sem extensão:
- `getting-started.md` → `"getting-started"`
- `deployment.md` → `"deployment"`

### 3. **category**
Diretório pai imediato:
- `./examples/basic/file.md` → `"basic"`
- `./examples/advanced/file.md` → `"advanced"`

### 4. **title**
Capitalizando e formatando o nome do arquivo:
- `getting-started.md` → `"Getting Started"`
- `advanced-deployment.md` → `"Advanced Deployment"`

### 5. **next/previous**
Links automáticos baseados na ordem alfabética dos arquivos:
```
examples/
  ├── a-intro.md      (previous: none, next: b-setup.md)
  ├── b-setup.md      (previous: a-intro.md, next: c-deploy.md)
  └── c-deploy.md     (previous: b-setup.md, next: none)
```

## Respeitando Links Explícitos

Se você tiver documentos com `next` e `previous` explicitamente definidos, esses valores são preservados:

```javascript
{
  path: "./docs/manual/intro.md",
  next: "./docs/manual/conclusion.md",  // Explícito - será mantido
  autoDiscovery: true
}
```

## Estrutura de Diretórios Sugerida

Para aproveitar melhor o auto-discovery, organize seus documentos com prefixos numéricos:

```
docs/
└── examples/
    ├── basic/
    │   ├── 01-getting-started.md
    │   ├── 02-installation.md
    │   └── 03-first-steps.md
    └── advanced/
        ├── 01-deployment.md
        ├── 02-scaling.md
        └── 03-monitoring.md
```

Isso garante uma ordem consistente e intuitiva para navegação.

## Simbolos no Frontmatter

Mesmo com auto-discovery, você ainda pode definir symbols no frontmatter de cada arquivo:

```markdown
---
title: Exemplo de Componente
symbols: [MyComponent, ComponentProps]
---

# Exemplo de Componente
...
```

Os symbols serão extraídos durante a indexação e vinculados ao documento.

## Benefícios

1. **Menos Manutenção**: Não precisa atualizar a config toda vez que adicionar um novo doc
2. **Navegação Automática**: Links next/previous gerados automaticamente
3. **Consistência**: Convenções de nomenclatura aplicadas uniformemente
4. **Flexibilidade**: Pode misturar auto-discovery com configuração manual
