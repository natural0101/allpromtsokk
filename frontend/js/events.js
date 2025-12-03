// Event Handlers

import * as state from './state.js';
import * as api from './api.js';
import { renderPromptsList, renderEditor } from './ui.js';
import { loadPrompts, loadPrompt } from './router.js';
import { confirmUnsavedChanges } from './editor.js';
import { showDeleteConfirm } from './utils.js';
import { showLoginScreen, showMainApp, showPendingScreen, showAdminPanel } from './router.js';

/**
 * Setup prompts list event handlers
 */
export function setupPromptsListEvents() {
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
      if (state.getIsEditMode() && !confirmUnsavedChanges()) {
        return;
      }
      await loadPrompt(slug);
    } else if (action === 'duplicate') {
      e.stopPropagation();
      await handleDuplicatePrompt(slug);
    } else if (action === 'edit') {
      e.stopPropagation();
      if (state.getIsEditMode() && !confirmUnsavedChanges()) {
        return;
      }
      const prompts = state.getPrompts();
      const prompt = prompts.find(p => p.slug === slug);
      if (prompt) {
        state.setIsEditMode(true);
        const { renderEditForm } = await import('./ui.js');
        renderEditForm(prompt);
      }
    } else if (action === 'delete') {
      e.stopPropagation();
      const prompts = state.getPrompts();
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

/**
 * Toggle folder collapse/expand
 */
function toggleFolder(folderPath) {
  state.toggleFolder(folderPath);
  renderPromptsList();
}

/**
 * Handle save prompt
 */
export async function handleSavePrompt(slug = null) {
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
      savedPrompt = await api.updatePrompt(slug, data);
      if (!savedPrompt) {
        alert('Промпт не найден');
        return;
      }
    } else {
      savedPrompt = await api.createPrompt(data);
    }

    state.setHasUnsavedChanges(false);
    state.setOriginalFormData(null);

    await loadPrompts();
    state.setIsEditMode(false);
    await loadPrompt(savedPrompt.slug);
  } catch (error) {
    console.error('Ошибка сохранения промпта:', error);
    alert('Ошибка сохранения промпта. Проверьте консоль для деталей.');
  }
}

/**
 * Handle duplicate prompt
 */
export async function handleDuplicatePrompt(slug) {
  try {
    const prompts = state.getPrompts();
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

    const duplicatedPrompt = await api.createPrompt(data);
    
    const folder = document.getElementById('folderFilter')?.value || null;
    const search = document.getElementById('searchInput')?.value.trim() || null;
    const tag = document.getElementById('tagFilter')?.value || null;
    await loadPrompts(folder, search, tag);
    
    await loadPrompt(duplicatedPrompt.slug);
  } catch (error) {
    console.error('Ошибка дублирования промпта:', error);
    alert('Ошибка дублирования промпта. Проверьте консоль для деталей.');
  }
}

/**
 * Handle delete prompt
 */
export async function handleDeletePrompt(slug) {
  try {
    const success = await api.deletePrompt(slug);
    if (!success) {
      alert('Промпт не найден');
      return;
    }

    const folder = document.getElementById('folderFilter')?.value || null;
    const search = document.getElementById('searchInput')?.value.trim() || null;
    const tag = document.getElementById('tagFilter')?.value || null;
    await loadPrompts(folder, search, tag);
    if (state.getSelectedPromptSlug() === slug) {
      state.setSelectedPromptSlug(null);
      state.setCurrentPrompt(null);
      renderEditor(null);
    }
  } catch (error) {
    console.error('Ошибка удаления промпта:', error);
    alert('Ошибка удаления промпта. Проверьте консоль для деталей.');
  }
}

/**
 * Handle drop prompt to folder
 */
