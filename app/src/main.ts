const { app, BrowserWindow, dialog, ipcMain, nativeImage, powerMonitor, screen: electronScreen, shell } = require("electron");
const { spawn, execFile, spawnSync } = require("node:child_process");
const nodeCrypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PtyRunnerManager } = require("./main/runner-pty-manager");

function ignoreBrokenPipe(stream) {
  if (!stream || typeof stream.on !== "function") return;
  stream.on("error", (error) => {
    if (error && error.code === "EPIPE") return;
    throw error;
  });
}

ignoreBrokenPipe(process.stdout);
ignoreBrokenPipe(process.stderr);

const repoRoot = process.env.AUTOFLOW_REPO_ROOT || (() => {
  const candidates = [
    path.resolve(__dirname, "../../.."),
    path.resolve(__dirname, "../..")
  ];
  return candidates.find((candidate) => fsSync.existsSync(path.join(candidate, "package.json"))) || candidates[0];
})();
const scaffoldManifestPath = path.join(repoRoot, "install", "manifest.toml");
const desktopRoot = path.join(repoRoot, "app");
const appIconPath = path.join(desktopRoot, "src", "renderer", "assets", "app", "app-icon.png");
const windowStateFileName = "window-state.json";
const desktopSessionStateFileName = "desktop-session-state.json";

if (process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA) {
  app.setPath("userData", process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA);
  app.setPath("sessionData", path.join(process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA, "session"));
}

