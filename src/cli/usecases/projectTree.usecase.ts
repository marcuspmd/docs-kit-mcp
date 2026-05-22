import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { loadConfig } from "../../configLoader.js";
import { done, header, step, summary } from "../utils/index.js";

const DEFAULT_OUTPUT_FILE = "STRUCTURE.md";
const DEFAULT_DEPTH = 4;
const DEFAULT_INCLUDE = ["**/*"];
const TREE_BRANCH = "├── ";
const TREE_LAST_BRANCH = "└── ";
const TREE_VERTICAL_PREFIX = "│   ";
const TREE_EMPTY_PREFIX = "    ";

const GENERATED_OR_HEAVY_DIRECTORIES = [
  ".git",
  ".docs-kit",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "docs-site",
  "docs-site-v2",
  "docs-site-diff",
  "docs-output",
];

export interface ProjectTreeUseCaseParams {
  rootDir?: string;
  outFile?: string;
  depth?: number;
  include?: string[];
  exclude?: string[];
  dirsOnly?: boolean;
  sourceOnly?: boolean;
  maxEntriesPerDir?: number;
}

interface ProjectTreeEntry {
  path: string;
  type: "directory" | "file";
}

interface ProjectTreeNode {
  name: string;
  type: "directory" | "file";
  children: Map<string, ProjectTreeNode>;
}

interface ProjectTreeRenderOptions {
  projectName: string;
  rootDisplay: string;
  depth: number;
  include: string[];
  exclude: string[];
  dirsOnly: boolean;
  sourceOnly: boolean;
  maxEntriesPerDir?: number;
  entryCount: number;
}

export async function projectTreeUseCase(params: ProjectTreeUseCaseParams): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(configDir);

  const rootDir = path.resolve(configDir, params.rootDir ?? ".");
  const outFile = params.outFile ?? DEFAULT_OUTPUT_FILE;
  const depth = normalizeDepth(params.depth);
  const include = params.sourceOnly
    ? config.include
    : normalizePatternList(params.include, DEFAULT_INCLUDE);
  const exclude = buildExcludePatterns({
    configExclude: config.exclude,
    paramsExclude: params.exclude,
    rootDir,
    outFile,
    configDir,
  });
  const dirsOnly = params.dirsOnly ?? false;
  const sourceOnly = params.sourceOnly ?? false;
  const maxEntriesPerDir = normalizeMaxEntries(params.maxEntriesPerDir);
  const printToStdout = outFile === "-";

  await assertDirectory(rootDir);

  if (!printToStdout) {
    header("Generating project structure");
    step("Scanning project tree");
  }

  const entries = await collectProjectEntries({ rootDir, include, exclude, depth });

  if (!printToStdout) {
    done(`${entries.length} entries`);
  }

  const tree = buildProjectTree(entries, { includeFiles: !dirsOnly });
  const markdown = renderProjectStructureMarkdown(tree, {
    projectName: path.basename(rootDir) || rootDir,
    rootDisplay: formatDisplayPath(rootDir, configDir),
    depth,
    include,
    exclude,
    dirsOnly,
    sourceOnly,
    maxEntriesPerDir,
    entryCount: entries.length,
  });

  if (printToStdout) {
    process.stdout.write(`${markdown}\n`);
    return markdown;
  }

  const outputPath = resolveOutputPath(outFile, configDir);
  step("Writing Markdown file");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");
  done(formatDisplayPath(outputPath, configDir));

  header("Project Structure Summary");
  summary([
    ["Root", formatDisplayPath(rootDir, configDir)],
    ["Depth", depth],
    ["Entries", entries.length],
    ["Output", outputPath],
  ]);

  console.log(
    `\n  Open ${formatDisplayPath(outputPath, configDir)} to inspect the project structure.\n`,
  );

  return markdown;
}

