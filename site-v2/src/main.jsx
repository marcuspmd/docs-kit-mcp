import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

/* ============================================================
   docs-kit · v2 site (improved design port)
   Loads /site-data.json at runtime and renders the SPA.
   ============================================================ */

// ─── Helpers ────────────────────────────────────────────────
const fmt = (v) => (v == null ? "—" : Number.isInteger(v) ? String(v) : Number(v).toFixed(1));

const riskCls = (r) => (r == null ? "" : r > 50 ? "r-high" : r > 25 ? "r-warn" : "r-ok");
const toneOfScore = (s) => (s == null ? "" : s >= 80 ? "good" : s >= 50 ? "warn" : "danger");

const KIND_LABEL = {
  class: "C",
  method: "M",
  function: "ƒ",
  interface: "I",
  type: "T",
  abstract_class: "A",
  constructor: "K",
  enum: "E",
  lambda: "λ",
};

function SymIcon({ kind }) {
  return <span className={`sym-icon ${kind}`}>{KIND_LABEL[kind] || "?"}</span>;
}

function isPathInScope(filePath, scopePath) {
  const normalized = (scopePath || "").replace(/\/+$/, "");
  if (!normalized) return true;
  return filePath === normalized || filePath.startsWith(`${normalized}/`);
}

function getScopedFiles(data, scopePath) {
  return data.files.filter((file) => isPathInScope(file, scopePath));
}

function getScopedSymbols(data, scopePath) {
  return data.symbols.filter((symbol) => isPathInScope(symbol.file, scopePath));
}

function averageCoverage(symbols) {
  const values = symbols
    .map((symbol) => symbol.metrics?.testCoverage?.coveragePercent)
    .filter((value) => value != null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getScopedArchViolations(data, scopePath) {
  return (data.archViolations || []).filter((violation) =>
    isPathInScope(violation.file, scopePath),
  );
}

function getScopedReaperFindings(
  data,
  scopePath,
  scopedSymbols = getScopedSymbols(data, scopePath),
) {
  const scopedSymbolIds = new Set(scopedSymbols.map((symbol) => symbol.id));
  const scopedFiles = new Set(getScopedFiles(data, scopePath));
  return (data.reaperFindings || []).filter((finding) => {
    if (scopedSymbolIds.has(finding.target) || scopedFiles.has(finding.target)) return true;
    if (isPathInScope(finding.target, scopePath)) return true;
    const symbol = data.symbolsById?.get?.(finding.target);
    return symbol ? isPathInScope(symbol.file, scopePath) : false;
  });
}

function getFileOverview(data, filePath) {
  const symbols = data.symbols.filter((symbol) => symbol.file === filePath);
  const entries = symbols.map((symbol) => data.complexityById[symbol.id]).filter(Boolean);
  const totalLoc = entries.reduce((sum, entry) => sum + (entry.linesOfCode || 0), 0);
  const maxRisk = entries.length ? Math.max(...entries.map((entry) => entry.riskScore || 0)) : 0;
  const archViolations = (data.archViolations || []).filter(
    (violation) => violation.file === filePath,
  );
  const reaperFindings = getScopedReaperFindings(data, filePath, symbols);
  return {
    filePath,
    symbols,
    totalLoc,
    maxRisk,
    avgCoverage: averageCoverage(symbols),
    archViolations,
    reaperFindings,
    violationCount: archViolations.length + reaperFindings.length,
  };
}

function buildPathChildren(data, scopePath, files, symbols, archViolations) {
  const groups = new Map();
  const ensureGroup = (childPath, label, isFile) => {
    if (!groups.has(childPath)) {
      groups.set(childPath, {
        path: childPath,
        label,
        isFile,
        files: new Set(),
        symbolIds: new Set(),
        totalLoc: 0,
        maxRisk: 0,
        archViolationCount: 0,
      });
    }
    return groups.get(childPath);
  };
  const childForFile = (filePath) => {
    const rest =
      filePath === scopePath ? filePath.split("/").pop() : filePath.slice(scopePath.length + 1);
    const label = rest.split("/")[0] || filePath.split("/").pop();
    const childPath = filePath === scopePath ? filePath : `${scopePath}/${label}`;
    return { childPath, label, isFile: data.files.includes(childPath) };
  };

  for (const file of files) {
    const child = childForFile(file);
    ensureGroup(child.childPath, child.label, child.isFile).files.add(file);
  }
  for (const symbol of symbols) {
    const child = childForFile(symbol.file);
    const group = ensureGroup(child.childPath, child.label, child.isFile);
    const entry = data.complexityById[symbol.id];
    group.symbolIds.add(symbol.id);
    group.totalLoc += entry?.linesOfCode || 0;
    group.maxRisk = Math.max(group.maxRisk, entry?.riskScore || 0);
  }
  for (const violation of archViolations) {
    const child = childForFile(violation.file);
    ensureGroup(child.childPath, child.label, child.isFile).archViolationCount += 1;
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
}

// ─── Tree builder ───────────────────────────────────────────
function buildTree(files, symbols) {
  const root = { name: "", path: "", dirs: new Map(), files: new Map() };
  for (const f of files) {
    const parts = f.split("/");
    const file = parts.pop();
    let node = root;
    let pathSoFar = "";
    for (const p of parts) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${p}` : p;
      if (!node.dirs.has(p)) {
        node.dirs.set(p, {
          name: p,
          path: pathSoFar,
          dirs: new Map(),
          files: new Map(),
        });
      }
      node = node.dirs.get(p);
    }
    const filSyms = symbols.filter((s) => s.file === f && !s.parent);
    node.files.set(file, { name: file, path: f, symbols: filSyms });
  }
  return root;
}

function countLeafFiles(node) {
  let n = node.files.size;
  for (const d of node.dirs.values()) n += countLeafFiles(d);
  return n;
}

function hasDescendantMatch(node, tokens, allSymbols) {
  const match = (s) => tokens.every((t) => s.toLowerCase().includes(t));
  for (const f of node.files.values()) {
    if (match(f.path)) return true;
    for (const s of f.symbols) if (match(s.name)) return true;
    for (const s of allSymbols.filter((s) => s.file === f.path)) if (match(s.name)) return true;
  }
  for (const d of node.dirs.values()) if (hasDescendantMatch(d, tokens, allSymbols)) return true;
  return false;
}

function TreeNode({ node, level, expanded, toggle, selection, onSelect, query, data }) {
  const dirs = useMemo(
    () => [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [node.dirs],
  );
  const files = useMemo(
    () => [...node.files.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [node.files],
  );
  const tokens = useMemo(() => (query || "").toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const match = useCallback(
    (s) => tokens.length === 0 || tokens.every((t) => s.toLowerCase().includes(t)),
    [tokens],
  );

  return (
    <ul>
      {dirs.map((d) => {
        const open = expanded.has(d.path) || tokens.length > 0;
        const childMatch = tokens.length === 0 || hasDescendantMatch(d, tokens, data.symbols);
        if (!childMatch && tokens.length > 0) return null;
        return (
          <li key={d.path}>
            <div
              className={`tree-item dir ${selection.type === "path" && selection.path === d.path ? "selected" : ""}`}
              style={{ "--lvl": level }}
              onClick={(e) => {
                if (e.shiftKey) toggle(d.path);
                else onSelect({ type: "path", path: d.path });
              }}
              onDoubleClick={() => toggle(d.path)}
            >
              <span
                className="caret"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(d.path);
                }}
              >
                {open ? "▾" : "▸"}
              </span>
              <span className="sym-icon" style={{ background: "#d4a72c", color: "white" }}>
                D
              </span>
              <span className="name">{d.name}</span>
              <span className="badge-num">{countLeafFiles(d)}</span>
            </div>
            {open ? (
              <TreeNode
                node={d}
                level={level + 1}
                expanded={expanded}
                toggle={toggle}
                selection={selection}
                onSelect={onSelect}
                query={query}
                data={data}
              />
            ) : null}
          </li>
        );
      })}
      {files.map((f) => {
        if (tokens.length > 0 && !match(f.path) && !f.symbols.some((s) => match(s.name)))
          return null;
        const open = expanded.has("file:" + f.path) || tokens.length > 0;
        return (
          <li key={f.path}>
            <div
              className={`tree-item file ${selection.type === "file" && selection.path === f.path ? "selected" : ""}`}
              style={{ "--lvl": level }}
              onClick={() => onSelect({ type: "file", path: f.path })}
              onDoubleClick={() => toggle("file:" + f.path)}
            >
              <span
                className="caret"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle("file:" + f.path);
                }}
              >
                {open ? "▾" : "▸"}
              </span>
              <span className="sym-icon" style={{ background: "#1f6feb" }}>
                F
              </span>
              <span className="name">{f.name}</span>
              <span className="badge-num">{data.symbolCountByFile.get(f.path) ?? 0}</span>
            </div>
            {open && f.symbols.length > 0 ? (
              <ul>
                {f.symbols
                  .filter((s) => tokens.length === 0 || match(s.name))
                  .map((s) => (
                    <TreeSymbolRow
                      key={s.id}
                      sym={s}
                      level={level + 1}
                      selection={selection}
                      onSelect={onSelect}
                      expanded={expanded}
                      toggle={toggle}
                      query={query}
                      match={match}
                      data={data}
                    />
                  ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function TreeSymbolRow({ sym, level, selection, onSelect, expanded, toggle, query, match, data }) {
  const kids = data.childrenByParent.get(sym.id) ?? [];
  const open = expanded.has("sym:" + sym.id) || (query && kids.some((k) => match(k.name)));
  const entry = data.complexityById[sym.id];
  return (
    <li>
      <div
        className={`tree-item symbol ${selection.type === "symbol" && selection.id === sym.id ? "selected" : ""}`}
        style={{ "--lvl": level }}
        onClick={() => onSelect({ type: "symbol", id: sym.id })}
      >
        <span
          className="caret"
          onClick={(e) => {
            if (kids.length) {
              e.stopPropagation();
              toggle("sym:" + sym.id);
            }
          }}
        >
          {kids.length ? (open ? "▾" : "▸") : ""}
        </span>
        <SymIcon kind={sym.kind} />
        <span className="name trunc">{sym.name}</span>
        {entry ? (
          <span className={`risk-pill ${riskCls(entry.riskScore)}`}>{entry.riskScore}</span>
        ) : (
          <span />
        )}
      </div>
      {open && kids.length > 0 ? (
        <ul>
          {kids
            .filter((k) => !query || match(k.name))
            .map((k) => (
              <TreeSymbolRow
                key={k.id}
                sym={k}
                level={level + 1}
                selection={selection}
                onSelect={onSelect}
                expanded={expanded}
                toggle={toggle}
                query={query}
                match={match}
                data={data}
              />
            ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeView({ data, selection, onSelect, query }) {
  const [expanded, setExpanded] = useState(() => new Set(["src"]));
  const toggle = useCallback(
    (k) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    [],
  );
  return (
    <div className="tree">
      <TreeNode
        node={data.tree}
        level={0}
        expanded={expanded}
        toggle={toggle}
        selection={selection}
        onSelect={onSelect}
        query={query}
        data={data}
      />
    </div>
  );
}

// ─── Donut ─────────────────────────────────────────────────
function Donut({ score, size = 132 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, score || 0));
  const fill = (safe / 100) * C;
  const tone = toneOfScore(safe);
  const color = tone === "good" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--danger)";
  const sw = size * 0.085;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={`${fill} ${C}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy - 3}
        className="donut-text"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: size * 0.26 }}
      >
        {Math.round(safe)}
      </text>
      <text x={cx} y={cy + size * 0.18} className="donut-sub" textAnchor="middle">
        / 100
      </text>
    </svg>
  );
}

