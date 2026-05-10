import { jest } from "@jest/globals";
import type Parser from "tree-sitter";
import type { CodeSymbol } from "../../symbol.types.js";
import { CSharpStrategy } from "../csharpStrategy.js";

jest.mock("tree-sitter", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const makeSym = (overrides: Partial<CodeSymbol> = {}): CodeSymbol =>
  ({
    id: "sym-cs-1",
    name: "OrderService",
    kind: "class",
    file: "OrderService.cs",
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

describe("CSharpStrategy", () => {
  let strategy: CSharpStrategy;
  let addRel: jest.MockedFunction<(...args: unknown[]) => void>;
  const file = "OrderService.cs";

  beforeEach(() => {
    strategy = new CSharpStrategy();
    addRel = jest.fn();
  });

  // ── refineKind ───────────────────────────────────────────────────────────────
  describe("refineKind", () => {
    it.each([
      ["class", "OrderService", "service"],
      ["class", "UserRepository", "repository"],
      ["class", "UserRepo", "repository"],
      ["class", "UserController", "controller"],
      ["class", "OrderEvent", "event"],
      ["class", "ButtonHandler", "listener"],
      ["class", "EventListener", "listener"],
      ["class", "UserFactory", "factory"],
      ["class", "AuthMiddleware", "middleware"],
      ["class", "CreateOrderDto", "dto"],
      ["class", "LoginRequest", "dto"],
      ["class", "LoginResponse", "dto"],
      ["class", "UserViewModel", "dto"],
      ["class", "UserVm", "dto"],
      ["class", "UserEntity", "entity"],
      ["class", "ProductModel", "entity"],
      ["class", "CreateOrderCommand", "command"],
      ["class", "ListOrdersQuery", "command"],
      ["class", "Unrecognized", "class"],
      ["function", "myFunc", "function"],
    ] as const)("refineKind(%s, %s) → %s", (kind, name, expected) => {
      expect(strategy.refineKind(kind as never, name)).toBe(expected);
    });
  });

  // ── extractClassRelationships ────────────────────────────────────────────────
  describe("extractClassRelationships / _extractCSharpInheritance", () => {
    it("emits inherits edge for base class identifier", () => {
      const baseIdent = makeNode("identifier", [], {
        text: "BaseService",
      } as Partial<Parser.SyntaxNode>);
      const baseList = makeNode("base_list", [baseIdent]);
      const node = makeNode("class_declaration", [baseList]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith(
        "sym-cs-1",
        "BaseService",
        "inherits",
        file,
        1,
        undefined,
      );
    });

    it("emits inherits edge for generic_name base class", () => {
      const nameNode = makeNode("identifier", [], {
        text: "BaseRepo",
      } as Partial<Parser.SyntaxNode>);
      const genericBase = {
        type: "generic_name",
        text: "BaseRepo<Order>",
        children: [nameNode, makeNode("type_argument_list")],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "identifier" ? nameNode : null)),
        startPosition: { row: 0, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const baseList = makeNode("base_list", [genericBase]);
      const node = makeNode("class_declaration", [baseList]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "BaseRepo", "inherits", file, 1, undefined);
    });

    it("emits inherits edge for qualified_name", () => {
      const qualNode = makeNode("qualified_name", [], {
        text: "Domain.BaseService",
      } as Partial<Parser.SyntaxNode>);
      const baseList = makeNode("base_list", [qualNode]);
      const node = makeNode("class_declaration", [baseList]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith(
        "sym-cs-1",
        "Domain.BaseService",
        "inherits",
        file,
        1,
        undefined,
      );
    });

    it("skips non-identifier base_list children", () => {
      const colonNode = makeNode(":");
      const baseList = makeNode("base_list", [colonNode]);
      const node = makeNode("class_declaration", [baseList]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("does nothing when no base_list", () => {
      const node = makeNode("class_declaration", []);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips primitive base class identifier", () => {
      const baseIdent = makeNode("identifier", [], {
        text: "string",
      } as Partial<Parser.SyntaxNode>);
      const baseList = makeNode("base_list", [baseIdent]);
      const node = makeNode("class_declaration", [baseList]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });
  });

  describe("extractClassRelationships / _extractCSharpDiRelationships (constructor injection)", () => {
    it("emits uses edge for constructor parameter type (identifier)", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IPaymentRepository",
      } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter",
        text: "IPaymentRepository repo",
        children: [
          typeNode,
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
        ],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? typeNode : null)),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "public OrderService(IPaymentRepository repo) {}",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith(
        "sym-cs-1",
        "IPaymentRepository",
        "uses",
        file,
        4,
        undefined,
      );
    });

    it("emits uses edge for generic type (Lazy<T>)", () => {
      const innerType = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      const typeArgs = {
        type: "type_argument_list",
        text: "<IEmailService>",
        children: [makeNode("<"), innerType, makeNode(">")],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 0, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const lazyName = makeNode("identifier", [], { text: "Lazy" } as Partial<Parser.SyntaxNode>);
      const genericType = {
        type: "generic_name",
        text: "Lazy<IEmailService>",
        children: [lazyName, typeArgs],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "identifier" ? lazyName : null)),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const param = {
        type: "parameter",
        text: "Lazy<IEmailService> emailSvc",
        children: [genericType],
        childForFieldName: jest.fn().mockReturnValue(genericType),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      // Lazy<IEmailService> → unwraps to IEmailService
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "IEmailService", "uses", file, 4, undefined);
    });

    it("emits uses edge for IOptions<T> unwrapping", () => {
      const innerType = makeNode("identifier", [], {
        text: "AppSettings",
      } as Partial<Parser.SyntaxNode>);
      const typeArgs = {
        type: "type_argument_list",
        text: "<AppSettings>",
        children: [makeNode("<"), innerType, makeNode(">")],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 0, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const baseName = makeNode("identifier", [], {
        text: "IOptions",
      } as Partial<Parser.SyntaxNode>);
      const genericType = {
        type: "generic_name",
        text: "IOptions<AppSettings>",
        children: [baseName, typeArgs],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "identifier" ? baseName : null)),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const param = {
        type: "parameter",
        text: "IOptions<AppSettings> opts",
        children: [genericType],
        childForFieldName: jest.fn().mockReturnValue(genericType),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "AppSettings", "uses", file, 4, undefined);
    });

    it("skips primitive parameter type (predefined_type)", () => {
      const typeNode = makeNode("predefined_type", [], {
        text: "string",
      } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter",
        text: "string name",
        children: [
          typeNode,
          makeNode("identifier", [], { text: "name" } as Partial<Parser.SyntaxNode>),
        ],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips non-parameter children in parameter_list", () => {
      const paramList = makeNode("parameter_list", [makeNode("("), makeNode(")")]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor()",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles constructor with no parameter_list", () => {
      const ctor = {
        type: "constructor_declaration",
        text: "ctor()",
        children: [],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles nullable_type parameter (T?)", () => {
      const innerType = makeNode("identifier", [], {
        text: "IService",
      } as Partial<Parser.SyntaxNode>);
      const nullableType = {
        type: "nullable_type",
        text: "IService?",
        children: [innerType, makeNode("?")],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const param = {
        type: "parameter",
        text: "IService? svc",
        children: [nullableType],
        childForFieldName: jest.fn().mockReturnValue(nullableType),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "IService", "uses", file, 4, undefined);
    });

    it("handles array_type parameter (Service[])", () => {
      const elemType = makeNode("identifier", [], {
        text: "IService",
      } as Partial<Parser.SyntaxNode>);
      const arrayType = {
        type: "array_type",
        text: "IService[]",
        children: [elemType, makeNode("["), makeNode("]")],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const param = {
        type: "parameter",
        text: "IService[] services",
        children: [arrayType],
        childForFieldName: jest.fn().mockReturnValue(arrayType),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "IService", "uses", file, 4, undefined);
    });

    it("skips unknown type node in extractCSharpTypeName", () => {
      const unknownType = makeNode("some_unknown_type", [], {
        text: "Something",
      } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter",
        text: "Something x",
        children: [unknownType],
        childForFieldName: jest.fn().mockReturnValue(unknownType),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips CSHARP_PRIMITIVES identifier in constructor param", () => {
      const typeNode = makeNode("identifier", [], { text: "int" } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter",
        text: "int count",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("resolves import alias via ctx.imports", () => {
      const typeNode = makeNode("identifier", [], { text: "Repo" } as Partial<Parser.SyntaxNode>);
      const param = {
        type: "parameter",
        text: "Repo repo",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 3, column: 8 },
      } as unknown as Parser.SyntaxNode;
      const paramList = makeNode("parameter_list", [param]);
      const ctor = {
        type: "constructor_declaration",
        text: "ctor",
        children: [paramList],
        childForFieldName: jest.fn().mockReturnValue(paramList),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = makeNode("declaration_list", [ctor]);
      const node = makeNode("class_declaration", [body]);

      const ctx = { imports: new Map([["Repo", "Domain.IOrderRepository"]]) } as never;
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file, ctx);
      expect(addRel).toHaveBeenCalledWith(
        "sym-cs-1",
        "Domain.IOrderRepository",
        "uses",
        file,
        4,
        ctx,
      );
    });

    it("does nothing when class body has no declaration_list", () => {
      const node = makeNode("class_declaration", [makeNode("identifier")]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });
  });

  describe("extractClassRelationships / property injection ([Inject])", () => {
    it("emits uses edge for property with Inject attribute", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      const propDecl = {
        type: "property_declaration",
        text: "public IEmailService Email { get; set; }",
        children: [typeNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? typeNode : null)),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const attrNameNode = makeNode("identifier", [], {
        text: "Inject",
      } as Partial<Parser.SyntaxNode>);
      const attrNode = {
        type: "attribute",
        text: "[Inject]",
        children: [attrNameNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "name" ? attrNameNode : null)),
        startPosition: { row: 4, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const attrList = makeNode("attribute_list", [attrNode]);

      // body children: [attrList, propDecl]
      const body = {
        type: "declaration_list",
        text: "",
        children: [attrList, propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "IEmailService", "uses", file, 6, undefined);
    });

    it("skips property without preceding inject attribute", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      const propDecl = {
        type: "property_declaration",
        text: "public IEmailService Email { get; set; }",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      // body children: [propDecl] — no attribute_list before it
      const body = {
        type: "declaration_list",
        text: "",
        children: [propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips property when preceding sibling is not attribute_list", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      const propDecl = {
        type: "property_declaration",
        text: "public IEmailService Email { get; set; }",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const commentNode = makeNode("comment", [], {
        text: "// some comment",
      } as Partial<Parser.SyntaxNode>);
      const body = {
        type: "declaration_list",
        text: "",
        children: [commentNode, propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips property when attribute is not inject-related", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      const propDecl = {
        type: "property_declaration",
        text: "public IEmailService Email { get; set; }",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const attrNameNode = makeNode("identifier", [], {
        text: "Required",
      } as Partial<Parser.SyntaxNode>);
      const attrNode = {
        type: "attribute",
        text: "[Required]",
        children: [attrNameNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "name" ? attrNameNode : null)),
        startPosition: { row: 4, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const attrList = makeNode("attribute_list", [attrNode]);
      const body = {
        type: "declaration_list",
        text: "",
        children: [attrList, propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips property with inject attribute at index 0 (no prior sibling)", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      // The property declaration is the FIRST child — no possible preceding attribute_list
      const attrNameNode = makeNode("identifier", [], {
        text: "Inject",
      } as Partial<Parser.SyntaxNode>);
      const attrNode = {
        type: "attribute",
        text: "[Inject]",
        children: [attrNameNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "name" ? attrNameNode : null)),
        startPosition: { row: 4, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const attrList = makeNode("attribute_list", [attrNode]);
      // propDecl comes BEFORE attrList in children — so propDecl.indexOf = 0
      const propDecl = {
        type: "property_declaration",
        text: "public IEmailService Email { get; set; }",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const body = {
        type: "declaration_list",
        text: "",
        children: [propDecl, attrList],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      // propDecl is at index 0 → propIndex <= 0 → skip
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles AutoWire inject attribute name", () => {
      const typeNode = makeNode("identifier", [], {
        text: "ICacheService",
      } as Partial<Parser.SyntaxNode>);
      const propDecl = {
        type: "property_declaration",
        text: "public ICacheService Cache { get; set; }",
        children: [typeNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? typeNode : null)),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const attrNameNode = makeNode("identifier", [], {
        text: "AutoWire",
      } as Partial<Parser.SyntaxNode>);
      const attrNode = {
        type: "attribute",
        text: "[AutoWire]",
        children: [attrNameNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "name" ? attrNameNode : null)),
        startPosition: { row: 4, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const attrList = makeNode("attribute_list", [attrNode]);
      const body = {
        type: "declaration_list",
        text: "",
        children: [attrList, propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-cs-1", "ICacheService", "uses", file, 6, undefined);
    });

    it("skips property with no type node", () => {
      const propDecl = {
        type: "property_declaration",
        text: "public  Email { get; set; }",
        children: [],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const attrNameNode = makeNode("identifier", [], {
        text: "Inject",
      } as Partial<Parser.SyntaxNode>);
      const attrNode = {
        type: "attribute",
        text: "[Inject]",
        children: [attrNameNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "name" ? attrNameNode : null)),
        startPosition: { row: 4, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const attrList = makeNode("attribute_list", [attrNode]);
      const body = {
        type: "declaration_list",
        text: "",
        children: [attrList, propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips attribute with no name node (uses children[0] fallback)", () => {
      const typeNode = makeNode("identifier", [], {
        text: "IEmailService",
      } as Partial<Parser.SyntaxNode>);
      const propDecl = {
        type: "property_declaration",
        text: "public IEmailService Email { get; set; }",
        children: [typeNode],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      // Attribute with no childForFieldName("name") - uses first child text
      const attrFirstChild = makeNode("identifier", [], {
        text: "NotInject",
      } as Partial<Parser.SyntaxNode>);
      const attrNode = {
        type: "attribute",
        text: "[NotInject]",
        children: [attrFirstChild],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 4, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const attrList = makeNode("attribute_list", [attrNode]);
      const body = {
        type: "declaration_list",
        text: "",
        children: [attrList, propDecl],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 1, column: 0 },
      } as unknown as Parser.SyntaxNode;
      const node = makeNode("class_declaration", [body]);

      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });
  });
});
