import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

describe("MCP server tool registration", () => {
  test("server registers all three tools without error", () => {
    const server = new McpServer({
      name: "docs-agent",
      version: "1.0.0",
    });

    expect(() => {
      server.tool(
        "generateDocs",
        "Update docs for symbols affected by recent changes",
        {
          base: z.string().default("main"),
          head: z.string().optional(),
          dryRun: z.boolean().default(false),
          docsDir: z.string().default("docs"),
        },
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      );

      server.tool(
        "explainSymbol",
        "Explain a code symbol combining code analysis and existing docs",
        {
          symbol: z.string(),
          docsDir: z.string().default("docs"),
        },
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      );

      server.tool(
        "generateMermaid",
        "Generate Mermaid diagram for given symbols",
        {
          symbols: z.string(),
          type: z.enum(["classDiagram", "sequenceDiagram", "flowchart"]).default("classDiagram"),
        },
        async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      );
    }).not.toThrow();
  });

  test("duplicate tool name throws", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });

    server.tool("myTool", "desc", { x: z.string() }, async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));

    expect(() => {
      server.tool("myTool", "desc", { x: z.string() }, async () => ({
        content: [{ type: "text" as const, text: "ok" }],
      }));
    }).toThrow();
  });
});

describe("generateMermaid logic", () => {
  function buildClassDiagram(symbolNames: string[]): string {
    const lines = ["classDiagram"];
    for (const name of symbolNames) {
      if (name.includes(".")) {
        const [cls, method] = name.split(".");
        lines.push(`    ${cls} : +${method}()`);
      } else {
        lines.push(`    class ${name}`);
      }
    }
    const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
    for (let i = 0; i < classes.length - 1; i++) {
      lines.push(`    ${classes[i]} --> ${classes[i + 1]} : uses`);
    }
    return lines.join("\n");
  }

  test("generates class diagram with methods and relationships", () => {
    const diagram = buildClassDiagram([
      "OrderService.createOrder",
      "OrderService.cancelOrder",
      "PaymentService.charge",
    ]);

    expect(diagram).toContain("classDiagram");
    expect(diagram).toContain("OrderService : +createOrder()");
    expect(diagram).toContain("PaymentService : +charge()");
    expect(diagram).toContain("OrderService --> PaymentService : uses");
  });

  test("generates class diagram for standalone classes", () => {
    const diagram = buildClassDiagram(["UserService", "AuthService"]);
    expect(diagram).toContain("class UserService");
    expect(diagram).toContain("class AuthService");
    expect(diagram).toContain("UserService --> AuthService : uses");
  });

  function buildSequenceDiagram(symbolNames: string[]): string {
    const lines = ["sequenceDiagram"];
    const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
    for (let i = 0; i < classes.length - 1; i++) {
      lines.push(`    ${classes[i]}->>+${classes[i + 1]}: call`);
      lines.push(`    ${classes[i + 1]}-->>-${classes[i]}: response`);
    }
    return lines.join("\n");
  }

  test("generates sequence diagram", () => {
    const diagram = buildSequenceDiagram(["OrderService", "PaymentService"]);
    expect(diagram).toContain("sequenceDiagram");
    expect(diagram).toContain("OrderService->>+PaymentService: call");
    expect(diagram).toContain("PaymentService-->>-OrderService: response");
  });

  function buildFlowchart(symbolNames: string[]): string {
    const lines = ["flowchart LR"];
    const classes = [...new Set(symbolNames.map((n) => n.split(".")[0]))];
    for (const cls of classes) {
      lines.push(`    ${cls}[${cls}]`);
    }
    for (let i = 0; i < classes.length - 1; i++) {
      lines.push(`    ${classes[i]} --> ${classes[i + 1]}`);
    }
    return lines.join("\n");
  }

  test("generates flowchart", () => {
    const diagram = buildFlowchart(["A", "B", "C"]);
    expect(diagram).toContain("flowchart LR");
    expect(diagram).toContain("A[A]");
    expect(diagram).toContain("A --> B");
    expect(diagram).toContain("B --> C");
  });
});
