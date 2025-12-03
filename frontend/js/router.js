// Router - Navigation, Auth, and Data Loading

import * as api from './api.js';
import * as state from './state.js';
import { renderPromptsList, renderEditor } from './ui.js';
import { confirmUnsavedChanges } from './editor.js';
import { updateUIPermissions } from './events.js';
import { escapeHtml } from './utils.js';

/**
 * Load prompts with filters
 */
export async function loadPrompts(folder = null, search = null, tag = null) {
  try {
    let allPrompts = await api.fetchPrompts(folder, search);
    
    if (tag && tag.trim() !== '') {
      allPrompts = allPrompts.filter(prompt => {
        if (!prompt.tags) return false;
        const tags = prompt.tags.split(',').map(t => t.trim()).filter(t => t);
        return tags.includes(tag);
      });
    }
    
    state.setPrompts(allPrompts);
    renderPromptsList();
  } catch (error) {
    if (error.type === 'unauthorized') {
      showLoginScreen();
    } else if (error.type === 'forbidden' && error.reason === 'status_not_active') {
      showPendingScreen();
    }
    console.error('Ошибка загрузки промптов:', error);
    const container = document.getElementById('treeContainer');
    if (container) {
      container.innerHTML = '<div style="padding: 16px; color: #888; text-align: center;">Ошибка загрузки промптов. Проверьте подключение к серверу.</div>';
    }
  }
}

/**
 * Load a single prompt by slug
 */
export async function loadPrompt(slug) {
  if (state.getIsEditMode() && !confirmUnsavedChanges()) {
    return;
  }
  
  try {
    const prompt = await api.fetchPromptBySlug(slug);
    if (!prompt) {
      state.setHasUnsavedChanges(false);
      state.setOriginalFormData(null);
      renderEditor(null);
      return;
    }
    state.setCurrentPrompt(prompt);
    state.setSelectedPromptSlug(slug);
    state.setHasUnsavedChanges(false);
    state.setOriginalFormData(null);
    renderEditor(prompt);
    renderPromptsList();
  } catch (error) {
    if (error.type === 'unauthorized') {
      showLoginScreen();
    } else if (error.type === 'forbidden' && error.reason === 'status_not_active') {
      showPendingScreen();
    }
    console.error('Ошибка загрузки промпта:', error);
    state.setHasUnsavedChanges(false);
    state.setOriginalFormData(null);
    renderEditor(null);
  }
}

/**
 * Load prompt versions for history tab
 */
