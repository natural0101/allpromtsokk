// Editor Outline / Table of Contents

let outlineUpdateTimeout = null;
let outlineContainer = null;
let textarea = null;
let previewContainer = null;

/**
 * Parse headings from markdown text
 * @param {string} text
 * @returns {Array<{level: number, text: string, position: number}>}
 */
function parseHeadings(text) {
  if (!text) return [];
  
  const headings = [];
  const lines = text.split('\n');
  let currentPosition = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Match markdown headings: #, ##, ###
    const match = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const headingText = match[2].trim();
      
      if (level >= 1 && level <= 3) {
        headings.push({
          level,
          text: headingText,
          position: currentPosition,
          lineIndex: i
        });
      }
    }
    
    currentPosition += line.length + 1; // +1 for newline
  }
  
  return headings;
}

/**
 * Render outline HTML
 * @param {Array<{level: number, text: string, position: number}>} headings
 */
function renderOutline(headings) {
  if (!outlineContainer) return;
  
  if (headings.length === 0) {
    outlineContainer.innerHTML = '<div class="outline-empty">Нет заголовков</div>';
    return;
  }
  
  const html = headings.map((heading, index) => {
    const indent = (heading.level - 1) * 12;
    const style = `padding-left: ${indent}px; font-size: ${heading.level === 1 ? '14px' : heading.level === 2 ? '13px' : '12px'};`;
    return `
      <div 
        class="outline-item outline-level-${heading.level}" 
        data-position="${heading.position}"
        data-line="${heading.lineIndex}"
        style="${style}"
        title="${heading.text}"
      >
        ${escapeHtml(heading.text)}
      </div>
    `;
  }).join('');
  
  outlineContainer.innerHTML = `<div class="outline-title">Содержание</div>${html}`;
  
  // Attach click handlers
  outlineContainer.querySelectorAll('.outline-item').forEach(item => {
    item.addEventListener('click', () => {
      const position = parseInt(item.dataset.position);
      const lineIndex = parseInt(item.dataset.line);
      scrollToHeading(position, lineIndex);
    });
  });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Scroll textarea to heading position
 * @param {number} position
 * @param {number} lineIndex
 */
function scrollToHeading(position, lineIndex) {
  if (!textarea) return;
  
  // Calculate approximate scroll position
  const lines = textarea.value.split('\n');
  const lineHeight = 20; // Approximate line height in pixels
  const scrollTop = lineIndex * lineHeight;
  
  // Scroll textarea
  textarea.scrollTop = Math.max(0, scrollTop - 50); // Offset for visibility
  
  // Set cursor position
  textarea.focus();
  textarea.setSelectionRange(position, position);
  
  // Scroll preview if in split mode
  if (previewContainer) {
    const previewPane = previewContainer.closest('.preview-pane');
    if (previewPane && previewPane.style.display !== 'none') {
      // Find corresponding heading in preview
      const previewHeadings = previewContainer.querySelectorAll('h1, h2, h3');
      if (previewHeadings[lineIndex]) {
        previewHeadings[lineIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}

/**
 * Update outline with debounce
 * @param {string} text
 */
function updateOutlineDebounced(text) {
  if (outlineUpdateTimeout) {
    clearTimeout(outlineUpdateTimeout);
  }
  
  outlineUpdateTimeout = setTimeout(() => {
    const headings = parseHeadings(text);
    renderOutline(headings);
  }, 400);
}

/**
 * Initialize outline
 * @param {HTMLTextAreaElement} textareaElement
 * @param {HTMLElement} outlineContainerElement
 * @param {HTMLElement} previewContainerElement
 */
export function initOutline(textareaElement, outlineContainerElement, previewContainerElement) {
  if (!textareaElement || !outlineContainerElement) return;
  
  textarea = textareaElement;
  outlineContainer = outlineContainerElement;
  previewContainer = previewContainerElement || null;
  
  // Initial update
  const headings = parseHeadings(textarea.value);
  renderOutline(headings);
  
  // Update on textarea input
  textarea.addEventListener('input', () => {
    updateOutlineDebounced(textarea.value);
  });
}

/**
 * Update outline manually
 * @param {string} text
 */
export function updateOutline(text) {
  if (!textarea) return;
  updateOutlineDebounced(text || textarea.value);
}

/**
 * Destroy outline
 */
export function destroyOutline() {
  if (outlineUpdateTimeout) {
    clearTimeout(outlineUpdateTimeout);
    outlineUpdateTimeout = null;
  }
  
  if (outlineContainer) {
    outlineContainer.innerHTML = '';
  }
  
  textarea = null;
  outlineContainer = null;
  previewContainer = null;
}


