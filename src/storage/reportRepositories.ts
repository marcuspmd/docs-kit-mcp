import { createHash, randomUUID } from "node:crypto";
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

// ---------------------------------------------------------------------------
// Reaper findings — new schema with status management and audit history
// ---------------------------------------------------------------------------

export type FindingStatus = "active" | "false_positive" | "ignored" | "resolved";

export interface ReaperFindingInput {
  type: string;
  target: string;
  reason: string;
  suggestedAction: string;
}

export interface ReaperFindingRow {
  id: string;
  type: string;
  target: string;
  reason: string;
  suggested_action: string;
  status: FindingStatus;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ReaperHistoryRow {
  id: string;
  finding_id: string;
  changed_at: string;
  field: string;
  old_value: string | null;
  new_value: string;
  source: "scan" | "user";
}

function makeFindingId(type: string, target: string): string {
  return createHash("sha256").update(`${type}:${target}`).digest("hex").slice(0, 32);
}

function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Smart upsert: preserves manually-set statuses (false_positive, ignored) across scans.
 * - New finding → INSERT as 'active', log history row
 * - Existing 'resolved' finding reappears → reactivate to 'active', log history
 * - Existing 'active' finding vanishes → mark 'resolved', log history
 * - false_positive / ignored → never auto-change status; only update last_seen_at
 */
export function upsertReaperFindings(db: Database.Database, findings: ReaperFindingInput[]): void {
  const now = nowIso();
  const newIds = new Set(findings.map((f) => makeFindingId(f.type, f.target)));

  const existing = db.prepare("SELECT id, status FROM reaper_findings").all() as Array<{
    id: string;
    status: FindingStatus;
  }>;
  const existingById = new Map(existing.map((r) => [r.id, r]));

  const insertFinding = db.prepare(
    `INSERT INTO reaper_findings (id, type, target, reason, suggested_action, status, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
  );
  const updateLastSeen = db.prepare(
    `UPDATE reaper_findings SET last_seen_at = ?, reason = ?, suggested_action = ? WHERE id = ?`,
  );
  const reactivate = db.prepare(
    `UPDATE reaper_findings SET status = 'active', last_seen_at = ? WHERE id = ?`,
  );
  const markResolved = db.prepare(
    `UPDATE reaper_findings SET status = 'resolved', last_seen_at = ? WHERE id = ?`,
  );
  const insertHistory = db.prepare(
    `INSERT INTO reaper_finding_history (id, finding_id, changed_at, field, old_value, new_value, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    for (const f of findings) {
      const id = makeFindingId(f.type, f.target);
      const ex = existingById.get(id);

      if (!ex) {
        insertFinding.run(id, f.type, f.target, f.reason, f.suggestedAction, now, now);
        insertHistory.run(randomUUID(), id, now, "detected", null, "active", "scan");
      } else if (ex.status === "resolved") {
        updateLastSeen.run(now, f.reason, f.suggestedAction, id);
        reactivate.run(now, id);
        insertHistory.run(randomUUID(), id, now, "status", "resolved", "active", "scan");
      } else {
        // active, false_positive, ignored — just refresh metadata
        updateLastSeen.run(now, f.reason, f.suggestedAction, id);
      }
    }

    // Auto-resolve active findings that disappeared from the scan
    for (const ex of existing) {
      if (ex.status === "active" && !newIds.has(ex.id)) {
        markResolved.run(now, ex.id);
        insertHistory.run(randomUUID(), ex.id, now, "status", "active", "resolved", "scan");
      }
    }
  })();
}

/**
 * Query findings with optional status filter.
 * Default (no filter) excludes 'resolved'.
 */
export function getAllFindings(
  db: Database.Database,
  filter?: { status?: FindingStatus | "all" },
): ReaperFindingRow[] {
  const status = filter?.status;
  if (status === "all") {
    return db
      .prepare("SELECT * FROM reaper_findings ORDER BY first_seen_at DESC")
      .all() as ReaperFindingRow[];
  }
  if (status) {
    return db
      .prepare("SELECT * FROM reaper_findings WHERE status = ? ORDER BY first_seen_at DESC")
      .all(status) as ReaperFindingRow[];
  }
  // Default: exclude resolved
  return db
    .prepare("SELECT * FROM reaper_findings WHERE status != 'resolved' ORDER BY first_seen_at DESC")
    .all() as ReaperFindingRow[];
}

/**
 * Manually update the status (and optionally notes) of a finding.
 * Writes delta rows to reaper_finding_history.
 * Returns false if the finding id does not exist.
 */
export function updateFindingStatus(
  db: Database.Database,
  id: string,
  newStatus: FindingStatus,
  notes?: string,
): boolean {
  const now = nowIso();
  const finding = db.prepare("SELECT status, notes FROM reaper_findings WHERE id = ?").get(id) as
    | { status: FindingStatus; notes: string | null }
    | undefined;

  if (!finding) return false;

  const insertHistory = db.prepare(
    `INSERT INTO reaper_finding_history (id, finding_id, changed_at, field, old_value, new_value, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    if (newStatus !== finding.status) {
      db.prepare("UPDATE reaper_findings SET status = ? WHERE id = ?").run(newStatus, id);
      insertHistory.run(randomUUID(), id, now, "status", finding.status, newStatus, "user");
    }
    if (notes !== undefined && notes !== finding.notes) {
      db.prepare("UPDATE reaper_findings SET notes = ? WHERE id = ?").run(notes, id);
      insertHistory.run(randomUUID(), id, now, "notes", finding.notes ?? "", notes, "user");
    }
  })();

  return true;
}

/**
 * Return audit history for a specific finding or all findings.
 */
export function getFindingHistory(db: Database.Database, findingId?: string): ReaperHistoryRow[] {
  if (findingId) {
    return db
      .prepare("SELECT * FROM reaper_finding_history WHERE finding_id = ? ORDER BY changed_at ASC")
      .all(findingId) as ReaperHistoryRow[];
  }
  return db
    .prepare(
      `SELECT h.*, f.type, f.target
       FROM reaper_finding_history h
       JOIN reaper_findings f ON f.id = h.finding_id
       ORDER BY h.changed_at DESC`,
    )
    .all() as ReaperHistoryRow[];
}
