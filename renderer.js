// State
let passwords = [];
let currentEditId = null;
let targetPasswordField = null;
let settings = { theme: 'dark', clipboardClearTime: 30 };

// DOM Elements
const listView = document.getElementById('list-view');
const createView = document.getElementById('create-view');
const editView = document.getElementById('edit-view');
const settingsView = document.getElementById('settings-view');
const passwordList = document.getElementById('password-list');
const searchInput = document.getElementById('search-input');
const createForm = document.getElementById('create-form');
const editForm = document.getElementById('edit-form');
const generatorModal = document.getElementById('generator-modal');
const generatedPasswordInput = document.getElementById('generated-password');
const passwordCountEl = document.getElementById('password-count');

// Theme Manager
const ThemeManager = {
  init() {
    this.applyTheme(settings.theme);
    this.listenForSystemChanges();
  },

  applyTheme(theme) {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  listenForSystemChanges() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (settings.theme === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  },

  setTheme(theme) {
    settings.theme = theme;
    this.applyTheme(theme);
    window.api.saveSettings(settings);
  }
};

// Initialize
async function init() {
  await loadSettings();
  await loadPasswords();
  setupEventListeners();
  renderPasswordList();
  ThemeManager.init();
}

// Load settings
async function loadSettings() {
  settings = await window.api.getSettings();
  // Apply settings to UI
  const themeSelect = document.getElementById('theme-select');
  const clipboardSelect = document.getElementById('clipboard-clear-select');
  if (themeSelect) themeSelect.value = settings.theme || 'dark';
  if (clipboardSelect) clipboardSelect.value = (settings.clipboardClearTime || 30).toString();
}

// Load passwords from storage
async function loadPasswords() {
  passwords = await window.api.getPasswords();
  updatePasswordCount();
}

// Update password count in sidebar
function updatePasswordCount() {
  const count = passwords.length;
  passwordCountEl.textContent = `${count} password${count !== 1 ? 's' : ''} saved`;
}

// Setup event listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    renderPasswordList(e.target.value);
  });

  // Create form
  createForm.addEventListener('submit', handleCreateSubmit);

  // Edit form
  editForm.addEventListener('submit', handleEditSubmit);
  document.getElementById('delete-btn').addEventListener('click', handleDelete);

  // Password visibility toggle
  document.getElementById('toggle-password').addEventListener('click', () => {
    togglePasswordVisibility('password');
  });
  document.getElementById('toggle-edit-password').addEventListener('click', () => {
    togglePasswordVisibility('edit-password');
  });

  // Generator modal
  document.getElementById('open-generator').addEventListener('click', () => {
    targetPasswordField = 'password';
    openGenerator();
  });
  document.getElementById('open-generator-edit').addEventListener('click', () => {
    targetPasswordField = 'edit-password';
    openGenerator();
  });
  document.getElementById('close-generator').addEventListener('click', closeGenerator);
  document.getElementById('cancel-generator').addEventListener('click', closeGenerator);
  document.getElementById('use-password').addEventListener('click', useGeneratedPassword);

  // Generator options
  document.getElementById('password-length').addEventListener('input', (e) => {
    document.getElementById('length-value').textContent = e.target.value;
    generateNewPassword();
  });

  ['include-uppercase', 'include-lowercase', 'include-numbers', 'include-symbols'].forEach(id => {
    document.getElementById(id).addEventListener('change', generateNewPassword);
  });

  document.getElementById('allowed-symbols').addEventListener('input', generateNewPassword);

  // Symbol presets
  document.querySelectorAll('.symbol-presets button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('allowed-symbols').value = btn.dataset.symbols;
      generateNewPassword();
    });
  });

  // Generator actions
  document.getElementById('copy-generated').addEventListener('click', async () => {
    await window.api.copyToClipboard(generatedPasswordInput.value);
    showToast('Password copied!', 'success');
  });
  document.getElementById('refresh-password').addEventListener('click', generateNewPassword);

  // Close modal on background click
  generatorModal.addEventListener('click', (e) => {
    if (e.target === generatorModal) closeGenerator();
  });

  // Settings event listeners
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      ThemeManager.setTheme(e.target.value);
    });
  }

  const clipboardSelect = document.getElementById('clipboard-clear-select');
  if (clipboardSelect) {
    clipboardSelect.addEventListener('change', (e) => {
      settings.clipboardClearTime = parseInt(e.target.value);
      window.api.saveSettings(settings);
    });
  }
}

// Switch between views
function switchView(viewName) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  // Update views
  listView.classList.toggle('active', viewName === 'list');
  createView.classList.toggle('active', viewName === 'create');
  editView.classList.toggle('active', viewName === 'edit');
  settingsView.classList.toggle('active', viewName === 'settings');

  // Reset forms when leaving
  if (viewName === 'create') {
    createForm.reset();
  }
}

// Make switchView available globally for inline onclick
window.switchView = switchView;

