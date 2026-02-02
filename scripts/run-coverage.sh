#!/bin/bash
# Run all tests with coverage, using isolation for indexer tests

set -e  # Exit on first failure

JEST_CMD="node --experimental-vm-modules node_modules/jest/bin/jest.js"

echo "Running tests with coverage..."
echo ""

# Clean previous coverage
rm -rf coverage

# Run each indexer test file individually with coverage
echo "Running indexer tests..."
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' src/indexer/languages/__tests__/languageStrategies.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' src/indexer/languages/__tests__/TypeScriptStrategy.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' src/indexer/__tests__/indexer.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' src/indexer/__tests__/symbol.types.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' src/indexer/__tests__/relationshipExtractor.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' src/indexer/__tests__/metricsCollector.test.ts

# Run unit tests with coverage
echo ""
echo "Running unit tests..."
$JEST_CMD --coverage --selectProjects unit

echo ""
echo "✅ Coverage collection complete!"
echo "View report: open coverage/lcov-report/index.html"
