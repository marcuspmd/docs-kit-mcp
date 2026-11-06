import { jest } from "@jest/globals";
import type Parser from "tree-sitter";
import type { CodeSymbol } from "../../symbol.types.js";
import { PythonStrategy } from "../pythonStrategy.js";

jest.mock("tree-sitter", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const makeSym = (overrides: Partial<CodeSymbol> = {}): CodeSymbol =>
  ({
    id: "sym-py-1",
    name: "OrderService",
    kind: "class",
    file: "service.py",
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

describe("PythonStrategy", () => {
  let strategy: PythonStrategy;
  let addRel: jest.MockedFunction<(...args: unknown[]) => void>;
  const file = "service.py";

  beforeEach(() => {
    strategy = new PythonStrategy();
    addRel = jest.fn();
  });

  // ── refineKind ───────────────────────────────────────────────────────────────
  describe("refineKind", () => {
    it.each([
      ["class", "OrderService", "service"],
      ["class", "UserRepository", "repository"],
      ["class", "UserRepo", "repository"],
      ["class", "UserController", "controller"],
      ["class", "UserView", "controller"],
      ["class", "OrderEvent", "event"],
      ["class", "MessageListener", "listener"],
      ["class", "ButtonHandler", "listener"],
      ["class", "EventSubscriber", "listener"],
      ["class", "UserFactory", "factory"],
      ["class", "AuthMiddleware", "middleware"],
      ["class", "CreateOrderDto", "dto"],
      ["class", "UserSchema", "dto"],
      ["class", "UserSerializer", "dto"],
      ["class", "UserEntity", "entity"],
      ["class", "ProductModel", "entity"],
      ["class", "CreateOrderCommand", "command"],
      ["class", "CheckoutUsecase", "command"],
      ["class", "PlaceOrder_use_case", "command"],
      ["class", "Unrecognized", "class"],
      ["function", "myFunc", "function"],
    ] as const)("refineKind(%s, %s) → %s", (kind, name, expected) => {
      expect(strategy.refineKind(kind as never, name)).toBe(expected);
    });
  });

  // ── extractClassRelationships / _extractPythonDiRelationships ────────────────
  describe("extractClassRelationships", () => {
    it("does nothing when class has no body block", () => {
      const node = makeNode("class_definition", []);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("emits uses edge for constructor typed_parameter", () => {
      // Build: class OrderService: def __init__(self, repo: PaymentRepository)
      const repoTypeNode = makeNode("identifier", [], {
        text: "PaymentRepository",
      } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "repo: PaymentRepository",
        children: [
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          repoTypeNode,
        ],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? repoTypeNode : null)),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const selfParam = makeNode("identifier", [], { text: "self" } as Partial<Parser.SyntaxNode>);

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [selfParam, typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(self, repo: PaymentRepository)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith(
        "sym-py-1",
        "PaymentRepository",
        "uses",
        file,
        4,
        undefined,
      );
    });

    it("skips typed_parameter for primitive types", () => {
      const intTypeNode = makeNode("identifier", [], { text: "int" } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "count: int",
        children: [
          makeNode("identifier", [], { text: "count" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          intTypeNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(intTypeNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(self, count: int)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips typed_default_parameter for self/cls", () => {
      const selfTypeNode = makeNode("identifier", [], {
        text: "self",
      } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_default_parameter",
        text: "self: Self",
        children: [
          selfTypeNode,
          makeNode(":"),
          makeNode("identifier", [], { text: "Self" } as Partial<Parser.SyntaxNode>),
        ],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? selfTypeNode : null)),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(self: Self)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips non-typed_parameter params in __init__", () => {
      const selfParam = makeNode("identifier", [], { text: "self" } as Partial<Parser.SyntaxNode>);
      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [selfParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(self)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles __init__ with parameters found via children fallback", () => {
      // When childForFieldName("parameters") returns null, code falls back to
      // member.children.find(c => c.type === "parameters")
      const repoTypeNode = makeNode("type_identifier", [], {
        text: "UserRepository",
      } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "repo: UserRepository",
        children: [
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          repoTypeNode,
        ],
        // childForFieldName returns the type node directly
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? repoTypeNode : null)),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(repo: UserRepository)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          // parameters NOT found by childForFieldName → falls back to children
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      // repoTypeNode.type = "type_identifier" → not matched by annotationToTypeName,
      // but the fallback path is exercised (params found via children.find)
      // The important thing is no exception is thrown
      expect(addRel).not.toHaveBeenCalled();
    });

    it("skips non-__init__ methods", () => {
      const repoTypeNode = makeNode("identifier", [], {
        text: "UserRepository",
      } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "repo: UserRepository",
        children: [
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          repoTypeNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(repoTypeNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], { text: "setup" } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const method = {
        type: "function_definition",
        text: "def setup(repo: UserRepository)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [method]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("emits uses edge for annotated_assignment class variable", () => {
      const typeNode = makeNode("identifier", [], {
        text: "EmailService",
      } as Partial<Parser.SyntaxNode>);
      const annAssign = {
        type: "annotated_assignment",
        text: "repo: EmailService",
        children: [makeNode("identifier"), makeNode(":"), typeNode],
        childForFieldName: jest
          .fn()
          .mockImplementation((field: string) => (field === "type" ? typeNode : null)),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const exprStmt = {
        type: "expression_statement",
        text: "repo: EmailService",
        children: [annAssign],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [exprStmt]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-py-1", "EmailService", "uses", file, 6, undefined);
    });

    it("skips bare assignment in expression_statement", () => {
      const assignment = {
        type: "assignment",
        text: "x = 1",
        children: [],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const exprStmt = {
        type: "expression_statement",
        text: "x = 1",
        children: [assignment],
        childForFieldName: jest.fn().mockReturnValue(null),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [exprStmt]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles Optional[T] subscript annotation", () => {
      // In tree-sitter-python, Optional[T] has subscript field = the type identifier directly
      const innerType = makeNode("identifier", [], {
        text: "PaymentRepository",
      } as Partial<Parser.SyntaxNode>);
      const optionalBase = makeNode("identifier", [], {
        text: "Optional",
      } as Partial<Parser.SyntaxNode>);
      const subscriptNode = {
        type: "subscript",
        text: "Optional[PaymentRepository]",
        children: [optionalBase, makeNode("["), innerType, makeNode("]")],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "value") return optionalBase;
          if (field === "subscript") return innerType; // subscript IS the identifier
          return null;
        }),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const typedParam = {
        type: "typed_parameter",
        text: "repo: Optional[PaymentRepository]",
        children: [
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          subscriptNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(subscriptNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(repo: Optional[PaymentRepository])",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith(
        "sym-py-1",
        "PaymentRepository",
        "uses",
        file,
        4,
        undefined,
      );
    });

    it("handles Union[T1, T2] subscript annotation — uses first non-primitive", () => {
      const t1 = makeNode("identifier", [], { text: "int" } as Partial<Parser.SyntaxNode>);
      const t2 = makeNode("identifier", [], { text: "EmailService" } as Partial<Parser.SyntaxNode>);
      const tupleNode = makeNode("tuple", [t1, makeNode(","), t2]);
      const unionBase = makeNode("identifier", [], { text: "Union" } as Partial<Parser.SyntaxNode>);
      const subscriptNode = {
        type: "subscript",
        text: "Union[int, EmailService]",
        children: [unionBase, makeNode("["), tupleNode, makeNode("]")],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "value") return unionBase;
          if (field === "subscript") return tupleNode;
          return null;
        }),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const typedParam = {
        type: "typed_parameter",
        text: "dep: Union[int, EmailService]",
        children: [
          makeNode("identifier", [], { text: "dep" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          subscriptNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(subscriptNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(dep: Union[int, EmailService])",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-py-1", "EmailService", "uses", file, 4, undefined);
    });

    it("handles attribute annotation (module.ClassName)", () => {
      const attrNode = makeNode("attribute", [], {
        text: "services.PaymentRepository",
      } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "repo: services.PaymentRepository",
        children: [
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          attrNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(attrNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(repo: services.PaymentRepository)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith(
        "sym-py-1",
        "services.PaymentRepository",
        "uses",
        file,
        4,
        undefined,
      );
    });

    it("handles binary_operator union type annotation (Python 3.10+)", () => {
      const leftType = makeNode("identifier", [], { text: "int" } as Partial<Parser.SyntaxNode>);
      const rightType = makeNode("identifier", [], {
        text: "EmailService",
      } as Partial<Parser.SyntaxNode>);
      const binOp = {
        type: "binary_operator",
        text: "int | EmailService",
        children: [leftType, makeNode("|"), rightType],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "left") return leftType;
          if (field === "right") return rightType;
          return null;
        }),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const typedParam = {
        type: "typed_parameter",
        text: "dep: int | EmailService",
        children: [
          makeNode("identifier", [], { text: "dep" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          binOp,
        ],
        childForFieldName: jest.fn().mockReturnValue(binOp),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(dep: int | EmailService)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).toHaveBeenCalledWith("sym-py-1", "EmailService", "uses", file, 4, undefined);
    });

    it("resolves imports from ctx.imports", () => {
      const typeNode = makeNode("identifier", [], { text: "Repo" } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "repo: Repo",
        children: [
          makeNode("identifier", [], { text: "repo" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          typeNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(typeNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(repo: Repo)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      const ctx = { imports: new Map([["Repo", "myapp.repos.OrderRepository"]]) } as never;
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file, ctx);
      expect(addRel).toHaveBeenCalledWith(
        "sym-py-1",
        "myapp.repos.OrderRepository",
        "uses",
        file,
        4,
        ctx,
      );
    });

    it("skips unknown annotation type", () => {
      const unknownTypeNode = makeNode("some_unknown_type", [], {
        text: "Something",
      } as Partial<Parser.SyntaxNode>);
      const typedParam = {
        type: "typed_parameter",
        text: "x: Something",
        children: [
          makeNode("identifier", [], { text: "x" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          unknownTypeNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(unknownTypeNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(x: Something)",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      expect(addRel).not.toHaveBeenCalled();
    });

    it("handles typing.Optional prefix in subscript", () => {
      const innerType = makeNode("identifier", [], {
        text: "UserService",
      } as Partial<Parser.SyntaxNode>);
      const sliceNode = makeNode("identifier", [innerType], {
        text: "UserService",
      } as Partial<Parser.SyntaxNode>);
      const optionalBase = makeNode("attribute", [], {
        text: "typing.Optional",
      } as Partial<Parser.SyntaxNode>);
      const subscriptNode = {
        type: "subscript",
        text: "typing.Optional[UserService]",
        children: [optionalBase, makeNode("["), sliceNode, makeNode("]")],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "value") return optionalBase;
          if (field === "subscript") return sliceNode;
          return null;
        }),
        startPosition: { row: 5, column: 4 },
      } as unknown as Parser.SyntaxNode;
      const typedParam = {
        type: "typed_parameter",
        text: "svc: typing.Optional[UserService]",
        children: [
          makeNode("identifier", [], { text: "svc" } as Partial<Parser.SyntaxNode>),
          makeNode(":"),
          subscriptNode,
        ],
        childForFieldName: jest.fn().mockReturnValue(subscriptNode),
        startPosition: { row: 3, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const nameNode = makeNode("identifier", [], {
        text: "__init__",
      } as Partial<Parser.SyntaxNode>);
      const params = makeNode("parameters", [typedParam]);
      const initMethod = {
        type: "function_definition",
        text: "def __init__(svc: typing.Optional[UserService])",
        children: [params],
        childForFieldName: jest.fn().mockImplementation((field: string) => {
          if (field === "name") return nameNode;
          if (field === "parameters") return params;
          return null;
        }),
        startPosition: { row: 2, column: 4 },
      } as unknown as Parser.SyntaxNode;

      const body = makeNode("block", [initMethod]);
      const node = makeNode("class_definition", [body]);
      strategy.extractClassRelationships(node, makeSym(), addRel as never, file);
      // typing.Optional[UserService] → resolves UserService
      expect(addRel).toHaveBeenCalledWith("sym-py-1", "UserService", "uses", file, 4, undefined);
    });
  });
});
