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
 */
export function setupMarkdownToolbar(textarea) {
  if (!textarea) return;
  
  // Ищем тулбар в том же контейнере, что и textarea (внутри формы)
  const form = textarea.closest('form');
  if (!form) return;
  
  const toolbar = form.querySelector('.md-toolbar');
  if (!toolbar) return;
  
  toolbar.querySelectorAll('button[data-md]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const mdType = button.getAttribute('data-md');
      insertMarkdown(textarea, mdType);
      // Возвращаем фокус на textarea
      textarea.focus();
    });
  });
}

/**
 * Insert Markdown syntax into textarea at cursor position
 */
export function insertMarkdown(textarea, type) {
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);
  
  let insertText = '';
  let newCursorPos = start;
  
  switch (type) {
    case 'h1':
      insertText = '# ';
      newCursorPos = start + insertText.length;
      break;
      
    case 'h2':
      insertText = '## ';
      newCursorPos = start + insertText.length;
      break;
      
    case 'bold':
      if (selectedText) {
        insertText = `**${selectedText}**`;
        newCursorPos = start + insertText.length;
      } else {
        insertText = '****';
        newCursorPos = start + 2; // Курсор между звездочками
      }
      break;
      
    case 'italic':
      if (selectedText) {
        insertText = `*${selectedText}*`;
        newCursorPos = start + insertText.length;
      } else {
        insertText = '**';
        newCursorPos = start + 1; // Курсор между звездочками
      }
      break;
      
    case 'ul':
      if (selectedText) {
        // Если есть выделение, добавляем "- " к каждой строке
        const lines = selectedText.split('\n');
        insertText = lines.map(line => line ? `- ${line}` : '- ').join('\n');
        newCursorPos = start + insertText.length;
      } else {
        insertText = '- ';
        newCursorPos = start + insertText.length;
      }
      break;
      
    case 'ol':
      if (selectedText) {
        // Если есть выделение, добавляем "1. " к каждой строке
        const lines = selectedText.split('\n');
        insertText = lines.map((line, index) => line ? `${index + 1}. ${line}` : `${index + 1}. `).join('\n');
        newCursorPos = start + insertText.length;
      } else {
        insertText = '1. ';
        newCursorPos = start + insertText.length;
      }
      break;
      
    case 'quote':
      if (selectedText) {
        // Если есть выделение, добавляем "> " к каждой строке
        const lines = selectedText.split('\n');
        insertText = lines.map(line => line ? `> ${line}` : '> ').join('\n');
        newCursorPos = start + insertText.length;
      } else {
        insertText = '> ';
        newCursorPos = start + insertText.length;
      }
      break;
      
    case 'code':
      if (selectedText) {
        // Если есть выделение, оборачиваем в блок кода
        insertText = '```\n' + selectedText + '\n```';
        newCursorPos = start + insertText.length;
      } else {
        insertText = '```\n\n```';
        newCursorPos = start + 4; // Курсор между бэктиками
      }
      break;
      
    default:
      return;
  }
  
  // Вставляем текст
  const newText = text.substring(0, start) + insertText + text.substring(end);
  textarea.value = newText;
  
  // Устанавливаем позицию курсора
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  
  // Триггерим событие input для обновления состояния формы
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

