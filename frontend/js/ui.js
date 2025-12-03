// UI Rendering Functions

import * as state from './state.js';
import * as api from './api.js';
import { escapeHtml, highlightText, isCopyPrompt, renderMarkdown, showToast, showDeleteConfirm, getFolderMetadata, hasNestedFolders, showFolderSettings } from './utils.js';
import { loadPrompts, loadPrompt, loadPromptVersions } from './router.js';
import { confirmUnsavedChanges, setupMarkdownToolbar, setupEditorHotkeys } from './editor.js';

/**
 * Build folder tree structure from prompts list
 */
function buildFolderTree(promptsList) {
  const tree = {
    name: '',
    children: {},
    prompts: []
  };

  promptsList.forEach(prompt => {
    if (!prompt.folder || prompt.folder.trim() === '') {
      tree.prompts.push(prompt);
    } else {
      const pathParts = prompt.folder.split(' / ').map(p => p.trim()).filter(p => p);
      
      let current = tree;
      let currentPath = '';
      
      pathParts.forEach((part) => {
        currentPath = currentPath ? `${currentPath} / ${part}` : part;
        
        if (!current.children[currentPath]) {
          current.children[currentPath] = {
            name: part,
            fullPath: currentPath,
            children: {},
            prompts: []
          };
        }
        
        current = current.children[currentPath];
      });
      
      current.prompts.push(prompt);
    }
  });

  return tree;
}

/**
 * Check if node has prompts
 */
function hasPromptsInNode(node) {
  if (node.prompts && node.prompts.length > 0) {
    return true;
  }
  const childKeys = Object.keys(node.children || {});
  for (const childPath of childKeys) {
    if (hasPromptsInNode(node.children[childPath])) {
      return true;
    }
  }
  return false;
}

/**
 * Render prompts list
 */
export function renderPromptsList() {
  const container = document.getElementById('treeContainer');
  if (!container) return;

  container.innerHTML = '';
  
  const prompts = state.getPrompts();
  if (prompts.length === 0) {
    container.innerHTML = '<div style="padding: 16px; color: #888; text-align: center;">Промпты не найдены. Создайте новый промпт.</div>';
    updateFolderFilter();
    return;
  }

  const tree = buildFolderTree(prompts);
  renderFolderTree(tree, container);

  updateFolderFilter();
  updateTagFilter();
}

/**
 * Render folder tree
 */
function renderFolderTree(tree, container) {
  if (tree.prompts.length > 0) {
    const noFolderNode = {
      name: 'Без папки',
      fullPath: '__no_folder__',
      children: {},
      prompts: tree.prompts
    };
    const noFolderElement = renderFolderNode(noFolderNode, 0);
    container.appendChild(noFolderElement);
  }

  const folderKeys = Object.keys(tree.children).sort();
  folderKeys.forEach(folderPath => {
    const folderNode = tree.children[folderPath];
    if (hasPromptsInNode(folderNode)) {
      const element = renderFolderNode(folderNode, 0);
      container.appendChild(element);
    }
  });
}

/**
 * Render folder node
 */
