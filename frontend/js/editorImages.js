// Editor Image Support (Paste and Drag&Drop)

import { insertAtCursor } from './editor.js';

let textarea = null;
let pasteHandler = null;
let dragoverHandler = null;
let dropHandler = null;

const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB

/**
 * Process image file and insert as markdown
 * @param {File} file
 * @param {HTMLTextAreaElement} textareaElement
 */
function processImageFile(file, textareaElement) {
  if (!file || !textareaElement) return;
  
  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    alert(`Изображение слишком большое (${(file.size / 1024 / 1024).toFixed(2)} МБ). Максимальный размер: 3 МБ.`);
    return;
  }
  
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    return; // Not an image, let default behavior handle it
  }
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const dataURL = e.target.result;
    const mimeType = file.type || 'image/png';
    
    // Insert markdown image syntax
    const markdownImage = `![](${dataURL})`;
    insertAtCursor(textareaElement, markdownImage, true);
  };
  
  reader.onerror = () => {
    alert('Ошибка при чтении файла изображения.');
  };
  
  reader.readAsDataURL(file);
}

/**
 * Handle paste event
 * @param {ClipboardEvent} e
 */
function handlePaste(e) {
  if (!textarea) return;
  
  const items = e.clipboardData?.items;
  if (!items) return;
  
  // Look for image in clipboard
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      
      const file = item.getAsFile();
      if (file) {
        processImageFile(file, textarea);
      }
      return;
    }
  }
  
  // No image found, let default paste behavior work
}

/**
 * Handle dragover event
 * @param {DragEvent} e
 */
function handleDragOver(e) {
  if (!textarea) return;
  
  // Check if dragging files
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
}

/**
 * Handle drop event
 * @param {DragEvent} e
 */
function handleDrop(e) {
  if (!textarea) return;
  
  e.preventDefault();
  
  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;
  
  // Find first image file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.type.startsWith('image/')) {
      processImageFile(file, textarea);
      return; // Process only first image
    }
  }
}

/**
 * Initialize image paste support
 * @param {HTMLTextAreaElement} textareaElement
 */
export function initImagePaste(textareaElement) {
  if (!textareaElement) return;
  
  textarea = textareaElement;
  pasteHandler = handlePaste;
  
  textarea.addEventListener('paste', pasteHandler);
}

/**
 * Initialize image drag and drop support
 * @param {HTMLTextAreaElement} textareaElement
 */
export function initImageDragAndDrop(textareaElement) {
  if (!textareaElement) return;
  
  textarea = textareaElement;
  dragoverHandler = handleDragOver;
  dropHandler = handleDrop;
  
  textarea.addEventListener('dragover', dragoverHandler);
  textarea.addEventListener('drop', dropHandler);
}

/**
 * Destroy image paste support
 */
export function destroyImagePaste() {
  if (textarea && pasteHandler) {
    textarea.removeEventListener('paste', pasteHandler);
    pasteHandler = null;
  }
  textarea = null;
}

/**
 * Destroy image drag and drop support
 */
export function destroyImageDragAndDrop() {
  if (textarea) {
    if (dragoverHandler) {
      textarea.removeEventListener('dragover', dragoverHandler);
      dragoverHandler = null;
    }
    if (dropHandler) {
      textarea.removeEventListener('drop', dropHandler);
      dropHandler = null;
    }
  }
  textarea = null;
}

