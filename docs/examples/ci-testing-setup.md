---
title: CI Testing Setup
category: examples
---

# CI Testing Setup

Este documento descreve como configurar o ambiente de CI para executar todos os testes com validação completa de código.

## Dependências de Linguagem

O projeto `docs-kit` suporta validação de código em múltiplas linguagens. Para executar todos os testes com sucesso, as seguintes ferramentas devem estar instaladas:

### Ferramentas Essenciais

1. **Build Tools (C/C++)**
   - Necessário para compilar as bindings nativas do Tree-sitter
   - Ubuntu/Debian: `build-essential python3`
   - macOS: Xcode Command Line Tools
   - Windows: Visual Studio Build Tools

2. **Node.js 18+**
   - Runtime principal do projeto
   - Gerenciador de pacotes: npm

### Validadores de Código

3. **Bash/Shell**
   - Pré-instalado na maioria dos sistemas Unix
   - Usado para validar scripts shell

4. **Dart SDK**
   - Versão: stable (latest)
   - Necessário para validar código Dart

5. **Flutter SDK**
   - Versão: 3.x stable
   - Necessário para validar widgets Flutter

6. **Python**
   - Versão: 3.11+
   - Usado para validar código Python

7. **Go**
   - Versão: 1.21+
   - Usado para validar código Go

8. **PHP**
   - Versão: 8.2+
   - Ferramentas adicionais: php-cs-fixer, phpstan
   - Usado para validar código PHP

## Configuração no GitHub Actions

O projeto inclui dois workflows principais:

### 1. Test Workflow (`.github/workflows/test.yml`)

Executado em PRs e pushs para validar o código:

```yaml
- Instala build-essential para compilar tree-sitter
- Instala todas as linguagens de validação
- Executa npm ci --legacy-peer-deps
- Executa npm run build
- Executa npm run test:coverage
- Envia cobertura para Codecov
```

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

Executado em pushs para master, além de testar:

```yaml
- Gera o índice do projeto
- Gera o site de documentação
- Faz deploy para GitHub Pages
```

## Instalação Local

### macOS

```bash
# Xcode Command Line Tools (se ainda não instalado)
xcode-select --install

# Dart
brew tap dart-lang/dart
brew install dart

# Flutter
brew install --cask flutter

# Python (se ainda não instalado)
brew install python@3.11

# Go
brew install go

# PHP
brew install php@8.2
brew install php-cs-fixer phpstan
```

### Ubuntu/Debian

```bash
# Build essentials
sudo apt-get update
sudo apt-get install -y build-essential python3

# Dart
sudo apt-get install apt-transport-https
wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/dart.gpg
echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' | sudo tee /etc/apt/sources.list.d/dart_stable.list
sudo apt-get update
sudo apt-get install dart

# Flutter
sudo snap install flutter --classic

# Python 3.11
sudo apt-get install python3.11

# Go
sudo apt-get install golang-1.21

# PHP
sudo apt-get install php8.2 php8.2-cli
composer global require friendsofphp/php-cs-fixer phpstan/phpstan
```

## Executando os Testes

### Todos os testes

```bash
npm run test
```

### Com cobertura

```bash
npm run test:coverage
```

### Teste específico

```bash
npm test -- tests/indexer/indexer.test.ts
```

### Com detalhes verbose

```bash
npm test -- tests/docs.test.ts --verbose
```

## Comportamento dos Validadores

Os validadores de código seguem uma estratégia de "falha graceful":

1. **Ferramenta instalada**: Executa validação real
2. **Ferramenta não instalada**: Retorna `valid: true` (assume válido)
3. **Erro de sintaxe**: Retorna `valid: false` com mensagem de erro

Isso permite que o projeto seja desenvolvido sem todas as ferramentas instaladas, mas no CI todas são instaladas para validação completa.

## Troubleshooting

### Tree-sitter retorna arrays vazios

**Problema**: Tests de indexer falhando com símbolos undefined

**Causa**: Bindings nativas do tree-sitter não compiladas

**Solução**:
```bash
# Limpar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install

# Garantir que build-essential está instalado
# Ubuntu/Debian
sudo apt-get install build-essential

# macOS
xcode-select --install
```

### Validadores sempre retornam true

**Problema**: Testes de validação não detectam erros

**Causa**: Ferramentas de linguagem não instaladas

**Solução**: Instalar a ferramenta correspondente (veja seção "Instalação Local")

### Timeout em testes de validação

**Problema**: Teste excede 5000ms de timeout

**Causa**: Ferramenta lenta ou não instalada corretamente

**Solução**:
```javascript
// Aumentar timeout no teste
it("validates code", async () => {
  // test code
}, 10000); // 10 segundos
```

## CI/CD Best Practices

1. **Cache de dependências**: Use `cache: 'npm'` no setup-node
2. **Instalação limpa**: Use `npm ci --legacy-peer-deps` em vez de `npm install`
3. **Paralelização**: Configure matrix build para diferentes versões do Node
4. **Cobertura**: Sempre envie relatórios de cobertura para Codecov
5. **Fail-fast**: Configure `continue-on-error: false` para steps críticos

## Referências

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [GitHub Actions: Setup Node](https://github.com/actions/setup-node)
- [Dart SDK Setup Action](https://github.com/dart-lang/setup-dart)
- [Flutter Setup Action](https://github.com/subosito/flutter-action)