function renderFolderNode(node, level) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.folderPath = node.fullPath;
  
  const collapsedFolders = state.getCollapsedFolders();
  const isCollapsed = collapsedFolders.has(node.fullPath);
  const indent = level * 20;
  const hasNested = hasNestedFolders(node);
  const folderMeta = getFolderMetadata(node.fullPath);
  const isMainFolder = folderMeta.isMainFolder;
  
  const itemDiv = document.createElement('div');
  let itemClasses = 'tree-node-item';
  if (hasNested) itemClasses += ' tree-node-folder-nested';
  if (isMainFolder) itemClasses += ' tree-node-folder-main';
  itemDiv.className = itemClasses;
  itemDiv.setAttribute('data-action', 'toggle-folder');
  itemDiv.style.paddingLeft = `${indent}px`;
  
  const toggleSpan = document.createElement('span');
  toggleSpan.className = 'tree-node-toggle';
  toggleSpan.style.marginRight = '4px';
  toggleSpan.style.cursor = 'pointer';
  toggleSpan.style.userSelect = 'none';
  toggleSpan.textContent = isCollapsed ? '►' : '▼';
  toggleSpan.setAttribute('data-action', 'toggle-folder');
  
  const iconSpan = document.createElement('span');
  iconSpan.className = 'tree-node-icon';
  if (hasNested) {
    iconSpan.className += ' tree-node-icon-nested';
  }
  iconSpan.textContent = node.fullPath === '__no_folder__' ? '📂' : '📁';
  iconSpan.style.marginRight = '6px';
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'tree-node-title';
  titleSpan.textContent = node.name;
  titleSpan.setAttribute('data-action', 'toggle-folder');

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'tree-node-settings';
  settingsBtn.innerHTML = '⚙️';
  settingsBtn.setAttribute('title', 'Настройки папки');
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showFolderSettings(node.fullPath, itemDiv);
    // Re-render will be triggered by the settings handler
  });

  itemDiv.appendChild(toggleSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(titleSpan);
  if (node.fullPath !== '__no_folder__') {
    itemDiv.appendChild(settingsBtn);
  }

  itemDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    itemDiv.classList.add('drag-over');
  });

  itemDiv.addEventListener('dragleave', (e) => {
    const rect = itemDiv.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      itemDiv.classList.remove('drag-over');
    }
  });

  itemDiv.addEventListener('drop', async (e) => {
    e.preventDefault();
    itemDiv.classList.remove('drag-over');
    
    const slug = e.dataTransfer.getData('text/plain');
    if (slug) {
      const { handleDropPromptToFolder } = await import('./events.js');
      await handleDropPromptToFolder(slug, node.fullPath);
    }
  });
  
  div.appendChild(itemDiv);
  
  if (!isCollapsed) {
    const childKeys = Object.keys(node.children).sort();
    childKeys.forEach(childPath => {
      const childNode = node.children[childPath];
      if (hasPromptsInNode(childNode)) {
        const childElement = renderFolderNode(childNode, level + 1);
        div.appendChild(childElement);
      }
    });

    node.prompts.forEach(prompt => {
      const promptElement = renderPromptItem(prompt);
      const promptIndent = (level + 1) * 20;
      const itemDiv = promptElement.querySelector('.tree-node-item');
      if (itemDiv) {
        itemDiv.style.paddingLeft = `${promptIndent}px`;
      }
      div.appendChild(promptElement);
    });
  }
  
  return div;
}

/**
 * Update folder filter dropdown
 */
function updateFolderFilter() {
  const folderFilter = document.getElementById('folderFilter');
  if (!folderFilter) return;
  
  const prompts = state.getPrompts();
  const folders = new Set();
  prompts.forEach(prompt => {
    if (prompt.folder) {
      folders.add(prompt.folder);
    }
  });
    
  const currentValue = folderFilter.value;
  folderFilter.innerHTML = '<option value="">Все папки</option>';
  
  Array.from(folders).sort().forEach(folder => {
    const option = document.createElement('option');
    option.value = folder;
    option.textContent = folder;
    folderFilter.appendChild(option);
  });

  if (currentValue && folders.has(currentValue)) {
    folderFilter.value = currentValue;
  }
}

/**
 * Update tag filter dropdown
 */
