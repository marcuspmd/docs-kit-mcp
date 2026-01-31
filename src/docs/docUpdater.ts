import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ChangeImpact } from "../indexer/symbol.types.js";
import { DocRegistry, DocMapping } from "./docRegistry.js";
import { updateFrontmatter } from "./frontmatter.js";

export interface MarkdownSection {
  heading: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
}

export interface UpdateResult {
  docPath: string;
  symbolName: string;
  action: "updated" | "removed" | "skipped";
  sectionHeading?: string;
  diff?: string;
}

export interface DocUpdater {
  applyChanges(
    impacts: ChangeImpact[],
    registry: DocRegistry,
    docsDir: string,
  ): Promise<UpdateResult[]>;
}

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

export function parseSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split("\n");
  const sections: MarkdownSection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(HEADING_REGEX);
    if (match) {
      sections.push({
        heading: match[2].trim(),
        level: match[1].length,
        startLine: i,
        endLine: -1,
        content: "",
      });
    }
  }

  for (let i = 0; i < sections.length; i++) {
    const next = sections[i + 1];
    sections[i].endLine = next ? next.startLine - 1 : lines.length - 1;
    sections[i].content = lines
      .slice(sections[i].startLine, sections[i].endLine + 1)
      .join("\n");
  }

  return sections;
}

function findSection(
  sections: MarkdownSection[],
  symbolName: string,
): MarkdownSection | undefined {
  const baseName = symbolName.includes(".")
    ? symbolName.split(".").pop()!
    : symbolName;

  return sections.find(
    (s) =>
      s.heading === symbolName ||
      s.heading === baseName ||
      s.heading.startsWith(`${symbolName}(`) ||
      s.heading.startsWith(`${baseName}(`),
  );
}

export function removeSection(
  markdown: string,
  sections: MarkdownSection[],
  symbolName: string,
): { result: string; heading?: string } {
  const section = findSection(sections, symbolName);
  if (!section) return { result: markdown };

  const lines = markdown.split("\n");
  const before = lines.slice(0, section.startLine);
  const after = lines.slice(section.endLine + 1);

  // Remove trailing blank line if both sides have one
  if (before.length > 0 && before[before.length - 1] === "" && after.length > 0 && after[0] === "") {
    after.shift();
  }

  return { result: before.concat(after).join("\n"), heading: section.heading };
}

export function updateSection(
  markdown: string,
  sections: MarkdownSection[],
  symbolName: string,
  impact: ChangeImpact,
): { result: string; heading?: string } {
  const section = findSection(sections, symbolName);

  if (!section) {
    // Append new section at end
    const baseName = symbolName.includes(".")
      ? symbolName.split(".").pop()!
      : symbolName;
    const newSection = `\n## ${baseName}\n\n> TODO: Document \`${symbolName}\` (${impact.changeType}).`;
    return { result: markdown.trimEnd() + "\n" + newSection + "\n", heading: baseName };
  }

  // Replace existing section content, keeping heading
  const lines = markdown.split("\n");
  const headingLine = lines[section.startLine];
  const replacement = [
    headingLine,
    "",
    `> Updated: \`${symbolName}\` was ${impact.changeType}.`,
  ];

  const before = lines.slice(0, section.startLine);
  const after = lines.slice(section.endLine + 1);

  return {
    result: before.concat(replacement, after).join("\n"),
    heading: section.heading,
  };
}

export function createDocUpdater(options?: {
  dryRun?: boolean;
}): DocUpdater {
  const dryRun = options?.dryRun ?? false;

  return {
    async applyChanges(
      impacts: ChangeImpact[],
      registry: DocRegistry,
      docsDir: string,
    ): Promise<UpdateResult[]> {
      const results: UpdateResult[] = [];

      for (const impact of impacts.filter((i) => i.docUpdateRequired)) {
        const mappings = await registry.findDocBySymbol(impact.symbol.name);

        if (mappings.length === 0) {
          results.push({
            docPath: "",
            symbolName: impact.symbol.name,
            action: "skipped",
          });
          continue;
        }

        for (const mapping of mappings) {
          const fullPath = join(docsDir, mapping.docPath);
          const markdown = await readFile(fullPath, "utf-8");
          const sections = parseSections(markdown);

          if (impact.changeType === "removed") {
            const { result: updated, heading } = removeSection(
              markdown,
              sections,
              impact.symbol.name,
            );

            const diff = dryRun ? diffText(markdown, updated) : undefined;
            if (!dryRun) {
              await writeFile(fullPath, updated, "utf-8");
              await updateFrontmatterTimestamp(fullPath);
            }

            results.push({
              docPath: mapping.docPath,
              symbolName: impact.symbol.name,
              action: "removed",
              sectionHeading: heading ? `## ${heading}` : undefined,
              diff: dryRun ? diff : undefined,
            });
          } else {
            const { result: updated, heading } = updateSection(
              markdown,
              sections,
              impact.symbol.name,
              impact,
            );

            const diff = dryRun ? diffText(markdown, updated) : undefined;
            if (!dryRun) {
              await writeFile(fullPath, updated, "utf-8");
              await updateFrontmatterTimestamp(fullPath);
            }

            results.push({
              docPath: mapping.docPath,
              symbolName: impact.symbol.name,
              action: "updated",
              sectionHeading: heading ? `## ${heading}` : undefined,
              diff: dryRun ? diff : undefined,
            });
          }
        }
      }

      return results;
    },
  };
}

async function updateFrontmatterTimestamp(filePath: string): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const updated = updateFrontmatter(content, {
    lastUpdated: new Date().toISOString().slice(0, 10),
  });
  await writeFile(filePath, updated, "utf-8");
}

function diffText(before: string, after: string): string {
  const bLines = before.split("\n");
  const aLines = after.split("\n");
  const out: string[] = [];

  const max = Math.max(bLines.length, aLines.length);
  for (let i = 0; i < max; i++) {
    const b = bLines[i];
    const a = aLines[i];
    if (b === a) continue;
    if (b !== undefined && a === undefined) out.push(`- ${b}`);
    else if (b === undefined && a !== undefined) out.push(`+ ${a}`);
    else if (b !== a) {
      out.push(`- ${b}`);
      out.push(`+ ${a}`);
    }
  }
  return out.join("\n");
}
