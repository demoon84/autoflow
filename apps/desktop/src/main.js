const { app, BrowserWindow, dialog, ipcMain, nativeImage, screen, shell } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = process.env.AUTOFLOW_REPO_ROOT || path.resolve(__dirname, "../../..");
const scaffoldManifestPath = path.join(repoRoot, "scaffold", "manifest.toml");
const desktopRoot = path.resolve(__dirname, "..");
const appIconPath = path.join(desktopRoot, "src", "renderer", "assets", "app", "app-icon.png");
const windowStateFileName = "window-state.json";
const desktopSessionStateFileName = "desktop-session-state.json";
const desktopClosePolicyFileName = "desktop-close-policy.json";
const desktopClosePolicies = new Set(["detach", "stop"]);
const defaultDesktopClosePolicy = "detach";

if (process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA) {
  app.setPath("userData", process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA);
  app.setPath("sessionData", path.join(process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA, "session"));
}

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
const allowedWikiActions = new Set(["update", "lint", "query"]);
// Roles accepted by `autoflow run <role>` per packages/cli/run-role.sh
// case statement. 3-runner active: ticket / planner / wiki (with their
// owner/ticket-owner, plan, wiki-maintainer aliases). Legacy: todo,
// verifier (+ veri alias), coordinator (+ coord/doctor/diagnose aliases),
// merge / merge-bot. Trial: self-improve (+ self_improve/selfimprove).
const allowedRunRoles = new Set([
  "ticket", "ticket-owner", "owner",
  "planner", "plan",
  "wiki", "wiki-maintainer",
  "todo",
  "verifier", "veri",
  "coordinator", "coord", "doctor", "diagnose",
  "merge", "merge-bot",
  "self-improve", "self_improve", "selfimprove"
]);
// 3-runner active: ticket-owner / planner / wiki-maintainer (with legacy
// aliases owner / plan / wiki). Legacy/back-compat: todo, verifier,
// coordinator (+ aliases coord/doctor/diagnose), merge / merge-bot,
// watcher. Trial (disabled by default): self-improve.
// Mirrors `runner_allowed_role` in packages/cli/runners-project.sh.
const allowedRunnerRoles = new Set([
  "ticket-owner", "owner", "ticket",
  "planner", "plan",
  "wiki-maintainer", "wiki",
  "todo",
  "verifier",
  "coordinator", "coord", "doctor", "diagnose",
  "merge", "merge-bot",
  "watcher",
  "self-improve", "self_improve", "selfimprove"
]);
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
// Board directory name must be a single safe path component — no separators,
// no `..`. Defense-in-depth: the renderer is in-process so this is not a
// security boundary, but keeps a malformed message from reaching the CLI.
const safeBoardDirNamePattern = /^(?!\.\.?$)[A-Za-z0-9._-]+$/;
const boardFileReadLimitBytes = 196 * 1024;
const metricsHistoryReadLimitBytes = 512 * 1024;
const runnerTerminalPreviewLimitBytes = 32 * 1024;
const allowedBoardFileExtensions = new Set([".md", ".log", ".jsonl", ".json"]);
const runnerAuthNeededPatterns = [
  /\bnot logged in\b/i,
  /\bplease run\s+\/login\b/i,
  /\blogin required\b/i,
  /\bauthentication required\b/i,
  /\bnot authenticated\b/i,
  /\bunauthenticated\b/i,
  /\bplease authenticate\b/i,
  /\bplease set an auth method\b/i,
  /\bmanual authorization is required\b/i,
  /\binvalid auth method selected\b/i,
  /\badapter_auth_required\b/i,
  /Opening authentication page in your browser/i,
  /Attempting to open authentication page in your browser/i,
  /\bmust specify the GEMINI_API_KEY\b/i,
  /\bGEMINI_API_KEY\b.*\b(GOOGLE_GENAI_USE_VERTEXAI|GOOGLE_GENAI_USE_GCA)\b/i,
  /\bsign in required\b/i,
  /로그인(?:이)? 필요/i
];
const authUrlPattern = /https?:\/\/[^\s<>"'`)\]]+/gi;
const agentDisplayLabels = {
  codex: "Codex",
  claude: "Claude",
  opencode: "OpenCode",
  gemini: "Gemini"
};
const metricSnapshotKeys = [
  "spec_total",
  "ticket_total",
  "ticket_done_count",
  "active_ticket_count",
  "reject_count",
  "verifier_pass_count",
  "verifier_fail_count",
  "handoff_count",
  "runner_total_count",
  "runner_running_count",
  "runner_idle_count",
  "runner_stopped_count",
  "runner_blocked_count",
  "runner_enabled_count",
  "runner_disabled_count",
  "runner_invalid_config_count",
  "runner_artifact_ok_count",
  "runner_artifact_warning_count",
  "runner_artifact_not_applicable_count",
  "autoflow_commit_count",
  "autoflow_code_files_changed_count",
  "autoflow_code_insertions_count",
  "autoflow_code_deletions_count",
  "autoflow_code_volume_count",
  "autoflow_token_usage_count",
  "autoflow_token_report_count",
  "verification_pass_rate_percent",
  "completion_rate_percent"
];

function stripTomlComment(line) {
  let quote = "";
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseTomlStringValue(rawValue) {
  const value = rawValue.trim();
  const quotedMatch = value.match(/^"((?:\\"|[^"])*)"|^'([^']*)'/);
  if (quotedMatch) {
    return (quotedMatch[1] || quotedMatch[2] || "").replace(/\\"/g, "\"");
  }

  return value.split(/\s+/)[0] || "";
}

function supportedCodexProfile(model, reasoning) {
  return {
    model,
    reasoning
  };
}

function scaffoldManifestValue(section, name, fallback) {
  try {
    const content = fsSync.readFileSync(scaffoldManifestPath, "utf8");
    let currentSection = "";

    for (const rawLine of content.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) {
        continue;
      }

      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        continue;
      }

      if (currentSection !== section) {
        continue;
      }

      const valueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (valueMatch && valueMatch[1] === name) {
        const parsed = parseTomlStringValue(valueMatch[2]);
        return parsed || fallback;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

const defaultBoardDirName = scaffoldManifestValue("install", "default_board_dir", ".autoflow");
const macOsDesktopSpaceKeyCodes = new Map([
  [1, 18],
  [2, 19],
  [3, 20],
  [4, 21],
  [5, 23],
  [6, 22],
  [7, 26],
  [8, 28],
  [9, 25]
]);
const defaultMacOsDesktopSpaceNumber = (() => {
  const parsed = Number.parseInt(process.env.AUTOFLOW_DESKTOP_SPACE_NUMBER || "6", 10);
  return macOsDesktopSpaceKeyCodes.has(parsed) ? parsed : 6;
})();
const readBoardDiagnosticCacheTtlMs = 60 * 1000;
const readBoardDiagnosticTimeoutMs = 15 * 1000;
const readBoardDiagnosticCache = new Map();
const readBoardRunnerListCacheTtlMs = 15 * 1000;
const standaloneRunnerListCacheTtlMs = 2 * 1000;
const selfHealStoppedRunnersCooldownMs = 15 * 1000;
const autoflowChildKillGraceMs = 1500;
const readBoardRunnerListCache = new Map();
const knownProjectScopes = new Map();
const lastSelfHealByScope = new Map();
const selfHealInFlightScopes = new Set();
const activeChildProcesses = new Set();
// invocationId → child process. Lets the renderer cancel a long-running
// CLI call (runRole / controlWiki --synth / installBoard / etc.) by id.
const cancellableInvocations = new Map();
const agentAuthStatusCache = new Map();
const runnerAuthProcesses = new Map();
let runnerShutdownInProgress = false;
let appQuitInProgress = false;
let desktopSessionEvidence = {
  uncleanExit: false,
  detachedRunnerReattachEvidence: "",
  previousStartedAt: "",
  previousUpdatedAt: ""
};
const DEFAULT_MEMORY_CEILING_MB = 1500;
const DEFAULT_MEMORY_CHECK_INTERVAL_SECONDS = 30;
const DEFAULT_MEMORY_RESTART_COOLDOWN_SECONDS = 300;
const BYTES_PER_MEGABYTE = 1024 * 1024;
let memoryCeilingIntervalId = null;
let lastMemoryCeilingRestartAt = 0;
let memoryCeilingRestartInProgress = false;

function parsePositiveIntegerOrDefault(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readMemoryCeilingConfig() {
  const ceilingMb = parsePositiveIntegerOrDefault(process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_MB, DEFAULT_MEMORY_CEILING_MB);
  const checkIntervalSeconds = parsePositiveIntegerOrDefault(
    process.env.AUTOFLOW_DESKTOP_MEMORY_CHECK_INTERVAL_SECONDS,
    DEFAULT_MEMORY_CHECK_INTERVAL_SECONDS
  );
  const restartCooldownSeconds = parsePositiveIntegerOrDefault(
    process.env.AUTOFLOW_DESKTOP_MEMORY_RESTART_COOLDOWN_SECONDS,
    DEFAULT_MEMORY_RESTART_COOLDOWN_SECONDS
  );

  return {
    ceilingMb,
    checkIntervalSeconds,
    restartCooldownSeconds,
    disabled: process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_DISABLED === "1"
  };
}

function bytesToMegabytes(value) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value / BYTES_PER_MEGABYTE;
}

function logMemoryCeilingRestart(rssMb, heapUsedMb, ceilingMb) {
  console.warn(
    `[autoflow][memory-ceiling] reason=threshold_exceeded rss_mb=${rssMb.toFixed(2)} heapUsed_mb=${heapUsedMb.toFixed(2)} ceiling_mb=${ceilingMb}`
  );
}

async function performMemoryCeilingRestart() {
  if (memoryCeilingRestartInProgress || runnerShutdownInProgress) {
    return;
  }
  memoryCeilingRestartInProgress = true;
  runnerShutdownInProgress = true;

  try {
    const shutdownTimeoutMs = 5000;
    const cleanup = shutdownAllRunners({ allowWhileInProgress: true }).catch(() => 0);
    const timeout = new Promise((resolve) => setTimeout(resolve, shutdownTimeoutMs));
    await Promise.race([cleanup, timeout]);
    try {
      await forceKillSurvivingRunners();
    } catch {}
    markDesktopSessionClean("memory_ceiling_relaunch");
  } finally {
    try {
      app.relaunch();
    } catch {}
    app.exit(0);
  }
}

function startMemoryCeilingMonitor() {
  if (memoryCeilingIntervalId) {
    return;
  }

  const config = readMemoryCeilingConfig();
  if (config.disabled) {
    return;
  }

  const intervalMs = config.checkIntervalSeconds * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return;
  }

  const monitor = async () => {
    if (memoryCeilingRestartInProgress) {
      return;
    }

    const now = Date.now();
    const elapsedSinceLastRestart = now - lastMemoryCeilingRestartAt;
    if (
      lastMemoryCeilingRestartAt > 0 &&
      elapsedSinceLastRestart < config.restartCooldownSeconds * 1000
    ) {
      return;
    }

    const usage = process.memoryUsage();
    const rssMb = bytesToMegabytes(usage.rss);
    const heapUsedMb = bytesToMegabytes(usage.heapUsed);
    if (rssMb >= config.ceilingMb || heapUsedMb >= config.ceilingMb) {
      logMemoryCeilingRestart(rssMb, heapUsedMb, config.ceilingMb);
      lastMemoryCeilingRestartAt = now;
      await performMemoryCeilingRestart();
    }
  };

  memoryCeilingIntervalId = setInterval(() => {
    void monitor();
  }, intervalMs);
  memoryCeilingIntervalId.unref?.();
}

function registerCancellableInvocation(invocationId, child) {
  if (typeof invocationId !== "string" || !invocationId) return;
  cancellableInvocations.set(invocationId, child);
}

function clearCancellableInvocation(invocationId) {
  if (typeof invocationId !== "string" || !invocationId) return;
  cancellableInvocations.delete(invocationId);
}

function cancelInvocation(invocationId) {
  if (typeof invocationId !== "string" || !invocationId) {
    return { ok: false, cancelled: false, reason: "invalid_id" };
  }
  const child = cancellableInvocations.get(invocationId);
  if (!child) {
    return { ok: true, cancelled: false, reason: "not_found" };
  }
  try {
    terminateAutoflowChild(child, "cancelled by renderer");
  } catch (error) {
    return { ok: false, cancelled: false, reason: error.message || "kill_failed" };
  }
  cancellableInvocations.delete(invocationId);
  return { ok: true, cancelled: true };
}

function appConfig() {
  return {
    defaultProjectRoot: repoRoot,
    defaultBoardDirName,
    desktopClosePolicy: readDesktopClosePolicy(),
    desktopSession: desktopSessionEvidence
  };
}

function desktopSessionStatePath() {
  return path.join(app.getPath("userData"), desktopSessionStateFileName);
}

function desktopClosePolicyPath() {
  return path.join(app.getPath("userData"), desktopClosePolicyFileName);
}

function readJsonFileSync(filePath) {
  try {
    return JSON.parse(fsSync.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonFileSync(filePath, value) {
  try {
    fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
    fsSync.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch {}
}

function normalizeDesktopClosePolicy(value) {
  return desktopClosePolicies.has(value) ? value : defaultDesktopClosePolicy;
}

function readDesktopClosePolicy() {
  const parsed = readJsonFileSync(desktopClosePolicyPath());
  return normalizeDesktopClosePolicy(parsed?.policy);
}

function writeDesktopClosePolicy(policy) {
  const normalized = normalizeDesktopClosePolicy(policy);
  writeJsonFileSync(desktopClosePolicyPath(), {
    policy: normalized,
    updatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z")
  });
  return normalized;
}

function markDesktopSessionStarted() {
  const previous = readJsonFileSync(desktopSessionStatePath());
  const hadPreviousSession = Boolean(previous?.startedAt || previous?.updatedAt);
  const uncleanExit = hadPreviousSession && previous?.cleanShutdown !== true;
  desktopSessionEvidence = {
    uncleanExit,
    detachedRunnerReattachEvidence: uncleanExit
      ? "previous desktop session lacked a clean shutdown marker; detached runner state is reattached without stop/restart/delete"
      : "",
    previousStartedAt: previous?.startedAt || "",
    previousUpdatedAt: previous?.updatedAt || ""
  };
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  writeJsonFileSync(desktopSessionStatePath(), {
    cleanShutdown: false,
    startedAt: timestamp,
    updatedAt: timestamp
  });
}

function markDesktopSessionClean(reason) {
  const previous = readJsonFileSync(desktopSessionStatePath()) || {};
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  writeJsonFileSync(desktopSessionStatePath(), {
    ...previous,
    cleanShutdown: true,
    cleanShutdownReason: reason || "quit",
    updatedAt: timestamp
  });
}

function desktopClosePolicyResult(policy) {
  return {
    ok: true,
    policy: normalizeDesktopClosePolicy(policy),
    policies: Array.from(desktopClosePolicies)
  };
}

function projectScopeKey(projectRoot, boardDirName) {
  return `${projectRoot}\0${boardDirName}`;
}

function rememberProjectScope(options) {
  if (!options || typeof options.projectRoot !== "string" || !options.projectRoot) {
    return;
  }
  const boardDirName = options.boardDirName || defaultBoardDirName;
  const key = projectScopeKey(options.projectRoot, boardDirName);
  const scope = { projectRoot: options.projectRoot, boardDirName };
  const isNewScope = !knownProjectScopes.has(key);
  if (isNewScope) {
    knownProjectScopes.set(key, scope);
  }
  const now = Date.now();
  const lastSelfHealAt = lastSelfHealByScope.get(key) || 0;
  const selfHealCooldownElapsed = now - lastSelfHealAt >= selfHealStoppedRunnersCooldownMs;
  if (
    !runnerShutdownInProgress &&
    !selfHealInFlightScopes.has(key) &&
    (isNewScope || selfHealCooldownElapsed)
  ) {
    lastSelfHealByScope.set(key, now);
    selfHealInFlightScopes.add(key);
    void selfHealStoppedRunnersForScope(scope).finally(() => {
      selfHealInFlightScopes.delete(key);
    });
  }
}

function windowStatePath() {
  return path.join(app.getPath("userData"), windowStateFileName);
}

function normalizeWindowBounds(value) {
  if (!value || typeof value !== "object") return null;
  const bounds = {
    x: Number.parseInt(value.x, 10),
    y: Number.parseInt(value.y, 10),
    width: Number.parseInt(value.width, 10),
    height: Number.parseInt(value.height, 10)
  };
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width < 1200 ||
    bounds.height < 720
  ) {
    return null;
  }
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    delete bounds.x;
    delete bounds.y;
  }
  return bounds;
}

function readWindowState() {
  try {
    const parsed = JSON.parse(fsSync.readFileSync(windowStatePath(), "utf8"));
    const bounds = normalizeWindowBounds(parsed.bounds);
    const desktopSpaceNumber = Number.parseInt(parsed.desktopSpaceNumber, 10);
    if (!bounds) {
      return {
        desktopSpaceNumber: macOsDesktopSpaceKeyCodes.has(desktopSpaceNumber)
          ? desktopSpaceNumber
          : defaultMacOsDesktopSpaceNumber
      };
    }

    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    const visible =
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      bounds.x + Math.min(bounds.width, 120) >= area.x &&
      bounds.y + Math.min(bounds.height, 80) >= area.y &&
      bounds.x <= area.x + area.width - 80 &&
      bounds.y <= area.y + area.height - 60;

    return {
      bounds: visible ? bounds : { width: bounds.width, height: bounds.height },
      maximized: Boolean(parsed.maximized),
      desktopSpaceNumber: macOsDesktopSpaceKeyCodes.has(desktopSpaceNumber)
        ? desktopSpaceNumber
        : defaultMacOsDesktopSpaceNumber
    };
  } catch {
    return { desktopSpaceNumber: defaultMacOsDesktopSpaceNumber };
  }
}

function writeWindowState(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const state = {
    bounds: win.getBounds(),
    maximized: win.isMaximized(),
    desktopSpaceNumber: defaultMacOsDesktopSpaceNumber
  };
  try {
    fsSync.mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    fsSync.writeFileSync(windowStatePath(), JSON.stringify(state, null, 2), "utf8");
  } catch {}
}

function trackWindowState(win) {
  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeWindowState(win);
    }, 300);
  };
  win.on("move", scheduleSave);
  win.on("resize", scheduleSave);
  win.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    writeWindowState(win);
  });
}

