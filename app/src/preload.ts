import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type RendererHandler = (payload: unknown) => void;

function subscribe(channel: string, handler: unknown) {
  if (typeof handler !== "function") return () => {};
  const listener = (_event: IpcRendererEvent, payload: unknown) => {
    try {
      (handler as RendererHandler)(payload);
    } catch {
      // ignore — renderer-side errors must not bubble through preload
    }
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("autoflow", {
  getConfig: () => ipcRenderer.invoke("autoflow:getConfig"),
  listInstalledAgentProfiles: () => ipcRenderer.invoke("autoflow:listInstalledAgentProfiles"),
  selectProject: () => ipcRenderer.invoke("dialog:selectProject"),
  readBoard: (options: unknown) => ipcRenderer.invoke("autoflow:readBoard", options),
  installBoard: (options: unknown) => ipcRenderer.invoke("autoflow:installBoard", options),
  listRunners: (options: unknown) => ipcRenderer.invoke("autoflow:listRunners", options),
  controlRunner: (options: unknown) => ipcRenderer.invoke("autoflow:controlRunner", options),
  closeProjectRunners: (options: unknown) => ipcRenderer.invoke("autoflow:closeProjectRunners", options),
  listRunnerArtifacts: (options: unknown) => ipcRenderer.invoke("autoflow:listRunnerArtifacts", options),
  runRole: (options: unknown) => ipcRenderer.invoke("autoflow:runRole", options),
  configureRunner: (options: unknown) => ipcRenderer.invoke("autoflow:configureRunner", options),
  createRunner: (options: unknown) => ipcRenderer.invoke("autoflow:createRunner", options),
  continueRunnerAuth: (options: unknown) => ipcRenderer.invoke("autoflow:continueRunnerAuth", options),
  controlWiki: (options: unknown) => ipcRenderer.invoke("autoflow:controlWiki", options),
  browseWikiDatabase: (options: unknown) => ipcRenderer.invoke("autoflow:browseWikiDatabase", options),
  writeMetricsSnapshot: (options: unknown) => ipcRenderer.invoke("autoflow:writeMetricsSnapshot", options),
  controlStopHook: (options: unknown) => ipcRenderer.invoke("autoflow:controlStopHook", options),
  controlWatcher: (options: unknown) => ipcRenderer.invoke("autoflow:controlWatcher", options),
  readBoardFile: (options: unknown) => ipcRenderer.invoke("autoflow:readBoardFile", options),
  readStartupRules: (options: unknown) => ipcRenderer.invoke("autoflow:readStartupRules", options),
  writeStartupRules: (options: unknown) => ipcRenderer.invoke("autoflow:writeStartupRules", options),
  tailBoardFile: (options: unknown) => ipcRenderer.invoke("autoflow:tailBoardFile", options),
  deleteOrderFile: (options: unknown) => ipcRenderer.invoke("autoflow:deleteOrderFile", options),
  projectExists: (projectRoot: unknown) => ipcRenderer.invoke("autoflow:projectExists", projectRoot),
  cancelInvocation: (invocationId: unknown) => ipcRenderer.invoke("autoflow:cancelInvocation", invocationId),
  // PRD 10 (2026-05-09): origin ledger bridge.
  //   options = { projectRoot, boardDirName?, sub: 'status'|'list'|'search'|'of-ticket'|'of-commit'|'sync', args?: string[] }
  // Returns: { ok, command, code, stdout, stderr } where stdout is the
  // raw `autoflow origin <sub>` output (sqlite -header -column table).
  origin: (options: unknown) => ipcRenderer.invoke("autoflow:origin", options),
  // Subscribe to fs.watch-driven board change notifications. Returns an
  // unsubscribe function. The handler is called with `{ projectRoot,
  // boardDirName, reason }` after the main process debounces a burst of
  // file events.
  onBoardChange: (handler: unknown) => subscribe("autoflow:boardChange", handler),
  onInstallProgress: (handler: unknown) => subscribe("autoflow:installProgress", handler),
  // ----- PTY runner manager (vibe-terminal pattern) -----
  // Renderer can send scoped stdin bytes only to an existing runner PTY.
  // The bridge intentionally stays narrow: spawn / stop / resize / snapshot /
  // status-bytes subscription / raw stdin write.
  runnerPtyStart: () => ipcRenderer.invoke("autoflow:runnerPtyStart"),
  runnerPtySpawn: (options: unknown) => ipcRenderer.invoke("autoflow:runnerPtySpawn", options),
  runnerPtyStop: (options: unknown) => ipcRenderer.invoke("autoflow:runnerPtyStop", options),
  runnerPtyResize: (options: unknown) => ipcRenderer.invoke("autoflow:runnerPtyResize", options),
  runnerPtySnapshot: (options: unknown) => ipcRenderer.invoke("autoflow:runnerPtySnapshot", options),
  runnerPtyInput: (options: unknown) => ipcRenderer.invoke("autoflow:runnerPtyInput", options),
  runnerPtyList: () => ipcRenderer.invoke("autoflow:runnerPtyList"),
  onRunnerPtyBytes: (handler: unknown) => subscribe("autoflow:runnerPtyBytes", handler),
  onRunnerPtyStatus: (handler: unknown) => subscribe("autoflow:runnerPtyStatus", handler),
  onRunnerTokenUpdate: (handler: unknown) => subscribe("autoflow:runnerTokenUpdate", handler)
});
