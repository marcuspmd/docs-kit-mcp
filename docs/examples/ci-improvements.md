---
title: CI Test Infrastructure Improvements
date: 2026-02-02
category: infrastructure
---

# CI Test Infrastructure Improvements

## Problema Identificado

Ao executar `npm run test:coverage` no GitHub Actions, diversos testes estavam falhando:

### 1. Testes do Indexer (Tree-sitter)
- **Files**: `tests/indexer/indexer.test.ts`, `tests/indexer/relationshipExtractor.test.ts`, `tests/indexer/metricsCollector.test.ts`
- **Sintoma**: Símbolos retornando `undefined`, arrays vazios
- **Causa**: Bindings nativas do tree-sitter não compiladas no ambiente CI
- **Status**: ✅ Resolvido

### 2. Validadores de Código
- **Files**: `tests/docs.test.ts`
- **Sintoma**: Validação de Bash, Dart, Flutter falhando; timeout no TypeScript
- **Causa**: Ferramentas de validação não instaladas no Ubuntu padrão
- **Status**: ✅ Resolvido

## Soluções Implementadas

### 1. Build Tools para Tree-sitter

Adicionado step nos workflows para instalar ferramentas de compilação C/C++:

```yaml
- name: Install build essentials
  run: |
    sudo apt-get update
    sudo apt-get install -y build-essential python3
```

**Por quê?** Tree-sitter usa bindings nativas em C/C++ que precisam ser compiladas durante `npm install`. Sem as ferramentas de build, os módulos falham silenciosamente.

### 2. Instalação de Validadores de Linguagem

Adicionado steps para instalar todas as ferramentas de validação:

#### Dart SDK
```yaml
- name: Install Dart SDK
  uses: dart-lang/setup-dart@v1
  with:
    sdk: stable
```

#### Flutter
```yaml
- name: Install Flutter
  uses: subosito/flutter-action@v2
  with:
    flutter-version: '3.x'
    channel: 'stable'
```

#### Python
```yaml
- name: Install Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.11'
```

#### Go
```yaml
- name: Install Go
  uses: actions/setup-go@v5
  with:
    go-version: '1.21'
```

#### PHP
```yaml
- name: Install PHP
  uses: shivammathur/setup-php@v2
  with:
    php-version: '8.2'
    tools: php-cs-fixer, phpstan
```

### 3. Workflow de Testes Separado

Criado `.github/workflows/test.yml` para validação em PRs:

- Executa em pull requests e pushs
- Instala todas as dependências
- Executa testes com cobertura
- Envia relatório para Codecov

### 4. Workflow de Deploy Atualizado

Atualizado `.github/workflows/deploy.yml`:

- Inclui as mesmas dependências do workflow de teste
- Garante que os testes passam antes do deploy
- Gera documentação e site
- Faz deploy para GitHub Pages

### 5. Script de Verificação de Dependências

Criado `scripts/check-dependencies.sh`:

```bash
npm run check:deps
```

Verifica se todas as dependências necessárias estão instaladas:
- ✅ Ferramentas essenciais (Node, npm)
- ✅ Build tools (gcc, g++, make, python3)
- ⚠️  Validadores opcionais (bash, dart, flutter, python, go, php)
- ✅ Módulos tree-sitter

### 6. Documentação de Setup

Criado `docs/examples/ci-testing-setup.md`:

- Instruções de instalação por plataforma (macOS, Ubuntu, Windows)
- Explicação do comportamento dos validadores
- Troubleshooting comum
- CI/CD best practices

## Arquivos Modificados

### Novos Arquivos
```
.github/workflows/test.yml              # Workflow de teste para PRs
scripts/check-dependencies.sh            # Script de verificação
docs/examples/ci-testing-setup.md        # Documentação detalhada
docs/examples/ci-improvements.md         # Este arquivo
```

### Arquivos Atualizados
```
.github/workflows/deploy.yml            # Adicionadas dependências
package.json                            # Adicionado script check:deps
```

## Comportamento dos Validadores

Os validadores implementam "graceful degradation":

### Com Ferramenta Instalada
```typescript
await validator.validate("echo 'hello'")
// { valid: true } ou { valid: false, error: "..." }
```

### Sem Ferramenta Instalada
```typescript
await validator.validate("echo 'hello'")
// { valid: true } - assume válido
```

Isso permite:
- ✅ Desenvolvimento sem todas as ferramentas instaladas
- ✅ Validação completa no CI
- ✅ Feedback claro sobre problemas de sintaxe

## Testes no Ambiente CI

### Antes (Ubuntu padrão)
```
❌ tests/indexer/indexer.test.ts         (16 failed)
❌ tests/indexer/relationshipExtractor   (5 failed)
❌ tests/indexer/metricsCollector        (3 failed)
❌ tests/docs.test.ts                    (4 failed)
```

### Depois (Com dependências)
```
✅ tests/indexer/indexer.test.ts         (21 passed)
✅ tests/indexer/relationshipExtractor   (5 passed)
✅ tests/indexer/metricsCollector        (all passed)
✅ tests/docs.test.ts                    (all passed)
```

## Como Usar

### Para Desenvolvimento Local

1. **Verificar dependências**:
   ```bash
   npm run check:deps
   ```

2. **Instalar dependências faltantes**:
   - Consulte `docs/examples/ci-testing-setup.md`
   - macOS: Use Homebrew
   - Ubuntu: Use apt-get

3. **Executar testes**:
   ```bash
   npm test                  # Todos os testes
   npm run test:coverage     # Com cobertura
   ```

### Para CI/CD

Os workflows agora estão completamente configurados:

```yaml
# Pull Requests e Pushs → .github/workflows/test.yml
→ Instalar dependências
→ Compilar projeto
→ Executar testes
→ Enviar cobertura

# Push para master → .github/workflows/deploy.yml
→ [Mesmos steps do test.yml]
→ Gerar índice
→ Gerar site
→ Deploy para Pages
```

## Próximos Passos

### Melhorias Futuras

1. **Matrix Build** (opcional):
   ```yaml
   strategy:
     matrix:
       node: [18, 20, 22]
       os: [ubuntu-latest, macos-latest]
   ```

2. **Cache de Validadores**:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: |
         ~/.pub-cache
         ~/.cargo
       key: validators-${{ runner.os }}
   ```

3. **Testes Paralelos**:
   ```bash
   npm test -- --maxWorkers=4
   ```

4. **Renovate/Dependabot**:
   - Atualização automática de actions
   - Atualização de tree-sitter parsers

## Lições Aprendidas

1. **Bindings Nativas**: Sempre instalar build tools antes de módulos com código nativo
2. **CI vs Local**: Ambientes CI têm menos ferramentas instaladas por padrão
3. **Graceful Degradation**: Validadores devem funcionar mesmo sem ferramentas instaladas
4. **Documentação**: Scripts de verificação ajudam desenvolvedores novos
5. **Workflows Separados**: Test vs Deploy workflows mantém pipeline organizado

## Referências

- [Tree-sitter Node Bindings](https://github.com/tree-sitter/node-tree-sitter)
- [GitHub Actions: Building Node.js](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)
- [Native Dependencies in CI](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#preinstalled-software)
