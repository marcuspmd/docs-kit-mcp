export type PrProvider = "local" | "github" | "bitbucket";
export type PrState = "open" | "closed" | "merged" | "draft";
export type PrReviewRunStatus =
  | "draft"
  | "generated"
  | "pending"
  | "submitted"
  | "synced"
  | "failed";
export type PrFileReviewStatus = "unviewed" | "viewed";
export type PrDiffSide = "left" | "right";
export type PrReviewThreadStatus = "open" | "resolved" | "outdated";
export type PrReviewCommentState = "draft" | "published" | "resolved" | "outdated" | "deleted";
export type PrReviewVerdict = "comment" | "approve" | "request_changes";
export type PrReviewSubmissionState = "draft" | "submitted" | "synced" | "failed";
export type PrSuggestionState = "pending" | "applied" | "rejected" | "published";
export type PrReviewerRole = "author" | "reviewer" | "assignee";
export type PrReviewerStatus = "pending" | "approved" | "changes_requested" | "commented";

export interface PrReviewPullRequest {
  id: string;
  provider: PrProvider;
  repository: string;
  number: string;
  title?: string;
  url?: string;
  author?: string;
  state: PrState;
  baseRef: string;
  headRef: string;
  baseSha?: string;
  headSha?: string;
  createdAt?: string;
  updatedAt?: string;
  syncedAt?: string;
}

export interface PrReviewRun {
  id: string;
  prId: string;
  status: PrReviewRunStatus;
  baseSha?: string;
  headSha?: string;
  generatedAt: string;
  providerReviewId?: string;
  summary?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PrReviewFileState {
  prId: string;
  file: string;
  status: PrFileReviewStatus;
  viewer?: string;
  viewedAt?: string;
}

export interface PrLineAnchor {
  file: string;
  side: PrDiffSide;
  line?: number;
  originalLine?: number;
  startLine?: number;
  endLine?: number;
  diffHunk?: string;
  symbolId?: string;
  findingId?: string;
  dedupeKey?: string;
}

export interface PrReviewThread {
  id: string;
  prId: string;
  runId?: string;
  providerThreadId?: string;
  status: PrReviewThreadStatus;
  anchor: PrLineAnchor;
  title?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface PrReviewComment {
  id: string;
  threadId: string;
  prId: string;
  providerCommentId?: string;
  author: string;
  body: string;
  state: PrReviewCommentState;
  isDraft?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PrReviewSubmission {
  id: string;
  prId: string;
  runId?: string;
  providerReviewId?: string;
  author: string;
  verdict: PrReviewVerdict;
  body?: string;
  state: PrReviewSubmissionState;
  createdAt: string;
  submittedAt?: string;
  updatedAt?: string;
  error?: string;
}

export interface PrReviewer {
  prId: string;
  username: string;
  role: PrReviewerRole;
  status: PrReviewerStatus;
  reviewedAt?: string;
}

export interface PrReviewSuggestion {
  id: string;
  threadId: string;
  commentId?: string;
  body: string;
  state: PrSuggestionState;
  createdAt: string;
  appliedAt?: string;
}

export interface PrReviewHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  prId: string;
  changedAt: string;
  field: string;
  oldValue?: string;
  newValue: string;
  source: string;
}
