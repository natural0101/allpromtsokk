// Типы данных
// type Node = 
//   | { type: 'folder'; id: string; title: string; children: Node[] }
//   | { type: 'note'; id: string; title: string; content: string };

const DATA_URL = 'data.json';
const STORAGE_KEY = 'obsidianNotesData';

let rootNodes = [];
let selectedNodeId = null;
let collapsedFolders = new Set();
let contextMenuNode = null;
let draggedNodeId = null;
let dragOverNodeId = null;

// ---------- ЗАГРУЗКА ДАННЫХ ----------

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Ошибка загрузки data.json');
    const data = await response.json();
    
    // Проверяем localStorage
    const saved = loadFromStorage();
    if (saved && Array.isArray(saved) && saved.length > 0) {
      rootNodes = saved;
    } else {
      rootNodes = data;
      saveToStorage();
    }
    
    renderTree();
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    // Пробуем загрузить из localStorage
    const saved = loadFromStorage();
    if (saved && Array.isArray(saved)) {
      rootNodes = saved;
      renderTree();
    } else {
      rootNodes = [];
      renderTree();
    }
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Ошибка чтения localStorage', e);
    return null;
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rootNodes));
  } catch (e) {
    console.warn('Ошибка записи localStorage', e);
  }
}

// ---------- ПОИСК УЗЛОВ ----------

function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'folder' && node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentNode(nodes, targetId, parent = null) {
  for (const node of nodes) {
    if (node.id === targetId) return parent;
    if (node.type === 'folder' && node.children) {
      const found = findParentNode(node.children, targetId, node);
      if (found !== null) return found;
    }
  }
  return null;
}

function getNodePath(nodes, targetId, path = []) {
  for (const node of nodes) {
    const currentPath = [...path, node];
    if (node.id === targetId) return currentPath;
    if (node.type === 'folder' && node.children) {
      const found = getNodePath(node.children, targetId, currentPath);
      if (found) return found;
    }
  }
  return null;
}

// ---------- РЕНДЕРИНГ ДЕРЕВА ----------

function renderTree() {
  const container = document.getElementById('treeContainer');
  if (!container) return;

  container.innerHTML = '';
  
  if (rootNodes.length === 0) {
    container.innerHTML = '<div style="padding: 16px; color: #888; text-align: center;">Дерево пусто. Создайте папку или заметку.</div>';
    return;
  }

  rootNodes.forEach(node => {
    const element = renderTreeNode(node, 0);
    container.appendChild(element);
  });
}

