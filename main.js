const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// Derive encryption key from machine-specific identifiers
// This creates a unique key per machine without storing it in plain text
function getEncryptionKey() {
  const machineId = `${require('os').hostname()}-${require('os').userInfo().username}-passcryption`;
  return crypto.createHash('sha256').update(machineId).digest('hex');
}

const DATA_FILE = path.join(app.getPath('userData'), 'passwords.enc');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let mainWindow;
let overlayWindow;
let tray;

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    title: 'QuickPass - Password Manager',
    icon: fs.existsSync(iconPath) ? iconPath : undefined
  });

  mainWindow.loadFile('index.html');

  // Uncomment for dev tools
  // mainWindow.webContents.openDevTools();
}

// Create overlay window (hidden by default)
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 420,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile('overlay.html');

  // Hide when loses focus
  overlayWindow.on('blur', () => {
    hideOverlay();
  });
}

// Show overlay near cursor
function showOverlay() {
  if (!overlayWindow) return;

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const { x: screenX, y: screenY } = display.workArea;

  // Calculate position (near cursor but within screen bounds)
  let x = cursorPoint.x - 210; // Center horizontally on cursor
  let y = cursorPoint.y + 20;  // Below cursor

  // Keep within screen bounds
  if (x < screenX) x = screenX + 10;
  if (x + 420 > screenX + screenWidth) x = screenX + screenWidth - 430;
  if (y + 380 > screenY + screenHeight) y = cursorPoint.y - 400; // Above cursor if no room below

  overlayWindow.setPosition(Math.round(x), Math.round(y));
  overlayWindow.show();
  overlayWindow.focus();
  overlayWindow.webContents.send('overlay-shown');
}

// Hide overlay
function hideOverlay() {
  if (overlayWindow && overlayWindow.isVisible()) {
    overlayWindow.hide();
  }
}

// Register global hotkey
function registerGlobalShortcut() {
  const shortcut = 'CommandOrControl+Shift+P';

  const registered = globalShortcut.register(shortcut, () => {
    if (overlayWindow && overlayWindow.isVisible()) {
      hideOverlay();
    } else {
      showOverlay();
    }
  });

  if (!registered) {
    console.error('Failed to register global shortcut. It may be in use by another application.');
  }
}

// Create system tray
function createTray() {
  // Create a simple 16x16 icon if no icon file exists
  let trayIcon;
  const iconPath = path.join(__dirname, 'icon.png');

  if (fs.existsSync(iconPath)) {
    trayIcon = iconPath;
  } else {
    // Create a simple lock icon using nativeImage
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEPSURBVDiNpZMxSsNQGMd/L0lJh+Ig4uTi4OLgUHDo5OIBPICLt3B09QQewEHo4OLk4OABnBwcnBQcHVQQhSItJfFeHPJCkjbV/pfv+/6/j/fyPmNpmqJF1FVVvegQHRJEBJG41/OAnwIQMoGvzJHAvU42H5i2BH7N/CcLEr+dLFPzGvd1uvqxzYGAF6H0vDPJalfANYi4KO1EgRd4OvXZuHAGaIkNfAPXgL4CzjxrJk+q3wQ+BUQWL8DXv4CfE7gsILIC3MsOkjyB/wKCwJPAk0bTZknS1QmIbA4CLwInuecxe5l2kGQDeNK5FDAj0oXAPeCx9HqRbIvIJPDOTJIBkc4dAvezQGAW+CBZFPA7j/oNHDJ1q7t0LWQAAAAASUVORK5CYII=');
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open QuickPass', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: 'Quick Access', accelerator: 'CmdOrCtrl+Shift+P', click: () => showOverlay() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip('QuickPass - Password Manager');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Encrypt data using derived key
function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), getEncryptionKey()).toString();
}

// Decrypt data using derived key
function decrypt(encryptedData) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, getEncryptionKey());
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (e) {
    return [];
  }
}

// Load passwords from file
function loadPasswords() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const encryptedData = fs.readFileSync(DATA_FILE, 'utf8');
      return decrypt(encryptedData);
    }
  } catch (e) {
    console.error('Error loading passwords:', e);
  }
  return [];
}

