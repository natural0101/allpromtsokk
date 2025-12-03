// Editor Logic

import * as state from './state.js';

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
  });
}

