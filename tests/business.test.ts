import { createContextMapper } from "../src/business/contextMapper.js";
import { createBusinessTranslator } from "../src/business/businessTranslator.js";
import { createRTM } from "../src/business/rtm.js";
import { buildDescribeInBusinessTermsPrompt } from "../src/prompts/describeInBusinessTerms.prompt.js";
import type { DocRegistry, DocMapping } from "../src/docs/docRegistry.js";

function mockRegistry(mappings: Record<string, DocMapping[]>): DocRegistry {
  return {
    rebuild: async () => {},
    findDocBySymbol: async (name: string) => mappings[name] ?? [],
    findSymbolsByDoc: async () => [],
    findAllMappings: async () => Object.values(mappings).flat(),
    register: async () => {},
    unregister: async () => {},
    findAllDocs: () => [],
    findDocByPath: () => undefined,
  };
}

describe("ContextMapper", () => {
  const mapper = createContextMapper();

  describe("extractRefsFromCommits", () => {
    it("extracts ticket IDs from commit messages", () => {
      const commits = [
        { message: "feat: implement order flow PROJ-123", files: ["src/order.ts"] },
        { message: "fix: PROJ-456 payment bug", files: ["src/payment.ts", "src/payment.test.ts"] },
      ];

      const refs = mapper.extractRefsFromCommits(commits);

      expect(refs).toHaveLength(3);
      expect(refs[0]).toEqual({
        ticketId: "PROJ-123",
        source: "commit",
        file: "src/order.ts",
      });
      expect(refs[1].ticketId).toBe("PROJ-456");
      expect(refs[2].ticketId).toBe("PROJ-456");
    });

    it("extracts multiple tickets from one commit", () => {
      const commits = [{ message: "PROJ-1 and PROJ-2 combined", files: ["src/app.ts"] }];

      const refs = mapper.extractRefsFromCommits(commits);
      expect(refs).toHaveLength(2);
      expect(refs.map((r) => r.ticketId).sort()).toEqual(["PROJ-1", "PROJ-2"]);
    });

    it("returns empty for commits without tickets", () => {
      const commits = [{ message: "chore: update deps", files: ["package.json"] }];

      expect(mapper.extractRefsFromCommits(commits)).toHaveLength(0);
    });

    it("handles various ticket formats", () => {
      const commits = [{ message: "ABC-1 DEV2-999 X-0", files: ["f.ts"] }];

      const refs = mapper.extractRefsFromCommits(commits);
      const tickets = refs.map((r) => r.ticketId);
      expect(tickets).toContain("ABC-1");
      expect(tickets).toContain("DEV2-999");
    });
  });

  describe("extractRefsFromLines", () => {
    it("extracts refs from code comments", () => {
      const lines = [
        { file: "src/order.ts", line: 5, text: "// ref: PROJ-123" },
        { file: "src/order.ts", line: 10, text: "const x = 1;" },
        { file: "src/pay.ts", line: 3, text: "  // ref: PAY-42" },
      ];

      const refs = mapper.extractRefsFromLines(lines);

      expect(refs).toHaveLength(2);
      expect(refs[0]).toEqual({
        ticketId: "PROJ-123",
        source: "comment",
        file: "src/order.ts",
        line: 5,
      });
      expect(refs[1].ticketId).toBe("PAY-42");
    });

    it("returns empty when no refs in lines", () => {
      const lines = [{ file: "src/a.ts", line: 1, text: "// just a comment" }];

      expect(mapper.extractRefsFromLines(lines)).toHaveLength(0);
    });
  });

  describe("buildRTM", () => {
    it("groups refs by ticket and enriches with docs", async () => {
      const refs = [
        { ticketId: "PROJ-1", source: "commit" as const, file: "src/order.ts" },
        { ticketId: "PROJ-1", source: "comment" as const, file: "src/order.test.ts", line: 3 },
        { ticketId: "PROJ-2", source: "commit" as const, file: "src/pay.ts" },
      ];

      const registry = mockRegistry({
        "src/order.ts": [{ symbolName: "src/order.ts", docPath: "docs/orders.md" }],
      });

      const rtm = await mapper.buildRTM(refs, registry);

      expect(rtm).toHaveLength(2);

      const proj1 = rtm.find((e) => e.ticketId === "PROJ-1")!;
      expect(proj1.symbols).toContain("src/order.ts");
      expect(proj1.tests).toContain("src/order.test.ts");
      expect(proj1.docs).toContain("docs/orders.md");

      const proj2 = rtm.find((e) => e.ticketId === "PROJ-2")!;
      expect(proj2.symbols).toContain("src/pay.ts");
    });

    it("classifies .test. and .spec. files as tests", async () => {
      const refs = [
        { ticketId: "T-1", source: "commit" as const, file: "src/a.spec.ts" },
        { ticketId: "T-1", source: "commit" as const, file: "tests/b.test.js" },
        { ticketId: "T-1", source: "commit" as const, file: "src/c.ts" },
      ];

      const rtm = await mapper.buildRTM(refs, mockRegistry({}));
      const entry = rtm[0];
      expect(entry.tests.sort()).toEqual(["src/a.spec.ts", "tests/b.test.js"]);
      expect(entry.symbols).toContain("src/c.ts");
    });

    it("includes symbolId refs in symbols", async () => {
      const refs = [
        {
          ticketId: "T-1",
          source: "comment" as const,
          file: "src/a.ts",
          symbolId: "OrderService",
          line: 5,
        },
      ];

      const rtm = await mapper.buildRTM(refs, mockRegistry({}));
      expect(rtm[0].symbols).toContain("OrderService");
    });
  });
});