function renderTreeNode(node, level) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.nodeId = node.id;
  
  const isFolder = node.type === 'folder';
  const isCollapsed = collapsedFolders.has(node.id);
  const isSelected = selectedNodeId === node.id;
  
  const indent = level * 20;
  
  const toggleClass = isFolder ? (isCollapsed ? 'collapsed' : 'expanded') : 'hidden';
  const icon = isFolder ? '📁' : '📄';
  
  const itemDiv = document.createElement('div');
  itemDiv.className = `tree-node-item ${isSelected ? 'selected' : ''} ${dragOverNodeId === node.id ? 'drag-over' : ''}`;
  itemDiv.setAttribute('data-action', 'select');
  
  // Делаем заметки и папки перетаскиваемыми
  if (node.type === 'note' || node.type === 'folder') {
    itemDiv.draggable = true;
    itemDiv.dataset.draggable = 'true';
  }
  
  const indentDiv = document.createElement('div');
  indentDiv.className = 'tree-node-indent';
  indentDiv.style.width = `${indent}px`;
  
  const toggleSpan = document.createElement('span');
  toggleSpan.className = `tree-node-toggle ${toggleClass}`;
  toggleSpan.setAttribute('data-action', 'toggle');
  
  const iconSpan = document.createElement('span');
  iconSpan.className = 'tree-node-icon';
  iconSpan.textContent = icon;
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'tree-node-title';
  titleSpan.setAttribute('data-action', 'select');
  titleSpan.textContent = node.title;
  
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tree-node-actions';
  
  const renameBtn = document.createElement('button');
  renameBtn.className = 'tree-node-action';
  renameBtn.setAttribute('data-action', 'rename');
  renameBtn.setAttribute('title', 'Переименовать');
  renameBtn.textContent = '✏️';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = `tree-node-action ${isFolder ? 'delete' : ''}`;
  deleteBtn.setAttribute('data-action', 'delete');
  deleteBtn.setAttribute('title', 'Удалить');
  deleteBtn.textContent = '🗑️';
  
  actionsDiv.appendChild(renameBtn);
  actionsDiv.appendChild(deleteBtn);
  
  if (isFolder) {
    const newFolderBtn = document.createElement('button');
    newFolderBtn.className = 'tree-node-action';
    newFolderBtn.setAttribute('data-action', 'newFolder');
    newFolderBtn.setAttribute('title', 'Создать папку');
    newFolderBtn.textContent = '📁';
    
    const newNoteBtn = document.createElement('button');
    newNoteBtn.className = 'tree-node-action';
    newNoteBtn.setAttribute('data-action', 'newNote');
    newNoteBtn.setAttribute('title', 'Создать заметку');
    newNoteBtn.textContent = '📄';
    
    actionsDiv.appendChild(newFolderBtn);
    actionsDiv.appendChild(newNoteBtn);
  }
  
  itemDiv.appendChild(indentDiv);
  itemDiv.appendChild(toggleSpan);
  itemDiv.appendChild(iconSpan);
  itemDiv.appendChild(titleSpan);
  itemDiv.appendChild(actionsDiv);
  
  div.appendChild(itemDiv);
  
  // Добавляем дочерние элементы
  if (isFolder && !isCollapsed && node.children) {
    node.children.forEach(child => {
      const childElement = renderTreeNode(child, level + 1);
      div.appendChild(childElement);
    });
  }
  
  return div;
}

// ---------- ОБРАБОТЧИКИ СОБЫТИЙ ДЕРЕВА ----------

function setupTreeEvents() {
  const container = document.getElementById('treeContainer');
  if (!container) return;
  
  // Обработка кликов
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.tree-node-item');
    if (!item) return;
    
    const nodeElement = item.closest('.tree-node');
    if (!nodeElement) return;
    
    const nodeId = nodeElement.dataset.nodeId;
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    
    if (action === 'toggle') {
      toggleFolder(nodeId);
    } else if (action === 'select') {
      selectNode(nodeId);
    } else if (action === 'rename') {
      e.stopPropagation();
      renameNode(nodeId);
    } else if (action === 'delete') {
      e.stopPropagation();
      deleteNode(nodeId);
    } else if (action === 'newFolder') {
      e.stopPropagation();
      createNewFolder(nodeId);
    } else if (action === 'newNote') {
      e.stopPropagation();
      createNewNote(nodeId);
    }
  });
  
  // Drag and Drop обработчики
  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.tree-node-item');
    if (!item || !item.draggable) return;
    
    const nodeElement = item.closest('.tree-node');
    if (!nodeElement) return;
    
    draggedNodeId = nodeElement.dataset.nodeId;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedNodeId);
  });
  
  container.addEventListener('dragend', (e) => {
    const item = e.target.closest('.tree-node-item');
    if (item) {
      item.classList.remove('dragging');
    }
    draggedNodeId = null;
    dragOverNodeId = null;
    renderTree(); // Обновляем дерево, чтобы убрать визуальные эффекты
  });
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const nodeElement = e.target.closest('.tree-node');
    if (!nodeElement) {
      dragOverNodeId = null;
      renderTree();
      return;
    }
    
    const nodeId = nodeElement.dataset.nodeId;
    const node = findNodeById(rootNodes, nodeId);
    
    // Можно перетаскивать только в папки
    if (node && node.type === 'folder' && nodeId !== draggedNodeId) {
      // Проверяем, что не пытаемся переместить папку внутрь самой себя
      if (draggedNodeId) {
        const draggedNode = findNodeById(rootNodes, draggedNodeId);
        if (draggedNode && draggedNode.type === 'folder') {
          const targetPath = getNodePath(rootNodes, nodeId);
          if (targetPath && targetPath.some(n => n.id === draggedNodeId)) {
            dragOverNodeId = null;
            renderTree();
            return;
          }
        }
      }
      
      if (dragOverNodeId !== nodeId) {
        dragOverNodeId = nodeId;
        renderTree();
      }
    } else {
      if (dragOverNodeId !== null) {
        dragOverNodeId = null;
        renderTree();
      }
    }
  });
  
  container.addEventListener('dragleave', (e) => {
    // Проверяем, что мы действительно покинули контейнер
    if (!container.contains(e.relatedTarget)) {
      dragOverNodeId = null;
      renderTree();
    }
  });
  
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    
    const nodeElement = e.target.closest('.tree-node');
    if (!nodeElement || !draggedNodeId) return;
    
    const targetId = nodeElement.dataset.nodeId;
    const targetNode = findNodeById(rootNodes, targetId);
    
    if (targetNode && targetNode.type === 'folder' && targetId !== draggedNodeId) {
      moveNode(draggedNodeId, targetId);
    }
    
    draggedNodeId = null;
    dragOverNodeId = null;
    renderTree();
  });
}

