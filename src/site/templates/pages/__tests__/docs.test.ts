import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { DocEntry } from "../../types.js";

const mockLayout = jest.fn();
const mockGetMermaid = jest.fn();
const mockEscapeHtml = jest.fn((s: string) => `[escaped]${s}`);
const mockDocEntryLabel = jest.fn((e: DocEntry) => `[label]${e.title || e.name || e.path}`);

jest.unstable_mockModule("../../layout.js", () => ({
  layout: mockLayout,
}));

jest.unstable_mockModule("../../mermaid.js", () => ({
  getMermaidExpandModalAndScript: mockGetMermaid,
}));

jest.unstable_mockModule("../../utils.js", () => ({
  escapeHtml: mockEscapeHtml,
  docEntryLabel: mockDocEntryLabel,
}));

describe("docs page templates", () => {
  let renderMarkdownWrapper: typeof import("../docs.js").renderMarkdownWrapper;
  let renderDocsPage: typeof import("../docs.js").renderDocsPage;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLayout.mockImplementation((title, path, body) => `LAYOUT[${title}:${body}]`);
    mockGetMermaid.mockReturnValue("MERMAID_SCRIPT");
    
    const mod = await import("../docs.js");
    renderMarkdownWrapper = mod.renderMarkdownWrapper;
    renderDocsPage = mod.renderDocsPage;
  });

  describe("renderMarkdownWrapper", () => {
    it("should render markdown content wrapper", () => {
      const result = renderMarkdownWrapper("My Title", "doc.md", "doc.md", [], "# Hello");
      expect(result).toContain("LAYOUT[My Title:");
      expect(result).toContain("MERMAID_SCRIPT");
      expect(result).toContain("marked.parse");
    });

    it("should handle loading state when no content provided", () => {
      const result = renderMarkdownWrapper("My Title", "doc.md", "doc.md", []);
      expect(result).toContain("Loading document...");
      expect(result).toContain("fetch('./[escaped]doc.md')");
    });

    it("should generate navigation links", () => {
        const entries: DocEntry[] = [
            { path: "prev.md", category: "test" },
            { path: "curr.md", category: "test", prev: "prev.md", next: "next.md" },
            { path: "next.md", category: "test" }
        ];
        
        renderMarkdownWrapper("Current", "curr.md", "curr.md", entries, "content");
        
        // Check if layout was called with body containing navigation
        const body = mockLayout.mock.calls[0][2] as string;
        expect(body).toContain("href=\"prev.html\"");
        expect(body).toContain("href=\"next.html\"");
    });
  });

  describe("renderDocsPage", () => {
    it("should render empty state if no docs", () => {
      renderDocsPage([]);
      const body = mockLayout.mock.calls[0][2] as string;
      expect(body).toContain("No documentation entries found");
    });

    it("should group docs by category", () => {
        const entries: DocEntry[] = [
            { path: "doc1.md", category: "Cat A", title: "Doc 1" },
            { path: "doc2.md", category: "Cat B", title: "Doc 2" },
            { path: "doc3.md", category: "Cat A", title: "Doc 3" }
        ];

        renderDocsPage(entries);
        const body = mockLayout.mock.calls[0][2] as string;
        expect(body).toContain("[escaped]Cat A");
        expect(body).toContain("[escaped]Cat B");
        expect(body).toContain("[label]Doc 1");
        expect(body).toContain("[label]Doc 2");
        expect(body).toContain("[label]Doc 3");
    });

    it("should show module badges", () => {
        const entries: DocEntry[] = [
            { path: "doc1.md", category: "Cat A", module: "Module X" }
        ];

        renderDocsPage(entries);
        const body = mockLayout.mock.calls[0][2] as string;
        expect(body).toContain("module: [escaped]Module X");
    });
    
    it("should show 'By module' section if modules exist", () => {
        const entries: DocEntry[] = [
            { path: "doc1.md", category: "Cat A", module: "Module X" }
        ];

        renderDocsPage(entries);
        const body = mockLayout.mock.calls[0][2] as string;
        expect(body).toContain("By module");
        expect(body).toContain("[escaped]Module X");
    });
  });
});
