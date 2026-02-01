/**
 * Mermaid diagram wrapper and modal functionality.
 */

import { escapeHtml, base64Encode } from "./utils.js";

/**
 * Wrap a Mermaid diagram with Expand button and data source for fullscreen zoom/pan modal.
 */
export function mermaidDiagramWrap(source: string): string {
  if (!source.trim()) return "";
  const b64 = base64Encode(source);
  return `<div class="mermaid-expand-wrapper relative group" data-mermaid-src-base64="${escapeHtml(b64)}">
  <div class="mermaid">${source}</div>
  <button type="button" class="mermaid-expand-btn absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium rounded bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 shadow hover:bg-white dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 opacity-70 group-hover:opacity-100 transition-opacity" title="Expand to fullscreen (zoom and pan)">Expand</button>
</div>`;
}

/**
 * Modal and script for fullscreen Mermaid with zoom and pan.
 * Include once per page that has diagrams.
 */
export function getMermaidExpandModalAndScript(): string {
  return `
<div id="mermaid-fullscreen-modal" class="fixed inset-0 z-[100] hidden bg-black/70 items-center justify-center" aria-modal="true" role="dialog" style="display: none;">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-[95vw] max-h-[95vh] flex flex-col m-4">
    <div class="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Diagram — zoom and drag to pan</span>
      <div class="flex items-center gap-2">
        <button type="button" id="mermaid-zoom-out" class="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg leading-none text-gray-700 dark:text-gray-300" title="Zoom out">−</button>
        <button type="button" id="mermaid-zoom-in" class="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg leading-none text-gray-700 dark:text-gray-300" title="Zoom in">+</button>
        <button type="button" id="mermaid-modal-close" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300">Close</button>
      </div>
    </div>
    <div id="mermaid-modal-pan-wrap" class="flex-1 overflow-hidden min-h-0 relative" style="cursor: grab;">
      <div id="mermaid-modal-content" class="p-4 inline-block origin-top-left" style="transform-origin: 0 0;"></div>
    </div>
  </div>
</div>
<script>
(function(){
  var modal = document.getElementById('mermaid-fullscreen-modal');
  var content = document.getElementById('mermaid-modal-content');
  var panWrap = document.getElementById('mermaid-modal-pan-wrap');
  var scale = 1, translateX = 0, translateY = 0;
  var isDragging = false, startX, startY, startTx, startTy;

  function applyTransform() {
    if (!content) return;
    content.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
  }

  function showModal() {
    if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  }
  function hideModal() {
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; document.body.style.overflow = ''; }
  }

  document.querySelectorAll('.mermaid-expand-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var wrapper = this.closest('.mermaid-expand-wrapper');
      if (!wrapper || !content || typeof mermaid === 'undefined') return;
      var b64 = wrapper.getAttribute('data-mermaid-src-base64');
      if (!b64) return;
      try {
        var src = atob(b64);
        content.innerHTML = '<div class="mermaid"></div>';
        var mermaidDiv = content.querySelector('.mermaid');
        if (!mermaidDiv) return;
        mermaidDiv.textContent = src;
        mermaid.run({ nodes: [mermaidDiv] }).then(function() {
          scale = 1; translateX = 0; translateY = 0;
          applyTransform();
          showModal();
        }).catch(function(e) { console.warn('Mermaid render failed', e); });
      } catch (e) { console.warn('Mermaid expand failed', e); }
    });
  });

  if (document.getElementById('mermaid-zoom-in')) {
    document.getElementById('mermaid-zoom-in').addEventListener('click', function() { scale = Math.min(3, scale + 0.2); applyTransform(); });
  }
  if (document.getElementById('mermaid-zoom-out')) {
    document.getElementById('mermaid-zoom-out').addEventListener('click', function() { scale = Math.max(0.3, scale - 0.2); applyTransform(); });
  }
  if (document.getElementById('mermaid-modal-close')) {
    document.getElementById('mermaid-modal-close').addEventListener('click', hideModal);
  }

  if (panWrap) {
    panWrap.addEventListener('mousedown', function(e) {
      if (e.target === panWrap || e.target.id === 'mermaid-modal-content' || (e.target.closest && e.target.closest('#mermaid-modal-content'))) {
        isDragging = true; startX = e.clientX; startY = e.clientY; startTx = translateX; startTy = translateY;
        panWrap.style.cursor = 'grabbing';
      }
    });
    document.addEventListener('mousemove', function(e) {
      if (isDragging) { translateX = startTx + e.clientX - startX; translateY = startTy + e.clientY - startY; applyTransform(); }
    });
    document.addEventListener('mouseup', function() { isDragging = false; if (panWrap) panWrap.style.cursor = 'grab'; });
    panWrap.addEventListener('mouseleave', function() { if (!isDragging) panWrap.style.cursor = 'grab'; });
  }

  if (modal) {
    modal.addEventListener('click', function(e) { if (e.target === modal) hideModal(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideModal(); });
  }
})();
</script>`;
}
