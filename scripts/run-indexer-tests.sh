#!/bin/bash
# Run each indexer test file in complete isolation to prevent tree-sitter state corruption

set -e  # Exit on first failure

JEST_CMD="node --experimental-vm-modules node_modules/jest/bin/jest.js"

echo "Running indexer tests in complete isolation..."
echo ""

# Run each test file individually without project selector to ensure isolation
$JEST_CMD src/indexer/languages/__tests__/languageStrategies.test.ts
$JEST_CMD src/indexer/languages/__tests__/TypeScriptStrategy.test.ts
$JEST_CMD src/indexer/__tests__/indexer.test.ts
$JEST_CMD src/indexer/__tests__/symbol.types.test.ts
$JEST_CMD src/indexer/__tests__/relationshipExtractor.test.ts
$JEST_CMD src/indexer/__tests__/metricsCollector.test.ts
$JEST_CMD src/indexer/__tests__/lcovCollector.test.ts
$JEST_CMD src/indexer/__tests__/dynamicRelationshipDetector.test.ts

echo ""
echo "✅ All indexer tests passed!"
