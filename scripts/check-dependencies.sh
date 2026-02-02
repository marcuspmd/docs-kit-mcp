#!/usr/bin/env bash
#
# check-dependencies.sh
# Verifica se todas as dependências necessárias para testes estão instaladas
#

set -e

echo "🔍 Verificando dependências do docs-kit..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MISSING=()
WARNINGS=()

# Função para verificar comando
check_command() {
    local cmd=$1
    local name=$2
    local required=$3

    if command -v "$cmd" &> /dev/null; then
        local version=$("$cmd" --version 2>&1 | head -n 1)
        echo -e "${GREEN}✓${NC} $name: $version"
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} $name: não encontrado"
            MISSING+=("$name")
        else
            echo -e "${YELLOW}⚠${NC} $name: não encontrado (opcional)"
            WARNINGS+=("$name")
        fi
        return 1
    fi
}

echo "=== Ferramentas Essenciais ==="
check_command "node" "Node.js" "true"
check_command "npm" "npm" "true"

echo ""
echo "=== Build Tools ==="
check_command "gcc" "GCC (C compiler)" "true"
check_command "g++" "G++ (C++ compiler)" "true"
check_command "make" "Make" "true"
check_command "python3" "Python3" "true"

echo ""
echo "=== Validadores de Código ==="
check_command "bash" "Bash" "false"
check_command "dart" "Dart" "false"
check_command "flutter" "Flutter" "false"
check_command "python" "Python" "false"
check_command "go" "Go" "false"
check_command "php" "PHP" "false"

echo ""
echo "=== PHP Tools (opcional) ==="
check_command "php-cs-fixer" "PHP CS Fixer" "false"
check_command "phpstan" "PHPStan" "false"

echo ""
echo "=== Resumo ==="

if [ ${#MISSING[@]} -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Todas as dependências essenciais estão instaladas!"
else
    echo -e "${RED}✗${NC} Dependências essenciais faltando:"
    for dep in "${MISSING[@]}"; do
        echo "  - $dep"
    done
    echo ""
    echo "Instale as dependências faltantes antes de executar os testes."
    echo "Consulte docs/examples/ci-testing-setup.md para instruções."
    exit 1
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠${NC} Validadores opcionais não instalados:"
    for dep in "${WARNINGS[@]}"; do
        echo "  - $dep"
    done
    echo ""
    echo "Alguns testes de validação podem assumir que o código é válido."
    echo "Para validação completa, instale os validadores faltantes."
    echo "Consulte docs/examples/ci-testing-setup.md para instruções."
fi

echo ""
echo "=== Verificando módulos NPM ==="

if [ ! -d "node_modules" ]; then
    echo -e "${RED}✗${NC} node_modules não encontrado"
    echo "Execute: npm ci --legacy-peer-deps"
    exit 1
fi

# Verificar tree-sitter modules críticos
declare -a ts_modules=(
    "tree-sitter"
    "tree-sitter-typescript"
    "tree-sitter-javascript"
    "tree-sitter-python"
    "tree-sitter-go"
    "tree-sitter-php"
)

for module in "${ts_modules[@]}"; do
    if [ -d "node_modules/$module" ]; then
        echo -e "${GREEN}✓${NC} $module instalado"
    else
        echo -e "${RED}✗${NC} $module não encontrado"
        MISSING+=("$module")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}✗${NC} Alguns módulos tree-sitter estão faltando."
    echo "Execute: npm ci --legacy-peer-deps"
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} Ambiente pronto para executar os testes!"
echo ""
echo "Comandos disponíveis:"
echo "  npm test                  # Executar todos os testes"
echo "  npm run test:coverage     # Executar com cobertura"
echo "  npm run build             # Compilar o projeto"
