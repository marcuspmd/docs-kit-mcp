import pc from "picocolors";

export const colors = {
  ok: pc.green,
  warn: pc.yellow,
  error: pc.red,
  info: pc.cyan,
  dim: pc.dim,
  bold: pc.bold,
  // Coverage tiers
  full: pc.green,
  partial: pc.yellow,
  low: pc.red,
  none: pc.gray,
  // Diff change types
  added: pc.green,
  removed: pc.red,
  modified: pc.yellow,
  // Decorators
  tick: () => pc.green("✓"),
  cross: () => pc.red("✗"),
  dash: () => pc.dim("–"),
};