function switchToMacOsDesktopSpace(spaceNumber, callback) {
  const keyCode = macOsDesktopSpaceKeyCodes.get(spaceNumber);
  if (process.platform !== "darwin" || !keyCode) {
    callback();
    return;
  }

  execFile(
    "osascript",
    ["-e", `tell application "System Events" to key code ${keyCode} using control down`],
    () => setTimeout(callback, 350)
  );
}

function createWindow() {
  const savedWindowState = readWindowState();
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    ...(savedWindowState.bounds || {}),
    minWidth: 1200,
    minHeight: 720,
    title: "코덱스 작업 흐름",
    icon: appIconPath,
    backgroundColor: "#f7f7f7",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.AUTOFLOW_DESKTOP_DEVTOOLS === "1"
    }
  });

  win.once("ready-to-show", () => {
    switchToMacOsDesktopSpace(savedWindowState.desktopSpaceNumber || defaultMacOsDesktopSpaceNumber, () => {
      if (savedWindowState.maximized) {
        win.maximize();
      }
      if (process.platform === "darwin") {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        win.show();
        win.focus();
        setTimeout(() => {
          if (!win.isDestroyed()) {
            win.setVisibleOnAllWorkspaces(false);
          }
        }, 250);
      } else {
        win.show();
        win.focus();
      }
    });
  });

  trackWindowState(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }
}

function setupMacOsDockIcon() {
  if (process.platform !== "darwin") {
    return;
  }

  const appIcon = nativeImage.createFromPath(appIconPath);
  if (appIcon.isEmpty()) {
    console.warn(`[Autoflow Desktop] macOS dock icon image is empty: ${appIconPath}`);
    return;
  }

  app.dock.setIcon(appIcon);
}

function cliInvocation(args) {
  return {
    command: path.join(repoRoot, "bin", "autoflow"),
    args: args.map((arg) => String(arg))
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
      }
    });
    activeChildProcesses.add(child);
    const invocationId = typeof options.invocationId === "string" ? options.invocationId : "";
    registerCancellableInvocation(invocationId, child);
    if (typeof options.onChild === "function") {
      options.onChild(child);
    }

    let stdout = "";
    let stderr = "";
    let cancellationReason = "";
    const timeoutSignal = options.timeoutSignal || options.signal;
    const abortHandler = () => {
      cancellationReason = timeoutSignal.reason?.message || "cancelled by timeout signal";
      terminateAutoflowChild(child, cancellationReason, options.killGraceMs);
    };
    if (timeoutSignal) {
      if (timeoutSignal.aborted) {
        abortHandler();
      } else {
        timeoutSignal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    const cleanup = () => {
      activeChildProcesses.delete(child);
      clearCancellableInvocation(invocationId);
      if (timeoutSignal) {
        timeoutSignal.removeEventListener("abort", abortHandler);
      }
    };

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
      cleanup();
      resolve({
        ok: false,
        command: label,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });

    child.on("close", (code, signal) => {
      cleanup();
      const cancelled = Boolean(cancellationReason) || signal === "SIGTERM" || signal === "SIGKILL";
      const cancellationMessage = cancellationReason || "cancelled by renderer";
      resolve({
        ok: !cancelled && isSuccessfulAutoflowResult(code, stdout),
        command: label,
        code,
        signal: signal || "",
        cancelled,
        stdout,
        stderr: cancelled ? `${stderr}\n[${cancellationMessage}]` : stderr
      });
    });
  });
}

function isSuccessfulAutoflowResult(code, stdout) {
  if (code !== 0) {
    return false;
  }

  const status = parseKeyValueOutput(stdout).status;
  return status !== "blocked" && status !== "fail" && status !== "error";
}

function runAutoflow(command, options = {}) {
  return runAutoflowArgs(scopedArgs(command, options), options);
}

function readBoardDiagnosticCacheKey(command, options = {}) {
  return [
    command,
    options.projectRoot || "",
    options.boardDirName || defaultBoardDirName
  ].join("\0");
}

function cloneRunResult(result) {
  return result ? { ...result } : result;
}

function markReadBoardFallback(result, fallback) {
  const metadata = {
    partial: Boolean(fallback?.partial || result?.ok === false || result?.cancelled),
    fallback: Boolean(fallback?.fallback || result?.ok === false || result?.cancelled),
    stale: Boolean(fallback?.stale),
    refreshInFlight: Boolean(fallback?.refreshInFlight),
    cacheStatus: fallback?.cacheStatus || "fresh"
  };

  return {
    ...result,
    ...metadata,
    readBoardFallback: metadata.fallback || metadata.partial || metadata.stale
  };
}

function diagnosticErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }
  if (typeof error === "string") {
    return error;
  }
  return error.message || String(error) || fallbackMessage;
}

function readBoardDiagnosticErrorResult(command, options = {}, error, fallback = {}) {
  return markReadBoardFallback({
    ok: false,
    command: commandLabel(scopedArgs(command, options)),
    code: -1,
    signal: fallback.signal || "",
    cancelled: Boolean(fallback.cancelled),
    stdout: "",
    stderr: diagnosticErrorMessage(error, `readBoard diagnostic ${command} failed.`)
  }, {
    partial: true,
    fallback: true,
    stale: false,
    refreshInFlight: false,
    cacheStatus: fallback.cacheStatus || "error"
  });
}

function withReadBoardDiagnosticTimeout(source, task, fallbackResult, timeoutMs = readBoardDiagnosticTimeoutMs) {
  const controller = new AbortController();
  let timer = null;
  let settled = false;

  return new Promise((resolve) => {
    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve(result);
    };

    timer = setTimeout(() => {
      const error = new Error(`readBoard diagnostic ${source} timed out after ${timeoutMs}ms`);
      controller.abort(error);
      settle(fallbackResult(error, {
        cancelled: true,
        signal: "SIGTERM",
        cacheStatus: "timeout"
      }));
    }, timeoutMs);

    Promise.resolve()
      .then(() => task(controller.signal))
      .then(settle)
      .catch((error) => {
        settle(fallbackResult(error, { cacheStatus: "error" }));
      });
  });
}

function runReadBoardDiagnostic(command, options = {}) {
  return withReadBoardDiagnosticTimeout(
    command,
    (timeoutSignal) => runAutoflow(command, {
      ...options,
      timeoutSignal,
      killGraceMs: autoflowChildKillGraceMs
    }),
    (error, fallback) => readBoardDiagnosticErrorResult(command, options, error, fallback)
  );
}

function startCachedAutoflowRefresh(command, options, key, entry) {
  const targetEntry =
    entry || {
      result: null,
      updatedAt: 0,
      promise: null
    };

  targetEntry.promise = runReadBoardDiagnostic(command, options)
    .then((result) => {
      targetEntry.result = result;
      targetEntry.updatedAt = Date.now();
      return result;
    })
    .finally(() => {
      targetEntry.promise = null;
    });

  readBoardDiagnosticCache.set(key, targetEntry);
  return targetEntry.promise;
}

function runAutoflowCached(command, options = {}, ttlMs = readBoardDiagnosticCacheTtlMs) {
  const key = readBoardDiagnosticCacheKey(command, options);
  const entry = readBoardDiagnosticCache.get(key);
  const now = Date.now();

  if (entry?.result && now - entry.updatedAt < ttlMs) {
    return Promise.resolve(markReadBoardFallback(cloneRunResult(entry.result), { cacheStatus: "fresh" }));
  }

  if (entry?.result) {
    if (!entry.promise) {
      void startCachedAutoflowRefresh(command, options, key, entry);
    }
    return Promise.resolve(markReadBoardFallback(cloneRunResult(entry.result), {
      partial: true,
      fallback: true,
      stale: true,
      refreshInFlight: true,
      cacheStatus: "stale"
    }));
  }

  if (entry?.promise) {
    return Promise.resolve(emptyCachedAutoflowResult(command, options, {
      refreshInFlight: true,
      cacheStatus: "pending"
    }));
  }

  void startCachedAutoflowRefresh(command, options, key);
  return Promise.resolve(emptyCachedAutoflowResult(command, options, {
    refreshInFlight: true,
    cacheStatus: "miss"
  }));
}

