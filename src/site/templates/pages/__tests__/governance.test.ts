import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { CodeSymbol } from "../../../indexer/symbol.types.js";
import type { ArchViolationRow, ReaperFindingRow } from "../types.js";

const mockLayout = jest.fn();
const mockEscapeHtml = jest.fn((s: string) => `[escaped]${s}`);

jest.unstable_mockModule("../../layout.js", () => ({
  layout: mockLayout,
}));

jest.unstable_mockModule("../../utils.js", () => ({
  escapeHtml: mockEscapeHtml,
}));

describe("governance page templates", () => {
  let renderGovernancePage: typeof import("../governance.js").renderGovernancePage;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLayout.mockImplementation((title, path, body) => `LAYOUT[${title}:${body}]`);
    
    const mod = await import("../governance.js");
    renderGovernancePage = mod.renderGovernancePage;
  });

  it("should render empty state", () => {
    const result = renderGovernancePage([], [], []);
    expect(result).toContain("No architecture violations");
    expect(result).toContain("No Reaper findings");
  });

  it("should render architecture violations", () => {
    const violations: ArchViolationRow[] = [
      {
        rule: "Rule1",
        file: "src/file.ts",
        severity: "error",
        message: "Violation message",
        symbol_id: "sym1",
      },
      {
        rule: "Rule2",
        file: "src/other.ts",
        severity: "warning",
        message: "Warning message",
        symbol_id: null,
      },
    ];

    const symbols: CodeSymbol[] = [
      { id: "sym1", name: "Symbol1", kind: "class", file: "src/file.ts", startLine: 1, endLine: 10 },
    ];

    renderGovernancePage(violations, [], symbols);
    const body = mockLayout.mock.calls[0][2] as string;

    expect(body).toContain("[escaped]Rule1");
    expect(body).toContain("[escaped]src/file.ts");
    expect(body).toContain("symbols/sym1.html");
    expect(body).toContain("[escaped]Symbol1");
    expect(body).toContain("bg-red-100"); // Error styling

    expect(body).toContain("[escaped]Rule2");
    expect(body).toContain("bg-yellow-100"); // Warning styling
    expect(body).toContain("-"); // No symbol
  });

  it("should render violation with symbol ID but no symbol details", () => {
    const violations: ArchViolationRow[] = [
      {
        rule: "Rule3",
        file: "src/unknown.ts",
        severity: "error",
        message: "Unknown symbol",
        symbol_id: "unknown_sym",
      },
    ];

    renderGovernancePage(violations, [], []); // Empty symbols list
    const body = mockLayout.mock.calls[0][2] as string;

    expect(body).toContain("[escaped]unknown_sym");
    expect(body).not.toContain("symbols/unknown_sym.html");
  });

  it("should render reaper findings", () => {
    const findings: ReaperFindingRow[] = [
      {
        type: "dead-code",
        target: "sym1",
        suggested_action: "delete",
        reason: "unused",
      },
      {
        type: "orphan-doc",
        target: "docs/orphan.md",
        suggested_action: "link",
        reason: "no code",
      },
    ];

    const symbols: CodeSymbol[] = [
      { id: "sym1", name: "Symbol1", kind: "class", file: "src/file.ts", startLine: 1, endLine: 10 },
    ];

    renderGovernancePage([], findings, symbols);
    const body = mockLayout.mock.calls[0][2] as string;

    expect(body).toContain("[escaped]dead-code");
    expect(body).toContain("symbols/sym1.html");
    expect(body).toContain("[escaped]Symbol1");
    expect(body).toContain("[escaped]delete");

    expect(body).toContain("[escaped]orphan-doc");
    expect(body).toContain("[escaped]docs/orphan.md");
  });
});
