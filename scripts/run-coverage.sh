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
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' tests/indexer/languageStrategies.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' tests/indexer/TypeScriptStrategy.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' tests/indexer/indexer.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' tests/indexer/symbol.types.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' tests/indexer/relationshipExtractor.test.ts
$JEST_CMD --coverage --collectCoverageFrom='src/indexer/**/*.ts' tests/indexer/metricsCollector.test.ts

# Run unit tests with coverage
echo ""
echo "Running unit tests..."
$JEST_CMD --coverage --selectProjects unit

echo ""
echo "✅ Coverage collection complete!"
echo "View report: open coverage/lcov-report/index.html"
