/**
 * Command-line argument parsing utilities
 */

/**
 * Parse command-line arguments into positional and flag-based arguments
 */
export function parseArgs(
  args: string[],
  flags: Record<string, string>,
): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const result = { ...flags };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = "true";
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags: result };
}
