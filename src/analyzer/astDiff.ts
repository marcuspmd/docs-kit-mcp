import type { CodeSymbol } from "../indexer/symbol.types.js";

export type AstChangeType = "added" | "removed" | "signature_changed" | "body_changed" | "moved";

export interface AstChange {
  symbol: CodeSymbol;
  changeType: AstChangeType;
  details: string;
  oldSymbol?: CodeSymbol;
}

function makeKey(s: CodeSymbol): string {
  return `${s.name}:${s.kind}`;
}

function classifyChange(oldSym: CodeSymbol, newSym: CodeSymbol): AstChangeType | null {
  // Check signature change first (if signature field exists)
  if (
    oldSym.signature !== undefined &&
    newSym.signature !== undefined &&
    oldSym.signature !== newSym.signature
  ) {
    return "signature_changed";
  }

  const oldSize = oldSym.endLine - oldSym.startLine;
  const newSize = newSym.endLine - newSym.startLine;

  if (oldSize !== newSize) {
    return "body_changed";
  }

  if (oldSym.startLine !== newSym.startLine || oldSym.endLine !== newSym.endLine) {
    return "moved";
  }

  return null;
}

function getChangeDetails(newSym: CodeSymbol, oldSym: CodeSymbol, change: AstChangeType): string {
  switch (change) {
    case "signature_changed":
      return `signature changed for ${newSym.kind} "${newSym.name}"`;
    case "body_changed": {
      const oldSize = oldSym.endLine - oldSym.startLine + 1;
      const newSize = newSym.endLine - newSym.startLine + 1;
      return `body size changed (${oldSize} → ${newSize} lines)`;
    }
    case "moved":
      return `moved from line ${oldSym.startLine} to ${newSym.startLine}`;
    /* istanbul ignore next */
    default:
      return `${change}`;
  }
}

export function diffSymbols(oldSymbols: CodeSymbol[], newSymbols: CodeSymbol[]): AstChange[] {
  const oldMap = new Map(oldSymbols.map((s) => [makeKey(s), s]));
  const newMap = new Map(newSymbols.map((s) => [makeKey(s), s]));

  const changes: AstChange[] = [];

  // Added symbols
  for (const [key, sym] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        symbol: sym,
        changeType: "added",
        details: `added ${sym.kind} "${sym.name}"`,
      });
    }
  }

  // Removed symbols
  for (const [key, sym] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        symbol: sym,
        changeType: "removed",
        details: `removed ${sym.kind} "${sym.name}"`,
      });
    }
  }

  // Modified / moved symbols
  for (const [key, newSym] of newMap) {
    const oldSym = oldMap.get(key);
    if (!oldSym) continue;

    const change = classifyChange(oldSym, newSym);
    if (!change) continue;

    changes.push({
      symbol: newSym,
      changeType: change,
      details: getChangeDetails(newSym, oldSym, change),
      oldSymbol: oldSym,
    });
  }

  return changes;
}
