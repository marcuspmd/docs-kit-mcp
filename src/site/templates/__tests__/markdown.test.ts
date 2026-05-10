import { renderMarkdown } from "../markdown.js";

describe("site/templates/markdown", () => {
  describe("renderMarkdown", () => {
    it("renders heading to HTML", async () => {
      const result = renderMarkdown("# Hello");
      expect(result).toContain("<h1");
      expect(result).toContain("Hello");
    });

    it("renders paragraph", async () => {
      const result = renderMarkdown("some text");
      expect(result).toContain("<p");
      expect(result).toContain("some text");
    });

    it("returns empty string for null", () => {
      expect(renderMarkdown(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(renderMarkdown(undefined)).toBe("");
    });

    it("returns empty string for whitespace-only string", () => {
      expect(renderMarkdown("   ")).toBe("");
    });

    it("renders inline code", () => {
      const result = renderMarkdown("Use `npm install`");
      expect(result).toContain("<code>");
      expect(result).toContain("npm install");
    });
  });
});