export async function loadPromptVersions(promptId) {
  const historyList = document.getElementById('historyList');
  const historyView = document.getElementById('historyView');
  const historyDiff = document.getElementById('historyDiff');
  
  if (!historyList || !historyView) return;
  
  // Сбрасываем выбранные версии при загрузке
  state.setSelectedVersionIds([]);
  
  try {
    historyList.innerHTML = '<div style="padding: 16px; color: rgba(58, 42, 79, 0.6);">Загрузка...</div>';
    historyView.innerHTML = '';
    if (historyDiff) historyDiff.innerHTML = '';
    
    const versions = await api.fetchPromptVersions(promptId);
    
    if (!versions || versions.length === 0) {
      historyList.innerHTML = '<div style="padding: 16px; color: rgba(58, 42, 79, 0.6);">Нет версий</div>';
      return;
    }
    
    // Добавляем контрол для выбора версий
    const diffControl = `
      <div class="history-diff-control">
        <div style="margin-bottom: 12px; font-size: 13px; color: rgba(58, 42, 79, 0.7);">
          Выберите две версии для сравнения
        </div>
        <button class="history-diff-button" id="showDiffBtn" disabled>Показать отличия</button>
      </div>
    `;
    
    // Рендерим список версий с чекбоксами
    const versionsHtml = versions.map(version => {
      const date = new Date(version.created_at);
      const dateStr = date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const userId = version.updated_by_user_id ? `ID: ${version.updated_by_user_id}` : 'Неизвестно';
      
      return `
        <div class="history-item" data-version-id="${version.id}" data-version-number="${version.version}">
          <label class="history-item-checkbox-label">
            <input type="checkbox" class="history-item-checkbox" data-version-id="${version.id}" data-version-number="${version.version}">
            <div class="history-item-content">
              <div class="history-item-header">
                <span class="history-version">Версия ${version.version}</span>
                <span class="history-date">${dateStr}</span>
              </div>
              <div class="history-item-meta">${userId}</div>
            </div>
          </label>
        </div>
      `;
    }).join('');
    
    historyList.innerHTML = diffControl + versionsHtml;
    
    // Находим кнопку показа diff
    const showDiffBtn = document.getElementById('showDiffBtn');
    
    // Добавляем обработчики для чекбоксов
    historyList.querySelectorAll('.history-item-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const versionId = parseInt(checkbox.dataset.versionId);
        const selectedIds = state.getSelectedVersionIds();
        
        if (checkbox.checked) {
          // Если уже выбрано 2 версии, не позволяем выбрать третью
          if (selectedIds.length >= 2) {
            checkbox.checked = false;
            return;
          }
          selectedIds.push(versionId);
        } else {
          const index = selectedIds.indexOf(versionId);
          if (index > -1) {
            selectedIds.splice(index, 1);
          }
        }
        state.setSelectedVersionIds([...selectedIds]);
        
        // Обновляем состояние кнопки
        if (showDiffBtn) {
          showDiffBtn.disabled = selectedIds.length !== 2;
        }
      });
    });
    
    // Обработчик кнопки "Показать отличия"
    if (showDiffBtn) {
      showDiffBtn.addEventListener('click', async () => {
        const selectedIds = state.getSelectedVersionIds();
        if (selectedIds.length !== 2) return;
        
        await showVersionDiff(promptId, selectedIds[0], selectedIds[1], versions);
      });
    }
    
    // Добавляем обработчики клика для просмотра одной версии (без чекбокса)
    historyList.querySelectorAll('.history-item-content').forEach(content => {
      content.addEventListener('click', async (e) => {
        // Игнорируем клики на чекбокс
        if (e.target.closest('.history-item-checkbox')) return;
        
        const item = content.closest('.history-item');
        // Убираем активность с других элементов
        historyList.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const versionId = parseInt(item.dataset.versionId);
        const version = await api.fetchPromptVersion(promptId, versionId);
        
        if (version) {
          const { renderMarkdown } = await import('./utils.js');
          historyView.innerHTML = `
            <div class="history-view-header">
              <h3>Версия ${version.version}</h3>
              <div style="font-size: 12px; color: rgba(58, 42, 79, 0.6); margin-top: 4px;">
                ${new Date(version.created_at).toLocaleString('ru-RU')}
              </div>
            </div>
            <div class="markdown-content">${renderMarkdown(version.content || '')}</div>
          `;
        }
      });
    });
    
    // Автоматически выбираем первую версию для просмотра
    const firstItem = historyList.querySelector('.history-item');
    if (firstItem) {
      const firstContent = firstItem.querySelector('.history-item-content');
      if (firstContent) {
        firstContent.click();
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки версий:', error);
    historyList.innerHTML = '<div style="padding: 16px; color: #ef4444;">Ошибка загрузки версий</div>';
  }
}