describe("RTM", () => {
  const entries = [
    {
      ticketId: "PROJ-1",
      symbols: ["OrderService"],
      tests: ["order.test.ts"],
      docs: ["docs/orders.md"],
    },
    { ticketId: "PROJ-2", symbols: ["PayService"], tests: [], docs: [] },
  ];

  describe("getByTicket", () => {
    it("returns entry for existing ticket", () => {
      const rtm = createRTM(entries);
      expect(rtm.getByTicket("PROJ-1")?.symbols).toContain("OrderService");
    });

    it("returns undefined for missing ticket", () => {
      const rtm = createRTM(entries);
      expect(rtm.getByTicket("NOPE-1")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all entries", () => {
      const rtm = createRTM(entries);
      expect(rtm.getAll()).toHaveLength(2);
    });
  });

  describe("export markdown", () => {
    it("generates a markdown table", () => {
      const rtm = createRTM(entries);
      const md = rtm.export("markdown");

      expect(md).toContain("| Ticket |");
      expect(md).toContain("| PROJ-1 | OrderService | order.test.ts | docs/orders.md |");
      expect(md).toContain("| PROJ-2 | PayService | — | — |");
    });
  });

  describe("export csv", () => {
    it("generates CSV output", () => {
      const rtm = createRTM(entries);
      const csv = rtm.export("csv");

      expect(csv).toContain("ticket,symbols,tests,docs");
      expect(csv).toContain('PROJ-1,"OrderService","order.test.ts","docs/orders.md"');
      expect(csv).toContain('PROJ-2,"PayService","",""');
    });
  });
});

describe("BusinessTranslator", () => {
  it("describeInBusinessTerms returns LLM response", async () => {
    const mockLlm = {
      chat: async (messages: { role: string; content: string }[]) => {
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe("user");
        expect(messages[0].content).toContain("OrderService.createOrder");
        expect(messages[0].content).toContain("method");
        expect(messages[0].content).toContain("if (amount > 0)");
        return "This rule validates the order amount and creates the order when valid.";
      },
    };

    const translator = createBusinessTranslator(mockLlm);
    const sourceCode = `if (amount > 0) {
  return createOrder(amount);
}
return null;`;

    const result = await translator.describeInBusinessTerms(
      { name: "OrderService.createOrder", kind: "method" },
      sourceCode,
    );

    expect(result).toBe("This rule validates the order amount and creates the order when valid.");
  });

  it("describeInBusinessTerms passes existingContext to prompt", async () => {
    let capturedContent = "";
    const mockLlm = {
      chat: async (messages: { role: string; content: string }[]) => {
        capturedContent = messages[0].content;
        return "Business description.";
      },
    };

    const translator = createBusinessTranslator(mockLlm);
    await translator.describeInBusinessTerms(
      { name: "PaymentService.charge", kind: "method" },
      "charge(amount);",
      "Existing doc: charges the user.",
    );

    expect(capturedContent).toContain("Existing doc: charges the user.");
  });
});

describe("describeInBusinessTerms prompt", () => {
  it("includes symbol name, kind, source code and optional context", () => {
    const prompt = buildDescribeInBusinessTermsPrompt({
      symbolName: "OrderService.createOrder",
      kind: "method",
      sourceCode: "if (amount > 0) return createOrder(amount);",
      existingContext: "Charges the customer.",
    });

    expect(prompt).toContain("OrderService.createOrder");
    expect(prompt).toContain("method");
    expect(prompt).toContain("if (amount > 0) return createOrder(amount);");
    expect(prompt).toContain("Charges the customer.");
    expect(prompt).toContain("business terms");
    expect(prompt).toContain("rules");
  });

  it("builds prompt without existingContext", () => {
    const prompt = buildDescribeInBusinessTermsPrompt({
      symbolName: "PaymentService",
      kind: "class",
      sourceCode: "class PaymentService {}",
    });

    expect(prompt).toContain("PaymentService");
    expect(prompt).toContain("class");
    expect(prompt).not.toContain("Existing context");
  });
});
