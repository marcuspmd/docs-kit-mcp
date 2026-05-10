import { docEntryLabel, escapeHtml, base64Encode, formatDate, escapeCodeBlocks } from "../utils.js";

describe("site/templates/utils", () => {
  describe("docEntryLabel", () => {
    it("uses title when available", () => {
      expect(docEntryLabel({ title: "Order Service", path: "docs/orders.md" })).toBe(
        "Order Service",
      );
    });

    it("uses name when title is missing", () => {
      expect(docEntryLabel({ name: "orders", path: "docs/orders.md" })).toBe("orders");
    });

    it("derives label from path filename when neither title nor name", () => {
      expect(docEntryLabel({ path: "docs/order-service.md" })).toBe("order-service");
    });

    it("strips .md extension from path fallback", () => {
      expect(docEntryLabel({ path: "docs/README.md" })).toBe("README");
    });

    it("handles path with no slashes", () => {
      expect(docEntryLabel({ path: "readme.md" })).toBe("readme");
    });
  });

  describe("escapeHtml", () => {
    it("escapes ampersand", () => {
      expect(escapeHtml("a & b")).toBe("a &amp; b");
    });

    it("escapes less-than", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("escapes double quotes", () => {
      expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });

    it("returns plain text unchanged", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });
  });

  describe("escapeCodeBlocks", () => {
    it("delegates to escapeHtml", () => {
      expect(escapeCodeBlocks("<code>")).toBe("&lt;code&gt;");
    });
  });

  describe("base64Encode", () => {
    it("base64-encodes a string", () => {
      const encoded = base64Encode("hello");
      expect(encoded).toBe(Buffer.from("hello", "utf8").toString("base64"));
    });

    it("handles empty string", () => {
      expect(base64Encode("")).toBe("");
    });
  });

  describe("formatDate", () => {
    it("returns ISO string for a valid date", () => {
      const d = new Date("2024-01-15T12:00:00Z");
      expect(formatDate(d)).toBe("2024-01-15T12:00:00.000Z");
    });

    it("returns undefined for undefined input", () => {
      expect(formatDate(undefined)).toBeUndefined();
    });
  });
});