async function assertDirectory(rootDir: string): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(rootDir);
  } catch {
    throw new Error(`Project tree root not found: ${rootDir}`);
  }

  if (!stat.isDirectory()) {
    throw new Error(`Project tree root must be a directory: ${rootDir}`);
  }
}

async function collectProjectEntries(input: {
  rootDir: string;
  include: string[];
  exclude: string[];
  depth: number;
}): Promise<ProjectTreeEntry[]> {
  const globEntries = await fg(input.include, {
    cwd: input.rootDir,
    ignore: input.exclude,
    onlyFiles: false,
    markDirectories: true,
    dot: true,
    deep: input.depth,
    followSymbolicLinks: false,
    unique: true,
  });

  const entries = globEntries
    .map(toProjectTreeEntry)
    .filter((entry): entry is ProjectTreeEntry => entry !== undefined)
    .filter((entry) => !isGeneratedOrHeavyPath(entry.path));

  return sortEntries(uniqueEntries(entries));
}

function toProjectTreeEntry(rawPath: string): ProjectTreeEntry | undefined {
  const normalizedPath = normalizePath(rawPath).replace(/\/$/, "");
  if (!normalizedPath || normalizedPath === ".") {
    return undefined;
  }

  return {
    path: normalizedPath,
    type: rawPath.endsWith("/") ? "directory" : "file",
  };
}

function buildProjectTree(
  entries: ProjectTreeEntry[],
  options: { includeFiles: boolean },
): ProjectTreeNode {
  const root = createNode("", "directory");

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isLastPart = index === parts.length - 1;
      const type = isLastPart ? entry.type : "directory";

      if (isLastPart && type === "file" && !options.includeFiles) {
        return;
      }

      const existing = current.children.get(part);
      if (existing) {
        if (!isLastPart || type === "directory") {
          existing.type = "directory";
        }
        current = existing;
        return;
      }

      const next = createNode(part, type);
      current.children.set(part, next);
      current = next;
    });
  }

  return root;
}

function createNode(name: string, type: "directory" | "file"): ProjectTreeNode {
  return {
    name,
    type,
    children: new Map(),
  };
}

export function renderProjectStructureMarkdown(
  tree: ProjectTreeNode,
  options: ProjectTreeRenderOptions,
): string {
  const lines = [
    "# Project Structure",
    "",
    "LLM-friendly snapshot of the repository folders and files.",
    "",
    "## Metadata",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Root | ${escapeMarkdownTableValue(options.rootDisplay)} |`,
    `| Depth | ${options.depth} |`,
    `| Include | ${escapeMarkdownTableValue(formatPatternList(options.include))} |`,
    `| Exclude | ${escapeMarkdownTableValue(formatPatternList(options.exclude))} |`,
    `| Directories only | ${options.dirsOnly ? "yes" : "no"} |`,
    `| Source only | ${options.sourceOnly ? "yes" : "no"} |`,
    `| Entries scanned | ${options.entryCount} |`,
    "",
    "## Tree",
    "",
    "```text",
    `${options.projectName}/`,
    ...renderTreeLines(tree, "", options.maxEntriesPerDir),
    "```",
    "",
  ];

  return lines.join("\n");
}

function renderTreeLines(
  node: ProjectTreeNode,
  prefix: string,
  maxEntriesPerDir?: number,
): string[] {
  const children = sortNodes(Array.from(node.children.values()));
  const limit = maxEntriesPerDir ? Math.min(children.length, maxEntriesPerDir) : children.length;
  const visibleChildren = children.slice(0, limit);
  const omittedCount = children.length - visibleChildren.length;
  const lines: string[] = [];

  visibleChildren.forEach((child, index) => {
    const isLast = index === visibleChildren.length - 1 && omittedCount === 0;
    const connector = isLast ? TREE_LAST_BRANCH : TREE_BRANCH;
    const childPrefix = isLast ? TREE_EMPTY_PREFIX : TREE_VERTICAL_PREFIX;
    lines.push(`${prefix}${connector}${formatNodeName(child)}`);

    if (child.type === "directory") {
      lines.push(...renderTreeLines(child, `${prefix}${childPrefix}`, maxEntriesPerDir));
    }
  });

  if (omittedCount > 0) {
    lines.push(`${prefix}${TREE_LAST_BRANCH}... ${omittedCount} more entries`);
  }

  return lines;
}

