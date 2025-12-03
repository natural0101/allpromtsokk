// Main Entry Point

import { setupPromptsListEvents, setupHeaderButtons, setupSearch, setupKeyboardShortcuts } from './frontend/js/events.js';
import { handleTelegramAuth } from './frontend/js/events.js';
import { checkAuth, loadVersion } from './frontend/js/router.js';
import { loadPrompts } from './frontend/js/router.js';

// Пробрасываем обработчик из модулей в глобальный scope для fallback-скрипта
window.handleTelegramAuthFromApp = (user) => handleTelegramAuth(user);

/**
 * Initialize application
 */
function initApp() {
  setupPromptsListEvents();
  setupHeaderButtons();
  setupSearch();
  setupKeyboardShortcuts();
  
  // Check authentication on page load
  checkAuth().then((authenticated) => {
    if (authenticated) {
      loadPrompts();
    }
  });
  
  loadVersion();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