// ─── Treemap ──────────────────────────────────────────────
function slice(items, x, y, w, h, total) {
  const out = [];
  if (items.length === 1) {
    out.push({ x, y, w, h, item: items[0] });
    return out;
  }
  const horizontal = w >= h;
  const first = items[0];
  const ratio = first._v / total;
  if (horizontal) {
    const fw = w * ratio;
    out.push({ x, y, w: fw, h, item: first });
    out.push(...slice(items.slice(1), x + fw, y, w - fw, h, total - first._v));
  } else {
    const fh = h * ratio;
    out.push({ x, y, w, h: fh, item: first });
    out.push(...slice(items.slice(1), x, y + fh, w, h - fh, total - first._v));
  }
  return out;
}
function squarify(items, x, y, w, h) {
  if (!items.length) return [];
  const total = items.reduce((s, i) => s + i._v, 0);
  if (total === 0) return [];
  const sorted = [...items].sort((a, b) => b._v - a._v);
  return slice(sorted, x, y, w, h, total);
}

function Treemap({ items, getValue, getColor, getLabel, onClick, height = 260 }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const rects = useMemo(
    () =>
      squarify(
        items.map((it) => ({ ...it, _v: getValue(it) })),
        0,
        0,
        size.w,
        size.h,
      ),
    [items, size.w, size.h, getValue],
  );
  return (
    <div className="treemap-wrap" ref={ref} style={{ height }}>
      {rects.map((r, i) => (
        <div
          key={i}
          className="cell"
          style={{ left: r.x, top: r.y, width: r.w, height: r.h, background: getColor(r.item) }}
          onClick={() => onClick && onClick(r.item)}
          title={getLabel(r.item)}
        >
          {r.w > 60 && r.h > 24 ? (
            <div className="lbl">
              {getLabel(r.item)}
              <span className="small">{Math.round(r.item._v)}</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── Source viewer + minimap ───────────────────────────────
function Minimap({ lines, cov, viewport, onJump, highlightSym }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * devicePixelRatio;
    c.height = rect.height * devicePixelRatio;
    const ctx = c.getContext("2d");
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const lh = rect.height / Math.max(1, lines.length);
    const cs = getComputedStyle(document.documentElement);
    const colorOf = (h) =>
      h == null
        ? cs.getPropertyValue("--text-faint")
        : h === 0
          ? cs.getPropertyValue("--cov-bad")
          : h === 1
            ? cs.getPropertyValue("--cov-warn")
            : cs.getPropertyValue("--cov-good");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const ln = i + 1;
      const indent = line.length - line.trimStart().length;
      const x = Math.min(indent * 0.7, 40);
      const w = Math.min(40, trimmed.length * 0.6);
      ctx.fillStyle = colorOf(cov[ln]);
      ctx.globalAlpha = trimmed.startsWith("//") || trimmed.startsWith("import") ? 0.3 : 0.85;
      ctx.fillRect(x, i * lh, w, Math.max(1.2, lh));
    });
    ctx.globalAlpha = 1;
    if (highlightSym) {
      ctx.fillStyle = cs.getPropertyValue("--accent");
      ctx.globalAlpha = 0.2;
      const y1 = (highlightSym.startLine - 1) * lh;
      const y2 = highlightSym.endLine * lh;
      ctx.fillRect(0, y1, rect.width, y2 - y1);
    }
  }, [lines.length, JSON.stringify(cov).length, highlightSym?.id]);
  const vy = (viewport.top / Math.max(1, viewport.scrollHeight)) * 100;
  const vh = (viewport.height / Math.max(1, viewport.scrollHeight)) * 100;
  return (
    <div
      className="minimap"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onJump((e.clientY - rect.top) / rect.height);
      }}
    >
      <canvas ref={canvasRef} />
      <div className="viewport" style={{ top: `${vy}%`, height: `${Math.max(4, vh)}%` }} />
    </div>
  );
}

function SourceViewer({ data, file, highlightSym, showMinimap, showHeatmap }) {
  const sf = data.sourceFiles[file];
  const cov = data.coverageByLine[file] || {};
  const scrollRef = useRef(null);
  const [viewport, setViewport] = useState({ top: 0, height: 0, scrollHeight: 1 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setViewport({ top: el.scrollTop, height: el.clientHeight, scrollHeight: el.scrollHeight });
    update();
    el.addEventListener("scroll", update);
    return () => el.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!highlightSym || !scrollRef.current) return;
    const lineHeight = 18.6;
    const top = (highlightSym.startLine - 4) * lineHeight;
    scrollRef.current.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [highlightSym?.id]);

  if (!sf) return <div className="empty">Source not available.</div>;
  const lines = sf.text.split("\n");

  return (
    <div className="source-wrap" data-minimap={showMinimap ? "on" : "off"}>
      <div className="source" ref={scrollRef}>
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const hit = showHeatmap ? cov[lineNum] : null;
          let covCls = "c-none";
          let lnCls = "";
          if (showHeatmap && hit != null) {
            if (hit === 0) {
              covCls = "c-bad";
              lnCls = "uncov";
            } else if (hit === 1) {
              covCls = "c-warn";
              lnCls = "partial";
            } else covCls = "c-good";
          }
          const isHighlight =
            highlightSym && lineNum >= highlightSym.startLine && lineNum <= highlightSym.endLine;
          return (
            <div key={lineNum} className={`src-line ${lnCls} ${isHighlight ? "highlight" : ""}`}>
              <span className={`cov ${covCls}`} />
              <span className="gutter">{lineNum}</span>
              <span className="code">{line || " "}</span>
            </div>
          );
        })}
      </div>
      {showMinimap ? (
        <Minimap
          lines={lines}
          cov={cov}
          viewport={viewport}
          onJump={(frac) => {
            const el = scrollRef.current;
            if (!el) return;
            el.scrollTo({ top: frac * el.scrollHeight, behavior: "smooth" });
          }}
          highlightSym={highlightSym}
        />
      ) : null}
    </div>
  );
}

