import { layout } from "../layout.js";
import type { DocEntry } from "../types.js";

describe("site/templates/layout", () => {
  describe("layout", () => {
    it("returns an HTML string", () => {
      const result = layout("My Title", "index.html", "<p>body</p>");
      expect(typeof result).toBe("string");
      expect(result).toContain("My Title");
      expect(result).toContain("<p>body</p>");
    });

    it("marks current page as active in nav", () => {
      const result = layout("Files", "files.html", "body");
      expect(result).toContain("files.html");
    });

    it("uses depth prefix for nested pages", () => {
      const result = layout("Symbol", "symbol.html", "body", 1);
      expect(result).toContain("../index.html");
    });

    it("includes facets html when provided", () => {
      const result = layout("Page", "index.html", "body", 0, "<div>facets</div>");
      expect(result).toContain("<div>facets</div>");
    });

    it("renders doc entries with showOnMenu into sidebar nav", () => {
      const docEntries: DocEntry[] = [
        {
          path: "docs/orders.md",
          title: "Orders",
          name: "orders",
          module: "Modules",
          category: "domain",
          showOnMenu: true,
        } as DocEntry,
      ];
      const result = layout("Dashboard", "index.html", "body", 0, "", docEntries);
      expect(result).toContain("orders.html");
    });

    it("groups multiple doc entries by module", () => {
      const docEntries: DocEntry[] = [
        {
          path: "docs/orders.md",
          title: "Orders",
          name: "orders",
          module: "Commerce",
          category: "domain",
          showOnMenu: true,
        } as DocEntry,
        {
          path: "docs/users.md",
          title: "Users",
          name: "users",
          module: "Identity",
          category: "domain",
          showOnMenu: true,
        } as DocEntry,
      ];
      const result = layout("Dashboard", "index.html", "body", 0, "", docEntries);
      expect(result).toContain("Commerce");
      expect(result).toContain("Identity");
      expect(result).toContain("orders.html");
      expect(result).toContain("users.html");
    });

    it("skips doc entries without showOnMenu", () => {
      const docEntries: DocEntry[] = [
        {
          path: "docs/hidden.md",
          title: "Hidden",
          module: "Modules",
          category: "domain",
          showOnMenu: false,
        } as DocEntry,
      ];
      const result = layout("Dashboard", "index.html", "body", 0, "", docEntries);
      expect(result).not.toContain("hidden.html");
    });
  });
});
