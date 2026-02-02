/**
 * Global setup for indexer tests
 * Forces cleanup between test files to prevent tree-sitter state contamination
 */

// Force garbage collection between test suites if available
if (typeof global.gc === "function") {
  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });
}

// Additional cleanup to help with tree-sitter native bindings
afterAll(() => {
  // Give time for any pending operations to complete
  return new Promise((resolve) => setTimeout(resolve, 100));
});
