// Utility Functions

export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function isCopyPrompt(name) {
  return name && name.trim().endsWith(' (копия)');
}

// Folder metadata management
const folderMetadata = JSON.parse(localStorage.getItem('folderMetadata') || '{}');

export function getFolderMetadata(folderPath) {
  return folderMetadata[folderPath] || { isMainFolder: false };
}

export function setFolderMetadata(folderPath, metadata) {
  folderMetadata[folderPath] = metadata;
  localStorage.setItem('folderMetadata', JSON.stringify(folderMetadata));
}

export function hasNestedFolders(node) {
  const childKeys = Object.keys(node.children || {});
  return childKeys.length > 0;
}

export function highlightText(text, searchQuery) {
  if (!searchQuery || !text) return escapeHtml(text);
  const query = searchQuery.trim();
  if (!query) return escapeHtml(text);
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const highlighted = escapeHtml(text).replace(regex, '<mark>$1</mark>');
  return highlighted;
}

export function showToast(message) {
  // Удаляем существующий тост, если есть
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Показываем тост
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Скрываем и удаляем тост через 2 секунды
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

export function showFolderSettings(folderPath, itemElement) {
  // Удаляем существующий поповер
  const existingPopover = document.getElementById('folderSettingsPopover');
  if (existingPopover) {
    existingPopover.remove();
  }
  
  const folderMeta = getFolderMetadata(folderPath);
  const isMainFolder = folderMeta.isMainFolder;
  
  const popover = document.createElement('div');
  popover.id = 'folderSettingsPopover';
  popover.className = 'folder-settings-popover';
  
  const rect = itemElement.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${rect.right - 200}px`;
  
  popover.innerHTML = `
    <div class="folder-settings-content">
      <label class="folder-settings-checkbox">
        <input type="checkbox" ${isMainFolder ? 'checked' : ''} id="folderMainCheckbox">
        <span>Папка направления</span>
      </label>
    </div>
  `;
  
  document.body.appendChild(popover);
  
  const checkbox = popover.querySelector('#folderMainCheckbox');
  checkbox.addEventListener('change', (e) => {
    const newMeta = { isMainFolder: e.target.checked };
    setFolderMetadata(folderPath, newMeta);
    // Re-render will be handled by the caller
  });
  
  // Закрытие при клике вне поповера
  const closeHandler = (e) => {
    if (!popover.contains(e.target) && e.target !== itemElement.querySelector('.tree-node-settings')) {
      popover.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeHandler);
  }, 100);
}

export function showDeleteConfirm(message) {
  return new Promise((resolve) => {
    // Удаляем существующую модалку, если есть
    const existingModal = document.getElementById('deleteModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'delete-modal-overlay';
    overlay.id = 'deleteModal';
    
    const modal = document.createElement('div');
    modal.className = 'delete-modal';
    
    modal.innerHTML = `
      <div class="delete-modal-header">Подтвердите действие</div>
      <div class="delete-modal-text">${escapeHtml(message)}</div>
      <div class="delete-modal-actions">
        <button class="delete-modal-btn delete-modal-btn-cancel">Нет</button>
        <button class="delete-modal-btn delete-modal-btn-confirm">Да</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const cancelBtn = modal.querySelector('.delete-modal-btn-cancel');
    const confirmBtn = modal.querySelector('.delete-modal-btn-confirm');
    
    const close = (result) => {
      overlay.style.animation = 'fadeOut 0.2s ease';
      modal.style.animation = 'slideDown 0.2s ease';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        resolve(result);
      }, 200);
    };
    
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close(false);
      }
    });
    
    // Добавляем стили для анимации закрытия
    if (!document.getElementById('deleteModalStyles')) {
      const style = document.createElement('style');
      style.id = 'deleteModalStyles';
      style.textContent = `
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slideDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(20px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  });
}

/**
 * Рендерит Markdown-текст в HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }
  
  // Проверяем, что библиотека marked доступна
  if (typeof marked === 'undefined') {
    console.warn('Marked library not loaded, rendering as plain text');
    return escapeHtml(markdown).replace(/\n/g, '<br>');
  }
  
  try {
    // Настройка marked для поддержки data:URL и других особенностей
    // Для marked v11+ используем новый API с опциями
    const markedOptions = {
      breaks: true, // Преобразует \n в <br>
      gfm: true, // GitHub Flavored Markdown
      headerIds: false, // Отключаем автоматические ID для заголовков
      mangle: false, // Не обфусцируем email адреса
    };
    
    // Настраиваем renderer для изображений, чтобы разрешить data:URL
    const renderer = new marked.Renderer();
    const originalImage = renderer.image.bind(renderer);
    
    renderer.image = function(href, title, text) {
      // Разрешаем data:URL и обычные URL
      if (href && (href.startsWith('data:') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/'))) {
        let out = '<img src="' + escapeHtml(href) + '" alt="' + escapeHtml(text || '') + '"';
        if (title) {
          out += ' title="' + escapeHtml(title) + '"';
        }
        out += '>';
        return out;
      }
      // Для других случаев используем стандартный рендер
      return originalImage(href, title, text);
    };
    
    markedOptions.renderer = renderer;
    
    // Используем marked для парсинга Markdown с нашими настройками
    return marked.parse(markdown, markedOptions);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // В случае ошибки возвращаем экранированный текст
    return escapeHtml(markdown).replace(/\n/g, '<br>');
  }
}

