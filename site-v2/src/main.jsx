import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const CLASS_KINDS = new Set(["class", "abstract_class"]);

function metric(value) {
  if (value === null || value === undefined) return "-";
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function scoreClass(entry) {
  if (!entry?.aboveThresholds?.length) return "score-ok";
  if (entry.aboveThresholds.includes("cognitiveComplexity")) return "score-high";
  return "score-warn";
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function queryTokens(query) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

function symbolHaystack(symbol) {
  return [
    symbol.id,
    symbol.name,
    symbol.qualifiedName,
    symbol.file,
    symbol.kind,
    symbol.layer,
    symbol.docRef,
    symbol.signature,
    symbol.summary,
    symbol.docComment,
    symbol.tags?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSymbol(symbol, tokens) {
  if (tokens.length === 0) return true;
  const haystack = symbolHaystack(symbol);
  return tokens.every((token) => haystack.includes(token));
}

function matchesPath(filePath, tokens) {
  if (tokens.length === 0) return true;
  const haystack = normalize(filePath);
  return tokens.every((token) => haystack.includes(token));
}

function byLocation(left, right) {
  if (left.file !== right.file) return left.file.localeCompare(right.file);
  if (left.startLine !== right.startLine) return left.startLine - right.startLine;
  return left.name.localeCompare(right.name);
}

function symbolByIdMap(symbols) {
  return new Map(symbols.map((symbol) => [symbol.id, symbol]));
}

function complexityByIdMap(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function childrenByParentMap(symbols) {
  const map = new Map();
  for (const symbol of symbols) {
    if (!symbol.parent) continue;
    const children = map.get(symbol.parent) ?? [];
    children.push(symbol);
    map.set(symbol.parent, children);
  }
  for (const children of map.values()) {
    children.sort(byLocation);
  }
  return map;
}

function getModuleName(filePath) {
  if (!filePath.includes("/")) return "root";
  return filePath.split("/").slice(0, -1).join("/");
}

function getLineWindow(sourceFile, startLine, endLine) {
  if (!sourceFile?.text) return null;
  const lines = sourceFile.text.split("\n");
  const startIndex = Math.max(0, startLine - 1);
  const endIndex = Math.min(lines.length, endLine);
  return {
    startLine: startIndex + 1,
    endLine: endIndex,
    text: lines.slice(startIndex, endIndex).join("\n"),
  };
}

function truncateLines(text, maxLines) {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}\n// ... (+${lines.length - maxLines} lines)`;
}

function getEnclosingClass(symbol, symbolsById) {
  if (!symbol) return null;
  if (CLASS_KINDS.has(symbol.kind)) return symbol;

  let current = symbol.parent ? symbolsById.get(symbol.parent) : null;
  while (current) {
    if (CLASS_KINDS.has(current.kind)) return current;
    current = current.parent ? symbolsById.get(current.parent) : null;
  }
  return null;
}

function getSymbolSource(data, symbol, symbolsById) {
  const classSymbol = getEnclosingClass(symbol, symbolsById);
  const target = classSymbol ?? symbol;
  const sourceFile = data.sourceFiles?.[target.file];
  return getLineWindow(sourceFile, target.startLine, target.endLine);
}

function getDirectRelations(data, symbol, symbolsById) {
  if (!symbol) return { dependencies: [], dependents: [] };

  const dependencies = data.relationships
    .filter((relation) => relation.source_id === symbol.id)
    .map((relation) => ({ relation, symbol: symbolsById.get(relation.target_id) }))
    .filter((entry) => entry.symbol);
  const dependents = data.relationships
    .filter((relation) => relation.target_id === symbol.id)
    .map((relation) => ({ relation, symbol: symbolsById.get(relation.source_id) }))
    .filter((entry) => entry.symbol);

  return { dependencies, dependents };
}

function buildPromptPreview({ data, symbol, symbolsById, sourceText, dependencies, dependents }) {
  if (!symbol) return "";

  const promptSymbol = getEnclosingClass(symbol, symbolsById) ?? symbol;
  const parts = [
    "You are a senior software engineer explaining code to a teammate. Provide a clear, thorough explanation.",
    "",
    `## Symbol: ${promptSymbol.qualifiedName || promptSymbol.name}`,
    `- **Kind**: ${promptSymbol.kind}`,
    `- **File**: ${promptSymbol.file}:${promptSymbol.startLine}-${promptSymbol.endLine}`,
  ];

  if (promptSymbol.signature) parts.push(`- **Signature**: \`${promptSymbol.signature}\``);
  if (promptSymbol.layer) parts.push(`- **Layer**: ${promptSymbol.layer}`);
  if (promptSymbol.pattern) parts.push(`- **Pattern**: ${promptSymbol.pattern}`);
  if (promptSymbol.extends) parts.push(`- **Extends**: ${promptSymbol.extends}`);
  if (promptSymbol.implements?.length) {
    parts.push(`- **Implements**: ${promptSymbol.implements.join(", ")}`);
  }
  if (promptSymbol.deprecated) parts.push("- **DEPRECATED**");

  if (sourceText) {
    const language = data.sourceFiles?.[promptSymbol.file]?.language ?? "";
    parts.push("", "## Source Code", `\`\`\`${language}`, truncateLines(sourceText, 80), "```");
  }

  if (dependencies.length > 0) {
    parts.push("", "## Dependencies (this symbol uses):");
    for (const { symbol: dependency, relation } of dependencies.slice(0, 12)) {
      parts.push(
        `- ${dependency.name} (${dependency.kind} in ${dependency.file}, ${relation.type})`,
      );
    }
  }

  if (dependents.length > 0) {
    parts.push("", "## Dependents (use this symbol):");
    for (const { symbol: dependent, relation } of dependents.slice(0, 12)) {
      parts.push(`- ${dependent.name} (${dependent.kind} in ${dependent.file}, ${relation.type})`);
    }
  }

  if (promptSymbol.docRef) {
    parts.push("", "## Existing Documentation", `Linked doc: ${promptSymbol.docRef}`);
  }

  parts.push(
    "",
    "## Instructions",
    "Provide:",
    `1. **Purpose**: What this ${promptSymbol.kind} does and why it exists`,
    "2. **How it works**: Key logic, algorithms, or patterns used",
    "3. **Dependencies**: How it relates to the symbols listed above",
    "4. **Usage**: How other code should use this symbol",
    "5. **Gotchas**: Any non-obvious behavior, edge cases, or caveats",
    "**Responda em pt-BR**",
    "",
    "---",
    "**Important**: After providing your explanation, you MUST call the docs-kit 'updateSymbolExplanation' tool to cache your response for future use. Pass the symbol name and your explanation to that tool.",
  );

  return parts.join("\n");
}

function buildTree(data, symbolsById, tokens) {
  const root = { name: "root", path: "", children: new Map(), files: new Map() };
  const symbolsByFile = new Map();

  for (const symbol of data.symbols) {
    const symbols = symbolsByFile.get(symbol.file) ?? [];
    symbols.push(symbol);
    symbolsByFile.set(symbol.file, symbols);
  }

  for (const symbols of symbolsByFile.values()) {
    symbols.sort(byLocation);
  }

  for (const filePath of data.files.slice().sort()) {
    const fileSymbols = symbolsByFile.get(filePath) ?? [];
    const pathMatched = matchesPath(filePath, tokens);
    const matchedSymbols = fileSymbols.filter((symbol) => matchesSymbol(symbol, tokens));
    if (tokens.length > 0 && !pathMatched && matchedSymbols.length === 0) continue;

    const segments = filePath.split("/").filter(Boolean);
    const fileName = segments.pop() ?? filePath;
    let node = root;
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!node.children.has(segment)) {
        node.children.set(segment, {
          name: segment,
          path: currentPath,
          children: new Map(),
          files: new Map(),
        });
      }
      node = node.children.get(segment);
    }

    const visibleSymbols = pathMatched ? fileSymbols : matchedSymbols;
    const topLevelSymbolMap = new Map();
    for (const symbol of visibleSymbols) {
      let topLevelSymbol = symbol;
      let parent = symbol.parent ? symbolsById.get(symbol.parent) : null;
      while (parent && parent.file === symbol.file) {
        topLevelSymbol = parent;
        parent = parent.parent ? symbolsById.get(parent.parent) : null;
      }
      topLevelSymbolMap.set(topLevelSymbol.id, topLevelSymbol);
    }
    const topLevelSymbols = Array.from(topLevelSymbolMap.values()).sort(byLocation);

    node.files.set(fileName, {
      name: fileName,
      path: filePath,
      symbols: topLevelSymbols,
      allSymbols: fileSymbols,
    });
  }

  return root;
}

function coverageTone(pct) {
  if (pct === null || pct === undefined) return "";
  if (pct >= 80) return "good";
  if (pct >= 50) return "warning";
  return "danger";
}

function coverageLabel(pct) {
  if (pct === null || pct === undefined) return "-";
  return `${metric(pct)}%`;
}

function complexityTone(value, threshold) {
  if (!value) return "";
  return value > threshold ? "danger" : value > threshold * 0.7 ? "warning" : "";
}

function buildFileStats(fileSymbols, complexityById) {
  const entries = fileSymbols.map((s) => complexityById.get(s.id)).filter(Boolean);
  if (entries.length === 0) return null;
  const loc = entries.reduce((sum, e) => sum + (e.linesOfCode ?? 0), 0);
  const cycloValues = entries.map((e) => e.cyclomaticComplexity ?? 0).filter((v) => v > 0);
  const cogValues = entries.map((e) => e.cognitiveComplexity ?? 0).filter((v) => v > 0);
  const avgCyclo = cycloValues.length
    ? cycloValues.reduce((s, v) => s + v, 0) / cycloValues.length
    : 0;
  const avgCog = cogValues.length ? cogValues.reduce((s, v) => s + v, 0) / cogValues.length : 0;
  const maxCyclo = cycloValues.length ? Math.max(...cycloValues) : 0;
  const maxCog = cogValues.length ? Math.max(...cogValues) : 0;
  const riskScore = Math.max(...entries.map((e) => e.riskScore ?? 0));
  return { loc, avgCyclo, avgCog, maxCyclo, maxCog, riskScore };
}

function buildFileCoverage(fileSymbols) {
  const withCov = fileSymbols.filter((s) => s.metrics?.testCoverage);
  if (withCov.length === 0) return null;
  const vals = withCov.map((s) => s.metrics.testCoverage.coveragePercent);
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

function ModuleStats({ mod, thresholds }) {
  if (!mod) return null;
  return (
    <div className="detail-metrics">
      <Stat label="LOC" value={metric(mod.totalLinesOfCode)} />
      <Stat
        label="Avg Cyclomatic"
        value={metric(mod.avgCyclomaticComplexity)}
        tone={complexityTone(mod.avgCyclomaticComplexity, thresholds.cyclomaticComplexity)}
      />
      <Stat
        label="Max Cyclomatic"
        value={metric(mod.maxCyclomaticComplexity)}
        tone={complexityTone(mod.maxCyclomaticComplexity, thresholds.cyclomaticComplexity)}
      />
      <Stat
        label="Avg Cognitive"
        value={metric(mod.avgCognitiveComplexity)}
        tone={complexityTone(mod.avgCognitiveComplexity, thresholds.cognitiveComplexity)}
      />
      <Stat
        label="Max Cognitive"
        value={metric(mod.maxCognitiveComplexity)}
        tone={complexityTone(mod.maxCognitiveComplexity, thresholds.cognitiveComplexity)}
      />
      <Stat
        label="Max Nesting"
        value={metric(mod.maxNestingDepth)}
        tone={complexityTone(mod.maxNestingDepth, thresholds.maxNestingDepth)}
      />
      <Stat
        label="Risk Score"
        value={metric(mod.riskScore)}
        tone={mod.riskScore > 50 ? "danger" : mod.riskScore > 20 ? "warning" : ""}
      />
    </div>
  );
}

function Stat({ label, value, tone, onClick }) {
  const inner = (
    <>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone || ""}`}>{value}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="stat stat-clickable" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="stat">{inner}</div>;
}

function Badge({ children, tone }) {
  return <span className={`badge ${tone || ""}`}>{children}</span>;
}

function SourceBlock({ title, source, language }) {
  if (!source?.text) return null;
  return (
    <section className="detail-section source-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span>
          {source.startLine}-{source.endLine}
        </span>
      </div>
      <pre className="source-code" data-language={language || "text"}>
        <code>{source.text}</code>
      </pre>
    </section>
  );
}

function SummaryStrip({ data, onStatClick }) {
  const project = data.complexity.project;
  const coverage = data.health.coverage;
  const coveragePct = coverage?.averageCoveragePercent;
  const coverageTone =
    coveragePct === null || coveragePct === undefined
      ? ""
      : coveragePct >= 80
        ? "good"
        : coveragePct >= 50
          ? "warning"
          : "danger";
  return (
    <section className="summary-strip">
      <Stat label="Symbols" value={metric(project.symbolCount)} />
      <Stat label="Files" value={metric(data.files.length)} />
      <Stat label="Classes" value={metric(project.classCount)} />
      <Stat
        label="High Complexity"
        value={metric(project.highComplexitySymbolCount)}
        tone={project.highComplexitySymbolCount > 0 ? "danger" : "good"}
        onClick={onStatClick ? () => onStatClick("complexity", "cyclomatic") : undefined}
      />
      <Stat
        label="Max Cognitive"
        value={metric(project.maxCognitiveComplexity)}
        tone={
          project.maxCognitiveComplexity > data.complexity.thresholds.cognitiveComplexity
            ? "warning"
            : ""
        }
        onClick={onStatClick ? () => onStatClick("complexity", "cognitive") : undefined}
      />
      <Stat
        label="Max Nesting"
        value={metric(project.maxNestingDepth)}
        tone={project.maxNestingDepth > data.complexity.thresholds.maxNestingDepth ? "warning" : ""}
        onClick={onStatClick ? () => onStatClick("complexity", "nesting") : undefined}
      />
      <Stat
        label="Coverage"
        value={coveragePct !== null && coveragePct !== undefined ? `${metric(coveragePct)}%` : "-"}
        tone={coverageTone}
      />
    </section>
  );
}

function SearchResults({ data, query, complexityById, onSelect }) {
  const tokens = queryTokens(query);
  const tokenKey = tokens.join(" ");
  const results = useMemo(() => {
    if (tokens.length === 0) return { symbols: [], files: [] };

    const symbols = data.symbols
      .filter((symbol) => matchesSymbol(symbol, tokens))
      .map((symbol) => ({ symbol, complexity: complexityById.get(symbol.id) }))
      .sort((left, right) => {
        const leftRisk = left.complexity?.riskScore ?? 0;
        const rightRisk = right.complexity?.riskScore ?? 0;
        if (leftRisk !== rightRisk) return rightRisk - leftRisk;
        return byLocation(left.symbol, right.symbol);
      })
      .slice(0, 10);

    const files = data.files.filter((file) => matchesPath(file, tokens)).slice(0, 8);
    return { symbols, files };
  }, [complexityById, data.files, data.symbols, tokenKey]);

  if (tokens.length === 0) return null;

  return (
    <div className="search-results">
      <div className="result-group">
        <span>Symbols</span>
        {results.symbols.length === 0 ? <p>No symbol matches</p> : null}
        {results.symbols.map(({ symbol, complexity }) => (
          <button
            key={symbol.id}
            type="button"
            onClick={() => onSelect({ type: "symbol", id: symbol.id })}
          >
            <strong>{symbol.name}</strong>
            <small>
              {symbol.kind} · {symbol.file}
            </small>
            <span className={scoreClass(complexity)}>{metric(complexity?.riskScore)}</span>
          </button>
        ))}
      </div>
      <div className="result-group">
        <span>Paths</span>
        {results.files.length === 0 ? <p>No path matches</p> : null}
        {results.files.map((file) => (
          <button key={file} type="button" onClick={() => onSelect({ type: "file", path: file })}>
            <strong>{file.split("/").pop()}</strong>
            <small>{file}</small>
            <span>{data.symbols.filter((symbol) => symbol.file === file).length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TreeSymbol({ symbol, childrenByParent, complexityById, selected, onSelect, level = 0 }) {
  const children = childrenByParent.get(symbol.id) ?? [];
  const complexity = complexityById.get(symbol.id);
  const isSelected = selected.type === "symbol" && selected.id === symbol.id;

  return (
    <li className="tree-symbol" style={{ "--level": level }}>
      <button
        type="button"
        className={isSelected ? "selected" : ""}
        onClick={() => onSelect({ type: "symbol", id: symbol.id })}
      >
        <span className={`symbol-dot ${symbol.kind}`} />
        <span>{symbol.name}</span>
        <small>{symbol.kind}</small>
        {complexity ? (
          <em className={scoreClass(complexity)}>{metric(complexity.riskScore)}</em>
        ) : null}
      </button>
      {children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <TreeSymbol
              key={child.id}
              symbol={child}
              childrenByParent={childrenByParent}
              complexityById={complexityById}
              selected={selected}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeDirectory({ node, query, selected, onSelect, childrenByParent, complexityById }) {
  const directories = Array.from(node.children.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const files = Array.from(node.files.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const isQuerying = queryTokens(query).length > 0;

  return (
    <ul className="tree-list">
      {directories.map((child) => (
        <li key={child.path} className="tree-directory">
          <details open={isQuerying || child.path.split("/").length <= 2}>
            <summary>
              <button type="button" onClick={() => onSelect({ type: "path", path: child.path })}>
                <span className="folder-icon" />
                <span>{child.name}</span>
              </button>
            </summary>
            <TreeDirectory
              node={child}
              query={query}
              selected={selected}
              onSelect={onSelect}
              childrenByParent={childrenByParent}
              complexityById={complexityById}
            />
          </details>
        </li>
      ))}
      {files.map((file) => (
        <li key={file.path} className="tree-file">
          <details open={isQuerying || file.symbols.length <= 8}>
            <summary>
              <button
                type="button"
                className={
                  selected.type === "file" && selected.path === file.path ? "selected" : ""
                }
                onClick={() => onSelect({ type: "file", path: file.path })}
              >
                <span className="file-icon" />
                <span>{file.name}</span>
                <small>{file.allSymbols.length}</small>
              </button>
            </summary>
            {file.symbols.length > 0 ? (
              <ul>
                {file.symbols.map((symbol) => (
                  <TreeSymbol
                    key={symbol.id}
                    symbol={symbol}
                    childrenByParent={childrenByParent}
                    complexityById={complexityById}
                    selected={selected}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            ) : null}
          </details>
        </li>
      ))}
    </ul>
  );
}

function ExplorerTree({
  data,
  query,
  selected,
  onSelect,
  symbolsById,
  childrenByParent,
  complexityById,
}) {
  const tree = useMemo(
    () => buildTree(data, symbolsById, queryTokens(query)),
    [data, query, symbolsById],
  );

  return (
    <aside className="explorer-panel">
      <div className="panel-head">
        <h2>Tree</h2>
        <span>{data.files.length} files</span>
      </div>
      <div className="tree-scroll">
        <TreeDirectory
          node={tree}
          query={query}
          selected={selected}
          onSelect={onSelect}
          childrenByParent={childrenByParent}
          complexityById={complexityById}
        />
      </div>
    </aside>
  );
}

function SymbolMetrics({ entry }) {
  return (
    <div className="detail-metrics">
      <Stat label="LOC" value={metric(entry?.linesOfCode)} />
      <Stat label="Cyclomatic" value={metric(entry?.cyclomaticComplexity)} />
      <Stat label="Cognitive" value={metric(entry?.cognitiveComplexity)} />
      <Stat label="Nesting" value={metric(entry?.maxNestingDepth)} />
    </div>
  );
}

function RelationshipList({ title, entries, onSelect }) {
  return (
    <section className="detail-section relation-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span>{entries.length}</span>
      </div>
      {entries.length === 0 ? <p>None</p> : null}
      <div className="relation-list">
        {entries.slice(0, 24).map(({ relation, symbol }) => (
          <button
            key={`${relation.source_id}:${relation.target_id}:${relation.type}`}
            type="button"
            onClick={() => onSelect({ type: "symbol", id: symbol.id })}
          >
            <strong>{symbol.name}</strong>
            <small>
              {symbol.kind} · {relation.type}
            </small>
            <span>{symbol.file}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ClassMembers({ classSymbol, childrenByParent, complexityById, onSelect }) {
  const members = childrenByParent.get(classSymbol.id) ?? [];
  if (members.length === 0) return null;

  return (
    <section className="detail-section">
      <div className="section-head">
        <h3>Members</h3>
        <span>{members.length}</span>
      </div>
      <div className="member-grid">
        {members.map((member) => {
          const entry = complexityById.get(member.id);
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect({ type: "symbol", id: member.id })}
            >
              <strong>{member.name}</strong>
              <small>{member.kind}</small>
              <span className={scoreClass(entry)}>{metric(entry?.riskScore)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PromptPreview({ prompt }) {
  return (
    <section className="detail-section prompt-section">
      <div className="section-head">
        <h3>MCP LLM Preview</h3>
        <span>{Math.ceil(prompt.length / 4)} tokens</span>
      </div>
      <pre className="prompt-code">
        <code>{prompt}</code>
      </pre>
    </section>
  );
}

function SymbolDetail({ data, symbol, symbolsById, childrenByParent, complexityById, onSelect }) {
  const classSymbol = getEnclosingClass(symbol, symbolsById);
  const displaySymbol = classSymbol ?? symbol;
  const entry = complexityById.get(displaySymbol.id) ?? complexityById.get(symbol.id);
  const symbolEntry = complexityById.get(symbol.id);
  const source = getSymbolSource(data, symbol, symbolsById);
  const { dependencies, dependents } = getDirectRelations(data, displaySymbol, symbolsById);
  const prompt = buildPromptPreview({
    data,
    symbol,
    symbolsById,
    sourceText: source?.text,
    dependencies,
    dependents,
  });

  return (
    <article className="detail-page">
      <header className="detail-hero">
        <div>
          <div className="crumbs">{displaySymbol.file}</div>
          <h2>{displaySymbol.qualifiedName || displaySymbol.name}</h2>
          <p>
            {displaySymbol.kind} · lines {displaySymbol.startLine}-{displaySymbol.endLine}
          </p>
        </div>
        <div className="badge-row">
          <Badge tone="accent">{displaySymbol.kind}</Badge>
          {displaySymbol.docRef ? (
            <Badge tone="good">documented</Badge>
          ) : (
            <Badge tone="warning">missing docs</Badge>
          )}
          {displaySymbol.deprecated ? <Badge tone="danger">deprecated</Badge> : null}
        </div>
      </header>

      {symbol.id !== displaySymbol.id ? (
        <section className="detail-section selected-symbol-strip">
          <div>
            <h3>Selected Symbol</h3>
            <strong>{symbol.name}</strong>
            <span>
              {symbol.kind} · lines {symbol.startLine}-{symbol.endLine}
            </span>
          </div>
          {symbolEntry ? (
            <span className={scoreClass(symbolEntry)}>{metric(symbolEntry.riskScore)}</span>
          ) : null}
        </section>
      ) : null}

      <SymbolMetrics entry={entry} />

      <section className="detail-section">
        <div className="section-head">
          <h3>Metadata</h3>
          <span>{displaySymbol.id}</span>
        </div>
        <div className="metadata-grid">
          <div>
            <span>Path</span>
            <strong>{displaySymbol.file}</strong>
          </div>
          <div>
            <span>Name</span>
            <strong>{displaySymbol.name}</strong>
          </div>
          <div>
            <span>Qualified</span>
            <strong>{displaySymbol.qualifiedName || "-"}</strong>
          </div>
          <div>
            <span>Layer</span>
            <strong>{displaySymbol.layer || "-"}</strong>
          </div>
          <div>
            <span>Signature</span>
            <strong>{displaySymbol.signature || "-"}</strong>
          </div>
          <div>
            <span>Doc</span>
            <strong>{displaySymbol.docRef || "-"}</strong>
          </div>
        </div>
      </section>

      {displaySymbol.summary || displaySymbol.explanation || displaySymbol.docComment ? (
        <section className="detail-section prose-section">
          <h3>Notes</h3>
          {displaySymbol.summary ? <p>{displaySymbol.summary}</p> : null}
          {displaySymbol.explanation ? <p>{displaySymbol.explanation}</p> : null}
          {displaySymbol.docComment ? <pre>{displaySymbol.docComment}</pre> : null}
        </section>
      ) : null}

      {classSymbol ? (
        <ClassMembers
          classSymbol={classSymbol}
          childrenByParent={childrenByParent}
          complexityById={complexityById}
          onSelect={onSelect}
        />
      ) : null}

      <SourceBlock
        title={classSymbol ? "Full Class Source" : "Source"}
        source={source}
        language={data.sourceFiles?.[displaySymbol.file]?.language}
      />

      <div className="detail-two-col">
        <RelationshipList title="Dependencies" entries={dependencies} onSelect={onSelect} />
        <RelationshipList title="Dependents" entries={dependents} onSelect={onSelect} />
      </div>

      <PromptPreview prompt={prompt} />
    </article>
  );
}

function useSort(defaultCol) {
  const [sort, setSort] = useState({ col: defaultCol, dir: "desc" });
  function toggle(col) {
    setSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" },
    );
  }
  return [sort, toggle];
}

function SortableHeader({ col, label, sort, onSort }) {
  const active = sort.col === col;
  return (
    <button
      type="button"
      className={`sort-header ${active ? "sort-active" : ""}`}
      onClick={() => onSort(col)}
    >
      {label}
      <span className="sort-arrow">{active ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
    </button>
  );
}

function sortRows(rows, sort, getVal) {
  return [...rows].sort((a, b) => {
    const av = getVal(a) ?? -Infinity;
    const bv = getVal(b) ?? -Infinity;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function FileDetail({ data, filePath, symbolsById, complexityById, onSelect }) {
  const sourceFile = data.sourceFiles?.[filePath];
  const rawSymbols = data.symbols.filter((symbol) => symbol.file === filePath).sort(byLocation);
  const source = sourceFile
    ? { startLine: 1, endLine: sourceFile.lineCount, text: sourceFile.text }
    : null;
  const fileStats = buildFileStats(rawSymbols, complexityById);
  const fileCoverage = buildFileCoverage(rawSymbols);
  const thresholds = data.complexity.thresholds;
  const [sort, toggleSort] = useSort("risk");

  const FILE_COLS = {
    name: (s) => s.name,
    kind: (s) => s.kind,
    lines: (s) => s.startLine,
    loc: (s) => complexityById.get(s.id)?.linesOfCode ?? -1,
    cyclo: (s) => complexityById.get(s.id)?.cyclomaticComplexity ?? -1,
    cogn: (s) => complexityById.get(s.id)?.cognitiveComplexity ?? -1,
    coverage: (s) => s.metrics?.testCoverage?.coveragePercent ?? -1,
    risk: (s) => complexityById.get(s.id)?.riskScore ?? -1,
  };
  const symbols = sortRows(rawSymbols, sort, FILE_COLS[sort.col] ?? FILE_COLS.risk);

  return (
    <article className="detail-page">
      <header className="detail-hero">
        <div>
          <div className="crumbs">{getModuleName(filePath)}</div>
          <h2>{filePath.split("/").pop()}</h2>
          <p>
            {filePath} · {symbols.length} symbols
          </p>
        </div>
        <div className="badge-row">
          <Badge tone="accent">file</Badge>
          {fileCoverage !== null ? (
            <Badge tone={coverageTone(fileCoverage)}>{coverageLabel(fileCoverage)} coverage</Badge>
          ) : null}
        </div>
      </header>

      {fileStats ? (
        <div className="detail-metrics">
          <Stat label="LOC" value={metric(fileStats.loc)} />
          <Stat
            label="Avg Cyclomatic"
            value={metric(fileStats.avgCyclo)}
            tone={complexityTone(fileStats.avgCyclo, thresholds.cyclomaticComplexity)}
          />
          <Stat
            label="Max Cyclomatic"
            value={metric(fileStats.maxCyclo)}
            tone={complexityTone(fileStats.maxCyclo, thresholds.cyclomaticComplexity)}
          />
          <Stat
            label="Avg Cognitive"
            value={metric(fileStats.avgCog)}
            tone={complexityTone(fileStats.avgCog, thresholds.cognitiveComplexity)}
          />
          <Stat
            label="Max Cognitive"
            value={metric(fileStats.maxCog)}
            tone={complexityTone(fileStats.maxCog, thresholds.cognitiveComplexity)}
          />
          <Stat
            label="Coverage"
            value={coverageLabel(fileCoverage)}
            tone={coverageTone(fileCoverage)}
          />
          <Stat
            label="Risk Score"
            value={metric(fileStats.riskScore)}
            tone={fileStats.riskScore > 50 ? "danger" : fileStats.riskScore > 20 ? "warning" : ""}
          />
        </div>
      ) : null}

      <section className="detail-section">
        <div className="section-head">
          <h3>Symbols</h3>
          <span>{symbols.length}</span>
        </div>
        <div className="file-symbol-table">
          <div className="symbol-table-header">
            <SortableHeader col="name" label="Name" sort={sort} onSort={toggleSort} />
            <SortableHeader col="kind" label="Kind" sort={sort} onSort={toggleSort} />
            <SortableHeader col="lines" label="Lines" sort={sort} onSort={toggleSort} />
            <SortableHeader col="loc" label="LOC" sort={sort} onSort={toggleSort} />
            <SortableHeader col="cyclo" label="Cyclo" sort={sort} onSort={toggleSort} />
            <SortableHeader col="cogn" label="Cogn" sort={sort} onSort={toggleSort} />
            <SortableHeader col="coverage" label="Coverage" sort={sort} onSort={toggleSort} />
            <SortableHeader col="risk" label="Risk" sort={sort} onSort={toggleSort} />
          </div>
          {symbols.map((symbol) => {
            const entry = complexityById.get(symbol.id);
            const parent = symbol.parent ? symbolsById.get(symbol.parent) : null;
            const isNested = parent?.file === symbol.file;
            const symCov = symbol.metrics?.testCoverage?.coveragePercent ?? null;
            return (
              <button
                key={symbol.id}
                type="button"
                onClick={() => onSelect({ type: "symbol", id: symbol.id })}
              >
                <strong>{isNested ? `↳ ${symbol.name}` : symbol.name}</strong>
                <span>{symbol.kind}</span>
                <small>
                  {symbol.startLine}-{symbol.endLine}
                </small>
                <span>{metric(entry?.linesOfCode)}</span>
                <span
                  className={complexityTone(
                    entry?.cyclomaticComplexity,
                    thresholds.cyclomaticComplexity,
                  )}
                >
                  {metric(entry?.cyclomaticComplexity)}
                </span>
                <span
                  className={complexityTone(
                    entry?.cognitiveComplexity,
                    thresholds.cognitiveComplexity,
                  )}
                >
                  {metric(entry?.cognitiveComplexity)}
                </span>
                <span className={coverageTone(symCov)}>{coverageLabel(symCov)}</span>
                <em className={scoreClass(entry)}>{metric(entry?.riskScore)}</em>
              </button>
            );
          })}
        </div>
      </section>

      <SourceBlock title="File Source" source={source} language={sourceFile?.language} />
    </article>
  );
}

function PathDetail({ data, pathValue, complexityById, onSelect }) {
  const files = data.files
    .filter((file) => file === pathValue || file.startsWith(`${pathValue}/`))
    .sort();
  const symbols = data.symbols.filter((symbol) => files.includes(symbol.file));
  const classCount = symbols.filter((symbol) => CLASS_KINDS.has(symbol.kind)).length;
  const thresholds = data.complexity.thresholds;
  const [sort, toggleSort] = useSort("risk");

  // Find pre-computed module aggregate
  const mod = data.complexity.modules?.find((m) => m.path === pathValue);

  // Per-file stats
  const rawFileRows = files.map((file) => {
    const fileSymbols = data.symbols.filter((s) => s.file === file);
    const stats = buildFileStats(fileSymbols, complexityById);
    const coverage = buildFileCoverage(fileSymbols);
    return { file, fileSymbols, stats, coverage };
  });

  const PATH_COLS = {
    file: (r) => r.file,
    symbols: (r) => r.fileSymbols.length,
    loc: (r) => r.stats?.loc ?? -1,
    avgCyclo: (r) => r.stats?.avgCyclo ?? -1,
    maxCyclo: (r) => r.stats?.maxCyclo ?? -1,
    avgCog: (r) => r.stats?.avgCog ?? -1,
    coverage: (r) => r.coverage ?? -1,
    risk: (r) => r.stats?.riskScore ?? -1,
  };
  const fileRows = sortRows(rawFileRows, sort, PATH_COLS[sort.col] ?? PATH_COLS.risk);

  // Module-level coverage (average of files that have coverage)
  const covFiles = rawFileRows.filter((r) => r.coverage !== null);
  const moduleCoverage = covFiles.length
    ? Number((covFiles.reduce((sum, r) => sum + r.coverage, 0) / covFiles.length).toFixed(1))
    : null;

  // Hotspot symbols
  const hotspotIds = new Set(mod?.hotspotSymbolIds ?? []);
  const hotspots = mod
    ? symbols
        .filter((s) => hotspotIds.has(s.id))
        .map((s) => ({ symbol: s, entry: complexityById.get(s.id) }))
        .sort((a, b) => (b.entry?.riskScore ?? 0) - (a.entry?.riskScore ?? 0))
        .slice(0, 8)
    : [];

  return (
    <article className="detail-page">
      <header className="detail-hero">
        <div>
          <div className="crumbs">module</div>
          <h2>{pathValue || "root"}</h2>
          <p>
            {files.length} files · {symbols.length} symbols · {classCount} classes
          </p>
        </div>
        <div className="badge-row">
          <Badge tone="accent">module</Badge>
          {moduleCoverage !== null ? (
            <Badge tone={coverageTone(moduleCoverage)}>
              {coverageLabel(moduleCoverage)} coverage
            </Badge>
          ) : null}
        </div>
      </header>

      <ModuleStats mod={mod} thresholds={thresholds} />

      <section className="detail-section">
        <div className="section-head">
          <h3>Files</h3>
          <span>{files.length}</span>
        </div>
        <div className="file-symbol-table">
          <div className="symbol-table-header">
            <SortableHeader col="file" label="File" sort={sort} onSort={toggleSort} />
            <SortableHeader col="symbols" label="Symbols" sort={sort} onSort={toggleSort} />
            <SortableHeader col="loc" label="LOC" sort={sort} onSort={toggleSort} />
            <SortableHeader col="avgCyclo" label="Avg Cyclo" sort={sort} onSort={toggleSort} />
            <SortableHeader col="maxCyclo" label="Max Cyclo" sort={sort} onSort={toggleSort} />
            <SortableHeader col="avgCog" label="Avg Cogn" sort={sort} onSort={toggleSort} />
            <SortableHeader col="coverage" label="Coverage" sort={sort} onSort={toggleSort} />
            <SortableHeader col="risk" label="Risk" sort={sort} onSort={toggleSort} />
          </div>
          {fileRows.map(({ file, fileSymbols, stats, coverage }) => (
            <button key={file} type="button" onClick={() => onSelect({ type: "file", path: file })}>
              <strong>{file.split("/").pop()}</strong>
              <span>{fileSymbols.length}</span>
              <span>{stats ? metric(stats.loc) : "-"}</span>
              <span
                className={
                  stats ? complexityTone(stats.avgCyclo, thresholds.cyclomaticComplexity) : ""
                }
              >
                {stats ? metric(stats.avgCyclo) : "-"}
              </span>
              <span
                className={
                  stats ? complexityTone(stats.maxCyclo, thresholds.cyclomaticComplexity) : ""
                }
              >
                {stats ? metric(stats.maxCyclo) : "-"}
              </span>
              <span
                className={
                  stats ? complexityTone(stats.avgCog, thresholds.cognitiveComplexity) : ""
                }
              >
                {stats ? metric(stats.avgCog) : "-"}
              </span>
              <span className={coverageTone(coverage)}>{coverageLabel(coverage)}</span>
              <em
                className={
                  stats
                    ? stats.riskScore > 50
                      ? "score-high"
                      : stats.riskScore > 20
                        ? "score-warn"
                        : "score-ok"
                    : ""
                }
              >
                {stats ? metric(stats.riskScore) : "-"}
              </em>
            </button>
          ))}
        </div>
      </section>

      {hotspots.length > 0 ? (
        <section className="detail-section">
          <div className="section-head">
            <h3>Hotspot Symbols</h3>
            <span>highest risk in module</span>
          </div>
          <div className="symbol-table compact">
            {hotspots.map(({ symbol, entry }) => (
              <button
                key={symbol.id}
                type="button"
                onClick={() => onSelect({ type: "symbol", id: symbol.id })}
              >
                <strong>{symbol.qualifiedName || symbol.name}</strong>
                <span>{symbol.kind}</span>
                <small>{symbol.file.split("/").pop()}</small>
                <em className={scoreClass(entry)}>{metric(entry?.riskScore)}</em>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

// ─── Health Score (Sonar-inspired) ──────────────────────────────────────────
//
// Overall = weighted average of 3 CODE pillars. Docs is NEVER part of this.
//
// 1. Maintainability (40%) – high-complexity symbol ratio, inspired by SonarQube
//    Technical Debt Ratio. Thresholds: A(≤5%), B(≤10%), C(≤20%), D(≤50%), E(>50%)
//    Score = max(0, 100 − highComplexityRatio × 2)
//
// 2. Coverage (40%) – averageCoveragePercent direct value.
//
// 3. Architecture (20%) – violation DENSITY per file (not raw count), capped.
//    Score = max(0, 100 − (violations / files) × 15)
//    1 violation/file → −15 pts;  ~6.7 violations/file → 0
//
// Documentation health is shown as an informational card below, clearly
// separated, and does NOT influence the overall code quality score.

function computeHealthScore(data) {
  const { coverage, governance } = data.health;
  const project = data.complexity.project;
  const totalSymbols = project.symbolCount || 1;
  const totalFiles = data.files.length || 1;

  // Maintainability — SonarQube TDR-inspired
  const highComplexityRatio = ((project.highComplexitySymbolCount ?? 0) / totalSymbols) * 100;
  const maintainabilityScore = Math.round(Math.max(0, 100 - highComplexityRatio * 2));

  // Coverage — direct
  const coverageScore = Math.round(coverage?.averageCoveragePercent ?? 0);

  // Architecture — density per file, each violation/file costs 15 pts
  const violationDensity = governance.archViolationCount / totalFiles;
  const archScore = Math.round(Math.max(0, 100 - violationDensity * 15));

  // Overall code quality (docs excluded)
  const overall = Math.round(maintainabilityScore * 0.4 + coverageScore * 0.4 + archScore * 0.2);

  // Documentation — informational only, NOT in overall
  const totalSymbolsForDocs = data.symbols.length || 1;
  const docsScore = Math.round(
    Math.max(0, (1 - data.health.docs.missingDocRefCount / totalSymbolsForDocs) * 100),
  );

  return { overall, maintainabilityScore, coverageScore, archScore, docsScore };
}

function healthTone(score) {
  return score >= 80 ? "good" : score >= 50 ? "warning" : "danger";
}

function HealthDonut({ score, size = 140 }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const fill = (Math.min(Math.max(score, 0), 100) / 100) * circumference;
  const color = score >= 80 ? "#17a854" : score >= 50 ? "#e09200" : "#c53030";
  const sw = size * 0.09;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5ebf2" strokeWidth={sw} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={`${fill} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy - size * 0.06}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        style={{ fontSize: size * 0.23, fontWeight: 800 }}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + size * 0.17}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#65758b"
        style={{ fontSize: size * 0.1 }}
      >
        /100
      </text>
    </svg>
  );
}

