const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const repoRoot = process.env.AUTOFLOW_REPO_ROOT || path.resolve(__dirname, "../../..");
const defaultBoardDirName = ".autoflow";

const allowedCommands = new Set([
  "init",
  "status",
  "doctor",
  "metrics",
  "install-stop-hook",
  "remove-stop-hook",
  "stop-hook-status",
  "watch-bg",
  "watch-status",
  "watch-stop"
]);
const allowedRunnerActions = new Set(["start", "stop", "restart", "remove"]);
const allowedStopHookActions = new Set(["install", "remove", "status"]);
const allowedWatcherActions = new Set(["start", "stop", "status"]);
const allowedWikiActions = new Set(["update", "lint"]);
const allowedRunRoles = new Set([
  "ticket",
  "ticket-owner",
  "owner",
  "planner",
  "plan",
  "todo",
  "verifier",
  "veri",
  "wiki",
  "wiki-maintainer"
]);
const allowedRunnerRoles = new Set(["ticket-owner", "owner", "planner", "todo", "verifier", "wiki-maintainer", "watcher"]);
const allowedRunnerConfigKeys = new Set([
  "agent",
  "model",
  "reasoning",
  "mode",
  "interval_seconds",
  "enabled",
  "command"
]);
const safeIdPattern = /^[A-Za-z0-9_.-]+$/;
const boardFileReadLimitBytes = 196 * 1024;
const allowedBoardFileExtensions = new Set([".md", ".log", ".jsonl"]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: "코덱스 작업 흐름",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }
}

function cliInvocation(args) {
  const normalizedArgs = args.map((arg) => String(arg));

  if (process.platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(repoRoot, "bin", "autoflow.ps1"),
        ...normalizedArgs
      ]
    };
  }

  return {
    command: path.join(repoRoot, "bin", "autoflow"),
    args: normalizedArgs
  };
}

function commandLabel(args) {
  return args.join(" ");
}

function scopedArgs(command, options = {}) {
  if (!allowedCommands.has(command)) {
    throw new Error(`Unsupported Autoflow command: ${command}`);
  }

  const projectRoot = options.projectRoot || "";
  const boardDirName = options.boardDirName || defaultBoardDirName;
  const args = [command];
  if (projectRoot) {
    args.push(projectRoot, boardDirName);
  }

  return args;
}

function runAutoflowArgs(args, options = {}) {
  const invocation = cliInvocation(args);
  const label = commandLabel(args);

  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...(options.env || {})
      },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    if (options.input !== undefined) {
      child.stdin.end(String(options.input));
    } else {
      child.stdin.end();
    }

    child.on("error", (error) => {
      resolve({
        ok: false,
        command: label,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        command: label,
        code,
        stdout,
        stderr
      });
    });
  });
}

function runAutoflow(command, options = {}) {
  return runAutoflowArgs(scopedArgs(command, options), options);
}

function parseKeyValueOutput(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }

    values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

