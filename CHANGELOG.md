# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **CI/CD Infrastructure**: Complete testing infrastructure for GitHub Actions
  - Added `.github/workflows/test.yml` for PR and push testing
  - Updated `.github/workflows/deploy.yml` with language validators
  - Build essentials installation for tree-sitter native bindings
  - Multi-language validator setup (Dart, Flutter, Python, Go, PHP, Bash)
- **Dependency Checker**: New `scripts/check-dependencies.sh` script
  - Validates all required dependencies are installed
  - Color-coded output for easy identification
  - Checks essential tools, build tools, and optional validators
  - Available via `npm run check:deps` command
- **Documentation**:
  - `docs/examples/ci-testing-setup.md` - Complete CI setup guide
  - `docs/examples/ci-improvements.md` - Detailed improvements documentation
  - Updated README.md with CI/CD section

### Fixed
- **Tree-sitter Tests**: Fixed indexer tests failing in CI environment
  - Root cause: Missing C/C++ build tools for native bindings
  - Solution: Install build-essential in GitHub Actions workflows
  - Affected tests: `indexer.test.ts`, `relationshipExtractor.test.ts`, `metricsCollector.test.ts`
- **Code Validators**: Fixed validator tests failing due to missing language tools
  - Root cause: Language tools not installed in Ubuntu CI environment
  - Solution: Install Dart, Flutter, Python, Go, PHP in CI workflows
  - Affected tests: Bash, Dart, Flutter validators in `docs.test.ts`

### Changed
- Updated `package.json` with `check:deps` script
- CI workflows now install complete testing stack before running tests

## [0.1.0] - Previous Version

Initial release with:
- Tree-sitter based code indexing
- Documentation registry system
- `docs-guard` CLI tool
- Mermaid diagram generation
- Knowledge graph and RAG support
- Multiple language support (TypeScript, JavaScript, Python, Go, PHP)
