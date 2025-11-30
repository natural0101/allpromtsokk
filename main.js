// API Configuration
const API_BASE = '/api';

// State
let prompts = [];
let selectedPromptSlug = null;
let currentPrompt = null;
let isEditMode = false;
let collapsedFolders = new Set(); // Хранит пути свернутых папок
let hasUnsavedChanges = false; // Флаг несохранённых изменений
let originalFormData = null; // Исходные данные формы для сравнения
let isAuthenticated = false; // Флаг авторизации

// ---------- API FUNCTIONS ----------

async function fetchPrompts(folder = null, search = null) {
  try {
    const params = new URLSearchParams();
    if (folder) params.append('folder', folder);
    if (search) params.append('search', search);
    
    const url = `${API_BASE}/prompts${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 401) {
        showLoginScreen();
        throw new Error('Unauthorized');
      }
      if (response.status === 403) {
        const reason = response.headers.get('X-Reason');
        if (reason === 'status_not_active') {
          showPendingScreen();
          throw new Error('Access denied: status not active');
        }
        throw new Error('Forbidden');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки промптов:', error);
    throw error;
  }
}

async function fetchPromptBySlug(slug) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${slug}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 401) {
        showLoginScreen();
        return null;
      }
      if (response.status === 403) {
        const reason = response.headers.get('X-Reason');
        if (reason === 'status_not_active') {
          showPendingScreen();
        }
        return null;
      }
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки промпта:', error);
    throw error;
  }
}

async function createPrompt(data) {
  try {
    const response = await fetch(`${API_BASE}/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      if (response.status === 401) {
        showLoginScreen();
        throw new Error('Unauthorized');
      }
      if (response.status === 403) {
        // Доступ запрещён - кнопка не должна быть видна для не-админов, но на всякий случай
        console.warn('Доступ запрещён: только администраторы могут создавать промпты');
        throw new Error('Forbidden');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка создания промпта:', error);
    throw error;
    }
  }

async function updatePrompt(slug, data) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${slug}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      if (response.status === 401) {
        showLoginScreen();
        return null;
      }
      if (response.status === 403) {
        // Доступ запрещён - кнопка не должна быть видна для не-админов, но на всякий случай
        console.warn('Доступ запрещён: только администраторы могут редактировать промпты');
        return null;
      }
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка обновления промпта:', error);
    throw error;
  }
}

async function deletePrompt(slug) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${slug}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 401) {
        showLoginScreen();
        return false;
      }
      if (response.status === 403) {
        // Доступ запрещён - кнопка не должна быть видна для не-админов, но на всякий случай
        console.warn('Доступ запрещён: только администраторы могут удалять промпты');
        return false;
      }
      if (response.status === 404) return false;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error('Ошибка удаления промпта:', error);
    throw error;
  }
}

// ---------- DATA LOADING ----------

async function loadPrompts(folder = null, search = null, tag = null) {
  try {
    let allPrompts = await fetchPrompts(folder, search);
    
    // Фильтрация по тегу
    if (tag && tag.trim() !== '') {
      allPrompts = allPrompts.filter(prompt => {
        if (!prompt.tags) return false;
        const tags = prompt.tags.split(',').map(t => t.trim()).filter(t => t);
        return tags.includes(tag);
      });
    }
    
    prompts = allPrompts;
    renderPromptsList();
  } catch (error) {
    console.error('Ошибка загрузки промптов:', error);
    const container = document.getElementById('treeContainer');
    if (container) {
      container.innerHTML = '<div style="padding: 16px; color: #888; text-align: center;">Ошибка загрузки промптов. Проверьте подключение к серверу.</div>';
}
  }
}

async function loadPrompt(slug) {
  // Проверяем несохранённые изменения перед переключением
  if (isEditMode && !confirmUnsavedChanges()) {
    return;
  }
  
  try {
    const prompt = await fetchPromptBySlug(slug);
    if (!prompt) {
      hasUnsavedChanges = false;
      originalFormData = null;
      renderEditor(null);
      return;
    }
    currentPrompt = prompt;
    selectedPromptSlug = slug;
    hasUnsavedChanges = false;
    originalFormData = null;
    renderEditor(prompt);
    renderPromptsList(); // Обновить выделение в списке
  } catch (error) {
    console.error('Ошибка загрузки промпта:', error);
    hasUnsavedChanges = false;
    originalFormData = null;
    renderEditor(null);
  }
}

// ---------- TREE BUILDING ----------

