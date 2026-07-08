const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  platform: process.platform
});
