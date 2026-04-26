const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("autoflow", {
  getConfig: () => ipcRenderer.invoke("autoflow:getConfig"),
  listInstalledAgentProfiles: () => ipcRenderer.invoke("autoflow:listInstalledAgentProfiles"),
  selectProject: () => ipcRenderer.invoke("dialog:selectProject"),
  readBoard: (options) => ipcRenderer.invoke("autoflow:readBoard", options),
  installBoard: (options) => ipcRenderer.invoke("autoflow:installBoard", options),
  listRunners: (options) => ipcRenderer.invoke("autoflow:listRunners", options),
  controlRunner: (options) => ipcRenderer.invoke("autoflow:controlRunner", options),
  listRunnerArtifacts: (options) => ipcRenderer.invoke("autoflow:listRunnerArtifacts", options),
  runRole: (options) => ipcRenderer.invoke("autoflow:runRole", options),
  configureRunner: (options) => ipcRenderer.invoke("autoflow:configureRunner", options),
  createRunner: (options) => ipcRenderer.invoke("autoflow:createRunner", options),
  controlWiki: (options) => ipcRenderer.invoke("autoflow:controlWiki", options),
  writeMetricsSnapshot: (options) => ipcRenderer.invoke("autoflow:writeMetricsSnapshot", options),
  controlStopHook: (options) => ipcRenderer.invoke("autoflow:controlStopHook", options),
  controlWatcher: (options) => ipcRenderer.invoke("autoflow:controlWatcher", options),
  readBoardFile: (options) => ipcRenderer.invoke("autoflow:readBoardFile", options)
});