function ProgressBar({ value, tone }) {
  const clamp = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="progress-bar-track">
      <div className={`progress-bar-fill ${tone || ""}`} style={{ width: `${clamp}%` }} />
    </div>
  );
}

function Dashboard({ data, symbolsById, onSelect }) {
  const scores = computeHealthScore(data);
  const { docs, coverage, governance } = data.health;
  const project = data.complexity.project;

  // Top modules sorted by avg cyclomatic complexity
  const topModules = [...(data.complexity.modules ?? [])]
    .sort((a, b) => b.avgCyclomaticComplexity - a.avgCyclomaticComplexity)
    .slice(0, 10);

  // Top hotspots: merge topClasses + topSymbols, deduplicate, sort by riskScore
  const seen = new Set();
  const topHotspots = [];
  for (const h of [...(data.complexity.topClasses ?? []), ...(data.complexity.topSymbols ?? [])]) {
    if (!seen.has(h.id)) {
      seen.add(h.id);
      topHotspots.push(h);
    }
  }
  topHotspots.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  const hotspots = topHotspots.slice(0, 8);

  // Symbol kind distribution
  const kindCounts = {};
  for (const s of data.symbols) {
    kindCounts[s.kind] = (kindCounts[s.kind] ?? 0) + 1;
  }
  const kinds = Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxKindCount = kinds[0]?.[1] ?? 1;

  const overallTone = healthTone(scores.overall);
  const thresholds = data.complexity.thresholds;

  return (
    <article className="detail-page dashboard-page">
      <header className="detail-hero">
        <div>
          <div className="crumbs">overview</div>
          <h2>Project Health Dashboard</h2>
          <p>
            {project.symbolCount} symbols · {data.files.length} files · {project.classCount} classes
          </p>
        </div>
        <div className="badge-row">
          <Badge tone={overallTone}>
            {scores.overall >= 80
              ? "Healthy"
              : scores.overall >= 50
                ? "Needs Attention"
                : "Critical"}
          </Badge>
        </div>
      </header>

      {/* Health Hero */}
      <section className="dashboard-section">
        <div className="health-hero-grid">
          <div className="health-donut-wrap">
            <HealthDonut score={scores.overall} size={140} />
            <div className="donut-label">Code Quality</div>
            <div className="donut-sublabel">Maintainability · Coverage · Architecture</div>
          </div>
          <div className="pillar-cards">
            <div className={`pillar-card pillar-${healthTone(scores.maintainabilityScore)}`}>
              <div className="pillar-title">Maintainability · 40%</div>
              <div className={`pillar-score ${healthTone(scores.maintainabilityScore)}`}>
                {scores.maintainabilityScore}
              </div>
              <ProgressBar
                value={scores.maintainabilityScore}
                tone={healthTone(scores.maintainabilityScore)}
              />
              <div className="pillar-stats">
                <span
                  className={project.highComplexitySymbolCount > 0 ? "danger-text" : "good-text"}
                >
                  {project.highComplexitySymbolCount} high-complexity
                </span>
                <span className="muted-text">
                  {((project.highComplexitySymbolCount / (project.symbolCount || 1)) * 100).toFixed(
                    1,
                  )}
                  % of symbols
                </span>
              </div>
            </div>
            <div className={`pillar-card pillar-${healthTone(scores.coverageScore)}`}>
              <div className="pillar-title">Test Coverage · 40%</div>
              <div className={`pillar-score ${healthTone(scores.coverageScore)}`}>
                {scores.coverageScore}%
              </div>
              <ProgressBar value={scores.coverageScore} tone={healthTone(scores.coverageScore)} />
              <div className="pillar-stats">
                <span className="good-text">{coverage.coveredSymbolCount} covered</span>
                <span className={coverage.uncoveredSymbolCount > 0 ? "danger-text" : "good-text"}>
                  {coverage.uncoveredSymbolCount} uncovered
                </span>
              </div>
            </div>
            <div className={`pillar-card pillar-${healthTone(scores.archScore)}`}>
              <div className="pillar-title">Architecture · 20%</div>
              <div className={`pillar-score ${healthTone(scores.archScore)}`}>
                {scores.archScore}
              </div>
              <ProgressBar value={scores.archScore} tone={healthTone(scores.archScore)} />
              <div className="pillar-stats">
                <span className={governance.archViolationCount > 0 ? "danger-text" : "good-text"}>
                  {governance.archViolationCount} violations
                </span>
                <span className="muted-text">
                  {(governance.archViolationCount / (data.files.length || 1)).toFixed(1)}/file
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Docs — informational card, clearly separate from code score */}
        <div className="docs-info-card">
          <div className="docs-info-label">📄 Documentation Health</div>
          <div className="docs-info-note">Não afeta o Code Quality Score</div>
          <div className="docs-info-body">
            <div className={`docs-info-score ${healthTone(scores.docsScore)}`}>
              {scores.docsScore}
            </div>
            <ProgressBar value={scores.docsScore} tone={healthTone(scores.docsScore)} />
            <div className="pillar-stats" style={{ marginTop: 6 }}>
              <span className="good-text">{docs.documentedSymbolCount} documented</span>
              <span className={docs.missingDocRefCount > 0 ? "warning-text" : "good-text"}>
                {docs.missingDocRefCount} missing docRef
              </span>
              {docs.missingDocRefByKind ? (
                <span className="muted-text">
                  top missing:{" "}
                  {Object.entries(docs.missingDocRefByKind)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(", ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Top Risk Hotspots */}
      {hotspots.length > 0 ? (
        <section className="dashboard-section">
          <div
            className="section-head"
            style={{ padding: "12px 14px", borderBottom: "1px solid #edf1f6" }}
          >
            <h3 style={{ margin: 0 }}>Top Risk Hotspots</h3>
            <span>highest complexity symbols</span>
          </div>
          <div className="hotspot-list">
            {hotspots.map((h) => {
              const sym = symbolsById.get(h.id);
              if (!sym) return null;
              const risk = h.riskScore ?? 0;
              const tone = risk > 60 ? "score-high" : risk > 30 ? "score-warn" : "score-ok";
              return (
                <button
                  key={h.id}
                  type="button"
                  className="hotspot-row"
                  onClick={() => onSelect({ type: "symbol", id: h.id })}
                >
                  <span className={`symbol-dot ${sym.kind}`} />
                  <strong>{sym.qualifiedName || sym.name}</strong>
                  <span className="hotspot-kind">{sym.kind}</span>
                  <small className="hotspot-file">{sym.file}</small>
                  <em className={tone}>{metric(risk)}</em>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Symbol Kind Distribution */}
      {kinds.length > 0 ? (
        <section className="dashboard-section">
          <div
            className="section-head"
            style={{ padding: "12px 14px", borderBottom: "1px solid #edf1f6" }}
          >
            <h3 style={{ margin: 0 }}>Symbol Distribution</h3>
            <span>{data.symbols.length} total</span>
          </div>
          <div className="kind-bars">
            {kinds.map(([kind, count]) => (
              <div key={kind} className="kind-bar-row">
                <span className={`symbol-dot ${kind}`} />
                <span className="kind-label">{kind}</span>
                <div className="kind-bar-track">
                  <div
                    className="kind-bar-fill"
                    style={{ width: `${(count / maxKindCount) * 100}%` }}
                  />
                </div>
                <span className="kind-count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Module Breakdown */}
      {topModules.length > 0 ? (
        <section className="dashboard-section">
          <div
            className="section-head"
            style={{ padding: "12px 14px", borderBottom: "1px solid #dfe6ef" }}
          >
            <h3 style={{ margin: 0 }}>Module Breakdown</h3>
            <span>by avg cyclomatic complexity</span>
          </div>
          <div className="module-table">
            <div className="module-table-header">
              <span>Module</span>
              <span>Files</span>
              <span>Symbols</span>
              <span>Avg Cyclo</span>
              <span>Max Cyclo</span>
              <span>Avg Cogn</span>
            </div>
            {topModules.map((mod) => (
              <button
                key={mod.path}
                type="button"
                className="module-row"
                onClick={() => onSelect({ type: "path", path: mod.path })}
              >
                <strong>{mod.path || "root"}</strong>
                <span>{mod.fileCount}</span>
                <span>{mod.symbolCount}</span>
                <span
                  className={complexityTone(
                    mod.avgCyclomaticComplexity,
                    thresholds.cyclomaticComplexity,
                  )}
                >
                  {metric(mod.avgCyclomaticComplexity)}
                </span>
                <span
                  className={complexityTone(
                    mod.maxCyclomaticComplexity,
                    thresholds.cyclomaticComplexity,
                  )}
                >
                  {metric(mod.maxCyclomaticComplexity)}
                </span>
                <span
                  className={complexityTone(
                    mod.avgCognitiveComplexity,
                    thresholds.cognitiveComplexity,
                  )}
                >
                  {metric(mod.avgCognitiveComplexity)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

// ─── Router ─────────────────────────────────────────────────────────────────

function DetailRouter({ data, selected, symbolsById, childrenByParent, complexityById, onSelect }) {
  if (selected.type === "dashboard") {
    return <Dashboard data={data} symbolsById={symbolsById} onSelect={onSelect} />;
  }

  if (selected.type === "symbol") {
    const symbol = symbolsById.get(selected.id);
    if (symbol) {
      return (
        <SymbolDetail
          data={data}
          symbol={symbol}
          symbolsById={symbolsById}
          childrenByParent={childrenByParent}
          complexityById={complexityById}
          onSelect={onSelect}
        />
      );
    }
  }

  if (selected.type === "file" && selected.path) {
    return (
      <FileDetail
        data={data}
        filePath={selected.path}
        symbolsById={symbolsById}
        complexityById={complexityById}
        onSelect={onSelect}
      />
    );
  }

  if (selected.type === "path" && selected.path) {
    return (
      <PathDetail
        data={data}
        pathValue={selected.path}
        complexityById={complexityById}
        onSelect={onSelect}
      />
    );
  }

  return <Dashboard data={data} symbolsById={symbolsById} onSelect={onSelect} />;
}

// ─── Drill-down Panels ──────────────────────────────────────────────────────

function ComplexityPanel({ data, sortBy, onSortChange, onClose, onSelect }) {
  const thresholds = data.complexity.thresholds;
  const sorted = [...data.complexity.symbols]
    .sort((a, b) => {
      if (sortBy === "nesting") return (b.maxNestingDepth ?? 0) - (a.maxNestingDepth ?? 0);
      if (sortBy === "cognitive")
        return (b.cognitiveComplexity ?? 0) - (a.cognitiveComplexity ?? 0);
      return (b.cyclomaticComplexity ?? 0) - (a.cyclomaticComplexity ?? 0);
    })
    .slice(0, 100);

  return (
    <section className="complexity-panel">
      <div className="panel-head">
        <h2>Complexity — {data.complexity.project.highComplexitySymbolCount} above threshold</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="sort-tabs">
            {[
              { key: "cyclomatic", label: "Cyclomatic" },
              { key: "cognitive", label: "Cognitive" },
              { key: "nesting", label: "Nesting" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`sort-tab${sortBy === key ? " active" : ""}`}
                onClick={() => onSortChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="close-btn"
            style={{ color: "#795000" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="panel-table">
        <div className="panel-table-header complexity-header">
          <span>Symbol</span>
          <span>Kind</span>
          <span>File</span>
          <span>Cyclo</span>
          <span>Cogn</span>
          <span>Nesting</span>
          <span>Risk</span>
        </div>
        {sorted.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="panel-table-row"
            onClick={() => onSelect({ type: "symbol", id: entry.id })}
          >
            <strong className="panel-cell-truncate">{entry.name}</strong>
            <span>{entry.kind}</span>
            <small className="panel-cell-truncate">{entry.file}</small>
            <span
              className={complexityTone(
                entry.cyclomaticComplexity,
                thresholds.cyclomaticComplexity,
              )}
            >
              {metric(entry.cyclomaticComplexity)}
            </span>
            <span
              className={complexityTone(entry.cognitiveComplexity, thresholds.cognitiveComplexity)}
            >
              {metric(entry.cognitiveComplexity)}
            </span>
            <span className={complexityTone(entry.maxNestingDepth, thresholds.maxNestingDepth)}>
              {metric(entry.maxNestingDepth)}
            </span>
            <em className={scoreClass(entry)}>{metric(entry.riskScore)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function PatternsPanel({ data, symbolsById, onClose, onSelect }) {
  const patterns = data.patterns ?? [];
  return (
    <section className="patterns-panel">
      <div className="panel-head">
        <h2>Detected Patterns ({patterns.length})</h2>
        <button type="button" className="close-btn" style={{ color: "#2457b8" }} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="pattern-list">
        {patterns.length === 0 ? (
          <p style={{ padding: "12px 14px", color: "#65758b" }}>No patterns detected.</p>
        ) : (
          patterns.map((pattern, i) => {
            const patternSymbols = (pattern.symbols ?? [])
              .map((id) => symbolsById.get(id))
              .filter(Boolean);
            return (
              <div key={i} className="pattern-item">
                <div className="pattern-item-head">
                  <Badge tone="accent">{pattern.kind}</Badge>
                  <span className="pattern-confidence">
                    confidence: {Math.round((pattern.confidence ?? 0) * 100)}%
                  </span>
                  {pattern.violations?.length > 0 ? (
                    <Badge tone="danger">{pattern.violations.length} violations</Badge>
                  ) : null}
                </div>
                <div className="pattern-symbols">
                  {patternSymbols.map((sym) => (
                    <button
                      key={sym.id}
                      type="button"
                      className="pattern-symbol-btn"
                      onClick={() => onSelect({ type: "symbol", id: sym.id })}
                    >
                      {sym.name}
                      <small style={{ marginLeft: 4, color: "#65758b" }}>{sym.kind}</small>
                    </button>
                  ))}
                  {(pattern.symbols?.length ?? 0) > patternSymbols.length ? (
                    <span style={{ fontSize: 12, color: "#65758b", padding: "2px 4px" }}>
                      +{pattern.symbols.length - patternSymbols.length} more
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function DeprecatedPanel({ data, onClose, onSelect }) {
  const deprecated = data.symbols.filter((s) => s.deprecated);
  return (
    <section className="info-panel">
      <div className="panel-head">
        <h2>Deprecated Symbols ({deprecated.length})</h2>
        <button type="button" className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>
      {deprecated.length === 0 ? (
        <p style={{ padding: "12px 14px", color: "#65758b" }}>No deprecated symbols found.</p>
      ) : (
        <div className="panel-table">
          <div className="panel-table-header info-header">
            <span>Symbol</span>
            <span>Kind</span>
            <span>File</span>
          </div>
          {deprecated.map((sym) => (
            <button
              key={sym.id}
              type="button"
              className="panel-table-row"
              onClick={() => onSelect({ type: "symbol", id: sym.id })}
            >
              <strong className="panel-cell-truncate">{sym.name}</strong>
              <span>{sym.kind}</span>
              <small className="panel-cell-truncate">{sym.file}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function DeadCodePanel({ data, symbolsById, onClose, onSelect }) {
  const findings = data.reaperFindings ?? [];
  return (
    <section className="info-panel dead-code-panel">
      <div className="panel-head">
        <h2>Dead Code / Reaper ({findings.length})</h2>
        <button type="button" className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>
      {findings.length === 0 ? (
        <p style={{ padding: "12px 14px", color: "#65758b" }}>No dead code findings.</p>
      ) : (
        <div className="panel-table">
          <div className="panel-table-header dead-code-header">
            <span>Type</span>
            <span>Symbol</span>
            <span>Reason</span>
            <span>Action</span>
          </div>
          {findings.map((finding, i) => {
            const sym = symbolsById.get(finding.target);
            return (
              <button
                key={i}
                type="button"
                className="panel-table-row"
                onClick={sym ? () => onSelect({ type: "symbol", id: sym.id }) : undefined}
                style={!sym ? { cursor: "default" } : undefined}
              >
                <Badge tone="warning">{(finding.type ?? "dead_code").replace(/_/g, " ")}</Badge>
                <strong className="panel-cell-truncate">{sym?.name ?? finding.target}</strong>
                <span style={{ color: "#65758b" }}>{finding.reason}</span>
                <small>{finding.suggested_action}</small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function serializeSelected(sel) {
  if (!sel || sel.type === "empty" || sel.type === "dashboard") return "";
  if (sel.type === "symbol") return `symbol:${sel.id}`;
  if (sel.type === "file") return `file:${sel.path}`;
  if (sel.type === "path") return `path:${sel.path}`;
  return "";
}

function deserializeSelected(hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { type: "dashboard" };
  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) return { type: "dashboard" };
  const type = raw.slice(0, colonIndex);
  const value = raw.slice(colonIndex + 1);
  if (type === "symbol") return { type: "symbol", id: value };
  if (type === "file") return { type: "file", path: value };
  if (type === "path") return { type: "path", path: value };
  return { type: "dashboard" };
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({ type: "empty" });
  const [showViolations, setShowViolations] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [panelSort, setPanelSort] = useState("cyclomatic");

  function openPanel(name, sort) {
    setShowViolations(false);
    setActivePanel((prev) => (prev === name && sort === panelSort ? null : name));
    if (sort) setPanelSort(sort);
  }

  function closePanel() {
    setActivePanel(null);
  }

  function navigate(nextSelected) {
    const hash = serializeSelected(nextSelected);
    history.pushState(nextSelected, "", hash ? `#${hash}` : location.pathname);
    setSelected(nextSelected);
  }

  useEffect(() => {
    function onPopState(event) {
      const restored = event.state ?? deserializeSelected(location.hash);
      if (restored) setSelected(restored);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    fetch("./site-data.json")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load site-data.json");
        return response.json();
      })
      .then((bundle) => {
        setData(bundle);
        const fromHash = deserializeSelected(location.hash);
        setSelected(fromHash);
        if (fromHash.type === "dashboard") {
          history.replaceState(fromHash, "", location.pathname);
        }
      })
      .catch((err) => setError(err));
  }, []);

  const symbolsById = useMemo(() => (data ? symbolByIdMap(data.symbols) : new Map()), [data]);
  const complexityById = useMemo(
    () => (data ? complexityByIdMap(data.complexity.symbols) : new Map()),
    [data],
  );
  const childrenByParent = useMemo(
    () => (data ? childrenByParentMap(data.symbols) : new Map()),
    [data],
  );

  function selectSearchResult(nextSelected) {
    navigate(nextSelected);
    setQuery("");
  }

  if (error) {
    return (
      <main className="page narrow">
        <h1>docs-kit v2</h1>
        <p className="error">{error.message}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page narrow">
        <h1>docs-kit v2</h1>
        <p>Loading</p>
      </main>
    );
  }

  return (
    <main className="page app-shell">
      <header className="topbar">
        <div>
          <h1>docs-kit v2</h1>
          <p>
            {data.files.length} files · {data.symbols.length} symbols · generated{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`topbar-home-btn${selected.type === "dashboard" ? " active" : ""}`}
            onClick={() => navigate({ type: "dashboard" })}
          >
            ⌂ Dashboard
          </button>
          <label className="global-search">
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="path, name, symbol"
            />
          </label>
          <div className="health-strip">
            <Badge tone={data.health.docs.missingDocRefCount > 0 ? "warning" : "good"}>
              {data.health.docs.missingDocRefCount} missing docs
            </Badge>
            <button
              type="button"
              className={`badge-btn ${data.health.governance.archViolationCount > 0 ? "danger" : "good"}`}
              onClick={() => {
                setActivePanel(null);
                setShowViolations((v) => !v);
              }}
              title="Click to toggle arch violations"
            >
              {data.health.governance.archViolationCount} arch violations
            </button>
            <button
              type="button"
              className={`badge-btn accent${activePanel === "patterns" ? " panel-active" : ""}`}
              onClick={() => openPanel("patterns")}
              title="Click to view detected patterns"
            >
              {data.health.governance.patternCount} patterns
            </button>
            <button
              type="button"
              className={`badge-btn ${(data.health.governance.reaperFindingCount ?? 0) > 0 ? "warning" : ""}${activePanel === "dead-code" ? " panel-active" : ""}`}
              onClick={() => openPanel("dead-code")}
              title="Click to view dead code findings"
            >
              {data.health.governance.reaperFindingCount ?? 0} dead code
            </button>
            {(data.health.governance.deprecatedSymbolCount ?? 0) > 0 ? (
              <button
                type="button"
                className={`badge-btn danger${activePanel === "deprecated" ? " panel-active" : ""}`}
                onClick={() => openPanel("deprecated")}
                title="Click to view deprecated symbols"
              >
                {data.health.governance.deprecatedSymbolCount} deprecated
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {showViolations && data.archViolations?.length > 0 ? (
        <section className="violations-panel">
          <div className="panel-head">
            <h2>Arch Violations ({data.archViolations.length})</h2>
            <button type="button" className="close-btn" onClick={() => setShowViolations(false)}>
              ✕
            </button>
          </div>
          <div className="violation-list">
            {data.archViolations.map((v, i) => (
              <div key={i} className={`violation-row severity-${v.severity}`}>
                <span className="violation-severity">{v.severity}</span>
                <span className="violation-rule">{v.rule}</span>
                <span className="violation-msg">{v.message}</span>
                <small className="violation-file">{v.file}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "complexity" ? (
        <ComplexityPanel
          data={data}
          sortBy={panelSort}
          onSortChange={setPanelSort}
          onClose={closePanel}
          onSelect={(sel) => {
            closePanel();
            navigate(sel);
          }}
        />
      ) : null}
      {activePanel === "patterns" ? (
        <PatternsPanel
          data={data}
          symbolsById={symbolsById}
          onClose={closePanel}
          onSelect={(sel) => {
            closePanel();
            navigate(sel);
          }}
        />
      ) : null}
      {activePanel === "deprecated" ? (
        <DeprecatedPanel
          data={data}
          onClose={closePanel}
          onSelect={(sel) => {
            closePanel();
            navigate(sel);
          }}
        />
      ) : null}
      {activePanel === "dead-code" ? (
        <DeadCodePanel
          data={data}
          symbolsById={symbolsById}
          onClose={closePanel}
          onSelect={(sel) => {
            closePanel();
            navigate(sel);
          }}
        />
      ) : null}

      <SearchResults
        data={data}
        query={query}
        complexityById={complexityById}
        onSelect={selectSearchResult}
      />
      <SummaryStrip data={data} onStatClick={openPanel} />

      <div className="explorer-layout">
        <ExplorerTree
          data={data}
          query={query}
          selected={selected}
          onSelect={navigate}
          symbolsById={symbolsById}
          childrenByParent={childrenByParent}
          complexityById={complexityById}
        />
        <section className="content-panel">
          <DetailRouter
            data={data}
            selected={selected}
            symbolsById={symbolsById}
            childrenByParent={childrenByParent}
            complexityById={complexityById}
            onSelect={navigate}
          />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