function buildFolderTree(promptsList) {
  const tree = {
    name: '',
    children: {},
    prompts: []
  };

  promptsList.forEach(prompt => {
    if (!prompt.folder || prompt.folder.trim() === '') {
      // Промпты без папки
      tree.prompts.push(prompt);
    } else {
      // Разбиваем путь по разделителю " / "
      const pathParts = prompt.folder.split(' / ').map(p => p.trim()).filter(p => p);
      
      let current = tree;
      let currentPath = '';
      
      pathParts.forEach((part, index) => {
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
      
      // Добавляем промпт в конечную папку
      current.prompts.push(prompt);
    }
  });

  return tree;
}

// ---------- RENDERING ----------

function renderPromptsList() {
  const container = document.getElementById('treeContainer');
  if (!container) return;

  container.innerHTML = '';
  
  if (prompts.length === 0) {
    container.innerHTML = '<div style="padding: 16px; color: #888; text-align: center;">Промпты не найдены. Создайте новый промпт.</div>';
    updateFolderFilter();
    return;
  }

  // Строим дерево из промптов
  const tree = buildFolderTree(prompts);
  
  // Рендерим дерево
  renderFolderTree(tree, container);

  updateFolderFilter();
  updateTagFilter();
}

function hasPromptsInNode(node) {
  // Проверяем, есть ли промпты в этой папке
  if (node.prompts && node.prompts.length > 0) {
    return true;
  }
  // Проверяем дочерние папки
  const childKeys = Object.keys(node.children || {});
  for (const childPath of childKeys) {
    if (hasPromptsInNode(node.children[childPath])) {
      return true;
    }
  }
  return false;
}

function renderFolderTree(tree, container) {
  // Сначала рендерим группу "Без папки", если есть промпты без папки
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

  // Затем рендерим папки (только те, где есть промпты)
  const folderKeys = Object.keys(tree.children).sort();
  folderKeys.forEach(folderPath => {
    const folderNode = tree.children[folderPath];
    // Показываем папку только если в ней есть промпты
    if (hasPromptsInNode(folderNode)) {
      const element = renderFolderNode(folderNode, 0);
      container.appendChild(element);
    }
  });
}

function renderFolderNode(node, level) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.folderPath = node.fullPath;
  
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
  // Для группы "Без папки" используем другую иконку
  iconSpan.textContent = node.fullPath === '__no_folder__' ? '📂' : '📁';
  iconSpan.style.marginRight = '6px';
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'tree-node-title';
  titleSpan.textContent = node.name;
  titleSpan.setAttribute('data-action', 'toggle-folder');

  // Иконка настроек папки
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'tree-node-settings';
  settingsBtn.innerHTML = '⚙️';
  settingsBtn.setAttribute('title', 'Настройки папки');
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showFolderSettings(node.fullPath, itemDiv);
  });

  itemDiv.appendChild(toggleSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(titleSpan);
  if (node.fullPath !== '__no_folder__') {
    itemDiv.appendChild(settingsBtn);
  }

  // Drag & Drop handlers для папки
  itemDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    itemDiv.classList.add('drag-over');
  });

  itemDiv.addEventListener('dragleave', (e) => {
    // Проверяем, что мы действительно покинули элемент (не перешли на дочерний)
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
      await handleDropPromptToFolder(slug, node.fullPath);
    }
  });
  
  div.appendChild(itemDiv);
  
  // Рендерим дочерние элементы, если папка развернута
  if (!isCollapsed) {
    // Сначала дочерние папки (только те, где есть промпты)
    const childKeys = Object.keys(node.children).sort();
    childKeys.forEach(childPath => {
      const childNode = node.children[childPath];
      // Показываем дочернюю папку только если в ней есть промпты
      if (hasPromptsInNode(childNode)) {
        const childElement = renderFolderNode(childNode, level + 1);
        div.appendChild(childElement);
      }
    });

    // Затем промпты в этой папке
    node.prompts.forEach(prompt => {
      const promptElement = renderPromptItem(prompt);
      // Задаем отступ снаружи к внутреннему элементу itemDiv
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

function updateFolderFilter() {
  const folderFilter = document.getElementById('folderFilter');
  if (!folderFilter) return;
  
  // Собираем уникальные папки
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

  // Восстанавливаем выбранное значение
  if (currentValue && folders.has(currentValue)) {
    folderFilter.value = currentValue;
  }
}

async function updateTagFilter() {
  const tagFilter = document.getElementById('tagFilter');
  if (!tagFilter) return;
  
  // Загружаем все промпты для сбора всех уникальных тегов
  let allPrompts = [];
  try {
    allPrompts = await fetchPrompts(null, null);
  } catch (error) {
    console.error('Ошибка загрузки промптов для тегов:', error);
    return;
  }
  
  // Собираем уникальные теги и считаем количество промптов с каждым тегом
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

  // Восстанавливаем выбранное значение
  if (currentValue && tagCounts.has(currentValue)) {
    tagFilter.value = currentValue;
  }
}

function renderPromptItem(prompt) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.slug = prompt.slug;
  // Внешний div не должен быть draggable
  div.draggable = false;

  const isSelected = selectedPromptSlug === prompt.slug;

  const itemDiv = document.createElement('div');
  itemDiv.className = `tree-node-item ${isSelected ? 'selected' : ''}`;
  itemDiv.setAttribute('data-action', 'select');
  // Только itemDiv должен быть draggable
  itemDiv.draggable = true;

  // Пустой индент для выравнивания с папками (место для стрелки)
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
  
  // Иконка копии, если это копия
  let titleContent = '';
  if (isCopyPrompt(prompt.name)) {
    titleContent += '<span class="copy-icon" title="Копия промпта">📋</span> ';
  }
  
  // Подсветка совпадений в названии
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

  // Drag & Drop handlers для промпта
  itemDiv.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', prompt.slug);
    e.dataTransfer.effectAllowed = 'move';
    itemDiv.classList.add('dragging');
  });

  itemDiv.addEventListener('dragend', (e) => {
    itemDiv.classList.remove('dragging');
    // Убираем подсветку со всех папок
    document.querySelectorAll('.tree-node-item.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  });

  return div;
}

function renderEditor(prompt) {
  const container = document.getElementById('editorContent');
  if (!container) return;
  
  if (!prompt) {
    container.innerHTML = `
      <div class="editor-placeholder">
        <p>Выберите промпт слева для просмотра и редактирования</p>
      </div>
    `;
    isEditMode = false;
    return;
  }
  
  if (isEditMode) {
    renderEditForm(prompt);
  } else {
    renderViewMode(prompt);
  }
}

function renderViewMode(prompt) {
  const container = document.getElementById('editorContent');
  
  // Формируем HTML для тегов-чипов
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
  
  // Иконка копии
  const copyIcon = isCopyPrompt(prompt.name) ? '<span class="copy-icon" title="Копия промпта" style="margin-right: 6px;">📋</span>' : '';
  
  // Бейдж importance
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
    <div class="editor-body">
      <div class="markdown-content">${renderMarkdown(prompt.text || '')}</div>
    </div>
        `;
  
  // Добавляем обработчики клика на чипы тегов
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

  // Обновляем видимость кнопок редактирования/удаления в зависимости от прав
  // Пользователь может редактировать промпты, если он admin или tech
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
        // Fallback для старых браузеров
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
      await handleDuplicatePrompt(prompt.slug);
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      // Проверяем несохранённые изменения перед переключением в режим редактирования
      if (isEditMode && !confirmUnsavedChanges()) {
        return;
      }
      isEditMode = true;
      renderEditForm(prompt);
    });
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showDeleteConfirm(`Удалить промпт "${prompt.name}"?`);
      if (confirmed) {
        await handleDeletePrompt(prompt.slug);
      }
    });
  }
}

// Функция авто-увеличения высоты textarea (с ограничением максимальной высоты)
function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const maxHeight = Math.min(window.innerHeight - 300, 800); // Максимальная высота
  const newHeight = Math.max(300, Math.min(textarea.scrollHeight, maxHeight));
  textarea.style.height = newHeight + 'px';
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

// Проверка наличия несохранённых изменений
function checkFormChanges() {
  const nameInput = document.getElementById('promptNameInput');
  const textInput = document.getElementById('promptTextInput');
  const folderInput = document.getElementById('promptFolderInput');
  const tagsInput = document.getElementById('promptTagsInput');

  if (!nameInput || !textInput || !originalFormData) return false;

  const importanceInput = document.getElementById('promptImportanceInput');
  
  const currentData = {
    name: nameInput.value.trim(),
    text: textInput.value.trim(),
    folder: folderInput?.value.trim() || null,
    tags: tagsInput?.value.trim() || null,
    importance: importanceInput?.value || 'normal',
  };

  return (
    currentData.name !== originalFormData.name ||
    currentData.text !== originalFormData.text ||
    currentData.folder !== originalFormData.folder ||
    currentData.tags !== originalFormData.tags ||
    currentData.importance !== originalFormData.importance
  );
}

// Показ предупреждения о несохранённых изменениях
function confirmUnsavedChanges() {
  if (hasUnsavedChanges && checkFormChanges()) {
    return confirm('У вас есть несохранённые изменения. Вы уверены, что хотите закрыть редактор?');
  }
  return true;
}

function renderEditForm(prompt = null) {
  const isNew = !prompt;
  const container = document.getElementById('editorContent');
  
  // Сохраняем исходные данные для сравнения
  originalFormData = {
    name: prompt?.name || '',
    text: prompt?.text || '',
    folder: prompt?.folder || null,
    tags: prompt?.tags || null,
    importance: prompt?.importance || 'normal',
  };
  hasUnsavedChanges = false;

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
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--brandInk);">Текст *</label>
          <textarea 
            id="promptTextInput"
            class="editor-textarea"
            placeholder="Текст промпта (Markdown)..."
            required
          >${prompt ? escapeHtml(prompt.text) : ''}</textarea>
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
  const importanceInput = document.getElementById('promptImportanceInput');
  
  // Обработчики для переключателя типа промпта
  const importanceButtons = container.querySelectorAll('.importance-btn');
  importanceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      importanceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (importanceInput) {
        importanceInput.value = btn.dataset.importance;
        hasUnsavedChanges = true;
        updateTextareaBorder();
      }
    });
  });

  // Функция для обновления стиля рамки textarea
  function updateTextareaBorder() {
    if (textInput) {
      if (hasUnsavedChanges && checkFormChanges()) {
        textInput.style.borderColor = '#7c3aed';
      } else {
        textInput.style.borderColor = '';
      }
    }
  }

  // Авто-увеличение высоты textarea
  if (textInput) {
    // Инициализация высоты при загрузке
    setTimeout(() => {
      autoResizeTextarea(textInput);
      updateTextareaBorder();
    }, 0);
    
    textInput.addEventListener('input', () => {
      autoResizeTextarea(textInput);
      hasUnsavedChanges = true;
      updateTextareaBorder();
    });
    
    // Обработка вставки текста
    textInput.addEventListener('paste', () => {
      setTimeout(() => {
        autoResizeTextarea(textInput);
        hasUnsavedChanges = true;
        updateTextareaBorder();
      }, 0);
    });
  }

  // Отслеживание изменений в форме
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      hasUnsavedChanges = true;
      updateTextareaBorder();
    });
  }

  if (folderInput) {
    folderInput.addEventListener('input', () => {
      hasUnsavedChanges = true;
      updateTextareaBorder();
    });
  }

  if (tagsInput) {
    tagsInput.addEventListener('input', () => {
      hasUnsavedChanges = true;
      updateTextareaBorder();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSavePrompt(prompt?.slug);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (!confirmUnsavedChanges()) return;
      
      hasUnsavedChanges = false;
      originalFormData = null;
      
      // Обновляем стиль рамки textarea
      if (textInput) {
        textInput.style.borderColor = '';
      }
      
      if (prompt) {
        isEditMode = false;
        renderViewMode(prompt);
      } else {
        renderEditor(null);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await handleSavePrompt(prompt?.slug);
    });
  }
}

// ---------- EVENT HANDLERS ----------

function setupPromptsListEvents() {
  const container = document.getElementById('treeContainer');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const nodeElement = e.target.closest('.tree-node');
    if (!nodeElement) return;

    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;

    // Обработка папок
    if (nodeElement.dataset.folderPath) {
      if (action === 'toggle-folder') {
        const folderPath = nodeElement.dataset.folderPath;
        toggleFolder(folderPath);
      }
      return;
    }

    // Обработка промптов
    const slug = nodeElement.dataset.slug;
    if (!slug) return;

    if (action === 'select') {
      // Проверяем несохранённые изменения перед выбором другого промпта
      if (isEditMode && !confirmUnsavedChanges()) {
        return;
      }
      await loadPrompt(slug);
    } else if (action === 'duplicate') {
      e.stopPropagation();
      await handleDuplicatePrompt(slug);
    } else if (action === 'edit') {
      e.stopPropagation();
      // Проверяем несохранённые изменения перед редактированием
      if (isEditMode && !confirmUnsavedChanges()) {
        return;
      }
      const prompt = prompts.find(p => p.slug === slug);
      if (prompt) {
        isEditMode = true;
        renderEditForm(prompt);
      }
    } else if (action === 'delete') {
      e.stopPropagation();
      const prompt = prompts.find(p => p.slug === slug);
      if (prompt) {
        const confirmed = await showDeleteConfirm(`Удалить промпт "${prompt.name}"?`);
        if (confirmed) {
          await handleDeletePrompt(slug);
        }
      }
    }
  });
}

function toggleFolder(folderPath) {
  if (collapsedFolders.has(folderPath)) {
    collapsedFolders.delete(folderPath);
  } else {
    collapsedFolders.add(folderPath);
  }
  renderPromptsList();
  // После перерисовки нужно восстановить выделение выбранного промпта
  if (selectedPromptSlug) {
    // Выделение восстановится автоматически в renderPromptItem
  }
}

async function handleSavePrompt(slug = null) {
  const nameInput = document.getElementById('promptNameInput');
  const textInput = document.getElementById('promptTextInput');
  const folderInput = document.getElementById('promptFolderInput');
  const tagsInput = document.getElementById('promptTagsInput');
  const importanceInput = document.getElementById('promptImportanceInput');

  if (!nameInput || !textInput) return;

  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  const folderValue = folderInput?.value.trim() || null;
  const tagsValue = tagsInput?.value.trim() || null;
  const importanceValue = importanceInput?.value || 'normal';

  if (!name || !text) {
    alert('Название и текст обязательны для заполнения');
    return;
  }

  try {
    const data = {
      name,
      text,
      folder: folderValue,
      tags: tagsValue,
      importance: importanceValue,
    };

    let savedPrompt;
    if (slug) {
      savedPrompt = await updatePrompt(slug, data);
      if (!savedPrompt) {
        alert('Промпт не найден');
        return;
      }
    } else {
      savedPrompt = await createPrompt(data);
    }

    hasUnsavedChanges = false;
    originalFormData = null;

    await loadPrompts();
    isEditMode = false;
    await loadPrompt(savedPrompt.slug);
  } catch (error) {
    console.error('Ошибка сохранения промпта:', error);
    alert('Ошибка сохранения промпта. Проверьте консоль для деталей.');
  }
}

async function handleDuplicatePrompt(slug) {
  try {
    const prompt = prompts.find(p => p.slug === slug);
    if (!prompt) {
      alert('Промпт не найден');
      return;
    }

    const data = {
      name: `${prompt.name} (копия)`,
      text: prompt.text,
      folder: prompt.folder || null,
      tags: prompt.tags || null,
      importance: prompt.importance || 'normal',
    };

    const duplicatedPrompt = await createPrompt(data);
    
    // Обновить список
    const folder = document.getElementById('folderFilter')?.value || null;
    const search = document.getElementById('searchInput')?.value.trim() || null;
    const tag = document.getElementById('tagFilter')?.value || null;
    await loadPrompts(folder, search, tag);
    
    // Открыть дублированный промпт
    await loadPrompt(duplicatedPrompt.slug);
  } catch (error) {
    console.error('Ошибка дублирования промпта:', error);
    alert('Ошибка дублирования промпта. Проверьте консоль для деталей.');
  }
}

async function handleDeletePrompt(slug) {
  try {
    const success = await deletePrompt(slug);
    if (!success) {
      alert('Промпт не найден');
      return;
    }

    // Обновить список и очистить редактор
    const folder = document.getElementById('folderFilter')?.value || null;
    const search = document.getElementById('searchInput')?.value.trim() || null;
    const tag = document.getElementById('tagFilter')?.value || null;
    await loadPrompts(folder, search, tag);
    if (selectedPromptSlug === slug) {
      selectedPromptSlug = null;
      currentPrompt = null;
      renderEditor(null);
    }
  } catch (error) {
    console.error('Ошибка удаления промпта:', error);
    alert('Ошибка удаления промпта. Проверьте консоль для деталей.');
    }
  }

async function handleDropPromptToFolder(slug, folderPath) {
  const prompt = prompts.find(p => p.slug === slug);
  if (!prompt) return;
  
  const newFolder = folderPath === '__no_folder__' ? null : folderPath;
  
  // Если папка не изменилась — ничего не делаем
  if ((prompt.folder || null) === newFolder) return;

  const data = {
    name: prompt.name,
    text: prompt.text,
    folder: newFolder,
    tags: prompt.tags || null,
    importance: prompt.importance || 'normal',
  };

  try {
    const updated = await updatePrompt(slug, data);
    // После обновления перезагружаем список с теми же фильтрами/поиском
    await loadPrompts(
      document.getElementById('folderFilter')?.value || null,
      document.getElementById('searchInput')?.value.trim() || null,
      document.getElementById('tagFilter')?.value || null
    );
  } catch (e) {
    console.error('Ошибка DnD-обновления папки:', e);
    alert('Не удалось переместить промпт. Проверьте консоль.');
  }
}

// ---------- HEADER BUTTONS ----------

function setupHeaderButtons() {
  const newPromptBtn = document.getElementById('newPromptBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminUsersBtn = document.getElementById('adminUsersBtn');
  const logoutFromPendingBtn = document.getElementById('logoutFromPendingBtn');

  if (newPromptBtn) {
    newPromptBtn.addEventListener('click', () => {
      // Проверяем несохранённые изменения перед созданием нового промпта
      if (isEditMode && !confirmUnsavedChanges()) {
        return;
      }
      
      hasUnsavedChanges = false;
      originalFormData = null;
      isEditMode = true;
      currentPrompt = null;
      selectedPromptSlug = null;
      renderEditForm(null);
      renderPromptsList(); // Убрать выделение
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите выйти?')) {
        await handleLogout();
      }
    });
  }

  if (adminUsersBtn) {
    adminUsersBtn.addEventListener('click', () => {
      showAdminPanel();
    });
  }

  if (logoutFromPendingBtn) {
    logoutFromPendingBtn.addEventListener('click', async () => {
      await handleLogout();
    });
  }
}

// ---------- SEARCH AND FILTER ----------

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const folderFilter = document.getElementById('folderFilter');
  const tagFilter = document.getElementById('tagFilter');
  
  // Восстанавливаем сохраненные фильтры
  try {
    const savedSearch = localStorage.getItem('promptSearch');
    const savedFolder = localStorage.getItem('promptFolder');
    const savedTag = localStorage.getItem('promptTag');
    
    if (savedSearch && searchInput) {
      searchInput.value = savedSearch;
    }
    if (savedFolder && folderFilter) {
      folderFilter.value = savedFolder;
    }
    if (savedTag && tagFilter) {
      tagFilter.value = savedTag;
    }
    
    // Загружаем промпты с восстановленными фильтрами
    if (savedSearch || savedFolder || savedTag) {
      const search = savedSearch || null;
      const folder = savedFolder || null;
      const tag = savedTag || null;
      loadPrompts(folder, search, tag);
    }
  } catch (error) {
    console.error('Ошибка восстановления фильтров:', error);
  }
  
  if (searchInput) {
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const search = e.target.value.trim() || null;
        const folder = folderFilter?.value || null;
        const tag = tagFilter?.value || null;
        
        // Сохраняем в localStorage
        try {
          if (search) {
            localStorage.setItem('promptSearch', search);
          } else {
            localStorage.removeItem('promptSearch');
          }
        } catch (error) {
          console.error('Ошибка сохранения поиска:', error);
        }
        
        loadPrompts(folder, search, tag);
      }, 300);
    });
  }
  
  if (folderFilter) {
    folderFilter.addEventListener('change', (e) => {
      const folder = e.target.value || null;
      const search = searchInput?.value.trim() || null;
      const tag = tagFilter?.value || null;
      
      // Сохраняем в localStorage
      try {
        if (folder) {
          localStorage.setItem('promptFolder', folder);
        } else {
          localStorage.removeItem('promptFolder');
        }
      } catch (error) {
        console.error('Ошибка сохранения папки:', error);
      }
      
      loadPrompts(folder, search, tag);
    });
  }
  
  if (tagFilter) {
    tagFilter.addEventListener('change', (e) => {
      const tag = e.target.value || null;
      const folder = folderFilter?.value || null;
      const search = searchInput?.value.trim() || null;
      
      // Сохраняем в localStorage
      try {
        if (tag) {
          localStorage.setItem('promptTag', tag);
        } else {
          localStorage.removeItem('promptTag');
        }
      } catch (error) {
        console.error('Ошибка сохранения тега:', error);
      }
      
      loadPrompts(folder, search, tag);
    });
  }
}

// ---------- UTILITIES ----------

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isCopyPrompt(name) {
  return name && name.trim().endsWith(' (копия)');
}

// Хранение метаданных папок (isMainFolder)
const folderMetadata = JSON.parse(localStorage.getItem('folderMetadata') || '{}');

function getFolderMetadata(folderPath) {
  return folderMetadata[folderPath] || { isMainFolder: false };
}

function setFolderMetadata(folderPath, metadata) {
  folderMetadata[folderPath] = metadata;
  localStorage.setItem('folderMetadata', JSON.stringify(folderMetadata));
}

function hasNestedFolders(node) {
  const childKeys = Object.keys(node.children || {});
  return childKeys.length > 0;
}

function highlightText(text, searchQuery) {
  if (!searchQuery || !text) return escapeHtml(text);
  const query = searchQuery.trim();
  if (!query) return escapeHtml(text);
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const highlighted = escapeHtml(text).replace(regex, '<mark>$1</mark>');
  return highlighted;
}

function showToast(message) {
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

function showFolderSettings(folderPath, itemElement) {
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
    renderPromptsList();
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

function showDeleteConfirm(message) {
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

// ---------- MARKDOWN RENDERING ----------

/**
 * Рендерит Markdown-текст в HTML
 * @param {string} markdown - Markdown-текст
 * @returns {string} - HTML-строка
 */
function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }
  
  // Проверяем, что библиотека marked доступна
  if (typeof marked === 'undefined') {
    console.warn('Marked library not loaded, rendering as plain text');
    return escapeHtml(markdown).replace(/\n/g, '<br>');
  }
  
  try {
    // Используем marked для парсинга Markdown
    // marked.parse() автоматически экранирует HTML в тексте
    return marked.parse(markdown);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // В случае ошибки возвращаем экранированный текст
    return escapeHtml(markdown).replace(/\n/g, '<br>');
  }
}

// ---------- VERSION ----------

async function loadVersion() {
  try {
    const res = await fetch('/version.json');
    const data = await res.json();
    const el = document.getElementById('appVersion');
    if (el) el.textContent = data.version;
  } catch {}
}

// ---------- AUTH FUNCTIONS ----------

let currentUser = null; // Храним данные текущего пользователя

/**
 * Обновляет видимость элементов UI в зависимости от прав пользователя
 */
function updateUIPermissions() {
  // Пользователь может редактировать промпты, если он admin или tech
  const canEditPrompts = currentUser && (currentUser.access_level === 'admin' || currentUser.access_level === 'tech');
  
  // Пользователь является администратором (только для админ-панели)
  const isAdmin = currentUser && currentUser.access_level === 'admin';
  
  // Кнопка "Создать промпт"
  const newPromptBtn = document.getElementById('newPromptBtn');
  if (newPromptBtn) {
    newPromptBtn.style.display = canEditPrompts ? 'block' : 'none';
  }
  
  // Кнопка админ-панели пользователей (только для admin)
  const adminUsersBtn = document.getElementById('adminUsersBtn');
  if (adminUsersBtn) {
    adminUsersBtn.style.display = isAdmin ? 'block' : 'none';
  }
  
  // Кнопки редактирования/удаления в карточке промпта
  const editPromptBtn = document.getElementById('editPromptBtn');
  const deletePromptBtn = document.getElementById('deletePromptBtn');
  if (editPromptBtn) {
    editPromptBtn.style.display = canEditPrompts ? 'block' : 'none';
  }
  if (deletePromptBtn) {
    deletePromptBtn.style.display = canEditPrompts ? 'block' : 'none';
  }
}

async function checkAuth() {
  try {
    // Проверяем авторизацию через эндпоинт /api/auth/me
    // Он требует авторизацию и возвращает данные пользователя
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    if (response.ok) {
      const userData = await response.json();
      currentUser = userData;
      // Проверяем статус пользователя
      if (userData.status === 'active') {
        isAuthenticated = true;
        showMainApp();
        // Обновляем видимость элементов UI в зависимости от прав
        updateUIPermissions();
        return true;
      } else {
        // Пользователь залогинен, но статус не active
        isAuthenticated = false;
        showPendingScreen();
        return false;
      }
    } else if (response.status === 401) {
      isAuthenticated = false;
      currentUser = null;
      showLoginScreen();
      return false;
    } else if (response.status === 403) {
      const reason = response.headers.get('X-Reason');
      if (reason === 'status_not_active') {
        showPendingScreen();
      } else {
        showLoginScreen();
      }
      return false;
    }
    // Если не 401 и не 200, считаем что не авторизованы
    isAuthenticated = false;
    currentUser = null;
    showLoginScreen();
    return false;
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    showLoginScreen();
    return false;
  }
}

function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const pendingScreen = document.getElementById('pendingScreen');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';
  if (pendingScreen) pendingScreen.style.display = 'none';
  isAuthenticated = false;
}

function showPendingScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const pendingScreen = document.getElementById('pendingScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (mainApp) mainApp.style.display = 'none';
  if (pendingScreen) pendingScreen.style.display = 'flex';
  isAuthenticated = false;
}

function showMainApp() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const pendingScreen = document.getElementById('pendingScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (mainApp) mainApp.style.display = 'block';
  if (pendingScreen) pendingScreen.style.display = 'none';
  isAuthenticated = true;
}

async function handleTelegramAuth(user) {
  try {
    const response = await fetch(`${API_BASE}/auth/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        id: user.id,
        username: user.username || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      alert(`Ошибка авторизации: ${error.detail || 'Неизвестная ошибка'}`);
      return;
    }
    
    const authData = await response.json();
    console.log('Авторизация успешна:', authData);
    
    // Сохраняем данные пользователя
    currentUser = authData.user;
    
    // Показываем основной интерфейс
    showMainApp();
    // Обновляем видимость элементов UI в зависимости от прав
    updateUIPermissions();
    await loadPrompts();
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    alert('Ошибка авторизации. Попробуйте снова.');
  }
}

async function handleLogout() {
  try {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    
    // После выхода сбрасываем состояние и показываем экран логина
    isAuthenticated = false;
    prompts = [];
    selectedPromptSlug = null;
    currentPrompt = null;
    renderPromptsList();
    renderEditor(null);
    showLoginScreen();
    
    // Перезагружаем страницу, чтобы очистить все состояния
    // Cookie уже удалена на бэкенде, так что при перезагрузке пользователь будет гостем
    setTimeout(() => {
      location.reload();
    }, 100);
  } catch (error) {
    console.error('Ошибка выхода:', error);
    // В случае ошибки всё равно сбрасываем состояние и перезагружаем
    isAuthenticated = false;
    showLoginScreen();
    setTimeout(() => {
      location.reload();
    }, 100);
  }
}

// ---------- ADMIN PANEL ----------

async function showAdminPanel() {
  const editorContent = document.getElementById('editorContent');
  const adminPanel = document.getElementById('adminPanel');
  
  if (!editorContent || !adminPanel) return;
  
  // Скрываем редактор, показываем админ-панель
  editorContent.style.display = 'none';
  adminPanel.style.display = 'block';
  
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        alert('Доступ запрещён. Только администраторы могут управлять пользователями.');
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const users = await response.json();
    renderAdminUsersList(users);
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    adminPanel.innerHTML = '<p style="color: var(--brandInk); padding: 24px;">Ошибка загрузки пользователей</p>';
  }
}

