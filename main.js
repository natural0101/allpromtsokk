// API Configuration
const API_BASE = '/api';

// State
let prompts = [];
let selectedPromptSlug = null;
let currentPrompt = null;
let isEditMode = false;
let collapsedFolders = new Set(); // Хранит пути свернутых папок

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

async function loadPrompts(folder = null, search = null) {
  try {
    prompts = await fetchPrompts(folder, search);
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
  try {
    const prompt = await fetchPromptBySlug(slug);
    if (!prompt) {
      renderEditor(null);
      return;
    }
    currentPrompt = prompt;
    selectedPromptSlug = slug;
    renderEditor(prompt);
    renderPromptsList(); // Обновить выделение в списке
  } catch (error) {
    console.error('Ошибка загрузки промпта:', error);
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

  const tree = buildFolderTree(prompts);
  renderFolderTree(tree, container);

  updateFolderFilter();
}

function renderFolderTree(tree, container) {
  // Сначала рендерим промпты без папки, если они есть
  if (tree.prompts.length > 0) {
    tree.prompts.forEach(prompt => {
      const element = renderPromptItem(prompt);
      container.appendChild(element);
    });
  }

  // Затем рендерим папки
  const folderKeys = Object.keys(tree.children).sort();
  folderKeys.forEach(folderPath => {
    const folderNode = tree.children[folderPath];
    const element = renderFolderNode(folderNode, 0);
    container.appendChild(element);
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
  iconSpan.textContent = '📁';
  iconSpan.style.marginRight = '6px';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'tree-node-title';
  titleSpan.textContent = node.name;
  titleSpan.setAttribute('data-action', 'toggle-folder');

  itemDiv.appendChild(toggleSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(titleSpan);

  div.appendChild(itemDiv);

  // Рендерим дочерние элементы, если папка развернута
  if (!isCollapsed) {
    // Сначала промпты в этой папке
    node.prompts.forEach(prompt => {
      const promptElement = renderPromptItem(prompt, level + 1);
      div.appendChild(promptElement);
    });

    // Затем дочерние папки
    const childKeys = Object.keys(node.children).sort();
    childKeys.forEach(childPath => {
      const childNode = node.children[childPath];
      const childElement = renderFolderNode(childNode, level + 1);
      div.appendChild(childElement);
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

function renderPromptItem(prompt, level = 0) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.slug = prompt.slug;

  const isSelected = selectedPromptSlug === prompt.slug;
  const indent = level * 20;

  const itemDiv = document.createElement('div');
  itemDiv.className = `tree-node-item ${isSelected ? 'selected' : ''}`;
  itemDiv.setAttribute('data-action', 'select');
  itemDiv.style.paddingLeft = `${indent}px`;

  // Пустой индент для выравнивания с папками
  const indentSpan = document.createElement('span');
  indentSpan.style.width = '20px';
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
  titleSpan.textContent = prompt.name || 'Без названия';
  titleSpan.style.display = 'block';
  titleSpan.style.marginBottom = '4px';

  const metaDiv = document.createElement('div');
  metaDiv.style.fontSize = '11px';
  metaDiv.style.color = 'rgba(58, 42, 79, 0.6)';
  metaDiv.style.display = 'flex';
  metaDiv.style.gap = '8px';
  metaDiv.style.flexWrap = 'wrap';

  if (prompt.tags) {
    const tagsSpan = document.createElement('span');
    tagsSpan.textContent = `🏷️ ${prompt.tags}`;
    metaDiv.appendChild(tagsSpan);
  }

  contentDiv.appendChild(titleSpan);
  contentDiv.appendChild(metaDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tree-node-actions';

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

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);

  itemDiv.appendChild(indentSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(contentDiv);
  itemDiv.appendChild(actionsDiv);

  div.appendChild(itemDiv);

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
  container.innerHTML = `
    <div class="editor-header">
      <div style="flex: 1;">
        <h2 style="font-size: 22px; font-weight: 600; margin: 0; color: var(--brandInk);">${escapeHtml(prompt.name || 'Без названия')}</h2>
        <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: rgba(58, 42, 79, 0.6);">
          ${prompt.folder ? `<span>📁 ${escapeHtml(prompt.folder)}</span>` : ''}
          ${prompt.tags ? `<span>🏷️ ${escapeHtml(prompt.tags)}</span>` : ''}
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn" id="editPromptBtn">Редактировать</button>
        <button class="btn btn-danger" id="deletePromptBtn">Удалить</button>
      </div>
    </div>
    <div class="editor-body">
      <div style="white-space: pre-wrap; line-height: 1.7; color: var(--brandInk);">${escapeHtml(prompt.text || '')}</div>
    </div>
  `;

  const editBtn = document.getElementById('editPromptBtn');
  const deleteBtn = document.getElementById('deletePromptBtn');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      isEditMode = true;
      renderEditForm(prompt);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Удалить промпт "${prompt.name}"?`)) {
        await handleDeletePrompt(prompt.slug);
      }
    });
  }
}

function renderEditForm(prompt = null) {
  const isNew = !prompt;
  const container = document.getElementById('editorContent');
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
            style="min-height: 300px;"
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

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSavePrompt(prompt?.slug);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
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
      await loadPrompt(slug);
    } else if (action === 'edit') {
      e.stopPropagation();
      const prompt = prompts.find(p => p.slug === slug);
      if (prompt) {
        isEditMode = true;
        renderEditForm(prompt);
      }
    } else if (action === 'delete') {
      e.stopPropagation();
      const prompt = prompts.find(p => p.slug === slug);
      if (prompt && confirm(`Удалить промпт "${prompt.name}"?`)) {
        await handleDeletePrompt(slug);
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
}

async function handleSavePrompt(slug = null) {
  const nameInput = document.getElementById('promptNameInput');
  const textInput = document.getElementById('promptTextInput');
  const folderInput = document.getElementById('promptFolderInput');
  const tagsInput = document.getElementById('promptTagsInput');

  if (!nameInput || !textInput) return;

  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  const folder = folderInput?.value.trim() || null;
  const tags = tagsInput?.value.trim() || null;

  if (!name || !text) {
    alert('Название и текст обязательны для заполнения');
    return;
  }

  try {
    const data = {
      name,
      text,
      folder: folder || null,
      tags: tags || null,
    };

    let savedPrompt;
    if (slug) {
      // Обновление
      savedPrompt = await updatePrompt(slug, data);
      if (!savedPrompt) {
        alert('Промпт не найден');
        return;
      }
    } else {
      // Создание
      savedPrompt = await createPrompt(data);
    }

    // Обновить список и переключиться в режим просмотра
    await loadPrompts();
    isEditMode = false;
    await loadPrompt(savedPrompt.slug);
  } catch (error) {
    console.error('Ошибка сохранения промпта:', error);
    alert('Ошибка сохранения промпта. Проверьте консоль для деталей.');
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
    await loadPrompts();
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

// ---------- HEADER BUTTONS ----------

function setupHeaderButtons() {
  const newPromptBtn = document.getElementById('newPromptBtn');

  if (newPromptBtn) {
    newPromptBtn.addEventListener('click', () => {
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

  if (searchInput) {
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const search = e.target.value.trim() || null;
        const folder = folderFilter?.value || null;
        loadPrompts(folder, search);
      }, 300);
    });
  }

  if (folderFilter) {
    folderFilter.addEventListener('change', (e) => {
      const folder = e.target.value || null;
      const search = searchInput?.value.trim() || null;
      loadPrompts(folder, search);
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

// ---------- INITIALIZATION ----------

function init() {
  setupPromptsListEvents();
  setupHeaderButtons();
  setupSearch();
  loadPrompts();
}

document.addEventListener('DOMContentLoaded', init);
