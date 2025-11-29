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

// ---------- API FUNCTIONS ----------

async function fetchPrompts(folder = null, search = null) {
  try {
    const params = new URLSearchParams();
    if (folder) params.append('folder', folder);
    if (search) params.append('search', search);
    
    const url = `${API_BASE}/prompts${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки промптов:', error);
    throw error;
  }
}

async function fetchPromptBySlug(slug) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${slug}`);
    if (!response.ok) {
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
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      body: JSON.stringify(data),
    });
    if (!response.ok) {
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
    });
    if (!response.ok) {
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
  
  const itemDiv = document.createElement('div');
  itemDiv.className = 'tree-node-item';
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
  // Для группы "Без папки" используем другую иконку
  iconSpan.textContent = node.fullPath === '__no_folder__' ? '📂' : '📁';
  iconSpan.style.marginRight = '6px';
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'tree-node-title';
  titleSpan.textContent = node.name;
  titleSpan.setAttribute('data-action', 'toggle-folder');

  itemDiv.appendChild(toggleSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(titleSpan);

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
  
  // Подсветка совпадений в названии
  const searchQuery = document.getElementById('searchInput')?.value.trim() || '';
  titleSpan.innerHTML = highlightText(prompt.name || 'Без названия', searchQuery);
    
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
    tagsHtml = tagsArray.map(tag => 
      `<span class="tag-chip" data-tag="${escapeHtml(tag)}" style="cursor: pointer;">${escapeHtml(tag)}</span>`
    ).join('');
  }
  
  container.innerHTML = `
    <div class="editor-header">
      <div style="flex: 1;">
        <h2 style="font-size: 22px; font-weight: 600; margin: 0; color: var(--brandInk);">${highlightText(prompt.name || 'Без названия', document.getElementById('searchInput')?.value.trim() || '')}</h2>
        <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: rgba(58, 42, 79, 0.6); align-items: center; flex-wrap: wrap;">
          ${prompt.folder ? `<span>📁 ${escapeHtml(prompt.folder)}</span>` : ''}
          ${tagsHtml ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${tagsHtml}</div>` : ''}
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn" id="copyTextBtn">Скопировать текст</button>
        <button class="btn" id="duplicatePromptBtn">Дублировать</button>
        <button class="btn" id="editPromptBtn">Редактировать</button>
        <button class="btn btn-danger" id="deletePromptBtn">Удалить</button>
      </div>
    </div>
    <div class="editor-body">
      <div style="white-space: pre-wrap; line-height: 1.7; color: var(--brandInk);">${highlightText(prompt.text || '', document.getElementById('searchInput')?.value.trim() || '')}</div>
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

// Функция авто-увеличения высоты textarea
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(300, textarea.scrollHeight) + 'px';
}

// Проверка наличия несохранённых изменений
function checkFormChanges() {
  const nameInput = document.getElementById('promptNameInput');
  const textInput = document.getElementById('promptTextInput');
  const folderInput = document.getElementById('promptFolderInput');
  const tagsInput = document.getElementById('promptTagsInput');

  if (!nameInput || !textInput || !originalFormData) return false;

  const currentData = {
    name: nameInput.value.trim(),
    text: textInput.value.trim(),
    folder: folderInput?.value.trim() || null,
    tags: tagsInput?.value.trim() || null,
  };

  return (
    currentData.name !== originalFormData.name ||
    currentData.text !== originalFormData.text ||
    currentData.folder !== originalFormData.folder ||
    currentData.tags !== originalFormData.tags
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
            placeholder="Текст промпта..."
            required
            style="min-height: 300px; resize: vertical; overflow-y: auto; font-family: Consolas, Menlo, Monaco, monospace;"
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

  if (!nameInput || !textInput) return;

  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  const folderValue = folderInput?.value.trim() || null;
  const tagsValue = tagsInput?.value.trim() || null;

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

// ---------- VERSION ----------

async function loadVersion() {
  try {
    const res = await fetch('/version.json');
    const data = await res.json();
    const el = document.getElementById('appVersion');
    if (el) el.textContent = data.version;
  } catch {}
}

// ---------- INITIALIZATION ----------

function init() {
  setupPromptsListEvents();
  setupHeaderButtons();
  setupSearch();
  setupKeyboardShortcuts();
  loadPrompts();
  loadVersion();
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
