const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  getPasswords: () => ipcRenderer.invoke('overlay-get-passwords'),
  copyPassword: (password) => ipcRenderer.invoke('overlay-copy-password', password),
  copyUsername: (username) => ipcRenderer.invoke('overlay-copy-username', username),
  typePassword: (password) => ipcRenderer.invoke('overlay-type-password', password),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  onShown: (callback) => ipcRenderer.on('overlay-shown', callback)
});