function renderAdminUsersList(users) {
  const adminPanel = document.getElementById('adminPanel');
  const editorContent = document.getElementById('editorContent');
  if (!adminPanel) return;
  
  let html = `
    <div style="padding: 24px;">
      <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 20px; color: var(--brandInk);">
        Управление пользователями
      </h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.3);">
              <th style="padding: 12px; text-align: left; color: var(--brandInk); font-weight: 600;">ID</th>
              <th style="padding: 12px; text-align: left; color: var(--brandInk); font-weight: 600;">Telegram ID</th>
              <th style="padding: 12px; text-align: left; color: var(--brandInk); font-weight: 600;">Имя</th>
              <th style="padding: 12px; text-align: left; color: var(--brandInk); font-weight: 600;">Статус</th>
              <th style="padding: 12px; text-align: left; color: var(--brandInk); font-weight: 600;">Уровень доступа</th>
              <th style="padding: 12px; text-align: left; color: var(--brandInk); font-weight: 600;">Последний вход</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  users.forEach(user => {
    const lastLogin = user.last_login_at 
      ? new Date(user.last_login_at).toLocaleString('ru-RU')
      : 'Никогда';
    
    html += `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);" data-user-id="${user.id}">
        <td style="padding: 12px;">${user.id}</td>
        <td style="padding: 12px;">${user.telegram_id}</td>
        <td style="padding: 12px;">${user.first_name || user.username || '—'}</td>
        <td style="padding: 12px;">
          <select class="user-status-select" data-user-id="${user.id}" style="padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.15); color: var(--brandInk); cursor: pointer;">
            <option value="pending" ${user.status === 'pending' ? 'selected' : ''}>Ожидает</option>
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Активен</option>
            <option value="blocked" ${user.status === 'blocked' ? 'selected' : ''}>Заблокирован</option>
          </select>
        </td>
        <td style="padding: 12px;">
          <select class="user-access-select" data-user-id="${user.id}" style="padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.15); color: var(--brandInk); cursor: pointer;">
            <option value="user" ${user.access_level === 'user' ? 'selected' : ''}>Пользователь</option>
            <option value="tech" ${user.access_level === 'tech' ? 'selected' : ''}>Техник</option>
            <option value="admin" ${user.access_level === 'admin' ? 'selected' : ''}>Администратор</option>
          </select>
        </td>
        <td style="padding: 12px; font-size: 12px; color: rgba(58, 42, 79, 0.7);">${lastLogin}</td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
      <button id="closeAdminPanelBtn" class="btn" style="margin-top: 20px;">Закрыть</button>
    </div>
  `;
  
  adminPanel.innerHTML = html;
  
  // Обработчики для селектов
  adminPanel.querySelectorAll('.user-status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = parseInt(e.target.dataset.userId);
      const newStatus = e.target.value;
      await updateUserField(userId, { status: newStatus });
    });
  });
  
  adminPanel.querySelectorAll('.user-access-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = parseInt(e.target.dataset.userId);
      const newAccessLevel = e.target.value;
      await updateUserField(userId, { access_level: newAccessLevel });
    });
  });
  
  // Кнопка закрытия
  const closeBtn = adminPanel.querySelector('#closeAdminPanelBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (adminPanel) adminPanel.style.display = 'none';
      if (editorContent) editorContent.style.display = 'block';
    });
  }
}

async function updateUserField(userId, data) {
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        alert('Доступ запрещён. Только администраторы могут изменять пользователей.');
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const updatedUser = await response.json();
    console.log('Пользователь обновлён:', updatedUser);
    
    // Обновляем список пользователей
    await showAdminPanel();
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    alert('Ошибка обновления пользователя. Проверьте консоль.');
  }
}

// ---------- INITIALIZATION ----------

function init() {
  setupPromptsListEvents();
  setupHeaderButtons();
  setupSearch();
  setupKeyboardShortcuts();
  setupTelegramLogin();
  
  // Проверяем авторизацию при загрузке страницы
  checkAuth().then((authenticated) => {
    if (authenticated) {
      loadPrompts();
    }
  });
  loadVersion();
}

// Настройка кнопки входа через Telegram
function setupTelegramLogin() {
  const loginBtn = document.getElementById('loginTelegramBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      // Создаём и загружаем Telegram Widget только по клику
      const widgetContainer = document.getElementById('telegramLoginWidget');
      if (widgetContainer && !widgetContainer.querySelector('script[data-telegram-login]')) {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', 'autookk_bot');
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        
        // Очищаем контейнер и добавляем скрипт
        widgetContainer.innerHTML = '';
        widgetContainer.appendChild(script);
        
        // Устанавливаем глобальную функцию для обработки авторизации
        window.onTelegramAuth = handleTelegramAuth;
      }
    });
  }
}

// ---------- KEYBOARD SHORTCUTS ----------

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', async (e) => {
    // Ctrl+S или Cmd+S - сохранить промпт
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (isEditMode) {
        const textInput = document.getElementById('promptTextInput');
        if (textInput) {
          const slug = currentPrompt?.slug || null;
          await handleSavePrompt(slug);
        }
      }
    }
    
    // Esc - отмена редактирования
    if (e.key === 'Escape') {
      if (isEditMode) {
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) {
          if (confirmUnsavedChanges()) {
            cancelBtn.click();
          }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
