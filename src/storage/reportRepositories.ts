import type Database from "better-sqlite3";

export interface PatternRowForInsert {
  kind: string;
  symbols: string[];
  confidence: number;
  violations: string[];
}

export function replaceAllPatterns(db: Database.Database, patterns: PatternRowForInsert[]): void {
  db.prepare("DELETE FROM patterns").run();
  const insertStmt = db.prepare(
    "INSERT INTO patterns (kind, symbols, confidence, violations) VALUES (?, ?, ?, ?)",
  );
  for (const pattern of patterns) {
    insertStmt.run(
      pattern.kind,
      JSON.stringify(pattern.symbols),
      pattern.confidence,
      pattern.violations.length > 0 ? JSON.stringify(pattern.violations) : null,
    );
  }
}

export interface ArchViolationRow {
  rule: string;
  file: string;
  symbol_id: string | null;
  message: string;
  severity: string;
}

export function replaceAllArchViolations(
  db: Database.Database,
  violations: ArchViolationRow[],
): void {
  db.prepare("DELETE FROM arch_violations").run();
  const insertStmt = db.prepare(
    "INSERT INTO arch_violations (rule, file, symbol_id, message, severity) VALUES (?, ?, ?, ?, ?)",
  );
  for (const violation of violations) {
    insertStmt.run(
      violation.rule,
      violation.file,
      violation.symbol_id ?? null,
      violation.message,
      violation.severity,
    );
  }
}

export interface ReaperFindingRow {
  type: string;
  target: string;
  reason: string;
  suggested_action: string;
}

export function replaceAllReaperFindings(
  db: Database.Database,
  findings: ReaperFindingRow[],
): void {
  db.prepare("DELETE FROM reaper_findings").run();
  const insertStmt = db.prepare(
    "INSERT INTO reaper_findings (type, target, reason, suggested_action) VALUES (?, ?, ?, ?)",
  );
  for (const finding of findings) {
    insertStmt.run(finding.type, finding.target, finding.reason, finding.suggested_action);
  }
}
