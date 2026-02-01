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
<div id="mermaid-fullscreen-modal" class="fixed inset-0 z-[100] hidden bg-black/80 flex items-center justify-center" aria-modal="true" role="dialog" style="display: none;">
  <div class="bg-white dark:bg-gray-800 w-full h-full flex flex-col">
    <div class="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Diagram — zoom with mouse wheel, drag to pan</span>
      <div class="flex items-center gap-2">
        <button type="button" id="mermaid-zoom-out" class="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg leading-none text-gray-700 dark:text-gray-300" title="Zoom out">−</button>
        <button type="button" id="mermaid-zoom-in" class="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg leading-none text-gray-700 dark:text-gray-300" title="Zoom in">+</button>
        <button type="button" id="mermaid-reset-zoom" class="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-lg leading-none text-gray-700 dark:text-gray-300" title="Reset zoom">◉</button>
        <button type="button" id="mermaid-modal-close" class="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300">Close (ESC)</button>
      </div>
    </div>
    <div id="mermaid-modal-pan-wrap" class="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-900" style="cursor: grab;">
      <div id="mermaid-modal-content" class="absolute inset-0 flex items-center justify-center" style="transform-origin: center center;"></div>
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
    var svg = content.querySelector('svg');
    if (svg) {
      svg.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
      svg.style.transformOrigin = 'center center';
      svg.style.transition = 'transform 0.1s ease-out';
    }
  }

  function showModal() {
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function hideModal() {
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      document.body.style.overflow = '';
      if (content) content.innerHTML = '';
    }
  }

  // Use event delegation to handle expand button clicks (works even if buttons are added later)
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.mermaid-expand-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    var wrapper = btn.closest('.mermaid-expand-wrapper');
    if (!wrapper || !content) {
      console.warn('Mermaid: wrapper or content not found');
      return;
    }

    // Find the already-rendered SVG in the wrapper
    var mermaidDiv = wrapper.querySelector('.mermaid');
    if (!mermaidDiv) {
      console.warn('Mermaid: .mermaid element not found');
      return;
    }

    var svg = mermaidDiv.querySelector('svg');
    if (!svg) {
      console.warn('Mermaid: SVG not found - diagram may not be rendered yet');
      return;
    }

    try {
      // Clone the SVG and display it in the modal
      var svgClone = svg.cloneNode(true);

      // Reset SVG size constraints to allow it to scale properly
      svgClone.style.maxWidth = 'none';
      svgClone.style.maxHeight = 'none';
      svgClone.style.width = 'auto';
      svgClone.style.height = 'auto';
      svgClone.style.cursor = 'grab';

      // Disable all clickable links in the expanded view
      var links = svgClone.querySelectorAll('a');
      links.forEach(function(link) {
        link.style.pointerEvents = 'none';
        link.style.cursor = 'grab';
        link.removeAttribute('href');
        link.removeAttribute('xlink:href');
      });

      content.innerHTML = '';
      content.appendChild(svgClone);

      scale = 1;
      translateX = 0;
      translateY = 0;
      applyTransform();
      showModal();
    } catch (e) {
      console.error('Mermaid expand failed:', e);
    }
  });

  // Zoom controls
  if (document.getElementById('mermaid-zoom-in')) {
    document.getElementById('mermaid-zoom-in').addEventListener('click', function() {
      scale = Math.min(5, scale + 0.3);
      applyTransform();
    });
  }

  if (document.getElementById('mermaid-zoom-out')) {
    document.getElementById('mermaid-zoom-out').addEventListener('click', function() {
      scale = Math.max(0.2, scale - 0.3);
      applyTransform();
    });
  }

  if (document.getElementById('mermaid-reset-zoom')) {
    document.getElementById('mermaid-reset-zoom').addEventListener('click', function() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      applyTransform();
    });
  }

  if (document.getElementById('mermaid-modal-close')) {
    document.getElementById('mermaid-modal-close').addEventListener('click', hideModal);
  }

  // Mouse wheel zoom
  if (panWrap) {
    panWrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.max(0.2, Math.min(5, scale * delta));
      applyTransform();
    }, { passive: false });
  }

  // Pan functionality
  if (panWrap) {
    panWrap.addEventListener('mousedown', function(e) {
      // Only pan if clicking on the background or SVG itself
      var svg = content.querySelector('svg');
      if (!svg) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTx = translateX;
      startTy = translateY;
      panWrap.style.cursor = 'grabbing';
      if (svg) svg.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
      if (isDragging) {
        translateX = startTx + e.clientX - startX;
        translateY = startTy + e.clientY - startY;
        applyTransform();
      }
    });

    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        panWrap.style.cursor = 'grab';
        var svg = content.querySelector('svg');
        if (svg) svg.style.cursor = 'grab';
      }
    });
  }

  // Modal close handlers
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) hideModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        hideModal();
      }
    });
  }

  // Prevent navigation from links inside modal content
  if (content) {
    content.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);
  }
})();
</script>`;
}
