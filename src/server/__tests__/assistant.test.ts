import fs from "fs";
import os from "os";
import path from "path";
import { answerAssistant, buildAssistantContext } from "../assistant.js";
import type { LlmProvider } from "../../llm/provider.js";

const data = {
  project: { name: "demo" },
  symbols: [{ id: "s1", name: "foo", kind: "function", file: "a.ts", startLine: 2, endLine: 3 }],
  complexity: { symbols: [{ id: "s1", name: "foo", file: "a.ts", riskScore: 5, linesOfCode: 2 }] },
  sourceFiles: { "a.ts": { text: "// x\nfunction foo() {\n  return 1;\n}\n" } },
};

describe("assistant", () => {
  it("builds symbol context with its source slice", () => {
    const ctx = buildAssistantContext(data as never, { type: "symbol", id: "s1" });
    expect(ctx).toContain("foo");
    expect(ctx).toContain("function foo()");
    expect(ctx).not.toContain("// x");
  });

  it("builds project context when scope is project", () => {
    expect(buildAssistantContext(data as never, { type: "project" })).toContain("Top risk symbols");
  });

  it("sends context + question to the llm", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assistant-"));
    fs.writeFileSync(path.join(dir, "site-data.json"), JSON.stringify(data));
    let received: Array<{ role: string; content: string }> = [];
    const llm = {
      chat: async (m: Array<{ role: string; content: string }>) => {
        received = m;
        return "ok";
      },
    } as unknown as LlmProvider;
    const out = await answerAssistant(dir, llm, {
      question: "why?",
      scope: { type: "file", path: "a.ts" },
    });
    expect(out).toBe("ok");
    expect(received[0].role).toBe("system");
    expect(received[0].content).toContain("a.ts");
    expect(received.at(-1)).toEqual({ role: "user", content: "why?" });
    await expect(answerAssistant(dir, llm, { question: "  " })).rejects.toThrow();
  });
});