function toggleFolder(folderId) {
  if (collapsedFolders.has(folderId)) {
    collapsedFolders.delete(folderId);
  } else {
    collapsedFolders.add(folderId);
  }
  renderTree();
}

function selectNode(nodeId) {
  const node = findNodeById(rootNodes, nodeId);
  if (!node) return;
  
  selectedNodeId = nodeId;
  renderTree();
  renderEditor(node);
}

// ---------- РЕНДЕРИНГ РЕДАКТОРА ----------

function renderEditor(node) {
  const container = document.getElementById('editorContent');
  if (!container) return;
  
  if (!node || node.type === 'folder') {
    container.innerHTML = `
      <div class="editor-placeholder">
        <p>Выберите заметку слева для просмотра и редактирования</p>
      </div>
    `;
    return;
  }
  
        container.innerHTML = `
    <div class="editor-header">
      <input 
        type="text" 
        class="editor-title-input" 
        id="noteTitleInput"
        value="${escapeHtml(node.title)}"
        placeholder="Название заметки"
      />
      <div class="editor-actions">
        <button class="btn btn-danger" id="deleteNoteBtn">Удалить</button>
      </div>
    </div>
    <div class="editor-body">
      <textarea 
        class="editor-textarea" 
        id="noteContentInput"
        placeholder="Содержимое заметки..."
      >${escapeHtml(node.content || '')}</textarea>
          </div>
        `;
  
  // Обработчики редактора
  const titleInput = document.getElementById('noteTitleInput');
  const contentInput = document.getElementById('noteContentInput');
  const deleteBtn = document.getElementById('deleteNoteBtn');
  
  let saveTimeout = null;
  
  function saveNote() {
    if (!node) return;
    node.title = titleInput.value.trim() || 'Без названия';
    node.content = contentInput.value;
    saveToStorage();
    renderTree(); // Обновить название в дереве
  }
  
  titleInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveNote, 500);
  });
  
  contentInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveNote, 500);
  });
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Удалить эту заметку?')) {
        deleteNode(node.id);
      }
    });
  }
}

// ---------- CRUD ОПЕРАЦИИ ----------

function createNewFolder(parentFolderId = null) {
  const title = prompt('Введите название папки:', 'Новая папка');
  if (!title || !title.trim()) return;
  
  const newFolder = {
    type: 'folder',
    id: 'folder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    title: title.trim(),
    children: []
  };
  
  if (parentFolderId) {
    const parent = findNodeById(rootNodes, parentFolderId);
    if (parent && parent.type === 'folder') {
      parent.children.push(newFolder);
    }
  } else {
    rootNodes.push(newFolder);
  }
  
  saveToStorage();
  renderTree();
  selectNode(newFolder.id);
}

function createNewNote(parentFolderId = null) {
  const title = prompt('Введите название заметки:', 'Новая заметка');
  if (!title || !title.trim()) return;
  
  const newNote = {
    type: 'note',
    id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    title: title.trim(),
    content: ''
  };
  
  if (parentFolderId) {
    const parent = findNodeById(rootNodes, parentFolderId);
    if (parent && parent.type === 'folder') {
      parent.children.push(newNote);
    }
  } else {
    rootNodes.push(newNote);
  }
  
  // Раскрыть родительскую папку
  if (parentFolderId) {
    collapsedFolders.delete(parentFolderId);
  }
  
  saveToStorage();
  renderTree();
  selectNode(newNote.id);
}

