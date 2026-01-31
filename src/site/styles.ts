export const CSS = `
:root {
  --bg: #fff;
  --fg: #1a1a2e;
  --muted: #6b7280;
  --border: #e5e7eb;
  --accent: #2563eb;
  --accent-light: #dbeafe;
  --success: #16a34a;
  --warn: #d97706;
  --code-bg: #f3f4f6;
  --card-bg: #fafafa;
  --sidebar-bg: #f9fafb;
  --radius: 6px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --fg: #e2e8f0;
    --muted: #94a3b8;
    --border: #334155;
    --accent: #60a5fa;
    --accent-light: #1e3a5f;
    --code-bg: #1e293b;
    --card-bg: #1e293b;
    --sidebar-bg: #1e293b;
  }
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

h1 { font-size: 1.75rem; margin-bottom: 1rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem; }
h2 { font-size: 1.35rem; margin: 1.5rem 0 0.75rem; }
h3 { font-size: 1.1rem; margin: 1rem 0 0.5rem; }

code {
  background: var(--code-bg);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

pre {
  background: var(--code-bg);
  padding: 1rem;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 0.5rem 0;
}

pre code { background: none; padding: 0; }

.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  margin: 0.5rem 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.stat {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  text-align: center;
}

.stat .number { font-size: 2rem; font-weight: bold; color: var(--accent); }
.stat .label { font-size: 0.85rem; color: var(--muted); }

.badge {
  display: inline-block;
  padding: 0.15em 0.5em;
  border-radius: 3px;
  font-size: 0.8em;
  font-weight: 500;
}

.badge-class { background: #dbeafe; color: #1d4ed8; }
.badge-interface { background: #dcfce7; color: #166534; }
.badge-function { background: #fef3c7; color: #92400e; }
.badge-method { background: #f3e8ff; color: #6b21a8; }
.badge-enum { background: #ffe4e6; color: #9f1239; }
.badge-type { background: #e0e7ff; color: #3730a3; }

@media (prefers-color-scheme: dark) {
  .badge-class { background: #1e3a5f; color: #93c5fd; }
  .badge-interface { background: #14532d; color: #86efac; }
  .badge-function { background: #451a03; color: #fcd34d; }
  .badge-method { background: #3b0764; color: #d8b4fe; }
  .badge-enum { background: #4c0519; color: #fda4af; }
  .badge-type { background: #1e1b4b; color: #a5b4fc; }
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
}

th, td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th { font-weight: 600; color: var(--muted); font-size: 0.85rem; text-transform: uppercase; }

nav {
  margin-bottom: 2rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

nav a { font-weight: 500; }

.file-tree { list-style: none; }
.file-tree li { padding: 0.25rem 0; }
.file-tree li::before { content: "\\1F4C4 "; }

.mermaid { margin: 1rem 0; }

.search-box {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  background: var(--bg);
  color: var(--fg);
  margin-bottom: 1rem;
}

.search-results { list-style: none; }
.search-results li { padding: 0.25rem 0; }

footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
}
`;