export async function handleDropPromptToFolder(slug, folderPath) {
  const prompts = state.getPrompts();
  const prompt = prompts.find(p => p.slug === slug);
  if (!prompt) return;
  
  const newFolder = folderPath === '__no_folder__' ? null : folderPath;
  
  if ((prompt.folder || null) === newFolder) return;

  const data = {
    name: prompt.name,
    text: prompt.text,
    folder: newFolder,
    tags: prompt.tags || null,
    importance: prompt.importance || 'normal',
  };

  try {
    await api.updatePrompt(slug, data);
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

/**
 * Setup header buttons
 */
export function setupHeaderButtons() {
  const newPromptBtn = document.getElementById('newPromptBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminUsersBtn = document.getElementById('adminUsersBtn');
  const logoutFromPendingBtn = document.getElementById('logoutFromPendingBtn');

  if (newPromptBtn) {
    newPromptBtn.addEventListener('click', async () => {
      if (state.getIsEditMode() && !confirmUnsavedChanges()) {
        return;
      }
      
      state.setHasUnsavedChanges(false);
      state.setOriginalFormData(null);
      state.setIsEditMode(true);
      state.setCurrentPrompt(null);
      state.setSelectedPromptSlug(null);
      const { renderEditForm } = await import('./ui.js');
      renderEditForm(null);
      renderPromptsList();
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

/**
 * Setup login screen events (password login)
 */
export function setupLoginScreenEvents() {
  const toggleBtn = document.getElementById('passwordLoginToggleBtn');
  const form = document.getElementById('passwordLoginForm');
  const loginInput = document.getElementById('passwordLoginInput');
  const passwordInput = document.getElementById('passwordLoginPassword');

  if (!toggleBtn || !form) return;

  toggleBtn.addEventListener('click', () => {
    const isVisible = form.style.display === 'block';
    form.style.display = isVisible ? 'none' : 'block';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = loginInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    if (!login || !password) {
      alert('Введите логин и пароль');
      return;
    }

    await handlePasswordLogin(login, password);
  });
}

/**
 * Setup search and filters
 */
export function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const folderFilter = document.getElementById('folderFilter');
  const tagFilter = document.getElementById('tagFilter');
  
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

/**
 * Setup keyboard shortcuts
 */
export function setupKeyboardShortcuts() {
  document.addEventListener('keydown', async (e) => {
    // Ctrl+S or Cmd+S - save prompt
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (state.getIsEditMode()) {
        const textInput = document.getElementById('promptTextInput');
        if (textInput) {
          const slug = state.getCurrentPrompt()?.slug || null;
          await handleSavePrompt(slug);
        }
      }
    }
    
    // Esc - cancel editing
    if (e.key === 'Escape') {
      if (state.getIsEditMode()) {
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

/**
 * Handle Telegram authentication
 */
export async function handleTelegramAuth(user) {
  console.log('TG CALLBACK DATA (global):', user);
  
  try {
    const authData = await api.telegramLogin(user);
    console.log('AUTH RESPONSE:', authData);
    
    const userData = authData?.user;
    state.setCurrentUser(userData || null);
    
    if (userData && userData.status === 'active') {
      state.setIsAuthenticated(true);
      showMainApp();
      updateUIPermissions();
      await loadPrompts();
    } else {
      state.setIsAuthenticated(false);
      showPendingScreen();
    }
  } catch (error) {
    console.error('Ошибка авторизации через Telegram:', error);
    alert('Ошибка авторизации. Попробуйте ещё раз.');
  }
}

/**
 * Handle password-based authentication
 */
export async function handlePasswordLogin(login, password) {
  try {
    const authData = await api.passwordLogin({ login, password });
    console.log('PASSWORD AUTH RESPONSE:', authData);

    const userData = authData?.user;
    state.setCurrentUser(userData || null);

    if (userData && userData.status === 'active') {
      state.setIsAuthenticated(true);
      showMainApp();
      updateUIPermissions();
      await loadPrompts();
    } else {
      state.setIsAuthenticated(false);
      showPendingScreen();
    }
  } catch (error) {
    console.error('Ошибка входа по паролю:', error);
    alert(error.message || 'Ошибка входа по паролю. Попробуйте ещё раз.');
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await api.logout();
    
    state.setIsAuthenticated(false);
    state.setPrompts([]);
    state.setSelectedPromptSlug(null);
    state.setCurrentPrompt(null);
    renderPromptsList();
    renderEditor(null);
    showLoginScreen();
    
    setTimeout(() => {
      location.reload();
    }, 100);
  } catch (error) {
    console.error('Ошибка выхода:', error);
    state.setIsAuthenticated(false);
    showLoginScreen();
    setTimeout(() => {
      location.reload();
    }, 100);
  }
}

/**
 * Update UI permissions based on user access level
 */
function updateUIPermissions() {
  const currentUser = state.getCurrentUser();
  const canEditPrompts = currentUser && (currentUser.access_level === 'admin' || currentUser.access_level === 'tech');
  const isAdmin = currentUser && currentUser.access_level === 'admin';
  
  const newPromptBtn = document.getElementById('newPromptBtn');
  if (newPromptBtn) {
    newPromptBtn.style.display = canEditPrompts ? 'block' : 'none';
  }
  
  const adminUsersBtn = document.getElementById('adminUsersBtn');
  if (adminUsersBtn) {
    adminUsersBtn.style.display = isAdmin ? 'block' : 'none';
  }
}

// Export for use in router
export { handleLogout, updateUIPermissions };

