// Main Entry Point

import { setupPromptsListEvents, setupHeaderButtons, setupSearch, setupKeyboardShortcuts, setupTelegramLogin } from './frontend/js/events.js';
import { checkAuth, loadVersion } from './frontend/js/router.js';
import { loadPrompts } from './frontend/js/router.js';

/**
 * Initialize application
 */
function initApp() {
  setupPromptsListEvents();
  setupHeaderButtons();
  setupSearch();
  setupKeyboardShortcuts();
  setupTelegramLogin();
  
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
