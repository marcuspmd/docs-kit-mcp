import { createApiSync } from "../apiSync.js";
import type { OpenApiSpec } from "../apiSync.js";
import type { ApiEndpoint } from "../apiSync.js";
import type { CodeSymbol } from "../../indexer/symbol.types.js";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function sym(overrides: Partial<CodeSymbol> & { id: string; name: string }): CodeSymbol {
  return {
    kind: "class",
    file: "src/test.ts",
    startLine: 1,
    endLine: 10,
    ...overrides,
  } as CodeSymbol;
}

describe("ApiSync", () => {
  const sync = createApiSync();

  describe("extractEndpointsFromCode", () => {
    it("extracts endpoints from controller methods with HTTP tags", () => {
      const symbols = [
        sym({ id: "c1", name: "OrderController", kind: "controller" }),
        sym({
          id: "m1",
          name: "create",
          kind: "method",
          parent: "c1",
          tags: ["POST /orders"],
          signature: "body: CreateOrderDto",
          summary: "returns Order",
        }),
        sym({
          id: "m2",
          name: "getById",
          kind: "method",
          parent: "c1",
          tags: ["GET /orders/:id"],
          signature: "id: string",
        }),
      ];

      const endpoints = sync.extractEndpointsFromCode(symbols);

      expect(endpoints).toHaveLength(2);

      const post = endpoints.find((e) => e.method === "POST")!;
      expect(post.path).toBe("/orders");
      expect(post.parameters).toEqual([{ name: "body", type: "CreateOrderDto", required: true }]);
      expect(post.responseType).toBe("Order");
      expect(post.symbolId).toBe("m1");

      const get = endpoints.find((e) => e.method === "GET")!;
      expect(get.path).toBe("/orders/:id");
      expect(get.parameters).toEqual([{ name: "id", type: "string", required: true }]);
    });

    it("detects controllers by naming convention", () => {
      const symbols = [
        sym({ id: "c1", name: "PaymentController", kind: "class" }),
        sym({ id: "m1", name: "charge", kind: "method", parent: "c1", tags: ["POST /payments"] }),
      ];

      const endpoints = sync.extractEndpointsFromCode(symbols);
      expect(endpoints).toHaveLength(1);
    });

    it("ignores methods without HTTP tags", () => {
      const symbols = [
        sym({ id: "c1", name: "OrderController", kind: "controller" }),
        sym({ id: "m1", name: "helper", kind: "method", parent: "c1", tags: ["internal"] }),
      ];

      expect(sync.extractEndpointsFromCode(symbols)).toHaveLength(0);
    });

    it("ignores methods not in controllers", () => {
      const symbols = [
        sym({ id: "s1", name: "OrderService", kind: "service" }),
        sym({ id: "m1", name: "create", kind: "method", parent: "s1", tags: ["POST /orders"] }),
      ];

      expect(sync.extractEndpointsFromCode(symbols)).toHaveLength(0);
    });
  });

  describe("parseOpenApiObject", () => {
    it("parses paths with operations", () => {
      const spec: OpenApiSpec = {
        paths: {
          "/orders": {
            get: {
              operationId: "listOrders",
              parameters: [
                { name: "limit", in: "query", required: false, schema: { type: "integer" } },
              ],
              responses: {
                "200": {
                  content: { "application/json": { schema: { type: "array" } } },
                },
              },
            },
            post: {
              operationId: "createOrder",
              parameters: [],
            },
          },
        },
      };

      const endpoints = sync.parseOpenApiObject(spec);

      expect(endpoints).toHaveLength(2);

      const get = endpoints.find((e) => e.method === "GET")!;
      expect(get.path).toBe("/orders");
      expect(get.symbolId).toBe("listOrders");
      expect(get.parameters).toEqual([{ name: "limit", type: "integer", required: false }]);
      expect(get.responseType).toBe("array");

      const post = endpoints.find((e) => e.method === "POST")!;
      expect(post.symbolId).toBe("createOrder");
    });

    it("normalizes path parameters from {id} to :id", () => {
      const spec: OpenApiSpec = {
        paths: {
          "/orders/{orderId}": {
            get: { operationId: "getOrder" },
          },
        },
      };

      const endpoints = sync.parseOpenApiObject(spec);
      expect(endpoints[0].path).toBe("/orders/:orderId");
    });

    it("extracts $ref response type", () => {
      const spec: OpenApiSpec = {
        paths: {
          "/orders": {
            get: {
              operationId: "list",
              responses: {
                "200": {
                  content: {
                    "application/json": { schema: { $ref: "#/components/schemas/OrderList" } },
                  },
                },
              },
            },
          },
        },
      };

      const endpoints = sync.parseOpenApiObject(spec);
      expect(endpoints[0].responseType).toBe("OrderList");
    });

    it("merges path-level parameters", () => {
      const spec: OpenApiSpec = {
        paths: {
          "/orders/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: {
              operationId: "getOrder",
              parameters: [{ name: "fields", in: "query", schema: { type: "string" } }],
            },
          },
        },
      };

      const endpoints = sync.parseOpenApiObject(spec);
      expect(endpoints[0].parameters).toHaveLength(2);
    });
  });

  describe("parseOpenApiSpec", () => {
    it("parses YAML spec file", async () => {
      const tmpFile = join(tmpdir(), `openapi-${Date.now()}.yaml`);
      const yaml = `
paths:
  /users:
    get:
      operationId: listUsers
`;
      await writeFile(tmpFile, yaml);
      try {
        const endpoints = await sync.parseOpenApiSpec(tmpFile);
        expect(endpoints).toHaveLength(1);
        expect(endpoints[0].symbolId).toBe("listUsers");
      } finally {
        await unlink(tmpFile);
      }
    });

    it("parses JSON spec file", async () => {
      const tmpFile = join(tmpdir(), `openapi-${Date.now()}.json`);
      const json = JSON.stringify({
        paths: { "/items": { post: { operationId: "createItem" } } },
      });
      await writeFile(tmpFile, json);
      try {
        const endpoints = await sync.parseOpenApiSpec(tmpFile);
        expect(endpoints).toHaveLength(1);
        expect(endpoints[0].symbolId).toBe("createItem");
      } finally {
        await unlink(tmpFile);
      }
    });
  });

  describe("compare", () => {
    it("detects endpoint missing in spec", () => {
      const code: ApiEndpoint[] = [
        { method: "POST", path: "/orders/:id/refund", parameters: [], symbolId: "m1" },
      ];
      const spec: ApiEndpoint[] = [];

      const d = sync.compare(code, spec);
      expect(d).toHaveLength(1);
      expect(d[0].type).toBe("missing_in_spec");
      expect(d[0].endpoint).toBe("POST /orders/:id/refund");
    });

    it("detects endpoint missing in code", () => {
      const code: ApiEndpoint[] = [];
      const spec: ApiEndpoint[] = [
        { method: "GET", path: "/legacy", parameters: [], symbolId: "getLegacy" },
      ];

      const d = sync.compare(code, spec);
      expect(d).toHaveLength(1);
      expect(d[0].type).toBe("missing_in_code");
      expect(d[0].endpoint).toBe("GET /legacy");
    });

    it("detects parameter type mismatch", () => {
      const code: ApiEndpoint[] = [
        {
          method: "GET",
          path: "/orders",
          parameters: [{ name: "limit", type: "number", required: true }],
          symbolId: "m1",
        },
      ];
      const spec: ApiEndpoint[] = [
        {
          method: "GET",
          path: "/orders",
          parameters: [{ name: "limit", type: "integer", required: false }],
          symbolId: "listOrders",
        },
      ];

      const d = sync.compare(code, spec);
      expect(d.some((x) => x.type === "type_mismatch" && x.details.includes("limit"))).toBe(true);
    });

    it("detects parameter missing in spec", () => {
      const code: ApiEndpoint[] = [
        {
          method: "GET",
          path: "/orders",
          parameters: [{ name: "cursor", type: "string", required: false }],
          symbolId: "m1",
        },
      ];
      const spec: ApiEndpoint[] = [
        { method: "GET", path: "/orders", parameters: [], symbolId: "listOrders" },
      ];

      const d = sync.compare(code, spec);
      expect(
        d.some((x) => x.details.includes("cursor") && x.details.includes("missing in spec")),
      ).toBe(true);
    });

    it("detects parameter missing in code", () => {
      const code: ApiEndpoint[] = [
        { method: "GET", path: "/orders", parameters: [], symbolId: "m1" },
      ];
      const spec: ApiEndpoint[] = [
        {
          method: "GET",
          path: "/orders",
          parameters: [{ name: "page", type: "integer", required: false }],
          symbolId: "list",
        },
      ];

      const d = sync.compare(code, spec);
      expect(
        d.some((x) => x.details.includes("page") && x.details.includes("missing in code")),
      ).toBe(true);
    });

    it("detects response type mismatch", () => {
      const code: ApiEndpoint[] = [
        {
          method: "GET",
          path: "/orders",
          parameters: [],
          symbolId: "m1",
          responseType: "OrderList",
        },
      ];
      const spec: ApiEndpoint[] = [
        { method: "GET", path: "/orders", parameters: [], symbolId: "list", responseType: "array" },
      ];

      const d = sync.compare(code, spec);
      expect(d.some((x) => x.details.includes("Response type mismatch"))).toBe(true);
    });

    it("normalizes {param} and :param paths", () => {
      const code: ApiEndpoint[] = [
        { method: "GET", path: "/orders/:id", parameters: [], symbolId: "m1" },
      ];
      const spec: ApiEndpoint[] = [
        { method: "GET", path: "/orders/:id", parameters: [], symbolId: "getOrder" },
      ];

      expect(sync.compare(code, spec)).toHaveLength(0);
    });

    it("reports no discrepancies when code and spec match", () => {
      const shared: ApiEndpoint[] = [
        {
          method: "GET",
          path: "/orders",
          parameters: [{ name: "limit", type: "integer", required: false }],
          symbolId: "x",
        },
      ];

      expect(sync.compare(shared, shared)).toHaveLength(0);
    });
  });
});
