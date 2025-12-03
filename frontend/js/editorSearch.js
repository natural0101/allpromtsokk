// Editor Search and Replace

let searchContainer = null;
let textarea = null;
let searchInput = null;
let replaceInput = null;
let caseSensitiveCheckbox = null;
let currentMatchIndex = -1;
let matches = [];
let isReplaceMode = false;

/**
 * Find all matches in text
 * @param {string} text
 * @param {string} query
 * @param {boolean} caseSensitive
 * @returns {Array<{start: number, end: number, text: string}>}
 */
function findMatches(text, query, caseSensitive) {
  if (!query) return [];
  
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(escapeRegex(query), flags);
  const matches = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0]
    });
  }
  
  return matches;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight current match
 */
function highlightMatch() {
  if (!textarea || matches.length === 0 || currentMatchIndex < 0) return;
  
  const match = matches[currentMatchIndex];
  textarea.focus();
  textarea.setSelectionRange(match.start, match.end);
  
  // Scroll to match
  const lineHeight = 20;
  const textBeforeMatch = textarea.value.substring(0, match.start);
  const lineNumber = textBeforeMatch.split('\n').length - 1;
  const scrollTop = lineNumber * lineHeight;
  textarea.scrollTop = Math.max(0, scrollTop - 100);
}

/**
 * Update match counter
 */
function updateMatchCounter() {
  const counter = searchContainer?.querySelector('.search-counter');
  if (!counter) return;
  
  if (matches.length === 0) {
    counter.textContent = searchInput?.value ? 'Не найдено' : '';
  } else {
    counter.textContent = `${currentMatchIndex + 1} / ${matches.length}`;
  }
}

/**
 * Perform search
 */
function performSearch() {
  if (!textarea || !searchInput) return;
  
  const query = searchInput.value;
  const caseSensitive = caseSensitiveCheckbox?.checked || false;
  
  matches = findMatches(textarea.value, query, caseSensitive);
  currentMatchIndex = matches.length > 0 ? 0 : -1;
  
  updateMatchCounter();
  highlightMatch();
}

/**
 * Find next match
 */
function findNext() {
  if (matches.length === 0) {
    performSearch();
    return;
  }
  
  currentMatchIndex = (currentMatchIndex + 1) % matches.length;
  updateMatchCounter();
  highlightMatch();
}

/**
 * Find previous match
 */
function findPrevious() {
  if (matches.length === 0) {
    performSearch();
    return;
  }
  
  currentMatchIndex = currentMatchIndex <= 0 ? matches.length - 1 : currentMatchIndex - 1;
  updateMatchCounter();
  highlightMatch();
}

/**
 * Replace current match
 */
function replaceCurrent() {
  if (!textarea || !replaceInput || matches.length === 0 || currentMatchIndex < 0) return;
  
  const match = matches[currentMatchIndex];
  const replacement = replaceInput.value;
  
  const before = textarea.value.substring(0, match.start);
  const after = textarea.value.substring(match.end);
  const newText = before + replacement + after;
  
  textarea.value = newText;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Recalculate matches
  performSearch();
}

/**
 * Replace all matches
 */
function replaceAll() {
  if (!textarea || !replaceInput || matches.length === 0) return;
  
  const replacement = replaceInput.value;
  let newText = textarea.value;
  let offset = 0;
  
  // Replace from end to start to preserve positions
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const before = newText.substring(0, match.start + offset);
    const after = newText.substring(match.end + offset);
    newText = before + replacement + after;
    offset += replacement.length - (match.end - match.start);
  }
  
  textarea.value = newText;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  matches = [];
  currentMatchIndex = -1;
  updateMatchCounter();
}

/**
 * Render search panel HTML
 */