function emptyCachedAutoflowResult(command, options = {}, fallback = {}) {
  return markReadBoardFallback({
    ok: true,
    command: commandLabel(scopedArgs(command, options)),
    code: 0,
    signal: "",
    cancelled: false,
    stdout: "",
    stderr: ""
  }, {
    partial: true,
    fallback: true,
    stale: false,
    ...fallback
  });
}

function runAutoflowCachedOrRefresh(command, options = {}, ttlMs = readBoardDiagnosticCacheTtlMs) {
  const key = readBoardDiagnosticCacheKey(command, options);
  const entry = readBoardDiagnosticCache.get(key);
  const now = Date.now();

  if (entry?.result && now - entry.updatedAt < ttlMs) {
    return Promise.resolve(markReadBoardFallback(cloneRunResult(entry.result), { cacheStatus: "fresh" }));
  }

  if (entry?.result) {
    if (!entry.promise) {
      void startCachedAutoflowRefresh(command, options, key, entry);
    }
    return Promise.resolve(markReadBoardFallback(cloneRunResult(entry.result), {
      partial: true,
      fallback: true,
      stale: true,
      refreshInFlight: true,
      cacheStatus: "stale"
    }));
  }

  if (!entry?.promise) {
    void startCachedAutoflowRefresh(command, options, key, entry);
  }

  return Promise.resolve(emptyCachedAutoflowResult(command, options, {
    refreshInFlight: true,
    cacheStatus: entry?.promise ? "pending" : "miss"
  }));
}

function clearReadBoardDiagnosticCache(command, options = {}) {
  readBoardDiagnosticCache.delete(readBoardDiagnosticCacheKey(command, options));
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

const projectHostSkillAssets = [
  {
    sourceRoot: "integrations/claude/skills",
    sourceRel: "autoflow/SKILL.md",
    targetRel: ".claude/skills/autoflow/SKILL.md"
  },
  {
    sourceRoot: "integrations/codex/skills",
    sourceRel: "autoflow/SKILL.md",
    targetRel: ".codex/skills/autoflow/SKILL.md"
  },
  {
    sourceRoot: "integrations/codex/skills",
    sourceRel: "autoflow/agents/openai.yaml",
    targetRel: ".codex/skills/autoflow/agents/openai.yaml"
  },
];

function renderProjectTemplate(content, boardDirName) {
  return content.replaceAll("{{BOARD_DIR}}", boardDirName || defaultBoardDirName);
}

async function syncProjectHostSkillAsset(projectRoot, boardDirName, asset) {
  const sourcePath = path.join(repoRoot, asset.sourceRoot, asset.sourceRel);
  const targetPath = path.join(projectRoot, asset.targetRel);
  const sourceContent = renderProjectTemplate(await fs.readFile(sourcePath, "utf8"), boardDirName);

  try {
    const targetContent = await fs.readFile(targetPath, "utf8");
    if (targetContent === sourceContent) {
      return "unchanged";
    }

    return "preserved";
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, sourceContent, "utf8");
  return "created";
}

async function ensureProjectHostSkills(options = {}) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) {
    return {
      ok: false,
      created: 0,
      unchanged: 0,
      preserved: 0,
      stderr: "Project root is required."
    };
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  const result = {
    ok: true,
    created: 0,
    unchanged: 0,
    preserved: 0,
    stderr: ""
  };

  for (const asset of projectHostSkillAssets) {
    try {
      const action = await syncProjectHostSkillAsset(projectRoot, boardDirName, asset);
      result[action] += 1;
    } catch (error) {
      result.ok = false;
      result.stderr = error.message || String(error);
      return result;
    }
  }

  return result;
}

function commandExists(command) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exists) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(exists);
    };
    const child = spawn("bash", ["-lc", `command -v ${command}`], {
      cwd: repoRoot,
      env: process.env
    });
    const timeout = setTimeout(() => {
      child.kill();
      finish(false);
    }, 5000);

    child.on("error", () => finish(false));
    child.on("close", (code) => finish(code === 0));
  });
}

function runCommandWithTimeout(command, args = [], options = {}, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env
    });
    let settled = false;
    let stdout = "";
    let stderr = "";
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {}
      finish({ ok: false, code: -1, stdout, stderr: `${stderr}\n[timeout]` });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    if (typeof options.input === "string") {
      child.stdin.write(options.input);
      child.stdin.end();
    }
    child.on("error", (error) => {
      finish({ ok: false, code: -1, stdout, stderr: `${stderr}${error.message || String(error)}` });
    });
    child.on("close", (code) => {
      finish({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function sanitizedProcessEnv() {
  const env = { ...process.env };
  delete env.npm_config_prefix;
  delete env.NPM_CONFIG_PREFIX;
  return env;
}

function browserAuthProcessEnv() {
  const env = sanitizedProcessEnv();
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  delete env.DEBIAN_FRONTEND;
  delete env.NO_BROWSER;
  delete env.SSH_CONNECTION;
  if (env.BROWSER === "www-browser") {
    delete env.BROWSER;
  }
  return env;
}

function normalizeAgentKey(agent) {
  return String(agent || "").trim().toLowerCase();
}

async function readJsonIfExists(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readInstalledAgentProfiles() {
  const home = os.homedir();
  const [codexInstalled, claudeInstalled, opencodeInstalled, geminiInstalled] = await Promise.all([
    commandExists("codex"),
    commandExists("claude"),
    commandExists("opencode"),
    commandExists("gemini")
  ]);

  const codexConfigPath = path.join(home, ".codex", "config.toml");
  const claudeSettingsPath = path.join(home, ".claude", "settings.json");
  const geminiSettingsPath = path.join(home, ".gemini", "settings.json");

  const [claudeSettings, geminiSettings] = await Promise.all([
    readJsonIfExists(claudeSettingsPath),
    readJsonIfExists(geminiSettingsPath)
  ]);

  let detectedCodexModel = "";
  let detectedCodexReasoning = "";
  if (codexInstalled) {
    try {
      const codexToml = fsSync.readFileSync(codexConfigPath, "utf8");
      for (const rawLine of codexToml.split(/\r?\n/)) {
        const line = stripTomlComment(rawLine).trim();
        const valueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
        if (!valueMatch) {
          continue;
        }
        if (valueMatch[1] === "model") {
          detectedCodexModel = parseTomlStringValue(valueMatch[2]);
        }
        if (valueMatch[1] === "model_reasoning_effort") {
          detectedCodexReasoning = parseTomlStringValue(valueMatch[2]);
        }
      }
    } catch {}
  }
  const codexProfile = supportedCodexProfile(detectedCodexModel, detectedCodexReasoning);

  return {
    codex: {
      installed: codexInstalled,
      model: codexProfile.model,
      reasoning: codexProfile.reasoning,
      supportsReasoning: true
    },
    claude: {
      installed: claudeInstalled,
      model: typeof claudeSettings?.model === "string" ? claudeSettings.model : "",
      reasoning: typeof claudeSettings?.effort === "string" ? claudeSettings.effort : "",
      supportsReasoning: true
    },
    opencode: {
      installed: opencodeInstalled,
      model: "",
      reasoning: "",
      supportsReasoning: false
    },
    gemini: {
      installed: geminiInstalled,
      model: typeof geminiSettings?.model === "string" ? geminiSettings.model : "",
      reasoning: "",
      supportsReasoning: false
    }
  };
}

function parseRunnerListOutput(output) {
  const values = parseKeyValueOutput(output);
  const count = Number.parseInt(values.runner_count || "0", 10);
  const runners = [];

  for (let index = 1; index <= count; index += 1) {
    const prefix = `runner.${index}.`;
    const lastBudgetSkipReason = values[`${prefix}last_budget_skip_reason`] || "";
    const lastBudgetSourceFresh = values[`${prefix}last_budget_source_fresh`] || "";
    const rawLastResult = values[`${prefix}last_result`] || "";
    const lastResult =
      rawLastResult === "token_budget_exceeded" &&
      lastBudgetSkipReason === "stale_token_usage_source" &&
      lastBudgetSourceFresh === "false"
        ? "stale_token_usage_source"
        : rawLastResult;
    runners.push({
      id: values[`${prefix}id`] || "",
      role: values[`${prefix}role`] || "",
      agent: values[`${prefix}agent`] || "",
      model: values[`${prefix}model`] || "",
      reasoning: values[`${prefix}reasoning`] || "",
      mode: values[`${prefix}mode`] || "",
      intervalSeconds: values[`${prefix}interval_seconds`] || "",
      intervalEffectiveSeconds: values[`${prefix}interval_effective_seconds`] || "",
      configFingerprint: values[`${prefix}config_fingerprint`] || "",
      appliedConfigFingerprint: values[`${prefix}applied_config_fingerprint`] || "",
      configAppliedAt: values[`${prefix}config_applied_at`] || "",
      enabled: values[`${prefix}enabled`] || "",
      command: values[`${prefix}command`] || "",
      commandPreview: values[`${prefix}command_preview`] || "",
      stateStatus: values[`${prefix}state_status`] || "idle",
      activeItem: values[`${prefix}active_item`] || "",
      activeTicketId: values[`${prefix}active_ticket_id`] || "",
      activeTicketTitle: values[`${prefix}active_ticket_title`] || "",
      activeStage: values[`${prefix}active_stage`] || "",
      activeSpecRef: values[`${prefix}active_spec_ref`] || "",
      activeRecoveryReason: values[`${prefix}active_recovery_reason`] || "",
      activeRecoveryStatus: values[`${prefix}active_recovery_status`] || "",
      activeRecoveryFailureClass: values[`${prefix}active_recovery_failure_class`] || "",
      pid: values[`${prefix}pid`] || "",
      startedAt: values[`${prefix}started_at`] || "",
      lastEventAt: values[`${prefix}last_event_at`] || "",
      lastAdapterChunkAt: values[`${prefix}last_adapter_chunk_at`] || "",
      lastResult,
      lastBudgetSkipReason,
      lastBudgetSource: values[`${prefix}last_budget_source`] || "",
      lastBudgetSourceFresh,
      lastBudgetSourceAgeSeconds: values[`${prefix}last_budget_source_age_seconds`] || "",
      consecutivePreflightSkipCount: values[`${prefix}consecutive_preflight_skip_count`] || "",
      consecutivePreflightSkipResult: values[`${prefix}consecutive_preflight_skip_result`] || "",
      lastPreflightSkipAt: values[`${prefix}last_preflight_skip_at`] || "",
      preflightSkipCircuitBreakerUntil: values[`${prefix}preflight_skip_circuit_breaker_until`] || "",
      preflightSkipCircuitBreakerThreshold: values[`${prefix}preflight_skip_circuit_breaker_threshold`] || "",
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
      logPath: values[`${prefix}log_path`] || "",
      authRequired: false,
      authMessage: "",
      authUrl: "",
      tokenUsage: 0
    });
  }

  return {
    values,
    runners
  };
}

// Strict drop set — applied when the log is structured as adapter conversation
// (begin/end markers present). It removes the protocol envelope and any
// key=value scaffolding so only the agent's natural-language text remains.
const conversationDropPatterns = [
  /^adapter_(stdout|stderr|prompt|runtime)_(begin|end)\s*$/i,
  /^Warning: Basic terminal detected\b/i,
  /^Warning: 256-color support not detected\b/i,
  /^YOLO mode is enabled\b/i,
  /^Error executing tool [\w-]+: Error: /i,
  /^[a-z][a-z0-9_.-]*=/i,
  /^[a-z][a-z0-9_.-]*\.output_(?:begin|end)$/i,
  /^[a-z][a-z0-9_.-]*_output_(?:begin|end)$/i,
  /\bcodex_core::plugins::manifest: ignoring interface\.defaultPrompt\b/i,
  /\bcodex_core_plugins::manifest: ignoring interface\.defaultPrompt\b/i,
  /\bcodex_core_skills::loader: ignoring interface\.(?:icon_small|icon_large)\b/i,
  /\bcodex_core::plugins::manager: failed to load plugin: plugin is not installed\b/i,
  /\bcodex_rmcp_client::stdio_server_launcher: Failed to terminate MCP process group\b/i,
  /^\/.*\/\.autoflow\/tickets\/.*\.md$/i
];

// Permissive drop set — applied when the log carries only the runtime tick
// stream (no adapter conversation embedded, as is the case when codex/claude
// is not on PATH or the adapter ran but produced nothing). We keep `key=value`
// tick lines so the runner card terminal panel can show a live, growing
// stream and the typing animation has new characters to reveal each tick.
const conversationEnvelopeDropPatterns = [
  /^adapter_(stdout|stderr|prompt|runtime)_(begin|end)\s*$/i,
  /^[a-z][a-z0-9_.-]*\.output_(?:begin|end)$/i,
  /^[a-z][a-z0-9_.-]*_output_(?:begin|end)$/i,
  /^Warning: Basic terminal detected\b/i,
  /^Warning: 256-color support not detected\b/i,
  /^YOLO mode is enabled\b/i,
  /\bcodex_core::plugins::manifest: ignoring interface\.defaultPrompt\b/i,
  /\bcodex_core_plugins::manifest: ignoring interface\.defaultPrompt\b/i,
  /\bcodex_core_skills::loader: ignoring interface\.(?:icon_small|icon_large)\b/i,
  /\bcodex_core::plugins::manager: failed to load plugin: plugin is not installed\b/i,
  /\bcodex_rmcp_client::stdio_server_launcher: Failed to terminate MCP process group\b/i
];

const adapterMarkerPattern = /^adapter_(stdout|stderr|prompt|runtime)_begin\s*$/im;

// Detect rich-mode only when there is real conversation content between
// adapter_*_begin and adapter_*_end. When the adapter executable is missing
// the runtime emits empty marker pairs (`begin\nend`); those should fall
// back to permissive mode so the runtime tick stream is visible.
function hasNonEmptyAdapterBody(text) {
  const re = /adapter_(stdout|stderr|prompt|runtime)_begin\s*\n([\s\S]*?)\nadapter_\1_end/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match[2] && match[2].trim().length > 0) return true;
  }
  return false;
}

const conversationAnsiEscapePattern = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const conversationRepeatNormalizers = [
  [/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, "<timestamp>"],
  [/\b\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\b/g, "<timestamp>"],
  [/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT\b/g, "<http-date>"],
  [/\bAttempt \d+ failed\b/g, "Attempt <n> failed"],
  [/\bprocess group \d+\b/g, "process group <pid>"],
  [/\bpid=\d+\b/g, "pid=<pid>"],
  [/\bdur=\d+\b/g, "dur=<duration>"],
  [/\bx-[a-z0-9-]+-trace-id': '[^']+'/gi, "x-trace-id: '<id>'"]
];

function cleanConversationLine(line) {
  return line.replace(conversationAnsiEscapePattern, "").trim();
}

function conversationRepeatKey(line) {
  let key = cleanConversationLine(line);
  if (!key) return "";
  for (const [pattern, replacement] of conversationRepeatNormalizers) {
    key = key.replace(pattern, replacement);
  }
  return key;
}

function collapseRepeatedConversationLines(lines) {
  const collapsed = [];
  const seenKeys = new Set();

  for (const line of lines) {
    const key = conversationRepeatKey(line);
    if (!key) {
      const previous = collapsed[collapsed.length - 1] || "";
      if (previous.trim()) {
        collapsed.push(line);
      }
      continue;
    }

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    collapsed.push(line);
  }

  while (collapsed.length && !collapsed[collapsed.length - 1].trim()) collapsed.pop();

  return collapsed;
}

function extractAgentConversation(text, maxChars = 4000) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);

  // Apply a drop-pattern set + optional dedup over the line list.
  function applyFilter(dropPatterns, dedupe) {
    const kept = [];
    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      const matchTarget = cleanConversationLine(line);
      if (dropPatterns.some((pattern) => pattern.test(matchTarget))) continue;
      kept.push(line);
    }
    while (kept.length && !kept[0].trim()) kept.shift();
    while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
    return dedupe ? collapseRepeatedConversationLines(kept) : kept;
  }

  // Strict: only the agent's natural-language conversation, with envelope and
  // `key=value` scaffolding removed. Useful when an adapter is actually
  // running and emitting prose.
  const strict = applyFilter(conversationDropPatterns, true);
  // Permissive: drop only the protocol envelope and error noise; keep
  // `key=value` runtime tick lines and skip dedup so the terminal panel grows
  // tick-by-tick — that growth is what makes the ConversationStream typing
  // animation visibly play.
  const permissive = applyFilter(conversationEnvelopeDropPatterns, false);

  // Pick strict only when it actually has meaningful conversation content.
  // When the adapter is missing or its body is empty, strict collapses to a
  // stray fragment; permissive keeps the live tick stream visible.
  const useStrict = strict.length >= 3 || strict.length >= permissive.length;
  const result = useStrict ? strict : permissive;

  // Single stray log/path line (e.g. wiki stderr that contains only its own
  // log filename) is not useful as a "conversation" — return empty so the
  // caller can fall through to the next candidate log.
  if (
    result.length === 1 &&
    /^[\w./_-]+\.(log|txt|md)$/i.test(result[0].trim())
  ) {
    return "";
  }

  let conversation = result.join("\n");
  if (conversation.length > maxChars) {
    conversation = `…\n${conversation.slice(conversation.length - maxChars)}`;
  }
  return conversation;
}

async function readTailText(filePath, limitBytes = runnerTerminalPreviewLimitBytes) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size <= 0) {
      return "";
    }

    const bytesToRead = Math.min(stat.size, limitBytes);
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(bytesToRead);
      await handle.read(buffer, 0, bytesToRead, stat.size - bytesToRead);
      return buffer.toString("utf8");
    } finally {
      await handle.close();
    }
  } catch {
    return "";
  }
}