// Save passwords to file
function savePasswords(passwords) {
  try {
    const encryptedData = encrypt(passwords);
    fs.writeFileSync(DATA_FILE, encryptedData, 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving passwords:', e);
    return false;
  }
}

function scheduleClipboardClear(copiedText) {
  const { clipboardClearTime = 0 } = loadSettings();
  const clearSeconds = Number(clipboardClearTime);

  if (!Number.isFinite(clearSeconds) || clearSeconds <= 0) {
    return;
  }

  setTimeout(() => {
    if (clipboard.readText() === copiedText) {
      clipboard.clear();
    }
  }, clearSeconds * 1000);
}

// IPC Handlers
ipcMain.handle('get-passwords', async () => {
  return loadPasswords();
});

ipcMain.handle('save-password', async (event, entry) => {
  const passwords = loadPasswords();
  entry.id = Date.now().toString();
  entry.createdAt = new Date().toISOString();
  passwords.push(entry);
  return savePasswords(passwords);
});

ipcMain.handle('update-password', async (event, entry) => {
  const passwords = loadPasswords();
  const index = passwords.findIndex(p => p.id === entry.id);
  if (index !== -1) {
    passwords[index] = { ...passwords[index], ...entry, updatedAt: new Date().toISOString() };
    return savePasswords(passwords);
  }
  return false;
});

ipcMain.handle('delete-password', async (event, id) => {
  const passwords = loadPasswords();
  const filtered = passwords.filter(p => p.id !== id);
  return savePasswords(filtered);
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  clipboard.writeText(text);
  scheduleClipboardClear(text);
  return true;
});

ipcMain.handle('generate-password', async (event, options) => {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    allowedSymbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  } = options;

  let charset = '';
  const hasSymbols = includeSymbols && typeof allowedSymbols === 'string' && allowedSymbols.length > 0;

  if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (includeNumbers) charset += '0123456789';
  if (hasSymbols) charset += allowedSymbols;

  if (charset.length === 0) {
    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }

  let password = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  // Cryptographically secure random index helper
  const secureRandomIndex = (max) => {
    const randomBytes = crypto.randomBytes(4);
    return randomBytes.readUInt32BE(0) % max;
  };

  // Ensure at least one character from each selected category
  let finalPassword = password.split('');
  let position = 0;

  if (includeLowercase && !/[a-z]/.test(password)) {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    finalPassword[position++] = chars[secureRandomIndex(chars.length)];
  }
  if (includeUppercase && !/[A-Z]/.test(password)) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    finalPassword[position++] = chars[secureRandomIndex(chars.length)];
  }
  if (includeNumbers && !/[0-9]/.test(password)) {
    const chars = '0123456789';
    finalPassword[position++] = chars[secureRandomIndex(chars.length)];
  }
  if (hasSymbols) {
    const symbolRegex = new RegExp(`[${allowedSymbols.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
    if (!symbolRegex.test(password)) {
      finalPassword[position++] = allowedSymbols[secureRandomIndex(allowedSymbols.length)];
    }
  }

  // Cryptographically secure Fisher-Yates shuffle
  for (let i = finalPassword.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    [finalPassword[i], finalPassword[j]] = [finalPassword[j], finalPassword[i]];
  }

  return finalPassword.join('');
});

app.whenReady().then(() => {
  createWindow();
  createOverlayWindow();
  registerGlobalShortcut();
  createTray();

  // Minimize to tray instead of quit
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit, stay in tray
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Overlay-specific IPC handlers
ipcMain.handle('hide-overlay', () => {
  hideOverlay();
});

ipcMain.handle('overlay-get-passwords', async () => {
  return loadPasswords();
});

ipcMain.handle('overlay-copy-password', async (event, password) => {
  clipboard.writeText(password);
  scheduleClipboardClear(password);
  hideOverlay();
  return true;
});

ipcMain.handle('overlay-copy-username', async (event, username) => {
  clipboard.writeText(username);
  scheduleClipboardClear(username);
  return true;
});

// Auto-type password (simulates keyboard input)
ipcMain.handle('overlay-type-password', async (event, password) => {
  hideOverlay();

  // Wait for overlay to hide and focus to return
  await new Promise(resolve => setTimeout(resolve, 150));

  // Use PowerShell to simulate keyboard input (Windows)
  // This is more reliable than robotjs for special characters
  const { exec } = require('child_process');

  return new Promise((resolve, reject) => {
    // Escape special PowerShell characters
    const escapedPassword = password
      .replace(/`/g, '``')
      .replace(/"/g, '`"')
      .replace(/\$/g, '`$')
      .replace(/'/g, "''");

    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait('${escapedPassword.replace(/[+^%~(){}[\]]/g, '{$&}')}')
    `;

    exec(`powershell -Command "${script.replace(/"/g, '\\"')}"`, (error) => {
      if (error) {
        console.error('Auto-type error:', error);
        // Fallback: just copy to clipboard
        clipboard.writeText(password);
        scheduleClipboardClear(password);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
});

// Settings handlers
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  return { theme: 'dark', clipboardClearTime: 30 };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving settings:', e);
    return false;
  }
}

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (event, settings) => saveSettings(settings));
