import type { CodeSymbol } from "../../symbol/domain/entities/CodeSymbol.js";
import type { IFileIndexer } from "../../symbol/infrastructure/parsers/IFileIndexer.js";
import type { ChangeType } from "../domain/entities/ChangeImpact.js";

export interface SymbolChange {
  symbol: CodeSymbol;
  changeType: ChangeType;
  oldSymbol?: CodeSymbol;
  diff: string;
  severity: "low" | "medium" | "high" | "critical";
  breakingChange: boolean;
  reason: string;
}

/**
 * AstDiffAnalyzer
 *
 * Analyzes AST differences to detect semantic code changes.
 */
export class AstDiffAnalyzer {
  constructor(private readonly fileIndexer: IFileIndexer) {}

  /**
   * Analyze changes in a single file
   */
  async analyzeFileChanges(filePath: string, oldContent?: string): Promise<SymbolChange[]> {
    const changes: SymbolChange[] = [];

    try {
      // Parse current version
      const currentResult = await this.fileIndexer.indexFile(filePath);
      if (currentResult.skipped) {
        return [];
      }

      const currentSymbols = currentResult.symbols;

      // If no old content, all symbols are new
      if (!oldContent) {
        return currentSymbols.map((symbol) => ({
          symbol,
          changeType: "added" as const,
          diff: `+++ ${symbol.name}`,
          severity: "low" as const,
          breakingChange: false,
          reason: "New symbol added",
        }));
      }

      // Parse old version (temporarily write to temp file)
      const tempPath = `${filePath}.tmp`;
      try {
        const fs = await import("node:fs/promises");
        await fs.writeFile(tempPath, oldContent);

        const oldResult = await this.fileIndexer.indexFile(tempPath);
        const oldSymbols = oldResult.symbols;

        // Delete temp file
        await fs.unlink(tempPath);

        // Compare symbols
        const oldSymbolMap = new Map(oldSymbols.map((s) => [s.qualifiedName, s]));
        const currentSymbolMap = new Map(currentSymbols.map((s) => [s.qualifiedName, s]));

        // Detect added symbols
        for (const symbol of currentSymbols) {
          if (!oldSymbolMap.has(symbol.qualifiedName)) {
            changes.push({
              symbol,
              changeType: "added",
              diff: `+++ ${symbol.name}`,
              severity: "low",
              breakingChange: false,
              reason: "New symbol added",
            });
          }
        }

        // Detect removed and modified symbols
        for (const [qualifiedName, oldSymbol] of oldSymbolMap) {
          const currentSymbol = currentSymbolMap.get(qualifiedName);

          if (!currentSymbol) {
            // Symbol removed
            changes.push({
              symbol: oldSymbol,
              changeType: "removed",
              oldSymbol,
              diff: `--- ${oldSymbol.name}`,
              severity: "high",
              breakingChange: true,
              reason: "Symbol removed",
            });
          } else {
            // Symbol potentially modified
            const symbolChanges = this.detectSymbolChanges(oldSymbol, currentSymbol);
            if (symbolChanges) {
              changes.push(symbolChanges);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to analyze old version of ${filePath}:`, err);
      }

      return changes;
    } catch (error) {
      console.error(`Failed to analyze file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Detect changes between two versions of the same symbol
   */
  private detectSymbolChanges(oldSymbol: CodeSymbol, newSymbol: CodeSymbol): SymbolChange | null {
    const changes: string[] = [];
    let changeType: ChangeType = "modified";
    let severity: "low" | "medium" | "high" | "critical" = "low";
    let breakingChange = false;

    // Signature changed
    const oldSignature = oldSymbol.signature?.toValue();
    const newSignature = newSymbol.signature?.toValue();
    if (oldSignature !== newSignature) {
      changes.push("Signature changed");
      changeType = "signature_changed";
      severity = "high";
      breakingChange = true;
    }

    // Visibility changed
    if (oldSymbol.visibility !== newSymbol.visibility) {
      changes.push(`Visibility: ${oldSymbol.visibility} → ${newSymbol.visibility}`);
      changeType = "visibility_changed";
      severity = newSymbol.visibility === "private" ? "low" : "medium";
      breakingChange = oldSymbol.visibility === "public" && newSymbol.visibility !== "public";
    }

    // Exported status changed
    if (oldSymbol.exported !== newSymbol.exported) {
      changes.push(`Exported: ${oldSymbol.exported} → ${newSymbol.exported}`);
      severity = "high";
      breakingChange = !!(oldSymbol.exported && !newSymbol.exported);
    }

    // Extends/implements changed
    const oldExtends = oldSymbol.extends || "";
    const newExtends = newSymbol.extends || "";
    if (oldExtends !== newExtends) {
      changes.push(`Extends: ${oldExtends} → ${newExtends}`);
      severity = "medium";
    }

    const oldImplements = oldSymbol.implements || "";
    const newImplements = newSymbol.implements || "";
    if (oldImplements !== newImplements) {
      changes.push(`Implements: ${oldImplements} → ${newImplements}`);
      severity = "medium";
    }

    // Deprecated status changed
    if (oldSymbol.deprecated !== newSymbol.deprecated) {
      changes.push(`Deprecated: ${oldSymbol.deprecated} → ${newSymbol.deprecated}`);
      severity = newSymbol.deprecated ? "medium" : "low";
      breakingChange = !!newSymbol.deprecated;
    }

    // No significant changes
    if (changes.length === 0) {
      return null;
    }

    return {
      symbol: newSymbol,
      changeType,
      oldSymbol,
      diff: changes.join("; "),
      severity,
      breakingChange,
      reason: changes.join("; "),
    };
  }

  /**
   * Get old file content from git
   */
  async getOldFileContent(filePath: string, ref: string): Promise<string | undefined> {
    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`git show ${ref}:${filePath}`);
      return stdout;
    } catch (error) {
      // File might not exist in old ref
      return undefined;
    }
  }
}