function runnerLiveLogPaths(runner, boardRoot) {
  if (!runner.id || !safeIdPattern.test(runner.id)) {
    return [];
  }

  return [
    path.join(boardRoot, "runners", "logs", `${runner.id}.loop.stdout.log`),
    path.join(boardRoot, "runners", "logs", `${runner.id}.loop.stderr.log`)
  ];
}

function runnerArtifactLogPaths(runner) {
  return [runner.lastStdoutLog, runner.lastStderrLog, runner.lastRuntimeLog, runner.logPath].filter(Boolean);
}

function runnerQuotaInfoFromText(text) {
  const clean = (text || "").replace(ansiEscapePattern, "");
  const lower = clean.toLowerCase();
  const limited =
    lower.includes("hit your limit") ||
    lower.includes("usage limit") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    clean.includes("쿼터 부족") ||
    clean.includes("토큰 부족") ||
    clean.includes("사용량 제한");

  if (!limited) {
    return { quotaLimited: false, quotaResetLabel: "" };
  }

  const resetMatch = clean.match(/\bresets?\s+([^\r\n]+)/i);
  return {
    quotaLimited: true,
    quotaResetLabel: resetMatch?.[1]?.trim() || ""
  };
}

function mergeRunnerQuotaInfo(current, next) {
  if (current.quotaLimited) {
    return current.quotaResetLabel || !next.quotaResetLabel
      ? current
      : { ...current, quotaResetLabel: next.quotaResetLabel };
  }

  return next.quotaLimited ? next : current;
}

function extractAuthUrl(text) {
  const urls = (text || "").match(authUrlPattern) || [];
  if (!urls.length) return "";
  const authLike = urls.find((url) => /auth|login|oauth|device|account|signin|sign-in/i.test(url));
  return authLike || urls[0] || "";
}

function runnerAuthInfoFromText(text, agent) {
  const clean = (text || "").replace(conversationAnsiEscapePattern, "");
  if (!clean.trim()) {
    return { authRequired: false, authMessage: "", authUrl: "" };
  }

  const authRequired = runnerAuthNeededPatterns.some((pattern) => pattern.test(clean));
  const authUrl = extractAuthUrl(clean);
  if (!authRequired) {
    return { authRequired: false, authMessage: "", authUrl: "" };
  }

  const label = agentDisplayLabels[normalizeAgentKey(agent)] || agent || "Agent";
  return {
    authRequired: true,
    authMessage: `${label} 로그인이 필요합니다.`,
    authUrl
  };
}

function mergeRunnerAuthInfo(current, next) {
  if (current.authRequired) {
    return current.authUrl || !next.authUrl ? current : { ...current, authUrl: next.authUrl };
  }

  return next.authRequired ? next : current;
}

async function agentIsLoggedIn(agent) {
  const key = normalizeAgentKey(agent);
  const cached = agentAuthStatusCache.get(key);
  const now = Date.now();
  if (cached && now - cached.checkedAt < 15 * 1000) {
    return cached.loggedIn;
  }

  let loggedIn = false;
  if (key === "claude") {
    const result = await runCommandWithTimeout(
      "claude",
      ["auth", "status"],
      { cwd: repoRoot, env: sanitizedProcessEnv() },
      5000
    );
    if (result.ok) {
      try {
        loggedIn = JSON.parse(result.stdout || "{}").loggedIn === true;
      } catch {
        loggedIn = /\bloggedIn"?\s*[:=]\s*true\b|logged in/i.test(result.stdout || "");
      }
    }
  } else if (key === "codex") {
    const result = await runCommandWithTimeout(
      "codex",
      ["login", "status"],
      { cwd: repoRoot, env: sanitizedProcessEnv() },
      5000
    );
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    loggedIn = result.ok && /\blogged in\b/i.test(output) && !/\bnot logged in\b/i.test(output);
  }

  agentAuthStatusCache.set(key, { checkedAt: now, loggedIn });
  return loggedIn;
}

async function continueRunnerAuth(options = {}) {
  if (!options.projectRoot) {
    return {
      ok: false,
      command: "runner auth",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    };
  }

  const agent = normalizeAgentKey(options.agent);
  if (agent !== "gemini") {
    return {
      ok: false,
      command: "runner auth",
      code: -1,
      stdout: "",
      stderr: `Runner auth prompt is not supported for agent=${options.agent || ""}.`
    };
  }

  if (!(await commandExists("gemini"))) {
    return {
      ok: false,
      command: "gemini --prompt <auth-check>",
      code: 127,
      stdout: "",
      stderr: "Gemini CLI is not installed or not on PATH."
    };
  }

  const runnerId = String(options.runnerId || "gemini").trim() || "gemini";
  const existing = runnerAuthProcesses.get(runnerId);
  if (existing && !existing.killed) {
    return {
      ok: true,
      command: "gemini --prompt <auth-check>",
      code: 0,
      stdout: "status=ok\nresult=auth_flow_already_running\n",
      stderr: ""
    };
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let consentSent = false;
    let browserOpenStarted = false;

    const child = spawn(
      "gemini",
      [
        "--skip-trust",
        "--approval-mode",
        "yolo",
        "--prompt",
        "Autoflow authentication check. Reply with OK only."
      ],
      {
        cwd: options.projectRoot,
        env: browserAuthProcessEnv(),
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    runnerAuthProcesses.set(runnerId, child);

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(initialTimeout);
      resolve(payload);
    };

    const cleanup = () => {
      if (runnerAuthProcesses.get(runnerId) === child) {
        runnerAuthProcesses.delete(runnerId);
      }
      clearTimeout(authTimeout);
      agentAuthStatusCache.delete(agent);
    };

    const maybeContinuePrompt = () => {
      if (consentSent) return;
      const combined = `${stdout}\n${stderr}`;
      if (!/Opening authentication page in your browser/i.test(combined)) {
        return;
      }

      consentSent = true;
      try {
        child.stdin.write("Y\n");
        child.stdin.end();
      } catch {}
    };

    const maybeOpenAuthUrl = () => {
      if (browserOpenStarted) return;
      const authUrl = extractAuthUrl(`${stdout}\n${stderr}`);
      if (!authUrl) return;

      browserOpenStarted = true;
      shell.openExternal(authUrl)
        .then(() => {
          finish({
            ok: true,
            command: "gemini --prompt <auth-check>",
            code: 0,
            stdout: `status=ok\nresult=auth_browser_opened\nauth_url=${authUrl}\n`,
            stderr
          });
        })
        .catch((error) => {
          finish({
            ok: false,
            command: "gemini --prompt <auth-check>",
            code: -1,
            stdout,
            stderr: `${stderr}\nFailed to open auth URL: ${error.message || String(error)}`
          });
        });
    };

    const handleOutput = (chunk, target) => {
      if (target === "stdout") {
        stdout += chunk.toString();
      } else {
        stderr += chunk.toString();
      }
      maybeContinuePrompt();
      maybeOpenAuthUrl();
    };

    const initialTimeout = setTimeout(() => {
      if (browserOpenStarted) return;
      try {
        child.kill("SIGTERM");
      } catch {}
      finish({
        ok: false,
        command: "gemini --prompt <auth-check>",
        code: -1,
        stdout,
        stderr: `${stderr}\nGemini authentication URL was not produced within 30 seconds.`
      });
    }, 30 * 1000);

    const authTimeout = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {}
    }, 6 * 60 * 1000);
    authTimeout.unref?.();

    child.stdout.on("data", (chunk) => handleOutput(chunk, "stdout"));
    child.stderr.on("data", (chunk) => handleOutput(chunk, "stderr"));
    child.stdin.on("error", () => {});
    child.on("error", (error) => {
      cleanup();
      finish({
        ok: false,
        command: "gemini --prompt <auth-check>",
        code: -1,
        stdout,
        stderr: `${stderr}${error.message || String(error)}`
      });
    });
    child.on("close", (code) => {
      cleanup();
      if (code === 0 && !settled) {
        finish({
          ok: true,
          command: "gemini --prompt <auth-check>",
          code,
          stdout: `${stdout}\nstatus=ok\nresult=auth_check_completed\n`,
          stderr
        });
      } else if (!settled) {
        finish({
          ok: false,
          command: "gemini --prompt <auth-check>",
          code,
          stdout,
          stderr: stderr || "Gemini authentication helper exited before opening a browser."
        });
      }
    });
  });
}