function renameNode(nodeId) {
  const node = findNodeById(rootNodes, nodeId);
  if (!node) return;
  
  const newTitle = prompt('Введите новое название:', node.title);
  if (!newTitle || !newTitle.trim()) return;
  
  node.title = newTitle.trim();
  saveToStorage();
  renderTree();
  
  // Если это выбранная заметка, обновить редактор
  if (selectedNodeId === nodeId && node.type === 'note') {
    const titleInput = document.getElementById('noteTitleInput');
    if (titleInput) {
      titleInput.value = node.title;
    }
  }
}

function deleteNode(nodeId) {
  const node = findNodeById(rootNodes, nodeId);
  if (!node) return;
  
  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;
  
  let confirmMessage = isFolder 
    ? `Удалить папку "${node.title}"${hasChildren ? ' и все её содержимое' : ''}?`
    : `Удалить заметку "${node.title}"?`;
  
  if (!confirm(confirmMessage)) return;
  
  // Удаляем из родителя или из корня
  const parent = findParentNode(rootNodes, nodeId);
  
  if (parent) {
    parent.children = parent.children.filter(n => n.id !== nodeId);
  } else {
    rootNodes = rootNodes.filter(n => n.id !== nodeId);
  }
  
  // Если удалили выбранный узел, очистить редактор
  if (selectedNodeId === nodeId) {
    selectedNodeId = null;
    renderEditor(null);
  }
  
  saveToStorage();
  renderTree();
}

// ---------- DRAG AND DROP ----------

function removeNodeFromTree(nodes, nodeId, parent = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) {
      const node = nodes[i];
      nodes.splice(i, 1);
      return { node, parent };
    }
    if (nodes[i].type === 'folder' && nodes[i].children) {
      const result = removeNodeFromTree(nodes[i].children, nodeId, nodes[i]);
      if (result) return result;
    }
  }
  return null;
}

function moveNode(draggedId, targetId) {
  if (draggedId === targetId) return false;
  
  const draggedNode = findNodeById(rootNodes, draggedId);
  if (!draggedNode) return false;
  
  // Проверяем, что не пытаемся переместить папку внутрь самой себя или её потомка
  if (draggedNode.type === 'folder') {
    const targetPath = getNodePath(rootNodes, targetId);
    if (targetPath) {
      const draggedInPath = targetPath.some(n => n.id === draggedId);
      if (draggedInPath) return false; // Нельзя переместить папку внутрь самой себя
    }
  }
  
  const targetNode = findNodeById(rootNodes, targetId);
  if (!targetNode) return false;
  
  // Можно перемещать только в папки
  if (targetNode.type !== 'folder') return false;
  
  // Удаляем узел из текущего места
  const removed = removeNodeFromTree(rootNodes, draggedId);
  if (!removed) return false;
  
  // Добавляем в целевую папку
  if (!targetNode.children) {
    targetNode.children = [];
  }
  targetNode.children.push(removed.node);
  
  // Раскрываем целевую папку
  collapsedFolders.delete(targetId);
  
  saveToStorage();
  renderTree();
  
  // Выбираем перемещенный узел
  selectNode(draggedId);
  
  return true;
}

// ---------- КНОПКИ В ХЕДЕРЕ ----------

function setupHeaderButtons() {
  const newFolderBtn = document.getElementById('newFolderBtn');
  const newNoteBtn = document.getElementById('newNoteBtn');
  
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', () => {
      createNewFolder();
    });
  }
  
  if (newNoteBtn) {
    newNoteBtn.addEventListener('click', () => {
      createNewNote();
    });
  }
}

// ---------- УТИЛИТЫ ----------

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------

function init() {
  setupTreeEvents();
  setupHeaderButtons();
  loadData();
}

document.addEventListener('DOMContentLoaded', init);
