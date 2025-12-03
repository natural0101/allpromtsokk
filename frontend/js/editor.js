// Editor Logic

import * as state from './state.js';
import { renderMarkdown } from './utils.js';

/**
 * Auto-resize textarea with max height limit
 */
export function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const maxHeight = Math.min(window.innerHeight - 300, 800); // Максимальная высота
  const newHeight = Math.max(300, Math.min(textarea.scrollHeight, maxHeight));
  textarea.style.height = newHeight + 'px';
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

/**
 * Check if form has unsaved changes
 */
export function checkFormChanges() {
  const nameInput = document.getElementById('promptNameInput');
  const textInput = document.getElementById('promptTextInput');
  const folderInput = document.getElementById('promptFolderInput');
  const tagsInput = document.getElementById('promptTagsInput');

  if (!nameInput || !textInput || !state.getOriginalFormData()) return false;

  const importanceInput = document.getElementById('promptImportanceInput');
  
  const currentData = {
    name: nameInput.value.trim(),
    text: textInput.value.trim(),
    folder: folderInput?.value.trim() || null,
    tags: tagsInput?.value.trim() || null,
    importance: importanceInput?.value || 'normal',
  };

  const originalData = state.getOriginalFormData();

  return (
    currentData.name !== originalData.name ||
    currentData.text !== originalData.text ||
    currentData.folder !== originalData.folder ||
    currentData.tags !== originalData.tags ||
    currentData.importance !== originalData.importance
  );
}

/**
 * Show confirmation dialog for unsaved changes
 */
export function confirmUnsavedChanges() {
  if (state.getHasUnsavedChanges() && checkFormChanges()) {
    return confirm('У вас есть несохранённые изменения. Вы уверены, что хотите закрыть редактор?');
  }
  return true;
}

/**
 * Setup Markdown toolbar handlers
 * @param {HTMLTextAreaElement} textarea
 */
export function setupMarkdownToolbar(textarea) {
  if (!textarea) return;
  
  const form = textarea.closest('form');
  if (!form) return;
  
  const toolbar = form.querySelector('.md-toolbar');
  if (!toolbar) return;
  
  toolbar.querySelectorAll('button[data-md]').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const mdType = button.getAttribute('data-md');
      if (!mdType) return;
      insertMarkdown(textarea, mdType);
      textarea.focus();
    });
  });
}

/**
 * Apply transformation function to each selected line
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {(line: string, index: number) => string} transform
 * @returns {{ newText: string, newStart: number, newEnd: number }}
 */
function transformSelectedLines(text, start, end, transform) {
  const before = text.slice(0, start);
  const selection = text.slice(start, end);
  const after = text.slice(end);
  
  const lines = selection.split('\n');
  const transformedLines = lines.map((line, index) => transform(line, index));
  const newSelection = transformedLines.join('\n');
  
  const newText = before + newSelection + after;
  const newStart = start;
  const newEnd = start + newSelection.length;
  
  return { newText, newStart, newEnd };
}

/**
 * Insert Markdown syntax into textarea at cursor position
 * @param {HTMLTextAreaElement} textarea
 * @param {string} type
 */
