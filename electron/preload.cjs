const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setPinAbove: (enabled) => ipcRenderer.invoke('set-pin-above', enabled),

  getWindowMode: () => ipcRenderer.invoke('get-window-mode'),

  pythonBridge: (payload) => ipcRenderer.invoke('python-bridge', payload),

  performAction: (action, options) => {
    console.log('[GestureOS/Preload] performAction → IPC', action, options ?? '');
    return ipcRenderer.invoke('perform-action', { action, options: options ?? null });
  },

  toggleOverlayMode: (enabled) => ipcRenderer.invoke('set-overlay-mode', enabled),

  hideWindow: () => ipcRenderer.invoke('hide-window'),

  showWindow: () => ipcRenderer.invoke('show-window'),

  quitApp: () => ipcRenderer.invoke('quit-app'),

  getPythonBackendStatus: () => ipcRenderer.invoke('get-python-backend-status'),

  ensurePythonBackend: () => ipcRenderer.invoke('ensure-python-backend'),

  assistantRequest: (payload) => ipcRenderer.invoke('assistant-request', payload),

  executeVoiceCommand: (payload) => ipcRenderer.invoke('execute-voice-command', payload),

  recognizeNativeSpeech: (payload) => ipcRenderer.invoke('recognize-native-speech', payload),
});