const allowedCommands = new Set([
  "init",
  "status",
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
const RUNNER_RESOURCE_USAGE_MAX_CPU_PERCENT = 180;
const RUNNER_RESOURCE_USAGE_MAX_MEMORY_PERCENT = 12;
// Roles accepted by `autoflow run <role>` per app/cli/system/run-role.ts
// case statement. Active: ticket / planner / wiki (with their
// worker, plan, wiki-maintainer aliases). Legacy: todo. Merge is worker-owned;
// merge / merge-bot are compatibility aliases for existing desktop configs.
// PRD authoring: spec.
const allowedRunRoles = new Set([
  "ticket", "worker",
  "planner", "plan",
  "spec", "prd-author",
  "verifier",
  "wiki", "wiki-maintainer",
  "todo",
  "merge", "merge-bot"
]);
// Active: worker / planner / verifier / wiki-maintainer (with plan / wiki
// aliases). Legacy/back-compat: todo, watcher. Coordinator is idle/noop
// compatibility only. Merge is handled by worker; legacy merge / merge-bot
// config values normalize to worker but are not offered for new desktop runners.
// Mirrors runner role validation in app/cli/system/runners.ts.
const allowedRunnerRoles = new Set([
  "worker", "ticket",
  "planner", "plan",
  "verifier",
  "wiki-maintainer", "wiki",
  "todo",
  "watcher"
]);
const allowedRunnerConfigKeys = new Set([
  "agent",
  "codex_history",
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
  /Error authenticating:.*listen EPERM/i,
  /\blisten EPERM\b.*\b0\.0\.0\.0\b/i,
  /\badapter_auth_required\b/i,
  /Opening authentication page in your browser/i,
  /Attempting to open authentication page in your browser/i,
  /\bmust specify the GEMINI_API_KEY\b/i,
  /\bGEMINI_API_KEY\b.*\b(GOOGLE_GENAI_USE_VERTEXAI|GOOGLE_GENAI_USE_GCA)\b/i,
  /\bsign in required\b/i,
  /로그인(?:이)? 필요/i
];
const claudeSubscriptionDisabledPattern =
  /organization has disabled Claude subscription access|Claude subscription access.*disabled|Use an Anthropic API key instead/i;
const authUrlPattern = /https?:\/\/[^\s<>"'`)\]]+/gi;
const agentDisplayLabels = {
  codex: "Codex",
  claude: "Claude",
  gemini: "Gemini"
};
const codexRunnerHistoryModes = new Set(["isolated", "shared"]);
const metricSnapshotKeys = [
  "ticket_total",
  "spec_total",
  "ticket_done_count",
  "active_ticket_count",
  "retry_order_count",
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
  "autoflow_token_usage_1h_count",
  "autoflow_token_usage_24h_count",
  "autoflow_token_input_1h_count",
  "autoflow_token_output_1h_count",
  "autoflow_token_cache_1h_count",
  "autoflow_token_input_24h_count",
  "autoflow_token_output_24h_count",
  "autoflow_token_cache_24h_count",
  "autoflow_token_runner_breakdown_24h_json",
  "autoflow_token_model_breakdown_24h_json",
  "autoflow_runner_status_24h_json",
  "autoflow_code_net_delta_count",
  "autoflow_commit_count_24h",
  "autoflow_commit_auto_count_24h",
  "autoflow_commit_manual_count_24h",
  "autoflow_commit_recent_subjects_json",
  "autoflow_code_daily_buckets_14d_json",
  "autoflow_code_dir_breakdown_json",
  "autoflow_commit_daily_buckets_14d_json",
  "autoflow_token_hourly_24h_json",
  "autoflow_runner_tick_timeline_24h_json",
  "autoflow_runner_avg_tick_seconds_json",
  "completion_rate_percent"
];

const metricSnapshotStringKeys = new Set([
  "autoflow_token_runner_breakdown_24h_json",
  "autoflow_token_model_breakdown_24h_json",
  "autoflow_runner_status_24h_json",
  "autoflow_commit_recent_subjects_json",
  "autoflow_code_daily_buckets_14d_json",
  "autoflow_code_dir_breakdown_json",
  "autoflow_commit_daily_buckets_14d_json",
  "autoflow_token_hourly_24h_json",
  "autoflow_runner_tick_timeline_24h_json",
  "autoflow_runner_avg_tick_seconds_json",
  "project_root",
  "board_root"
]);

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

function readRunnerConfigBlock(projectRoot, boardDirName, runnerId) {
  if (!projectRoot || !runnerId) return {};
  const configPath = (() => {
    const local = path.join(projectRoot, boardDirName || defaultBoardDirName, "runners", "config.local.toml");
    const base = path.join(projectRoot, boardDirName || defaultBoardDirName, "runners", "config.toml");
    return fsSync.existsSync(local) ? local : base;
  })();
  let text = "";
  try {
    text = fsSync.readFileSync(configPath, "utf8");
  } catch {
    return {};
  }
  const blocks = text.split(/\[\[runners\]\]/).slice(1);
  for (const block of blocks) {
    const values = {};
    for (const rawLine of block.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!match) continue;
      values[match[1]] = parseTomlStringValue(match[2]);
    }
    if (values.id === runnerId) {
      return values;
    }
  }
  return {};
}

function inferRunnerRoleFromId(runnerId) {
  const id = String(runnerId || "").toLowerCase();
  if (id === "worker" || id.startsWith("worker-")) return "worker";
  if (id === "wiki" || id.startsWith("wiki-")) return "wiki-maintainer";
  if (id === "verifier" || id.startsWith("verifier-")) return "verifier";
  return "planner";
}

function safeCodexHomeSegment(value, fallback = "runner") {
  const cleaned = String(value || "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 64) || fallback;
}

function shortHash(value, length = 12) {
  return nodeCrypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function normalizeCodexHistoryMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return codexRunnerHistoryModes.has(mode) ? mode : "isolated";
}

function defaultCodexHomePath() {
  const fromEnv = String(process.env.CODEX_HOME || "").trim();
  return fromEnv || path.join(os.homedir(), ".codex");
}

function copyCodexHomeFileIfFresh(sourceHome, targetHome, fileName, required = false) {
  const source = path.join(sourceHome, fileName);
  const target = path.join(targetHome, fileName);
  try {
    const sourceStat = fsSync.statSync(source);
    if (!sourceStat.isFile()) return !required;
    let shouldCopy = true;
    try {
      const targetStat = fsSync.statSync(target);
      shouldCopy = sourceStat.mtimeMs > targetStat.mtimeMs;
    } catch {
      shouldCopy = true;
    }
    if (shouldCopy) {
      fsSync.copyFileSync(source, target);
      try { fsSync.chmodSync(target, 0o600); } catch {}
    }
    return true;
  } catch {
    return !required;
  }
}

function ensureCodexRunnerHome({ projectRoot, boardDirName, runnerId }) {
  const sourceHome = defaultCodexHomePath();
  const projectSlug = safeCodexHomeSegment(path.basename(projectRoot || "project"), "project");
  const scopeHash = shortHash(`${path.resolve(projectRoot || "")}\0${boardDirName || defaultBoardDirName}`);
  const targetHome = path.join(
    app.getPath("userData"),
    "codex-runners",
    `${projectSlug}-${scopeHash}`,
    safeCodexHomeSegment(runnerId, "runner")
  );
  fsSync.mkdirSync(targetHome, { recursive: true, mode: 0o700 });
  try { fsSync.chmodSync(targetHome, 0o700); } catch {}

  const authOk = copyCodexHomeFileIfFresh(sourceHome, targetHome, "auth.json", true);
  copyCodexHomeFileIfFresh(sourceHome, targetHome, "config.toml");
  copyCodexHomeFileIfFresh(sourceHome, targetHome, "hooks.json");

  return { codexHome: targetHome, authOk, sourceHome };
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

function parseTomlManifestScalar(rawValue) {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  return parseTomlStringValue(value);
}

function readScaffoldManifestSourceEntries() {
  const entries = [];
  try {
    const content = fsSync.readFileSync(scaffoldManifestPath, "utf8");
    const sections = new Map();
    let currentSection = "";

    for (const rawLine of content.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) {
        continue;
      }

      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        if (!sections.has(currentSection)) {
          sections.set(currentSection, {});
        }
        continue;
      }

      if (!currentSection) {
        continue;
      }

      const valueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (valueMatch) {
        const section = sections.get(currentSection) || {};
        section[valueMatch[1]] = parseTomlManifestScalar(valueMatch[2]);
        sections.set(currentSection, section);
      }
    }

    for (const [section, values] of sections) {
      if (!section.startsWith("sources.")) {
        continue;
      }
      const sourcePath = typeof values.path === "string" ? values.path : "";
      const target = typeof values.target === "string" ? values.target : "";
      const type = typeof values.type === "string" ? values.type : "";
      if (!sourcePath || !target || !type) {
        continue;
      }
      entries.push({
        id: section.slice("sources.".length),
        path: sourcePath,
        target,
        type,
        template: typeof values.template === "boolean" ? values.template : type === "host"
      });
    }
  } catch {
    return [];
  }
  return entries;
}

const defaultBoardDirName = scaffoldManifestValue("install", "default_board_dir", ".autoflow");

function normalizePtyProjectRoot(value) {
  const raw = String(value || "");
  return raw ? path.resolve(raw) : "";
}

function normalizePtyBoardDirName(value) {
  return String(value || defaultBoardDirName);
}

function ptyScopeMatches(projectRoot, boardDirName, scope = {}) {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (!requestedProjectRoot) return true;
  return (
    normalizePtyProjectRoot(projectRoot) === requestedProjectRoot &&
    normalizePtyBoardDirName(boardDirName) === normalizePtyBoardDirName(scope.boardDirName)
  );
}
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
// scopeKey → { watchers: FSWatcher[], debounceTimer, lastReason }
const boardWatchersByScope = new Map();
const boardWatchDebounceMs = 250;
const activeChildProcesses = new Set();
// invocationId → child process. Lets the renderer cancel a long-running
// CLI call (runRole / controlWiki --synth / installBoard / etc.) by id.
const cancellableInvocations = new Map();
const agentAuthStatusCache = new Map();
const runnerAuthProcesses = new Map();
let runnerShutdownInProgress = false;
let appQuitInProgress = false;
const DEFAULT_MEMORY_CEILING_MB = 1500;
const DEFAULT_MEMORY_CHECK_INTERVAL_SECONDS = 30;
const DEFAULT_MEMORY_RESTART_COOLDOWN_SECONDS = 300;
const DEFAULT_WAKE_STALE_THRESHOLD_SECONDS = 600;
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

function readWakeStaleThresholdSeconds() {
  return parsePositiveIntegerOrDefault(
    process.env.AUTOFLOW_WAKE_STALE_THRESHOLD_SECONDS,
    DEFAULT_WAKE_STALE_THRESHOLD_SECONDS
  );
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
    defaultProjectRoot: process.env.AUTOFLOW_DESKTOP_DEFAULT_PROJECT_ROOT || "",
    blockedProjectRoots: [repoRoot],
    defaultBoardDirName
  };
}

function sameResolvedPath(left, right) {
  const normalize = (value) => path.resolve(String(value || "")).replace(/[\\/]+$/, "");
  return normalize(left) === normalize(right);
}

function isPathInside(rootPath, targetPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function resolveExistingPathInside(rootPath, targetPath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);
  if (!isPathInside(resolvedRoot, resolvedTarget)) {
    return {
      ok: false,
      targetPath: resolvedTarget,
      relativePath,
      stderr: "File must be inside the Autoflow board."
    };
  }
  try {
    const [realRoot, realTarget] = await Promise.all([
      fs.realpath(resolvedRoot),
      fs.realpath(resolvedTarget)
    ]);
    if (!isPathInside(realRoot, realTarget)) {
      return {
        ok: false,
        targetPath: resolvedTarget,
        relativePath,
        stderr: "File must be inside the Autoflow board."
      };
    }
    return { ok: true, targetPath: resolvedTarget, relativePath, stderr: "" };
  } catch (error) {
    return {
      ok: false,
      targetPath: resolvedTarget,
      relativePath,
      stderr: error && error.message ? error.message : String(error)
    };
  }
}

function desktopSessionStatePath() {
  return path.join(app.getPath("userData"), desktopSessionStateFileName);
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

function markDesktopSessionStarted() {
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

// PTY spawn PID registry — records every shell PID we spawn during this
// desktop session so a subsequent crash leaves us a precise list to reap on
// next boot. Lives in userData (same dir as desktop-session-state.json) so it
// survives process death.
function ptySessionPidsPath() {
  return path.join(app.getPath("userData"), "active-pty-pids.json");
}

function readPtySessionPids() {
  const data = readJsonFileSync(ptySessionPidsPath());
  if (!data || !Array.isArray(data.pids)) return [];
  return data.pids.filter((entry) => entry && Number.isInteger(entry.pid) && entry.pid > 0);
}

function writePtySessionPids(pids) {
  writeJsonFileSync(ptySessionPidsPath(), {
    pids,
    updatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z")
  });
}

function addPtySessionPid(entry) {
  if (!entry || !Number.isInteger(entry.pid) || entry.pid <= 0) return;
  const current = readPtySessionPids().filter((e) => e.pid !== entry.pid);
  current.push({
    pid: entry.pid,
    runnerId: String(entry.runnerId || ""),
    role: String(entry.role || ""),
    agent: String(entry.agent || ""),
    spawnedAt: entry.spawnedAt || new Date().toISOString().replace(/\.\d+Z$/, "Z")
  });
  writePtySessionPids(current);
}

function removePtySessionPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  const remaining = readPtySessionPids().filter((e) => e.pid !== pid);
  writePtySessionPids(remaining);
}

function clearPtySessionPids() {
  writePtySessionPids([]);
}

// Startup reaper for PTY-side survivors. Reads the precise PID list written
// during the previous desktop session and kills any that are still alive.
// More targeted than the ps-based legacy reaper — covers the case where the
// desktop crashed while node-pty children were still attached.
function reapPreviousPtySessionPids() {
  if (process.platform === "win32") return 0;
  const survivors = readPtySessionPids();
  if (survivors.length === 0) return 0;
  let killed = 0;
  console.log(`[startup-reaper] previous session left ${survivors.length} PTY pid(s)`);
  for (const { pid, runnerId, agent } of survivors) {
    try { process.kill(pid, 0); } catch {
      // already dead — skip
      continue;
    }
    console.log(`[startup-reaper]   killing pty pid=${pid} runnerId=${runnerId} agent=${agent}`);
    try { process.kill(-pid, "SIGTERM"); } catch {}
    try { process.kill(pid, "SIGTERM"); } catch {}
    killed += 1;
  }
  if (killed > 0) {
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const stillAlive = survivors.filter(({ pid }) => {
        try { process.kill(pid, 0); return true; } catch { return false; }
      });
      if (stillAlive.length === 0) break;
      const waitUntil = Date.now() + 100;
      while (Date.now() < waitUntil) {}
    }
    for (const { pid } of survivors) {
      try { process.kill(pid, 0); } catch { continue; }
      try { process.kill(-pid, "SIGKILL"); } catch {}
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  }
  // Always clear — entries are stale at this point regardless of kill outcome.
  clearPtySessionPids();
  return killed;
}

// Per-runner metadata captured at spawn time so fs.watch can route wake
// prompts and main can update the runner state file on lifecycle events.
//   runnerId -> { role, agent, projectRoot, boardDirName, startedAt }
const ptyRunnerMeta = new Map();

function ptyRunnerMatchesRequestedScope(ptyManager, runnerId, scope = {}) {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (!requestedProjectRoot) return true;
  const meta = ptyRunnerMeta.get(runnerId);
  if (meta) {
    return ptyScopeMatches(meta.projectRoot, meta.boardDirName, scope);
  }
  const runner = ptyManager && typeof ptyManager.get === "function" ? ptyManager.get(runnerId) : null;
  if (runner && runner.cwd) {
    return normalizePtyProjectRoot(runner.cwd) === requestedProjectRoot;
  }
  return false;
}

function ptyRunnerScopedPayload(runnerId, payload = {}) {
  const meta = ptyRunnerMeta.get(runnerId);
  return {
    ...payload,
    runnerId,
    projectRoot: meta?.projectRoot || "",
    boardDirName: meta?.boardDirName || defaultBoardDirName
  };
}

function stopPtyRunnersForScope(scope = {}, opts = {}) {
  const ptyManager = globalThis.__autoflowPtyManager;
  if (!ptyManager || typeof ptyManager.list !== "function" || typeof ptyManager.stop !== "function") {
    return [];
  }

  const forceKillRunnerPid = (runner) => {
    if (!opts.force || !Number.isInteger(runner?.pid) || runner.pid <= 0) {
      return;
    }
    // Kill the PTY process tree before closing the pty object. If the shell is
    // killed first, child CLIs can be reparented and disappear from our tree walk.
    killPidForcefully(runner.pid);
    removePtySessionPid(runner.pid);
  };

  const stoppedRunnerIds = new Set();
  for (const [runnerId, meta] of ptyRunnerMeta.entries()) {
    if (!ptyScopeMatches(meta.projectRoot, meta.boardDirName, scope)) continue;
    const runner = typeof ptyManager.get === "function" ? ptyManager.get(runnerId) : null;
    forceKillRunnerPid(runner);
    if (ptyManager.stop(runnerId, { force: Boolean(opts.force) })) {
      stoppedRunnerIds.add(runnerId);
    }
  }

  for (const runner of ptyManager.list()) {
    if (!runner || stoppedRunnerIds.has(runner.id)) continue;
    if (runner.status !== "running") continue;
    if (!ptyRunnerMatchesRequestedScope(ptyManager, runner.id, scope)) continue;
    forceKillRunnerPid(runner);
    if (ptyManager.stop(runner.id, { force: Boolean(opts.force) })) {
      stoppedRunnerIds.add(runner.id);
    }
  }

  return Array.from(stoppedRunnerIds);
}
// runnerId -> incremental parser state for machine-readable usage events that
// appear in the current PTY stream. This watches only live runner output, never
// local session history files.
const ptyTokenUsageParseState = new Map();
// Per-runner safety-poll state: idle detection + queue fingerprint cache.
//   runnerId -> { lastWakeAt: number (ms epoch), queueFingerprint: string }
const wakePollState = new Map();

// Safety poller handles per scope key — prevents duplicate setIntervals.
const wakeSafetyPollers = new Map();

function migrateLegacyTicketQueueSync(boardRoot, fromName, toName) {
  try {
    const ticketsRoot = path.join(boardRoot, "tickets");
    const fromDir = path.join(ticketsRoot, fromName);
    const toDir = path.join(ticketsRoot, toName);
    if (!fsSync.existsSync(fromDir)) return;
    fsSync.mkdirSync(toDir, { recursive: true });
    for (const name of fsSync.readdirSync(fromDir)) {
      const from = path.join(fromDir, name);
      const to = path.join(toDir, name);
      let stat;
      try {
        stat = fsSync.statSync(from);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      if (fsSync.existsSync(to)) {
        if (name === ".gitkeep") fsSync.rmSync(from, { force: true });
        continue;
      }
      fsSync.renameSync(from, to);
    }
    try {
      fsSync.rmdirSync(fromDir);
    } catch {
      // Leave unresolved legacy conflicts visible rather than deleting evidence.
    }
  } catch {
    // best-effort migration; callers still inspect both legacy and current dirs.
  }
}

function migrateLegacyTicketQueuesSync(boardRoot) {
  migrateLegacyTicketQueueSync(boardRoot, "inbox", "order");
  migrateLegacyTicketQueueSync(boardRoot, "backlog", "prd");
}

function listQueueFilesSync(boardRoot, relDir, pattern, limit = 100) {
  const full = path.join(boardRoot, relDir);
  if (!fsSync.existsSync(full)) return [];
  try {
    return fsSync.readdirSync(full)
      .filter((name) => pattern.test(name))
      .map((name) => path.join(full, name))
      .filter((filePath) => {
        try {
          return fsSync.statSync(filePath).isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function plannerRecoveryFilesSync(boardRoot) {
  const candidates = [
    ...listQueueFilesSync(boardRoot, "tickets/todo", /^(Todo-\d+|tickets_\d+)\.md$/),
    ...listQueueFilesSync(boardRoot, "tickets/inprogress", /^(Todo-\d+|tickets_\d+|plan_\d+)\.md$/),
  ];
  return candidates.filter((filePath) => {
    let text = "";
    try {
      text = fsSync.readFileSync(filePath, "utf8");
    } catch {
      return false;
    }
    if (!/## Recovery State/i.test(text)) return false;
    const status = text.match(/^-\s*Status:\s*(.*?)\s*$/mi)?.[1]?.trim().toLowerCase() || "";
    if (status && !["clear", "cleared", "none", "resolved", "idle", "ok"].includes(status)) return true;
    return /Failure Class:|Planner Decision:|Worker Resume Instruction:/i.test(text);
  });
}

function walkMarkdownFilesSync(dir) {
  const out = [];
  const visit = (current) => {
    let entries = [];
    try {
      entries = fsSync.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(filePath);
      }
    }
  };
  visit(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

function computeWikiSourceHashSync(boardRoot) {
  const files = [
    ...walkMarkdownFilesSync(path.join(boardRoot, "wiki")),
    ...walkMarkdownFilesSync(path.join(boardRoot, "tickets", "done")),
  ].sort((a, b) => a.localeCompare(b));
  const hash = nodeCrypto.createHash("sha256");
  for (const filePath of files) {
    try {
      const text = fsSync.readFileSync(filePath, "utf8");
      if (!text.trim()) continue;
      const relPath = path.relative(boardRoot, filePath);
      const contentSha = nodeCrypto.createHash("sha256").update(text).digest("hex");
      hash.update(relPath).update("\0").update(contentSha).update("\0");
    } catch {}
  }
  return { hash: hash.digest("hex"), count: files.length };
}

function readWikiIndexSourceHashSync(boardRoot) {
  const dbPath = path.join(boardRoot, "runners", "state", "wiki-search.db");
  if (!fsSync.existsSync(dbPath)) return "";
  try {
    const result = spawnSync("sqlite3", [dbPath, "SELECT value FROM wiki_index_meta WHERE key='source_hash' LIMIT 1;"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return result.status === 0 ? String(result.stdout || "").trim() : "";
  } catch {
    return "";
  }
}

function wikiHasPendingWorkSync(boardRoot) {
  const current = computeWikiSourceHashSync(boardRoot);
  const indexed = readWikiIndexSourceHashSync(boardRoot);
  return current.count > 0 && (!indexed || indexed !== current.hash);
}

// Return true if the role has actionable work in its queue directories.
function queueHasPendingWork(role, boardRoot) {
  try {
    migrateLegacyTicketQueuesSync(boardRoot);
    if (role === "planner") {
      return (
        listQueueFilesSync(boardRoot, "tickets/order", /^order_.*\.md$/).length > 0 ||
        listQueueFilesSync(boardRoot, "tickets/prd", /^(prd|project)_\d+\.md$/).length > 0 ||
        listQueueFilesSync(boardRoot, "tickets/inbox", /^order_.*\.md$/).length > 0 ||
        listQueueFilesSync(boardRoot, "tickets/backlog", /^(prd|project)_.*\.md$/).length > 0 ||
        plannerRecoveryFilesSync(boardRoot).length > 0
      );
    }
    if (role === "worker") {
      return (
        listQueueFilesSync(boardRoot, "tickets/inprogress", /^(Todo-\d+|tickets_\d+)\.md$/).length > 0 ||
        listQueueFilesSync(boardRoot, "tickets/ready-to-merge", /^(Todo-\d+|tickets_\d+)\.md$/).length > 0 ||
        listQueueFilesSync(boardRoot, "tickets/todo", /^(Todo-\d+|tickets_\d+)\.md$/).length > 0
      );
    }
    if (role === "verifier") {
      return listQueueFilesSync(boardRoot, "tickets/verifier", /^(Todo-\d+|tickets_\d+)\.md$/).length > 0;
    }
    if (role === "wiki-maintainer") {
      return wikiHasPendingWorkSync(boardRoot);
    }
  } catch {
    // best-effort; return true to avoid suppressing wakes on errors
    return true;
  }
  return false;
}

// Compute a 12-char SHA256 fingerprint of queue file names + mtimes for a role.
function computeQueueFingerprint(role, boardRoot) {
  const dirs = [];
  if (role === "planner") {
    migrateLegacyTicketQueuesSync(boardRoot);
    dirs.push("tickets/order", "tickets/prd", "tickets/inbox", "tickets/backlog");
  } else if (role === "worker") {
    dirs.push("tickets/inprogress", "tickets/todo");
  } else if (role === "verifier") {
    dirs.push("tickets/verifier");
  } else if (role === "wiki-maintainer") {
    return computeWikiSourceHashSync(boardRoot).hash.slice(0, 12);
  }
  const parts = [];
  for (const dir of dirs) {
    const full = path.join(boardRoot, dir);
    if (!fsSync.existsSync(full)) continue;
    try {
      for (const f of fsSync.readdirSync(full).sort()) {
        try {
          const st = fsSync.statSync(path.join(full, f));
          parts.push(`${dir}/${f}:${st.mtimeMs}`);
        } catch {}
      }
    } catch {}
  }
  return nodeCrypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

// Append a JSONL entry to the wake-poll log (best-effort, non-blocking).
function appendWakePollLog(boardRoot, entry) {
  try {
    const logDir = path.join(boardRoot, "runners", "logs");
    fsSync.mkdirSync(logDir, { recursive: true });
    const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n";
    fsSync.appendFileSync(path.join(logDir, "wake-poll.log"), line, "utf8");
  } catch {}
}

// Append a key-value event line to <runner>.log (matches shell runner_append_log format).
function appendRunnerLog(boardRoot, runnerId, fields) {
  try {
    const logDir = path.join(boardRoot, "runners", "logs");
    fsSync.mkdirSync(logDir, { recursive: true });
    const ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const kv = Object.entries(fields || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    fsSync.appendFileSync(
      path.join(logDir, `${runnerId}.log`),
      `timestamp=${ts} ${kv}\n`,
      "utf8"
    );
  } catch {}
}

// Generate (or refresh) a sticky-context.md file from the current inprogress
// ticket. Extracts Allowed Paths, Done When, and Acceptance Probe sections.
// Written to .autoflow/runners/state/<runnerId>-sticky-context.md.
// Env knob: AUTOFLOW_CONTEXT_RESET_STICKY (default 1 = enabled)
function generateStickyContext(boardRoot, runnerId, ticketPath) {
  const stickyEnabled = (process.env.AUTOFLOW_CONTEXT_RESET_STICKY ?? "1") !== "0";
  if (!stickyEnabled) return;
  try {
    const raw = fsSync.readFileSync(ticketPath, "utf8");
    const sections = {};
    const sectionRe = /^## (.+)$/gm;
    let match;
    const positions = [];
    while ((match = sectionRe.exec(raw)) !== null) {
      positions.push({ name: match[1].trim(), start: match.index + match[0].length });
    }
    for (let i = 0; i < positions.length; i++) {
      const end = i + 1 < positions.length ? positions[i + 1].start - positions[i + 1].name.length - 4 : raw.length;
      sections[positions[i].name] = raw.slice(positions[i].start, end).trim();
    }
    const parts = [];
    const ticketId = path.basename(ticketPath, ".md");
    parts.push(`# Sticky Context — ${ticketId}`);
    parts.push(`# (auto-generated at claim — re-injected after /compact or /clear)`);
    parts.push("");
    for (const key of ["Allowed Paths", "Done When", "Acceptance Probe"]) {
      if (sections[key]) {
        parts.push(`## ${key}`);
        parts.push(sections[key]);
        parts.push("");
      }
    }
    const outPath = path.join(boardRoot, "runners", "state", `${runnerId}-sticky-context.md`);
    fsSync.mkdirSync(path.dirname(outPath), { recursive: true });
    fsSync.writeFileSync(outPath, parts.join("\n"), "utf8");
  } catch {}
}

// Inject a context reset slash command into a PTY runner after ticket pass.
// Reads cumulative_tokens from the runner state file to decide compact vs clear.
// Env knobs:
//   AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS   (default 1 = enabled)
//   AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD   (default 100000)
//   AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK  (default 1)
//   AUTOFLOW_CONTEXT_RESET_STICKY            (default 1 = inject sticky prelude after reset)
function scheduleContextReset(runnerId, meta) {
  const enabled = (process.env.AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS ?? "1") !== "0";
  if (!enabled) return;
  const threshold = Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD || "100000", 10);
  const respawnFallback = (process.env.AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK ?? "1") !== "0";
  const boardRoot = path.join(meta.projectRoot, meta.boardDirName);
  // Delay so the LLM's current turn can finish printing before we inject.
  setTimeout(() => {
    const mgr = globalThis.__autoflowPtyManager;
    if (!mgr) return;
    const runner = mgr.get(runnerId);
    if (!runner || runner.status !== "running") return;
    // Read cumulative_tokens from state file to decide mode.
    let cumulativeTokens = 0;
    try {
      const statePath = path.join(boardRoot, "runners", "state", `${runnerId}.state`);
      const raw = fsSync.readFileSync(statePath, "utf8");
      const m = raw.match(/(?:^|\n)cumulative_tokens=(\d+)/);
      if (m) cumulativeTokens = Number.parseInt(m[1], 10) || 0;
    } catch {}
    const mode = cumulativeTokens >= threshold ? "clear" : "compact";
    const injected = mgr.injectContextReset(runnerId, mode);
    if (!injected) return;
    appendRunnerLog(boardRoot, runnerId, {
      event: "context_reset",
      runner_id: runnerId,
      mode,
      trigger: "ticket_pass",
      cumulative_before: cumulativeTokens,
      threshold,
    });
    // Follow up with [wake] fresh-start so the LLM knows to pick up next work.
    const paste = (meta.agent || "").toLowerCase() === "claude" ? "bracketed" : "plain";
    setTimeout(() => {
      if (mgr.get(runnerId)?.status !== "running") return;
      mgr.writePrompt(runnerId, "[wake] fresh-start", { paste });
      updateWakeActivity(runnerId);
      // Inject sticky prelude so Allowed Paths / Done When survive /compact or /clear.
      const stickyEnabled = (process.env.AUTOFLOW_CONTEXT_RESET_STICKY ?? "1") !== "0";
      if (stickyEnabled) {
        try {
          const stickyPath = path.join(boardRoot, "runners", "state", `${runnerId}-sticky-context.md`);
          const stickyContent = fsSync.readFileSync(stickyPath, "utf8").trim();
          if (stickyContent) {
            setTimeout(() => {
              if (mgr.get(runnerId)?.status !== "running") return;
              mgr.writePrompt(runnerId, `[sticky-context]\n${stickyContent}`, { paste });
            }, 1000);
            appendRunnerLog(boardRoot, runnerId, {
              event: "context_reset_sticky_inject",
              runner_id: runnerId,
              sticky_path: stickyPath,
            });
          }
        } catch {}
      }
    }, 2000);
    // Respawn fallback: if PTY shows no output 30 s after inject, respawn.
    if (respawnFallback) {
      const beforeData = runner.lastDataAt;
      setTimeout(() => {
        const r = mgr.get(runnerId);
        if (!r || r.status !== "running") return;
        if (r.lastDataAt === beforeData) {
          // No data since inject — respawn so the agent isn't stuck.
          mgr.stop(runnerId, { force: false });
        }
      }, 30000);
    }
  }, 3000);
}

// Record that a wake was just sent to a runner (resets idle clock).
function updateWakeActivity(runnerId) {
  const s = wakePollState.get(runnerId) || {};
  s.lastWakeAt = Date.now();
  wakePollState.set(runnerId, s);
}

// Map a board-relative change path to the role that owns it.
//   tickets/order/  / tickets/prd/      -> planner
//   legacy tickets/inbox/ / tickets/backlog/ -> planner migration fallback
//   tickets/todo/                       -> worker
//   tickets/verifier/                   -> verifier
//   tickets/done/   / wiki/             -> wiki-maintainer
function rolesForBoardChange(relPath) {
  const p = String(relPath || "");
  if (!p) return [];
  if (
    p.startsWith("tickets/order/") ||
    p.startsWith("tickets/prd/") ||
    p.startsWith("tickets/inbox/") ||
    p.startsWith("tickets/backlog/")
  ) {
    return ["planner"];
  }
  if (p.startsWith("tickets/todo/") || p.startsWith("tickets/inprogress/")) {
    return ["worker"];
  }
  if (p.startsWith("tickets/verifier/")) {
    return ["verifier"];
  }
  if (p.startsWith("tickets/done/") || p.startsWith("wiki/")) {
    return ["wiki-maintainer"];
  }
  return [];
}

function emitRunnerWakeEvent(scope, runnerId, boardRoot, reason, kind = "fs.watch") {
  const projectRoot = scope?.projectRoot || "";
  const boardDirName = scope?.boardDirName || defaultBoardDirName;
  const autoflowBin = path.join(repoRoot, "app", "bin", "autoflow");
  if (!projectRoot || !runnerId || !fsSync.existsSync(autoflowBin)) {
    return;
  }
  try {
    require("node:child_process").spawn(
      autoflowBin,
      ["tool", "runner-wake", "emit", "--runner", runnerId, "--reason", String(reason), "--kind", kind],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          AUTOFLOW_PROJECT_ROOT: projectRoot,
          PROJECT_ROOT: projectRoot,
          AUTOFLOW_BOARD_ROOT: boardRoot,
          BOARD_ROOT: boardRoot,
          AUTOFLOW_BOARD_DIR_NAME: boardDirName
        },
        stdio: "ignore",
        detached: true
      }
    ).unref();
  } catch {}
}

function markRunnerInitialPromptSent(runnerId) {
  const meta = ptyRunnerMeta.get(runnerId);
  if (!meta) return;
  meta.initialPromptSentAt = new Date().toISOString();
}

function runnerInitialPromptWasSent(meta) {
  const sentAt = Date.parse(String(meta?.initialPromptSentAt || ""));
  return Number.isFinite(sentAt) && sentAt > 0;
}

function sendRunnerWake({ mgr, runnerId, meta, scope, boardRoot, reason, kind = "fs.watch", prompt = true }) {
  const paste = meta.agent === "claude" ? "bracketed" : "plain";
  let promptOk = false;
  const canPrompt = prompt && kind !== "safety-poll" && runnerInitialPromptWasSent(meta);
  try {
    if (canPrompt) {
      promptOk = Boolean(mgr?.writePrompt(runnerId, `[wake] ${reason}`, { paste }));
    }
  } catch {}
  emitRunnerWakeEvent(scope, runnerId, boardRoot, reason, kind);
  updateWakeActivity(runnerId);
  return promptOk;
}

// Persist a minimal state file so the renderer's existing UI (slider /
// badges / activity card) keeps working while PTY runner state is the source
// of truth.
async function writePtyRunnerStateFile(runnerId, fields) {
  try {
    const meta = ptyRunnerMeta.get(runnerId);
    if (!meta) return;
    const stateDir = path.join(meta.projectRoot, meta.boardDirName, "runners", "state");
    await fs.mkdir(stateDir, { recursive: true });
    const statePath = path.join(stateDir, `${runnerId}.state`);
    let existing = "";
    try { existing = await fs.readFile(statePath, "utf8"); } catch {}
    const lines = new Map();
    for (const line of existing.split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      lines.set(line.slice(0, eq), line.slice(eq + 1));
    }
    // Defensive merge — when the existing file is missing the core spawn
    // identity fields (race against token watcher's first publish, sleep/wake
    // wipes, manual edits) inject what we know from ptyRunnerMeta so the UI
    // never reports a live PTY runner as stopped just because the state file
    // is partial. PTY-level liveness is the truth source — state file just
    // mirrors it for the renderer.
    const ptyMgr = globalThis.__autoflowPtyManager;
    const ptyRunner = ptyMgr ? ptyMgr.get(runnerId) : null;
    const isPtyAlive = ptyRunner && ptyRunner.status === "running";
    if (isPtyAlive) {
      if (!lines.has("id")) lines.set("id", runnerId);
      if (!lines.has("role") && meta.role) lines.set("role", meta.role);
      if (!lines.has("agent") && meta.agent) lines.set("agent", meta.agent);
      if (!lines.has("mode")) lines.set("mode", "pty");
      if (!lines.has("status")) lines.set("status", "running");
      if (!lines.has("pid") && ptyRunner.pid) lines.set("pid", String(ptyRunner.pid));
      if (!lines.has("started_at") && meta.startedAt) lines.set("started_at", meta.startedAt);
    }
    for (const [key, value] of Object.entries(runnerTokenStateDefaults)) {
      if (!lines.has(key)) lines.set(key, value);
    }
    const explicitFields = new Set(Object.keys(fields || {}));
    for (const [k, v] of Object.entries(fields || {})) {
      if (v === undefined || v === null) continue;
      lines.set(k, String(v));
    }
    try {
      const latest = new Map();
      const latestText = await fs.readFile(statePath, "utf8");
      for (const line of latestText.split(/\r?\n/)) {
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        latest.set(line.slice(0, eq), line.slice(eq + 1));
      }
      preserveLatestRunnerAccountingFields(lines, latest, explicitFields);
    } catch {}
    lines.set("updated_at", new Date().toISOString());
    const out = Array.from(lines.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const tmpPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, `${out}\n`, "utf8");
    await fs.rename(tmpPath, statePath);
  } catch (err) {
    // best-effort; UI can fall back to other signals
  }
}

// Build the literal shell command to type into a PTY shell so the agent CLI
// runs in interactive (long-lived) mode. The user will see this exactly as
// if they typed it themselves. Disable destructive prompts via per-CLI flags
// so the agent can act without blocking on (y/n) prompts.
function buildAgentCliCommand(agent, model, reasoning, options = {}) {
  const parts = [];
  switch (String(agent || "").toLowerCase()) {
    case "claude": {
      parts.push("claude", "--dangerously-skip-permissions",
        "--permission-mode", "bypassPermissions",
        "--plugin-dir", ".claude/autoflow-plugin");
      if (model) parts.push("--model", model);
      if (reasoning) parts.push("--effort", reasoning);
      break;
    }
    case "codex": {
      // Modern codex CLI no longer accepts --skip-git-repo-check; it errors
      // out and dumps to the shell, leaking the initial prompt as raw text.
      // The remaining flags suffice (sandbox bypass + approval bypass).
      parts.push("codex", "--dangerously-bypass-approvals-and-sandbox");
      if (model) parts.push("-m", model);
      if (reasoning) parts.push("-c", `model_reasoning_effort="${reasoning}"`);
      break;
    }
    case "gemini": {
      parts.push("gemini", "--skip-trust", "--approval-mode", "yolo");
      if (model) parts.push("--model", model);
      const boardDirName = options.boardDirName || defaultBoardDirName;
      if (boardDirName) parts.push("--include-directories", boardDirName);
      break;
    }
    default:
      return "";
  }
  // Quote args containing spaces / quotes to keep the typed shell command sane.
  return parts
    .map((p) => (/[ \t"'$`\\]/.test(p) ? `'${p.replace(/'/g, "'\\''")}'` : p))
    .join(" ");
}

function normalizeRunnerRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "plan") return "planner";
  if (value === "ticket") return "worker";
  if (value === "wiki") return "wiki-maintainer";
  if (value === "verify") return "verifier";
  if (value === "coord") return "coordinator";
  if (value === "merge" || value === "merge-bot") return "worker";
  return value || "planner";
}

function buildRunnerPtyEnv({ agent, runnerId, role, projectRoot, boardDirName, codexHistory }) {
  const env = {
    // Pin the autoflow-side stable runner id so worker helpers
    // picks this instead of codex's per-session UUID. Without this,
    // every PTY restart issues a fresh UUID, workership locks
    // become stale, and worker claim refuses to proceed until the
    // lock is cleared by normal runner state handling.
    AUTOFLOW_WORKER_ID: runnerId,
    AUTOFLOW_RUNNER_ID: runnerId,
    AUTOFLOW_ROLE: role,
    RUNNER_ID: runnerId,
    AUTOFLOW_BOARD_ROOT: path.join(projectRoot, boardDirName)
  };
  let codexHome = "";
  const effectiveCodexHistory =
    String(agent || "").toLowerCase() === "codex"
      ? normalizeCodexHistoryMode(codexHistory)
      : "";
  if (effectiveCodexHistory === "isolated") {
    const prepared = ensureCodexRunnerHome({ projectRoot, boardDirName, runnerId });
    codexHome = prepared.codexHome;
    env.CODEX_HOME = codexHome;
    env.AUTOFLOW_CODEX_HOME = codexHome;
    env.AUTOFLOW_CODEX_HISTORY = effectiveCodexHistory;
    if (!prepared.authOk) {
      console.warn(`[codex-runner-home] auth.json was not copied from ${prepared.sourceHome}; runner may require login`);
    }
  }
  return { env, codexHome, codexHistory: effectiveCodexHistory || "" };
}

function roleInstructionPath(boardRoot, role) {
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return path.join(boardRoot, "agents", "plan-to-ticket-agent.md");
    case "worker":
      return path.join(boardRoot, "agents", "worker-agent.md");
    case "verifier":
      return path.join(boardRoot, "agents", "verifier-agent.md");
    case "wiki-maintainer":
      return path.join(boardRoot, "agents", "wiki-maintainer-agent.md");
    case "todo":
      return path.join(boardRoot, "agents", "legacy", "todo-queue-agent.md");
    case "coordinator":
      return path.join(boardRoot, "agents", "legacy", "coordinator-agent.md");
    default:
      return path.join(boardRoot, "agents", "legacy", "coordinator-agent.md");
  }
}

function startupRulesPath(boardRoot, role) {
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return path.join(boardRoot, "reference", "runner-startup-rules", "planner.md");
    case "worker":
      return path.join(boardRoot, "reference", "runner-startup-rules", "worker.md");
    case "verifier":
      return path.join(boardRoot, "reference", "runner-startup-rules", "verifier.md");
    case "wiki-maintainer":
      return path.join(boardRoot, "reference", "runner-startup-rules", "wiki-maintainer.md");
    default:
      return "";
  }
}

function commonStartupRulesPath(boardRoot) {
  return path.join(boardRoot, "reference", "runner-startup-common.md");
}

function readPromptDoc(filePath, maxChars = 16000) {
  if (!filePath) return "";
  try {
    const content = fsSync.readFileSync(filePath, "utf8").trim();
    if (!content) return "";
    if (content.length <= maxChars) return content;
    return `${content.slice(0, maxChars)}\n\n[... truncated by Desktop runner startup prompt at ${maxChars} chars ...]`;
  } catch {
    return "";
  }
}

function injectedDocBlock(label, filePath, content) {
  if (!filePath) return "";
  return [
    `--- ${label}: ${filePath} ---`,
    content || `[missing or empty: ${filePath}]`,
    `--- end ${label} ---`
  ].join("\n");
}

function uniquePaths(paths) {
  const seen = new Set();
  return paths.filter((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

// Initial prompt sent once after the agent CLI is up. The Desktop start button
// always opens the runner PTY for explicit user starts, then injects compact
// common + role startup rules so the runner can do visible startup checks.
function buildInitialPrompt({ role, agent, runnerId, projectRoot, boardDirName }) {
  const boardRoot = path.join(projectRoot, boardDirName);
  const ticketsRoot = path.join(boardRoot, "tickets");
  const wikiRoot = path.join(boardRoot, "wiki");
  const normalizedRole = normalizeRunnerRole(role);
  const roleInstruction = roleInstructionPath(boardRoot, role);
  const commonRulesPath = commonStartupRulesPath(boardRoot);
  const roleRulesPath = startupRulesPath(boardRoot, role);
  const injectStartupDocs = normalizedRole !== "wiki-maintainer";
  const commonRules = injectStartupDocs ? readPromptDoc(commonRulesPath) : "";
  const roleRules = injectStartupDocs ? readPromptDoc(roleRulesPath) : "";
  const autoflowBin = path.join(repoRoot, "app", "bin", "autoflow");
  const runnerWakeCmd = `${autoflowBin} tool runner-wake`;
  const runnerStageCmd = `${autoflowBin} tool runner-stage`;
  const runnerTokensCmd = `${autoflowBin} tool runner-tokens`;
  // Role-specific "what to scan FIRST" so the runner picks up pre-existing
  // pending work instead of idling until a fresh fs.watch event.
  const startupScan = (() => {
    switch (normalizedRole) {
      case "planner":
        return [
          `Startup scan (do this BEFORE waiting for any [wake] message):`,
          `  1. List ${path.join(ticketsRoot, "order")} — process every order_*.md (oldest first, priority-aware).`,
          `  2. List ${path.join(ticketsRoot, "prd")} — promote populated PRDs to todo tickets per the cross-category rule.`,
          `  3. Only after both queues are drained should you idle and wait for [wake] events.`
        ].join("\n");
      case "worker":
        return [
          `Atomic rule: at most ONE active ticket at any moment.`,
          `Worktree cwd lock: after worker claim/worktree-ensure returns a worktree path, cd into it BEFORE any Edit/Write. Editing PROJECT_ROOT files mid-ticket clobbers other runners' working trees.`,
          `Startup scan order:`,
          `  1. inprogress/ first — resume the single Todo-*.md if present (mv extras back to todo/ if 2+).`,
          `  2. Only when inprogress is empty, claim one highest-priority Todo-*.md from todo/.`,
          `  3. Run the full atomic close-out per the injected worker startup rules and worker-agent.md.`,
          `  4. After each phase, also call \`${runnerStageCmd} <stage>\` to keep runner state active_stage/ticket_id in sync.`,
          `  5. Loop back to step 1. Idle only when both inprogress/ and todo/ are empty.`
        ].join("\n");
      case "verifier":
        return [
          `Startup scan (do this BEFORE waiting for any [wake] message):`,
          `  1. List ${path.join(ticketsRoot, "verifier")} — select one pending verifier-lane Todo-*.md by priority/FIFO.`,
          `  2. Gather evidence via verifier runner tools, then make the semantic pass/revise/replan decision yourself.`,
          `  3. On pass, only grant merge permission and wake worker; on revise, wake worker for the same worktree; on replan, wake worker to create retry order and delete the worktree.`
        ].join("\n");
      case "wiki-maintainer":
        return [
          `Startup scan (do this BEFORE waiting for any [wake] message):`,
          `  1. Run \`${autoflowBin} tool runner-tool wiki tick --runner ${runnerId} --max-items 12\` first and let it complete; do not poll it at one-second intervals.`,
          `  2. If tick.ai_followup_recommended is false, summarize the tick result and idle without opening source files.`,
          `  3. If follow-up is needed, inspect only the compact paths returned by tick; do not run broad searches or open files outside that scope.`,
          `  4. Edit at most one focused wiki page per turn, then run \`${autoflowBin} tool runner-tool wiki tick --runner ${runnerId} --skip-telemetry --max-items 12\` once and idle.`
        ].join("\n");
      default:
        return [
          `Startup scan (do this BEFORE waiting for any [wake] message):`,
          `  - List ${ticketsRoot} subfolders and pick up anything pending for this role.`
        ].join("\n");
    }
  })();
  const projectAgents = path.join(projectRoot, "AGENTS.md");
  const boardAgents = path.join(boardRoot, "AGENTS.md");
  const fullContractFiles = uniquePaths(
    normalizedRole === "wiki-maintainer"
      ? []
      : [roleInstruction, projectAgents, boardAgents]
  );
  const contractReadIntro = normalizedRole === "wiki-maintainer"
    ? [
        `The wiki turn is token-sensitive. Do not open full AGENTS, role docs,`,
        `or broad source searches unless \`wiki tick\` reports a failed step or`,
        `the compact follow-up paths make those files directly relevant.`
      ]
    : [
        `Read these full contract files once before planning, editing board state, or`,
        `making role judgments:`
      ];
  const injectedStartupRules = injectStartupDocs
    ? [
        `Injected startup rules from the Desktop start button:`,
        injectedDocBlock("common runner startup rules", commonRulesPath, commonRules),
        roleRulesPath ? injectedDocBlock("role runner startup rules", roleRulesPath, roleRules) : null
      ]
    : [
        `Compact wiki startup rules from the Desktop start button:`,
        `- Run the wiki tick command below once inside this visible turn.`,
        `- If tick.ai_followup_recommended=false, summarize the compact result and idle.`,
        `- If follow-up is needed, inspect only tick.ai_followup_scope paths.`,
        `- Edit at most one focused wiki page, rerun tick with --skip-telemetry once, then idle.`
      ];
  return [
    `Autoflow ${role} runner started (id=${runnerId}, agent=${agent}).`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Role:         ${normalizedRole}`,
    ``,
    ...injectedStartupRules,
    ``,
    `Desktop opened this PTY because the user explicitly started the runner.`,
    normalizedRole === "wiki-maintainer"
      ? `For wiki, run the compact tick inside this visible turn, then decide whether focused wiki editing is needed.`
      : `Run the startup scan below, then either work on the actionable item or record why the runner is idling.`,
    ``,
    ...contractReadIntro,
    ...fullContractFiles.map((filePath) => {
      const status = fsSync.existsSync(filePath) ? "" : " (missing on disk; report this and continue with injected rules)";
      return `  - ${filePath}${status}`;
    }),
    `Do not recursively expand Read Order lists inside host/board AGENTS unless`,
    `the active work requires the referenced document.`,
    ``,
    startupScan,
    ``,
    `After the startup scan, continue this role's normal Autoflow work.`,
    `When new files appear in the board (orders, tickets, etc.), I will push a`,
    `wake message of the form '[wake] <path>'. Treat each [wake] as a hint to`,
    `re-scan the relevant queue, not as the only signal — keep working as long`,
    `as anything is pending.`,
    ``,
    `Hard rules: no git push; stay within the active ticket's Allowed Paths;`,
    `record durable progress in board files; do not re-read the full startup`,
    `contract files again within this session unless this runner process restarts.`,
    ``,
    `Active reporting (every turn — required):`,
    `  - Start of turn: \`${runnerWakeCmd} poll --runner ${runnerId}\``,
    `  - On stage change: \`${runnerStageCmd} <stage> --runner ${runnerId} [--ticket <Todo-NNN>]\``,
    `  - End of turn: Desktop records provider usage automatically when exact live usage metadata is emitted.`,
    `    Do not also run \`${runnerTokensCmd} report\` for the same Desktop PTY turn.`,
    `    Only use \`${runnerTokensCmd} report --runner ${runnerId} --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]\``,
    `    in non-Desktop runs or when the host explicitly asks for a manual report and exact values are visible.`,
    `If exact values are not visible, skip token reporting; never report 0/0, placeholders, or estimates.`,
    `Format tick-id as`,
    `\`${runnerId}-<unix-epoch-sec>-<random4>\` so duplicates dedupe correctly.`
  ].filter((line) => line !== null && typeof line !== "undefined").join("\n");
}

function parseJsonObjectOutput(output) {
  const raw = String(output || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function keyValueOutput(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n") + "\n";
}

async function writePreflightIdleState({ runnerId, role, projectRoot, boardDirName, reason, result }) {
  const boardRoot = path.join(projectRoot, boardDirName || defaultBoardDirName);
  const statePath = path.join(boardRoot, "runners", "state", `${runnerId}.state`);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const existing = await readRunnerStateValues(statePath);
  await writeRunnerStateAtomic(statePath, {
    ...existing,
    id: runnerId,
    role,
    status: "idle",
    pid: "",
    active_item: "",
    active_ticket_id: "",
    active_ticket_title: "",
    active_stage: "idle",
    active_spec_ref: "",
    active_ticket_path: "",
    active_recovery_reason: "",
    active_recovery_status: "",
    active_recovery_failure_class: "",
    active_recovery_worktree_path: "",
    active_recovery_worktree_status: "",
    active_recovery_board_state: "",
    last_result: result,
    last_event_at: now,
    preflight_last_at: now,
    preflight_last_result: "idle",
    preflight_last_reason: reason,
    updated_at: now,
  });
}

async function runWikiStartupMaintenancePreflight({ runnerId, role, projectRoot, boardDirName }) {
  const boardRoot = path.join(projectRoot, boardDirName || defaultBoardDirName);
  const tick = await runAutoflowArgs([
    "tool",
    "runner-tool",
    "wiki",
    "tick",
    "--runner", runnerId,
    "--max-items", "5"
  ], {
    env: {
      AUTOFLOW_PROJECT_ROOT: projectRoot,
      PROJECT_ROOT: projectRoot,
      AUTOFLOW_BOARD_ROOT: boardRoot,
      BOARD_ROOT: boardRoot,
      AUTOFLOW_BOARD_DIR_NAME: boardDirName || defaultBoardDirName,
      AUTOFLOW_RUNNER_ID: runnerId,
      RUNNER_ID: runnerId
    }
  });
  const parsed = parseJsonObjectOutput(tick.stdout || "");
  const failedStepCount = Number.parseInt(String(parsed?.failed_step_count || "0"), 10) || 0;
  const aiFollowupRecommended = parsed?.ai_followup_recommended === true;
  if (!tick.ok || !parsed || failedStepCount > 0 || aiFollowupRecommended) {
    return null;
  }

  const reason = "wiki_tick_no_ai_followup";
  const stdout = keyValueOutput({
    status: "ok",
    runner: runnerId,
    role,
    decision: "skip",
    result: "preflight_wiki_tick_idle",
    actionable: "false",
    reason,
    "tick.failed_step_count": failedStepCount,
    "tick.ai_followup_recommended": String(aiFollowupRecommended),
    "tick.baseline_changed": String(parsed.baseline_changed === true),
    "tick.source_changed": String(parsed.source_changed === true),
    "tick.index_refresh_mode": parsed.index_refresh_mode || "",
    "tick.index_refresh_log_path": parsed.index_refresh_log_path || "",
  });
  await writePreflightIdleState({
    runnerId,
    role,
    projectRoot,
    boardDirName,
    reason,
    result: "preflight_wiki_tick_idle"
  });
  return {
    ok: true,
    command: "runner-preflight wiki tick",
    code: 0,
    stdout,
    stderr: tick.stderr || "",
    values: parseKeyValueOutput(stdout || "")
  };
}

async function runRunnerStartupPreflight({ runnerId, role, projectRoot, boardDirName }) {
  const boardRoot = path.join(projectRoot, boardDirName || defaultBoardDirName);
  const result = await runAutoflowArgs([
    "tool",
    "runner-preflight",
    "--project-root", projectRoot,
    "--board-root", boardRoot,
    "--runner", runnerId,
    "--role", role,
    "--write-state"
  ], {
    env: {
      AUTOFLOW_PROJECT_ROOT: projectRoot,
      PROJECT_ROOT: projectRoot,
      AUTOFLOW_BOARD_ROOT: boardRoot,
      BOARD_ROOT: boardRoot,
      AUTOFLOW_BOARD_DIR_NAME: boardDirName || defaultBoardDirName
    }
  });
  const values = parseKeyValueOutput(result.stdout || "");
  if (
    role === "wiki-maintainer" &&
    result.ok &&
    values.decision === "start" &&
    values.reason === "wiki_index_stale"
  ) {
    const resolved = await runWikiStartupMaintenancePreflight({
      runnerId,
      role,
      projectRoot,
      boardDirName
    });
    if (resolved) return resolved;
  }
  return {
    ...result,
    values
  };
}

function projectScopeKey(projectRoot, boardDirName) {
  return `${projectRoot}\0${boardDirName}`;
}

function clearReadBoardDiagnosticCacheForScope(scope = {}) {
  const projectRoot = scope.projectRoot || "";
  const boardDirName = scope.boardDirName || defaultBoardDirName;
  for (const key of readBoardDiagnosticCache.keys()) {
    const [, cachedProjectRoot, cachedBoardDirName] = String(key).split("\0");
    if (cachedProjectRoot === projectRoot && cachedBoardDirName === boardDirName) {
      readBoardDiagnosticCache.delete(key);
    }
  }
}

function clearReadBoardCachesForScope(scope = {}) {
  clearReadBoardRunnerListCache(scope);
  clearReadBoardDiagnosticCacheForScope(scope);
}

// Install fs.watch handlers for the directories that should retrigger the
// renderer's `readBoard` snapshot:
//   - tickets/* (queue moves: planner / worker / manual)
//   - runners/config*.toml (agent/model/reasoning changes)
//   - runners/state/* (status flips)
//   - wiki/skills-local/* (skill counter / list changes)
// Coalesces bursts (e.g. planner moving 6 files in one tick) into a single
// IPC push debounced by `boardWatchDebounceMs`. Replaces the renderer's
// 5s polling so the UI no longer reads the entire board every 5 seconds
// just in case something changed.
function ensureBoardWatcher(scope) {
  if (!scope || typeof scope.projectRoot !== "string" || !scope.projectRoot) {
    return;
  }
  const boardDirName = scope.boardDirName || defaultBoardDirName;
  const key = projectScopeKey(scope.projectRoot, boardDirName);
  if (boardWatchersByScope.has(key)) {
    return;
  }
  const boardRoot = path.join(scope.projectRoot, boardDirName);
  if (!fsSync.existsSync(boardRoot)) {
    return;
  }

  const entry = {
    watchers: [],
    debounceTimer: null,
    lastReason: ""
  };
  boardWatchersByScope.set(key, entry);

  const broadcast = () => {
    const reason = entry.lastReason || "fs.watch";
    entry.lastReason = "";
    clearReadBoardCachesForScope({ projectRoot: scope.projectRoot, boardDirName });
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send("autoflow:boardChange", {
            projectRoot: scope.projectRoot,
            boardDirName,
            reason
          });
        } catch {
          // ignore — renderer may be tearing down
        }
      }
    }
    // PTY runner wake — dual signal:
    //   1) Push `[wake] <path>` text into the PTY (immediate visual cue,
    //      kept for backward compatibility / human readability).
    //   2) Append the same event into the runner's wake queue file via
    //      `autoflow tool runner-wake emit`. The LLM polls this queue at turn boundaries
    //      so wakes that arrive during paste/thinking aren't lost.
    // Gate: only wake roles that actually have pending work in their queue.
    try {
      const mgr = globalThis.__autoflowPtyManager;
      if (!mgr) return;
      const targetRoles = new Set(rolesForBoardChange(reason));
      if (targetRoles.size === 0) return;
      for (const [rid, meta] of ptyRunnerMeta.entries()) {
        if (meta.projectRoot !== scope.projectRoot) continue;
        if (meta.boardDirName !== boardDirName) continue;
        if (!targetRoles.has(meta.role)) continue;
        if (!queueHasPendingWork(meta.role, boardRoot)) continue;
        sendRunnerWake({
          mgr,
          runnerId: rid,
          meta,
          scope: { projectRoot: scope.projectRoot, boardDirName },
          boardRoot,
          reason,
          kind: "fs.watch"
        });
      }
      // Sticky context generation: when a Todo-*.md appears in inprogress/,
      // the worker just claimed it. Write sticky-context.md with the
      // ticket's Allowed Paths / Done When / Acceptance Probe.
      if (
        reason.startsWith("tickets/inprogress/") &&
        /Todo-\d+\.md$/.test(reason)
      ) {
        const ticketFile = path.basename(reason);
        const ticketPath = path.join(boardRoot, "tickets", "inprogress", ticketFile);
        for (const [rid, meta] of ptyRunnerMeta.entries()) {
          if (meta.projectRoot !== scope.projectRoot) continue;
          if (meta.boardDirName !== boardDirName) continue;
          if (meta.role !== "worker") continue;
          generateStickyContext(boardRoot, rid, ticketPath);
        }
      }
      // Context reset after ticket pass: when a done/*/Todo-*.md appears,
      // the worker just finished a pass. Schedule compact/clear inject.
      if (
        reason.startsWith("tickets/done/") &&
        /\/Todo-\d+\.md$/.test(reason)
      ) {
        for (const [rid, meta] of ptyRunnerMeta.entries()) {
          if (meta.projectRoot !== scope.projectRoot) continue;
          if (meta.boardDirName !== boardDirName) continue;
          if (meta.role !== "worker") continue;
          scheduleContextReset(rid, meta);
        }
      }
    } catch {
      // wake is best-effort; log churn would dwarf any real signal
    }
  };

  const enqueue = (reason) => {
    entry.lastReason = reason || entry.lastReason || "fs.watch";
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      broadcast();
    }, boardWatchDebounceMs);
  };

  const watchDir = (relPath, recursive) => {
    const target = path.join(boardRoot, relPath);
    if (!fsSync.existsSync(target)) return;
    try {
      const watcher = fsSync.watch(
        target,
        { persistent: false, recursive: Boolean(recursive) },
        (_eventType, filename) => {
          // Filter out tmp/lock noise that doesn't affect the board snapshot.
          const name = String(filename || "");
          if (name && (
            name.endsWith(".tmp") ||
            name.endsWith(".swp") ||
            name.startsWith(".#") ||
            name.endsWith("~")
          )) {
            return;
          }
          enqueue(`${relPath}/${name || "*"}`);
        }
      );
      watcher.on("error", () => {
        // Best-effort. fs.watch can throw on some FS edge cases (NFS,
        // permission, deleted dirs). Drop silently — polling backup remains.
      });
      entry.watchers.push(watcher);
    } catch {
      // Same as above; do not crash the desktop process.
    }
  };

  // recursive: true is supported on macOS + Windows. On Linux the option is
  // a no-op and only the top-level directory is watched, which is good
  // enough for the queue folders since we only care about file-level adds
  // and removes one level deep.
  watchDir("tickets", true);
  watchDir("runners", false);
  watchDir("runners/state", false);
  watchDir("wiki/skills-local", true);

  ensureWakeSafetyPoller(scope);
}

// Safety poll: legacy fallback that fires a wake to idle runners when queue work
// is present. It is disabled by default because periodic polling can create
// token churn in long-lived runner sessions; file-watch wakes and explicit
// runner starts are the normal path.
// Env knobs:
//   AUTOFLOW_WAKE_SAFETY_POLL          — set to 1 to enable this fallback
//   AUTOFLOW_WAKE_POLL_INTERVAL_SEC    — poll tick interval (default 60 s)
//   AUTOFLOW_WAKE_IDLE_THRESHOLD_SEC   — seconds without a wake → idle (default 30 s)
//   AUTOFLOW_WAKE_STALL_THRESHOLD_SEC  — seconds without any wake → forced wake (default 1800 s)
function ensureWakeSafetyPoller(scope) {
  if (!scope || typeof scope.projectRoot !== "string") return;
  if (process.env.AUTOFLOW_WAKE_SAFETY_POLL !== "1") return;
  const boardDirName = scope.boardDirName || defaultBoardDirName;
  const key = `${scope.projectRoot}::${boardDirName}`;
  if (wakeSafetyPollers.has(key)) return;

  const pollIntervalMs = Number(process.env.AUTOFLOW_WAKE_POLL_INTERVAL_SEC || 60) * 1000;
  const idleThresholdMs = Number(process.env.AUTOFLOW_WAKE_IDLE_THRESHOLD_SEC || 30) * 1000;
  const stallThresholdMs = Number(process.env.AUTOFLOW_WAKE_STALL_THRESHOLD_SEC || 1800) * 1000;
  const boardRoot = path.join(scope.projectRoot, boardDirName);

  const timerId = setInterval(() => {
    try {
      const mgr = globalThis.__autoflowPtyManager;
      if (!mgr) return;
      const now = Date.now();
      for (const [rid, meta] of ptyRunnerMeta.entries()) {
        if (meta.projectRoot !== scope.projectRoot) continue;
        if (meta.boardDirName !== boardDirName) continue;
        if (!queueHasPendingWork(meta.role, boardRoot)) continue;

        const s = wakePollState.get(rid) || {};
        const lastWake = s.lastWakeAt || 0;
        const idleSec = (now - lastWake) / 1000;
        const isIdle = (now - lastWake) >= idleThresholdMs;
        if (!isIdle) continue;

        const fp = computeQueueFingerprint(meta.role, boardRoot);
        const fpChanged = fp !== s.queueFingerprint;
        const isStall = (now - lastWake) >= stallThresholdMs;
        if (!fpChanged && !isStall) continue;

        const reason = isStall ? "safety-poll-stall" : "safety-poll-queue-change";
        sendRunnerWake({
          mgr,
          runnerId: rid,
          meta,
          scope: { projectRoot: scope.projectRoot, boardDirName },
          boardRoot,
          reason,
          kind: "safety-poll"
        });
        const ps = wakePollState.get(rid) || {};
        ps.queueFingerprint = fp;
        wakePollState.set(rid, ps);

        appendWakePollLog(boardRoot, {
          runner: rid,
          role: meta.role,
          reason,
          queue_pending: true,
          fingerprint_changed: fpChanged,
          idle_seconds: Math.round(idleSec),
          stall: isStall
        });
      }
    } catch {}
  }, pollIntervalMs);

  wakeSafetyPollers.set(key, timerId);
}

function disposeBoardWatcherForScope(scope) {
  if (!scope) return;
  const boardDirName = scope.boardDirName || defaultBoardDirName;
  const key = projectScopeKey(scope.projectRoot, boardDirName);
  const entry = boardWatchersByScope.get(key);
  if (!entry) return;
  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
    entry.debounceTimer = null;
  }
  for (const watcher of entry.watchers) {
    try {
      watcher.close();
    } catch {
      // ignore
    }
  }
  boardWatchersByScope.delete(key);
}

function disposeAllBoardWatchers() {
  for (const key of [...boardWatchersByScope.keys()]) {
    const entry = boardWatchersByScope.get(key);
    if (!entry) continue;
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
      entry.debounceTimer = null;
    }
    for (const watcher of entry.watchers) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
    }
    boardWatchersByScope.delete(key);
  }
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
    // First time we see this project scope in this desktop session: sweep any
    // runner state.state pointing at a dead/orphan PID left over from a prior
    // crash or red-X close. Runs once per scope per session.
    void sweepStaleRunnersForScope(scope).catch(() => 0);
  }
  // Make sure the fs.watch board listener is alive whenever the renderer
  // touches a scope. Idempotent — bails immediately if a watcher is already
  // running for this scope.
  ensureBoardWatcher(scope);
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

    const display = electronScreen.getDisplayMatching(bounds);
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
      preload: path.join(desktopRoot, "dist", "main", "preload.cjs"),
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
    win.loadFile(path.join(desktopRoot, "dist", "renderer", "index.html"));
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
    command: path.join(repoRoot, "app", "bin", "autoflow"),
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
    return startCachedAutoflowRefresh(command, options, key, entry)
      .then((result) => markReadBoardFallback(cloneRunResult(result), { cacheStatus: "miss" }));
  }

  return entry.promise.then((result) =>
    markReadBoardFallback(cloneRunResult(result), {
      refreshInFlight: true,
      cacheStatus: "pending"
    })
  );
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

function projectHostSkillAssets() {
  const assets = [];
  for (const entry of readScaffoldManifestSourceEntries().filter((sourceEntry) => sourceEntry.type === "host")) {
    const sourceRoot = path.join(repoRoot, entry.path);
    if (!fsSync.existsSync(sourceRoot)) {
      assets.push(entry);
      continue;
    }
    const stat = fsSync.statSync(sourceRoot);
    if (!stat.isDirectory()) {
      assets.push(entry);
      continue;
    }

    const visit = (current) => {
      for (const name of fsSync.readdirSync(current)) {
        if (name === "node_modules" || name === ".git") {
          continue;
        }
        const full = path.join(current, name);
        const fullStat = fsSync.statSync(full);
        if (fullStat.isDirectory()) {
          visit(full);
          continue;
        }
        const relative = path.relative(sourceRoot, full).split(path.sep).join("/");
        assets.push({
          ...entry,
          path: path.join(entry.path, relative),
          target: path.join(entry.target, relative)
        });
      }
    };
    visit(sourceRoot);
  }
  return assets;
}

function renderProjectTemplate(content, boardDirName) {
  return content.replaceAll("{{BOARD_DIR}}", boardDirName || defaultBoardDirName);
}

async function syncProjectHostSkillAsset(projectRoot, boardDirName, asset) {
  const sourcePath = path.join(repoRoot, asset.path);
  const renderedTarget = renderProjectTemplate(asset.target, boardDirName);
  const targetPath = path.isAbsolute(renderedTarget) ? renderedTarget : path.join(projectRoot, renderedTarget);
  const rawSourceContent = await fs.readFile(sourcePath, "utf8");
  const sourceContent = asset.template ? renderProjectTemplate(rawSourceContent, boardDirName) : rawSourceContent;

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

  for (const asset of projectHostSkillAssets()) {
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
      env: sanitizedProcessEnv()
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
  const [codexInstalled, claudeInstalled, geminiInstalled] = await Promise.all([
    commandExists("codex"),
    commandExists("claude"),
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
      codexHistory: values[`${prefix}codex_history`] || "",
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
      wakeStaleThresholdSeconds: String(readWakeStaleThresholdSeconds()),
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
      cumulativeTokens: positiveIntegerValue(values[`${prefix}cumulative_tokens`]),
      cumulativeTotalTokens: positiveIntegerValue(values[`${prefix}cumulative_total_tokens`]),
      cumulativeCacheReadTokens: positiveIntegerValue(values[`${prefix}cumulative_cache_read_tokens`]),
      cumulativeCacheCreateTokens: positiveIntegerValue(values[`${prefix}cumulative_cache_create_tokens`]),
      lastTurnTokens: positiveIntegerValue(values[`${prefix}last_turn_tokens`]),
      lastTurnTotalTokens: positiveIntegerValue(values[`${prefix}last_turn_total_tokens`]),
      lastTurnInputTokens: positiveIntegerValue(values[`${prefix}last_turn_input_tokens`]),
      lastTurnOutputTokens: positiveIntegerValue(values[`${prefix}last_turn_output_tokens`]),
      lastTurnCacheReadTokens: positiveIntegerValue(values[`${prefix}last_turn_cache_read_tokens`]),
      lastTurnCacheCreateTokens: positiveIntegerValue(values[`${prefix}last_turn_cache_create_tokens`]),
      lastTurnAt: values[`${prefix}last_turn_at`] || "",
      lastTurnTickId: values[`${prefix}last_turn_tick_id`] || "",
      tokenSource: values[`${prefix}token_source`] || "none",
      lastTokenUsageSource: values[`${prefix}last_token_usage_source`] || "none",
      cumulativeCodeFilesChanged: positiveIntegerValue(values[`${prefix}cumulative_code_files_changed`]),
      cumulativeCodeInsertions: positiveIntegerValue(values[`${prefix}cumulative_code_insertions`]),
      cumulativeCodeDeletions: positiveIntegerValue(values[`${prefix}cumulative_code_deletions`]),
      cumulativeCodeVolume: positiveIntegerValue(values[`${prefix}cumulative_code_volume`]),
      cumulativeCodeNetDelta: Number.parseInt(values[`${prefix}cumulative_code_net_delta`] || "0", 10) || 0,
      lastCodeTicketId: values[`${prefix}last_code_ticket_id`] || "",
      lastCodeFilesChanged: positiveIntegerValue(values[`${prefix}last_code_files_changed`]),
      lastCodeInsertions: positiveIntegerValue(values[`${prefix}last_code_insertions`]),
      lastCodeDeletions: positiveIntegerValue(values[`${prefix}last_code_deletions`]),
      lastCodeVolume: positiveIntegerValue(values[`${prefix}last_code_volume`]),
      lastCodeNetDelta: Number.parseInt(values[`${prefix}last_code_net_delta`] || "0", 10) || 0,
      lastCodeReportedAt: values[`${prefix}last_code_reported_at`] || "",
      codeSource: values[`${prefix}code_source`] || "none",
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
      tokenUsage: positiveIntegerValue(values[`${prefix}cumulative_tokens`])
    });
  }

  return {
    values,
    runners
  };
}

const conversationAnsiEscapePattern = /\x1B\[[0-?]*[ -/]*[@-~]/g;

function extractAgentConversation(text, maxChars = 4000) {
  if (!text) return "";
  let conversation = text.replace(/\s+$/u, "");
  while (conversation.startsWith("\n")) {
    conversation = conversation.slice(1);
  }
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
    return { authRequired: false, authMessage: "", authUrl: "", authProviderBlocked: false };
  }

  if (normalizeAgentKey(agent) === "claude" && claudeSubscriptionDisabledPattern.test(clean)) {
    return {
      authRequired: true,
      authMessage: "Claude 조직 설정상 Claude Code 구독 접근이 비활성화되어 있습니다. Anthropic API 키를 설정하거나 관리자에게 활성화를 요청하세요.",
      authUrl: "",
      authProviderBlocked: true
    };
  }

  const authRequired = runnerAuthNeededPatterns.some((pattern) => pattern.test(clean));
  const authUrl = extractAuthUrl(clean);
  if (!authRequired) {
    return { authRequired: false, authMessage: "", authUrl: "", authProviderBlocked: false };
  }

  const label = agentDisplayLabels[normalizeAgentKey(agent)] || agent || "Agent";
  return {
    authRequired: true,
    authMessage: `${label} 로그인이 필요합니다.`,
    authUrl,
    authProviderBlocked: false
  };
}

function mergeRunnerAuthInfo(current, next) {
  if (next.authProviderBlocked) {
    return next;
  }
  if (current.authProviderBlocked) {
    return current;
  }
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

  if (authInfo.authRequired && !authInfo.authProviderBlocked && await agentIsLoggedIn(runner.agent)) {
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

const runnerLiveLogNamePattern =
  /^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)_live_(?:stdout|stderr)\.log$/;
const ansiEscapePattern = /\[[0-9;?]*[A-Za-z]/g;

function positiveIntegerValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function usageValue(source, keys) {
  if (!source || typeof source !== "object") return 0;
  for (const key of keys) {
    const value = positiveIntegerValue(source[key]);
    if (value > 0) return value;
  }
  return 0;
}

function usageReportFromJsonLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("{") || !trimmed.includes("usage")) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  // Claude stream-json final event.
  if (parsed.type === "result" && parsed.subtype === "success" && parsed.usage && typeof parsed.usage === "object") {
    const usage = parsed.usage;
    return {
      source: "claude_result_usage",
      input: positiveIntegerValue(usage.input_tokens),
      output: positiveIntegerValue(usage.output_tokens),
      cacheRead: positiveIntegerValue(usage.cache_read_input_tokens),
      cacheCreate: positiveIntegerValue(usage.cache_creation_input_tokens)
    };
  }

  // Codex JSON final event.
  if (parsed.type === "turn.completed" && parsed.usage && typeof parsed.usage === "object") {
    const usage = parsed.usage;
    const inputTotal = positiveIntegerValue(usage.input_tokens);
    const cacheRead = positiveIntegerValue(usage.cached_input_tokens ?? usage.cache_read_input_tokens);
    const cacheCreate = positiveIntegerValue(usage.cache_creation_input_tokens);
    return {
      source: "codex_turn_completed_usage",
      input: Math.max(0, inputTotal - cacheRead - cacheCreate),
      output: positiveIntegerValue(usage.output_tokens),
      cacheRead,
      cacheCreate
    };
  }

  // Gemini stream-json / JSON metadata.
  const usage = parsed.usageMetadata || parsed.usage_metadata;
  if (usage && typeof usage === "object") {
    const inputTotal = usageValue(usage, ["promptTokenCount", "prompt_token_count", "inputTokenCount", "input_token_count"]);
    const cacheRead = usageValue(usage, ["cachedContentTokenCount", "cached_content_token_count"]);
    return {
      source: "gemini_usage_metadata",
      input: Math.max(0, inputTotal - cacheRead),
      output: usageValue(usage, ["candidatesTokenCount", "candidates_token_count", "outputTokenCount", "output_token_count"]),
      cacheRead,
      cacheCreate: 0
    };
  }

  return null;
}

function ptyUsageReportsFromChunk(runnerId, chunk) {
  const state = ptyTokenUsageParseState.get(runnerId) || { tail: "" };
  const combined = `${state.tail || ""}${String(chunk || "")}`;
  const lines = combined.split(/\r?\n/);
  state.tail = lines.pop() || "";
  ptyTokenUsageParseState.set(runnerId, state);
  const reports = [];
  for (const rawLine of lines) {
    const clean = rawLine.replace(ansiEscapePattern, "").trim();
    if (!clean) continue;
    const report = usageReportFromJsonLine(clean);
    if (!report) continue;
    const total = report.input + report.output + report.cacheRead + report.cacheCreate;
    if (total <= 0) continue;
    reports.push(report);
  }
  return reports;
}

function reportPtyUsageViaRunnerTool(runnerId, usage, options = {}) {
  const meta = ptyRunnerMeta.get(runnerId);
  if (!meta || !meta.projectRoot || !meta.boardDirName) return;
  const boardRoot = path.join(meta.projectRoot, meta.boardDirName);
  const autoflowBin = path.join(repoRoot, "app", "bin", "autoflow");
  const tickId = options.tickId || `${runnerId}-${Math.floor(Date.now() / 1000)}-${nodeCrypto.randomBytes(2).toString("hex")}`;
  const args = [
    "tool", "runner-tokens",
    "report",
    "--runner", runnerId,
    "--tick-id", tickId,
    "--input", String(usage.input || 0),
    "--output", String(usage.output || 0),
    "--cache-read", String(usage.cacheRead || 0),
    "--cache-create", String(usage.cacheCreate || 0),
    "--note", options.note || `host_pty_stream:${usage.source || "usage"}`
  ];
  execFile(autoflowBin, args, {
    cwd: meta.projectRoot,
    env: {
      ...process.env,
      AUTOFLOW_BOARD_ROOT: boardRoot,
      BOARD_ROOT: boardRoot,
      AUTOFLOW_RUNNER_ID: runnerId,
      RUNNER_ID: runnerId
    },
    timeout: 30000
  }, (error, stdout, stderr) => {
    if (error) {
      console.warn(`[runner-tokens] host PTY report failed runner=${runnerId}:`, error.message || error);
      if (stderr) console.warn(stderr);
      return;
    }
    if (stdout && stdout.trim()) {
      console.log(`[runner-tokens] host PTY report runner=${runnerId}: ${stdout.trim()}`);
    }
  });
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

function isRunnerTokenSourceAuthoritative(source) {
  return String(source || "").trim() === "llm_reported";
}

function isLegacySessionLogTokenEntry(entry) {
  return String(entry?.note || "").startsWith("host_session_log:");
}

async function readTrustedRunnerTokenLogTotal(boardRoot, runnerId) {
  const result = { hasTokenLog: false, trustedCount: 0, total: 0 };
  const logPath = path.join(boardRoot, "runners", "logs", `${runnerId}-tokens.log`);
  let raw = "";
  try {
    raw = await fs.readFile(logPath, "utf8");
    result.hasTokenLog = true;
  } catch {
    return result;
  }

  const seen = new Set();
  let lineIndex = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    lineIndex += 1;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (isLegacySessionLogTokenEntry(entry)) continue;
    const tickId = String(entry.tickId || `line:${lineIndex}`);
    const key = `${runnerId}:${tickId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const turnTotal =
      positiveIntegerValue(entry.turnTotal) ||
      positiveIntegerValue(entry.input) +
        positiveIntegerValue(entry.output) +
        positiveIntegerValue(entry.cacheRead) +
        positiveIntegerValue(entry.cacheCreate);
    const visibleTotal = Math.max(0, turnTotal - positiveIntegerValue(entry.cacheRead));
    if (visibleTotal <= 0) continue;
    result.trustedCount += 1;
    result.total += visibleTotal;
  }

  return result;
}

async function readRunnerTokenUsage(boardRoot, runners = []) {
  const totals = new Map();

  // Runner-reported usage is the only authoritative monotonic counter across
  // turns. Do not derive runner totals from session files, live stdout, token
  // caches, or telemetry rows; those sources can include pasted prompts,
  // partial output, or stale historical runs.
  const stateDir = path.join(boardRoot, "runners", "state");
  for (const runner of runners) {
    const rid = runner && runner.id;
    if (!rid) continue;
    const trustedLog = await readTrustedRunnerTokenLogTotal(boardRoot, rid);
    if (trustedLog.hasTokenLog) {
      if (trustedLog.total > 0) {
        totals.set(rid, trustedLog.total);
      }
      continue;
    }
    try {
      const raw = await fs.readFile(path.join(stateDir, `${rid}.state`), "utf8");
      let tokenSource = "";
      let cumulative = 0;
      for (const line of raw.split(/\r?\n/)) {
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq);
        const val = line.slice(eq + 1);
        if (key === "token_source") tokenSource = val.trim();
        else if (key === "cumulative_tokens") cumulative = Number.parseInt(val, 10) || 0;
      }
      if (isRunnerTokenSourceAuthoritative(tokenSource) && cumulative > 0) {
        totals.set(rid, cumulative);
      }
    } catch {}
  }

  return totals;
}

async function enrichRunnerTerminalPreviews(runners, boardRoot) {
  const tokenUsageByRunner = await readRunnerTokenUsage(boardRoot, runners);
  // Find the freshest live_stdout.log per runner so the renderer can tail the
  // active tick even when the state file's last_stdout_log was not written.
  const logsDir = path.join(boardRoot, "runners", "logs");
  const liveStdoutByRunner = new Map();
  try {
    const entries = await fs.readdir(logsDir);
    for (const name of entries) {
      const m = runnerLiveLogNamePattern.exec(name);
      if (!m) continue;
      const rid = m[1];
      const ts = timestampFromRunnerLogName(m[2]);
      const prev = liveStdoutByRunner.get(rid);
      if (!prev || ts > prev.ts) {
        liveStdoutByRunner.set(rid, { name, ts });
      }
    }
  } catch {}
  return Promise.all(
    runners.map(async (runner) => {
      const conversationPreview = await runnerConversationPreview(runner, boardRoot);
      const quotaInfo = await runnerQuotaInfo({ ...runner, conversationPreview }, boardRoot);
      const authInfo = await runnerAuthInfo({ ...runner, conversationPreview }, boardRoot);
      let lastStdoutLog = runner.lastStdoutLog || "";
      if (!lastStdoutLog) {
        const fresh = liveStdoutByRunner.get(runner.id);
        if (fresh) lastStdoutLog = path.join(logsDir, fresh.name);
      }
      return {
        ...runner,
        ...quotaInfo,
        ...authInfo,
        conversationPreview,
        tokenUsage: tokenUsageByRunner.get(runner.id) || 0,
        lastStdoutLog
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
  const canonicalOrder = ["order", "prd", "todo", "inprogress", "verifier", "done", "check"];
  const ignoredLegacyFolders = new Set(["inbox", "backlog", "reject"]);
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !ignoredLegacyFolders.has(entry.name))
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
    if (metricSnapshotStringKeys.has(key)) {
      const rawValue = rawSnapshot[key];
      snapshot[key] = rawValue == null ? "" : String(rawValue);
      continue;
    }

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
  const confinedPath = await resolveExistingPathInside(boardRoot, filePath);
  const targetPath = confinedPath.targetPath;

  if (!confinedPath.ok) {
    return {
      ok: false,
      filePath: targetPath,
      name: path.basename(targetPath),
      content: "",
      truncated: false,
      modifiedAt: "",
      size: 0,
      stderr: confinedPath.stderr
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

async function resolveStartupRulesDocument(options = {}) {
  const empty = {
    ok: false,
    filePath: "",
    name: "",
    stderr: ""
  };
  if (!options.projectRoot) {
    return { ...empty, stderr: "Project root is required." };
  }

  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!isSafeBoardDirName(boardDirName)) {
    return { ...empty, stderr: "Invalid board directory name." };
  }

  const boardRoot = path.resolve(options.projectRoot, boardDirName);
  const kind = String(options.kind || "common").toLowerCase();
  const role = normalizeRunnerRole(options.role || "");
  const targetPath =
    kind === "common"
      ? commonStartupRulesPath(boardRoot)
      : kind === "role"
        ? startupRulesPath(boardRoot, role)
        : "";

  if (!targetPath) {
    return {
      ...empty,
      stderr: kind === "role" ? `No startup rule document for role: ${role || "unknown"}` : "Unsupported startup rule document."
    };
  }

  const confinedPath = await resolveExistingPathInside(boardRoot, targetPath);
  const resolvedTarget = confinedPath.targetPath;
  if (!confinedPath.ok) {
    return {
      ...empty,
      filePath: resolvedTarget,
      name: path.basename(resolvedTarget),
      stderr: confinedPath.stderr
    };
  }

  if (path.extname(resolvedTarget) !== ".md") {
    return {
      ...empty,
      filePath: resolvedTarget,
      name: path.basename(resolvedTarget),
      stderr: "Only markdown startup rule documents can be edited."
    };
  }

  try {
    const stat = await fs.stat(resolvedTarget);
    if (!stat.isFile()) {
      return {
        ...empty,
        filePath: resolvedTarget,
        name: path.basename(resolvedTarget),
        stderr: "Path is not a file."
      };
    }
  } catch (error) {
    return {
      ...empty,
      filePath: resolvedTarget,
      name: path.basename(resolvedTarget),
      stderr: error && error.message ? String(error.message) : "Startup rule document does not exist."
    };
  }

  return {
    ok: true,
    filePath: resolvedTarget,
    name: path.basename(resolvedTarget),
    stderr: ""
  };
}

async function readStartupRules(options = {}) {
  const target = await resolveStartupRulesDocument(options);
  const empty = {
    ok: false,
    filePath: target.filePath || "",
    name: target.name || "",
    content: "",
    truncated: false,
    modifiedAt: "",
    size: 0,
    stderr: target.stderr || ""
  };
  if (!target.ok) {
    return empty;
  }

  try {
    const stat = await fs.stat(target.filePath);
    const content = await fs.readFile(target.filePath, "utf8");
    return {
      ok: true,
      filePath: target.filePath,
      name: target.name,
      content,
      truncated: false,
      modifiedAt: stat.mtime.toISOString(),
      size: stat.size,
      stderr: ""
    };
  } catch (error) {
    return {
      ...empty,
      stderr: error && error.message ? String(error.message) : "Startup rule document could not be read."
    };
  }
}

async function writeStartupRules(options = {}) {
  const target = await resolveStartupRulesDocument(options);
  const empty = {
    ok: false,
    filePath: target.filePath || "",
    name: target.name || "",
    content: "",
    truncated: false,
    modifiedAt: "",
    size: 0,
    stderr: target.stderr || ""
  };
  if (!target.ok) {
    return empty;
  }

  const content = typeof options.content === "string" ? options.content : "";
  try {
    await fs.writeFile(target.filePath, content, "utf8");
    const stat = await fs.stat(target.filePath);
    return {
      ok: true,
      filePath: target.filePath,
      name: target.name,
      content,
      truncated: false,
      modifiedAt: stat.mtime.toISOString(),
      size: stat.size,
      stderr: ""
    };
  } catch (error) {
    return {
      ...empty,
      content,
      stderr: error && error.message ? String(error.message) : "Startup rule document could not be saved."
    };
  }
}


async function deleteOrderFile(options = {}) {
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
  const confinedPath = await resolveExistingPathInside(boardRoot, filePath);
  const targetPath = confinedPath.targetPath;
  const relativePath = confinedPath.relativePath;

  if (!confinedPath.ok) {
    return {
      ok: false,
      filePath: targetPath,
      name: path.basename(targetPath),
      message: "",
      stderr: confinedPath.stderr
    };
  }

  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const orderName = path.basename(relativePath);
  if (!normalizedRelativePath.startsWith("tickets/order/") || !/^order_\d+(?:_retry_\d+_[A-Za-z0-9T.:-]+)?\.md$/i.test(orderName)) {
    return {
      ok: false,
      filePath: targetPath,
      name: orderName,
      message: "",
      stderr: "Only tickets/order/order_*.md files can be deleted."
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
  if (exists) {
    migrateLegacyTicketQueuesSync(boardRoot);
  }
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
    metricsResult,
    stopHookResult,
    watcherResult
  ] = exists
    ? diagnosticResults.map((settled, index) => (
        settled.status === "fulfilled"
          ? settled.value
          : diagnosticTasks[index].fallback(settled.reason)
      ))
    : [null, null, null, null, null];
  const fallbackSources = [
    ["status", statusResult],
    ["runners", runnersResult],
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
    limit: 80,
    orderBy: "mtime"
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

  // Runner token override for dashboard metrics — prefer trusted runner-tokens
  // logs so legacy host_session_log imports do not keep inflating totals.
  const parsedMetrics = metricsResult ? parseKeyValueOutput(metricsResult.stdout) : {};
  try {
    const ownsCodeMetrics = (runner) => {
      const role = String(runner?.role || "");
      const id = String(runner?.id || "");
      return role === "worker" || role === "ticket" || id === "worker" || id.startsWith("worker-");
    };
    const codeTotals = {
      files: 0,
      insertions: 0,
      deletions: 0,
      volume: 0,
      net: 0,
    };
    for (const runner of (runnersResult?.runners || [])) {
      if (!ownsCodeMetrics(runner)) continue;
      codeTotals.files += positiveIntegerValue(runner.cumulativeCodeFilesChanged);
      codeTotals.insertions += positiveIntegerValue(runner.cumulativeCodeInsertions);
      codeTotals.deletions += positiveIntegerValue(runner.cumulativeCodeDeletions);
      codeTotals.volume += positiveIntegerValue(runner.cumulativeCodeVolume);
      codeTotals.net += Number.parseInt(String(runner.cumulativeCodeNetDelta || "0"), 10) || 0;
    }
    parsedMetrics.autoflow_code_files_changed_count = String(codeTotals.files);
    parsedMetrics.autoflow_code_insertions_count = String(codeTotals.insertions);
    parsedMetrics.autoflow_code_deletions_count = String(codeTotals.deletions);
    parsedMetrics.autoflow_code_volume_count = String(codeTotals.volume);
    parsedMetrics.autoflow_code_net_delta_count = String(codeTotals.net);
  } catch {}
  try {
    let runnerTokenTotal = 0;
    for (const runner of (runnersResult?.runners || [])) {
      if (!runner?.id) continue;
      runnerTokenTotal += positiveIntegerValue(runner.cumulativeTokens);
    }
    if (runnerTokenTotal > 0) {
      parsedMetrics.autoflow_token_usage_count = String(runnerTokenTotal);
    }
  } catch {}

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
    metrics: parsedMetrics,
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
      .sort((a, b) => byMostRecent(a, b))
      .slice(0, 80),
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
  await enrichRunnerActiveTicketFromFs(runners, boardRoot);

  return {
    ...result,
    values: parsed.values,
    runners
  };
}

let processResourceSnapshotCache = null;

function readProcessResourceSnapshot() {
  const now = Date.now();
  if (
    processResourceSnapshotCache &&
    now - processResourceSnapshotCache.createdAt < 1500
  ) {
    return processResourceSnapshotCache.promise;
  }

  const promise = new Promise((resolve) => {
    execFile(
      "ps",
      ["-axo", "pid=,ppid=,%cpu=,%mem=,rss="],
      { maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(new Map());
          return;
        }
        const rows = new Map();
        String(stdout || "")
          .split(/\r?\n/)
          .forEach((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 5) return;
            const pid = Number.parseInt(parts[0], 10);
            const ppid = Number.parseInt(parts[1], 10);
            const cpuPercent = Number.parseFloat(parts[2]) || 0;
            const memoryPercent = Number.parseFloat(parts[3]) || 0;
            const rssKb = Number.parseInt(parts[4], 10) || 0;
            if (!Number.isInteger(pid) || pid <= 0) return;
            rows.set(pid, { pid, ppid, cpuPercent, memoryPercent, rssKb });
          });
        resolve(rows);
      }
    );
  });

  processResourceSnapshotCache = { createdAt: now, promise };
  return promise;
}

async function runnerResourceUsage(options = {}) {
  const pid = Number.parseInt(String(options.pid || ""), 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    return {
      ok: false,
      pid: "",
      cpuPercent: 0,
      memoryPercent: 0,
      rssMb: 0,
      processCount: 0,
      loadScore: 0,
      stderr: "Runner PID is required."
    };
  }

  const rows = await readProcessResourceSnapshot();
  const childrenByParent = new Map();
  for (const row of rows.values()) {
    if (!childrenByParent.has(row.ppid)) {
      childrenByParent.set(row.ppid, []);
    }
    childrenByParent.get(row.ppid).push(row.pid);
  }

  const queue = [pid];
  const seen = new Set();
  let cpuPercent = 0;
  let memoryPercent = 0;
  let rssKb = 0;

  while (queue.length > 0) {
    const currentPid = queue.shift();
    if (seen.has(currentPid)) continue;
    seen.add(currentPid);
    const row = rows.get(currentPid);
    if (row) {
      cpuPercent += row.cpuPercent;
      memoryPercent += row.memoryPercent;
      rssKb += row.rssKb;
    }
    const children = childrenByParent.get(currentPid) || [];
    for (const childPid of children) {
      if (!seen.has(childPid)) queue.push(childPid);
    }
  }

  const cpuScore = Math.min(1, cpuPercent / RUNNER_RESOURCE_USAGE_MAX_CPU_PERCENT);
  const memoryScore = Math.min(1, memoryPercent / RUNNER_RESOURCE_USAGE_MAX_MEMORY_PERCENT);
  const loadScore = Math.max(cpuScore, memoryScore * 0.85);

  return {
    ok: rows.has(pid),
    pid: String(pid),
    cpuPercent,
    memoryPercent,
    rssMb: rssKb / 1024,
    processCount: seen.size,
    loadScore,
    stderr: rows.has(pid) ? "" : "Runner PID is not active."
  };
}

// Some runner paths still leave stale `active_ticket_id` / `active_ticket_title`
// in state files when claims shift between workers. Re-derive the active
// ticket from the board so the UI reflects the current inprogress/prd
// source of truth instead of stale runner state.
//   worker    → first Todo-*.md in tickets/inprogress/
//   planner         → first order_*.md in tickets/order/, else first prd_*.md in tickets/prd/
//   wiki-maintainer → leave blank (no per-ticket active item)
function canonicalWorkerRunnerId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes(":")) {
    return canonicalWorkerRunnerId(normalized.split(":")[0]);
  }
  if (normalized === "worker" || normalized === "ticket") return "worker";
  if (/^ai-\d+$/i.test(normalized)) return normalized.replace(/^ai-/i, "worker-");
  return normalized;
}

function runnerClaimKeys(runner) {
  const keys = new Set();
  const normalizedId = canonicalWorkerRunnerId(runner?.id || "");
  const role = String(runner?.role || "").trim().toLowerCase();
  if (normalizedId) keys.add(normalizedId);
  if (role === "worker" || role === "ticket") {
    keys.add("worker");
    if (normalizedId.startsWith("worker-")) {
      const suffix = normalizedId.replace(/^worker-/, "");
      keys.add(`ai-${suffix}`);
    }
  }
  return keys;
}

function isWorkerRunner(runner) {
  const role = String(runner?.role || "").trim().toLowerCase();
  if (role === "worker" || role === "ticket") {
    return true;
  }
  const normalizedId = canonicalWorkerRunnerId(runner?.id || "");
  return normalizedId === "worker" || /^worker-\d+$/.test(normalizedId);
}

function runnerClaimsTicketFromMeta(runner, ticketMeta) {
  const runnerKeys = runnerClaimKeys(runner);
  if (runnerKeys.size === 0) return false;
  const ticketKeys = [
    ticketMeta?.claimedBy,
    ticketMeta?.executionAi,
    ticketMeta?.ai
  ]
    .map((value) => canonicalWorkerRunnerId(value))
    .filter(Boolean);
  return ticketKeys.some((value) => runnerKeys.has(value));
}

async function enrichRunnerActiveTicketFromFs(runners, boardRoot) {
  if (!Array.isArray(runners) || runners.length === 0) return;
  const ticketsRoot = path.join(boardRoot, "tickets");
  const readFirstMatch = async (dir, prefix) => {
    try {
      const entries = await fs.readdir(dir);
      return entries.filter((n) => n.startsWith(prefix) && n.endsWith(".md")).sort()[0] || "";
    } catch { return ""; }
  };
  const readTitle = async (filePath) => {
    if (!filePath) return "";
    try {
      const text = await fs.readFile(filePath, "utf8");
      const m = text.match(/^- Title:\s*(.+)$/m);
      return m ? m[1].trim() : "";
    } catch { return ""; }
  };
  const readTicketMeta = async (filePath) => {
    if (!filePath) return null;
    try {
      const text = await fs.readFile(filePath, "utf8");
      const readScalar = (label) => {
        const match = text.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
        return match ? match[1].trim() : "";
      };
      return {
        title: readScalar("Title"),
        ai: readScalar("AI"),
        executionAi: readScalar("Execution AI"),
        claimedBy: readScalar("Claimed By"),
        stage: readScalar("Stage"),
        prdKey: readScalar("PRD Key")
      };
    } catch {
      return null;
    }
  };
  const inprogressTickets = [];
  try {
    const entries = (await fs.readdir(path.join(ticketsRoot, "inprogress")))
      .filter((name) => /^Todo-\d+\.md$/i.test(name))
      .sort();
    for (const file of entries) {
      const ticketPath = path.join(ticketsRoot, "inprogress", file);
      inprogressTickets.push({
        id: file.replace(/\.md$/, ""),
        path: ticketPath,
        meta: await readTicketMeta(ticketPath)
      });
    }
  } catch {}
  const assignTicketToRunner = async (runner, ticket, fallbackStage = "inprogress") => {
    runner.activeTicketId = ticket.id;
    runner.activeTicketTitle = ticket.meta?.title || await readTitle(ticket.path);
    runner.activeItem = ticket.id;
    runner.activeSpecRef = ticket.meta?.prdKey ? `tickets/done/${ticket.meta.prdKey}/${ticket.meta.prdKey}.md` : runner.activeSpecRef || "";
    if (!runner.activeStage || runner.activeStage.toLowerCase() === "idle") {
      runner.activeStage = ticket.meta?.stage || fallbackStage;
    }
  };
  const clearActiveTicket = (runner) => {
    runner.activeTicketId = "";
    runner.activeTicketTitle = "";
    runner.activeItem = "";
    runner.activeStage = "";
  };
  for (const runner of runners) {
    if (isWorkerRunner(runner)) {
      const byClaim = inprogressTickets.find((ticket) => runnerClaimsTicketFromMeta(runner, ticket.meta));
      const byState = inprogressTickets.find((ticket) => (runner.activeTicketId || "") === ticket.id);
      const unclaimed = inprogressTickets.find((ticket) => !runners.some((candidate) => runnerClaimsTicketFromMeta(candidate, ticket.meta)));
      const ticket = byClaim || byState || (inprogressTickets.length === 1 ? inprogressTickets[0] : unclaimed);
      if (ticket) {
        await assignTicketToRunner(runner, ticket);
      } else {
        clearActiveTicket(runner);
      }
    } else if (runner.role === "verifier") {
      const byClaim = inprogressTickets.find((ticket) => runnerClaimsTicketFromMeta(runner, ticket.meta));
      const byState = inprogressTickets.find((ticket) => (runner.activeTicketId || "") === ticket.id);
      const blockedVerifierTicket = inprogressTickets.find((ticket) => {
        const stage = String(ticket.meta?.stage || "").toLowerCase();
        return stage === "verifying" || (stage === "blocked" && runnerClaimsTicketFromMeta(runner, ticket.meta));
      });
      const ticket = byClaim || byState || blockedVerifierTicket;
      if (ticket) {
        await assignTicketToRunner(runner, ticket, "verifying");
      } else {
        clearActiveTicket(runner);
      }
    } else if (runner.role === "planner") {
      const order = await readFirstMatch(path.join(ticketsRoot, "order"), "order_");
      const prd = order ? "" : await readFirstMatch(path.join(ticketsRoot, "prd"), "prd_");
      const file = order || prd;
      if (file) {
        const id = file.replace(/\.md$/, "");
        runner.activeTicketId = id;
        runner.activeTicketTitle = await readTitle(
          path.join(ticketsRoot, order ? "order" : "prd", file)
        );
        runner.activeItem = id;
        runner.activeStage = "planning";
      } else {
        runner.activeTicketId = "";
        runner.activeTicketTitle = "";
        runner.activeItem = "";
        runner.activeStage = "";
      }
    }
  }
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

function publishBoardChange(scope = {}, reason = "board-change") {
  const projectRoot = scope.projectRoot || "";
  const boardDirName = scope.boardDirName || defaultBoardDirName;
  clearReadBoardCachesForScope({ projectRoot, boardDirName });
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) {
      continue;
    }
    try {
      win.webContents.send("autoflow:boardChange", {
        projectRoot,
        boardDirName,
        reason
      });
    } catch {
      // Renderer may be closing; board polling is the fallback.
    }
  }
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
      publishBoardChange({ projectRoot: options.projectRoot, boardDirName }, "runners/config.local.toml");
    }
    return {
      ...result,
      values,
      configFingerprint: values.config_fingerprint || "",
      configUpdatedAt: values.config_updated_at || values.last_event_at || ""
    };
  });
}

function emitInstallProgress(event, options = {}, stage, label) {
  if (!event?.sender || !label) {
    return;
  }
  try {
    if (event.sender.isDestroyed?.()) {
      return;
    }
    event.sender.send("autoflow:installProgress", {
      invocationId: typeof options.invocationId === "string" ? options.invocationId : "",
      projectRoot: options.projectRoot || "",
      boardDirName: options.boardDirName || defaultBoardDirName,
      stage,
      label
    });
  } catch {
    // The install itself should continue even if the renderer disappears.
  }
}

async function installBoard(options = {}, event = null) {
  if (!options.projectRoot) {
    return {
      ok: false,
      command: "init",
      code: -1,
      stdout: "",
      stderr: "Project root is required."
    };
  }

  if (sameResolvedPath(options.projectRoot, repoRoot)) {
    return {
      ok: false,
      command: "init",
      code: -1,
      stdout: "",
      stderr: "Autoflow 소스 저장소 루트에는 보드를 설치하지 않습니다. 대상 프로젝트 폴더를 선택해 주세요."
    };
  }

  emitInstallProgress(event, options, "init", "Autoflow 보드 파일과 기본 러너를 설치하고 있습니다.");
  const initResult = await runAutoflow("init", options);
  if (!initResult.ok) {
    emitInstallProgress(event, options, "failed", "보드 파일 설치에 실패했습니다.");
    return initResult;
  }

  const followUpStdout = [];
  const followUpStderr = [];

  emitInstallProgress(event, options, "stop-hook", "작업 종료 훅을 설치하고 있습니다.");
  const hookResult = await runAutoflow("install-stop-hook", options);
  followUpStdout.push(`[install-stop-hook]\n${hookResult.stdout || ""}`.trimEnd());
  if (hookResult.stderr) {
    followUpStderr.push(`[install-stop-hook]\n${hookResult.stderr}`.trimEnd());
  }

  emitInstallProgress(event, options, "watcher", "보드 변경 감시를 시작하고 있습니다.");
  const watcherResult = await runAutoflow("watch-bg", options);
  followUpStdout.push(`[watch-bg]\n${watcherResult.stdout || ""}`.trimEnd());
  if (watcherResult.stderr) {
    followUpStderr.push(`[watch-bg]\n${watcherResult.stderr}`.trimEnd());
  }

  emitInstallProgress(event, options, "finalizing", "설치 결과를 정리하고 있습니다.");
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

function sqliteIdentifier(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function sqliteJson(dbPath, sql) {
  return new Promise((resolve, reject) => {
    execFile(
      "sqlite3",
      ["-json", dbPath, sql],
      {
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 32 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message || "sqlite3 failed"));
          return;
        }
        const text = String(stdout || "").trim();
        if (!text) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(text);
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function wikiDatabaseEmptyResult(stderr = "") {
  return {
    ok: false,
    dbPath: "",
    selectedTable: "",
    tables: [],
    columns: [],
    rows: [],
    rowCount: 0,
    limit: 0,
    offset: 0,
    stderr
  };
}

function compactSqliteCell(value) {
  if (value == null) return "";
  const text = String(value);
  return text.length > 2000 ? `${text.slice(0, 2000)}… (${text.length} chars)` : text;
}

async function browseWikiDatabase(options = {}) {
  if (!options.projectRoot) {
    return wikiDatabaseEmptyResult("Project root is required.");
  }
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!isSafeBoardDirName(boardDirName)) {
    return wikiDatabaseEmptyResult("Invalid board directory name.");
  }

  const boardRoot = path.resolve(options.projectRoot, boardDirName);
  const dbPath = path.join(boardRoot, "runners", "state", "wiki-search.db");
  if (!fsSync.existsSync(dbPath)) {
    return {
      ...wikiDatabaseEmptyResult("Wiki search database does not exist. Run wiki index-refresh or upgrade first."),
      dbPath
    };
  }

  try {
    const tableRows = await sqliteJson(
      dbPath,
      [
        "select name, type from sqlite_master",
        "where type in ('table','view') and name not like 'sqlite_%'",
        "order by case",
        "when name='wiki_chunks' then 0",
        "when name='wiki_vectors' then 1",
        "when name='wiki_chunks_fts' then 2",
        "when name='wiki_index_meta' then 3",
        "else 10 end, name"
      ].join(" ")
    );
    const tables = await Promise.all(
      tableRows.map(async (row) => {
        const name = String(row.name || "");
        let rowCount = 0;
        try {
          const countRows = await sqliteJson(dbPath, `select count(*) as count from ${sqliteIdentifier(name)}`);
          rowCount = Number.parseInt(String(countRows[0]?.count || "0"), 10) || 0;
        } catch {
          rowCount = 0;
        }
        return {
          name,
          type: String(row.type || "table"),
          rowCount
        };
      })
    );

    const requestedTable = String(options.table || "").trim();
    const selectedTable =
      tables.find((table) => table.name === requestedTable)?.name ||
      tables.find((table) => table.name === "wiki_chunks")?.name ||
      tables[0]?.name ||
      "";
    if (!selectedTable) {
      return {
        ok: true,
        dbPath,
        selectedTable: "",
        tables,
        columns: [],
        rows: [],
        rowCount: 0,
        limit: 0,
        offset: 0,
        stderr: ""
      };
    }

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(options.limit || "40"), 10) || 40)
    );
    const offset = Math.max(0, Number.parseInt(String(options.offset || "0"), 10) || 0);
    const quotedTable = sqliteIdentifier(selectedTable);
    const columns = (await sqliteJson(dbPath, `pragma table_info(${quotedTable})`)).map((column) => ({
      name: String(column.name || ""),
      type: String(column.type || ""),
      notNull: String(column.notnull || "0") === "1",
      primaryKey: String(column.pk || "0") === "1"
    }));
    const selectedSummary = tables.find((table) => table.name === selectedTable);
    const dataRows = await sqliteJson(
      dbPath,
      `select * from ${quotedTable} limit ${limit} offset ${offset}`
    );
    const rows = dataRows.map((row) => {
      const out = {};
      for (const [key, value] of Object.entries(row || {})) {
        out[key] = compactSqliteCell(value);
      }
      return out;
    });

    return {
      ok: true,
      dbPath,
      selectedTable,
      tables,
      columns,
      rows,
      rowCount: selectedSummary?.rowCount || rows.length,
      limit,
      offset,
      stderr: ""
    };
  } catch (error) {
    return {
      ...wikiDatabaseEmptyResult(error instanceof Error ? error.message : "Failed to read wiki database."),
      dbPath
    };
  }
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
    return handler(options || {}, _event);
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

// PID + PPID + command introspection. Used to tell apart:
//   - dead PID (already gone)
//   - PID reused by an unrelated process (false positive guard)
//   - true orphan runner whose parent died (PPID=1 = launchd/init)
function inspectPidIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return { alive: false, ppid: 0, command: "" };
  try {
    process.kill(pid, 0);
  } catch {
    return { alive: false, ppid: 0, command: "" };
  }
  try {
    const { spawnSync } = require("node:child_process");
    const result = spawnSync("ps", ["-p", String(pid), "-o", "ppid=,command="], {
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (result.status !== 0 || !result.stdout) return { alive: true, ppid: 0, command: "" };
    const line = result.stdout.toString().trim();
    const match = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!match) return { alive: true, ppid: 0, command: "" };
    return { alive: true, ppid: Number.parseInt(match[1], 10) || 0, command: match[2] || "" };
  } catch {
    return { alive: true, ppid: 0, command: "" };
  }
}

// Heuristic: does this command line look like an Autoflow runner adapter?
// Used to avoid killing arbitrary processes if PID has been reused by the OS.
function commandLooksLikeAutoflowRunner(command) {
  if (typeof command !== "string" || !command) return false;
  if (command.includes("autoflow")) return true;
  if (command.includes("app/runtime/runners/")) return true;
  if (command.includes("app/runtime/system/")) return true;
  // adapter CLIs spawned by Autoflow runner processes
  if (/\bgemini\b/.test(command) && command.includes("--prompt")) return true;
  if (/\bcodex\b/.test(command) && command.includes("exec")) return true;
  if (/\bclaude\b/.test(command) && command.includes("--permission-mode")) return true;
  return false;
}

// OS-wide orphan reaper. Runs in whenReady BEFORE IPC handlers so historical
// Autoflow runner daemons left over from a previous desktop session (crash,
// force-quit, kernel sleep) are killed before the new session starts spawning.
// The filename checks below are process signatures only, not active CLI
// entrypoints. This is independent of the
// scope-aware sweep below, which only fires after the renderer has loaded a
// project — too late if the user mashes ▶ during boot.
function reapOrphanLegacyRunnerDaemons() {
  if (process.platform === "win32") return 0;
  let killed = 0;
  try {
    const { spawnSync } = require("node:child_process");
    const result = spawnSync("ps", ["-eo", "pid=,ppid=,command="], {
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (result.status !== 0 || !result.stdout) return 0;
    const lines = result.stdout.toString().split("\n");
    const orphans = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) continue;
      const pid = Number.parseInt(match[1], 10);
      const ppid = Number.parseInt(match[2], 10);
      const command = match[3] || "";
      if (!Number.isInteger(pid) || pid <= 0) continue;
      // Only orphans (parent already dead → re-parented to launchd/init).
      if (ppid !== 1) continue;
      // Only Autoflow runtime drivers or their orphaned adapter children;
      // do not touch arbitrary user shells.
      const isRuntimeDriver =
        command.includes("app/runtime/runners/") ||
        command.includes("app/runtime/system/");
      const isLegacyAdapter = command.includes("Autoflow Local Runner Mode");
      if (!isRuntimeDriver && !isLegacyAdapter) {
        continue;
      }
      orphans.push({ pid, command });
    }
    if (orphans.length === 0) return 0;
    console.log(`[startup-reaper] found ${orphans.length} orphan legacy runner daemon(s)`);
    for (const { pid, command } of orphans) {
      console.log(`[startup-reaper]   killing pid=${pid} cmd=${command.slice(0, 100)}`);
      // Process-group kill first (clean up any lingering claude/codex/gemini
      // children that legacy spawned), then targeted PID kill as fallback.
      try { process.kill(-pid, "SIGTERM"); } catch {}
      try { process.kill(pid, "SIGTERM"); } catch {}
      killed += 1;
    }
    // Brief grace period, then SIGKILL stragglers.
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const stillAlive = orphans.filter(({ pid }) => {
        try { process.kill(pid, 0); return true; } catch { return false; }
      });
      if (stillAlive.length === 0) break;
      // busy-wait (small ms) — runs only at startup, on a single batch
      const waitUntil = Date.now() + 100;
      while (Date.now() < waitUntil) {}
    }
    for (const { pid } of orphans) {
      try { process.kill(pid, 0); } catch { continue; }
      try { process.kill(-pid, "SIGKILL"); } catch {}
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  } catch (err) {
    console.warn("[startup-reaper] failed:", err && err.message ? err.message : err);
  }
  return killed;
}

// Startup-time sweep: any state.state with status=running but PID dead OR
// PID alive with PPID=1 (parent crashed → orphaned to launchd) gets cleaned.
// Same goal as forceKillSurvivingRunners but applies on app start, not quit,
// to recover from crash / red-X / power loss / kill -9.
async function sweepStaleRunnersForScope(scope) {
  const stateDir = path.join(scope.projectRoot, scope.boardDirName, "runners", "state");
  let entries;
  try {
    entries = await fs.readdir(stateDir);
  } catch {
    return 0;
  }
  let cleanedCount = 0;
  for (const name of entries.filter((value) => value.endsWith(".state"))) {
    const filePath = path.join(stateDir, name);
    let content;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const values = parseRunnerStateFile(content);
    if (values.status !== "running") continue;
    const pid = Number.parseInt(values.pid || "", 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      // status=running but no pid recorded → reset
      values.status = "stopped";
      values.pid = "";
      values.last_stop_reason = "startup_no_pid";
      values.last_result = "loop_stopped";
      values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      try { await writeRunnerStateAtomic(filePath, values); } catch {}
      continue;
    }

    const identity = inspectPidIdentity(pid);
    let action = "";
    if (!identity.alive) {
      action = "dead_pid"; // simply reset
    } else if (!commandLooksLikeAutoflowRunner(identity.command)) {
      action = "pid_reused"; // OS reassigned PID; don't touch
    } else if (identity.ppid === 1) {
      action = "orphan"; // parent died → kill the tree
    } else {
      // alive + recognized runner + has live parent → leave it; another desktop
      // (single-instance lock should prevent this, but be defensive)
      continue;
    }

    if (action === "orphan") {
      for (const target of collectProcessTree(pid)) {
        try { process.kill(-target, "SIGKILL"); } catch {}
        try { process.kill(target, "SIGKILL"); } catch {}
      }
    }

    values.status = "stopped";
    values.pid = "";
    values.stopped_by = "";
    values.last_stop_reason = `startup_${action}`;
    values.last_result = "loop_stopped";
    values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    // Also clear active recovery + active ticket — single-flow design:
    // any unfinished blocker should re-emerge through order retry, not as
    // stale state on the new desktop session.
    for (const key of [
      "active_item",
      "active_ticket_id",
      "active_ticket_title",
      "active_stage",
      "active_spec_ref",
      "active_recovery_reason",
      "active_recovery_status",
      "active_recovery_failure_class",
      "active_recovery_worktree_path",
      "active_recovery_worktree_status",
      "active_recovery_board_state"
    ]) {
      values[key] = "";
    }
    try {
      await writeRunnerStateAtomic(filePath, values);
    } catch {}
    cleanedCount += 1;
  }
  return cleanedCount;
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

function killPidForcefully(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  const tree = collectProcessTree(pid);
  if (tree.length === 0) {
    return false;
  }

  for (const target of tree) {
    try {
      process.kill(-target, "SIGKILL");
    } catch {}
    try {
      process.kill(target, "SIGKILL");
    } catch {}
  }

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

const runnerTokenStateDefaults = {
  cumulative_tokens: "0",
  cumulative_total_tokens: "0",
  cumulative_cache_read_tokens: "0",
  cumulative_cache_create_tokens: "0",
  last_turn_tokens: "0",
  last_turn_total_tokens: "0",
  last_turn_input_tokens: "0",
  last_turn_output_tokens: "0",
  last_turn_cache_read_tokens: "0",
  last_turn_cache_create_tokens: "0",
  last_turn_at: "",
  last_turn_tick_id: "",
  token_source: "none",
  last_token_usage_source: "none",
  cumulative_code_files_changed: "0",
  cumulative_code_insertions: "0",
  cumulative_code_deletions: "0",
  cumulative_code_volume: "0",
  cumulative_code_net_delta: "0",
  last_code_ticket_id: "",
  last_code_files_changed: "0",
  last_code_insertions: "0",
  last_code_deletions: "0",
  last_code_volume: "0",
  last_code_net_delta: "0",
  last_code_reported_at: "",
  code_source: "none",
};

const runnerTokenAccountingKeys = [
  "cumulative_tokens",
  "cumulative_total_tokens",
  "cumulative_cache_read_tokens",
  "cumulative_cache_create_tokens",
  "last_turn_tokens",
  "last_turn_total_tokens",
  "last_turn_input_tokens",
  "last_turn_output_tokens",
  "last_turn_cache_read_tokens",
  "last_turn_cache_create_tokens",
  "last_turn_at",
  "last_turn_tick_id",
  "token_source",
  "last_token_usage_source",
];

const runnerCodeAccountingKeys = [
  "cumulative_code_files_changed",
  "cumulative_code_insertions",
  "cumulative_code_deletions",
  "cumulative_code_volume",
  "cumulative_code_net_delta",
  "last_code_ticket_id",
  "last_code_files_changed",
  "last_code_insertions",
  "last_code_deletions",
  "last_code_volume",
  "last_code_net_delta",
  "last_code_reported_at",
  "code_source",
];

function parsePositiveStateInteger(value) {
  const parsed = Number.parseInt(String(value || "0"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function copyStateKeys(target, source, keys, explicitKeys) {
  for (const key of keys) {
    if (explicitKeys.has(key) || !source.has(key)) continue;
    target.set(key, source.get(key));
  }
}

function preserveLatestRunnerAccountingFields(target, latest, explicitKeys) {
  const latestCumulative = parsePositiveStateInteger(latest.get("cumulative_tokens"));
  const targetCumulative = parsePositiveStateInteger(target.get("cumulative_tokens"));
  const latestTokenSource = latest.get("token_source") || "";
  const targetTokenSource = target.get("token_source") || "";
  if (
    isRunnerTokenSourceAuthoritative(latestTokenSource) &&
    (latestCumulative >= targetCumulative || !isRunnerTokenSourceAuthoritative(targetTokenSource))
  ) {
    copyStateKeys(target, latest, runnerTokenAccountingKeys, explicitKeys);
  }

  const latestCodeVolume = parsePositiveStateInteger(latest.get("cumulative_code_volume"));
  const targetCodeVolume = parsePositiveStateInteger(target.get("cumulative_code_volume"));
  if (
    (latest.get("code_source") || "none") !== "none" &&
    (latestCodeVolume > targetCodeVolume || (target.get("code_source") || "none") === "none")
  ) {
    copyStateKeys(target, latest, runnerCodeAccountingKeys, explicitKeys);
  }
}

function serializeRunnerState(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n") + "\n";
}

async function writeRunnerStateAtomic(filePath, values) {
  const nextMap = new Map(Object.entries({ ...runnerTokenStateDefaults, ...values }));
  try {
    const latest = parseStateMap(await fs.readFile(filePath, "utf8"));
    preserveLatestRunnerAccountingFields(nextMap, latest, new Set());
  } catch {}
  const next = Object.fromEntries(nextMap);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, serializeRunnerState(next), "utf8");
  await fs.rename(tmpPath, filePath);
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

async function selfHealStoppedRunnersForScope(_scope) {
  // Disabled in PTY mode (vibe-terminal pattern). Explicit starts in the UI
  // route to runnerPtySpawn, so leaving this no-op forces all runner starts to
  // be user-initiated. To re-enable an auto-restart story under PTY, call
  // ptyManager.start with the runner's resolved config.
  return;
}

async function shutdownRunnersForScope(scope, reason = "parent_terminated", opts = {}) {
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

        if (opts.force ? killPidForcefully(pid) : killPidGracefully(pid)) {
          killedCount += 1;
        }
        if (opts.force) {
          removePtySessionPid(pid);
        }

        values.status = "stopped";
        values.pid = "";
        values.stopped_by = "";
        values.last_stop_reason = reason;
        values.last_result = "loop_stopped";
        values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
        try {
          await writeRunnerStateAtomic(filePath, values);
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

async function closeProjectRunners(options = {}) {
  const projectRoot = String(options.projectRoot || "").trim();
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!projectRoot) {
    return {
      ok: false,
      stoppedCount: 0,
      ptyStoppedCount: 0,
      stateStoppedCount: 0,
      runnerIds: [],
      stderr: "Project root is required."
    };
  }
  if (!isSafeBoardDirName(boardDirName)) {
    return {
      ok: false,
      stoppedCount: 0,
      ptyStoppedCount: 0,
      stateStoppedCount: 0,
      runnerIds: [],
      stderr: "Invalid board directory name."
    };
  }

  const scope = { projectRoot, boardDirName };
  const runnerIds = stopPtyRunnersForScope(scope, { force: true });
  const stateStoppedCount = await shutdownRunnersForScope(scope, "project_tab_closed", { force: true });
  clearReadBoardRunnerListCache(scope);
  publishBoardChange(scope, "project-tab-closed");
  return {
    ok: true,
    stoppedCount: Math.max(runnerIds.length, stateStoppedCount),
    ptyStoppedCount: runnerIds.length,
    stateStoppedCount,
    runnerIds,
    stderr: ""
  };
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
        await writeRunnerStateAtomic(filePath, values);
      } catch {}
    }
  }
}

// Single-instance lock: prevent two desktops from spawning duplicate runners
// against the same project (the leading cause of orphan/zombie runners and
// state-file corruption). Second instance is denied; the running window is
// brought back to focus instead.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", () => {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    if (wins[0].isMinimized()) wins[0].restore();
    wins[0].focus();
  }
});

// Rewrite all state files for currently-alive PTY runners with identity
// fields restored from PtyRunnerManager + ptyRunnerMeta. Used by:
//   - state self-heal interval
//   - powerMonitor.resume after sleep
//   - any time UI shows a live runner as stopped
async function selfHealPtyRunnerStates() {
  try {
    const mgr = globalThis.__autoflowPtyManager;
    if (!mgr) return 0;
    const live = mgr.list().filter((r) => r.status === "running");
    let healed = 0;
    for (const runner of live) {
      const meta = ptyRunnerMeta.get(runner.id);
      if (!meta) continue;
      // writePtyRunnerStateFile applies the defensive merge for missing
      // identity fields automatically. Triggering it with no fields is the
      // simplest way to top up partial state files.
      await writePtyRunnerStateFile(runner.id, {});
      healed += 1;
    }
    return healed;
  } catch {
    return 0;
  }
}

app.whenReady().then(() => {
  // First action: kill any orphan PTY children from the previous session
  // (precise — uses our recorded PID list) and any orphan legacy runner
  // daemons (heuristic — ps -ef pattern match). Must run BEFORE IPC handlers
  // register so the user cannot race a ▶ click against still-living zombies.
  try {
    const ptyReaped = reapPreviousPtySessionPids();
    if (ptyReaped > 0) {
      console.log(`[startup-reaper] reaped ${ptyReaped} orphan PTY pid(s) from previous session`);
    }
  } catch {}

  // powerMonitor: when the system sleeps, PTYs are suspended (not killed) so
  // we just preserve current state. On resume, re-run self-heal in case the
  // OS or watchdogs broke any state file during the suspend window.
  try {
    powerMonitor.on("suspend", () => {
      console.log("[powerMonitor] suspend — preserving last PTY state");
    });
    powerMonitor.on("resume", () => {
      console.log("[powerMonitor] resume — verifying PTY children + state files");
      void selfHealPtyRunnerStates().then((n) => {
        if (n > 0) console.log(`[powerMonitor] resume: self-healed ${n} PTY state file(s)`);
      });
    });
  } catch (err) {
    console.warn("[powerMonitor] hook registration failed:", err && err.message);
  }

  // Periodic state self-heal — recovers from token watcher race wipes,
  // worker AI mistakes editing state files, etc. Default 5 minutes; tunable
  // via AUTOFLOW_STATE_SELFHEAL_MIN.
  const selfHealMin = parseInt(process.env.AUTOFLOW_STATE_SELFHEAL_MIN || "5", 10);
  if (selfHealMin > 0) {
    setInterval(() => {
      void selfHealPtyRunnerStates();
    }, selfHealMin * 60 * 1000);
  }
  try {
    const reaped = reapOrphanLegacyRunnerDaemons();
    if (reaped > 0) {
      console.log(`[startup-reaper] reaped ${reaped} orphan legacy runner daemon(s)`);
    }
  } catch {}
  // Also drop any *.loop.lock dirs left by killed daemons so the next spawn
  // can acquire its lock cleanly. Best-effort; missing dirs are fine.
  try {
    const projectRoot = repoRoot;
    const stateDir = path.join(projectRoot, defaultBoardDirName, "runners", "state");
    if (fsSync.existsSync(stateDir)) {
      for (const name of fsSync.readdirSync(stateDir)) {
        if (!name.endsWith(".loop.lock")) continue;
        const lockDir = path.join(stateDir, name);
        try {
          for (const child of fsSync.readdirSync(lockDir)) {
            try { fsSync.unlinkSync(path.join(lockDir, child)); } catch {}
          }
          fsSync.rmdirSync(lockDir);
        } catch {}
      }
    }
  } catch {}
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
  ipcMain.handle(
    "autoflow:listInstalledAgentProfiles",
    withTimeout(() => readInstalledAgentProfiles(), 30000)
  );
  ipcMain.handle("autoflow:readBoard", withTimeout(withScopeMemory(readBoard), 30000));
  ipcMain.handle("autoflow:installBoard", withScopeMemory(installBoard));
  ipcMain.handle("autoflow:listRunners", withTimeout(withScopeMemory(listRunnersStandalone), 30000));
  ipcMain.handle("autoflow:runnerResourceUsage", withTimeout((_event, options = {}) => runnerResourceUsage(options), 5000));
  ipcMain.handle("autoflow:controlRunner", withScopeMemory(controlRunner));
  ipcMain.handle(
    "autoflow:closeProjectRunners",
    withTimeout((_event, options = {}) => closeProjectRunners(options), 30000)
  );
  ipcMain.handle(
    "autoflow:listRunnerArtifacts",
    withTimeout(withScopeMemory(listRunnerArtifacts), 30000)
  );
  ipcMain.handle("autoflow:runRole", withScopeMemory(runRole));
  ipcMain.handle("autoflow:configureRunner", withScopeMemory(configureRunner));
  ipcMain.handle("autoflow:createRunner", withScopeMemory(createRunner));
  ipcMain.handle("autoflow:continueRunnerAuth", withScopeMemory(continueRunnerAuth));
  ipcMain.handle("autoflow:controlWiki", withScopeMemory(controlWiki));
  ipcMain.handle("autoflow:browseWikiDatabase", withTimeout(withScopeMemory(browseWikiDatabase), 30000));
  ipcMain.handle("autoflow:writeMetricsSnapshot", withScopeMemory(writeMetricsSnapshot));
  ipcMain.handle("autoflow:controlStopHook", withScopeMemory(controlStopHook));
  ipcMain.handle("autoflow:controlWatcher", withScopeMemory(controlWatcher));
  ipcMain.handle("autoflow:readBoardFile", withTimeout(withScopeMemory(readBoardFile), 30000));
  ipcMain.handle("autoflow:readStartupRules", withTimeout(withScopeMemory(readStartupRules), 10000));
  ipcMain.handle("autoflow:writeStartupRules", withTimeout(withScopeMemory(writeStartupRules), 10000));
  // ArrivalGauge (PRD_285, 2026-05-12): the renderer computes arrival metrics
  // directly from the board snapshot's tickets.order array (retry order filenames).
  // No extra IPC handler is needed; readBoard already delivers the order file list.
  // board-watcher fires on every tickets/ change so the gauge refreshes in real time.
  // manual_order_196 (2026-05-09): live stdout tail. Reads the LAST maxBytes
  // of a board file (default 16KB) so a polling renderer can show a real-time
  // terminal view of a runner's adapter stdout without stale 196KB head.
  ipcMain.handle(
    "autoflow:tailBoardFile",
    withTimeout(
      withScopeMemory(async (options = {}) => {
        const projectRoot = options.projectRoot || "";
        const filePath = options.filePath || "";
        const boardDirNameRaw = options.boardDirName || defaultBoardDirName;
        const maxBytesRaw = Number(options.maxBytes);
        const maxBytes =
          Number.isFinite(maxBytesRaw) && maxBytesRaw > 0
            ? Math.min(Math.floor(maxBytesRaw), 256 * 1024)
            : 16 * 1024;
        const empty = {
          ok: false,
          filePath: "",
          name: "",
          content: "",
          truncated: false,
          modifiedAt: "",
          size: 0,
          stderr: ""
        };
        if (!projectRoot || !filePath) {
          return { ...empty, stderr: "projectRoot and filePath are required." };
        }
        if (!isSafeBoardDirName(boardDirNameRaw)) {
          return { ...empty, stderr: "Invalid board directory name." };
        }
        const boardRoot = path.resolve(projectRoot, boardDirNameRaw);
        const confinedPath = await resolveExistingPathInside(boardRoot, filePath);
        const targetPath = confinedPath.targetPath;
        if (!confinedPath.ok) {
          return {
            ...empty,
            filePath: targetPath,
            name: path.basename(targetPath),
            stderr: confinedPath.stderr
          };
        }
        if (!allowedBoardFileExtensions.has(path.extname(targetPath))) {
          return {
            ...empty,
            filePath: targetPath,
            name: path.basename(targetPath),
            stderr: "Only markdown, log, and metrics JSONL files can be tailed."
          };
        }
        try {
          const stat = await fs.stat(targetPath);
          if (!stat.isFile()) {
            return {
              ...empty,
              filePath: targetPath,
              name: path.basename(targetPath),
              modifiedAt: stat.mtime.toISOString(),
              size: stat.size,
              stderr: "Path is not a file."
            };
          }
          const startOffset = Math.max(0, stat.size - maxBytes);
          const bytesToRead = stat.size - startOffset;
          const buffer = Buffer.alloc(bytesToRead);
          const handle = await fs.open(targetPath, "r");
          try {
            const { bytesRead } = await handle.read(buffer, 0, bytesToRead, startOffset);
            return {
              ok: true,
              filePath: targetPath,
              name: path.basename(targetPath),
              content: buffer.subarray(0, bytesRead).toString("utf8"),
              truncated: startOffset > 0,
              modifiedAt: stat.mtime.toISOString(),
              size: stat.size,
              stderr: ""
            };
          } finally {
            await handle.close();
          }
        } catch (error) {
          return {
            ...empty,
            filePath: targetPath,
            name: path.basename(targetPath),
            stderr: error && error.message ? String(error.message) : "tail failed"
          };
        }
      }),
      10000
    )
  );
  ipcMain.handle("autoflow:deleteOrderFile", withScopeMemory(deleteOrderFile));
  ipcMain.handle(
    "autoflow:projectExists",
    withTimeout(async (_event, projectRoot) => {
      const normalizedRoot = typeof projectRoot === "string" ? projectRoot.trim() : "";
      return { exists: await pathExists(normalizedRoot) };
    }, 5000)
  );
  // PRD 10 (2026-05-09): origin ledger search bridge.
  // Delegates to `autoflow origin <sub> [projectRoot] [boardDirName] ...`.
  // Returns the raw stdout (key=value or sqlite -column table) plus exit code
  // so the renderer can parse it. Phase 1 surface; phase 2 will add a panel.
  ipcMain.handle(
    "autoflow:origin",
    withTimeout(withScopeMemory(async (options = {}) => {
      const projectRoot = options.projectRoot || "";
      const boardDirName = options.boardDirName || defaultBoardDirName;
      const sub = typeof options.sub === "string" ? options.sub.trim() : "status";
      const allowedSubs = new Set(["status", "list", "search", "of-ticket", "of-commit", "sync"]);
      if (!allowedSubs.has(sub)) {
        return {
          ok: false,
          command: `origin ${sub}`,
          code: -1,
          stdout: "",
          stderr: `Unsupported origin subcommand: ${sub}`
        };
      }
      const args = ["origin", sub];
      if (projectRoot) {
        args.push(projectRoot, boardDirName);
      }
      if (Array.isArray(options.args)) {
        for (const arg of options.args) {
          args.push(String(arg));
        }
      }
      return await runAutoflowArgs(args, {});
    }), 30000)
  );
  // Cancel a still-running long IPC call by invocationId. No timeout: the
  // call must always be reachable so the user can recover from a hung action.
  ipcMain.handle("autoflow:cancelInvocation", (_event, invocationId) =>
    cancelInvocation(invocationId)
  );

  // ----- PTY runner manager (vibe-terminal pattern) -----
  // One pty.spawn() per runner. Renderer subscribes via push events
  //   autoflow:runnerPtyBytes  { runnerId, projectRoot, boardDirName, data }   — main → renderer
  //   autoflow:runnerPtyStatus { runnerId, projectRoot, boardDirName, status, pid?, exitCode?, signal? }
  // Renderer-callable commands:
  //   autoflow:runnerPtyStart   disabled legacy low-level start path
  //   autoflow:runnerPtyStop    { runnerId, projectRoot?, boardDirName?, force? }
  //   autoflow:runnerPtyInput   { runnerId, projectRoot?, boardDirName?, data }  — raw scoped stdin bytes
  //   autoflow:runnerPtySnapshot { runnerId, projectRoot?, boardDirName? } → string
  //   autoflow:runnerPtyList     → [{ id, status, pid, ... }]
  // writePrompt() remains main-process only for automation prompts.
  globalThis.__autoflowPtyManager = globalThis.__autoflowPtyManager || new PtyRunnerManager();
  const ptyManager = globalThis.__autoflowPtyManager;
  const broadcastPty = (channel, payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try { win.webContents.send(channel, payload); } catch {}
      }
    }
  };
  ptyManager.on("bytes", ({ runnerId, data }) => {
    broadcastPty("autoflow:runnerPtyBytes", ptyRunnerScopedPayload(runnerId, { data }));
    for (const usage of ptyUsageReportsFromChunk(runnerId, data)) {
      reportPtyUsageViaRunnerTool(runnerId, usage);
    }
  });
  ptyManager.on("status", (payload) => {
    const scopedPayload = ptyRunnerScopedPayload(payload.runnerId, payload);
    broadcastPty("autoflow:runnerPtyStatus", scopedPayload);
    // Mirror status into runner state file so legacy UI bindings keep working.
    const fields = {
      status: payload.status === "running" ? "running" : "stopped",
      pid: payload.status === "running" ? String(payload.pid || "") : "",
      last_event_at: new Date().toISOString()
    };
    if (payload.status === "stopped") {
      fields.last_result = payload.signal
        ? `signal_${payload.signal}`
        : (typeof payload.exitCode === "number" ? `exit_${payload.exitCode}` : "user_stopped");
    }
    void writePtyRunnerStateFile(payload.runnerId, fields);
    if (payload.status === "stopped") {
      ptyRunnerMeta.delete(payload.runnerId);
      ptyTokenUsageParseState.delete(payload.runnerId);
      // Drop from precise reaper registry — PID is dead.
      if (Number.isInteger(payload.pid) && payload.pid > 0) {
        try { removePtySessionPid(payload.pid); } catch {}
      }
    }
  });
  ptyManager.on("error", ({ runnerId, error }) => {
    broadcastPty("autoflow:runnerPtyStatus", ptyRunnerScopedPayload(runnerId, {
      status: "errored",
      error: String(error && error.message ? error.message : error)
    }));
  });

  ipcMain.handle("autoflow:runnerPtyStart", () => ({
    ok: false,
    error: "Direct PTY start is disabled; use runnerPtySpawn."
  }));

  // Higher-level "spawn runner in PTY mode" — renderer passes runner config
  // (agent / model / reasoning / role / projectRoot / boardDirName), main
  // builds the CLI command and the initial prompt, then writes the prompt to
  // stdin after the CLI is ready. This is the path for runners that should use
  // user-visible PTY process + LLM-driven runner turn.
  ipcMain.handle("autoflow:runnerPtySpawn", async (_event, opts = {}) => {
    console.log("[autoflow:runnerPtySpawn] called", opts);
    if (!ptyManager.isAvailable()) {
      console.warn("[autoflow:runnerPtySpawn] node-pty unavailable");
      return { ok: false, error: "node-pty unavailable (rebuild required)" };
    }
    const projectRoot = String(opts.projectRoot || "");
    const boardDirName = String(opts.boardDirName || ".autoflow");
    const runnerId = String(opts.runnerId || "");
    if (!runnerId || !projectRoot) {
      return { ok: false, error: "runnerId and projectRoot required" };
    }
    const diskRunnerConfig = readRunnerConfigBlock(projectRoot, boardDirName, runnerId);
    const role = String(diskRunnerConfig.role || opts.role || inferRunnerRoleFromId(runnerId));
    const normalizedRole = normalizeRunnerRole(role);
    if (normalizedRole === "coordinator") {
      return { ok: false, error: "coordinator is not a runner; use planner, worker, verifier, or wiki runners." };
    }
    const agent = String(diskRunnerConfig.agent || opts.agent || "codex").toLowerCase();
    const model = String(diskRunnerConfig.model ?? opts.model ?? "");
    const reasoning = String(diskRunnerConfig.reasoning ?? opts.reasoning ?? "");
    const codexHistory = normalizeCodexHistoryMode(diskRunnerConfig.codex_history ?? opts.codexHistory ?? "");
    if (!(await commandExists(agent))) {
      return { ok: false, error: `${agent} CLI not found in shell PATH` };
    }
    const command = buildAgentCliCommand(agent, model, reasoning, { boardDirName });
    if (!command) {
      return { ok: false, error: `unsupported agent: ${agent}` };
    }
    try {
      const existing = ptyManager.get(runnerId);
      const existingMatchesScope = ptyRunnerMatchesRequestedScope(ptyManager, runnerId, {
        projectRoot,
        boardDirName
      });
      const freshSessionRequested = Boolean(opts.freshSession) || normalizedRole === "wiki-maintainer";
      if (
        existing &&
        existing.status === "running" &&
        (freshSessionRequested || !existingMatchesScope || (existing.command && existing.command !== command))
      ) {
        if (Number.isInteger(existing.pid) && existing.pid > 0) {
          killPidForcefully(existing.pid);
          removePtySessionPid(existing.pid);
        }
        ptyManager.stop(runnerId, { force: true });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const runnerEnv = buildRunnerPtyEnv({
        agent,
        runnerId,
        role: normalizedRole,
        projectRoot,
        boardDirName,
        codexHistory
      });
      const runner = ptyManager.start(runnerId, {
        command,
        cwd: projectRoot,
        cols: Number.isFinite(opts.cols) ? opts.cols : 120,
        rows: Number.isFinite(opts.rows) ? opts.rows : 30,
        logsDir: path.join(projectRoot, boardDirName, "runners", "logs"),
        env: runnerEnv.env
      });
      const startedAt = new Date().toISOString();
      ptyRunnerMeta.set(runnerId, {
        role: normalizedRole,
        agent,
        projectRoot,
        boardDirName,
        codexHome: runnerEnv.codexHome,
        codexHistory: runnerEnv.codexHistory,
        startedAt
      });
      // Initial state — UI immediately reflects "running"
      void writePtyRunnerStateFile(runnerId, {
        id: runnerId,
        status: "running",
        role: normalizedRole,
        agent,
        model,
        reasoning,
        mode: "pty",
        pid: String(runner.pid || ""),
        started_at: startedAt,
        codex_home: runnerEnv.codexHome || "",
        codex_history: runnerEnv.codexHistory || "",
        last_stdout_log: runner.liveStdoutLog || "",
        last_event_at: startedAt,
        last_result: ""
      });
      // Record PID in precise reaper registry so a desktop crash next time
      // leaves the next session a clean kill list.
      try {
        addPtySessionPid({ pid: runner.pid, runnerId, role: normalizedRole, agent, spawnedAt: startedAt });
      } catch {}
      // Wait for the agent CLI to load its TUI before pushing the initial
      // prompt. Different CLIs take different times to be ready for input:
      //   - claude: ~2s for welcome banner
      //   - codex: ~3s for TUI mount
      //   - gemini: ~5s — TUI box renders fast but input handler isn't
      //     attached until later; writes before then are silently dropped.
      // Use the conservative max so all three reliably accept the first
      // prompt. Empirically:
      //   - claude: ready in ~2s
      //   - codex:  ready in ~3s
      //   - gemini: TUI mount fast but input handler attaches later (~6s).
      //     Below that, the prompt write returns ok=true but the chars get
      //     swallowed before the input box accepts focus, so the PTY sits
      //     idle forever with empty input box.
      // Use agent-specific delay so we wait long enough for gemini without
      // making claude / codex lazy.
      const PROMPT_INJECT_DELAY_MS = agent === "gemini" ? 10000 : 6000;
      const initialPrompt = buildInitialPrompt({
        role: normalizedRole,
        agent,
        runnerId,
        projectRoot,
        boardDirName
      });
      setTimeout(() => {
        const paste = agent === "claude" ? "bracketed" : "plain";
        const ok = ptyManager.writePrompt(runnerId, initialPrompt, { paste });
        if (ok) markRunnerInitialPromptSent(runnerId);
        console.log(`[ptySpawn] initial prompt write → runnerId=${runnerId} agent=${agent} paste=${paste} ok=${ok} bytes=${initialPrompt.length}`);
      }, PROMPT_INJECT_DELAY_MS);
      // Diagnostic: dump PTY buffer 2.5s AFTER prompt write so we can see
      // whether the TUI accepted it (text in input box / model response /
      // mojibake / nothing).
      setTimeout(() => {
        try {
          const snap = ptyManager.snapshot(runnerId) || "";
          console.log(`[ptySpawn] runner=${runnerId} buffer-tail (last 600 chars):\n${snap.slice(-600)}`);
        } catch (err) {
          console.log(`[ptySpawn] runner=${runnerId} snapshot error:`, err && err.message);
        }
      }, PROMPT_INJECT_DELAY_MS + 2500);
      return { ok: true, runnerId: runner.id, pid: runner.pid, status: runner.status };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle("autoflow:runnerPtyStop", (_event, opts = {}) => {
    if (!ptyRunnerMatchesRequestedScope(ptyManager, opts.runnerId, opts)) {
      return { ok: false, error: "runner scope mismatch" };
    }
    if (opts.force) {
      const runner = typeof ptyManager.get === "function" ? ptyManager.get(opts.runnerId) : null;
      if (Number.isInteger(runner?.pid) && runner.pid > 0) {
        killPidForcefully(runner.pid);
        removePtySessionPid(runner.pid);
      }
    }
    return { ok: ptyManager.stop(opts.runnerId, { force: !!opts.force }) };
  });
  ipcMain.handle("autoflow:runnerPtyResize", (_event, opts = {}) => {
    if (!ptyRunnerMatchesRequestedScope(ptyManager, opts.runnerId, opts)) {
      return { ok: false };
    }
    const ok = ptyManager.resize(opts.runnerId, opts.cols, opts.rows);
    return { ok };
  });
  ipcMain.handle("autoflow:runnerPtyInput", (_event, opts = {}) => {
    const runnerId = String(opts.runnerId || "");
    const data = String(opts.data || "");
    if (!runnerId) {
      return { ok: false, error: "runnerId required" };
    }
    if (!data) {
      return { ok: false, error: "data required" };
    }
    if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerId, opts)) {
      return { ok: false, error: "runner scope mismatch" };
    }
    const ok = ptyManager.writeInput(runnerId, data);
    return ok ? { ok: true } : { ok: false, error: "runner not running" };
  });
  ipcMain.handle("autoflow:runnerPtySnapshot", (_event, opts = {}) => {
    if (!ptyRunnerMatchesRequestedScope(ptyManager, opts.runnerId, opts)) {
      return { snapshot: "" };
    }
    return { snapshot: ptyManager.snapshot(opts.runnerId) };
  });
  ipcMain.handle("autoflow:runnerPtyList", () => {
    return { runners: ptyManager.list() };
  });

  createWindow();
  startMemoryCeilingMonitor();

  // Auto-spawn runners on startup when AUTOFLOW_AUTO_SPAWN_RUNNERS=1.
  // Reads runners/config.local.toml (or config.toml as fallback) for the
  // enabled runner list, then drives the same code path as a UI ▶ click.
  // Useful when the renderer hasn't loaded yet or after a hard restart
  // where stuck PTYs were force-killed.
  if (process.env.AUTOFLOW_AUTO_SPAWN_RUNNERS === "1") {
    setTimeout(async () => {
      try {
        const projectRoot = repoRoot;
        const boardDirName = defaultBoardDirName;
        const configPath = (() => {
          const local = path.join(projectRoot, boardDirName, "runners", "config.local.toml");
          const base = path.join(projectRoot, boardDirName, "runners", "config.toml");
          return fsSync.existsSync(local) ? local : base;
        })();
        const text = fsSync.readFileSync(configPath, "utf8");
        // Minimal TOML scrape for [[runners]] blocks. We only need id /
        // agent / model / reasoning / role / enabled per block.
        const blocks = text.split(/\[\[runners\]\]/).slice(1);
        for (const blk of blocks) {
          const grab = (k) => {
            const m = blk.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\n]+)"?`, "m"));
            return m ? m[1].trim() : "";
          };
          const enabled = grab("enabled");
          if (enabled !== "true") continue;
          const runnerId = grab("id");
          const agent = grab("agent") || "codex";
          const model = grab("model") || "";
          const reasoning = grab("reasoning") || "";
          const codexHistory = normalizeCodexHistoryMode(grab("codex_history"));
          if (!runnerId) continue;
          const role = normalizeRunnerRole(grab("role") || inferRunnerRoleFromId(runnerId));
          if (ptyManager.list().some((r) => r.id === runnerId && r.status === "running")) {
            console.log(`[auto-spawn] ${runnerId} already running; skip`);
            continue;
          }
          const preflight = await runRunnerStartupPreflight({
            runnerId,
            role,
            projectRoot,
            boardDirName
          });
          if (preflight.ok && preflight.values.decision === "skip") {
            console.log(`[auto-spawn] ${runnerId} preflight idle; skip PTY spawn`);
            continue;
          }
          if (!preflight.ok) {
            console.warn(`[auto-spawn] ${runnerId} preflight failed; falling back to PTY spawn`);
          }
          if (!(await commandExists(agent))) {
            console.warn(`[auto-spawn] ${runnerId} skipped: ${agent} CLI not found in shell PATH`);
            continue;
          }
          const command = buildAgentCliCommand(agent, model, reasoning, { boardDirName });
          if (!command) continue;
          const startedAt = new Date().toISOString();
          const runnerEnv = buildRunnerPtyEnv({
            agent,
            runnerId,
            role,
            projectRoot,
            boardDirName,
            codexHistory
          });
          const runner = ptyManager.start(runnerId, {
            command,
            cwd: projectRoot,
            cols: 120,
            rows: 30,
            logsDir: path.join(projectRoot, boardDirName, "runners", "logs"),
            env: runnerEnv.env
          });
          ptyRunnerMeta.set(runnerId, {
            role,
            agent,
            projectRoot,
            boardDirName,
            codexHome: runnerEnv.codexHome,
            codexHistory: runnerEnv.codexHistory,
            startedAt
          });
          await writePtyRunnerStateFile(runnerId, {
            id: runnerId, status: "running", role, agent, model, reasoning,
            mode: "pty", pid: String(runner.pid || ""), started_at: startedAt,
            codex_home: runnerEnv.codexHome || "",
            codex_history: runnerEnv.codexHistory || "",
            last_stdout_log: runner.liveStdoutLog || "",
            last_event_at: startedAt
          });
          try { addPtySessionPid({ pid: runner.pid, runnerId, role, agent, spawnedAt: startedAt }); } catch {}
          const initialPrompt = buildInitialPrompt({ role, agent, runnerId, projectRoot, boardDirName });
          const promptDelay = agent === "gemini" ? 10000 : 6000;
          setTimeout(() => {
            const paste = agent === "claude" ? "bracketed" : "plain";
            const ok = ptyManager.writePrompt(runnerId, initialPrompt, { paste });
            if (ok) markRunnerInitialPromptSent(runnerId);
          }, promptDelay);
          console.log(`[auto-spawn] ${runnerId} started (pid=${runner.pid}, agent=${agent})`);
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch (err) {
        console.warn("[auto-spawn] failed:", err && err.message);
      }
    }, 1500);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit-time cleanup — vibe-terminal pattern: synchronous PTY kill, no
// event.preventDefault, no async race. node-pty's IPty.kill() is synchronous
// (sends SIGKILL immediately) so we can hang the entire teardown off the
// before-quit / will-quit ticks and let Electron quit naturally afterwards.
// The previous implementation called preventDefault() and then awaited an
// async shutdownAllRunners() race; if anything in that chain hung, the app
// would refuse to close.
let appShutdownCleanupRun = false;
function runShutdownCleanupSync(reason) {
  if (appShutdownCleanupRun) return;
  appShutdownCleanupRun = true;
  if (memoryCeilingIntervalId) {
    try { clearInterval(memoryCeilingIntervalId); } catch {}
    memoryCeilingIntervalId = null;
  }
  // 1. Kill our PTY children (zsh + claude/codex/gemini). Synchronous.
  try {
    if (globalThis.__autoflowPtyManager) {
      globalThis.__autoflowPtyManager.shutdown();
    }
  } catch {}
  // 2. Stop fs.watch listeners.
  try { disposeAllBoardWatchers(); } catch {}
  // 3. Drop the precise PTY PID registry — children are dead.
  try { clearPtySessionPids(); } catch {}
  // 4. Mark this session as cleanly shut down so next-boot reaper does not
  //    over-probe.
  try { markDesktopSessionClean(reason || "quit"); } catch {}
}

app.on("before-quit", () => {
  runShutdownCleanupSync("before-quit");
});

app.on("will-quit", () => {
  runShutdownCleanupSync("will-quit");
});

// Force quit on all-windows-closed (including macOS) so before-quit fires
// our synchronous PTY teardown. The macOS dock-keep convention is intentionally
// dropped — leaving the app idle in the dock while PTY children stay spawned
// causes orphan/zombie process drift after crashes or background unloads.
app.on("window-all-closed", () => {
  app.quit();
});