async function recentRunnerArtifactLogPaths(runner, boardRoot, maxFiles = 10) {
  if (!runner.id || !safeIdPattern.test(runner.id)) {
    return [];
  }

  const logsDir = path.join(boardRoot, "runners", "logs");
  let entries;
  try {
    entries = await fs.readdir(logsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const prefix = `${runner.id}_`;
  const candidates = [];
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return;
      if (!entry.name.startsWith(prefix)) return;
      if (!/_(?:stdout|stderr)\.log$/.test(entry.name)) return;
      if (/_live_(?:stdout|stderr)\.log$/.test(entry.name)) return;

      const filePath = path.join(logsDir, entry.name);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          candidates.push({ filePath, modifiedMs: stat.mtimeMs });
        }
      } catch {}
    })
  );

  return candidates
    .sort((a, b) => b.modifiedMs - a.modifiedMs)
    .slice(0, maxFiles)
    .map((candidate) => candidate.filePath);
}

async function runnerQuotaInfo(runner, boardRoot) {
  const status = runner.stateStatus || runner.status || "";
  const lastResult = runner.lastResult || "";
  const shouldReadHistoricQuota = status === "stopped" && lastResult === "quota_limited";
  let quotaInfo = runnerQuotaInfoFromText(
    [runner.lastLogLine, runner.activeItem, runner.lastResult].filter(Boolean).join("\n")
  );

  const candidatePaths = [
    runner.lastStdoutLog,
    runner.lastStderrLog,
    ...(shouldReadHistoricQuota ? await recentRunnerArtifactLogPaths(runner, boardRoot) : [])
  ].filter(Boolean);

  const seen = new Set();
  for (const candidatePath of candidatePaths) {
    if (seen.has(candidatePath)) continue;
    seen.add(candidatePath);
    const absolutePath = path.isAbsolute(candidatePath) ? candidatePath : path.join(boardRoot, candidatePath);
    const text = await readTailText(absolutePath, 8192);
    quotaInfo = mergeRunnerQuotaInfo(quotaInfo, runnerQuotaInfoFromText(text));
    if (quotaInfo.quotaLimited && quotaInfo.quotaResetLabel) {
      break;
    }
  }

  return quotaInfo;
}

async function runnerAuthInfo(runner, boardRoot) {
  let authInfo = runnerAuthInfoFromText(
    [runner.lastLogLine, runner.activeItem, runner.lastResult, runner.conversationPreview].filter(Boolean).join("\n"),
    runner.agent
  );

  const candidatePaths = [
    runner.lastStdoutLog,
    runner.lastStderrLog,
    ...runnerLiveLogPaths(runner, boardRoot)
  ].filter(Boolean);

  const seen = new Set();
  for (const candidatePath of candidatePaths) {
    if (seen.has(candidatePath)) continue;
    seen.add(candidatePath);
    const absolutePath = path.isAbsolute(candidatePath) ? candidatePath : path.join(boardRoot, candidatePath);
    const text = await readTailText(absolutePath, 8192);
    authInfo = mergeRunnerAuthInfo(authInfo, runnerAuthInfoFromText(text, runner.agent));
    if (authInfo.authRequired && authInfo.authUrl) {
      break;
    }
  }

  if (authInfo.authRequired && await agentIsLoggedIn(runner.agent)) {
    return { authRequired: false, authMessage: "", authUrl: "" };
  }

  return authInfo;
}

async function runnerConversationPreview(runner, boardRoot) {
  const candidatePaths = [
    runner.lastStdoutLog,
    runner.lastRuntimeLog,
    ...runnerLiveLogPaths(runner, boardRoot),
    runner.lastStderrLog
  ].filter(Boolean);

  const seen = new Set();
  for (const candidatePath of candidatePaths) {
    if (seen.has(candidatePath)) continue;
    seen.add(candidatePath);
    const absolutePath = path.isAbsolute(candidatePath) ? candidatePath : path.join(boardRoot, candidatePath);
    const text = await readTailText(absolutePath);
    if (!text) continue;
    const conversation = extractAgentConversation(text);
    if (conversation) return conversation;
  }
  return "";
}


async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const runnerLogNamePattern = /^(.+?)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_(?:stdout|stderr)\.log$/;
const runnerLiveLogNamePattern =
  /^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)_live_(?:stdout|stderr)\.log$/;
