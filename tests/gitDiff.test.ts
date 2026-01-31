import { parseGitDiff } from "../src/analyzer/gitDiff.js";

describe("parseGitDiff", () => {
  it("returns empty array for empty input", () => {
    expect(parseGitDiff("")).toEqual([]);
    expect(parseGitDiff("  \n  ")).toEqual([]);
  });

  it("parses a modified file with one hunk", () => {
    const raw = `diff --git a/src/user.ts b/src/user.ts
index abc..def 100644
--- a/src/user.ts
+++ b/src/user.ts
@@ -10,4 +10,6 @@ class User {
   getName() {
     return this.name;
   }
+  getEmail() {
+    return this.email;
+  }
 }`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("modified");
    expect(diffs[0].oldPath).toBe("src/user.ts");
    expect(diffs[0].newPath).toBe("src/user.ts");
    expect(diffs[0].hunks).toHaveLength(1);
    expect(diffs[0].hunks[0].oldStart).toBe(10);
    expect(diffs[0].hunks[0].oldLines).toBe(4);
    expect(diffs[0].hunks[0].newStart).toBe(10);
    expect(diffs[0].hunks[0].newLines).toBe(6);
  });

  it("parses an added file", () => {
    const raw = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return "world";
+}`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("added");
    expect(diffs[0].hunks[0].oldStart).toBe(0);
    expect(diffs[0].hunks[0].oldLines).toBe(0);
    expect(diffs[0].hunks[0].newStart).toBe(1);
    expect(diffs[0].hunks[0].newLines).toBe(3);
  });

  it("parses a deleted file", () => {
    const raw = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-export function old() {
-  return "gone";
-}
-
-export const x = 1;`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("deleted");
    expect(diffs[0].hunks[0].oldStart).toBe(1);
    expect(diffs[0].hunks[0].oldLines).toBe(5);
    expect(diffs[0].hunks[0].newStart).toBe(0);
    expect(diffs[0].hunks[0].newLines).toBe(0);
  });

  it("parses a renamed file", () => {
    const raw = `diff --git a/src/old.ts b/src/renamed.ts
similarity index 90%
rename from src/old.ts
rename to src/renamed.ts
index abc..def 100644
--- a/src/old.ts
+++ b/src/renamed.ts
@@ -1,3 +1,3 @@
 export function hello() {
-  return "old";
+  return "renamed";
 }`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe("renamed");
    expect(diffs[0].oldPath).toBe("src/old.ts");
    expect(diffs[0].newPath).toBe("src/renamed.ts");
  });

  it("parses multiple files", () => {
    const raw = `diff --git a/a.ts b/a.ts
index abc..def 100644
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 export { a };
diff --git a/b.ts b/b.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/b.ts
@@ -0,0 +1 @@
+export const b = 2;`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(2);
    expect(diffs[0].newPath).toBe("a.ts");
    expect(diffs[0].status).toBe("modified");
    expect(diffs[1].newPath).toBe("b.ts");
    expect(diffs[1].status).toBe("added");
  });

  it("parses multi-hunk diffs", () => {
    const raw = `diff --git a/file.ts b/file.ts
index abc..def 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+inserted
 line2
 line3
@@ -20,3 +21,4 @@
 line20
+another
 line21
 line22`;

    const diffs = parseGitDiff(raw);
    expect(diffs[0].hunks).toHaveLength(2);
    expect(diffs[0].hunks[0].oldStart).toBe(1);
    expect(diffs[0].hunks[0].newStart).toBe(1);
    expect(diffs[0].hunks[1].oldStart).toBe(20);
    expect(diffs[0].hunks[1].newStart).toBe(21);
  });

  it("skips binary files", () => {
    const raw = `diff --git a/image.png b/image.png
index abc..def 100644
Binary files a/image.png and b/image.png differ
diff --git a/code.ts b/code.ts
index abc..def 100644
--- a/code.ts
+++ b/code.ts
@@ -1 +1,2 @@
 const x = 1;
+const y = 2;`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].newPath).toBe("code.ts");
  });

  it("handles hunk header without line count (single line)", () => {
    const raw = `diff --git a/f.ts b/f.ts
index abc..def 100644
--- a/f.ts
+++ b/f.ts
@@ -1 +1 @@
-old
+new`;

    const diffs = parseGitDiff(raw);
    expect(diffs[0].hunks[0].oldLines).toBe(1);
    expect(diffs[0].hunks[0].newLines).toBe(1);
  });

  it("handles empty hunks", () => {
    const raw = `diff --git a/f.ts b/f.ts
index abc..def 100644
--- a/f.ts
+++ b/f.ts
@@ -1,3 +1,3 @@
line1
line2
line3`;

    const diffs = parseGitDiff(raw);
    expect(diffs[0].hunks[0].content).toBe("line1\nline2\nline3");
  });

  it("handles multiple consecutive diff headers", () => {
    const raw = `diff --git a/a.ts b/a.ts
index abc..def 100644
--- a/a.ts
+++ b/a.ts
@@ -1 +1,2 @@
 a
+b
diff --git a/b.ts b/b.ts
index abc..def 100644
--- a/b.ts
+++ b/b.ts
@@ -1 +1,2 @@
 c
+d`;

    const diffs = parseGitDiff(raw);
    expect(diffs).toHaveLength(2);
    expect(diffs[0].newPath).toBe("a.ts");
    expect(diffs[1].newPath).toBe("b.ts");
  });
});