function renderSearchPanel() {
  if (!searchContainer) return;
  
  searchContainer.innerHTML = `
    <div class="search-panel">
      <div class="search-row">
        <input 
          type="text" 
          id="searchInput" 
          class="search-input" 
          placeholder="Поиск..."
          autocomplete="off"
        />
        <span class="search-counter" id="searchCounter"></span>
        <label class="search-checkbox">
          <input type="checkbox" id="caseSensitiveCheckbox">
          <span>Учёт регистра</span>
        </label>
        <button type="button" class="search-btn" id="searchPrevBtn" title="Предыдущий (Shift+Enter)">↑</button>
        <button type="button" class="search-btn" id="searchNextBtn" title="Следующий (Enter)">↓</button>
        <button type="button" class="search-btn" id="searchCloseBtn" title="Закрыть (Esc)">×</button>
      </div>
      <div class="search-row replace-row" id="replaceRow" style="display: none;">
        <input 
          type="text" 
          id="replaceInput" 
          class="search-input" 
          placeholder="Заменить на..."
          autocomplete="off"
        />
        <button type="button" class="search-btn search-btn-replace" id="replaceBtn">Заменить</button>
        <button type="button" class="search-btn search-btn-replace" id="replaceAllBtn">Заменить всё</button>
      </div>
    </div>
  `;
  
  // Get references
  searchInput = searchContainer.querySelector('#searchInput');
  replaceInput = searchContainer.querySelector('#replaceInput');
  caseSensitiveCheckbox = searchContainer.querySelector('#caseSensitiveCheckbox');
  const prevBtn = searchContainer.querySelector('#searchPrevBtn');
  const nextBtn = searchContainer.querySelector('#searchNextBtn');
  const closeBtn = searchContainer.querySelector('#searchCloseBtn');
  const replaceBtn = searchContainer.querySelector('#replaceBtn');
  const replaceAllBtn = searchContainer.querySelector('#replaceAllBtn');
  const replaceRow = searchContainer.querySelector('#replaceRow');
  
  // Event handlers
  searchInput?.addEventListener('input', performSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      findNext();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      findPrevious();
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });
  
  caseSensitiveCheckbox?.addEventListener('change', performSearch);
  
  prevBtn?.addEventListener('click', findPrevious);
  nextBtn?.addEventListener('click', findNext);
  closeBtn?.addEventListener('click', closeSearch);
  replaceBtn?.addEventListener('click', replaceCurrent);
  replaceAllBtn?.addEventListener('click', replaceAll);
  
  replaceInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
    }
  });
}

/**
 * Initialize search
 * @param {HTMLTextAreaElement} textareaElement
 * @param {HTMLElement} searchContainerElement
 */
export function initSearch(textareaElement, searchContainerElement) {
  if (!textareaElement || !searchContainerElement) return;
  
  textarea = textareaElement;
  searchContainer = searchContainerElement;
  
  renderSearchPanel();
}

/**
 * Open search panel
 * @param {string} initialQuery
 * @param {boolean} replaceMode
 */
export function openSearch(initialQuery = '', replaceMode = false) {
  if (!searchContainer || !searchInput) return;
  
  isReplaceMode = replaceMode;
  const replaceRow = searchContainer.querySelector('#replaceRow');
  
  if (replaceMode && replaceRow) {
    replaceRow.style.display = 'flex';
  } else if (replaceRow) {
    replaceRow.style.display = 'none';
  }
  
  searchContainer.style.display = 'block';
  
  if (initialQuery) {
    searchInput.value = initialQuery;
    performSearch();
  }
  
  // Always focus on search input first, even in replace mode
  // User can tab to replace input if needed
  searchInput.focus();
  searchInput.select();
}

/**
 * Close search panel
 */
export function closeSearch() {
  if (!searchContainer) return;
  
  searchContainer.style.display = 'none';
  matches = [];
  currentMatchIndex = -1;
  
  if (textarea) {
    textarea.focus();
  }
}

/**
 * Destroy search
 */
export function destroySearch() {
  closeSearch();
  
  searchInput = null;
  replaceInput = null;
  caseSensitiveCheckbox = null;
  searchContainer = null;
  textarea = null;
  matches = [];
  currentMatchIndex = -1;
}