// Render password list
function renderPasswordList(searchTerm = '') {
  const filtered = passwords.filter(p =>
    p.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.username && p.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (filtered.length === 0) {
    if (passwords.length === 0) {
      passwordList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔑</span>
          <p>No passwords saved yet</p>
          <button class="btn btn-primary" onclick="switchView('create')">Add Your First Login</button>
        </div>
      `;
    } else {
      passwordList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>No results found for "${searchTerm}"</p>
        </div>
      `;
    }
    return;
  }

  passwordList.innerHTML = filtered.map(p => `
    <div class="password-card" data-id="${p.id}">
      <div class="card-header">
        <span class="card-site">${escapeHtml(p.site)}</span>
        <div class="card-actions">
          <button class="btn btn-icon copy-btn" onclick="copyPassword('${p.id}')" title="Copy Password">📋</button>
          <button class="btn btn-icon" onclick="editPassword('${p.id}')" title="Edit">✏️</button>
        </div>
      </div>
      <div class="card-details">
        ${p.username ? `
          <div class="card-row">
            <span class="card-label">User</span>
            <span class="card-value">${escapeHtml(p.username)}</span>
            <button class="btn btn-icon copy-btn btn-small" onclick="copyField('${escapeHtml(p.username)}')" title="Copy">📋</button>
          </div>
        ` : ''}
        ${p.email ? `
          <div class="card-row">
            <span class="card-label">Email</span>
            <span class="card-value">${escapeHtml(p.email)}</span>
            <button class="btn btn-icon copy-btn btn-small" onclick="copyField('${escapeHtml(p.email)}')" title="Copy">📋</button>
          </div>
        ` : ''}
        <div class="card-row">
          <span class="card-label">Password</span>
          <span class="card-value password">••••••••••••</span>
          <button class="btn btn-icon copy-btn btn-small" onclick="copyPassword('${p.id}')" title="Copy">📋</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy password to clipboard
async function copyPassword(id) {
  const entry = passwords.find(p => p.id === id);
  if (entry) {
    await window.api.copyToClipboard(entry.password);
    showToast('Password copied to clipboard!', 'success');
  }
}
window.copyPassword = copyPassword;

// Copy any field to clipboard
async function copyField(value) {
  await window.api.copyToClipboard(value);
  showToast('Copied to clipboard!', 'success');
}
window.copyField = copyField;

// Edit password
function editPassword(id) {
  const entry = passwords.find(p => p.id === id);
  if (!entry) return;

  currentEditId = id;
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-site').value = entry.site;
  document.getElementById('edit-username').value = entry.username || '';
  document.getElementById('edit-email').value = entry.email || '';
  document.getElementById('edit-password').value = entry.password;
  document.getElementById('edit-notes').value = entry.notes || '';

  switchView('edit');
}
window.editPassword = editPassword;

// Handle create form submit
async function handleCreateSubmit(e) {
  e.preventDefault();

  const entry = {
    site: document.getElementById('site').value.trim(),
    username: document.getElementById('username').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    notes: document.getElementById('notes').value.trim()
  };

  const success = await window.api.savePassword(entry);
  if (success) {
    showToast('Password saved successfully!', 'success');
    createForm.reset();
    await loadPasswords();
    renderPasswordList();
    switchView('list');
  } else {
    showToast('Failed to save password', 'error');
  }
}

// Handle edit form submit
async function handleEditSubmit(e) {
  e.preventDefault();

  const entry = {
    id: document.getElementById('edit-id').value,
    site: document.getElementById('edit-site').value.trim(),
    username: document.getElementById('edit-username').value.trim(),
    email: document.getElementById('edit-email').value.trim(),
    password: document.getElementById('edit-password').value,
    notes: document.getElementById('edit-notes').value.trim()
  };

  const success = await window.api.updatePassword(entry);
  if (success) {
    showToast('Password updated successfully!', 'success');
    await loadPasswords();
    renderPasswordList();
    switchView('list');
  } else {
    showToast('Failed to update password', 'error');
  }
}

// Handle delete
async function handleDelete() {
  if (!currentEditId) return;

  if (confirm('Are you sure you want to delete this login? This cannot be undone.')) {
    const success = await window.api.deletePassword(currentEditId);
    if (success) {
      showToast('Password deleted', 'success');
      await loadPasswords();
      renderPasswordList();
      switchView('list');
    } else {
      showToast('Failed to delete password', 'error');
    }
  }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Open generator modal
async function openGenerator() {
  generatorModal.classList.add('active');
  await generateNewPassword();
}

// Close generator modal
function closeGenerator() {
  generatorModal.classList.remove('active');
}

// Generate new password
async function generateNewPassword() {
  const options = {
    length: parseInt(document.getElementById('password-length').value),
    includeUppercase: document.getElementById('include-uppercase').checked,
    includeLowercase: document.getElementById('include-lowercase').checked,
    includeNumbers: document.getElementById('include-numbers').checked,
    includeSymbols: document.getElementById('include-symbols').checked,
    allowedSymbols: document.getElementById('allowed-symbols').value
  };

  const password = await window.api.generatePassword(options);
  generatedPasswordInput.value = password;
  updateStrengthIndicator(password, options);
}

// Update password strength indicator
function updateStrengthIndicator(password, options) {
  let score = 0;

  // Length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  // Character variety
  if (options.includeLowercase) score += 1;
  if (options.includeUppercase) score += 1;
  if (options.includeNumbers) score += 1;
  if (options.includeSymbols) score += 2;

  const strengthFill = document.getElementById('strength-fill');
  const strengthText = document.getElementById('strength-text');

  if (score <= 3) {
    strengthFill.className = 'strength-fill weak';
    strengthText.textContent = 'Weak';
    strengthText.style.color = '#ef4444';
  } else if (score <= 5) {
    strengthFill.className = 'strength-fill fair';
    strengthText.textContent = 'Fair';
    strengthText.style.color = '#f59e0b';
  } else if (score <= 7) {
    strengthFill.className = 'strength-fill good';
    strengthText.textContent = 'Good';
    strengthText.style.color = '#84cc16';
  } else {
    strengthFill.className = 'strength-fill strong';
    strengthText.textContent = 'Strong';
    strengthText.style.color = '#22c55e';
  }
}

// Use generated password
function useGeneratedPassword() {
  const password = generatedPasswordInput.value;
  if (targetPasswordField) {
    document.getElementById(targetPasswordField).value = password;
  }
  closeGenerator();
  showToast('Password applied!', 'success');
}

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  toastMessage.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Initialize the app
init();
