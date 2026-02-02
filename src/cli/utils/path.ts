import path from "node:path";

/**
 * Resolve a path from config or flags relative to the project root (configDir).
 * If the path is already absolute, return as-is.
 */
export function resolveConfigPath(
  pathValue: string | undefined,
  configDir: string,
  defaultValue: string,
): string {
  const actualValue = pathValue || defaultValue;
  return path.isAbsolute(actualValue) ? actualValue : path.resolve(configDir, actualValue);
}
