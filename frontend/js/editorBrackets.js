// Editor Bracket Highlighting

let textarea = null;
let highlightTimeout = null;

/**
 * Find matching bracket
 * @param {string} text
 * @param {number} position
 * @param {string} openBracket
 * @param {string} closeBracket
 * @returns {number|null}
 */
function findMatchingBracket(text, position, openBracket, closeBracket) {
  if (position < 0 || position >= text.length) return null;
  
  const char = text[position];
  let isOpen = char === openBracket;
  let isClose = char === closeBracket;
  
  if (!isOpen && !isClose) return null;
  
  const direction = isOpen ? 1 : -1;
  const targetBracket = isOpen ? closeBracket : openBracket;
  let depth = 1;
  let pos = position + direction;
  
  while (pos >= 0 && pos < text.length) {
    if (text[pos] === openBracket) {
      depth += direction;
    } else if (text[pos] === closeBracket) {
      depth -= direction;
    }
    
    if (depth === 0) {
      return pos;
    }
    
    pos += direction;
  }
  
  return null;
}

/**
 * Highlight brackets
 * @param {HTMLTextAreaElement} textareaElement
 */
function highlightBrackets(textareaElement) {
  if (!textareaElement) return;
  
  const text = textareaElement.value;
  const cursorPos = textareaElement.selectionStart;
  
  if (cursorPos < 0 || cursorPos > text.length) return;
  
  const bracketPairs = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}']
  ];
  
  let matchPos = null;
  
  for (const [open, close] of bracketPairs) {
    // Check character before cursor
    if (cursorPos > 0 && text[cursorPos - 1] === open) {
      matchPos = findMatchingBracket(text, cursorPos - 1, open, close);
      if (matchPos !== null) {
        highlightBracketPair(textareaElement, cursorPos - 1, matchPos);
        return;
      }
    }
    
    // Check character at cursor
    if (cursorPos < text.length && text[cursorPos] === close) {
      matchPos = findMatchingBracket(text, cursorPos, open, close);
      if (matchPos !== null) {
        highlightBracketPair(textareaElement, matchPos, cursorPos);
        return;
      }
    }
  }
  
  // Clear highlight if no match
  clearBracketHighlight(textareaElement);
}

/**
 * Highlight bracket pair (visual feedback via selection)
 * @param {HTMLTextAreaElement} textareaElement
 * @param {number} pos1
 * @param {number} pos2
 */
function highlightBracketPair(textareaElement, pos1, pos2) {
  // Note: textarea doesn't support CSS highlighting, so we use a brief selection flash
  // For better UX, we could add a visual indicator overlay, but for simplicity
  // we'll just briefly select both brackets
  
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
  }
  
  // Store original selection
  const originalStart = textareaElement.selectionStart;
  const originalEnd = textareaElement.selectionEnd;
  
  // Flash highlight on first bracket
  textareaElement.setSelectionRange(pos1, pos1 + 1);
  
  highlightTimeout = setTimeout(() => {
    // Flash highlight on second bracket
    textareaElement.setSelectionRange(pos2, pos2 + 1);
    
    setTimeout(() => {
      // Restore original selection
      textareaElement.setSelectionRange(originalStart, originalEnd);
      highlightTimeout = null;
    }, 150);
  }, 150);
}

/**
 * Clear bracket highlight
 */
function clearBracketHighlight(textareaElement) {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
}

/**
 * Initialize bracket highlighting
 * @param {HTMLTextAreaElement} textareaElement
 */
export function initBracketHighlighting(textareaElement) {
  if (!textareaElement) return;
  
  textarea = textareaElement;
  
  // Listen to cursor movement
  textarea.addEventListener('keyup', () => {
    highlightBrackets(textarea);
  });
  
  textarea.addEventListener('click', () => {
    highlightBrackets(textarea);
  });
  
  // Initial highlight
  setTimeout(() => highlightBrackets(textarea), 100);
}

/**
 * Destroy bracket highlighting
 */
export function destroyBracketHighlighting() {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
  
  if (textarea) {
    clearBracketHighlight(textarea);
  }
  
  textarea = null;
}


