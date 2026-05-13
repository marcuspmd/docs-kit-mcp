import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  PrProvider,
  PrReviewer,
  PrReviewComment,
  PrReviewFileState,
  PrReviewHistoryEntry,
  PrReviewPullRequest,
  PrReviewRun,
  PrReviewSubmission,
  PrReviewSuggestion,
  PrReviewThread,
  PrReviewThreadStatus,
} from "../governance/prReview.types.js";

export interface PrReviewRepository {
  upsertPullRequest(pullRequest: PrReviewPullRequest): void;
  findPullRequest(id: string): PrReviewPullRequest | undefined;
  findPullRequestByProvider(
    provider: PrProvider,
    repository: string,
    number: string,
  ): PrReviewPullRequest | undefined;
  upsertReviewRun(run: PrReviewRun): void;
  findReviewRun(id: string): PrReviewRun | undefined;
  listReviewRuns(prId: string): PrReviewRun[];
  upsertFileState(fileState: PrReviewFileState): void;
  markFileViewed(prId: string, file: string, viewer?: string, viewedAt?: string): void;
  listFileStates(prId: string): PrReviewFileState[];
  upsertThread(thread: PrReviewThread): void;
  findThread(id: string): PrReviewThread | undefined;
  listThreads(prId: string, filter?: { status?: PrReviewThreadStatus }): PrReviewThread[];
  updateThreadStatus(
    id: string,
    status: PrReviewThreadStatus,
    actor?: string,
    source?: string,
  ): boolean;
  upsertComment(comment: PrReviewComment): void;
  listComments(threadId: string): PrReviewComment[];
  upsertSubmission(submission: PrReviewSubmission): void;
  listSubmissions(prId: string): PrReviewSubmission[];
  upsertReviewer(reviewer: PrReviewer): void;
  listReviewers(prId: string): PrReviewer[];
  upsertSuggestion(suggestion: PrReviewSuggestion): void;
  listSuggestions(threadId: string): PrReviewSuggestion[];
  listHistory(prId: string): PrReviewHistoryEntry[];
}

interface PullRequestRow {
  id: string;
  provider: PrReviewPullRequest["provider"];
  repository: string;
  number: string;
  title: string | null;
  url: string | null;
  author: string | null;
  state: PrReviewPullRequest["state"];
  base_ref: string;
  head_ref: string;
  base_sha: string | null;
  head_sha: string | null;
  created_at: string | null;
  updated_at: string | null;
  synced_at: string | null;
}

interface ReviewRunRow {
  id: string;
  pr_id: string;
  status: PrReviewRun["status"];
  base_sha: string | null;
  head_sha: string | null;
  generated_at: string;
  provider_review_id: string | null;
  summary: string | null;
  error: string | null;
  metadata: string | null;
}

interface FileStateRow {
  pr_id: string;
  file_path: string;
  status: PrReviewFileState["status"];
  viewer: string | null;
  viewed_at: string | null;
}