function formatNodeName(node: ProjectTreeNode): string {
  return node.type === "directory" ? `${node.name}/` : node.name;
}

function sortEntries(entries: ProjectTreeEntry[]): ProjectTreeEntry[] {
  return entries.sort((first, second) => {
    if (first.type !== second.type) {
      return first.type === "directory" ? -1 : 1;
    }

    return first.path.localeCompare(second.path);
  });
}

function sortNodes(nodes: ProjectTreeNode[]): ProjectTreeNode[] {
  return nodes.sort((first, second) => {
    if (first.type !== second.type) {
      return first.type === "directory" ? -1 : 1;
    }

    return first.name.localeCompare(second.name);
  });
}

function uniqueEntries(entries: ProjectTreeEntry[]): ProjectTreeEntry[] {
  const seen = new Map<string, ProjectTreeEntry>();

  for (const entry of entries) {
    const existing = seen.get(entry.path);
    if (!existing || entry.type === "directory") {
      seen.set(entry.path, entry);
    }
  }

  return Array.from(seen.values());
}

function normalizePatternList(patterns: string[] | undefined, fallback: string[]): string[] {
  const normalized = patterns?.map((pattern) => pattern.trim()).filter(Boolean) ?? [];
  return normalized.length > 0 ? normalized : fallback;
}

function buildExcludePatterns(input: {
  configExclude: string[];
  paramsExclude?: string[];
  rootDir: string;
  outFile: string;
  configDir: string;
}): string[] {
  const outputExcludes = outputFileExcludes(input.outFile, input.rootDir, input.configDir);
  return Array.from(
    new Set([
      ...input.configExclude,
      ...generatedDirectoryExcludes(),
      ...(input.paramsExclude ?? []),
      ...outputExcludes,
    ]),
  ).filter(Boolean);
}

function generatedDirectoryExcludes(): string[] {
  return GENERATED_OR_HEAVY_DIRECTORIES.flatMap((directoryName) => [
    directoryName,
    `${directoryName}/**`,
    `**/${directoryName}`,
    `**/${directoryName}/**`,
  ]);
}

function outputFileExcludes(outFile: string, rootDir: string, configDir: string): string[] {
  if (outFile === "-") {
    return [];
  }

  const outputPath = resolveOutputPath(outFile, configDir);
  const relativeToRoot = normalizePath(path.relative(rootDir, outputPath));

  if (!relativeToRoot || relativeToRoot.startsWith("..")) {
    return [];
  }

  return [relativeToRoot, `**/${relativeToRoot}`];
}

function isGeneratedOrHeavyPath(entryPath: string): boolean {
  return entryPath
    .split("/")
    .filter(Boolean)
    .some((segment) => GENERATED_OR_HEAVY_DIRECTORIES.includes(segment));
}

function resolveOutputPath(outFile: string, configDir: string): string {
  return path.isAbsolute(outFile) ? outFile : path.resolve(configDir, outFile);
}

function formatDisplayPath(targetPath: string, configDir: string): string {
  const relativePath = normalizePath(path.relative(configDir, targetPath));
  return relativePath && !relativePath.startsWith("..") ? relativePath : targetPath;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function normalizeDepth(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return DEFAULT_DEPTH;
  }

  return Math.floor(value);
}

function normalizeMaxEntries(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return undefined;
  }

  return Math.floor(value);
}

function formatPatternList(patterns: string[]): string {
  return patterns.length > 0 ? patterns.join(", ") : "none";
}

function escapeMarkdownTableValue(value: string): string {
  return value.replace(/\|/g, "\\|");
}