// ─── Inline diff ───────────────────────────────────────────
function InlineDiff({ text }) {
  if (!text) return null;
  const rows = text.split("\n").map((l, i) => {
    let kind = "ctx";
    let ln = "";
    if (l.startsWith("@@")) kind = "hunk";
    else if (
      l.startsWith("+++") ||
      l.startsWith("---") ||
      l.startsWith("diff") ||
      l.startsWith("index")
    )
      kind = "meta";
    else if (l.startsWith("+")) {
      kind = "add";
      ln = "+";
    } else if (l.startsWith("-")) {
      kind = "del";
      ln = "−";
    }
    return { kind, line: l, idx: i, ln };
  });
  return (
    <div className="inline-diff">
      {rows.map((r) =>
        r.kind === "meta" ? null : (
          <div key={r.idx} className={`diff-row ${r.kind}`}>
            <span className="ln">{r.idx}</span>
            <span className="gut">{r.ln}</span>
            <span className="code">
              {r.kind === "hunk" ? r.line : r.line.replace(/^[+\- ]/, "")}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function SideBySideDiff({ data, text }) {
  if (!text) return null;
  const lines = text
    .split("\n")
    .filter(
      (l) =>
        !l.startsWith("+++") &&
        !l.startsWith("---") &&
        !l.startsWith("diff") &&
        !l.startsWith("index"),
    );
  const left = [];
  const right = [];
  let oldLn = 0;
  let newLn = 0;
  for (const l of lines) {
    if (l.startsWith("@@")) {
      const m = l.match(/-(\d+)/);
      const m2 = l.match(/\+(\d+)/);
      oldLn = m ? +m[1] : 0;
      newLn = m2 ? +m2[1] : 0;
      left.push({ kind: "hunk", line: l });
      right.push({ kind: "hunk", line: l });
      continue;
    }
    if (l.startsWith("-")) {
      left.push({ kind: "del", line: l.slice(1), ln: oldLn++ });
    } else if (l.startsWith("+")) {
      right.push({ kind: "add", line: l.slice(1), ln: newLn++ });
    } else {
      while (left.length < right.length) left.push({ kind: "ctx", line: "", ln: "" });
      while (right.length < left.length) right.push({ kind: "ctx", line: "", ln: "" });
      left.push({ kind: "ctx", line: l.replace(/^ /, ""), ln: oldLn++ });
      right.push({ kind: "ctx", line: l.replace(/^ /, ""), ln: newLn++ });
    }
  }
  while (left.length < right.length) left.push({ kind: "ctx", line: "", ln: "" });
  while (right.length < left.length) right.push({ kind: "ctx", line: "", ln: "" });
  return (
    <div className="diff-split">
      <div className="side old">
        <div className="side-h">before · {data.diff?.base || "main"}</div>
        {left.map((r, i) =>
          r.kind === "hunk" ? (
            <div key={i} className="diff-row hunk">
              <span />
              <span />
              <pre style={{ margin: 0, padding: "2px 8px" }}>{r.line}</pre>
            </div>
          ) : (
            <div key={i} className={`side-row ${r.kind}`}>
              <span className="ln">{r.ln || ""}</span>
              <pre>{r.line || " "}</pre>
            </div>
          ),
        )}
      </div>
      <div className="side new">
        <div className="side-h">after · {data.diff?.head || "head"}</div>
        {right.map((r, i) =>
          r.kind === "hunk" ? (
            <div key={i} className="diff-row hunk">
              <span />
              <span />
              <pre style={{ margin: 0, padding: "2px 8px" }}>{r.line}</pre>
            </div>
          ) : (
            <div key={i} className={`side-row ${r.kind}`}>
              <span className="ln">{r.ln || ""}</span>
              <pre>{r.line || " "}</pre>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

// ─── Pages ──────────────────────────────────────────────────
function Pillar({ title, weight, score, suffix = "", meta = [] }) {
  const tone = toneOfScore(score);
  return (
    <div className="pillar">
      <div className="title">
        <strong>{title}</strong>
        <span>{weight}</span>
      </div>
      <div className={`score ${tone}`}>
        {Math.round(score)}
        {suffix}
      </div>
      <div className="bar">
        <div className={tone} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <div className="meta">
        <span className={tone === "good" ? "good" : tone === "danger" ? "danger" : ""}>
          {meta[0]}
        </span>
        <span>{meta[1]}</span>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone, delta, deltaTone }) {
  return (
    <div className="stat-tile">
      <div className="lbl">{label}</div>
      <div className={`val ${tone || ""}`}>{value}</div>
      {delta ? <div className={`delta ${deltaTone || ""}`}>{delta}</div> : null}
    </div>
  );
}

function ScopedFindingsCard({ data, archViolations, reaperFindings, onSelect, title }) {
  const total = archViolations.length + reaperFindings.length;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-head">
        <h3>{title}</h3>
        <span className="count">{total}</span>
      </div>
      <div className="card-body flush">
        {archViolations.map((violation, index) => (
          <div
            key={`arch-${index}`}
            className="hotspot-row"
            onClick={() =>
              violation.symbol_id
                ? onSelect({ type: "symbol", id: violation.symbol_id })
                : onSelect({ type: "file", path: violation.file })
            }
          >
            <span className={`tag ${violation.severity === "error" ? "danger" : "warn"}`}>
              {violation.severity}
            </span>
            <div className="name trunc">
              <strong>{violation.rule}</strong>
              <small>{violation.message}</small>
            </div>
            <span className="metric">{violation.file}</span>
            <span />
            <span />
          </div>
        ))}
        {reaperFindings.map((finding, index) => {
          const symbol = data.symbolsById.get(finding.target);
          const targetFile =
            symbol?.file || (data.files.includes(finding.target) ? finding.target : null);
          return (
            <div
              key={`reaper-${index}`}
              className="hotspot-row"
              onClick={() =>
                symbol
                  ? onSelect({ type: "symbol", id: symbol.id })
                  : targetFile
                    ? onSelect({ type: "file", path: targetFile })
                    : undefined
              }
            >
              <span className="tag warn">{finding.type}</span>
              <div className="name trunc">
                <strong>{symbol?.name || finding.target}</strong>
                <small>{finding.reason}</small>
              </div>
              <span className="metric">{finding.suggested_action || finding.suggestedAction}</span>
              <span />
              <span />
            </div>
          );
        })}
        {total === 0 ? <div className="empty">No scoped violations.</div> : null}
      </div>
    </div>
  );
}

function PathOverview({ data, path, onSelect }) {
  const files = getScopedFiles(data, path);
  const symbols = getScopedSymbols(data, path);
  const archViolations = getScopedArchViolations(data, path);
  const reaperFindings = getScopedReaperFindings(data, path, symbols);
  const entries = symbols.map((symbol) => data.complexityById[symbol.id]).filter(Boolean);
  const children = buildPathChildren(data, path, files, symbols, archViolations);
  const fileRows = files.map((filePath) => getFileOverview(data, filePath));
  const totalLoc = entries.reduce((sum, entry) => sum + (entry.linesOfCode || 0), 0);
  const avgCov = averageCoverage(symbols);
  const maxRisk = entries.length ? Math.max(...entries.map((entry) => entry.riskScore || 0)) : 0;
  const classCount = symbols.filter(
    (symbol) =>
      symbol.kind === "class" || symbol.kind === "abstract_class" || symbol.kind === "interface",
  ).length;
  const hotspots = entries
    .map((entry) => ({ ...entry, symbol: data.symbolsById.get(entry.id) }))
    .filter((entry) => entry.symbol)
    .sort(
      (a, b) =>
        (b.riskScore || 0) - (a.riskScore || 0) ||
        (b.cyclomaticComplexity || 0) - (a.cyclomaticComplexity || 0),
    )
    .slice(0, 8);
  const colorByRisk = (risk) =>
    risk > 60
      ? "color-mix(in srgb, var(--danger) 30%, var(--surface))"
      : risk > 30
        ? "color-mix(in srgb, var(--warn) 30%, var(--surface))"
        : "color-mix(in srgb, var(--ok) 22%, var(--surface))";

  if (files.length === 0) {
    return (
      <div className="page">
        <div className="empty">Path not found.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Domain · path overview</div>
          <h1 className="page-title">{path}</h1>
          <p className="page-sub">
            {files.length} files · {symbols.length} symbols · {classCount} class/interface symbols
          </p>
        </div>
      </div>

      <div className="grid-4">
        <StatTile label="Files" value={files.length} />
        <StatTile label="Symbols" value={symbols.length} />
        <StatTile label="LOC (sum)" value={totalLoc} />
        <StatTile
          label="Avg coverage"
          value={avgCov != null ? `${fmt(avgCov)}%` : "—"}
          tone={avgCov != null ? toneOfScore(avgCov) : ""}
        />
        <StatTile
          label="Violations"
          value={archViolations.length + reaperFindings.length}
          tone={archViolations.length + reaperFindings.length > 0 ? "danger" : "good"}
        />
        <StatTile
          label="Risk (max)"
          value={maxRisk}
          tone={maxRisk > 50 ? "danger" : maxRisk > 25 ? "warn" : ""}
        />
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head">
            <h3>Child map</h3>
            <span className="count">size = LOC · color = risk</span>
          </div>
          {children.length > 0 ? (
            <Treemap
              items={children.map((child) => ({
                ...child,
                value: Math.max(10, child.totalLoc || child.symbolIds.size || child.files.size),
              }))}
              getValue={(child) => child.value}
              getColor={(child) => colorByRisk(child.maxRisk)}
              getLabel={(child) => child.label}
              onClick={(child) =>
                onSelect({ type: child.isFile ? "file" : "path", path: child.path })
              }
            />
          ) : (
            <div className="empty">No child paths.</div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Scoped hotspots</h3>
            <span className="count">{hotspots.length}</span>
          </div>
          <div className="card-body flush">
            {hotspots.map((entry) => (
              <div
                key={entry.id}
                className="hotspot-row"
                onClick={() => onSelect({ type: "symbol", id: entry.id })}
              >
                <SymIcon kind={entry.symbol.kind} />
                <div className="name trunc">
                  <strong>{entry.symbol.qualifiedName || entry.symbol.name}</strong>
                  <small>{entry.symbol.file}</small>
                </div>
                <span className="metric">cyc {fmt(entry.cyclomaticComplexity)}</span>
                <span className="metric">LOC {fmt(entry.linesOfCode)}</span>
                <span
                  className={`tag ${riskCls(entry.riskScore) === "r-high" ? "danger" : riskCls(entry.riskScore) === "r-warn" ? "warn" : "good"}`}
                >
                  risk {entry.riskScore}
                </span>
              </div>
            ))}
            {hotspots.length === 0 ? <div className="empty">No hotspots detected.</div> : null}
          </div>
        </div>
      </div>

      <ScopedFindingsCard
        data={data}
        archViolations={archViolations}
        reaperFindings={reaperFindings}
        onSelect={onSelect}
        title="Scoped violations"
      />

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h3>Files in scope</h3>
          <span className="count">{fileRows.length}</span>
        </div>
        <div style={{ maxHeight: 360, overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>File</th>
                <th className="right">Symbols</th>
                <th>Coverage</th>
                <th className="right">Violations</th>
                <th className="right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {fileRows
                .sort(
                  (a, b) =>
                    b.violationCount - a.violationCount ||
                    b.maxRisk - a.maxRisk ||
                    a.filePath.localeCompare(b.filePath),
                )
                .map((row) => (
                  <tr
                    key={row.filePath}
                    onClick={() => onSelect({ type: "file", path: row.filePath })}
                  >
                    <td className="name">
                      <strong>{row.filePath}</strong>
                    </td>
                    <td className="num right">{row.symbols.length}</td>
                    <td>
                      {row.avgCoverage != null ? (
                        <>
                          <span className="cell-bar">
                            <i
                              style={{
                                width: `${row.avgCoverage}%`,
                                background:
                                  row.avgCoverage >= 80
                                    ? "var(--ok)"
                                    : row.avgCoverage >= 50
                                      ? "var(--warn)"
                                      : "var(--danger)",
                              }}
                            />
                          </span>
                          <span className="num">{fmt(row.avgCoverage)}%</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>
                    <td className={`num right ${row.violationCount > 0 ? "danger" : "good"}`}>
                      {row.violationCount}
                    </td>
                    <td
                      className={`num right ${row.maxRisk > 50 ? "danger" : row.maxRisk > 25 ? "warn" : "good"}`}
                    >
                      {fmt(row.maxRisk)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, onSelect }) {
  const proj = data.complexity.project;
  const cov = data.health.coverage;
  const totalSyms = Math.max(1, proj.symbolCount);
  const highRatio = (proj.highComplexitySymbolCount / totalSyms) * 100;
  const maint = Math.round(Math.max(0, 100 - highRatio * 2));
  const avgCov = cov.averageCoveragePercent ?? 0;
  const cover = Math.round(avgCov);
  const fileCount = Math.max(1, data.files.length);
  const arch = Math.round(
    Math.max(0, 100 - (data.health.governance.archViolationCount / fileCount) * 15),
  );
  const overall = Math.round(maint * 0.4 + cover * 0.4 + arch * 0.2);

  const topSymbols = (data.complexity.topSymbols || []).slice(0, 6);
  const treemapItems = (data.complexity.modules || []).map((m) => ({
    label: m.path.replace(/^src\//, ""),
    value: Math.max(20, m.totalLinesOfCode),
    risk: m.riskScore,
    path: m.path,
  }));
  const colorByRisk = (r) =>
    r > 60
      ? "color-mix(in srgb, var(--danger) 30%, var(--surface))"
      : r > 30
        ? "color-mix(in srgb, var(--warn) 30%, var(--surface))"
        : "color-mix(in srgb, var(--ok) 22%, var(--surface))";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Project · Overview</div>
          <h1 className="page-title">{data.project.name}</h1>
          <p className="page-sub">
            {proj.symbolCount} symbols across {data.files.length} files · {proj.classCount} classes
            · branch <code style={{ fontFamily: "var(--font-mono)" }}>{data.project.branch}</code>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="health-hero">
          <div className="health-donut-cell">
            <Donut score={overall} />
            <div className="label">Code Quality</div>
            <div className="grade">
              Grade {overall >= 80 ? "A" : overall >= 60 ? "B" : overall >= 40 ? "C" : "D"} ·{" "}
              {overall >= 80 ? "Healthy" : overall >= 50 ? "Needs attention" : "Critical"}
            </div>
          </div>
          <div className="pillars">
            <Pillar
              title="Maintainability"
              weight="40%"
              score={maint}
              meta={[
                `${proj.highComplexitySymbolCount} high-complexity`,
                `${highRatio.toFixed(1)}% of symbols`,
              ]}
            />
            <Pillar
              title="Test Coverage"
              weight="40%"
              score={cover}
              suffix="%"
              meta={[`${cov.coveredSymbolCount} covered`, `${cov.uncoveredSymbolCount} below 60%`]}
            />
            <Pillar
              title="Architecture"
              weight="20%"
              score={arch}
              meta={[
                `${data.health.governance.archViolationCount} violations`,
                `${(data.health.governance.archViolationCount / fileCount).toFixed(2)}/file`,
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginTop: 14 }}>
        <StatTile label="Symbols" value={proj.symbolCount} />
        <StatTile label="Files" value={data.files.length} />
        <StatTile
          label="Avg coverage"
          value={`${fmt(cov.averageCoveragePercent)}%`}
          tone={toneOfScore(cov.averageCoveragePercent)}
        />
        <StatTile
          label="Open violations"
          value={data.health.governance.archViolationCount}
          tone={data.health.governance.archViolationCount > 0 ? "danger" : "good"}
        />
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head">
            <h3>Module risk treemap</h3>
            <span className="count">size = LOC · color = risk</span>
            <div className="card-head-spacer" />
          </div>
          {treemapItems.length > 0 ? (
            <Treemap
              items={treemapItems}
              getValue={(i) => i.value}
              getColor={(i) => colorByRisk(i.risk)}
              getLabel={(i) => i.label}
              onClick={(i) => onSelect({ type: "path", path: i.path })}
            />
          ) : (
            <div className="empty">No modules indexed.</div>
          )}
          <div className="legend">
            <span>
              <span
                className="swatch"
                style={{ background: "color-mix(in srgb, var(--ok) 22%, var(--surface))" }}
              />
              low
            </span>
            <span>
              <span
                className="swatch"
                style={{ background: "color-mix(in srgb, var(--warn) 30%, var(--surface))" }}
              />
              medium
            </span>
            <span>
              <span
                className="swatch"
                style={{ background: "color-mix(in srgb, var(--danger) 30%, var(--surface))" }}
              />
              high
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Top hotspots</h3>
            <span className="count">{topSymbols.length}</span>
          </div>
          <div className="card-body flush">
            {topSymbols.map((s) => {
              const full = data.symbolsById.get(s.id);
              return (
                <div
                  key={s.id}
                  className="hotspot-row"
                  onClick={() => onSelect({ type: "symbol", id: s.id })}
                >
                  <SymIcon kind={s.kind} />
                  <div className="name trunc">
                    <strong>{s.qualifiedName || s.name}</strong>
                    <small>{s.file}</small>
                  </div>
                  <span className="metric">cyc {fmt(s.cyclomaticComplexity)}</span>
                  <span className="metric">
                    cov{" "}
                    {full?.metrics?.testCoverage?.coveragePercent != null
                      ? fmt(full.metrics.testCoverage.coveragePercent) + "%"
                      : "—"}
                  </span>
                  <span
                    className={`tag ${riskCls(s.riskScore) === "r-high" ? "danger" : riskCls(s.riskScore) === "r-warn" ? "warn" : "good"}`}
                  >
                    risk {s.riskScore}
                  </span>
                </div>
              );
            })}
            {topSymbols.length === 0 ? <div className="empty">No hotspots detected.</div> : null}
          </div>
        </div>
      </div>

      {data.diff ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h3>Recent change · {data.diff.head}</h3>
            <span className="count">
              {data.diff.changedFiles?.length || 0} files · {data.diff.impacts?.length || 0}{" "}
              impacted symbols
            </span>
            <div className="card-head-spacer" />
            <button className="btn" onClick={() => onSelect({ type: "diff" })}>
              Open review →
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(data.diff.impacts || []).slice(0, 2).map((imp, i) => (
              <div key={i} style={{ borderBottom: i === 0 ? "1px solid var(--border)" : "none" }}>
                <div
                  style={{
                    padding: "8px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    fontSize: 12.5,
                  }}
                >
                  <SymIcon kind={imp.kind} />
                  <strong>{imp.qualifiedName || imp.symbolName}</strong>
                  <span
                    style={{
                      color: "var(--text-faint)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                  >
                    {imp.file}
                  </span>
                  <span className="tag accent">{imp.changeType}</span>
                  {imp.docUpdateRequired ? <span className="tag warn">docs required</span> : null}
                </div>
                {imp.diff ? <InlineDiff text={imp.diff} /> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.archViolations.length > 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h3>Architecture violations</h3>
            <span className="count">{data.archViolations.length}</span>
          </div>
          <div className="card-body flush">
            {data.archViolations.slice(0, 10).map((v, i) => (
              <div
                key={i}
                className="hotspot-row"
                onClick={() =>
                  v.symbol_id
                    ? onSelect({ type: "symbol", id: v.symbol_id })
                    : onSelect({ type: "file", path: v.file })
                }
              >
                <span className={`tag ${v.severity === "error" ? "danger" : "warn"}`}>
                  {v.severity}
                </span>
                <div className="name trunc">
                  <strong>{v.rule}</strong>
                  <small>{v.message}</small>
                </div>
                <span className="metric">{v.file.split("/").pop()}</span>
                <span />
                <span />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SymbolDetail({ data, symbol, onSelect, showMinimap, showHeatmap }) {
  if (!symbol) return <div className="empty">Symbol not found.</div>;
  const entry = data.complexityById[symbol.id];
  const file = data.sourceFiles[symbol.file];
  const deps = data.relationships
    .filter((r) => r.source_id === symbol.id)
    .map((r) => ({ rel: r, sym: data.symbolsById.get(r.target_id) }))
    .filter((x) => x.sym);
  const dependents = data.relationships
    .filter((r) => r.target_id === symbol.id)
    .map((r) => ({ rel: r, sym: data.symbolsById.get(r.source_id) }))
    .filter((x) => x.sym);
  const cov = symbol.metrics?.testCoverage?.coveragePercent;
  const inDiff = data.diff?.impacts?.find((i) => i.symbolId === symbol.id);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">
            {symbol.kind} · {symbol.layer || "—"}
          </div>
          <h1 className="page-title">
            {symbol.qualifiedName ? (
              <span>
                <span className="qn">
                  {symbol.qualifiedName.split(".").slice(0, -1).join(".")}.
                </span>
                {symbol.name}
              </span>
            ) : (
              symbol.name
            )}
          </h1>
          <p className="page-sub">
            {symbol.file}
            <span style={{ color: "var(--text-faint)" }}>
              {" "}
              · lines {symbol.startLine}–{symbol.endLine}
            </span>
          </p>
          {symbol.signature ? (
            <pre
              style={{
                margin: "10px 0 0",
                padding: "8px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                color: "var(--text)",
              }}
            >
              {symbol.signature}
            </pre>
          ) : null}
        </div>
        <div className="page-head-actions">
          {symbol.docRef ? (
            <span className="tag good">docs ✓</span>
          ) : (
            <span className="tag warn">missing docs</span>
          )}
          {symbol.deprecated ? <span className="tag danger">deprecated</span> : null}
          {inDiff ? <span className="tag accent">in current PR</span> : null}
        </div>
      </div>

      <div className="grid-4">
        <StatTile label="LOC" value={fmt(entry?.linesOfCode)} />
        <StatTile
          label="Cyclomatic"
          value={fmt(entry?.cyclomaticComplexity)}
          tone={
            entry?.cyclomaticComplexity > 15
              ? "danger"
              : entry?.cyclomaticComplexity > 10
                ? "warn"
                : ""
          }
        />
        <StatTile
          label="Cognitive"
          value={fmt(entry?.cognitiveComplexity)}
          tone={
            entry?.cognitiveComplexity > 20
              ? "danger"
              : entry?.cognitiveComplexity > 15
                ? "warn"
                : ""
          }
        />
        <StatTile
          label="Coverage"
          value={cov != null ? `${fmt(cov)}%` : "—"}
          tone={cov == null ? "" : toneOfScore(cov)}
        />
      </div>

      {symbol.summary ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h3>Summary</h3>
            <span className="count">generated by docs-kit</span>
          </div>
          <div className="card-body" style={{ lineHeight: 1.65 }}>
            {symbol.summary}
          </div>
        </div>
      ) : null}

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head">
            <h3>Metadata</h3>
          </div>
          <div className="meta-grid">
            <div>
              <span className="k">Kind</span>
              <span className="v">{symbol.kind}</span>
            </div>
            <div>
              <span className="k">Layer</span>
              <span className="v">{symbol.layer || "—"}</span>
            </div>
            <div>
              <span className="k">File</span>
              <span className="v trunc">{symbol.file}</span>
            </div>
            <div>
              <span className="k">Lines</span>
              <span className="v">
                {symbol.startLine}–{symbol.endLine}
              </span>
            </div>
            <div>
              <span className="k">Doc</span>
              <span className="v">{symbol.docRef || "missing"}</span>
            </div>
            <div>
              <span className="k">Tags</span>
              <span className="v">{(symbol.tags || []).join(", ") || "—"}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Dependencies</h3>
            <span className="count">
              {deps.length} out · {dependents.length} in
            </span>
          </div>
          <div className="dep-list">
            {[
              ...deps.map((x) => ({ ...x, dir: "out" })),
              ...dependents.map((x) => ({ ...x, dir: "in" })),
            ]
              .slice(0, 12)
              .map((x, i) => (
                <div
                  key={i}
                  className="dep-row"
                  onClick={() => onSelect({ type: "symbol", id: x.sym.id })}
                >
                  <SymIcon kind={x.sym.kind} />
                  <div className="trunc">
                    <strong>{x.sym.name}</strong> <small>{x.sym.file}</small>
                  </div>
                  <span className="rel-tag">
                    {x.dir === "out" ? "→" : "←"} {x.rel.type}
                  </span>
                </div>
              ))}
            {deps.length + dependents.length === 0 ? (
              <div className="empty">No relationships detected.</div>
            ) : null}
          </div>
        </div>
      </div>

      {inDiff?.diff ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h3>Inline diff · vs {data.diff.base}</h3>
            <span className="count">{inDiff.changeType}</span>
          </div>
          <InlineDiff text={inDiff.diff} />
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h3>Source</h3>
          <span className="count">{file?.language}</span>
        </div>
        <SourceViewer
          data={data}
          file={symbol.file}
          highlightSym={symbol}
          showMinimap={showMinimap}
          showHeatmap={showHeatmap}
        />
      </div>
    </div>
  );
}

function FileDetail({ data, filePath, onSelect, showMinimap, showHeatmap }) {
  const sf = data.sourceFiles[filePath];
  const syms = data.symbols.filter((s) => s.file === filePath);
  const cls = syms.filter((s) => s.kind === "class" || s.kind === "interface");
  const totalLoc = syms.reduce((a, b) => a + (data.complexityById[b.id]?.linesOfCode || 0), 0);
  const covs = syms.map((s) => s.metrics?.testCoverage?.coveragePercent).filter((v) => v != null);
  const avgCov = covs.length ? covs.reduce((a, b) => a + b, 0) / covs.length : null;
  const maxRisk = syms.length
    ? Math.max(...syms.map((s) => data.complexityById[s.id]?.riskScore || 0))
    : 0;
  const archViolations = (data.archViolations || []).filter(
    (violation) => violation.file === filePath,
  );
  const reaperFindings = getScopedReaperFindings(data, filePath, syms);
  const violationCount = archViolations.length + reaperFindings.length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">File</div>
          <h1 className="page-title">{filePath.split("/").pop()}</h1>
          <p className="page-sub">
            {filePath} · {syms.length} symbols · {cls.length} class(es)
          </p>
        </div>
        <div className="page-head-actions">
          {avgCov != null ? (
            <span
              className={`tag ${toneOfScore(avgCov) === "good" ? "good" : toneOfScore(avgCov) === "warn" ? "warn" : "danger"}`}
            >
              {fmt(avgCov)}% covered
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid-4">
        <StatTile label="Symbols" value={syms.length} />
        <StatTile label="LOC (sum)" value={totalLoc} />
        <StatTile
          label="Avg coverage"
          value={avgCov != null ? `${fmt(avgCov)}%` : "—"}
          tone={avgCov != null ? toneOfScore(avgCov) : ""}
        />
        <StatTile label="Risk (max)" value={maxRisk} />
        <StatTile
          label="Violations"
          value={violationCount}
          tone={violationCount > 0 ? "danger" : "good"}
        />
      </div>

      <ScopedFindingsCard
        data={data}
        archViolations={archViolations}
        reaperFindings={reaperFindings}
        onSelect={onSelect}
        title="File violations"
      />

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h3>Symbols in file</h3>
          <span className="count">{syms.length}</span>
        </div>
        <div style={{ maxHeight: 320, overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Lines</th>
                <th className="right">LOC</th>
                <th className="right">Cyclo</th>
                <th className="right">Cogn</th>
                <th>Coverage</th>
                <th className="right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {syms.map((s) => {
                const e = data.complexityById[s.id];
                const c = s.metrics?.testCoverage?.coveragePercent;
                return (
                  <tr key={s.id} onClick={() => onSelect({ type: "symbol", id: s.id })}>
                    <td className="name">
                      <SymIcon kind={s.kind} /> <strong>{s.parent ? "↳ " + s.name : s.name}</strong>
                    </td>
                    <td className="num">
                      <small>{s.kind}</small>
                    </td>
                    <td className="num">
                      {s.startLine}–{s.endLine}
                    </td>
                    <td className="num right">{fmt(e?.linesOfCode)}</td>
                    <td
                      className={`num right ${e?.cyclomaticComplexity > 15 ? "danger" : e?.cyclomaticComplexity > 10 ? "warn" : ""}`}
                    >
                      {fmt(e?.cyclomaticComplexity)}
                    </td>
                    <td className={`num right ${e?.cognitiveComplexity > 20 ? "danger" : ""}`}>
                      {fmt(e?.cognitiveComplexity)}
                    </td>
                    <td>
                      {c != null ? (
                        <>
                          <span className="cell-bar">
                            <i
                              style={{
                                width: `${c}%`,
                                background:
                                  c >= 80 ? "var(--ok)" : c >= 50 ? "var(--warn)" : "var(--danger)",
                              }}
                            />
                          </span>
                          <span className="num">{fmt(c)}%</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>
                    <td
                      className={`num right ${e?.riskScore > 50 ? "danger" : e?.riskScore > 25 ? "warn" : "good"}`}
                    >
                      {fmt(e?.riskScore)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h3>Source</h3>
          <span className="count">
            {sf?.language} · {sf?.lineCount} lines
          </span>
        </div>
        <SourceViewer
          data={data}
          file={filePath}
          highlightSym={null}
          showMinimap={showMinimap}
          showHeatmap={showHeatmap}
        />
      </div>
    </div>
  );
}

function DiffReview({ data, onSelect }) {
  const diff = data.diff;
  if (!diff) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Pull request · review</div>
            <h1 className="page-title">No diff available</h1>
            <p className="page-sub">
              Run <code>docs-kit diff</code> to generate a PR review bundle.
            </p>
          </div>
        </div>
      </div>
    );
  }
  const uncovered = diff.docGuard?.uncoveredChanges || [];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Pull request · review</div>
          <h1 className="page-title">
            {diff.base} ← {diff.head}
          </h1>
          <p className="page-sub">
            {diff.changedFiles.length} files changed · {diff.impacts.length} semantic impacts
          </p>
        </div>
        <div className="page-head-actions">
          {diff.review?.status ? <span className="tag good">{diff.review.status}</span> : null}
        </div>
      </div>

      <div className="grid-4">
        <StatTile label="Changed files" value={diff.changedFiles.length} />
        <StatTile label="Impacts" value={diff.impacts.length} />
        <StatTile label="Doc updates" value={diff.docUpdates?.length || 0} tone="good" />
        <StatTile
          label="Docs-guard"
          value={`${diff.docGuard?.coveredChanges ?? 0}/${diff.docGuard?.totalChanges ?? 0}`}
          tone={uncovered.length ? "danger" : "good"}
        />
      </div>

      {diff.review ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h3>AI review summary</h3>
            <span className="count">{diff.review.status}</span>
          </div>
          <div className="card-body" style={{ lineHeight: 1.6 }}>
            {diff.review.summary}
            {diff.review.findingsBySeverity ? (
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(diff.review.findingsBySeverity).map(([s, n]) => (
                  <span
                    key={s}
                    className={`tag ${s === "error" ? "danger" : s === "warning" ? "warn" : "accent"}`}
                  >
                    {n} {s}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {diff.impacts.map((imp, i) => (
        <div className="card" key={i} style={{ marginTop: 14 }}>
          <div className="card-head">
            <SymIcon kind={imp.kind} />
            <h3 style={{ marginLeft: 6 }}>{imp.qualifiedName || imp.symbolName}</h3>
            <span className="count">
              {imp.changeType} · {imp.file}
            </span>
            <div className="card-head-spacer" />
            {imp.docUpdateRequired ? (
              <span className="tag warn">docs required</span>
            ) : (
              <span className="tag good">no docs needed</span>
            )}
            {imp.symbolId ? (
              <button
                className="btn ghost"
                onClick={() => onSelect({ type: "symbol", id: imp.symbolId })}
              >
                Open symbol →
              </button>
            ) : null}
          </div>
          {imp.diff ? <SideBySideDiff data={data} text={imp.diff} /> : null}
        </div>
      ))}

      {uncovered.length > 0 ? (
        <div
          className="card"
          style={{
            marginTop: 14,
            borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))",
          }}
        >
          <div className="card-head">
            <h3>Docs-guard violations</h3>
            <span className="count">{uncovered.length}</span>
          </div>
          <div className="card-body flush">
            {uncovered.map((u, i) => (
              <div key={i} className="hotspot-row">
                <span className="tag danger">block</span>
                <div className="name trunc">
                  <strong>{u.symbolName}</strong>
                  <small>{u.reason}</small>
                </div>
                <span className="metric">{u.docPath}</span>
                <span />
                <span />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Command palette ───────────────────────────────────────
function CommandPalette({ data, open, onClose, onSelect, setTweak, tweaks }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commands = useMemo(
    () => [
      {
        id: "go-dashboard",
        group: "navigate",
        label: "Go to dashboard",
        kbd: "G D",
        action: () => onSelect({ type: "dashboard" }),
      },
      {
        id: "go-diff",
        group: "navigate",
        label: "Open PR review",
        kbd: "G R",
        action: () => onSelect({ type: "diff" }),
      },
      {
        id: "toggle-theme",
        group: "settings",
        label: `Switch theme (${tweaks.theme})`,
        kbd: "T",
        action: () => setTweak("theme", tweaks.theme === "light" ? "dark" : "light"),
      },
      {
        id: "toggle-ai",
        group: "settings",
        label: `${tweaks.ai ? "Hide" : "Show"} AI panel`,
        kbd: "A",
        action: () => setTweak("ai", !tweaks.ai),
      },
      {
        id: "toggle-minimap",
        group: "settings",
        label: `${tweaks.minimap ? "Hide" : "Show"} minimap`,
        kbd: "M",
        action: () => setTweak("minimap", !tweaks.minimap),
      },
      {
        id: "toggle-heatmap",
        group: "settings",
        label: `${tweaks.heatmap ? "Hide" : "Show"} coverage heatmap`,
        kbd: "H",
        action: () => setTweak("heatmap", !tweaks.heatmap),
      },
    ],
    [tweaks, onSelect, setTweak],
  );

  const filtered = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (s) => tokens.length === 0 || tokens.every((t) => s.toLowerCase().includes(t));
    const symHits = data.symbols
      .filter((s) => match(s.name) || match(s.qualifiedName || "") || match(s.file))
      .slice(0, 8)
      .map((s) => ({
        id: "s:" + s.id,
        group: "symbols",
        label: s.qualifiedName || s.name,
        meta: s.file,
        kind: s.kind,
        action: () => onSelect({ type: "symbol", id: s.id }),
      }));
    const fileHits = data.files
      .filter((f) => match(f))
      .slice(0, 5)
      .map((f) => ({
        id: "f:" + f,
        group: "files",
        label: f.split("/").pop(),
        meta: f,
        kind: "file",
        action: () => onSelect({ type: "file", path: f }),
      }));
    const cmdHits = commands.filter((c) => match(c.label));
    return [...cmdHits, ...symHits, ...fileHits];
  }, [q, commands, data]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  if (!open) return null;
  const groups = {};
  filtered.forEach((f) => {
    (groups[f.group] = groups[f.group] || []).push(f);
  });
  const flat = filtered;

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[idx]?.action();
      onClose();
    } else if (e.key === "Escape") onClose();
  };

  return (
    <div className="palette-back" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span
            style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 14 }}
          >
            ⌘K
          </span>
          <input
            ref={inputRef}
            placeholder="Search symbols, files, or run a command…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list">
          {Object.entries(groups).map(([g, items]) => (
            <div key={g}>
              <div className="palette-group-label">{g}</div>
              {items.map((it) => {
                const i = flat.indexOf(it);
                return (
                  <div
                    key={it.id}
                    className={`palette-item ${i === idx ? "selected" : ""}`}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => {
                      it.action();
                      onClose();
                    }}
                  >
                    {it.kind && it.kind !== "file" ? (
                      <SymIcon kind={it.kind} />
                    ) : it.kind === "file" ? (
                      <span className="sym-icon" style={{ background: "#1f6feb" }}>
                        F
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-faint)" }}>⌘</span>
                    )}
                    <div className="trunc">
                      {it.label}
                      <span className="pi-meta" style={{ marginLeft: 8 }}>
                        {it.meta || ""}
                      </span>
                    </div>
                    {it.kbd ? (
                      <span className="kbd">{it.kbd}</span>
                    ) : (
                      <span className="pi-meta">↵</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 ? <div className="empty">No matches</div> : null}
        </div>
        <div className="palette-foot">
          <span>
            <span className="kbd">↑↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> open
          </span>
          <span>
            <span className="kbd">esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Tweaks popover ────────────────────────────────────────
const ACCENT_PALETTE = [
  { name: "Indigo", color: "#6366f1", soft: "#eef2ff", strong: "#4f46e5" },
  { name: "Emerald", color: "#10b981", soft: "#ecfdf5", strong: "#059669" },
  { name: "Amber", color: "#f59e0b", soft: "#fffbeb", strong: "#d97706" },
  { name: "Sky", color: "#0ea5e9", soft: "#f0f9ff", strong: "#0284c7" },
  { name: "Rose", color: "#f43f5e", soft: "#fff1f2", strong: "#e11d48" },
];

function TweaksPopover({ tweaks, setTweak, onClose }) {
  return (
    <div
      className="palette-back"
      style={{
        background: "transparent",
        paddingTop: 56,
        alignItems: "start",
        justifyItems: "end",
        paddingRight: 16,
      }}
      onClick={onClose}
    >
      <div className="palette" style={{ width: 320 }} onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <strong style={{ fontSize: 13 }}>Tweaks</strong>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div
          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14, fontSize: 12.5 }}
        >
          <div>
            <div className="chip-label" style={{ marginBottom: 6 }}>
              Theme
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["light", "dark"].map((t) => (
                <button
                  key={t}
                  className={`chip ${tweaks.theme === t ? "active" : ""}`}
                  onClick={() => setTweak("theme", t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="chip-label" style={{ marginBottom: 6 }}>
              Accent
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {ACCENT_PALETTE.map((p) => (
                <button
                  key={p.color}
                  title={p.name}
                  onClick={() => setTweak("accent", p.color)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: p.color,
                    border:
                      tweaks.accent === p.color
                        ? "2px solid var(--text)"
                        : "2px solid var(--border)",
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="chip-label" style={{ marginBottom: 6 }}>
              Density
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["compact", "cozy", "comfortable"].map((d) => (
                <button
                  key={d}
                  className={`chip ${tweaks.density === d ? "active" : ""}`}
                  onClick={() => setTweak("density", d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["ai", "AI assistant"],
              ["minimap", "Code minimap"],
              ["heatmap", "Coverage heatmap"],
            ].map(([key, label]) => (
              <label
                key={key}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={!!tweaks[key]}
                  onChange={(e) => setTweak(key, e.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Panel (mock scaffold) ──────────────────────────────
function AIPanel({ data, symbol, file, onSelect, onClose }) {
  const ctxLabel = symbol
    ? symbol.qualifiedName || symbol.name
    : file
      ? file.split("/").pop()
      : "project";
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "I'm scoped to ",
      refLabel: ctxLabel,
      refTarget: symbol
        ? { type: "symbol", id: symbol.id }
        : file
          ? { type: "file", path: file }
          : null,
      tail: ". This is a mock assistant — wire it to your LLM provider to enable real answers.",
    },
  ]);
  const [input, setInput] = useState("");
  const suggestions = symbol
    ? [`Explain ${symbol.name}`, "Why is this risky?", "What tests are missing?"]
    : file
      ? ["What does this file do?", "Map dependencies", "Find untested branches"]
      : ["Highest-risk symbols", "Coverage gaps", "Recent regressions"];

  const send = (text) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: `(mock) I'd analyze "${text}" against ${ctxLabel}. Plug in an LLM provider to enable.`,
        },
      ]);
    }, 250);
  };

  return (
    <div className="aside">
      <div className="aside-head">
        <div className="brand-mark" style={{ width: 20, height: 20, fontSize: 11 }}>
          AI
        </div>
        <strong>Assistant</strong>
        <small>scoped: {ctxLabel}</small>
        <div style={{ flex: 1 }} />
        {onClose ? (
          <button className="icon-btn" onClick={onClose} title="Close panel">
            ×
          </button>
        ) : null}
      </div>
      <div className="aside-body">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="avatar">{m.role === "ai" ? "AI" : "U"}</span>
            <div className="bubble">
              <p>
                {m.text}
                {m.refLabel ? (
                  <a
                    className="ref"
                    onClick={() => m.refTarget && onSelect(m.refTarget)}
                    style={{ cursor: m.refTarget ? "pointer" : "default" }}
                  >
                    {m.refLabel}
                  </a>
                ) : null}
                {m.tail || ""}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="aside-foot">
        <div className="ai-chips">
          {suggestions.map((s, i) => (
            <button key={i} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
        <textarea
          className="ai-textarea"
          placeholder={`Ask about ${ctxLabel}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <div className="ai-actions">
          <span
            style={{ color: "var(--text-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          >
            ⌘↵ to send
          </span>
          <button className="btn primary" onClick={() => send(input)}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Breadcrumbs ───────────────────────────────────────────
function buildCrumbs(data, selection) {
  if (selection.type === "dashboard")
    return [{ label: "Dashboard", target: { type: "dashboard" } }];
  if (selection.type === "diff")
    return [
      { label: "Dashboard", target: { type: "dashboard" } },
      { label: `PR · ${data.diff?.head || "diff"}`, target: { type: "diff" } },
    ];
  const filesSet = new Set(data.files);
  const siblingPeek = (p) => {
    const prefix = p + "/";
    const items = new Set();
    for (const f of data.files) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length).split("/")[0];
        items.add(rest);
      }
    }
    return Array.from(items)
      .slice(0, 10)
      .map((n) => ({
        label: n,
        target: { type: filesSet.has(prefix + n) ? "file" : "path", path: prefix + n },
      }));
  };
  const filePeek = (filePath) =>
    data.symbols
      .filter((s) => s.file === filePath && !s.parent)
      .slice(0, 10)
      .map((s) => ({ label: s.name, target: { type: "symbol", id: s.id }, kind: s.kind }));

  if (selection.type === "file") {
    const parts = selection.path.split("/");
    return [
      { label: "Dashboard", target: { type: "dashboard" } },
      ...parts.map((p, i) => {
        const path = parts.slice(0, i + 1).join("/");
        const isFile = i === parts.length - 1;
        return {
          label: p,
          target: isFile ? { type: "file", path } : { type: "path", path },
          peek: !isFile ? siblingPeek(path) : filePeek(path),
        };
      }),
    ];
  }
  if (selection.type === "symbol") {
    const sym = data.symbolsById.get(selection.id);
    if (!sym) return [];
    const parts = sym.file.split("/");
    return [
      { label: "Dashboard", target: { type: "dashboard" } },
      ...parts.map((p, i) => {
        const path = parts.slice(0, i + 1).join("/");
        const isFile = i === parts.length - 1;
        return {
          label: p,
          target: isFile ? { type: "file", path } : { type: "path", path },
          peek: !isFile ? siblingPeek(path) : filePeek(path),
        };
      }),
      { label: sym.name, target: { type: "symbol", id: sym.id }, peek: filePeek(sym.file) },
    ];
  }
  if (selection.type === "path") {
    const parts = selection.path.split("/");
    return [
      { label: "Dashboard", target: { type: "dashboard" } },
      ...parts.map((p, i) => {
        const path = parts.slice(0, i + 1).join("/");
        return { label: p, target: { type: "path", path }, peek: siblingPeek(path) };
      }),
    ];
  }
  return [];
}

function BreadcrumbItem({ crumb, last, onSelect }) {
  const [hover, setHover] = useState(false);
  return (
    <>
      <span
        style={{ position: "relative" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button className={`crumb ${last ? "last" : ""}`} onClick={() => onSelect(crumb.target)}>
          {crumb.label}
        </button>
        {hover && crumb.peek && crumb.peek.length > 0 ? (
          <div className="crumb-peek">
            {crumb.peek.map((p, i) => (
              <button key={i} onClick={() => onSelect(p.target)}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {p.kind ? <SymIcon kind={p.kind} /> : null}
                  {p.label}
                </span>
                {p.kind ? <small>{p.kind}</small> : <small>↗</small>}
              </button>
            ))}
          </div>
        ) : null}
      </span>
      {!last ? <span className="sep">/</span> : null}
    </>
  );
}

// ─── Routing ───────────────────────────────────────────────
function selectionToHash(sel) {
  if (sel.type === "dashboard") return "#/";
  if (sel.type === "diff") return "#/diff";
  if (sel.type === "symbol") return `#/symbol/${encodeURIComponent(sel.id)}`;
  if (sel.type === "file") return `#/file/${encodeURIComponent(sel.path)}`;
  if (sel.type === "path") return `#/path/${encodeURIComponent(sel.path)}`;
  return "#/";
}
function hashToSelection() {
  const h = window.location.hash || "#/";
  if (h === "#/" || h === "") return { type: "dashboard" };
  if (h === "#/diff") return { type: "diff" };
  const m = h.match(/^#\/(symbol|file|path)\/(.+)$/);
  if (!m) return { type: "dashboard" };
  const [, type, raw] = m;
  const value = decodeURIComponent(raw);
  if (type === "symbol") return { type: "symbol", id: value };
  if (type === "file") return { type: "file", path: value };
  return { type: "path", path: value };
}

// ─── Tweaks persistence ────────────────────────────────────
const DEFAULT_TWEAKS = {
  theme: "light",
  accent: "#6366f1",
  density: "cozy",
  ai: true,
  minimap: true,
  heatmap: true,
};
const TWEAKS_KEY = "docs-kit:v2:tweaks";
function loadTweaks() {
  try {
    const raw = localStorage.getItem(TWEAKS_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    return { ...DEFAULT_TWEAKS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TWEAKS;
  }
}
function saveTweaks(t) {
  try {
    localStorage.setItem(TWEAKS_KEY, JSON.stringify(t));
  } catch {}
}

// ─── App ───────────────────────────────────────────────────
function App({ data }) {
  const [tweaks, setTweaksRaw] = useState(loadTweaks);
  const setTweak = useCallback((key, value) => {
    setTweaksRaw((p) => {
      const next = { ...p, [key]: value };
      saveTweaks(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    const palette = ACCENT_PALETTE.find((p) => p.color === tweaks.accent) || ACCENT_PALETTE[0];
    document.documentElement.style.setProperty("--accent", palette.color);
    document.documentElement.style.setProperty("--accent-strong", palette.strong);
    if (tweaks.theme === "light")
      document.documentElement.style.setProperty("--accent-soft", palette.soft);
    else document.documentElement.style.removeProperty("--accent-soft");
  }, [tweaks.theme, tweaks.accent, tweaks.density]);

  const [selection, setSelection] = useState(() => hashToSelection());
  const [history, setHistory] = useState([]);
  const onSelect = useCallback((sel) => {
    setSelection((prev) => {
      setHistory((h) => [...h.slice(-19), prev]);
      window.location.hash = selectionToHash(sel);
      return sel;
    });
  }, []);
  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setSelection(prev);
      window.location.hash = selectionToHash(prev);
      return h.slice(0, -1);
    });
  };
  useEffect(() => {
    const onHash = () => setSelection(hashToSelection());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [treeQuery, setTreeQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const currentSymbol = selection.type === "symbol" ? data.symbolsById.get(selection.id) : null;
  const currentFile = selection.type === "file" ? selection.path : currentSymbol?.file;
  const currentPathStats = useMemo(
    () =>
      selection.type === "path"
        ? {
            files: getScopedFiles(data, selection.path).length,
            symbols: getScopedSymbols(data, selection.path).length,
          }
        : null,
    [data, selection.type, selection.type === "path" ? selection.path : null],
  );
  const crumbs = useMemo(() => buildCrumbs(data, selection), [data, selection]);

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div className="brand-name">docs-kit</div>
          <span className="brand-tag">v2</span>
        </div>
        <div className="titlebar-sep" />
        <div className="repo-crumbs">
          <strong>{data.project.name}</strong>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <span className="branch">⌥ {data.project.branch}</span>
        </div>

        <div className="titlebar-spacer" />

        <button className="cmdk-trigger" onClick={() => setPaletteOpen(true)}>
          <span style={{ color: "var(--text-faint)" }}>⌕</span>
          <span>Search symbols, files, run commands…</span>
          <span className="kbd">⌘ K</span>
        </button>

        <button
          className={`icon-btn ${tweaks.ai ? "active" : ""}`}
          title="Toggle AI panel"
          onClick={() => setTweak("ai", !tweaks.ai)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M2 4h10v6H6l-3 3V4z" />
            <circle cx="6" cy="7" r=".7" fill="currentColor" />
            <circle cx="9" cy="7" r=".7" fill="currentColor" />
            <path d="M11 1l.6 1.4L13 3l-1.4.6L11 5l-.6-1.4L9 3l1.4-.6z" fill="currentColor" />
          </svg>
        </button>
        <button
          className="icon-btn"
          title="Toggle theme"
          onClick={() => setTweak("theme", tweaks.theme === "light" ? "dark" : "light")}
        >
          {tweaks.theme === "light" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 9.5A4 4 0 016.5 4a4 4 0 105.5 5.5z" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
            </svg>
          )}
        </button>
        <button className="icon-btn" title="Tweaks" onClick={() => setTweaksOpen(true)}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <circle cx="8" cy="8" r="2" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
          </svg>
        </button>
      </header>

      <div className="filterbar">
        <span className="chip-label">View</span>
        <button
          className={`chip ${selection.type === "dashboard" ? "active" : ""}`}
          onClick={() => onSelect({ type: "dashboard" })}
        >
          Dashboard
        </button>
        <button
          className={`chip ${selection.type === "diff" ? "active" : ""}`}
          onClick={() => onSelect({ type: "diff" })}
          title="Open PR review"
        >
          PR review
        </button>
        <div className="filterbar-spacer" />
        <span className="chip-label">{data.symbols.length} symbols</span>
      </div>

      <div className="workspace" data-aside={tweaks.ai ? "on" : "off"}>
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className="sidebar-tab active">Tree</button>
            <div style={{ flex: 1 }} />
          </div>
          <div className="sidebar-search">
            <input
              placeholder="Filter…"
              value={treeQuery}
              onChange={(e) => setTreeQuery(e.target.value)}
            />
          </div>
          <div className="sidebar-body">
            <TreeView data={data} selection={selection} onSelect={onSelect} query={treeQuery} />
          </div>
          <div className="sidebar-foot">
            <span>
              {data.files.length} files · {data.symbols.length} symbols
            </span>
          </div>
        </aside>

        <main className="main">
          <div className="breadcrumbs">
            <button
              className="icon-btn"
              style={{ width: 22, height: 22 }}
              onClick={goBack}
              disabled={history.length === 0}
              title="Back"
            >
              ←
            </button>
            {crumbs.map((c, i) => (
              <BreadcrumbItem
                key={i}
                crumb={c}
                last={i === crumbs.length - 1}
                onSelect={onSelect}
              />
            ))}
            <div className="breadcrumbs-spacer" />
            <span className="meta">
              {selection.type === "symbol" && currentSymbol
                ? `lines ${currentSymbol.startLine}–${currentSymbol.endLine}`
                : selection.type === "file"
                  ? `${data.sourceFiles[currentFile]?.lineCount || 0} lines`
                  : selection.type === "path" && currentPathStats
                    ? `${currentPathStats.files} files · ${currentPathStats.symbols} symbols`
                    : ""}
            </span>
          </div>

          {selection.type === "dashboard" ? (
            <Dashboard data={data} onSelect={onSelect} />
          ) : selection.type === "symbol" ? (
            <SymbolDetail
              data={data}
              symbol={currentSymbol}
              onSelect={onSelect}
              showMinimap={tweaks.minimap}
              showHeatmap={tweaks.heatmap}
            />
          ) : selection.type === "file" ? (
            <FileDetail
              data={data}
              filePath={selection.path}
              onSelect={onSelect}
              showMinimap={tweaks.minimap}
              showHeatmap={tweaks.heatmap}
            />
          ) : selection.type === "diff" ? (
            <DiffReview data={data} onSelect={onSelect} />
          ) : selection.type === "path" ? (
            <PathOverview data={data} path={selection.path} onSelect={onSelect} />
          ) : (
            <div className="empty">Pick a file or symbol to inspect.</div>
          )}
        </main>

        {tweaks.ai ? (
          <AIPanel
            data={data}
            symbol={currentSymbol}
            file={currentFile}
            onSelect={onSelect}
            onClose={() => setTweak("ai", false)}
          />
        ) : null}
      </div>

      <div className="statusbar">
        <span className="seg">
          <span className="dot" />
          ready
        </span>
        <span className="seg">{data.project.branch}</span>
        <span className="seg">avg cov {fmt(data.health.coverage.averageCoveragePercent)}%</span>
        <span className="seg">{data.health.governance.archViolationCount} violations</span>
        <div className="grow" />
        <span className="seg">density: {tweaks.density}</span>
        <span className="seg">{tweaks.theme}</span>
        <span className="seg">⌘K palette</span>
      </div>

      <CommandPalette
        data={data}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={onSelect}
        tweaks={tweaks}
        setTweak={setTweak}
      />
      {tweaksOpen ? (
        <TweaksPopover tweaks={tweaks} setTweak={setTweak} onClose={() => setTweaksOpen(false)} />
      ) : null}
    </div>
  );
}

// ─── Bootstrap ─────────────────────────────────────────────
function indexData(raw) {
  const symbolsById = new Map(raw.symbols.map((s) => [s.id, s]));
  const childrenByParent = new Map();
  for (const s of raw.symbols) {
    if (!s.parent) continue;
    const arr = childrenByParent.get(s.parent) ?? [];
    arr.push(s);
    childrenByParent.set(s.parent, arr);
  }
  const complexityById = {};
  for (const c of raw.complexity?.symbols || []) {
    complexityById[c.id] = c;
  }
  // Pre-compute symbol count per file to avoid O(n×m) filtering in TreeNode
  const symbolCountByFile = new Map();
  for (const s of raw.symbols) {
    if (!s.file) continue;
    symbolCountByFile.set(s.file, (symbolCountByFile.get(s.file) ?? 0) + 1);
  }
  const tree = buildTree(raw.files, raw.symbols);
  return {
    ...raw,
    archViolations: raw.archViolations || [],
    symbolsById,
    childrenByParent,
    complexityById,
    symbolCountByFile,
    tree,
  };
}

function Root() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch("./site-data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load site-data.json (${r.status})`);
        return r.json();
      })
      .then((raw) => setData(indexData(raw)))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="empty">⚠ {error}</div>;
  if (!data) return <div className="empty">Loading site data…</div>;
  return <App data={data} />;
}

createRoot(document.getElementById("root")).render(<Root />);
