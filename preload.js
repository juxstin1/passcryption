const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPasswords: () => ipcRenderer.invoke('get-passwords'),
  savePassword: (entry) => ipcRenderer.invoke('save-password', entry),
  updatePassword: (entry) => ipcRenderer.invoke('update-password', entry),
  deletePassword: (id) => ipcRenderer.invoke('delete-password', id),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  generatePassword: (options) => ipcRenderer.invoke('generate-password', options),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