function parseRunnerListOutput(output) {
  const values = parseKeyValueOutput(output);
  const count = Number.parseInt(values.runner_count || "0", 10);
  const runners = [];

  for (let index = 1; index <= count; index += 1) {
    const prefix = `runner.${index}.`;
    runners.push({
      id: values[`${prefix}id`] || "",
      role: values[`${prefix}role`] || "",
      agent: values[`${prefix}agent`] || "",
      model: values[`${prefix}model`] || "",
      reasoning: values[`${prefix}reasoning`] || "",
      mode: values[`${prefix}mode`] || "",
      intervalSeconds: values[`${prefix}interval_seconds`] || "",
      intervalEffectiveSeconds: values[`${prefix}interval_effective_seconds`] || "",
      enabled: values[`${prefix}enabled`] || "",
      command: values[`${prefix}command`] || "",
      commandPreview: values[`${prefix}command_preview`] || "",
      stateStatus: values[`${prefix}state_status`] || "idle",
      activeItem: values[`${prefix}active_item`] || "",
      pid: values[`${prefix}pid`] || "",
      startedAt: values[`${prefix}started_at`] || "",
      lastEventAt: values[`${prefix}last_event_at`] || "",
      lastResult: values[`${prefix}last_result`] || "",
      lastRuntimeLog: values[`${prefix}last_runtime_log`] || "",
      lastPromptLog: values[`${prefix}last_prompt_log`] || "",
      lastStdoutLog: values[`${prefix}last_stdout_log`] || "",
      lastStderrLog: values[`${prefix}last_stderr_log`] || "",
      artifactStatus: values[`${prefix}artifact_status`] || "",
      artifactRuntimeStatus: values[`${prefix}artifact_runtime_status`] || "",
      artifactPromptStatus: values[`${prefix}artifact_prompt_status`] || "",
      artifactStdoutStatus: values[`${prefix}artifact_stdout_status`] || "",
      artifactStderrStatus: values[`${prefix}artifact_stderr_status`] || "",
      lastLogLine: values[`${prefix}last_log_line`] || "",
      statePath: values[`${prefix}state_path`] || "",
      logPath: values[`${prefix}log_path`] || ""
    });
  }

  return {
    values,
    runners
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function usefulPreviewValue(value) {
  const normalized = value.trim();
  if (!normalized || normalized === "..." || normalized === "-") {
    return "";
  }

  const placeholders = new Set([
    "Replace with your project name",
    "Describe the shipped outcome in observable terms",
    "Initial project bootstrap",
    "Project Spec",
    "Feature Spec",
    "Project Spec Template",
    "Feature Spec Template",
    "Ticket Template",
    "Plan Template"
  ]);

  return placeholders.has(normalized) ? "" : normalized.slice(0, 160);
}

function markdownPreviewTitle(content, fallback) {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const fieldMatch = line
      .trim()
      .match(/^-?\s*(?:\[[ xX]\]\s*)?(?:Title|Name|Goal|Summary):\s*(.+)$/i);
    if (!fieldMatch) {
      continue;
    }

    const value = usefulPreviewValue(fieldMatch[1].replace(/^`|`$/g, ""));
    if (value) {
      return value;
    }
  }

  for (const line of lines) {
    const value = usefulPreviewValue(line.trim().replace(/^#+\s*/, ""));
    if (value) {
      return value;
    }
  }

  return fallback;
}

async function readMarkdownPreview(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const name = path.basename(filePath);
    return {
      filePath,
      name,
      title: markdownPreviewTitle(content, name),
      modifiedAt: (await fs.stat(filePath)).mtime.toISOString()
    };
  } catch {
    return {
      filePath,
      name: path.basename(filePath),
      title: path.basename(filePath),
      modifiedAt: ""
    };
  }
}

async function readTextPreview(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) || path.basename(filePath);
    return {
      filePath,
      name: path.basename(filePath),
      title: firstLine.slice(0, 160),
      modifiedAt: (await fs.stat(filePath)).mtime.toISOString()
    };
  } catch {
    return {
      filePath,
      name: path.basename(filePath),
      title: path.basename(filePath),
      modifiedAt: ""
    };
  }
}

async function listMarkdownFiles(directory, recursive = false) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...(await listMarkdownFiles(absolute, true)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(await readMarkdownPreview(absolute));
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function listTextFiles(directory, extensions, recursive = false) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const extensionSet = new Set(extensions);
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...(await listTextFiles(absolute, extensions, true)));
    } else if (entry.isFile() && extensionSet.has(path.extname(entry.name))) {
      files.push(await readTextPreview(absolute));
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function readBoardFile(options = {}) {
  if (!options.projectRoot) {
    return {
      ok: false,
      filePath: "",
      name: "",
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: "Project root is required."
    };
  }

  const filePath = options.filePath || "";
  if (!filePath) {
    return {
      ok: false,
      filePath: "",
      name: "",
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: "File path is required."
    };
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  const boardRoot = path.resolve(options.projectRoot, boardDirName);
  const targetPath = path.resolve(filePath);
  const relativePath = path.relative(boardRoot, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      filePath: targetPath,
      name: path.basename(targetPath),
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: "File must be inside the Autoflow board."
    };
  }

  if (!allowedBoardFileExtensions.has(path.extname(targetPath))) {
    return {
      ok: false,
      filePath: targetPath,
      name: path.basename(targetPath),
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: "Only markdown, log, and metrics JSONL files can be previewed."
    };
  }

  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) {
      return {
        ok: false,
        filePath: targetPath,
        name: path.basename(targetPath),
        content: "",
        truncated: false,
        modifiedAt: stat.mtime.toISOString(),
        size: stat.size,
        stderr: "Path is not a file."
      };
    }

    const bytesToRead = Math.min(stat.size, boardFileReadLimitBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const handle = await fs.open(targetPath, "r");

    try {
      const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
      return {
        ok: true,
        filePath: targetPath,
        name: path.basename(targetPath),
        content: buffer.subarray(0, bytesRead).toString("utf8"),
        truncated: stat.size > bytesRead,
        modifiedAt: stat.mtime.toISOString(),
        size: stat.size,
        stderr: ""
      };
    } finally {
      await handle.close();
    }
  } catch (error) {
    return {
      ok: false,
      filePath: targetPath,
      name: path.basename(targetPath),
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: error.message
    };
  }
}

