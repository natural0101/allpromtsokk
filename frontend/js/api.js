// API Configuration
export const API_BASE = '/api';

// Helper function to handle auth errors
// Note: This will be called from router.js which has access to showLoginScreen/showPendingScreen
export function handleAuthError(response) {
  // Return error info instead of calling functions directly
  if (response.status === 401) {
    return { type: 'unauthorized' };
  }
  if (response.status === 403) {
    const reason = response.headers.get('X-Reason');
    if (reason === 'status_not_active') {
      return { type: 'forbidden', reason: 'status_not_active' };
    }
    return { type: 'forbidden' };
  }
  return null;
}

// API Functions
export async function fetchPrompts(folder = null, search = null) {
  try {
    const params = new URLSearchParams();
    if (folder) params.append('folder', folder);
    if (search) params.append('search', search);
    
    const url = `${API_BASE}/prompts${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      credentials: 'include',
    });
    if (!response.ok) {
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки промптов:', error);
    throw error;
  }
}

export async function fetchPromptBySlug(slug) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${slug}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
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

export async function createPrompt(data) {
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
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
      }
      if (response.status === 403) {
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

export async function updatePrompt(slug, data) {
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
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
      }
      if (response.status === 403) {
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

export async function deletePrompt(slug) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${slug}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
      }
      if (response.status === 403) {
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

export async function fetchPromptVersions(promptId) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${promptId}/versions`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
      }
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки версий:', error);
    throw error;
  }
}

export async function fetchPromptVersion(promptId, versionId) {
  try {
    const response = await fetch(`${API_BASE}/prompts/${promptId}/versions/${versionId}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const authError = handleAuthError(response);
      if (authError) {
        throw { ...authError, response };
      }
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки версии:', error);
    throw error;
  }
}

export async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    return null;
  }
}

export async function telegramLogin(user) {
  try {
    const response = await fetch(`${API_BASE}/auth/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      // Передаём на backend ровно тот payload, который прислал Telegram widget
      body: JSON.stringify(user),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Неизвестная ошибка');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    throw error;
  }
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Ошибка выхода:', error);
  }
}

export async function fetchUsers() {
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Доступ запрещён. Только администраторы могут управлять пользователями.');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    throw error;
  }
}

export async function updateUser(userId, data) {
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
        throw new Error('Доступ запрещён. Только администраторы могут изменять пользователей.');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    throw error;
  }
}

