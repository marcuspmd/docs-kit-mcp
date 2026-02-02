#!/bin/bash
# Run each indexer test file in complete isolation to prevent tree-sitter state corruption

set -e  # Exit on first failure

JEST_CMD="node --experimental-vm-modules node_modules/jest/bin/jest.js"

echo "Running indexer tests in complete isolation..."
echo ""

# Run each test file individually without project selector to ensure isolation
$JEST_CMD tests/indexer/languageStrategies.test.ts
$JEST_CMD tests/indexer/TypeScriptStrategy.test.ts
$JEST_CMD tests/indexer/indexer.test.ts
$JEST_CMD tests/indexer/symbol.types.test.ts
$JEST_CMD tests/indexer/relationshipExtractor.test.ts
$JEST_CMD tests/indexer/metricsCollector.test.ts

echo ""
echo "✅ All indexer tests passed!"