async function readBoard({ projectRoot, boardDirName }) {
  const normalizedBoardDirName = boardDirName || defaultBoardDirName;
  const boardRoot = path.join(projectRoot || "", normalizedBoardDirName);
  const ticketsRoot = path.join(boardRoot, "tickets");
  const exists = await pathExists(boardRoot);

  const statusResult = exists
    ? await runAutoflow("status", { projectRoot, boardDirName: normalizedBoardDirName })
    : null;
  const runnersResult = exists
    ? await listRunners({ projectRoot, boardDirName: normalizedBoardDirName })
    : null;
  const doctorResult = exists
    ? await runAutoflow("doctor", { projectRoot, boardDirName: normalizedBoardDirName })
    : null;
  const metricsResult = exists
    ? await runAutoflow("metrics", { projectRoot, boardDirName: normalizedBoardDirName })
    : null;
  const stopHookResult = exists
    ? await runAutoflow("stop-hook-status", { projectRoot, boardDirName: normalizedBoardDirName })
    : null;
  const watcherResult = exists
    ? await runAutoflow("watch-status", { projectRoot, boardDirName: normalizedBoardDirName })
    : null;

  const ticketGroups = {
    backlog: await listMarkdownFiles(path.join(ticketsRoot, "backlog")),
    plan: await listMarkdownFiles(path.join(ticketsRoot, "plan")),
    todo: await listMarkdownFiles(path.join(ticketsRoot, "todo")),
    inprogress: await listMarkdownFiles(path.join(ticketsRoot, "inprogress")),
    verifier: await listMarkdownFiles(path.join(ticketsRoot, "verifier")),
    done: await listMarkdownFiles(path.join(ticketsRoot, "done"), true),
    reject: await listMarkdownFiles(path.join(ticketsRoot, "reject"))
  };

  const logs = await listMarkdownFiles(path.join(boardRoot, "logs"), true);
  const runnerLogs = await listTextFiles(path.join(boardRoot, "runners", "logs"), [".log"], true);
  const wikiFiles = await listMarkdownFiles(path.join(boardRoot, "wiki"), true);
  const metricsFiles = await listTextFiles(path.join(boardRoot, "metrics"), [".jsonl", ".json"], true);
  const conversationFiles = await listMarkdownFiles(path.join(boardRoot, "conversations"), true);

  return {
    repoRoot,
    boardRoot,
    exists,
    status: statusResult ? parseKeyValueOutput(statusResult.stdout) : {},
    statusResult,
    doctor: doctorResult ? parseKeyValueOutput(doctorResult.stdout) : {},
    doctorResult,
    metrics: metricsResult ? parseKeyValueOutput(metricsResult.stdout) : {},
    metricsResult,
    stopHook: stopHookResult ? parseKeyValueOutput(stopHookResult.stdout) : {},
    stopHookResult,
    watcher: watcherResult ? parseKeyValueOutput(watcherResult.stdout) : {},
    watcherResult,
    runners: runnersResult?.runners || [],
    runnersResult,
    tickets: ticketGroups,
    logs: logs
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 12),
    runnerLogs: runnerLogs
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 16),
    wikiFiles: wikiFiles
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 24),
    metricsFiles: metricsFiles
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 8),
    conversationFiles: conversationFiles
      .filter((file) => file.name.toLowerCase() !== "readme.md")
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 24)
  };
}

