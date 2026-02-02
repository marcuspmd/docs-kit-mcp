import { createEventFlowAnalyzer } from "../eventFlowAnalyzer.js";
import type { CodeSymbol, SymbolRelationship } from "../../indexer/symbol.types.js";

function sym(overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol {
  return {
    kind: "class",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    ...overrides,
  } as CodeSymbol;
}

function rel(source: string, target: string, type: string): SymbolRelationship {
  return { sourceId: source, targetId: target, type } as SymbolRelationship;
}

describe("EventFlowAnalyzer", () => {
  const analyzer = createEventFlowAnalyzer();

  it("detects complete flow: emitter → event → listener", () => {
    const symbols = [
      sym({ id: "e1", name: "OrderCreatedEvent", kind: "event" }),
      sym({ id: "s1", name: "OrderService", kind: "service" }),
      sym({ id: "l1", name: "InventoryListener", kind: "listener" }),
      sym({ id: "l2", name: "EmailListener", kind: "listener" }),
    ];
    const rels = [rel("s1", "e1", "uses"), rel("l1", "e1", "uses"), rel("l2", "e1", "uses")];

    const flows = analyzer.analyze(symbols, rels);

    expect(flows).toHaveLength(1);
    expect(flows[0].event.id).toBe("e1");
    expect(flows[0].emitters).toHaveLength(1);
    expect(flows[0].emitters[0].id).toBe("s1");
    expect(flows[0].listeners).toHaveLength(2);
    expect(flows[0].complete).toBe(true);
  });

  it("flags event with no listeners as incomplete", () => {
    const symbols = [
      sym({ id: "e1", name: "PaymentEvent", kind: "event" }),
      sym({ id: "s1", name: "PaymentService", kind: "service" }),
    ];
    const rels = [rel("s1", "e1", "instantiates")];

    const flows = analyzer.analyze(symbols, rels);

    expect(flows).toHaveLength(1);
    expect(flows[0].emitters).toHaveLength(1);
    expect(flows[0].listeners).toHaveLength(0);
    expect(flows[0].complete).toBe(false);
  });

  it("flags event with no emitters as incomplete", () => {
    const symbols = [
      sym({ id: "e1", name: "OrphanEvent", kind: "event" }),
      sym({ id: "l1", name: "OrphanListener", kind: "listener" }),
    ];
    const rels = [rel("l1", "e1", "uses")];

    const flows = analyzer.analyze(symbols, rels);

    expect(flows).toHaveLength(1);
    expect(flows[0].emitters).toHaveLength(0);
    expect(flows[0].listeners).toHaveLength(1);
    expect(flows[0].complete).toBe(false);
  });

  it("matches listeners by naming convention", () => {
    const symbols = [
      sym({ id: "e1", name: "OrderEvent", kind: "event" }),
      sym({ id: "l1", name: "OrderListener", kind: "listener" }),
    ];

    const flows = analyzer.analyze(symbols, []);

    expect(flows).toHaveLength(1);
    expect(flows[0].listeners).toHaveLength(1);
    expect(flows[0].listeners[0].id).toBe("l1");
  });

  it("matches Handler suffix by naming convention", () => {
    const symbols = [
      sym({ id: "e1", name: "NotificationEvent", kind: "event" }),
      sym({ id: "l1", name: "NotificationHandler", kind: "listener" }),
    ];

    const flows = analyzer.analyze(symbols, []);

    expect(flows[0].listeners).toHaveLength(1);
    expect(flows[0].listeners[0].id).toBe("l1");
  });

  it("matches Subscriber suffix by naming convention", () => {
    const symbols = [
      sym({ id: "e1", name: "UserEvent", kind: "event" }),
      sym({ id: "l1", name: "UserSubscriber", kind: "listener" }),
    ];

    const flows = analyzer.analyze(symbols, []);

    expect(flows[0].listeners).toHaveLength(1);
  });

  it("does not duplicate listeners matched by both rel and name", () => {
    const symbols = [
      sym({ id: "e1", name: "OrderEvent", kind: "event" }),
      sym({ id: "l1", name: "OrderListener", kind: "listener" }),
    ];
    const rels = [rel("l1", "e1", "uses")];

    const flows = analyzer.analyze(symbols, rels);

    expect(flows[0].listeners).toHaveLength(1);
  });

  it("handles multiple events independently", () => {
    const symbols = [
      sym({ id: "e1", name: "OrderEvent", kind: "event" }),
      sym({ id: "e2", name: "PaymentEvent", kind: "event" }),
      sym({ id: "s1", name: "OrderService", kind: "service" }),
      sym({ id: "l1", name: "OrderListener", kind: "listener" }),
    ];
    const rels = [rel("s1", "e1", "uses")];

    const flows = analyzer.analyze(symbols, rels);

    expect(flows).toHaveLength(2);

    const orderFlow = flows.find((f) => f.event.id === "e1")!;
    expect(orderFlow.emitters).toHaveLength(1);
    expect(orderFlow.listeners).toHaveLength(1);
    expect(orderFlow.complete).toBe(true);

    const paymentFlow = flows.find((f) => f.event.id === "e2")!;
    expect(paymentFlow.emitters).toHaveLength(0);
    expect(paymentFlow.listeners).toHaveLength(0);
    expect(paymentFlow.complete).toBe(false);
  });

  it("returns empty array when no events exist", () => {
    const symbols = [sym({ id: "c1", name: "SomeClass", kind: "class" })];
    const flows = analyzer.analyze(symbols, []);
    expect(flows).toHaveLength(0);
  });
});
