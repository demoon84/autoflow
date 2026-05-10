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
  continueRunnerAuth: (options) => ipcRenderer.invoke("autoflow:continueRunnerAuth", options),
  controlWiki: (options) => ipcRenderer.invoke("autoflow:controlWiki", options),
  writeMetricsSnapshot: (options) => ipcRenderer.invoke("autoflow:writeMetricsSnapshot", options),
  controlStopHook: (options) => ipcRenderer.invoke("autoflow:controlStopHook", options),
  controlWatcher: (options) => ipcRenderer.invoke("autoflow:controlWatcher", options),
  readBoardFile: (options) => ipcRenderer.invoke("autoflow:readBoardFile", options),
  tailBoardFile: (options) => ipcRenderer.invoke("autoflow:tailBoardFile", options),
  deleteInboxOrderFile: (options) => ipcRenderer.invoke("autoflow:deleteInboxOrderFile", options),
  projectExists: (projectRoot) => ipcRenderer.invoke("autoflow:projectExists", projectRoot),
  cancelInvocation: (invocationId) => ipcRenderer.invoke("autoflow:cancelInvocation", invocationId),
  // PRD 10 (2026-05-09): origin ledger bridge.
  //   options = { projectRoot, boardDirName?, sub: 'status'|'list'|'search'|'of-ticket'|'of-commit'|'sync', args?: string[] }
  // Returns: { ok, command, code, stdout, stderr } where stdout is the
  // raw `autoflow origin <sub>` output (sqlite -header -column table).
  origin: (options) => ipcRenderer.invoke("autoflow:origin", options),
  // Subscribe to fs.watch-driven board change notifications. Returns an
  // unsubscribe function. The handler is called with `{ projectRoot,
  // boardDirName, reason }` after the main process debounces a burst of
  // file events.
  onBoardChange: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => {
      try {
        handler(payload);
      } catch {
        // ignore — renderer-side errors must not bubble through preload
      }
    };
    ipcRenderer.on("autoflow:boardChange", listener);
    return () => ipcRenderer.removeListener("autoflow:boardChange", listener);
  },
  // ----- PTY runner manager (vibe-terminal pattern) -----
  // Read-only — renderer cannot push stdin (project policy: user input
  // disabled in LiveTerminalView). Renderer only:
  //   1) start / stop the runner
  //   2) subscribe to bytes / status events
  //   3) request the replay buffer when re-mounting xterm
  runnerPtyStart: (options) => ipcRenderer.invoke("autoflow:runnerPtyStart", options),
  runnerPtySpawn: (options) => ipcRenderer.invoke("autoflow:runnerPtySpawn", options),
  runnerPtyStop: (options) => ipcRenderer.invoke("autoflow:runnerPtyStop", options),
  runnerPtySnapshot: (options) => ipcRenderer.invoke("autoflow:runnerPtySnapshot", options),
  runnerPtyList: () => ipcRenderer.invoke("autoflow:runnerPtyList"),
  onRunnerPtyBytes: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => {
      try { handler(payload); } catch {}
    };
    ipcRenderer.on("autoflow:runnerPtyBytes", listener);
    return () => ipcRenderer.removeListener("autoflow:runnerPtyBytes", listener);
  },
  onRunnerPtyStatus: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => {
      try { handler(payload); } catch {}
    };
    ipcRenderer.on("autoflow:runnerPtyStatus", listener);
    return () => ipcRenderer.removeListener("autoflow:runnerPtyStatus", listener);
  }
});
