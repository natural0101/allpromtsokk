// Main Entry Point

import {
  setupPromptsListEvents,
  setupHeaderButtons,
  setupSearch,
  setupKeyboardShortcuts,
  handleTelegramAuth,
} from './frontend/js/events.js';
import { checkAuth, loadVersion, loadPrompts } from './frontend/js/router.js';

// Глобальный хук для Telegram Login Widget
window.onTelegramAuth = (user) => handleTelegramAuth(user);

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