interface ThreadRow {
  id: string;
  pr_id: string;
  run_id: string | null;
  provider_thread_id: string | null;
  status: PrReviewThread["status"];
  file_path: string;
  side: PrReviewThread["anchor"]["side"];
  line: number | null;
  original_line: number | null;
  start_line: number | null;
  end_line: number | null;
  diff_hunk: string | null;
  symbol_id: string | null;
  finding_id: string | null;
  dedupe_key: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface CommentRow {
  id: string;
  thread_id: string;
  pr_id: string;
  provider_comment_id: string | null;
  author: string;
  body: string;
  state: PrReviewComment["state"];
  is_draft: number;
  created_at: string;
  updated_at: string | null;
}

interface SubmissionRow {
  id: string;
  pr_id: string;
  run_id: string | null;
  provider_review_id: string | null;
  author: string;
  verdict: PrReviewSubmission["verdict"];
  body: string | null;
  state: PrReviewSubmission["state"];
  created_at: string;
  submitted_at: string | null;
  updated_at: string | null;
  error: string | null;
}

interface ReviewerRow {
  pr_id: string;
  username: string;
  role: PrReviewer["role"];
  status: PrReviewer["status"];
  reviewed_at: string | null;
}

interface SuggestionRow {
  id: string;
  thread_id: string;
  comment_id: string | null;
  body: string;
  state: PrReviewSuggestion["state"];
  created_at: string;
  applied_at: string | null;
}

interface HistoryRow {
  id: string;
  entity_type: string;
  entity_id: string;
  pr_id: string;
  changed_at: string;
  field: string;
  old_value: string | null;
  new_value: string;
  source: string;
}

function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function toBit(value: boolean | undefined): number {
  return value ? 1 : 0;
}

function toJson(value: Record<string, unknown> | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

function parseJsonObject(value: string | null): Record<string, unknown> | undefined {
  return value ? (JSON.parse(value) as Record<string, unknown>) : undefined;
}

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}

function optionalNumber(value: number | null): number | undefined {
  return value ?? undefined;
}

function rowToPullRequest(row: PullRequestRow): PrReviewPullRequest {
  return {
    id: row.id,
    provider: row.provider,
    repository: row.repository,
    number: row.number,
    title: optional(row.title),
    url: optional(row.url),
    author: optional(row.author),
    state: row.state,
    baseRef: row.base_ref,
    headRef: row.head_ref,
    baseSha: optional(row.base_sha),
    headSha: optional(row.head_sha),
    createdAt: optional(row.created_at),
    updatedAt: optional(row.updated_at),
    syncedAt: optional(row.synced_at),
  };
}

function rowToReviewRun(row: ReviewRunRow): PrReviewRun {
  return {
    id: row.id,
    prId: row.pr_id,
    status: row.status,
    baseSha: optional(row.base_sha),
    headSha: optional(row.head_sha),
    generatedAt: row.generated_at,
    providerReviewId: optional(row.provider_review_id),
    summary: optional(row.summary),
    error: optional(row.error),
    metadata: parseJsonObject(row.metadata),
  };
}

function rowToFileState(row: FileStateRow): PrReviewFileState {
  return {
    prId: row.pr_id,
    file: row.file_path,
    status: row.status,
    viewer: optional(row.viewer),
    viewedAt: optional(row.viewed_at),
  };
}

function rowToThread(row: ThreadRow): PrReviewThread {
  return {
    id: row.id,
    prId: row.pr_id,
    runId: optional(row.run_id),
    providerThreadId: optional(row.provider_thread_id),
    status: row.status,
    anchor: {
      file: row.file_path,
      side: row.side,
      line: optionalNumber(row.line),
      originalLine: optionalNumber(row.original_line),
      startLine: optionalNumber(row.start_line),
      endLine: optionalNumber(row.end_line),
      diffHunk: optional(row.diff_hunk),
      symbolId: optional(row.symbol_id),
      findingId: optional(row.finding_id),
      dedupeKey: optional(row.dedupe_key),
    },
    title: optional(row.title),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: optional(row.resolved_at),
    resolvedBy: optional(row.resolved_by),
  };
}

function rowToComment(row: CommentRow): PrReviewComment {
  return {
    id: row.id,
    threadId: row.thread_id,
    prId: row.pr_id,
    providerCommentId: optional(row.provider_comment_id),
    author: row.author,
    body: row.body,
    state: row.state,
    isDraft: row.is_draft === 1,
    createdAt: row.created_at,
    updatedAt: optional(row.updated_at),
  };
}

function rowToSubmission(row: SubmissionRow): PrReviewSubmission {
  return {
    id: row.id,
    prId: row.pr_id,
    runId: optional(row.run_id),
    providerReviewId: optional(row.provider_review_id),
    author: row.author,
    verdict: row.verdict,
    body: optional(row.body),
    state: row.state,
    createdAt: row.created_at,
    submittedAt: optional(row.submitted_at),
    updatedAt: optional(row.updated_at),
    error: optional(row.error),
  };
}

function rowToReviewer(row: ReviewerRow): PrReviewer {
  return {
    prId: row.pr_id,
    username: row.username,
    role: row.role,
    status: row.status,
    reviewedAt: optional(row.reviewed_at),
  };
}

function rowToSuggestion(row: SuggestionRow): PrReviewSuggestion {
  return {
    id: row.id,
    threadId: row.thread_id,
    commentId: optional(row.comment_id),
    body: row.body,
    state: row.state,
    createdAt: row.created_at,
    appliedAt: optional(row.applied_at),
  };
}

function rowToHistory(row: HistoryRow): PrReviewHistoryEntry {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    prId: row.pr_id,
    changedAt: row.changed_at,
    field: row.field,
    oldValue: optional(row.old_value),
    newValue: row.new_value,
    source: row.source,
  };
}

