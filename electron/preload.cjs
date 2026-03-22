const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  performAction: (action, options) => {
    console.log('[GestureOS/Preload] performAction → IPC', action, options ?? '');
    return ipcRenderer.invoke('perform-action', { action, options: options ?? null });
  },
  toggleOverlayMode: (enabled) => ipcRenderer.invoke('set-overlay-mode', enabled),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  assistantRequest: (payload) => ipcRenderer.invoke('assistant-request', payload),
});
