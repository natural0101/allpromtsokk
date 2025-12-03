// Application State Management

export const state = {
  prompts: [],
  selectedPromptSlug: null,
  currentPrompt: null,
  isEditMode: false,
  collapsedFolders: new Set(),
  hasUnsavedChanges: false,
  originalFormData: null,
  isAuthenticated: false,
  currentUser: null,
  selectedVersionIds: [],
};

// Helper functions to access state
export function getPrompts() {
  return state.prompts;
}

export function setPrompts(prompts) {
  state.prompts = prompts;
}

export function getSelectedPromptSlug() {
  return state.selectedPromptSlug;
}

export function setSelectedPromptSlug(slug) {
  state.selectedPromptSlug = slug;
}

export function getCurrentPrompt() {
  return state.currentPrompt;
}

export function setCurrentPrompt(prompt) {
  state.currentPrompt = prompt;
}

export function getIsEditMode() {
  return state.isEditMode;
}

export function setIsEditMode(value) {
  state.isEditMode = value;
}

export function getCollapsedFolders() {
  return state.collapsedFolders;
}

export function toggleFolder(folderPath) {
  if (state.collapsedFolders.has(folderPath)) {
    state.collapsedFolders.delete(folderPath);
  } else {
    state.collapsedFolders.add(folderPath);
  }
}

export function getHasUnsavedChanges() {
  return state.hasUnsavedChanges;
}

export function setHasUnsavedChanges(value) {
  state.hasUnsavedChanges = value;
}

export function getOriginalFormData() {
  return state.originalFormData;
}

export function setOriginalFormData(data) {
  state.originalFormData = data;
}

export function getIsAuthenticated() {
  return state.isAuthenticated;
}

export function setIsAuthenticated(value) {
  state.isAuthenticated = value;
}

export function getCurrentUser() {
  return state.currentUser;
}

export function setCurrentUser(user) {
  state.currentUser = user;
}

export function getSelectedVersionIds() {
  return state.selectedVersionIds;
}

export function setSelectedVersionIds(ids) {
  state.selectedVersionIds = ids;
}

export function resetState() {
  state.prompts = [];
  state.selectedPromptSlug = null;
  state.currentPrompt = null;
  state.isEditMode = false;
  state.collapsedFolders = new Set();
  state.hasUnsavedChanges = false;
  state.originalFormData = null;
  state.isAuthenticated = false;
  state.currentUser = null;
  state.selectedVersionIds = [];
}

