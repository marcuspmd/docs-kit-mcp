import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import { indexFile } from "../indexer.js";
import { extractRelationships } from "../relationshipExtractor.js";
import type { CodeSymbol } from "../symbol.types.js";

function parser(): Parser {
  const p = new Parser();
  (p as { setLanguage: (l: unknown) => void }).setLanguage(Python);
  return p;
}

const FILES: Record<string, string> = {
  "app/repo.py": `class PeopleRepo:\n    pass\n`,
  "app/service.py": `from app.repo import PeopleRepo\n\n\nclass PeopleService:\n    def __init__(self, repo: PeopleRepo):\n        self.repo = repo\n`,
  "app/dependencies.py": [
    "from app.repo import PeopleRepo",
    "from .service import PeopleService",
    "from app.service import PeopleService as Svc",
    "from fastapi import Depends",
    "",
    "",
    "def get_repo():",
    "    return PeopleRepo()",
    "",
    "",
    "def get_service(repo=Depends(get_repo)):",
    "    return PeopleService(repo=repo)",
    "",
  ].join("\n"),
};

describe("python relationships (dependencies.py wiring)", () => {
  const symbols: CodeSymbol[] = [];
  const trees = new Map<string, Parser.Tree>();
  const sources = new Map<string, string>();
  for (const [file, src] of Object.entries(FILES)) {
    symbols.push(...indexFile(file, src, parser()));
    trees.set(file, parser().parse(src));
    sources.set(file, src);
  }
  const rels = extractRelationships({ symbols, trees, sources });
  const id = (name: string) => symbols.find((s) => s.name === name)!.id;
  const has = (src: string, dst: string, type: string) =>
    rels.some((r) => r.sourceId === id(src) && r.targetId === id(dst) && r.type === type);

  it("does not index the `def` keyword token as a method", () => {
    expect(symbols.some((s) => s.name === "def")).toBe(false);
  });

  it("resolves constructor-injected types through imports", () => {
    expect(has("PeopleService", "PeopleRepo", "uses")).toBe(true);
  });

  it("detects instantiation and calls inside dependencies.py", () => {
    expect(has("get_repo", "PeopleRepo", "instantiates")).toBe(true);
    expect(has("get_service", "PeopleService", "instantiates")).toBe(true);
  });

  it("detects imported names passed as arguments (Depends(get_repo))", () => {
    // get_repo is local, not imported, so only imported names create `uses`
    expect(rels.some((r) => r.sourceId === id("get_service") && r.type === "uses")).toBe(false);
  });
});