async function listRunners(options = {}) {
  if (!options.projectRoot) {
    return {
      ok: false,
      command: "runners list",
      code: -1,
      stdout: "",
      stderr: "Project root is required.",
      runners: []
    };
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  const args = ["runners", "list", options.projectRoot, boardDirName];
  const result = await runAutoflowArgs(args, options);
  const parsed = parseRunnerListOutput(result.stdout);

  return {
    ...result,
    values: parsed.values,
    runners: parsed.runners
  };
}

async function controlRunner(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "runners",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const action = options.action || "";
  if (!allowedRunnerActions.has(action)) {
    return Promise.resolve({
      ok: false,
      command: `runners ${action}`,
      code: -1,
      stdout: "",
      stderr: `Unsupported runner action: ${action}`
    });
  }

  const runnerId = options.runnerId || "";
  if (!safeIdPattern.test(runnerId)) {
    return Promise.resolve({
      ok: false,
      command: `runners ${action}`,
      code: -1,
      stdout: "",
      stderr: "Runner id is required."
    });
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  return runAutoflowArgs(["runners", action, runnerId, options.projectRoot, boardDirName], options);
}

function listRunnerArtifacts(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "runners artifacts",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const runnerId = options.runnerId || "";
  if (!safeIdPattern.test(runnerId)) {
    return Promise.resolve({
      ok: false,
      command: "runners artifacts",
      code: -1,
      stdout: "",
      stderr: "Runner id is required."
    });
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  return runAutoflowArgs(["runners", "artifacts", runnerId, options.projectRoot, boardDirName], options);
}

function createRunner(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "runners add",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const runnerId = options.runnerId || "";
  if (!safeIdPattern.test(runnerId)) {
    return Promise.resolve({
      ok: false,
      command: "runners add",
      code: -1,
      stdout: "",
      stderr: "Runner id is required."
    });
  }

  const role = options.role || "";
  if (!allowedRunnerRoles.has(role)) {
    return Promise.resolve({
      ok: false,
      command: "runners add",
      code: -1,
      stdout: "",
      stderr: `Unsupported runner role: ${role}`
    });
  }

  const updates = [];
  const config = options.config || {};
  for (const [key, value] of Object.entries(config)) {
    if (!allowedRunnerConfigKeys.has(key)) {
      return Promise.resolve({
        ok: false,
        command: "runners add",
        code: -1,
        stdout: "",
        stderr: `Unsupported runner config key: ${key}`
      });
    }

    const stringValue = String(value ?? "");
    if (/[\r\n\t]/.test(stringValue)) {
      return Promise.resolve({
        ok: false,
        command: "runners add",
        code: -1,
        stdout: "",
        stderr: `Invalid runner config value: ${key}`
      });
    }

    updates.push(`${key}=${stringValue}`);
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  return runAutoflowArgs(["runners", "add", runnerId, role, options.projectRoot, boardDirName, ...updates], options);
}

function runRole(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "run",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const role = options.role || "";
  if (!allowedRunRoles.has(role)) {
    return Promise.resolve({
      ok: false,
      command: `run ${role}`,
      code: -1,
      stdout: "",
      stderr: `Unsupported run role: ${role}`
    });
  }

  const runnerId = options.runnerId || "";
  if (!safeIdPattern.test(runnerId)) {
    return Promise.resolve({
      ok: false,
      command: `run ${role}`,
      code: -1,
      stdout: "",
      stderr: "Runner id is required."
    });
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  const args = ["run", role, options.projectRoot, boardDirName, "--runner", runnerId];
  if (options.dryRun === true) {
    args.push("--dry-run");
  }

  return runAutoflowArgs(args, options);
}

function configureRunner(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "runners set",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const runnerId = options.runnerId || "";
  if (!safeIdPattern.test(runnerId)) {
    return Promise.resolve({
      ok: false,
      command: "runners set",
      code: -1,
      stdout: "",
      stderr: "Runner id is required."
    });
  }

  const updates = [];
  const config = options.config || {};
  for (const [key, value] of Object.entries(config)) {
    if (!allowedRunnerConfigKeys.has(key)) {
      return Promise.resolve({
        ok: false,
        command: "runners set",
        code: -1,
        stdout: "",
        stderr: `Unsupported runner config key: ${key}`
      });
    }

    const stringValue = String(value ?? "");
    if (/[\r\n\t]/.test(stringValue)) {
      return Promise.resolve({
        ok: false,
        command: "runners set",
        code: -1,
        stdout: "",
        stderr: `Invalid runner config value: ${key}`
      });
    }

    updates.push(`${key}=${stringValue}`);
  }

  if (updates.length === 0) {
    return Promise.resolve({
      ok: false,
      command: "runners set",
      code: -1,
      stdout: "",
      stderr: "Runner config updates are required."
    });
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  return runAutoflowArgs(["runners", "set", runnerId, options.projectRoot, boardDirName, ...updates], options);
}

function installBoard(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "init",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  return runAutoflow("init", options);
}

function controlWiki(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "wiki",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const action = options.action || "";
  if (!allowedWikiActions.has(action)) {
    return Promise.resolve({
      ok: false,
      command: `wiki ${action}`,
      code: -1,
      stdout: "",
      stderr: `Unsupported wiki action: ${action}`
    });
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  const args = ["wiki", action, options.projectRoot, boardDirName];
  if (action === "update" && options.dryRun === true) {
    args.push("--dry-run");
  }

  return runAutoflowArgs(args, options);
}

function writeMetricsSnapshot(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "metrics",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  return runAutoflowArgs(["metrics", options.projectRoot, boardDirName, "--write"], options);
}

function controlStopHook(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "stop-hook",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const action = options.action || "";
  if (!allowedStopHookActions.has(action)) {
    return Promise.resolve({
      ok: false,
      command: `stop-hook ${action}`,
      code: -1,
      stdout: "",
      stderr: `Unsupported stop-hook action: ${action}`
    });
  }

  const commandByAction = {
    install: "install-stop-hook",
    remove: "remove-stop-hook",
    status: "stop-hook-status"
  };

  return runAutoflow(commandByAction[action], options);
}

function controlWatcher(options = {}) {
  if (!options.projectRoot) {
    return Promise.resolve({
      ok: false,
      command: "watcher",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    });
  }

  const action = options.action || "";
  if (!allowedWatcherActions.has(action)) {
    return Promise.resolve({
      ok: false,
      command: `watcher ${action}`,
      code: -1,
      stdout: "",
      stderr: `Unsupported watcher action: ${action}`
    });
  }

  const commandByAction = {
    start: "watch-bg",
    stop: "watch-stop",
    status: "watch-status"
  };

  return runAutoflow(commandByAction[action], options);
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:selectProject", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return "";
    }

    return result.filePaths[0];
  });

  ipcMain.handle("autoflow:readBoard", (_event, options) => readBoard(options || {}));
  ipcMain.handle("autoflow:installBoard", (_event, options) => installBoard(options || {}));
  ipcMain.handle("autoflow:listRunners", (_event, options) => listRunners(options || {}));
  ipcMain.handle("autoflow:controlRunner", (_event, options) => controlRunner(options || {}));
  ipcMain.handle("autoflow:listRunnerArtifacts", (_event, options) => listRunnerArtifacts(options || {}));
  ipcMain.handle("autoflow:runRole", (_event, options) => runRole(options || {}));
  ipcMain.handle("autoflow:configureRunner", (_event, options) => configureRunner(options || {}));
  ipcMain.handle("autoflow:createRunner", (_event, options) => createRunner(options || {}));
  ipcMain.handle("autoflow:controlWiki", (_event, options) => controlWiki(options || {}));
  ipcMain.handle("autoflow:writeMetricsSnapshot", (_event, options) => writeMetricsSnapshot(options || {}));
  ipcMain.handle("autoflow:controlStopHook", (_event, options) => controlStopHook(options || {}));
  ipcMain.handle("autoflow:controlWatcher", (_event, options) => controlWatcher(options || {}));
  ipcMain.handle("autoflow:readBoardFile", (_event, options) => readBoardFile(options || {}));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
