/**
 * Logger utilities for CLI output formatting
 */

/**
 * Print a step message without newline
 */
export function step(msg: string): void {
  process.stdout.write(`  -> ${msg}...`);
}

/**
 * Complete a step message with optional detail
 */
export function done(detail?: string): void {
  console.log(detail ? ` ${detail}` : " done");
}

/**
 * Print a section header
 */
export function header(title: string): void {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(50)}\n`);
}

/**
 * Print a formatted summary table
 */
export function summary(lines: [string, string | number][]): void {
  const maxLabel = Math.max(...lines.map(([l]) => l.length));
  for (const [label, value] of lines) {
    console.log(`  ${label.padEnd(maxLabel)} : ${value}`);
  }
}
