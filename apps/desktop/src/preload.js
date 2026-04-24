const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("autoflow", {
  selectProject: () => ipcRenderer.invoke("dialog:selectProject"),
  readBoard: (options) => ipcRenderer.invoke("autoflow:readBoard", options),
  installBoard: (options) => ipcRenderer.invoke("autoflow:installBoard", options)
});
