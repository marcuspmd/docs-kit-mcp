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
  --danger: #dc2626;
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header .logo {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--accent);
}

.header .search-container {
  flex: 1;
  max-width: 400px;
  margin: 0 2rem;
}

.header .search-box {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 1rem;
  background: var(--bg);
  color: var(--fg);
}

.main-layout {
  display: flex;
  flex: 1;
  margin-top: 70px; /* height of header */
}

.sidebar {
  width: 250px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  padding: 1rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar h3 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 600;
}

.sidebar nav {
  margin: 0;
  padding: 0;
  border: none;
}

.sidebar nav a {
  display: block;
  padding: 0.5rem 0;
  color: var(--fg);
  text-decoration: none;
  border-radius: var(--radius);
  margin-bottom: 0.25rem;
}

.sidebar nav a:hover,
.sidebar nav a.active {
  background: var(--accent-light);
  color: var(--accent);
}

.content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.right-sidebar {
  width: 300px;
  background: var(--sidebar-bg);
  border-left: 1px solid var(--border);
  padding: 1rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.right-sidebar .facets {
  margin-bottom: 1rem;
}

.right-sidebar .facet {
  margin-bottom: 1rem;
}

.right-sidebar .facet strong {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--muted);
  text-transform: uppercase;
}

.right-sidebar .facet-list {
  list-style: none;
  padding: 0;
}

.right-sidebar .facet-list div {
  margin-bottom: 0.25rem;
}

.right-sidebar .facet-list input[type="checkbox"] {
  margin-right: 0.5rem;
}

footer {
  margin-top: auto;
  padding: 1rem 2rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
  background: var(--card-bg);
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

/* Visibility badges */
.badge-public { background: #dcfce7; color: #166534; }
.badge-private { background: #fee2e2; color: #991b1b; }
.badge-protected { background: #fef3c7; color: #92400e; }

/* Status badges */
.badge-deprecated { background: #fee2e2; color: #991b1b; text-decoration: line-through; }
.badge-exported { background: #dbeafe; color: #1d4ed8; }

/* Layer badges */
.badge-layer { background: #e0e7ff; color: #3730a3; }
.badge-layer-domain { background: #dcfce7; color: #166534; }
.badge-layer-application { background: #dbeafe; color: #1d4ed8; }
.badge-layer-infrastructure { background: #fef3c7; color: #92400e; }
.badge-layer-presentation { background: #f3e8ff; color: #6b21a8; }

@media (prefers-color-scheme: dark) {
  .badge-class { background: #1e3a5f; color: #93c5fd; }
  .badge-interface { background: #14532d; color: #86efac; }
  .badge-function { background: #451a03; color: #fcd34d; }
  .badge-method { background: #3b0764; color: #d8b4fe; }
  .badge-enum { background: #4c0519; color: #fda4af; }
  .badge-type { background: #1e1b4b; color: #a5b4fc; }
  .badge-public { background: #14532d; color: #86efac; }
  .badge-private { background: #450a0a; color: #fca5a5; }
  .badge-protected { background: #451a03; color: #fcd34d; }
  .badge-deprecated { background: #450a0a; color: #fca5a5; }
  .badge-exported { background: #1e3a5f; color: #93c5fd; }
  .badge-layer { background: #1e1b4b; color: #a5b4fc; }
  .badge-layer-domain { background: #14532d; color: #86efac; }
  .badge-layer-application { background: #1e3a5f; color: #93c5fd; }
  .badge-layer-infrastructure { background: #451a03; color: #fcd34d; }
  .badge-layer-presentation { background: #3b0764; color: #d8b4fe; }
}

/* Layer cards on dashboard */
.layer-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.layer-card {
  border-radius: var(--radius);
  padding: 1rem;
  text-align: center;
  border: 1px solid var(--border);
}

.layer-card .number { font-size: 1.75rem; font-weight: bold; }
.layer-card .label { font-size: 0.85rem; opacity: 0.8; }

/* Complexity alert */
.complexity-high { color: var(--danger); font-weight: bold; }

/* Breadcrumb */
.breadcrumb {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.9rem;
  color: var(--muted);
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.breadcrumb a { color: var(--accent); }
.breadcrumb .sep { color: var(--muted); }
.breadcrumb .sep::before { content: " / "; }

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

tr:hover { background: var(--card-bg); }

nav {
  margin-bottom: 2rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

nav a { font-weight: 500; }

/* File tree grouped by directory */
.file-tree { list-style: none; }
.file-tree li { padding: 0.25rem 0; }
.file-tree li::before { content: "\\1F4C4 "; }

.dir-group { margin-bottom: 0.5rem; }
.dir-group summary {
  cursor: pointer;
  font-weight: 600;
  padding: 0.25rem 0;
  list-style: none;
}
.dir-group summary::before { content: "\\1F4C1 "; }
.dir-group[open] summary::before { content: "\\1F4C2 "; }
.dir-group .dir-count {
  font-size: 0.8em;
  color: var(--muted);
  font-weight: normal;
}
.dir-group ul {
  list-style: none;
  padding-left: 1.5rem;
}
.dir-group ul li { padding: 0.15rem 0; }
.dir-group ul li::before { content: "\\1F4C4 "; }

/* Mermaid container with scroll */
.mermaid-container {
  overflow-x: auto;
  margin: 1rem 0;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.mermaid { margin: 1rem 0; }

/* Search area */
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

/* Filter input for tables */
.table-filter {
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.9rem;
  background: var(--bg);
  color: var(--fg);
  margin-bottom: 0.5rem;
}

/* File summary card */
.file-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}

.file-summary .stat {
  padding: 0.75rem;
}

.file-summary .stat .number { font-size: 1.5rem; }

footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
}
`;
