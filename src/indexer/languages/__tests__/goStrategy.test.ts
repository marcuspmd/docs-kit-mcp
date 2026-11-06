import { jest } from "@jest/globals";
import type Parser from "tree-sitter";
import type { CodeSymbol } from "../../symbol.types.js";
import { GoStrategy } from "../goStrategy.js";

jest.mock("tree-sitter", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const makeSym = (overrides: Partial<CodeSymbol> = {}): CodeSymbol =>
  ({
    id: "sym-1",
    name: "OrderHandler",
    kind: "class",
    file: "handler.go",
    line: 1,
    ...overrides,
  }) as unknown as CodeSymbol;

const makeNode = (
  type: string,
  children: Partial<Parser.SyntaxNode>[] = [],
  overrides: Partial<Parser.SyntaxNode> = {},
): Parser.SyntaxNode =>
  ({
    type,
    text: type,
    children: children as Parser.SyntaxNode[],
    childForFieldName: jest.fn().mockReturnValue(null),
    startPosition: { row: 0, column: 0 },
    ...overrides,
  }) as unknown as Parser.SyntaxNode;

describe("GoStrategy", () => {
  let strategy: GoStrategy;
  let addRel: jest.MockedFunction<(...args: unknown[]) => void>;
  const file = "service.go";

  beforeEach(() => {
    strategy = new GoStrategy();
    addRel = jest.fn();
  });

  // ── refineKind ───────────────────────────────────────────────────────────────
  describe("refineKind", () => {
    it.each([
      ["class", "OrderService", "service"],
      ["class", "UserRepository", "repository"],
      ["class", "UserRepo", "repository"],
      ["class", "DataStore", "repository"],
      ["class", "HttpHandler", "controller"],
      ["class", "UserController", "controller"],
      ["class", "OrderEvent", "event"],
      ["class", "MessageListener", "listener"],
      ["class", "EventSubscriber", "listener"],
      ["class", "WidgetFactory", "factory"],
      ["class", "AuthMiddleware", "middleware"],
      ["class", "CreateOrderDto", "dto"],
      ["class", "LoginRequest", "dto"],
      ["class", "LoginResponse", "dto"],
      ["class", "UserEntity", "entity"],
      ["class", "ProductModel", "entity"],
      ["class", "CreateOrderCommand", "command"],
      ["class", "ListOrdersQuery", "command"],
      ["class", "Unrecognized", "class"],
      ["function", "Anything", "function"],
    ] as const)("refineKind(%s, %s) → %s", (kind, name, expected) => {
      expect(strategy.refineKind(kind as never, name)).toBe(expected);
    });
  });

  // ── extractClassRelationships ────────────────────────────────────────────────
  describe("extractClassRelationships", () => {
    it("returns early for non-type_declaration/type_spec nodes", () => {
      const node = makeNode("function_declaration");
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("returns early when no struct_type found", () => {
      const node = makeNode("type_declaration", [
        makeNode("type_spec", [makeNode("interface_type")]),
      ]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("accepts type_spec node directly", () => {
      // type_spec with struct_type but no field_declaration_list
      const structType = makeNode("struct_type", []);
      const node = makeNode("type_spec", [structType]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips non-field_declaration children in field_declaration_list", () => {
      const fieldList = makeNode("field_declaration_list", [makeNode("{"), makeNode("}")]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips fields with no type node", () => {
      const field = {
        ...makeNode("field_declaration", []),
        childForFieldName: jest.fn().mockReturnValue(null),
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("emits uses edge for exported field in non-fx.In struct", () => {
      const typeIdNode = makeNode("type_identifier", [], {
        text: "PaymentRepository",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Repo",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Repo PaymentRepository",
        children: [fieldNameNode, typeIdNode],
        childForFieldName: jest.fn().mockReturnValue(typeIdNode),
        startPosition: { row: 5, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "PaymentRepository", "uses", file, 6, undefined);
    });

    it("skips unexported field (lowercase) in non-fx.In struct", () => {
      const typeIdNode = makeNode("type_identifier", [], {
        text: "PaymentRepository",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "repo",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "repo PaymentRepository",
        children: [fieldNameNode, typeIdNode],
        childForFieldName: jest.fn().mockReturnValue(typeIdNode),
        startPosition: { row: 5, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("emits uses edge for all typed fields in fx.In struct", () => {
      // Create an fx.In embedded field marker
      const fxInField = {
        type: "field_declaration",
        text: "fx.In",
        children: [],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;

      const typeIdNode = makeNode("type_identifier", [], {
        text: "EmailService",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "email",
      } as Partial<Parser.SyntaxNode>);
      const depField = {
        type: "field_declaration",
        text: "email EmailService",
        children: [fieldNameNode, typeIdNode],
        childForFieldName: jest.fn().mockReturnValue(typeIdNode),
        startPosition: { row: 2, column: 0 },
      } as unknown as Parser.SyntaxNode;

      const fieldList = makeNode("field_declaration_list", [fxInField, depField]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "EmailService", "uses", file, 3, undefined);
    });

    it("skips fx.In and dig.In embedded fields", () => {
      const fxInField = {
        type: "field_declaration",
        text: "fx.In",
        children: [],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      // Provide a typeIdNode that returns "fx.In" so the name check triggers
      const fxTypeNode = makeNode("type_identifier", [], {
        text: "fx.In",
      } as Partial<Parser.SyntaxNode>);
      const fxField = {
        type: "field_declaration",
        text: "fx.In",
        children: [fxTypeNode],
        childForFieldName: jest.fn().mockReturnValue(fxTypeNode),
        startPosition: { row: 0, column: 0 },
      } as unknown as Parser.SyntaxNode;

      const fieldList = makeNode("field_declaration_list", [fxInField, fxField]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles pointer_type fields by unwrapping", () => {
      const innerType = makeNode("type_identifier", [], {
        text: "UserService",
      } as Partial<Parser.SyntaxNode>);
      const ptrType = {
        type: "pointer_type",
        text: "*UserService",
        children: [makeNode("*"), innerType],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 3, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Svc",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Svc *UserService",
        children: [fieldNameNode, ptrType],
        childForFieldName: jest.fn().mockReturnValue(ptrType),
        startPosition: { row: 3, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "UserService", "uses", file, 4, undefined);
    });

    it("skips primitive types", () => {
      const typeIdNode = makeNode("type_identifier", [], {
        text: "string",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Name",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Name string",
        children: [fieldNameNode, typeIdNode],
        childForFieldName: jest.fn().mockReturnValue(typeIdNode),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("resolves qualified_type to full text", () => {
      const qualType = makeNode("qualified_type", [], {
        text: "orders.Repository",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Repo",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Repo orders.Repository",
        children: [fieldNameNode, qualType],
        childForFieldName: jest.fn().mockReturnValue(qualType),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "orders.Repository", "uses", file, 2, undefined);
    });

    it("handles slice_type and array_type (unwraps element)", () => {
      const elemType = makeNode("type_identifier", [], {
        text: "OrderItem",
      } as Partial<Parser.SyntaxNode>);
      const sliceType = {
        type: "slice_type",
        text: "[]OrderItem",
        children: [makeNode("["), makeNode("]"), elemType],
        childForFieldName: jest.fn().mockReturnValue(elemType),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Items",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Items []OrderItem",
        children: [fieldNameNode, sliceType],
        childForFieldName: jest.fn().mockReturnValue(sliceType),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "OrderItem", "uses", file, 2, undefined);
    });

    it("skips map_type, interface_type, channel_type", () => {
      for (const typeName of ["map_type", "interface_type", "channel_type"]) {
        const typeNode = makeNode(typeName, [], {
          text: `${typeName}Val`,
        } as Partial<Parser.SyntaxNode>);
        const fieldNameNode = makeNode("field_identifier", [], {
          text: "Dep",
        } as Partial<Parser.SyntaxNode>);
        const field = {
          type: "field_declaration",
          text: `Dep ${typeName}Val`,
          children: [fieldNameNode, typeNode],
          childForFieldName: jest.fn().mockReturnValue(typeNode),
          startPosition: { row: 1, column: 0 },
        } as unknown as Parser.SyntaxNode;
        const fieldList = makeNode("field_declaration_list", [field]);
        const structType = makeNode("struct_type", [fieldList]);
        const node = makeNode("type_declaration", [structType]);
        (addRel as jest.MockedFunction<(...args: unknown[]) => void>).mockClear();
        strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
        expect(addRel).not.toHaveBeenCalled();
      }
    });

    it("handles generic_type by extracting base name", () => {
      const baseName = makeNode("type_identifier", [], {
        text: "Repository",
      } as Partial<Parser.SyntaxNode>);
      const genericType = {
        type: "generic_type",
        text: "Repository[Order]",
        children: [baseName, makeNode("type_arguments")],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Repo",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Repo Repository[Order]",
        children: [fieldNameNode, genericType],
        childForFieldName: jest.fn().mockReturnValue(genericType),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "Repository", "uses", file, 2, undefined);
    });

    it("resolves import alias via ctx.imports", () => {
      const typeIdNode = makeNode("type_identifier", [], {
        text: "Repo",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Repository",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Repository Repo",
        children: [fieldNameNode, typeIdNode],
        childForFieldName: jest.fn().mockReturnValue(typeIdNode),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      const ctx = { imports: new Map([["Repo", "github.com/app/repos.OrderRepository"]]) } as never;
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file, ctx);
      expect(addRel).toHaveBeenCalledWith(
        "sym-1",
        "github.com/app/repos.OrderRepository",
        "uses",
        file,
        2,
        ctx,
      );
    });

    it("uses getFieldTypeNode fallback when childForFieldName returns null", () => {
      const typeIdNode = makeNode("type_identifier", [], {
        text: "OrderService",
      } as Partial<Parser.SyntaxNode>);
      const fieldNameNode = makeNode("field_identifier", [], {
        text: "Svc",
      } as Partial<Parser.SyntaxNode>);
      const field = {
        type: "field_declaration",
        text: "Svc OrderService",
        children: [fieldNameNode, typeIdNode],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 2, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const fieldList = makeNode("field_declaration_list", [field]);
      const structType = makeNode("struct_type", [fieldList]);
      const node = makeNode("type_declaration", [structType]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-1", "OrderService", "uses", file, 3, undefined);
    });
  });

  // ── extractProviderFunctionRelationships ─────────────────────────────────────
  describe("extractProviderFunctionRelationships", () => {
    it("returns early for non-function_declaration node", () => {
      const node = makeNode("method_declaration");
      strategy.extractProviderFunctionRelationships(node, [], addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("returns early when function name does not match New/Provide pattern", () => {
      const nameNode = makeNode("identifier", [], {
        text: "createService",
      } as Partial<Parser.SyntaxNode>);
      const node = {
        ...makeNode("function_declaration"),
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          return null;
        }),
      } as unknown as Parser.SyntaxNode;
      strategy.extractProviderFunctionRelationships(node, [], addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("returns early when no return type found", () => {
      const nameNode = makeNode("identifier", [], {
        text: "NewOrderService",
      } as Partial<Parser.SyntaxNode>);
      const node = {
        ...makeNode("function_declaration", []),
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "result") return null;
          return null;
        }),
      } as unknown as Parser.SyntaxNode;
      strategy.extractProviderFunctionRelationships(node, [], addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("returns early when returned symbol not found in symsInFile", () => {
      const nameNode = makeNode("identifier", [], {
        text: "NewOrderService",
      } as Partial<Parser.SyntaxNode>);
      const returnTypeNode = makeNode("type_identifier", [], {
        text: "OrderService",
      } as Partial<Parser.SyntaxNode>);
      const node = {
        ...makeNode("function_declaration", []),
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "result") return returnTypeNode;
          return null;
        }),
      } as unknown as Parser.SyntaxNode;
      strategy.extractProviderFunctionRelationships(node, [], addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("emits uses edges for each parameter type of a provider function", () => {
      const nameNode = makeNode("identifier", [], {
        text: "NewOrderService",
      } as Partial<Parser.SyntaxNode>);
      const returnTypeNode = makeNode("type_identifier", [], {
        text: "OrderService",
      } as Partial<Parser.SyntaxNode>);

      const paramTypeNode = makeNode("type_identifier", [], {
        text: "PaymentRepo",
      } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter_declaration",
        text: "repo PaymentRepo",
        children: [paramTypeNode],
        childForFieldName: jest.fn().mockReturnValue(paramTypeNode),
        startPosition: { row: 2, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);

      const returnedSym = makeSym({ name: "OrderService", id: "sym-os" });
      const node = {
        type: "function_declaration",
        text: "func NewOrderService(repo PaymentRepo) *OrderService",
        children: [returnTypeNode],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "result") return returnTypeNode;
          if (field === "parameters") return paramList;
          return null;
        }),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;

      strategy.extractProviderFunctionRelationships(node, [returnedSym], addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-os", "PaymentRepo", "uses", file, 3, undefined);
    });

    it("skips parameter with no type node", () => {
      const nameNode = makeNode("identifier", [], {
        text: "NewOrderService",
      } as Partial<Parser.SyntaxNode>);
      const returnTypeNode = makeNode("type_identifier", [], {
        text: "OrderService",
      } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter_declaration",
        text: "",
        children: [],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 2, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const returnedSym = makeSym({ name: "OrderService", id: "sym-os" });
      const node = {
        type: "function_declaration",
        text: "",
        children: [returnTypeNode],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "result") return returnTypeNode;
          if (field === "parameters") return paramList;
          return null;
        }),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;

      strategy.extractProviderFunctionRelationships(node, [returnedSym], addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips non-parameter_declaration children in paramList", () => {
      const nameNode = makeNode("identifier", [], {
        text: "NewOrderService",
      } as Partial<Parser.SyntaxNode>);
      const returnTypeNode = makeNode("type_identifier", [], {
        text: "OrderService",
      } as Partial<Parser.SyntaxNode>);
      const paramList = makeNode("parameter_list", [makeNode("("), makeNode(")")]);
      const returnedSym = makeSym({ name: "OrderService", id: "sym-os" });
      const node = {
        type: "function_declaration",
        text: "",
        children: [returnTypeNode],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "result") return returnTypeNode;
          if (field === "parameters") return paramList;
          return null;
        }),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;

      strategy.extractProviderFunctionRelationships(node, [returnedSym], addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });
  });
});