const ansiEscapePattern = /\[[0-9;?]*[A-Za-z]/g;
const totalTokensMarkerPattern = /total[_ -]?tokens/;
const tokenTotalMarkers = ["total_tokens", "total tokens", "total-tokens", "totaltokens"];
const tokenComponentMarkers = [
  "cache_creation_input_tokens",
  "cache creation input tokens",
  "cachecreationinputtokens",
  "cache_read_input_tokens",
  "cache read input tokens",
  "cachereadinputtokens",
  "cached_input_tokens",
  "cached input tokens",
  "cachedinputtokens",
  "reasoning_tokens",
  "reasoning tokens",
  "reasoningtokens",
  "prompt_tokens",
  "prompt tokens",
  "prompttokens",
  "input_tokens",
  "input tokens",
  "inputtokens",
  "completion_tokens",
  "completion tokens",
  "completiontokens",
  "output_tokens",
  "output tokens",
  "outputtokens"
];
const telemetryMaxRowTokens = 100000000;
const liveTokenLogCache = new Map();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numberAfterTokenMarker(lower, marker) {
  const markerPattern = new RegExp(`(^|[^a-z0-9_])${escapeRegExp(marker)}[^0-9]*([0-9][0-9,]*)`);
  const match = lower.match(markerPattern);
  return match ? Number.parseInt(match[2].replace(/,/g, ""), 10) : -1;
}

function positiveIntegerValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function isSaneTelemetryTokenCount(input, output) {
  const total = input + output;
  return input < telemetryMaxRowTokens && output < telemetryMaxRowTokens && total < telemetryMaxRowTokens;
}

function firstPositiveTokenKeyValue(source, keys) {
  if (!source || typeof source !== "object") return 0;
  for (const key of keys) {
    const value = positiveIntegerValue(source[key]);
    if (value > 0) return value;
  }
  return 0;
}

function geminiUsageTotalFromObject(source) {
  if (!source || typeof source !== "object") return 0;

  const usageSource = source.usageMetadata || source.usage_metadata || source;
  const total = firstPositiveTokenKeyValue(usageSource, ["totalTokenCount", "total_token_count"]);
  if (total > 0) return total;

  const prompt = firstPositiveTokenKeyValue(usageSource, ["promptTokenCount", "prompt_token_count", "inputTokenCount", "input_token_count"]);
  const candidates = firstPositiveTokenKeyValue(usageSource, [
    "candidatesTokenCount",
    "candidates_token_count",
    "outputTokenCount",
    "output_token_count"
  ]);
  if (prompt + candidates > 0) return prompt + candidates;

  if (Array.isArray(source)) {
    return source.reduce((sum, item) => sum + geminiUsageTotalFromObject(item), 0);
  }

  return Object.values(source).reduce((sum, item) => sum + geminiUsageTotalFromObject(item), 0);
}

function numberAfterJsonTokenKey(line, keys) {
  for (const key of keys) {
    const keyPattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*([0-9][0-9,]*)`, "i");
    const match = line.match(keyPattern);
    if (match) return Number.parseInt(match[1].replace(/,/g, ""), 10);
  }
  return 0;
}

function geminiUsageTotalFromLine(line) {
  const trimmed = line.trim();
  if (!/(usageMetadata|usage_metadata|TokenCount|token_count)/i.test(trimmed)) return 0;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const total = geminiUsageTotalFromObject(parsed);
      if (total > 0) return total;
    } catch {
      // Fall through to regex parsing for stream fragments or non-JSON logs.
    }
  }

  const total = numberAfterJsonTokenKey(trimmed, ["totalTokenCount", "total_token_count"]);
  if (total > 0) return total;

  const prompt = numberAfterJsonTokenKey(trimmed, ["promptTokenCount", "prompt_token_count", "inputTokenCount", "input_token_count"]);
  const candidates = numberAfterJsonTokenKey(trimmed, [
    "candidatesTokenCount",
    "candidates_token_count",
    "outputTokenCount",
    "output_token_count"
  ]);
  return prompt + candidates;
}

function tokenUsageFromLine(lower) {
  for (const marker of tokenTotalMarkers) {
    const value = numberAfterTokenMarker(lower, marker);
    if (value >= 0) return value;
  }

  let total = 0;
  for (const marker of tokenComponentMarkers) {
    const value = numberAfterTokenMarker(lower, marker);
    if (value >= 0) total += value;
  }
  return total;
}

function isCodexGuardWarningLine(line) {
  return /\bWARN\s+codex_core_(?:plugins::manifest|skills::loader):/.test(line);
}

function parseTokenUsageChunk(chunk, prior) {
  const combined = (prior?.tail || "") + chunk;
  const lines = combined.split("\n");
  const newTail = lines.pop() ?? "";
  let total = prior?.tokens ?? 0;
  let waiting = prior?.waiting ?? false;

  for (const rawLine of lines) {
    const clean = rawLine.replace(/\r$/, "").replace(ansiEscapePattern, "");
    if (isCodexGuardWarningLine(clean)) {
      continue;
    }
    const lower = clean.toLowerCase();
    const geminiUsageTotal = geminiUsageTotalFromLine(clean);
    if (geminiUsageTotal > 0) {
      total += geminiUsageTotal;
      continue;
    }

    if (waiting) {
      const numberMatch = clean.replace(/,/g, "").match(/[0-9]+/);
      if (numberMatch) {
        total += Number.parseInt(numberMatch[0], 10);
        waiting = false;
        continue;
      }
      if (clean.trim() !== "") {
        waiting = false;
      }
    }

    // Marker must be at the start of the line so ticket markdown fields
    // (e.g. "- Tokens Used:") and wiki snippet text
    // (e.g. "result.N.snippet.text=- Tokens Used: ... 335739843")
    // are not mistaken for adapter token reports.
    const tokensUsedLineMatch = lower.match(/^\s*tokens\s+used\b/);
    if (tokensUsedLineMatch) {
      const after = clean.slice(tokensUsedLineMatch[0].length).replace(/,/g, "");
      const inlineMatch = after.match(/[0-9]+/);
      if (inlineMatch) {
        total += Number.parseInt(inlineMatch[0], 10);
      } else {
        waiting = true;
      }
      continue;
    }

    if (
      /^\s*total[_ -]?tokens\b/.test(lower) ||
      /^\s*totaltokens\b/.test(lower) ||
      /"total[_-]?tokens"\s*:\s*[0-9]/.test(lower)
    ) {
      const tokenLineTotal = tokenUsageFromLine(lower);
      if (tokenLineTotal > 0) total += tokenLineTotal;
      continue;
    }

    if (
      /^\s*(input|output|prompt|completion|cache|cached|reasoning)[_ -]?tokens\b/.test(lower) ||
      /^\s*(input|output|prompt|completion|cache|cached|reasoning)tokens\b/.test(lower) ||
      /"(input|output|prompt|completion|cache_creation_input|cache_read_input|cached_input|reasoning)[_-]?tokens"\s*:\s*[0-9]/.test(lower)
    ) {
      const tokenLineTotal = tokenUsageFromLine(lower);
      if (tokenLineTotal > 0) total += tokenLineTotal;
    }
  }

  return { tokens: total, waiting, tail: newTail };
}

function timestampFromRunnerLogName(value) {
  if (!value) return 0;
  const normalized = value.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/,
    "$1T$2:$3:$4Z"
  );
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function runningRunnerStartTimes(runners) {
  const startTimes = new Map();
  for (const runner of runners || []) {
    const status = String(runner?.stateStatus || "").toLowerCase();
    const pid = String(runner?.pid || "").trim();
    if (status !== "running" && !pid) continue;
    const runnerId = typeof runner?.id === "string" ? runner.id : "";
    if (!runnerId) continue;
    const startedAtMs = Date.parse(String(runner?.startedAt || ""));
    startTimes.set(runnerId, Number.isFinite(startedAtMs) ? startedAtMs : 0);
  }
  return startTimes;
}

async function aggregateLiveTokenUsage(logsDir, activeStartTimes) {
  const totals = new Map();
  if (!activeStartTimes || activeStartTimes.size === 0) {
    liveTokenLogCache.clear();
    return totals;
  }

  let entries;
  try {
    entries = await fs.readdir(logsDir);
  } catch {
    return totals;
  }

  const seenPaths = new Set();

  await Promise.all(
    entries.map(async (name) => {
      const match = runnerLiveLogNamePattern.exec(name);
      if (!match) return;
      const runnerId = match[1];
      const activeStartedAtMs = activeStartTimes.get(runnerId);
      if (activeStartedAtMs === undefined) return;
      const logStartedAtMs = timestampFromRunnerLogName(match[2]);
      if (activeStartedAtMs > 0 && logStartedAtMs > 0 && logStartedAtMs < activeStartedAtMs) return;
      const filePath = path.join(logsDir, name);

      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        return;
      }
      if (!stat.isFile()) return;

      seenPaths.add(filePath);
      if (stat.size === 0) return;

      const cached = liveTokenLogCache.get(filePath);
      if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
        totals.set(runnerId, (totals.get(runnerId) || 0) + cached.tokens);
        return;
      }

      let startOffset = 0;
      let prior = { tokens: 0, waiting: false, tail: "" };
      if (cached && cached.size > 0 && cached.size <= stat.size) {
        startOffset = cached.size;
        prior = { tokens: cached.tokens, waiting: cached.waiting, tail: cached.tail };
      }

      let content = "";
      const length = stat.size - startOffset;
      if (length > 0) {
        let handle;
        try {
          handle = await fs.open(filePath, "r");
          const buffer = Buffer.allocUnsafe(length);
          await handle.read(buffer, 0, length, startOffset);
          content = buffer.toString("utf8");
        } catch {
          return;
        } finally {
          if (handle) await handle.close().catch(() => {});
        }
      }

      const result = parseTokenUsageChunk(content, prior);
      liveTokenLogCache.set(filePath, {
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        tokens: result.tokens,
        waiting: result.waiting,
        tail: result.tail
      });

      totals.set(runnerId, (totals.get(runnerId) || 0) + result.tokens);
    })
  );

  for (const cachedPath of liveTokenLogCache.keys()) {
    if (!seenPaths.has(cachedPath)) {
      liveTokenLogCache.delete(cachedPath);
    }
  }

  return totals;
}

async function readRunnerTokenUsage(boardRoot, runners = []) {
  const cacheTotals = new Map();
  const cachePath = path.join(boardRoot, "metrics", "token-cache.tsv");
  const maxDataAgeSeconds = positiveIntegerValue(process.env.AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS) || 3600;
  const nowMs = Date.now();

  let raw;
  try {
    raw = await fs.readFile(cachePath, "utf8");
  } catch {
    raw = "";
  }

  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const tokenCount = Number.parseInt(parts[3], 10);
    if (!Number.isFinite(tokenCount) || tokenCount <= 0) continue;
    const cacheTimestampMs = Date.parse(parts[2] || "");
    if (!Number.isFinite(cacheTimestampMs)) continue;
    if ((nowMs - cacheTimestampMs) / 1000 > maxDataAgeSeconds) continue;
    const match = path.basename(parts[0]).match(runnerLogNamePattern);
    if (!match) continue;
    cacheTotals.set(match[1], (cacheTotals.get(match[1]) || 0) + tokenCount);
  }

  const telemetryTotals = new Map();
  const telemetryPath = path.join(boardRoot, "telemetry", "runs.jsonl");
  let telemetryRaw;
  try {
    telemetryRaw = await fs.readFile(telemetryPath, "utf8");
  } catch {
    telemetryRaw = "";
  }

  for (const line of telemetryRaw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const runnerId = typeof row.runner_id === "string" ? row.runner_id : "";
    if (!runnerId) continue;
    const tokenInput = positiveIntegerValue(row.token_input);
    const tokenOutput = positiveIntegerValue(row.token_output);
    const tokenCount = tokenInput + tokenOutput;
    if (tokenCount <= 0) continue;
    if (!isSaneTelemetryTokenCount(tokenInput, tokenOutput)) continue;
    telemetryTotals.set(runnerId, (telemetryTotals.get(runnerId) || 0) + tokenCount);
  }

  const totals = new Map(telemetryTotals);
  for (const [runnerId, count] of cacheTotals) {
    if (!totals.has(runnerId)) {
      totals.set(runnerId, count);
    }
  }

  const liveTotals = await aggregateLiveTokenUsage(
    path.join(boardRoot, "runners", "logs"),
    runningRunnerStartTimes(runners)
  );
  for (const [runnerId, count] of liveTotals) {
    totals.set(runnerId, (totals.get(runnerId) || 0) + count);
  }

  return totals;
}

async function enrichRunnerTerminalPreviews(runners, boardRoot) {
  const tokenUsageByRunner = await readRunnerTokenUsage(boardRoot, runners);
  return Promise.all(
    runners.map(async (runner) => {
      const conversationPreview = await runnerConversationPreview(runner, boardRoot);
      const quotaInfo = await runnerQuotaInfo({ ...runner, conversationPreview }, boardRoot);
      const authInfo = await runnerAuthInfo({ ...runner, conversationPreview }, boardRoot);
      return {
        ...runner,
        ...quotaInfo,
        ...authInfo,
        conversationPreview,
        tokenUsage: tokenUsageByRunner.get(runner.id) || 0
      };
    })
  );
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
    const stat = await fs.stat(filePath);
    const birthMs = stat.birthtimeMs && stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.ctimeMs || stat.mtimeMs;
    const eventTypeMatch = content.match(/^event_type:\s*(.+)$/im);
    return {
      filePath,
      name,
      title: markdownPreviewTitle(content, name),
      modifiedAt: stat.mtime.toISOString(),
      createdAt: new Date(birthMs).toISOString(),
      eventType: eventTypeMatch?.[1]?.trim() || "",
      acknowledged: /^-\s*\[[xX]\]\s*사람 확인 완료\s*$/m.test(content)
    };
  } catch {
    return {
      filePath,
      name: path.basename(filePath),
      title: path.basename(filePath),
      modifiedAt: "",
      createdAt: ""
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

function byName(a, b) {
  return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
}

function byMostRecent(a, b) {
  return String(b?.modifiedAt ?? "").localeCompare(String(a?.modifiedAt ?? ""));
}

// Walk a directory tree gathering absolute file paths matching `predicate`.
// Pure path discovery — never opens or reads file contents — so very large
// log directories (10k+ files, hundreds of MB) stay cheap. Callers that only
// need a top-N preview should use this helper plus `selectTopFilePaths` and
// then preview only the selected slice, instead of readFile-ing every file
// up front.
async function walkFilePaths(directory, recursive, predicate) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      out.push(...(await walkFilePaths(absolute, true, predicate)));
    } else if (entry.isFile() && predicate(entry.name, absolute)) {
      out.push(absolute);
    }
  }
  return out;
}

// Pick the top `limit` paths by mtime (descending) or basename (ascending).
// Stat all paths in parallel — much cheaper than readFile-ing them — and
// sort/slice in memory. Used to bound the readFile workload to N files even
// when the directory contains many thousands.
async function selectTopFilePaths(filePaths, { limit, orderBy = "mtime" } = {}) {
  if (!Number.isFinite(limit) || filePaths.length <= limit) {
    return filePaths;
  }

  if (orderBy === "name") {
    return [...filePaths]
      .sort((left, right) =>
        String(path.basename(left)).localeCompare(String(path.basename(right)))
      )
      .slice(0, limit);
  }

  const stats = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const stat = await fs.stat(filePath);
        return { filePath, mtimeMs: stat.mtimeMs || 0 };
      } catch {
        return { filePath, mtimeMs: 0 };
      }
    })
  );
  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return stats.slice(0, limit).map((entry) => entry.filePath);
}

async function listMarkdownFiles(directory, recursive = false, options = {}) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const paths = await walkFilePaths(directory, recursive, (name) => name.endsWith(".md"));
  const selected = await selectTopFilePaths(paths, options);
  const previews = await Promise.all(selected.map((filePath) => readMarkdownPreview(filePath)));
  return previews.sort(byName);
}

async function listTicketFolders(ticketsRoot) {
  if (!(await pathExists(ticketsRoot))) {
    return [];
  }

  const entries = await fs.readdir(ticketsRoot, { withFileTypes: true });
  const canonicalOrder = ["backlog", "inbox", "todo", "inprogress", "done", "reject", "check"];
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => {
      const leftIndex = canonicalOrder.indexOf(left);
      const rightIndex = canonicalOrder.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return String(left ?? "").localeCompare(String(right ?? ""));
    });
}

async function listTextFiles(directory, extensions, recursive = false, options = {}) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const extensionSet = new Set(extensions);
  const paths = await walkFilePaths(
    directory,
    recursive,
    (name) => extensionSet.has(path.extname(name))
  );
  const selected = await selectTopFilePaths(paths, options);
  const previews = await Promise.all(selected.map((filePath) => readTextPreview(filePath)));
  return previews.sort(byName);
}

function normalizeMetricSnapshot(rawSnapshot) {
  if (!rawSnapshot || typeof rawSnapshot !== "object") {
    return null;
  }

  const timestamp = typeof rawSnapshot.timestamp === "string" ? rawSnapshot.timestamp : "";
  if (!timestamp) {
    return null;
  }

  const snapshot = { timestamp };
  for (const key of metricSnapshotKeys) {
    const value = Number(rawSnapshot[key]);
    snapshot[key] = Number.isFinite(value) ? value : 0;
  }

  return snapshot;
}

async function readMetricsHistory(boardRoot) {
  const snapshotPath = path.join(boardRoot, "metrics", "daily.jsonl");

  try {
    const stat = await fs.stat(snapshotPath);
    if (!stat.isFile()) {
      return [];
    }

    const bytesToRead = Math.min(stat.size, metricsHistoryReadLimitBytes);
    const start = Math.max(0, stat.size - bytesToRead);
    const buffer = Buffer.alloc(bytesToRead);
    const handle = await fs.open(snapshotPath, "r");

    try {
      const { bytesRead } = await handle.read(buffer, 0, bytesToRead, start);
      let content = buffer.subarray(0, bytesRead).toString("utf8");
      if (start > 0) {
        const firstLineBreak = content.indexOf("\n");
        content = firstLineBreak >= 0 ? content.slice(firstLineBreak + 1) : "";
      }

      const snapshots = [];
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        try {
          const snapshot = normalizeMetricSnapshot(JSON.parse(trimmed));
          if (snapshot) {
            snapshots.push(snapshot);
          }
        } catch {
          // Ignore one malformed metrics line instead of dropping the whole report history.
        }
      }

      return snapshots.slice(-90);
    } finally {
      await handle.close();
    }
  } catch {
    return [];
  }
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
  if (!isSafeBoardDirName(boardDirName)) {
    return {
      ok: false,
      filePath: "",
      name: "",
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: "Invalid board directory name."
    };
  }
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

async function deleteInboxOrderFile(options = {}) {
  if (!options.projectRoot) {
    return {
      ok: false,
      filePath: "",
      name: "",
      message: "",
      stderr: "Project root is required."
    };
  }

  const filePath = options.filePath || "";
  if (!filePath) {
    return {
      ok: false,
      filePath: "",
      name: "",
      message: "",
      stderr: "File path is required."
    };
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!isSafeBoardDirName(boardDirName)) {
    return {
      ok: false,
      filePath: "",
      name: path.basename(filePath),
      message: "",
      stderr: "Invalid board directory name."
    };
  }

  const boardRoot = path.resolve(options.projectRoot, boardDirName);
  const targetPath = path.resolve(filePath);
  const relativePath = path.relative(boardRoot, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      filePath: targetPath,
      name: path.basename(targetPath),
      message: "",
      stderr: "File must be inside the Autoflow board."
    };
  }

  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const orderName = path.basename(relativePath);
  if (!normalizedRelativePath.startsWith("tickets/inbox/") || !/^order_\d+\.md$/i.test(orderName)) {
    return {
      ok: false,
      filePath: targetPath,
      name: orderName,
      message: "",
        stderr: "Only tickets/inbox/order_*.md files can be deleted."
    };
  }

  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) {
      return {
      ok: false,
      filePath: targetPath,
      name: orderName,
      message: "",
      stderr: "Path is not a file."
    };
    }
  } catch (error) {
    return {
      ok: false,
      filePath: targetPath,
      name: orderName,
      message: "",
      stderr: error.message || "Failed to read target file."
    };
  }

  try {
    await fs.unlink(targetPath);
    return {
      ok: true,
      filePath: targetPath,
      name: orderName,
      message: `${orderName} 삭제 완료.`,
      stderr: ""
    };
  } catch (error) {
    return {
      ok: false,
      filePath: targetPath,
      name: orderName,
      message: "",
      stderr: error.message || "Failed to delete target file."
    };
  }
}

async function readBoard({ projectRoot, boardDirName }) {
  const normalizedBoardDirName = boardDirName || defaultBoardDirName;
  if (!isSafeBoardDirName(normalizedBoardDirName)) {
    return {
      repoRoot,
      boardRoot: "",
      exists: false,
      stderr: "Invalid board directory name."
    };
  }
  const boardRoot = path.join(projectRoot || "", normalizedBoardDirName);
  const ticketsRoot = path.join(boardRoot, "tickets");
  const exists = await pathExists(boardRoot);
  const hostSkillsResult = exists
    ? await ensureProjectHostSkills({ projectRoot, boardDirName: normalizedBoardDirName })
    : null;

  const diagnosticTasks = [
    {
      source: "status",
      run: () => runAutoflowCachedOrRefresh("status", { projectRoot, boardDirName: normalizedBoardDirName }),
      fallback: (error) => readBoardDiagnosticErrorResult("status", { projectRoot, boardDirName: normalizedBoardDirName }, error)
    },
    {
      source: "runners",
      run: () => listRunnersCachedOrRefresh({ projectRoot, boardDirName: normalizedBoardDirName }),
      fallback: (error) => runnerListErrorResult({ projectRoot, boardDirName: normalizedBoardDirName }, error)
    },
    {
      source: "doctor",
      run: () => runAutoflowCachedOrRefresh("doctor", { projectRoot, boardDirName: normalizedBoardDirName }),
      fallback: (error) => readBoardDiagnosticErrorResult("doctor", { projectRoot, boardDirName: normalizedBoardDirName }, error)
    },
    {
      source: "metrics",
      run: () => runAutoflowCachedOrRefresh("metrics", { projectRoot, boardDirName: normalizedBoardDirName }),
      fallback: (error) => readBoardDiagnosticErrorResult("metrics", { projectRoot, boardDirName: normalizedBoardDirName }, error)
    },
    {
      source: "stop-hook-status",
      run: () => runAutoflowCachedOrRefresh("stop-hook-status", { projectRoot, boardDirName: normalizedBoardDirName }),
      fallback: (error) => readBoardDiagnosticErrorResult("stop-hook-status", { projectRoot, boardDirName: normalizedBoardDirName }, error)
    },
    {
      source: "watch-status",
      run: () => runAutoflowCachedOrRefresh("watch-status", { projectRoot, boardDirName: normalizedBoardDirName }),
      fallback: (error) => readBoardDiagnosticErrorResult("watch-status", { projectRoot, boardDirName: normalizedBoardDirName }, error)
    }
  ];
  const diagnosticResults = exists
    ? await Promise.allSettled(diagnosticTasks.map((task) => task.run()))
    : [];
  const [
    statusResult,
    runnersResult,
    doctorResult,
    metricsResult,
    stopHookResult,
    watcherResult
  ] = exists
    ? diagnosticResults.map((settled, index) => (
        settled.status === "fulfilled"
          ? settled.value
          : diagnosticTasks[index].fallback(settled.reason)
      ))
    : [null, null, null, null, null, null];
  const fallbackSources = [
    ["status", statusResult],
    ["runners", runnersResult],
    ["doctor", doctorResult],
    ["metrics", metricsResult],
    ["stop-hook-status", stopHookResult],
    ["watch-status", watcherResult]
  ].filter(([, result]) => result?.readBoardFallback);
  const readBoardMeta = {
    partial: fallbackSources.length > 0,
    fallback: fallbackSources.some(([, result]) => result?.fallback),
    stale: fallbackSources.some(([, result]) => result?.stale),
    refreshInFlight: fallbackSources.some(([, result]) => result?.refreshInFlight),
    fallbackSources: fallbackSources.map(([source, result]) => ({
      source,
      ok: result.ok !== false,
      stale: Boolean(result.stale),
      fallback: Boolean(result.fallback),
      refreshInFlight: Boolean(result.refreshInFlight),
      cacheStatus: result.cacheStatus || "",
      cancelled: Boolean(result.cancelled),
      signal: result.signal || "",
      stderr: (result.stderr || "").slice(0, 2000),
      command: result.command || ""
    }))
  };

  const ticketGroups = {};
  for (const folder of await listTicketFolders(ticketsRoot)) {
    ticketGroups[folder] = await listMarkdownFiles(path.join(ticketsRoot, folder), folder === "done");
  }

  // Each list call below caps the number of files we actually readFile() to
  // avoid a 30s IPC timeout when these directories grow large. The renderer
  // only consumes the slice limits below (e.g. 12 logs, 16 runner logs, etc.),
  // but without an internal cap the listing helper used to readFile every
  // single file just to mtime-sort them — that read 600+ MB of runner logs
  // on every readBoard call.
  const logs = await listMarkdownFiles(path.join(boardRoot, "logs"), true, {
    limit: 12,
    orderBy: "mtime"
  });
  const runnerLogs = await listTextFiles(
    path.join(boardRoot, "runners", "logs"),
    [".log"],
    true,
    { limit: 16, orderBy: "mtime" }
  );
  const wikiFiles = await listMarkdownFiles(path.join(boardRoot, "wiki"), true, {
    limit: 24,
    orderBy: "name"
  });
  const metricsFiles = await listTextFiles(
    path.join(boardRoot, "metrics"),
    [".jsonl", ".json"],
    true,
    { limit: 8, orderBy: "mtime" }
  );
  const metricsHistory = exists ? await readMetricsHistory(boardRoot) : [];
  // README.md is filtered out at the consumer slice below; bump the internal
  // cap by 1 so we still surface 24 conversations even when README is the
  // freshest file in the directory.
  const conversationFiles = await listMarkdownFiles(path.join(boardRoot, "conversations"), true, {
    limit: 25,
    orderBy: "mtime"
  });

  return {
    repoRoot,
    boardRoot,
    exists,
    partial: readBoardMeta.partial,
    fallback: readBoardMeta.fallback,
    stale: readBoardMeta.stale,
    readBoardMeta,
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
    hostSkillsResult,
    runners: runnersResult?.runners || [],
    runnersResult,
    tickets: ticketGroups,
    logs: logs
      .sort((a, b) => byMostRecent(a, b))
      .slice(0, 12),
    runnerLogs: runnerLogs
      .sort((a, b) => byMostRecent(a, b))
      .slice(0, 16),
    wikiFiles: wikiFiles
      .sort((a, b) => byName(a, b))
      .slice(0, 24),
    metricsFiles: metricsFiles
      .sort((a, b) => byMostRecent(a, b))
      .slice(0, 8),
    metricsHistory,
    conversationFiles: conversationFiles
      .filter((file) => (file?.name || "").toLowerCase() !== "readme.md")
      .sort((a, b) => byMostRecent(a, b))
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
  const boardRoot = path.join(options.projectRoot, boardDirName);
  const runners = await enrichRunnerTerminalPreviews(parsed.runners, boardRoot);

  return {
    ...result,
    values: parsed.values,
    runners
  };
}

function readBoardRunnerListCacheKey(options = {}) {
  return [
    "runners",
    options.projectRoot || "",
    options.boardDirName || defaultBoardDirName
  ].join("\0");
}

function clearReadBoardRunnerListCache(options = {}) {
  readBoardRunnerListCache.delete(readBoardRunnerListCacheKey(options));
}

function cloneRunnersResult(result) {
  if (!result) {
    return result;
  }
  return {
    ...result,
    values: result.values ? { ...result.values } : result.values,
    runners: Array.isArray(result.runners)
      ? result.runners.map((runner) => ({ ...runner }))
      : []
  };
}

function emptyRunnerListResult(options = {}, fallback = {}) {
  return {
    ok: fallback.ok === false ? false : true,
    command: commandLabel(["runners", "list", options.projectRoot || "", options.boardDirName || defaultBoardDirName]),
    code: fallback.code ?? 0,
    signal: fallback.signal || "",
    cancelled: Boolean(fallback.cancelled),
    stdout: "",
    stderr: fallback.stderr || "",
    values: {},
    runners: [],
    partial: true,
    fallback: true,
    stale: false,
    refreshInFlight: Boolean(fallback.refreshInFlight),
    cacheStatus: fallback.cacheStatus || "miss",
    readBoardFallback: true
  };
}

function markRunnerListFallback(result, fallback = {}) {
  const metadata = {
    partial: Boolean(fallback.partial || result?.ok === false || result?.cancelled),
    fallback: Boolean(fallback.fallback || result?.ok === false || result?.cancelled),
    stale: Boolean(fallback.stale),
    refreshInFlight: Boolean(fallback.refreshInFlight),
    cacheStatus: fallback.cacheStatus || "fresh"
  };
  return {
    ...result,
    ...metadata,
    readBoardFallback: metadata.fallback || metadata.partial || metadata.stale
  };
}

function runnerListErrorResult(options = {}, error, fallback = {}) {
  return emptyRunnerListResult(options, {
    ok: false,
    code: -1,
    signal: fallback.signal || "",
    cancelled: Boolean(fallback.cancelled),
    stderr: diagnosticErrorMessage(error, "readBoard diagnostic runners failed."),
    cacheStatus: fallback.cacheStatus || "error"
  });
}

function listRunnersReadBoardDiagnostic(options = {}) {
  return withReadBoardDiagnosticTimeout(
    "runners",
    (timeoutSignal) => listRunners({
      ...options,
      timeoutSignal,
      killGraceMs: autoflowChildKillGraceMs
    }),
    (error, fallback) => runnerListErrorResult(options, error, fallback)
  );
}

function startRunnerListRefresh(options, key, entry) {
  const targetEntry =
    entry || {
      result: null,
      updatedAt: 0,
      promise: null
    };

  targetEntry.promise = listRunnersReadBoardDiagnostic(options)
    .then((result) => {
      targetEntry.result = result;
      targetEntry.updatedAt = Date.now();
      return result;
    })
    .finally(() => {
      targetEntry.promise = null;
    });

  readBoardRunnerListCache.set(key, targetEntry);
  return targetEntry.promise;
}

function listRunnersCachedOrRefresh(options = {}, ttlMs = readBoardRunnerListCacheTtlMs) {
  const key = readBoardRunnerListCacheKey(options);
  const entry = readBoardRunnerListCache.get(key);
  const now = Date.now();

  if (entry?.result && now - entry.updatedAt < ttlMs) {
    return Promise.resolve(markRunnerListFallback(cloneRunnersResult(entry.result), { cacheStatus: "fresh" }));
  }

  if (entry?.result) {
    if (!entry.promise) {
      void startRunnerListRefresh(options, key, entry);
    }
    return Promise.resolve(markRunnerListFallback(cloneRunnersResult(entry.result), {
      partial: true,
      fallback: true,
      stale: true,
      refreshInFlight: true,
      cacheStatus: "stale"
    }));
  }

  if (!entry?.promise) {
    return startRunnerListRefresh(options, key, entry).then((result) =>
      markRunnerListFallback(cloneRunnersResult(result), { cacheStatus: "miss" })
    );
  }

  return entry.promise.then((result) =>
    markRunnerListFallback(cloneRunnersResult(result), {
      refreshInFlight: true,
      cacheStatus: "pending"
    })
  );
}

async function listRunnersStandalone(options = {}) {
  const key = readBoardRunnerListCacheKey(options);
  const entry = readBoardRunnerListCache.get(key);
  const now = Date.now();

  if (entry?.result && now - entry.updatedAt < standaloneRunnerListCacheTtlMs) {
    return markRunnerListFallback(cloneRunnersResult(entry.result), { cacheStatus: "fresh" });
  }

  if (entry?.promise) {
    const result = await entry.promise;
    return markRunnerListFallback(cloneRunnersResult(result), {
      refreshInFlight: true,
      cacheStatus: "pending"
    });
  }

  const result = await startRunnerListRefresh(options, key, entry);
  return markRunnerListFallback(cloneRunnersResult(result), { cacheStatus: "fresh" });
}

// Per-(projectRoot, runnerId) inflight tracker. Renderer-side parallel
// start/stop fires multiple `autoflow:controlRunner` IPC calls in flight;
// without this guard a fast double-click on the same runner could spawn
// duplicate `autoflow runners start` subprocesses or interleave start/stop
// on the same state file. Different runner ids stay parallel.
const runnerControlInflight = new Map();
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
  const lockKey = `${options.projectRoot}\0${boardDirName}\0${runnerId}`;
  const isForceStop = action === "stop" && options.force === true;
  const existing = runnerControlInflight.get(lockKey);
  if (existing && !isForceStop) {
    return existing;
  }
  const args = ["runners", action, runnerId, options.projectRoot, boardDirName];
  if (isForceStop) {
    args.push("--force");
  }
  const promise = runAutoflowArgs(
    args,
    options
  ).then((result) => {
    if (result.ok) {
      clearReadBoardRunnerListCache({ projectRoot: options.projectRoot, boardDirName });
    }
    return result;
  }).finally(() => {
    if (runnerControlInflight.get(lockKey) === promise) {
      runnerControlInflight.delete(lockKey);
    }
  });
  runnerControlInflight.set(lockKey, promise);
  return promise;
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
  return runAutoflowArgs(
    ["runners", "set", runnerId, options.projectRoot, boardDirName, ...updates],
    options
  ).then((result) => {
    const values = parseKeyValueOutput(result.stdout || "");
    if (result.ok) {
      clearReadBoardRunnerListCache({ projectRoot: options.projectRoot, boardDirName });
    }
    return {
      ...result,
      values,
      configFingerprint: values.config_fingerprint || "",
      configUpdatedAt: values.config_updated_at || values.last_event_at || ""
    };
  });
}

async function installBoard(options = {}) {
  if (!options.projectRoot) {
    return {
      ok: false,
      command: "init",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    };
  }

  const initResult = await runAutoflow("init", options);
  if (!initResult.ok) {
    return initResult;
  }

  const followUpStdout = [];
  const followUpStderr = [];

  const hookResult = await runAutoflow("install-stop-hook", options);
  followUpStdout.push(`[install-stop-hook]\n${hookResult.stdout || ""}`.trimEnd());
  if (hookResult.stderr) {
    followUpStderr.push(`[install-stop-hook]\n${hookResult.stderr}`.trimEnd());
  }

  const watcherResult = await runAutoflow("watch-bg", options);
  followUpStdout.push(`[watch-bg]\n${watcherResult.stdout || ""}`.trimEnd());
  if (watcherResult.stderr) {
    followUpStderr.push(`[watch-bg]\n${watcherResult.stderr}`.trimEnd());
  }

  return {
    ok: true,
    command: "init+install-stop-hook+watch-bg",
    code: initResult.code,
    stdout: [initResult.stdout, ...followUpStdout].filter(Boolean).join("\n\n"),
    stderr: [initResult.stderr, ...followUpStderr].filter(Boolean).join("\n\n")
  };
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
  if (action === "query") {
    const rawTerms = Array.isArray(options.terms) ? options.terms : [];
    const terms = rawTerms
      .map((term) => (typeof term === "string" ? term.trim() : ""))
      .filter((term) => term.length > 0);
    if (terms.length === 0) {
      return Promise.resolve({
        ok: false,
        command: "wiki query",
        code: -1,
        stdout: "",
        stderr: "검색어를 한 개 이상 입력하세요."
      });
    }
    for (const term of terms) {
      args.push("--term", term);
    }
    if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
      args.push("--limit", String(Math.floor(options.limit)));
    }
    if (options.includeTickets === false) {
      args.push("--no-tickets");
    }
    if (options.includeHandoffs === false) {
      args.push("--no-handoffs");
    }
    if (options.includeSnippets === false) {
      args.push("--no-snippets");
    }
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
  return runAutoflowArgs(["metrics", options.projectRoot, boardDirName, "--write"], options).then((result) => {
    clearReadBoardDiagnosticCache("metrics", { projectRoot: options.projectRoot, boardDirName });
    return result;
  });
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

function withScopeMemory(handler) {
  return (_event, options) => {
    rememberProjectScope(options);
    return handler(options || {});
  };
}

// Wrap an IPC handler so a hung underlying call (e.g. CLI subprocess that
// never exits) surfaces to the renderer as a rejection instead of leaving
// the UI frozen on a permanent loading state. Pass ms <= 0 to disable.
function withTimeout(handler, ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return handler;
  }
  return (...args) => {
    let timer;
    const controller = new AbortController();
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => {
          const error = new Error(`autoflow IPC handler timed out after ${ms}ms`);
          controller.abort(error);
          reject(error);
        },
        ms
      );
    });
    const handlerArgs = attachTimeoutSignal(args, controller.signal);
    return Promise.race([
      Promise.resolve().then(() => handler(...handlerArgs)),
      timeoutPromise
    ]).finally(() => {
      clearTimeout(timer);
    });
  };
}

function attachTimeoutSignal(args, signal) {
  if (
    args.length >= 2 &&
    args[1] &&
    typeof args[1] === "object" &&
    !Array.isArray(args[1])
  ) {
    return [
      args[0],
      {
        ...args[1],
        timeoutSignal: signal,
        killGraceMs: autoflowChildKillGraceMs
      },
      ...args.slice(2)
    ];
  }

  return args;
}

function terminateAutoflowChild(child, reason = "cancelled", graceMs = autoflowChildKillGraceMs) {
  if (!child || !Number.isInteger(child.pid) || child.pid <= 0) {
    return false;
  }

  const targets = collectProcessTree(child.pid);
  if (targets.length === 0) {
    try {
      child.kill("SIGTERM");
      return true;
    } catch {
      return false;
    }
  }

  for (const target of targets) {
    try {
      process.kill(-target, "SIGTERM");
    } catch {}
    try {
      process.kill(target, "SIGTERM");
    } catch {}
  }
  try {
    child.kill("SIGTERM");
  } catch {}

  const delay = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : autoflowChildKillGraceMs;
  setTimeout(() => {
    for (const target of collectProcessTree(child.pid)) {
      try {
        process.kill(-target, "SIGKILL");
      } catch {}
      try {
        process.kill(target, "SIGKILL");
      } catch {}
    }
  }, delay).unref();

  if (reason) {
    console.warn(`[Autoflow Desktop] terminated child pid=${child.pid} reason=${reason}`);
  }
  return true;
}

function isSafeBoardDirName(value) {
  return typeof value === "string" && safeBoardDirNamePattern.test(value);
}

function listChildPids(parentPid) {
  try {
    const { spawnSync } = require("node:child_process");
    const result = spawnSync("pgrep", ["-P", String(parentPid)], {
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (result.status !== 0 || !result.stdout) return [];
    return result.stdout
      .toString()
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function collectProcessTree(rootPid, visited = new Set()) {
  if (!Number.isInteger(rootPid) || rootPid <= 0 || visited.has(rootPid)) {
    return [];
  }
  visited.add(rootPid);
  const children = listChildPids(rootPid);
  const descendants = [];
  for (const child of children) {
    descendants.push(...collectProcessTree(child, visited));
  }
  return [...descendants, rootPid];
}

function killPidGracefully(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  const tree = collectProcessTree(pid);
  if (tree.length === 0) {
    return false;
  }

  for (const target of tree) {
    try {
      process.kill(-target, "SIGTERM");
    } catch {}
    try {
      process.kill(target, "SIGTERM");
    } catch {}
  }

  setTimeout(() => {
    for (const target of collectProcessTree(pid)) {
      try {
        process.kill(-target, "SIGKILL");
      } catch {}
      try {
        process.kill(target, "SIGKILL");
      } catch {}
    }
  }, 1500).unref();

  return true;
}

function parseRunnerStateFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

function serializeRunnerState(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n") + "\n";
}

async function readRunnerStateValues(filePath) {
  try {
    return parseRunnerStateFile(await fs.readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

function shouldSelfHealStoppedRunner(runner, stateValues) {
  return (
    runner &&
    runner.id &&
    runner.enabled === "true" &&
    runner.stateStatus === "stopped" &&
    stateValues.stopped_by !== "user"
  );
}

async function selfHealStoppedRunnersForScope(scope) {
  if (runnerShutdownInProgress) return;
  const result = await listRunnersCachedOrRefresh(scope);
  if (runnerShutdownInProgress) return;
  if (!result.ok) return;

  await Promise.all(
    result.runners.map(async (runner) => {
      const stateValues = await readRunnerStateValues(runner.statePath);
      if (!shouldSelfHealStoppedRunner(runner, stateValues)) return;
      await controlRunner({
        projectRoot: scope.projectRoot,
        boardDirName: scope.boardDirName,
        action: "start",
        runnerId: runner.id
      });
    })
  );
}

async function shutdownRunnersForScope(scope) {
  const stateDir = path.join(scope.projectRoot, scope.boardDirName, "runners", "state");
  let entries;
  try {
    entries = await fs.readdir(stateDir);
  } catch {
    return 0;
  }

  let killedCount = 0;
  await Promise.all(
    entries
      .filter((name) => name.endsWith(".state"))
      .map(async (name) => {
        const filePath = path.join(stateDir, name);
        let content;
        try {
          content = await fs.readFile(filePath, "utf8");
        } catch {
          return;
        }
        const values = parseRunnerStateFile(content);
        if (values.status !== "running") return;
        const pid = Number.parseInt(values.pid || "", 10);
        if (!Number.isInteger(pid) || pid <= 0) return;

        if (killPidGracefully(pid)) {
          killedCount += 1;
        }

        values.status = "stopped";
        values.pid = "";
        values.stopped_by = "";
        values.last_stop_reason = "parent_terminated";
        values.last_result = "loop_stopped";
        values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
        try {
          await fs.writeFile(filePath, serializeRunnerState(values), "utf8");
        } catch {}
      })
  );
  return killedCount;
}

async function shutdownAllRunners(options = {}) {
  if (runnerShutdownInProgress && !options.allowWhileInProgress) return 0;
  runnerShutdownInProgress = true;

  let total = 0;
  for (const scope of knownProjectScopes.values()) {
    try {
      total += await shutdownRunnersForScope(scope);
    } catch {}
  }

  for (const child of activeChildProcesses) {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  activeChildProcesses.clear();

  return total;
}

// Final sweep for explicit runner-stop paths: after the graceful SIGTERM
// window, any runner PID still listed as `running` in a state file gets
// force-killed (SIGKILL). Normal desktop quit skips this path unless the user
// selected the stop-on-close policy.
async function forceKillSurvivingRunners() {
  for (const scope of knownProjectScopes.values()) {
    const stateDir = path.join(scope.projectRoot, scope.boardDirName, "runners", "state");
    let entries;
    try {
      entries = await fs.readdir(stateDir);
    } catch {
      continue;
    }
    for (const name of entries.filter((value) => value.endsWith(".state"))) {
      const filePath = path.join(stateDir, name);
      let content;
      try {
        content = await fs.readFile(filePath, "utf8");
      } catch {
        continue;
      }
      const values = parseRunnerStateFile(content);
      const pid = Number.parseInt(values.pid || "", 10);
      if (!Number.isInteger(pid) || pid <= 0) continue;

      let alive = true;
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      if (!alive) continue;

      for (const target of collectProcessTree(pid)) {
        try { process.kill(-target, "SIGKILL"); } catch {}
        try { process.kill(target, "SIGKILL"); } catch {}
      }

      values.status = "stopped";
      values.pid = "";
      values.stopped_by = "";
      values.last_stop_reason = "parent_terminated";
      values.last_result = "loop_stopped";
      values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      try {
        await fs.writeFile(filePath, serializeRunnerState(values), "utf8");
      } catch {}
    }
  }
}

app.whenReady().then(() => {
  markDesktopSessionStarted();
  setupMacOsDockIcon();

  ipcMain.handle("dialog:selectProject", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return "";
    }

    return result.filePaths[0];
  });

  // Read-type handlers: bound by a 30s timeout so a hung CLI subprocess does
  // not freeze the renderer indefinitely. Action handlers (install/control/
  // run/configure/create/write) intentionally have no timeout because they
  // can legitimately run for minutes (CLI work, AI synth, etc).
  ipcMain.handle("autoflow:getConfig", withTimeout(() => appConfig(), 30000));
  ipcMain.handle("autoflow:getDesktopClosePolicy", () => desktopClosePolicyResult(readDesktopClosePolicy()));
  ipcMain.handle("autoflow:setDesktopClosePolicy", (_event, policy) =>
    desktopClosePolicyResult(writeDesktopClosePolicy(policy))
  );
  ipcMain.handle(
    "autoflow:listInstalledAgentProfiles",
    withTimeout(() => readInstalledAgentProfiles(), 30000)
  );
  ipcMain.handle("autoflow:readBoard", withTimeout(withScopeMemory(readBoard), 30000));
  ipcMain.handle("autoflow:installBoard", withScopeMemory(installBoard));
  ipcMain.handle("autoflow:listRunners", withTimeout(withScopeMemory(listRunnersStandalone), 30000));
  ipcMain.handle("autoflow:controlRunner", withScopeMemory(controlRunner));
  ipcMain.handle(
    "autoflow:listRunnerArtifacts",
    withTimeout(withScopeMemory(listRunnerArtifacts), 30000)
  );
  ipcMain.handle("autoflow:runRole", withScopeMemory(runRole));
  ipcMain.handle("autoflow:configureRunner", withScopeMemory(configureRunner));
  ipcMain.handle("autoflow:createRunner", withScopeMemory(createRunner));
  ipcMain.handle("autoflow:continueRunnerAuth", withScopeMemory(continueRunnerAuth));
  ipcMain.handle("autoflow:controlWiki", withScopeMemory(controlWiki));
  ipcMain.handle("autoflow:writeMetricsSnapshot", withScopeMemory(writeMetricsSnapshot));
  ipcMain.handle("autoflow:controlStopHook", withScopeMemory(controlStopHook));
  ipcMain.handle("autoflow:controlWatcher", withScopeMemory(controlWatcher));
  ipcMain.handle("autoflow:readBoardFile", withTimeout(withScopeMemory(readBoardFile), 30000));
  ipcMain.handle("autoflow:deleteInboxOrderFile", withScopeMemory(deleteInboxOrderFile));
  ipcMain.handle(
    "autoflow:projectExists",
    withTimeout(async (_event, projectRoot) => {
      const normalizedRoot = typeof projectRoot === "string" ? projectRoot.trim() : "";
      return { exists: await pathExists(normalizedRoot) };
    }, 5000)
  );
  // Cancel a still-running long IPC call by invocationId. No timeout: the
  // call must always be reachable so the user can recover from a hung action.
  ipcMain.handle("autoflow:cancelInvocation", (_event, invocationId) =>
    cancelInvocation(invocationId)
  );

  createWindow();
  startMemoryCeilingMonitor();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (appQuitInProgress || runnerShutdownInProgress) {
    return;
  }
  event.preventDefault();
  appQuitInProgress = true;

  if (memoryCeilingIntervalId) {
    clearInterval(memoryCeilingIntervalId);
    memoryCeilingIntervalId = null;
  }

  const closePolicy = readDesktopClosePolicy();
  if (closePolicy !== "stop") {
    markDesktopSessionClean("detached_runners_preserved");
    app.exit(0);
    return;
  }

  const shutdownTimeoutMs = 5000;
  const cleanup = shutdownAllRunners().catch(() => 0);
  const timeout = new Promise((resolve) => setTimeout(resolve, shutdownTimeoutMs));
  Promise.race([cleanup, timeout]).finally(async () => {
    try {
      await forceKillSurvivingRunners();
    } catch {}
    markDesktopSessionClean("explicit_runner_stop_policy");
    app.exit(0);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