export function insertMarkdown(textarea, type) {
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);
  
  let newText = text;
  let newCursorStart = start;
  let newCursorEnd = end;
  
  const hasSelection = start !== end;
  
  const wrapSelection = (prefix, suffix) => {
    const before = text.slice(0, start);
    const after = text.slice(end);
    const inner = selectedText || '';
    newText = before + prefix + inner + suffix + after;
    if (hasSelection) {
      newCursorStart = start + prefix.length;
      newCursorEnd = newCursorStart + inner.length;
    } else {
      newCursorStart = start + prefix.length;
      newCursorEnd = newCursorStart + inner.length;
    }
  };
  
  switch (type) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4': {
      const level = parseInt(type.slice(1), 10) || 1;
      const prefix = '#'.repeat(Math.min(Math.max(level, 1), 6)) + ' ';
      
      if (hasSelection) {
        ({ newText, newStart: newCursorStart, newEnd: newCursorEnd } =
          transformSelectedLines(text, start, end, (line) => {
            const trimmed = line.trimStart();
            const existingHashesMatch = trimmed.match(/^#{1,6}\s+/);
            if (existingHashesMatch) {
              return prefix + trimmed.slice(existingHashesMatch[0].length);
            }
            return line ? prefix + trimmed : prefix;
          }));
      } else {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const beforeLine = text.slice(0, lineStart);
        const line = text.slice(lineStart, end);
        const after = text.slice(end);
        const trimmed = line.trimStart();
        const existingHashesMatch = trimmed.match(/^#{1,6}\s+/);
        let newLine;
        if (existingHashesMatch) {
          newLine = prefix + trimmed.slice(existingHashesMatch[0].length);
        } else {
          newLine = prefix + trimmed;
        }
        newText = beforeLine + newLine + after;
        newCursorStart = lineStart + prefix.length;
        newCursorEnd = newCursorStart;
      }
      break;
    }
    
    case 'bold':
      wrapSelection('**', '**');
      break;
      
    case 'italic':
      wrapSelection('*', '*');
      break;
      
    case 'underline':
      wrapSelection('<u>', '</u>');
      break;
      
    case 'strike':
      wrapSelection('~~', '~~');
      break;
      
    case 'code-inline':
      wrapSelection('`', '`');
      break;
      
    case 'ul':
      if (hasSelection) {
        ({ newText, newStart: newCursorStart, newEnd: newCursorEnd } =
          transformSelectedLines(text, start, end, (line) => {
            const trimmed = line.trimStart();
            if (!trimmed) return '- ';
            if (/^[-*+]\s+/.test(trimmed)) return line;
            return `- ${trimmed}`;
          }));
      } else {
        wrapSelection('- ', '');
      }
      break;
      
    case 'ol':
      if (hasSelection) {
        let counter = 1;
        ({ newText, newStart: newCursorStart, newEnd: newCursorEnd } =
          transformSelectedLines(text, start, end, (line) => {
            const trimmed = line.trimStart();
            if (!trimmed) {
              return `${counter++}. `;
            }
            if (/^\d+\.\s+/.test(trimmed)) {
              counter++;
              return line;
            }
            return `${counter++}. ${trimmed}`;
          }));
      } else {
        wrapSelection('1. ', '');
      }
      break;
      
    case 'checklist':
      if (hasSelection) {
        ({ newText, newStart: newCursorStart, newEnd: newCursorEnd } =
          transformSelectedLines(text, start, end, (line) => {
            const trimmed = line.trimStart();
            if (!trimmed) return '- [ ] ';
            if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed)) return line;
            return `- [ ] ${trimmed}`;
          }));
      } else {
        wrapSelection('- [ ] ', '');
      }
      break;
      
    case 'quote':
      if (hasSelection) {
        ({ newText, newStart: newCursorStart, newEnd: newCursorEnd } =
          transformSelectedLines(text, start, end, (line) => {
            const trimmed = line.trimStart();
            if (!trimmed) return '> ';
            if (/^>\s+/.test(trimmed)) return line;
            return `> ${trimmed}`;
          }));
      } else {
        wrapSelection('> ', '');
      }
      break;
      
    case 'code':
    case 'code-block': {
      const inner = selectedText || '';
      const before = text.slice(0, start);
      const after = text.slice(end);
      if (hasSelection) {
        newText = `${before}\`\`\`\n${inner}\n\`\`\`${after}`;
        newCursorStart = start + 4;
        newCursorEnd = newCursorStart + inner.length;
      } else {
        newText = `${before}\`\`\`\n\n\`\`\`${after}`;
        newCursorStart = start + 4;
        newCursorEnd = newCursorStart;
      }
      break;
    }
    
    case 'link': {
      const label = selectedText || 'текст';
      const urlPlaceholder = 'https://';
      const before = text.slice(0, start);
      const after = text.slice(end);
      const linkMarkdown = `[${label}](${urlPlaceholder})`;
      newText = before + linkMarkdown + after;
      const urlStart =
        before.length + 1 + label.length + 1; // [ + label + ](
      newCursorStart = urlStart;
      newCursorEnd = urlStart + urlPlaceholder.length;
      break;
    }
    
    case 'table': {
      const header = '| Колонка 1 | Колонка 2 | Колонка 3 |';
      const separator = '| --- | --- | --- |';
      const row = '|  |  |  |';
      const tableMarkdown = `${header}\n${separator}\n${row}\n${row}\n${row}`;
      const before = text.slice(0, start);
      const after = text.slice(end);
      newText = `${before}${tableMarkdown}${after}`;
      newCursorStart = before.length + header.length + 1 + separator.length + 1 + 2; // примерно первая ячейка
      newCursorEnd = newCursorStart;
      break;
    }
    
    default:
      return;
  }
  
  textarea.value = newText;
  textarea.setSelectionRange(newCursorStart, newCursorEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Setup editor keyboard shortcuts (hotkeys)
 * @param {HTMLTextAreaElement} textarea
 */
export function setupEditorHotkeys(textarea) {
  if (!textarea) return;
  
  textarea.addEventListener('keydown', (e) => {
    const isMod = e.ctrlKey || e.metaKey;
    
    // Tab / Shift+Tab for list indentation
    if (e.key === 'Tab' && !isMod) {
      const text = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSelection = start !== end;
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = text.indexOf('\n', end);
      const selStart = lineStart;
      const selEnd = lineEnd === -1 ? text.length : lineEnd;
      const selection = text.slice(selStart, selEnd);
      
      const isListLine = (line) =>
        /^\s*([-*+]|\d+\.)\s+/.test(line) || /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line);
      
      const lines = selection.split('\n');
      if (!lines.some((line) => isListLine(line))) {
        return;
      }
      
      e.preventDefault();
      
      let newSelection;
      if (!e.shiftKey) {
        // indent
        newSelection = lines
          .map((line) => (line ? `  ${line}` : line))
          .join('\n');
      } else {
        // outdent
        newSelection = lines
          .map((line) =>
            line.startsWith('  ') ? line.slice(2) : line.replace(/^\s+/, ''),
          )
          .join('\n');
      }
      
      const before = text.slice(0, selStart);
      const after = text.slice(selEnd);
      const newText = before + newSelection + after;
      textarea.value = newText;
      const offset = newSelection.length - selection.length;
      const newStart = hasSelection ? start + (selStart === start ? 0 : 0) : start + offset;
      const newEnd = end + offset;
      textarea.setSelectionRange(newStart, newEnd);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    
    if (!isMod) return;
    
    const key = e.key.toLowerCase();
    
    // Ctrl+1..4 -> headings
    if (!e.shiftKey && ['1', '2', '3', '4'].includes(key)) {
      e.preventDefault();
      insertMarkdown(textarea, `h${key}`);
      return;
    }
    
    // Ctrl+B / Ctrl+I / Ctrl+U
    if (!e.shiftKey && key === 'b') {
      e.preventDefault();
      insertMarkdown(textarea, 'bold');
      return;
    }
    if (!e.shiftKey && key === 'i') {
      e.preventDefault();
      insertMarkdown(textarea, 'italic');
      return;
    }
    if (!e.shiftKey && key === 'u') {
      e.preventDefault();
      insertMarkdown(textarea, 'underline');
      return;
    }
    
    // Ctrl+K -> link
    if (!e.shiftKey && key === 'k') {
      e.preventDefault();
      insertMarkdown(textarea, 'link');
      return;
    }
    
    // Ctrl+Shift+C -> code block
    if (e.shiftKey && key === 'c') {
      e.preventDefault();
      insertMarkdown(textarea, 'code-block');
      return;
    }
    
    // Ctrl+Shift+Q -> quote
    if (e.shiftKey && key === 'q') {
      e.preventDefault();
      insertMarkdown(textarea, 'quote');
      return;
    }
    
    // Ctrl+F -> search
    if (!e.shiftKey && key === 'f') {
      e.preventDefault();
      import('./editorSearch.js').then(module => {
        module.openSearch('', false);
      });
      return;
    }
    
    // Ctrl+H -> search and replace
    if (!e.shiftKey && key === 'h') {
      e.preventDefault();
      import('./editorSearch.js').then(module => {
        module.openSearch('', true);
      });
      return;
    }
  });
}

/**
 * Editor preview mode management
 */
let previewUpdateTimeout = null;
let isScrollingSync = false;

/**
 * Update preview content with debounce
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} previewContainer
 */
function updatePreview(textarea, previewContainer) {
  if (!textarea || !previewContainer) return;
  
  const markdown = textarea.value || '';
  const html = renderMarkdown(markdown);
  previewContainer.innerHTML = html;
}

/**
 * Debounced preview update
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} previewContainer
 * @param {number} delay
 */
function debouncedUpdatePreview(textarea, previewContainer, delay = 250) {
  if (previewUpdateTimeout) {
    clearTimeout(previewUpdateTimeout);
  }
  previewUpdateTimeout = setTimeout(() => {
    updatePreview(textarea, previewContainer);
  }, delay);
}

/**
 * Setup scroll synchronization from textarea to preview
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} previewPane
 */
function setupPreviewScrollSync(textarea, previewPane) {
  if (!textarea || !previewPane) return;
  
  textarea.addEventListener('scroll', () => {
    if (isScrollingSync) return;
    
    const textareaScrollHeight = textarea.scrollHeight - textarea.clientHeight;
    if (textareaScrollHeight <= 0) return;
    
    const scrollPercent = textarea.scrollTop / textareaScrollHeight;
    const previewScrollHeight = previewPane.scrollHeight - previewPane.clientHeight;
    
    if (previewScrollHeight > 0) {
      isScrollingSync = true;
      previewPane.scrollTop = scrollPercent * previewScrollHeight;
      requestAnimationFrame(() => {
        isScrollingSync = false;
      });
    }
  });
}

/**
 * Switch editor mode (editor/preview/both)
 * @param {string} mode - 'editor' | 'preview' | 'both'
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} editorPane
 * @param {HTMLElement} previewPane
 * @param {HTMLElement} previewContainer
 */
export function switchEditorMode(mode, textarea, editorPane, previewPane, previewContainer) {
  if (!textarea || !editorPane || !previewPane || !previewContainer) return;
  
  // Hide/show panes based on mode
  switch (mode) {
    case 'editor':
      editorPane.style.display = 'block';
      editorPane.style.width = '100%';
      previewPane.style.display = 'none';
      // Ensure textarea is visible and focusable
      textarea.style.display = 'block';
      break;
      
    case 'preview':
      // Hide editor pane visually, but keep textarea in DOM for saving
      editorPane.style.display = 'none';
      previewPane.style.display = 'block';
      previewPane.style.width = '100%';
      // Update preview immediately when switching to preview mode
      updatePreview(textarea, previewContainer);
      break;
      
    case 'both':
      editorPane.style.display = 'block';
      editorPane.style.width = '50%';
      editorPane.style.flexShrink = '0';
      previewPane.style.display = 'block';
      previewPane.style.width = '50%';
      previewPane.style.flexShrink = '0';
      // Ensure textarea is visible
      textarea.style.display = 'block';
      // Update preview immediately when switching to split mode
      updatePreview(textarea, previewContainer);
      break;
      
    default:
      return;
  }
}

/**
 * Setup editor preview functionality
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement} previewContainer
 * @param {HTMLElement} editorPane
 * @param {HTMLElement} previewPane
 */
export function setupEditorPreview(textarea, previewContainer, editorPane, previewPane) {
  if (!textarea || !previewContainer) return;
  
  // Initial preview update
  updatePreview(textarea, previewContainer);
  
  // Update preview on textarea input (debounced)
  textarea.addEventListener('input', () => {
    debouncedUpdatePreview(textarea, previewContainer);
  });
  
  // Setup scroll sync (sync textarea scroll to preview pane)
  setupPreviewScrollSync(textarea, previewPane);
}

/**
 * Autosave and beforeunload protection
 */

let autosaveTimeout = null;
let beforeunloadHandler = null;
let originalText = '';
let currentPromptId = null;

/**
 * Get localStorage key for draft
 * @param {number|string|null} promptId
 * @returns {string}
 */
function getDraftKey(promptId) {
  return promptId ? `prompt_draft_${promptId}` : 'prompt_draft_new';
}

/**
 * Save draft to localStorage
 * @param {string} text
 * @param {number|string|null} promptId
 */
function saveDraft(text, promptId) {
  try {
    const key = getDraftKey(promptId);
    const draft = {
      text: text,
      updated_at: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.error('Ошибка сохранения черновика:', error);
  }
}

/**
 * Load draft from localStorage
 * @param {number|string|null} promptId
 * @returns {{ text: string, updated_at: number }|null}
 */
export function loadDraft(promptId) {
  try {
    const key = getDraftKey(promptId);
    const draftStr = localStorage.getItem(key);
    if (!draftStr) return null;
    return JSON.parse(draftStr);
  } catch (error) {
    console.error('Ошибка загрузки черновика:', error);
    return null;
  }
}

/**
 * Clear draft from localStorage
 * @param {number|string|null} promptId
 */
export function clearDraft(promptId) {
  try {
    const key = getDraftKey(promptId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Ошибка удаления черновика:', error);
  }
}

/**
 * Check if draft should be restored
 * @param {string} serverText
 * @param {number|string|null} promptId
 * @returns {boolean}
 */
export function shouldRestoreDraft(serverText, promptId) {
  const draft = loadDraft(promptId);
  if (!draft) return false;
  
  // Check if draft is different from server text
  if (draft.text.trim() === serverText.trim()) return false;
  
  // Draft exists and is different - user should decide
  return true;
}

/**
 * Restore draft to textarea
 * @param {HTMLTextAreaElement} textarea
 * @param {number|string|null} promptId
 * @returns {boolean} - true if draft was restored
 */
export function restoreDraft(textarea, promptId) {
  if (!textarea) return false;
  
  const draft = loadDraft(promptId);
  if (!draft) return false;
  
  textarea.value = draft.text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/**
 * Setup autosave for textarea
 * @param {HTMLTextAreaElement} textarea
 * @param {number|string|null} promptId
 * @param {number} delay - debounce delay in ms
 */
function setupAutosave(textarea, promptId, delay = 2500) {
  if (!textarea) return;
  
  textarea.addEventListener('input', () => {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }
    
    autosaveTimeout = setTimeout(() => {
      const text = textarea.value || '';
      saveDraft(text, promptId);
    }, delay);
  });
}

/**
 * Setup beforeunload protection
 * @param {HTMLTextAreaElement} textarea
 * @param {string} initialText
 */
function setupBeforeunload(textarea, initialText) {
  if (!textarea) return;
  
  // Remove existing handler if any
  if (beforeunloadHandler) {
    window.removeEventListener('beforeunload', beforeunloadHandler);
  }
  
  beforeunloadHandler = (e) => {
    const currentText = textarea.value || '';
    const hasChanges = currentText.trim() !== initialText.trim();
    
    if (hasChanges) {
      // Standard way to show browser's confirmation dialog
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  };
  
  window.addEventListener('beforeunload', beforeunloadHandler);
}

/**
 * Remove beforeunload protection
 */
export function removeBeforeunload() {
  if (beforeunloadHandler) {
    window.removeEventListener('beforeunload', beforeunloadHandler);
    beforeunloadHandler = null;
  }
}

/**
 * Setup autosave and beforeunload protection for editor
 * @param {HTMLTextAreaElement} textarea
 * @param {number|string|null} promptId
 * @param {string} initialText
 */
export function setupEditorProtection(textarea, promptId, initialText) {
  if (!textarea) return;
  
  // Store current prompt ID and original text
  currentPromptId = promptId;
  originalText = initialText || '';
  
  // Setup autosave
  setupAutosave(textarea, promptId);
  
  // Setup beforeunload protection
  setupBeforeunload(textarea, originalText);
}

/**
 * Update original text after successful save
 * @param {string} newText
 * @param {number|string|null} newPromptId
 */
export function updateEditorProtection(newText, newPromptId) {
  originalText = newText || '';
  
  // If prompt ID changed (new -> existing), clear old draft and update ID
  if (currentPromptId !== newPromptId) {
    if (currentPromptId !== null) {
      clearDraft(currentPromptId);
    }
    currentPromptId = newPromptId;
  }
  
  // Clear draft after successful save
  clearDraft(newPromptId);
  
  // Update beforeunload handler with new original text
  const textarea = document.getElementById('promptTextInput');
  if (textarea && beforeunloadHandler) {
    removeBeforeunload();
    setupBeforeunload(textarea, originalText);
  }
}

/**
 * Cleanup editor protection (call when closing editor)
 */
export function cleanupEditorProtection() {
  removeBeforeunload();
  if (autosaveTimeout) {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = null;
  }
  currentPromptId = null;
  originalText = '';
  
  // Also cleanup outline, search, and bracket highlighting
  import('./editorOutline.js').then(m => m.destroyOutline()).catch(() => {});
  import('./editorSearch.js').then(m => m.destroySearch()).catch(() => {});
  import('./editorBrackets.js').then(m => m.destroyBracketHighlighting()).catch(() => {});
}

