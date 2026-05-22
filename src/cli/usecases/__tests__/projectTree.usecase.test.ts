import { jest } from "@jest/globals";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { projectTreeUseCase } from "../projectTree.usecase.js";

describe("projectTreeUseCase", () => {
  let tempRoot: string;
  let originalCwd: string;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let stdoutWriteSpy: jest.SpiedFunction<typeof process.stdout.write>;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "docs-kit-project-tree-"));
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

    await writeConfig(tempRoot);
    await writeFixture(tempRoot);
    process.chdir(tempRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleLogSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("writes STRUCTURE.md by default", async () => {
    const markdown = await projectTreeUseCase({ depth: 3 });
    const output = await fs.readFile(path.join(tempRoot, "STRUCTURE.md"), "utf8");
    const tree = getTreeBlock(markdown);

    expect(output).toBe(markdown);
    expect(markdown).toContain("# Project Structure");
    expect(tree).toContain("src/");
    expect(tree).toContain("README.md");
    expect(tree).toContain("├── ");
    expect(tree).toContain("└── ");
    expect(tree).toContain("│   ");
    expect(tree).not.toContain("|--");
    expect(tree).not.toContain("`--");
    expect(tree).not.toContain("node_modules");
    expect(tree).not.toContain("dist/");
  });

  it("limits rendered entries by depth", async () => {
    const markdown = await projectTreeUseCase({
      rootDir: tempRoot,
      outFile: path.join(tempRoot, "depth.md"),
      depth: 1,
    });
    const tree = getTreeBlock(markdown);

    expect(tree).toContain("src/");
    expect(tree).not.toContain("domain/");
    expect(tree).not.toContain("orderService.ts");
  });

  it("merges custom exclude patterns", async () => {
    const markdown = await projectTreeUseCase({
      rootDir: tempRoot,
      outFile: path.join(tempRoot, "exclude.md"),
      depth: 3,
      exclude: ["docs/**"],
    });
    const tree = getTreeBlock(markdown);

    expect(tree).not.toContain("docs/");
    expect(tree).toContain("src/");
  });

  it("omits file leaves in directories-only mode", async () => {
    const markdown = await projectTreeUseCase({
      rootDir: tempRoot,
      outFile: path.join(tempRoot, "dirs.md"),
      depth: 3,
      dirsOnly: true,
    });
    const tree = getTreeBlock(markdown);

    expect(tree).toContain("src/");
    expect(tree).toContain("domain/");
    expect(tree).not.toContain("index.ts");
    expect(tree).not.toContain("README.md");
  });

  it("uses configured source include patterns in source-only mode", async () => {
    const markdown = await projectTreeUseCase({
      rootDir: tempRoot,
      outFile: path.join(tempRoot, "source.md"),
      depth: 4,
      sourceOnly: true,
    });
    const tree = getTreeBlock(markdown);

    expect(tree).toContain("src/");
    expect(tree).toContain("index.ts");
    expect(tree).toContain("orderService.ts");
    expect(tree).not.toContain("README.md");
    expect(tree).not.toContain("build.js");
  });

  function getTreeBlock(markdown: string): string {
    return markdown.split("```text\n")[1]?.split("\n```")[0] ?? "";
  }
  it("prints only markdown when outFile is stdout", async () => {
    const markdown = await projectTreeUseCase({
      rootDir: tempRoot,
      outFile: "-",
      depth: 2,
    });

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    expect(stdoutWriteSpy).toHaveBeenCalledWith(`${markdown}\n`);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("limits entries per directory when requested", async () => {
    const markdown = await projectTreeUseCase({
      rootDir: tempRoot,
      outFile: path.join(tempRoot, "limited.md"),
      depth: 2,
      maxEntriesPerDir: 1,
    });

    expect(markdown).toContain("... ");
    expect(markdown).toContain("more entries");
  });
});

async function writeConfig(rootDir: string): Promise<void> {
  const config = `export default {
  rootDir: ".",
  output: {
    site: "docs-site-v2",
    docs: "docs-output",
  },
  include: ["src/**/*.ts"],
  exclude: ["**/node_modules/**"],
  docs: [],
  coverage: {
    enabled: false,
  },
  rag: {
    enabled: false,
  },
};
`;

  await fs.writeFile(path.join(rootDir, "docs.config.mjs"), config, "utf8");
}

async function writeFixture(rootDir: string): Promise<void> {
  await fs.mkdir(path.join(rootDir, "src", "domain"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "scripts"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "node_modules", "pkg"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "dist"), { recursive: true });

  await fs.writeFile(path.join(rootDir, "README.md"), "# Fixture\n", "utf8");
  await fs.writeFile(path.join(rootDir, "src", "index.ts"), "export {};\n", "utf8");
  await fs.writeFile(
    path.join(rootDir, "src", "domain", "orderService.ts"),
    "export class OrderService {}\n",
    "utf8",
  );
  await fs.writeFile(path.join(rootDir, "docs", "usage.md"), "# Usage\n", "utf8");
  await fs.writeFile(path.join(rootDir, "scripts", "build.js"), "console.log('build');\n", "utf8");
  await fs.writeFile(
    path.join(rootDir, "node_modules", "pkg", "index.js"),
    "module.exports = {};\n",
    "utf8",
  );
  await fs.writeFile(path.join(rootDir, "dist", "app.js"), "console.log('dist');\n", "utf8");
}