async function showVersionDiff(promptId, versionId1, versionId2, allVersions) {
  const historyDiff = document.getElementById('historyDiff');
  if (!historyDiff) return;
  
  try {
    historyDiff.innerHTML = '<div style="padding: 16px; color: rgba(58, 42, 79, 0.6);">Загрузка версий...</div>';
    
    const [version1, version2] = await Promise.all([
      api.fetchPromptVersion(promptId, versionId1),
      api.fetchPromptVersion(promptId, versionId2)
    ]);
    
    if (!version1 || !version2) {
      historyDiff.innerHTML = '<div style="padding: 16px; color: #ef4444;">Ошибка загрузки версий</div>';
      return;
    }
    
    let oldVersion, newVersion;
    if (version1.version < version2.version) {
      oldVersion = version1;
      newVersion = version2;
    } else {
      oldVersion = version2;
      newVersion = version1;
    }
    
    const oldStr = oldVersion.content || "";
    const newStr = newVersion.content || "";
    
    if (typeof Diff === 'undefined' || typeof Diff2Html === 'undefined') {
      historyDiff.innerHTML = '<div style="padding: 16px; color: #ef4444;">Библиотеки для сравнения не загружены</div>';
      return;
    }
    
    const unifiedDiff = Diff.createTwoFilesPatch(
      `v${oldVersion.version}`,
      `v${newVersion.version}`,
      oldStr,
      newStr,
      "",
      ""
    );
    
    const diffHtml = Diff2Html.html(unifiedDiff, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'line-by-line'
    });
    
    historyDiff.innerHTML = diffHtml;
  } catch (error) {
    console.error('Ошибка генерации diff:', error);
    historyDiff.innerHTML = '<div style="padding: 16px; color: #ef4444;">Ошибка генерации сравнения</div>';
  }
}

/**
 * Show login screen
 */
export function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const pendingScreen = document.getElementById('pendingScreen');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';
  if (pendingScreen) pendingScreen.style.display = 'none';
  state.setIsAuthenticated(false);
}

/**
 * Show pending screen
 */
export function showPendingScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const pendingScreen = document.getElementById('pendingScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (mainApp) mainApp.style.display = 'none';
  if (pendingScreen) pendingScreen.style.display = 'flex';
  state.setIsAuthenticated(false);
}

/**
 * Show main app
 */
export function showMainApp() {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const pendingScreen = document.getElementById('pendingScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (mainApp) mainApp.style.display = 'block';
  if (pendingScreen) pendingScreen.style.display = 'none';
  state.setIsAuthenticated(true);
}

/**
 * Check authentication
 */
export async function checkAuth() {
  try {
    const userData = await api.checkAuth();
    if (userData) {
      state.setCurrentUser(userData);
      if (userData.status === 'active') {
        state.setIsAuthenticated(true);
        showMainApp();
        updateUIPermissions();
        return true;
      } else {
        state.setIsAuthenticated(false);
        showPendingScreen();
        return false;
      }
    } else {
      state.setIsAuthenticated(false);
      state.setCurrentUser(null);
      showLoginScreen();
      return false;
    }
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    showLoginScreen();
    return false;
  }
}

/**
 * Show admin panel
 */
export async function showAdminPanel() {
  const editorContent = document.getElementById('editorContent');
  const adminPanel = document.getElementById('adminPanel');
  
  if (!editorContent || !adminPanel) return;
  
  editorContent.style.display = 'none';
  adminPanel.style.display = 'block';
  
  try {
    const users = await api.fetchUsers();
    renderAdminUsersList(users);
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    adminPanel.innerHTML = '<p style="color: var(--brandInk); padding: 24px;">Ошибка загрузки пользователей</p>';
  }
}

/**
 * Render admin users list
 */
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
  
  const closeBtn = adminPanel.querySelector('#closeAdminPanelBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (adminPanel) adminPanel.style.display = 'none';
      if (editorContent) editorContent.style.display = 'block';
    });
  }
}

/**
 * Update user field
 */
async function updateUserField(userId, data) {
  try {
    await api.updateUser(userId, data);
    await showAdminPanel();
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    alert('Ошибка обновления пользователя. Проверьте консоль.');
  }
}

/**
 * Load version
 */
export async function loadVersion() {
  try {
    const res = await fetch('/version.json');
    const data = await res.json();
    const el = document.getElementById('appVersion');
    if (el) el.textContent = data.version;
  } catch {}
}