async function updateTagFilter() {
  const tagFilter = document.getElementById('tagFilter');
  if (!tagFilter) return;
  
  let allPrompts = [];
  try {
    allPrompts = await api.fetchPrompts(null, null);
  } catch (error) {
    console.error('Ошибка загрузки промптов для тегов:', error);
    return;
  }
  
  const tagCounts = new Map();
  allPrompts.forEach(prompt => {
    if (prompt.tags) {
      const promptTags = prompt.tags.split(',').map(t => t.trim()).filter(t => t);
      promptTags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }
  });
    
  const currentValue = tagFilter.value;
  tagFilter.innerHTML = '<option value="">Все теги</option>';
  
  Array.from(tagCounts.keys()).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    const count = tagCounts.get(tag);
    option.textContent = `${tag} (${count})`;
    tagFilter.appendChild(option);
  });

  if (currentValue && tagCounts.has(currentValue)) {
    tagFilter.value = currentValue;
  }
}

/**
 * Render prompt item in tree
 */
function renderPromptItem(prompt) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.slug = prompt.slug;
  div.draggable = false;

  const selectedPromptSlug = state.getSelectedPromptSlug();
  const isSelected = selectedPromptSlug === prompt.slug;

  const itemDiv = document.createElement('div');
  itemDiv.className = `tree-node-item ${isSelected ? 'selected' : ''}`;
  itemDiv.setAttribute('data-action', 'select');
  itemDiv.draggable = true;

  const indentSpan = document.createElement('span');
  indentSpan.style.width = '16px';
  indentSpan.style.display = 'inline-block';
  indentSpan.style.flexShrink = '0';
    
  const iconSpan = document.createElement('span');
  iconSpan.className = 'tree-node-icon';
  const importance = prompt.importance || 'normal';
  if (importance === 'important') {
    iconSpan.className += ' prompt-important';
  } else if (importance === 'test') {
    iconSpan.className += ' prompt-test';
  } else {
    iconSpan.className += ' prompt-normal';
  }
  iconSpan.textContent = '📄';
  iconSpan.style.marginRight = '6px';

  const contentDiv = document.createElement('div');
  contentDiv.style.flex = '1';
  contentDiv.style.minWidth = '0';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'tree-node-title';
  titleSpan.setAttribute('data-action', 'select');
  titleSpan.style.display = 'block';
  titleSpan.style.marginBottom = '6px';
  
  let titleContent = '';
  if (isCopyPrompt(prompt.name)) {
    titleContent += '<span class="copy-icon" title="Копия промпта">📋</span> ';
  }
  
  const searchQuery = document.getElementById('searchInput')?.value.trim() || '';
  titleContent += highlightText(prompt.name || 'Без названия', searchQuery);
  titleSpan.innerHTML = titleContent;
    
  const metaDiv = document.createElement('div');
  metaDiv.style.fontSize = '8px';
  metaDiv.style.color = 'rgba(58, 42, 79, 0.6)';
  metaDiv.style.display = 'flex';
  metaDiv.style.gap = '4px';
  metaDiv.style.flexWrap = 'wrap';
  metaDiv.style.alignItems = 'center';

  if (prompt.tags) {
    const tagsArray = prompt.tags.split(',').map(t => t.trim()).filter(t => t);
    tagsArray.forEach(tag => {
      const tagChip = document.createElement('span');
      tagChip.className = 'tag-chip';
      tagChip.textContent = tag;
      tagChip.style.cursor = 'pointer';
      tagChip.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagFilter = document.getElementById('tagFilter');
        if (tagFilter) {
          tagFilter.value = tag;
          const folder = document.getElementById('folderFilter')?.value || null;
          const search = document.getElementById('searchInput')?.value.trim() || null;
          loadPrompts(folder, search, tag);
        }
      });
      metaDiv.appendChild(tagChip);
    });
  }

  contentDiv.appendChild(titleSpan);
  contentDiv.appendChild(metaDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tree-node-actions';

  const duplicateBtn = document.createElement('button');
  duplicateBtn.className = 'tree-node-action';
  duplicateBtn.setAttribute('data-action', 'duplicate');
  duplicateBtn.setAttribute('title', 'Дублировать');
  duplicateBtn.textContent = '📋';

  const editBtn = document.createElement('button');
  editBtn.className = 'tree-node-action';
  editBtn.setAttribute('data-action', 'edit');
  editBtn.setAttribute('title', 'Редактировать');
  editBtn.textContent = '✏️';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tree-node-action delete';
  deleteBtn.setAttribute('data-action', 'delete');
  deleteBtn.setAttribute('title', 'Удалить');
  deleteBtn.textContent = '🗑️';

  actionsDiv.appendChild(duplicateBtn);
  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);

  itemDiv.appendChild(indentSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(contentDiv);
  itemDiv.appendChild(actionsDiv);

  div.appendChild(itemDiv);

  itemDiv.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', prompt.slug);
    e.dataTransfer.effectAllowed = 'move';
    itemDiv.classList.add('dragging');
  });

  itemDiv.addEventListener('dragend', (e) => {
    itemDiv.classList.remove('dragging');
    document.querySelectorAll('.tree-node-item.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  });

  return div;
}

/**
 * Render editor (view or edit mode)
 */
export function renderEditor(prompt) {
  const container = document.getElementById('editorContent');
  if (!container) return;
  
  if (!prompt) {
    container.innerHTML = `
      <div class="editor-placeholder">
        <p>Выберите промпт слева для просмотра и редактирования</p>
      </div>
    `;
    state.setIsEditMode(false);
    return;
  }
  
  if (state.getIsEditMode()) {
    renderEditForm(prompt);
  } else {
    renderViewMode(prompt);
  }
}

/**
 * Render view mode
 */
export function renderViewMode(prompt) {
  const container = document.getElementById('editorContent');
  
  let tagsHtml = '';
  if (prompt.tags) {
    const tagsArray = prompt.tags.split(',').map(t => t.trim()).filter(t => t);
    const importance = prompt.importance || 'normal';
    tagsHtml = tagsArray.map(tag => {
      let chipClass = 'tag-chip';
      if (importance === 'important') chipClass += ' tag-chip-important';
      else if (importance === 'test') chipClass += ' tag-chip-test';
      return `<span class="${chipClass}" data-tag="${escapeHtml(tag)}" style="cursor: pointer;">${escapeHtml(tag)}</span>`;
    }).join('');
  }
  
  const copyIcon = isCopyPrompt(prompt.name) ? '<span class="copy-icon" title="Копия промпта" style="margin-right: 6px;">📋</span>' : '';
  
  const importance = prompt.importance || 'normal';
  let importanceBadge = '';
  if (importance === 'important') {
    importanceBadge = '<span class="importance-badge importance-important">Важный</span>';
  } else if (importance === 'test') {
    importanceBadge = '<span class="importance-badge importance-test">Тестовый</span>';
  } else {
    importanceBadge = '<span class="importance-badge importance-normal">Обычный</span>';
  }
  
  container.innerHTML = `
    <div class="editor-header">
      <div style="flex: 1;">
        <h2 style="font-size: 22px; font-weight: 600; margin: 0; color: var(--brandInk); display: flex; align-items: center; gap: 8px;">
          ${copyIcon}${highlightText(prompt.name || 'Без названия', document.getElementById('searchInput')?.value.trim() || '')}
        </h2>
        <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: rgba(58, 42, 79, 0.6); align-items: center; flex-wrap: wrap;">
          ${importanceBadge}
          ${prompt.folder ? `<span>📁 ${escapeHtml(prompt.folder)}</span>` : ''}
          ${tagsHtml ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${tagsHtml}</div>` : ''}
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn" id="copyTextBtn">Скопировать текст</button>
        <button class="btn" id="duplicatePromptBtn">Дублировать</button>
        <button class="btn" id="editPromptBtn" style="display: none;">Редактировать</button>
        <button class="btn btn-danger" id="deletePromptBtn" style="display: none;">Удалить</button>
      </div>
    </div>
    <div class="editor-tabs">
      <button class="editor-tab active" data-tab="text">Текст</button>
      <button class="editor-tab" data-tab="history">История</button>
    </div>
    <div class="editor-body">
      <div id="textTabContent" class="tab-content active">
        <div class="markdown-content">${renderMarkdown(prompt.text || '')}</div>
      </div>
      <div id="historyTabContent" class="tab-content">
        <div class="history-container">
          <div class="history-list" id="historyList"></div>
          <div class="history-view" id="historyView"></div>
        </div>
        <div class="history-diff" id="historyDiff"></div>
      </div>
    </div>
        `;
  
  container.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      const tagFilter = document.getElementById('tagFilter');
      if (tagFilter) {
        tagFilter.value = tag;
        const folder = document.getElementById('folderFilter')?.value || null;
        const search = document.getElementById('searchInput')?.value.trim() || null;
        loadPrompts(folder, search, tag);
      }
    });
  });
  
  const copyBtn = document.getElementById('copyTextBtn');
  const duplicateBtn = document.getElementById('duplicatePromptBtn');
  const editBtn = document.getElementById('editPromptBtn');
  const deleteBtn = document.getElementById('deletePromptBtn');

  const currentUser = state.getCurrentUser();
  const canEditPrompts = currentUser && (currentUser.access_level === 'admin' || currentUser.access_level === 'tech');
  if (editBtn) {
    editBtn.style.display = canEditPrompts ? 'block' : 'none';
  }
  if (deleteBtn) {
    deleteBtn.style.display = canEditPrompts ? 'block' : 'none';
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(prompt.text || '');
        showToast('Скопировано');
      } catch (error) {
        console.error('Ошибка копирования:', error);
        const textArea = document.createElement('textarea');
        textArea.value = prompt.text || '';
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          showToast('Скопировано');
        } catch (err) {
          console.error('Ошибка копирования (fallback):', err);
        }
        document.body.removeChild(textArea);
      }
    });
  }

  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', async () => {
      const { handleDuplicatePrompt } = await import('./events.js');
      await handleDuplicatePrompt(prompt.slug);
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (state.getIsEditMode() && !confirmUnsavedChanges()) {
        return;
      }
      state.setIsEditMode(true);
      renderEditForm(prompt);
    });
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showDeleteConfirm(`Удалить промпт "${prompt.name}"?`);
      if (confirmed) {
        const { handleDeletePrompt } = await import('./events.js');
        await handleDeletePrompt(prompt.slug);
      }
    });
  }
  
  const textTab = container.querySelector('[data-tab="text"]');
  const historyTab = container.querySelector('[data-tab="history"]');
  const textTabContent = document.getElementById('textTabContent');
  const historyTabContent = document.getElementById('historyTabContent');
  
  if (textTab && historyTab) {
    textTab.addEventListener('click', () => {
      textTab.classList.add('active');
      historyTab.classList.remove('active');
      textTabContent?.classList.add('active');
      historyTabContent?.classList.remove('active');
    });
    
    historyTab.addEventListener('click', () => {
      historyTab.classList.add('active');
      textTab.classList.remove('active');
      historyTabContent?.classList.add('active');
      textTabContent?.classList.remove('active');
      loadPromptVersions(prompt.id);
    });
  }
}

/**
 * Render edit form
 */
export function renderEditForm(prompt = null) {
  const isNew = !prompt;
  const container = document.getElementById('editorContent');
  
  state.setOriginalFormData({
    name: prompt?.name || '',
    text: prompt?.text || '',
    folder: prompt?.folder || null,
    tags: prompt?.tags || null,
    importance: prompt?.importance || 'normal',
  });
  state.setHasUnsavedChanges(false);

  container.innerHTML = `
    <div class="editor-header">
      <h2 style="font-size: 22px; font-weight: 600; margin: 0; color: var(--brandInk);">
        ${isNew ? 'Создать промпт' : 'Редактировать промпт'}
      </h2>
      <div class="editor-actions">
        <button class="btn" id="cancelEditBtn">Отмена</button>
        <button class="btn" id="savePromptBtn">Сохранить</button>
      </div>
    </div>
    <div class="editor-body">
      <form id="promptForm" style="display: flex; flex-direction: column; gap: 16px; height: 100%;">
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--brandInk);">Название *</label>
          <input 
            type="text" 
            id="promptNameInput"
            class="modal-input"
            value="${prompt ? escapeHtml(prompt.name) : ''}"
            placeholder="Название промпта"
            required
          />
        </div>
        <div class="editor-field">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="editor-label" style="margin: 0; font-weight: 500; color: var(--brandInk);">Текст *</label>
            <div class="editor-mode-switcher" style="display: flex; gap: 4px; background: #f5f5f5; border-radius: 4px; padding: 2px;">
              <button type="button" class="mode-btn active" data-mode="editor" style="padding: 4px 12px; border: none; background: transparent; cursor: pointer; border-radius: 3px; font-size: 13px;">Редактор</button>
              <button type="button" class="mode-btn" data-mode="preview" style="padding: 4px 12px; border: none; background: transparent; cursor: pointer; border-radius: 3px; font-size: 13px;">Просмотр</button>
              <button type="button" class="mode-btn" data-mode="both" style="padding: 4px 12px; border: none; background: transparent; cursor: pointer; border-radius: 3px; font-size: 13px;">Оба</button>
            </div>
          </div>
          <div class="md-toolbar">
            <button type="button" data-md="h1">H1</button>
            <button type="button" data-md="h2">H2</button>
            <button type="button" data-md="h3">H3</button>
            <button type="button" data-md="h4">H4</button>
            <span class="md-toolbar-separator">|</span>
            <button type="button" data-md="bold"><b>B</b></button>
            <button type="button" data-md="italic"><i>I</i></button>
            <button type="button" data-md="underline"><u>U</u></button>
            <button type="button" data-md="strike"><s>S</s></button>
            <span class="md-toolbar-separator">|</span>
            <button type="button" data-md="ul">• Список</button>
            <button type="button" data-md="ol">1. Список</button>
            <button type="button" data-md="checklist">☑ Чеклист</button>
            <span class="md-toolbar-separator">|</span>
            <button type="button" data-md="quote">" Цитата</button>
            <button type="button" data-md="code-inline">code</button>
            <button type="button" data-md="code-block">Code</button>
            <span class="md-toolbar-separator">|</span>
            <button type="button" data-md="link">🔗 Ссылка</button>
            <button type="button" data-md="table">▦ Таблица</button>
          </div>
          <div class="editor-panes-container" style="display: flex; gap: 8px; min-height: 300px;">
            <div class="editor-pane" id="editorPane" style="display: block; width: 100%; flex-shrink: 0;">
              <textarea 
                id="promptTextInput"
                class="editor-textarea"
                placeholder="Текст промпта (Markdown)..."
                required
                style="width: 100%; min-height: 300px; resize: vertical;"
              >${prompt ? escapeHtml(prompt.text) : ''}</textarea>
            </div>
            <div class="preview-pane" id="previewPane" style="display: none; width: 50%; border: 1px solid #ddd; border-radius: 4px; padding: 12px; overflow-y: auto; background: #fff; min-height: 300px;">
              <div id="previewContainer" class="preview-content markdown-content" style="line-height: 1.6; color: #333;"></div>
            </div>
          </div>
        </div>
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--brandInk);">Папка</label>
          <input 
            type="text" 
            id="promptFolderInput"
            class="modal-input"
            value="${prompt && prompt.folder ? escapeHtml(prompt.folder) : ''}"
            placeholder="Название папки (необязательно)"
          />
        </div>
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--brandInk);">Теги</label>
          <input 
            type="text" 
            id="promptTagsInput"
            class="modal-input"
            value="${prompt && prompt.tags ? escapeHtml(prompt.tags) : ''}"
            placeholder="Теги через запятую (необязательно)"
          />
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById('promptForm');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const saveBtn = document.getElementById('savePromptBtn');
  const nameInput = document.getElementById('promptNameInput');
  const textInput = document.getElementById('promptTextInput');
  const folderInput = document.getElementById('promptFolderInput');
  const tagsInput = document.getElementById('promptTagsInput');
  
  setupMarkdownToolbar(textInput);
  setupEditorHotkeys(textInput);
  
  // Setup editor preview and mode switching
  const editorPane = document.getElementById('editorPane');
  const previewPane = document.getElementById('previewPane');
  const previewContainer = document.getElementById('previewContainer');
  const modeButtons = document.querySelectorAll('.mode-btn');
  
  let currentMode = 'editor';
  
  // Import editor functions dynamically to avoid circular dependency
  import('./editor.js').then(editorModule => {
    const { autoResizeTextarea, checkFormChanges, setupEditorPreview, switchEditorMode } = editorModule;
    
    // Setup preview functionality
    if (textInput && previewContainer && editorPane && previewPane) {
      setupEditorPreview(textInput, previewContainer, editorPane, previewPane);
    }
    
    // Setup mode switcher
    const toolbar = form.querySelector('.md-toolbar');
    
    modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = btn.getAttribute('data-mode');
        if (!mode || mode === currentMode) return;
        
        currentMode = mode;
        
        // Update button states
        modeButtons.forEach(b => {
          if (b.getAttribute('data-mode') === mode) {
            b.classList.add('active');
            b.style.background = '#fff';
            b.style.fontWeight = '500';
          } else {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.fontWeight = 'normal';
          }
        });
        
        // Show/hide toolbar based on mode
        if (toolbar) {
          if (mode === 'preview') {
            toolbar.style.display = 'none';
          } else {
            toolbar.style.display = 'flex';
          }
        }
        
        // Switch editor mode
        if (textInput && editorPane && previewPane && previewContainer) {
          switchEditorMode(mode, textInput, editorPane, previewPane, previewContainer);
        }
      });
    });
    
    function updateTextareaBorder() {
      if (textInput) {
        if (state.getHasUnsavedChanges() && checkFormChanges()) {
          textInput.style.borderColor = '#7c3aed';
        } else {
          textInput.style.borderColor = '';
        }
      }
    }

    if (textInput) {
      setTimeout(() => {
        autoResizeTextarea(textInput);
        updateTextareaBorder();
      }, 0);
      
      textInput.addEventListener('input', () => {
        autoResizeTextarea(textInput);
        state.setHasUnsavedChanges(true);
        updateTextareaBorder();
      });
      
      textInput.addEventListener('paste', () => {
        setTimeout(() => {
          autoResizeTextarea(textInput);
          state.setHasUnsavedChanges(true);
          updateTextareaBorder();
        }, 0);
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        state.setHasUnsavedChanges(true);
        updateTextareaBorder();
      });
    }

    if (folderInput) {
      folderInput.addEventListener('input', () => {
        state.setHasUnsavedChanges(true);
        updateTextareaBorder();
      });
    }

    if (tagsInput) {
      tagsInput.addEventListener('input', () => {
        state.setHasUnsavedChanges(true);
        updateTextareaBorder();
      });
    }
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { handleSavePrompt } = await import('./events.js');
      await handleSavePrompt(prompt?.slug);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (!confirmUnsavedChanges()) return;
      
      state.setHasUnsavedChanges(false);
      state.setOriginalFormData(null);
      
      if (textInput) {
        textInput.style.borderColor = '';
      }
      
      if (prompt) {
        state.setIsEditMode(false);
        renderViewMode(prompt);
      } else {
        renderEditor(null);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const { handleSavePrompt } = await import('./events.js');
      await handleSavePrompt(prompt?.slug);
    });
  }
}

