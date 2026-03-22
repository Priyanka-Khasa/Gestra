"use strict";
const require$$0 = require("electron");
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var preload$1 = {};
var hasRequiredPreload;
function requirePreload() {
  if (hasRequiredPreload) return preload$1;
  hasRequiredPreload = 1;
  const { contextBridge, ipcRenderer } = require$$0;
  contextBridge.exposeInMainWorld("electronAPI", {
    performAction: (action, options) => {
      console.log("[GestureOS/Preload] performAction → IPC", action, options ?? "");
      return ipcRenderer.invoke("perform-action", { action, options: options ?? null });
    },
    toggleOverlayMode: (enabled) => ipcRenderer.invoke("set-overlay-mode", enabled),
    hideWindow: () => ipcRenderer.invoke("hide-window"),
    showWindow: () => ipcRenderer.invoke("show-window"),
    assistantRequest: (payload) => ipcRenderer.invoke("assistant-request", payload)
  });
  return preload$1;
}
var preloadExports = requirePreload();
const preload = /* @__PURE__ */ getDefaultExportFromCjs(preloadExports);
module.exports = preload;