export function createPrReviewRepository(db: Database.Database): PrReviewRepository {
  const upsertPullRequestStmt = db.prepare(`
    INSERT INTO pr_pull_requests (
      id, provider, repository, number, title, url, author, state,
      base_ref, head_ref, base_sha, head_sha, created_at, updated_at, synced_at
    ) VALUES (
      @id, @provider, @repository, @number, @title, @url, @author, @state,
      @base_ref, @head_ref, @base_sha, @head_sha, @created_at, @updated_at, @synced_at
    )
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      repository = excluded.repository,
      number = excluded.number,
      title = excluded.title,
      url = excluded.url,
      author = excluded.author,
      state = excluded.state,
      base_ref = excluded.base_ref,
      head_ref = excluded.head_ref,
      base_sha = excluded.base_sha,
      head_sha = excluded.head_sha,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      synced_at = excluded.synced_at
  `);
  const findPullRequestStmt = db.prepare("SELECT * FROM pr_pull_requests WHERE id = ?");
  const findPullRequestByProviderStmt = db.prepare(
    "SELECT * FROM pr_pull_requests WHERE provider = ? AND repository = ? AND number = ?",
  );

  const upsertReviewRunStmt = db.prepare(`
    INSERT INTO pr_review_runs (
      id, pr_id, status, base_sha, head_sha, generated_at, provider_review_id, summary, error, metadata
    ) VALUES (
      @id, @pr_id, @status, @base_sha, @head_sha, @generated_at, @provider_review_id, @summary, @error, @metadata
    )
    ON CONFLICT(id) DO UPDATE SET
      pr_id = excluded.pr_id,
      status = excluded.status,
      base_sha = excluded.base_sha,
      head_sha = excluded.head_sha,
      generated_at = excluded.generated_at,
      provider_review_id = excluded.provider_review_id,
      summary = excluded.summary,
      error = excluded.error,
      metadata = excluded.metadata
  `);
  const findReviewRunStmt = db.prepare("SELECT * FROM pr_review_runs WHERE id = ?");
  const listReviewRunsStmt = db.prepare(
    "SELECT * FROM pr_review_runs WHERE pr_id = ? ORDER BY generated_at DESC",
  );

  const upsertFileStateStmt = db.prepare(`
    INSERT INTO pr_review_files (pr_id, file_path, status, viewer, viewed_at)
    VALUES (@pr_id, @file_path, @status, @viewer, @viewed_at)
    ON CONFLICT(pr_id, file_path) DO UPDATE SET
      status = excluded.status,
      viewer = excluded.viewer,
      viewed_at = excluded.viewed_at
  `);
  const listFileStatesStmt = db.prepare(
    "SELECT * FROM pr_review_files WHERE pr_id = ? ORDER BY file_path ASC",
  );

  const upsertThreadStmt = db.prepare(`
    INSERT INTO pr_review_threads (
      id, pr_id, run_id, provider_thread_id, status, file_path, side, line, original_line,
      start_line, end_line, diff_hunk, symbol_id, finding_id, dedupe_key, title,
      created_at, updated_at, resolved_at, resolved_by
    ) VALUES (
      @id, @pr_id, @run_id, @provider_thread_id, @status, @file_path, @side, @line, @original_line,
      @start_line, @end_line, @diff_hunk, @symbol_id, @finding_id, @dedupe_key, @title,
      @created_at, @updated_at, @resolved_at, @resolved_by
    )
    ON CONFLICT(id) DO UPDATE SET
      pr_id = excluded.pr_id,
      run_id = excluded.run_id,
      provider_thread_id = excluded.provider_thread_id,
      status = excluded.status,
      file_path = excluded.file_path,
      side = excluded.side,
      line = excluded.line,
      original_line = excluded.original_line,
      start_line = excluded.start_line,
      end_line = excluded.end_line,
      diff_hunk = excluded.diff_hunk,
      symbol_id = excluded.symbol_id,
      finding_id = excluded.finding_id,
      dedupe_key = excluded.dedupe_key,
      title = excluded.title,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      resolved_at = excluded.resolved_at,
      resolved_by = excluded.resolved_by
  `);
  const findThreadStmt = db.prepare("SELECT * FROM pr_review_threads WHERE id = ?");

  const upsertCommentStmt = db.prepare(`
    INSERT INTO pr_review_comments (
      id, thread_id, pr_id, provider_comment_id, author, body, state, is_draft, created_at, updated_at
    ) VALUES (
      @id, @thread_id, @pr_id, @provider_comment_id, @author, @body, @state, @is_draft, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      thread_id = excluded.thread_id,
      pr_id = excluded.pr_id,
      provider_comment_id = excluded.provider_comment_id,
      author = excluded.author,
      body = excluded.body,
      state = excluded.state,
      is_draft = excluded.is_draft,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `);
  const listCommentsStmt = db.prepare(
    "SELECT * FROM pr_review_comments WHERE thread_id = ? ORDER BY created_at ASC",
  );

  const upsertSubmissionStmt = db.prepare(`
    INSERT INTO pr_review_submissions (
      id, pr_id, run_id, provider_review_id, author, verdict, body, state,
      created_at, submitted_at, updated_at, error
    ) VALUES (
      @id, @pr_id, @run_id, @provider_review_id, @author, @verdict, @body, @state,
      @created_at, @submitted_at, @updated_at, @error
    )
    ON CONFLICT(id) DO UPDATE SET
      pr_id = excluded.pr_id,
      run_id = excluded.run_id,
      provider_review_id = excluded.provider_review_id,
      author = excluded.author,
      verdict = excluded.verdict,
      body = excluded.body,
      state = excluded.state,
      created_at = excluded.created_at,
      submitted_at = excluded.submitted_at,
      updated_at = excluded.updated_at,
      error = excluded.error
  `);
  const listSubmissionsStmt = db.prepare(
    "SELECT * FROM pr_review_submissions WHERE pr_id = ? ORDER BY created_at DESC",
  );

  const upsertReviewerStmt = db.prepare(`
    INSERT INTO pr_reviewers (pr_id, username, role, status, reviewed_at)
    VALUES (@pr_id, @username, @role, @status, @reviewed_at)
    ON CONFLICT(pr_id, username) DO UPDATE SET
      role = excluded.role,
      status = excluded.status,
      reviewed_at = excluded.reviewed_at
  `);
  const listReviewersStmt = db.prepare(
    "SELECT * FROM pr_reviewers WHERE pr_id = ? ORDER BY username ASC",
  );

  const upsertSuggestionStmt = db.prepare(`
    INSERT INTO pr_review_suggestions (id, thread_id, comment_id, body, state, created_at, applied_at)
    VALUES (@id, @thread_id, @comment_id, @body, @state, @created_at, @applied_at)
    ON CONFLICT(id) DO UPDATE SET
      thread_id = excluded.thread_id,
      comment_id = excluded.comment_id,
      body = excluded.body,
      state = excluded.state,
      created_at = excluded.created_at,
      applied_at = excluded.applied_at
  `);
  const listSuggestionsStmt = db.prepare(
    "SELECT * FROM pr_review_suggestions WHERE thread_id = ? ORDER BY created_at ASC",
  );

  const insertHistoryStmt = db.prepare(`
    INSERT INTO pr_review_history (id, entity_type, entity_id, pr_id, changed_at, field, old_value, new_value, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const listHistoryStmt = db.prepare(
    "SELECT * FROM pr_review_history WHERE pr_id = ? ORDER BY changed_at ASC",
  );

  function insertHistory(
    entityType: string,
    entityId: string,
    prId: string,
    field: string,
    oldValue: string | null,
    newValue: string,
    source: string,
  ): void {
    insertHistoryStmt.run(
      randomUUID(),
      entityType,
      entityId,
      prId,
      nowIso(),
      field,
      oldValue,
      newValue,
      source,
    );
  }

  return {
    upsertPullRequest(pullRequest): void {
      upsertPullRequestStmt.run({
        id: pullRequest.id,
        provider: pullRequest.provider,
        repository: pullRequest.repository,
        number: pullRequest.number,
        title: pullRequest.title ?? null,
        url: pullRequest.url ?? null,
        author: pullRequest.author ?? null,
        state: pullRequest.state,
        base_ref: pullRequest.baseRef,
        head_ref: pullRequest.headRef,
        base_sha: pullRequest.baseSha ?? null,
        head_sha: pullRequest.headSha ?? null,
        created_at: pullRequest.createdAt ?? null,
        updated_at: pullRequest.updatedAt ?? null,
        synced_at: pullRequest.syncedAt ?? null,
      });
    },

    findPullRequest(id): PrReviewPullRequest | undefined {
      const row = findPullRequestStmt.get(id) as PullRequestRow | undefined;
      return row ? rowToPullRequest(row) : undefined;
    },

    findPullRequestByProvider(provider, repository, number): PrReviewPullRequest | undefined {
      const row = findPullRequestByProviderStmt.get(provider, repository, number) as
        | PullRequestRow
        | undefined;
      return row ? rowToPullRequest(row) : undefined;
    },

    upsertReviewRun(run): void {
      upsertReviewRunStmt.run({
        id: run.id,
        pr_id: run.prId,
        status: run.status,
        base_sha: run.baseSha ?? null,
        head_sha: run.headSha ?? null,
        generated_at: run.generatedAt,
        provider_review_id: run.providerReviewId ?? null,
        summary: run.summary ?? null,
        error: run.error ?? null,
        metadata: toJson(run.metadata),
      });
    },

    findReviewRun(id): PrReviewRun | undefined {
      const row = findReviewRunStmt.get(id) as ReviewRunRow | undefined;
      return row ? rowToReviewRun(row) : undefined;
    },

    listReviewRuns(prId): PrReviewRun[] {
      const rows = listReviewRunsStmt.all(prId) as ReviewRunRow[];
      return rows.map(rowToReviewRun);
    },

    upsertFileState(fileState): void {
      upsertFileStateStmt.run({
        pr_id: fileState.prId,
        file_path: fileState.file,
        status: fileState.status,
        viewer: fileState.viewer ?? null,
        viewed_at: fileState.viewedAt ?? null,
      });
    },

    markFileViewed(prId, file, viewer, viewedAt): void {
      this.upsertFileState({
        prId,
        file,
        status: "viewed",
        viewer,
        viewedAt: viewedAt ?? nowIso(),
      });
    },

    listFileStates(prId): PrReviewFileState[] {
      const rows = listFileStatesStmt.all(prId) as FileStateRow[];
      return rows.map(rowToFileState);
    },

    upsertThread(thread): void {
      upsertThreadStmt.run({
        id: thread.id,
        pr_id: thread.prId,
        run_id: thread.runId ?? null,
        provider_thread_id: thread.providerThreadId ?? null,
        status: thread.status,
        file_path: thread.anchor.file,
        side: thread.anchor.side,
        line: thread.anchor.line ?? null,
        original_line: thread.anchor.originalLine ?? null,
        start_line: thread.anchor.startLine ?? null,
        end_line: thread.anchor.endLine ?? null,
        diff_hunk: thread.anchor.diffHunk ?? null,
        symbol_id: thread.anchor.symbolId ?? null,
        finding_id: thread.anchor.findingId ?? null,
        dedupe_key: thread.anchor.dedupeKey ?? null,
        title: thread.title ?? null,
        created_at: thread.createdAt,
        updated_at: thread.updatedAt,
        resolved_at: thread.resolvedAt ?? null,
        resolved_by: thread.resolvedBy ?? null,
      });
    },

    findThread(id): PrReviewThread | undefined {
      const row = findThreadStmt.get(id) as ThreadRow | undefined;
      return row ? rowToThread(row) : undefined;
    },

    listThreads(prId, filter): PrReviewThread[] {
      const rows = filter?.status
        ? (db
            .prepare(
              `SELECT * FROM pr_review_threads
               WHERE pr_id = ? AND status = ?
               ORDER BY file_path ASC, COALESCE(line, original_line, start_line, 0) ASC, created_at ASC`,
            )
            .all(prId, filter.status) as ThreadRow[])
        : (db
            .prepare(
              `SELECT * FROM pr_review_threads
               WHERE pr_id = ?
               ORDER BY file_path ASC, COALESCE(line, original_line, start_line, 0) ASC, created_at ASC`,
            )
            .all(prId) as ThreadRow[]);
      return rows.map(rowToThread);
    },

    updateThreadStatus(id, status, actor, source = "user"): boolean {
      const row = findThreadStmt.get(id) as ThreadRow | undefined;
      if (!row) return false;
      if (row.status === status) return true;

      const now = nowIso();
      db.transaction(() => {
        db.prepare(
          `UPDATE pr_review_threads
           SET status = ?, updated_at = ?, resolved_at = ?, resolved_by = ?
           WHERE id = ?`,
        ).run(
          status,
          now,
          status === "resolved" ? now : null,
          status === "resolved" ? actor : null,
          id,
        );
        insertHistory("thread", id, row.pr_id, "status", row.status, status, source);
      })();

      return true;
    },

    upsertComment(comment): void {
      upsertCommentStmt.run({
        id: comment.id,
        thread_id: comment.threadId,
        pr_id: comment.prId,
        provider_comment_id: comment.providerCommentId ?? null,
        author: comment.author,
        body: comment.body,
        state: comment.state,
        is_draft: toBit(comment.isDraft),
        created_at: comment.createdAt,
        updated_at: comment.updatedAt ?? null,
      });
    },

    listComments(threadId): PrReviewComment[] {
      const rows = listCommentsStmt.all(threadId) as CommentRow[];
      return rows.map(rowToComment);
    },

    upsertSubmission(submission): void {
      upsertSubmissionStmt.run({
        id: submission.id,
        pr_id: submission.prId,
        run_id: submission.runId ?? null,
        provider_review_id: submission.providerReviewId ?? null,
        author: submission.author,
        verdict: submission.verdict,
        body: submission.body ?? null,
        state: submission.state,
        created_at: submission.createdAt,
        submitted_at: submission.submittedAt ?? null,
        updated_at: submission.updatedAt ?? null,
        error: submission.error ?? null,
      });
    },

    listSubmissions(prId): PrReviewSubmission[] {
      const rows = listSubmissionsStmt.all(prId) as SubmissionRow[];
      return rows.map(rowToSubmission);
    },

    upsertReviewer(reviewer): void {
      upsertReviewerStmt.run({
        pr_id: reviewer.prId,
        username: reviewer.username,
        role: reviewer.role,
        status: reviewer.status,
        reviewed_at: reviewer.reviewedAt ?? null,
      });
    },

    listReviewers(prId): PrReviewer[] {
      const rows = listReviewersStmt.all(prId) as ReviewerRow[];
      return rows.map(rowToReviewer);
    },

    upsertSuggestion(suggestion): void {
      upsertSuggestionStmt.run({
        id: suggestion.id,
        thread_id: suggestion.threadId,
        comment_id: suggestion.commentId ?? null,
        body: suggestion.body,
        state: suggestion.state,
        created_at: suggestion.createdAt,
        applied_at: suggestion.appliedAt ?? null,
      });
    },

    listSuggestions(threadId): PrReviewSuggestion[] {
      const rows = listSuggestionsStmt.all(threadId) as SuggestionRow[];
      return rows.map(rowToSuggestion);
    },

    listHistory(prId): PrReviewHistoryEntry[] {
      const rows = listHistoryStmt.all(prId) as HistoryRow[];
      return rows.map(rowToHistory);
    },
  };
}
