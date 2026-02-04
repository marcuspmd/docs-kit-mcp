import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { GitDiffParser } from "../GitDiffParser.js";

describe("GitDiffParser", () => {
  let parser: GitDiffParser;

  beforeEach(() => {
    parser = new GitDiffParser();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("parseDiff private method behavior", () => {
    it("should parse simple file addition", async () => {
      const diffOutput = `diff --git a/test.ts b/test.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/test.ts
@@ -0,0 +1,3 @@
+export class Test {
+  constructor() {}
+}`;

      // @ts-expect-error accessing private method for testing
      const result = parser.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filePath: "test.ts",
        status: "added",
        additions: 3,
        deletions: 0,
      });
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0]).toMatchObject({
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 3,
      });
    });

    it("should parse file modification", async () => {
      const diffOutput = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 export class Test {
-  constructor() {}
+  constructor(private name: string) {}
+  getName() { return this.name; }
 }`;

      // @ts-expect-error accessing private method
      const result = parser.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filePath: "test.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
      });
    });

    it("should parse file deletion", async () => {
      const diffOutput = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index 1234567..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export class Old {
-}`;

      // @ts-expect-error accessing private method
      const result = parser.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filePath: "old.ts",
        status: "deleted",
        additions: 0,
        deletions: 2,
      });
    });

    it("should parse file rename", async () => {
      const diffOutput = `diff --git a/old.ts b/new.ts
similarity index 100%
rename from old.ts
rename to new.ts
--- a/old.ts
+++ b/new.ts`;

      // @ts-expect-error accessing private method
      const result = parser.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        filePath: "new.ts",
        oldPath: "old.ts",
        status: "renamed",
      });
    });

    it("should parse multiple files", async () => {
      const diffOutput = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,1 +1,2 @@
+// New line
 export class File1 {}
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1,1 +1,1 @@
-export class File2 {}
+export class File2Modified {}`;

      // @ts-expect-error accessing private method
      const result = parser.parseDiff(diffOutput);

      expect(result).toHaveLength(2);
      expect(result[0].filePath).toBe("file1.ts");
      expect(result[1].filePath).toBe("file2.ts");
    });

    it("should handle empty diff", async () => {
      // @ts-expect-error accessing private method
      const result = parser.parseDiff("");

      expect(result).toHaveLength(0);
    });

    it("should parse complex hunk with context", async () => {
      const diffOutput = `diff --git a/complex.ts b/complex.ts
--- a/complex.ts
+++ b/complex.ts
@@ -10,7 +10,8 @@ export class Complex {
   method1() {
     return 1;
   }
-  method2() {
-    return 2;
+  method2(arg: string) {
+    console.log(arg);
+    return 2 + arg.length;
   }
   method3() {`;

      // @ts-expect-error accessing private method
      const result = parser.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].hunks[0]).toMatchObject({
        oldStart: 10,
        oldLines: 7,
        newStart: 10,
        newLines: 8,
      });
      expect(result[0].additions).toBe(3);
      expect(result[0].deletions).toBe(2);
    });
  });
});
