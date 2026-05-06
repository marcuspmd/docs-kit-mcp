/**
 * Inspector page template — interactive context quality viewer.
 * Connects to the local HTTP API started by `docs-kit serve`.
 */
import type { DocEntry } from "../types.js";
import { layout } from "../layout.js";

export function renderInspectorPage(docEntries: DocEntry[] = []): string {
  const body = `
<div class="max-w-5xl mx-auto px-4 py-8 space-y-6">

  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Context Inspector</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Preview the exact context docs-kit sends to AI — measure tokens, latency, and coverage quality.
      </p>
    </div>
    <div class="flex items-center gap-2 text-sm">
      <span class="text-gray-500 dark:text-gray-400">API:</span>
      <span id="server-status" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <span class="w-2 h-2 rounded-full bg-gray-400 inline-block" id="status-dot"></span>
        <span id="status-text">checking…</span>
      </span>
    </div>
  </div>

  <!-- Offline Banner -->
  <div id="offline-banner" class="hidden rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
    <div class="flex items-start gap-3">
      <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      <div>
        <p class="text-sm font-medium text-amber-800 dark:text-amber-200">Inspector server not running</p>
        <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Start the local API to enable live inspection:
          <code class="ml-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-800 font-mono">docs-kit serve --port 7337</code>
        </p>
      </div>
    </div>
  </div>

  <!-- Query Panel -->
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-5">
    <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Query</h2>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Symbol name</label>
        <input id="input-symbol" type="text" placeholder="e.g. buildRelevantContext"
          class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">File path <span class="text-gray-400">(alternative)</span></label>
        <input id="input-file" type="text" placeholder="e.g. src/knowledge/contextBuilder.ts"
          class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mode</label>
        <select id="input-mode"
          class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="compact">compact (fast, ~500 doc chars)</option>
          <option value="full" selected>full (detailed, ~2000 doc chars)</option>
        </select>
      </div>
      <div class="flex-1 min-w-[180px]">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Max context chars: <span id="chars-label" class="text-blue-600 dark:text-blue-400 font-mono">20 000</span>
        </label>
        <input id="input-chars" type="range" min="5000" max="50000" step="1000" value="20000"
          class="w-full accent-blue-600">
      </div>
      <div>
        <button id="btn-inspect"
          class="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          Inspect
        </button>
      </div>
    </div>

    <!-- Autocomplete suggestions -->
    <div id="suggestions" class="hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700"></div>
  </div>

  <!-- Metrics Bar (hidden until results) -->
  <div id="metrics-bar" class="hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
    <div class="flex flex-wrap gap-6 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Found</span>
        <span id="m-found" class="font-semibold text-gray-900 dark:text-white">—</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Tokens</span>
        <span id="m-tokens" class="font-mono font-semibold text-gray-900 dark:text-white">—</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Chars</span>
        <span id="m-chars" class="font-mono font-semibold text-gray-900 dark:text-white">—</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Latency</span>
        <span id="m-latency" class="font-mono font-semibold text-gray-900 dark:text-white">—</span>
      </div>
      <div class="flex items-center gap-4 ml-auto">
        <span id="badge-docs" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">docs —</span>
        <span id="badge-source" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">source —</span>
        <span id="badge-rels" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">relationships —</span>
      </div>
    </div>
  </div>

  <!-- Context Output -->
  <div id="context-panel" class="hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Context sent to AI</span>
      <button id="btn-copy" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">Copy</button>
    </div>
    <pre id="context-output" class="p-4 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap max-h-[600px] overflow-y-auto"></pre>
  </div>

  <!-- History -->
  <div id="history-panel" class="hidden">
    <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Queries</h2>
    <div id="history-list" class="flex flex-wrap gap-2"></div>
  </div>

  <!-- Error panel -->
  <div id="error-panel" class="hidden rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200"></div>

</div>

<script>
(function () {
  const API_BASE = 'http://localhost:7337';
  const HISTORY_KEY = 'docs-kit-inspector-history';
  const MAX_HISTORY = 5;

  // Elements
  const elStatus = document.getElementById('server-status');
  const elDot = document.getElementById('status-dot');
  const elStatusText = document.getElementById('status-text');
  const elBanner = document.getElementById('offline-banner');
  const elMetrics = document.getElementById('metrics-bar');
  const elContextPanel = document.getElementById('context-panel');
  const elContextOutput = document.getElementById('context-output');
  const elHistoryPanel = document.getElementById('history-panel');
  const elHistoryList = document.getElementById('history-list');
  const elError = document.getElementById('error-panel');
  const elSuggestions = document.getElementById('suggestions');
  const elCharsLabel = document.getElementById('chars-label');
  const btnInspect = document.getElementById('btn-inspect');
  const btnCopy = document.getElementById('btn-copy');
  const inputSymbol = document.getElementById('input-symbol');
  const inputFile = document.getElementById('input-file');
  const inputMode = document.getElementById('input-mode');
  const inputChars = document.getElementById('input-chars');

  let serverOnline = false;

  // --- Server status check ---
  async function checkHealth() {
    try {
      const r = await fetch(API_BASE + '/api/health', { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        serverOnline = true;
        elDot.className = 'w-2 h-2 rounded-full bg-green-500 inline-block';
        elStatusText.textContent = 'online :7337';
        elStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300';
        elBanner.classList.add('hidden');
        return;
      }
    } catch (_) {}
    serverOnline = false;
    elDot.className = 'w-2 h-2 rounded-full bg-red-500 inline-block';
    elStatusText.textContent = 'offline';
    elStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    elBanner.classList.remove('hidden');
  }

  checkHealth();
  setInterval(checkHealth, 10000);

  // --- Chars slider ---
  inputChars.addEventListener('input', () => {
    const v = parseInt(inputChars.value, 10);
    elCharsLabel.textContent = v.toLocaleString();
  });

  // --- Autocomplete ---
  let suggestTimeout = null;
  inputSymbol.addEventListener('input', () => {
    clearTimeout(suggestTimeout);
    const q = inputSymbol.value.trim();
    if (q.length < 2 || !serverOnline) { elSuggestions.classList.add('hidden'); return; }
    suggestTimeout = setTimeout(() => fetchSuggestions(q), 250);
  });

  async function fetchSuggestions(q) {
    try {
      const r = await fetch(API_BASE + '/api/symbols/search?q=' + encodeURIComponent(q) + '&limit=8');
      if (!r.ok) return;
      const data = await r.json();
      if (!data.results || data.results.length === 0) { elSuggestions.classList.add('hidden'); return; }
      elSuggestions.innerHTML = data.results.map(s => {
        const file = s.file ? s.file.split('/').pop() : '';
        return '<button data-name="' + escHtml(s.name) + '" class="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30">' +
          '<span class="font-medium text-gray-900 dark:text-white">' + escHtml(s.name) + '</span>' +
          '<span class="ml-2 text-xs text-gray-400">' + escHtml(s.kind) + '</span>' +
          (file ? '<span class="ml-2 text-xs text-gray-400">' + escHtml(file) + '</span>' : '') +
          '</button>';
      }).join('');
      elSuggestions.classList.remove('hidden');
    } catch (_) {}
  }

  elSuggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-name]');
    if (btn) {
      inputSymbol.value = btn.dataset.name;
      elSuggestions.classList.add('hidden');
      runInspect();
    }
  });

  document.addEventListener('click', (e) => {
    if (!elSuggestions.contains(e.target) && e.target !== inputSymbol) {
      elSuggestions.classList.add('hidden');
    }
  });

  // --- Inspect ---
  btnInspect.addEventListener('click', runInspect);
  inputSymbol.addEventListener('keydown', (e) => { if (e.key === 'Enter') { elSuggestions.classList.add('hidden'); runInspect(); } });
  inputFile.addEventListener('keydown', (e) => { if (e.key === 'Enter') runInspect(); });

  async function runInspect() {
    const symbol = inputSymbol.value.trim();
    const file = inputFile.value.trim();
    const mode = inputMode.value;
    const maxContextChars = inputChars.value;

    if (!symbol && !file) {
      showError('Enter a symbol name or file path.');
      return;
    }
    if (!serverOnline) {
      showError('Inspector server is not running. Run: docs-kit serve --port 7337');
      return;
    }

    clearError();
    btnInspect.disabled = true;
    btnInspect.textContent = 'Loading…';

    try {
      const params = new URLSearchParams({ mode, maxContextChars });
      if (symbol) params.set('symbol', symbol);
      if (file) params.set('file', file);

      const r = await fetch(API_BASE + '/api/context?' + params.toString());
      const data = await r.json();

      if (!r.ok) { showError(data.error || 'Request failed'); return; }

      displayResults(data, symbol || file, mode);
      saveHistory(symbol || file, mode);
    } catch (err) {
      showError('Request failed: ' + err.message);
    } finally {
      btnInspect.disabled = false;
      btnInspect.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg> Inspect';
    }
  }

  function displayResults(data, label, mode) {
    // Metrics bar
    document.getElementById('m-found').textContent = data.found ? '✓ yes' : '✗ no';
    document.getElementById('m-found').className = 'font-semibold ' + (data.found ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400');
    document.getElementById('m-tokens').textContent = '~' + data.tokenEstimate.toLocaleString();
    document.getElementById('m-chars').textContent = data.charCount.toLocaleString();
    document.getElementById('m-latency').textContent = data.elapsedMs + 'ms';

    setBadge('badge-docs', data.hasDocs, 'docs');
    setBadge('badge-source', data.hasSource, 'source');
    setBadge('badge-rels', data.hasRelationships, 'relationships');

    elMetrics.classList.remove('hidden');

    // Context output
    elContextOutput.textContent = data.text;
    elContextPanel.classList.remove('hidden');
  }

  function setBadge(id, value, label) {
    const el = document.getElementById(id);
    el.textContent = value ? '✓ ' + label : '✗ ' + label;
    el.className = value
      ? 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500';
  }

  // --- Copy ---
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(elContextOutput.textContent);
      btnCopy.textContent = 'Copied!';
      setTimeout(() => { btnCopy.textContent = 'Copy'; }, 2000);
    } catch (_) {}
  });

  // --- History ---
  function saveHistory(label, mode) {
    let history = loadHistory();
    history = history.filter(h => h.label !== label);
    history.unshift({ label, mode, ts: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
    renderHistory();
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { return []; }
  }

  function renderHistory() {
    const history = loadHistory();
    if (history.length === 0) { elHistoryPanel.classList.add('hidden'); return; }
    elHistoryPanel.classList.remove('hidden');
    elHistoryList.innerHTML = history.map(h =>
      '<button data-label="' + escHtml(h.label) + '" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">' +
      '<svg class="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
      escHtml(h.label) + '</button>'
    ).join('');
  }

  elHistoryList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-label]');
    if (btn) {
      inputSymbol.value = btn.dataset.label;
      runInspect();
    }
  });

  renderHistory();

  // --- Helpers ---
  function showError(msg) {
    elError.textContent = msg;
    elError.classList.remove('hidden');
  }
  function clearError() { elError.classList.add('hidden'); elError.textContent = ''; }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
</script>
`;

  return layout("Inspector", "inspector.html", body, 0, "", docEntries);
}
