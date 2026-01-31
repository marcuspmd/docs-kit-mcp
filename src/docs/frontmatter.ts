import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface DocFrontmatter {
  title?: string;
  symbols: string[];
  lastUpdated?: string;
  [key: string]: unknown;
}

export interface ParsedDoc {
  frontmatter: DocFrontmatter;
  content: string;
  raw: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseFrontmatter(markdown: string): ParsedDoc {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: { symbols: [] }, content: markdown, raw: markdown };
  }
  const parsed = parseYaml(match[1]) ?? {};
  const frontmatter = parsed as DocFrontmatter;
  frontmatter.symbols ??= [];
  return { frontmatter, content: match[2], raw: markdown };
}

export function serializeFrontmatter(doc: ParsedDoc): string {
  const yaml = stringifyYaml(doc.frontmatter).trimEnd();
  return `---\n${yaml}\n---\n${doc.content}`;
}

export function updateFrontmatter(markdown: string, update: Partial<DocFrontmatter>): string {
  const doc = parseFrontmatter(markdown);
  doc.frontmatter = { ...doc.frontmatter, ...update };
  return serializeFrontmatter(doc);
}
