const { app, BrowserWindow, dialog, ipcMain, nativeImage, powerMonitor, screen: electronScreen } = require("electron");
const { spawn, execFile, spawnSync } = require("node:child_process");
const nodeCrypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const parcelWatcher = require("@parcel/watcher");
const os = require("node:os");
const path = require("node:path");
const { PtyRunnerManager } = require("./main/runner-pty-manager");
const runnerTokensApi = require("../runtime/system/runner-tokens");

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
// Propagate the resolved repoRoot so CLI helpers loaded in-process (via
// runAutoflowInProcess below) compute REPO_ROOT/CLI_DIR from the desktop's
// argv chain rather than from a path that points at app/src.
process.env.AUTOFLOW_REPO_ROOT = repoRoot;
const scaffoldManifestPath = path.join(repoRoot, "install", "manifest.toml");
const desktopRoot = path.join(repoRoot, "app");
const appIconPath = path.join(desktopRoot, "src", "renderer", "assets", "app", "app-icon.png");
const windowStateFileName = "window-state.json";
const desktopSessionStateFileName = "desktop-session-state.json";

function autoflowBinPath() {
  return path.join(repoRoot, "app", "bin", "autoflow");
}

function useElectronAsNodeRuntime() {
  return Boolean(process.versions && process.versions.electron);
}

function cliInvocation(args) {
  const cliArgs = args.map((arg) => String(arg));
  if (useElectronAsNodeRuntime()) {
    return {
      command: process.execPath,
      args: [autoflowBinPath(), ...cliArgs],
      env: { ELECTRON_RUN_AS_NODE: "1" }
    };
  }

  return {
    command: autoflowBinPath(),
    args: cliArgs,
    env: {}
  };
}

function requiredTsxCliPath() {
  try {
    return require.resolve("tsx/cli", { paths: [repoRoot] });
  } catch {
    return "";
  }
}

function runtimeTsInvocation(relativeScriptPath, args) {
  const tsxCli = requiredTsxCliPath();
  if (!tsxCli) {
    return cliInvocation(["tool", "runner-tokens", ...args]);
  }
  const scriptPath = path.join(repoRoot, "app", "runtime", relativeScriptPath);
  return {
    command: process.execPath,
    args: [tsxCli, scriptPath, ...args.map((arg) => String(arg))],
    env: useElectronAsNodeRuntime() ? { ELECTRON_RUN_AS_NODE: "1" } : {}
  };
}

function runnerTokensInvocation(args) {
  return runtimeTsInvocation("system/runner-tokens.ts", args);
}

function sessionTokenUsageImportDelayMs() {
  const configured = Number(process.env.AUTOFLOW_SESSION_TOKEN_USAGE_IMPORT_DEBOUNCE_MS || "");
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 60000;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function shellScriptSingleQuote(value) {
  return shellQuote(value);
}

function uniquePathEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const value = String(entry || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function existingDirEntries(entries) {
  return entries.filter((entry) => {
    try {
      return entry && fsSync.existsSync(entry) && fsSync.statSync(entry).isDirectory();
    } catch {
      return false;
    }
  });
}

function nvmNodeBinEntries(homeDir) {
  const versionsRoot = path.join(homeDir, ".nvm", "versions", "node");
  try {
    return fsSync
      .readdirSync(versionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionsRoot, entry.name, "bin"));
  } catch {
    return [];
  }
}

function augmentedPathValue(basePath = process.env.PATH || "") {
  const homeDir = os.homedir();
  const baseEntries = String(basePath || "").split(path.delimiter).filter(Boolean);
  const candidateEntries = [
    ...baseEntries,
    ...nvmNodeBinEntries(homeDir),
    path.join(homeDir, ".local", "bin"),
    path.join(homeDir, ".npm-global", "bin"),
    path.join(homeDir, ".npm", "bin"),
    path.join(homeDir, ".yarn", "bin"),
    path.join(homeDir, ".config", "yarn", "global", "node_modules", ".bin"),
    path.join(homeDir, ".bun", "bin"),
    path.join(homeDir, ".volta", "bin"),
    path.join(homeDir, "Library", "pnpm"),
    path.join(homeDir, ".local", "share", "pnpm"),
    path.join(homeDir, ".local", "share", "mise", "shims"),
    path.join(homeDir, ".asdf", "shims"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin"
  ];
  return uniquePathEntries(existingDirEntries(candidateEntries)).join(path.delimiter);
}

function pathWithPrependedEntries(entries, basePath = process.env.PATH || "") {
  const baseEntries = String(basePath || "").split(path.delimiter).filter(Boolean);
  return uniquePathEntries(existingDirEntries([...entries, ...baseEntries])).join(path.delimiter);
}

function ensureAutoflowCliShim({ projectRoot, boardDirName }) {
  const boardRoot = path.join(projectRoot, boardDirName);
  const binDir = path.join(boardRoot, "runners", "state", "bin");
  const shimPath = path.join(binDir, "autoflow");
  const nodeRuntime = useElectronAsNodeRuntime() ? process.execPath : "";
  const cliEntry = autoflowBinPath();
  const needsElectron = useElectronAsNodeRuntime() ? "1" : "0";
  const content = [
    "#!/bin/sh",
    "# Generated by Autoflow Desktop. Do not edit.",
    "set -eu",
    `AUTOFLOW_NODE_RUNTIME=${shellScriptSingleQuote(nodeRuntime)}`,
    `AUTOFLOW_CLI_ENTRY=${shellScriptSingleQuote(cliEntry)}`,
    `AUTOFLOW_CLI_NEEDS_ELECTRON=${shellScriptSingleQuote(needsElectron)}`,
    'if [ "$AUTOFLOW_CLI_NEEDS_ELECTRON" = "1" ]; then',
    '  ELECTRON_RUN_AS_NODE=1 exec "$AUTOFLOW_NODE_RUNTIME" "$AUTOFLOW_CLI_ENTRY" "$@"',
    "fi",
    'if [ -x "$AUTOFLOW_CLI_ENTRY" ]; then',
    '  exec "$AUTOFLOW_CLI_ENTRY" "$@"',
    "fi",
    'if [ -n "$AUTOFLOW_NODE_RUNTIME" ]; then',
    '  exec "$AUTOFLOW_NODE_RUNTIME" "$AUTOFLOW_CLI_ENTRY" "$@"',
    "fi",
    'echo "Autoflow CLI entry is not executable: $AUTOFLOW_CLI_ENTRY" >&2',
    "exit 127",
    ""
  ].join("\n");
  try {
    fsSync.mkdirSync(binDir, { recursive: true });
    let existing = "";
    try {
      existing = fsSync.readFileSync(shimPath, "utf8");
    } catch {}
    if (existing !== content) {
      fsSync.writeFileSync(shimPath, content, "utf8");
    }
    fsSync.chmodSync(shimPath, 0o755);
    return { binDir, shimPath, ok: true, error: "" };
  } catch (error) {
    return {
      binDir,
      shimPath: "",
      ok: false,
      error: error && error.message ? String(error.message) : String(error)
    };
  }
}

function executableOnPath(command, env = process.env) {
  const value = String(command || "").trim();
  if (!value) return "";
  const candidates = value.includes("/") || value.includes("\\")
    ? [value]
    : String(env.PATH || "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, value));
  for (const candidate of candidates) {
    try {
      fsSync.accessSync(candidate, fsSync.constants.X_OK);
      return candidate;
    } catch {}
  }
  return "";
}

function userLoginShell() {
  if (process.env.SHELL) return process.env.SHELL;
  try {
    return os.userInfo().shell || "/bin/zsh";
  } catch {
    return "/bin/zsh";
  }
}

function loginShellCommandArgs(shellPath, command) {
  const shellName = path.basename(String(shellPath || ""));
  if (["bash", "zsh", "fish"].includes(shellName)) {
    return ["-lic", command];
  }
  return ["-lc", command];
}

function autoflowShellCommand(args) {
  return [`"$AUTOFLOW_CLI"`, ...args.map((arg) => shellQuote(arg))].join(" ");
}

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
const runnerLogPreviewReadLimitBytes = 16 * 1024;
const allowedBoardFileExtensions = new Set([".md", ".log", ".jsonl", ".json", ".env"]);
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
  /\bsign in required\b/i,
  /로그인(?:이)? 필요/i
];
const claudeSubscriptionDisabledPattern =
  /organization has disabled Claude subscription access|Claude subscription access.*disabled|Use an Anthropic API key instead/i;
const authUrlPattern = /https?:\/\/[^\s<>"'`)\]]+/gi;
const agentDisplayLabels = {
  codex: "Codex",
  claude: "Claude"
};
const codexRunnerHistoryModes = new Set(["isolated", "shared"]);
const metricSnapshotKeys = [
  "ticket_total",
  "spec_total",
  "ticket_done_count",
  "active_ticket_count",
  "retry_order_count",
  "handoff_count",
  "autoflow_code_files_changed_count",
  "autoflow_code_insertions_count",
  "autoflow_code_deletions_count",
  "autoflow_code_volume_count",
  "autoflow_code_net_delta_count",
  "autoflow_token_usage_count",
  "autoflow_token_total_count",
  "autoflow_token_cache_read_count",
  "autoflow_token_cache_create_count",
  "completion_rate_percent"
];

const metricSnapshotStringKeys = new Set([
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

function readRunnerConfigBlocks(projectRoot, boardDirName) {
  if (!projectRoot) return [];
  const configPath = (() => {
    const local = path.join(projectRoot, boardDirName || defaultBoardDirName, "runners", "config.local.toml");
    const base = path.join(projectRoot, boardDirName || defaultBoardDirName, "runners", "config.toml");
    return fsSync.existsSync(local) ? local : base;
  })();
  let text = "";
  try {
    text = fsSync.readFileSync(configPath, "utf8");
  } catch {
    return [];
  }
  const blocks = text.split(/\[\[runners\]\]/).slice(1);
  const runners = [];
  for (const block of blocks) {
    const values = {};
    for (const rawLine of block.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!match) continue;
      values[match[1]] = parseTomlStringValue(match[2]);
    }
    if (values.id) runners.push(values);
  }
  return runners;
}

function readRunnerConfigBlock(projectRoot, boardDirName, runnerId) {
  if (!projectRoot || !runnerId) return {};
  for (const values of readRunnerConfigBlocks(projectRoot, boardDirName)) {
    if (values.id === runnerId) {
      return values;
    }
  }
  return {};
}

function runnerConfigBoolean(value, fallback = true) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
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
const readBoardSnapshotCacheTtlMs = 1000;
const readBoardSnapshotCache = new Map();
const readBoardRunnerListCacheTtlMs = 15 * 1000;
const standaloneRunnerListCacheTtlMs = 2 * 1000;
const selfHealStoppedRunnersCooldownMs = 15 * 1000;
const autoflowChildKillGraceMs = 1500;
const readBoardRunnerListCache = new Map();
const knownProjectScopes = new Map();
const lastSelfHealByScope = new Map();
const selfHealInFlightScopes = new Set();
// scopeKey -> { subscription, debounceTimer, lastReason }
const boardWatchersByScope = new Map();
const boardWatchDebounceMs = 250;
const activeChildProcesses = new Set();
// invocationId → child process. Lets the renderer cancel a long-running
// CLI call (runRole / controlWiki --synth / installBoard / etc.) by id.
const cancellableInvocations = new Map();
const agentAuthStatusCache = new Map();
let runnerShutdownInProgress = false;
let appQuitInProgress = false;
const DEFAULT_MEMORY_CEILING_MB = 4096;
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
  const explicitlyEnabled = /^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_ENABLED || "");
  const explicitlyDisabled = /^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_DESKTOP_MEMORY_CEILING_DISABLED || "");
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
    disabled: explicitlyDisabled || !explicitlyEnabled
  };
}

function bytesToMegabytes(value) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value / BYTES_PER_MEGABYTE;
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

async function resolveExistingPathInside(rootPath, targetPath, options = {}) {
  const rootLabel = options.rootLabel || "Autoflow 보드";
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);
  if (!isPathInside(resolvedRoot, resolvedTarget)) {
    return {
      ok: false,
      targetPath: resolvedTarget,
      relativePath,
      stderr: `${rootLabel} 안의 파일만 열 수 있습니다.`
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
        stderr: `${rootLabel} 안의 파일만 열 수 있습니다.`
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
  for (const { pid, runnerId, agent } of survivors) {
    try { process.kill(pid, 0); } catch {
      // already dead — skip
      continue;
    }
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

// Per-live-PTY metadata captured at spawn time so prompts and main can update
// the runner state file on lifecycle events.
// Internal PTY keys include the project scope; board-facing runnerId remains
// the stable runner id (`planner`, `worker`, etc.).
//   ptyRunnerKey -> { runnerId, role, agent, projectRoot, boardDirName, startedAt }
const ptyRunnerMeta = new Map();
const contextResetTimers = new Map();
const contextResetLastInjected = new Map();
const plannerHandoffTurnTimers = new Map();
const plannerHandoffLastInjected = new Map();
const verifierHandoffTurnTimers = new Map();
const verifierHandoffLastInjected = new Map();
const wikiHandoffTurnTimers = new Map();
const wikiHandoffLastInjected = new Map();
const workerTodoHandoffTurnTimers = new Map();
const workerTodoHandoffLastInjected = new Map();
const workerVerifierDecisionTurnTimers = new Map();
const workerVerifierDecisionLastInjected = new Map();
const codexHookTrustPromptAccepted = new Set();
const codexHookTrustPromptAttempts = new Map();
const codexHookTrustPromptTimers = new Map();
const codexHookTrustPromptWatchdogs = new Map();

function clearVerifierHandoffTurnTimers() {
  for (const entry of plannerHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  plannerHandoffTurnTimers.clear();
  plannerHandoffLastInjected.clear();
  for (const entry of verifierHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  verifierHandoffTurnTimers.clear();
  verifierHandoffLastInjected.clear();
  for (const entry of wikiHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  wikiHandoffTurnTimers.clear();
  wikiHandoffLastInjected.clear();
  for (const entry of workerTodoHandoffTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  workerTodoHandoffTurnTimers.clear();
  workerTodoHandoffLastInjected.clear();
  for (const entry of workerVerifierDecisionTurnTimers.values()) {
    if (entry?.timer) clearTimeout(entry.timer);
  }
  workerVerifierDecisionTurnTimers.clear();
  workerVerifierDecisionLastInjected.clear();
}

function ptyRunnerKey(projectRoot, boardDirName, runnerId) {
  const normalizedProjectRoot = normalizePtyProjectRoot(projectRoot);
  const normalizedRunnerId = String(runnerId || "").trim();
  if (!normalizedProjectRoot || !normalizedRunnerId) {
    return normalizedRunnerId;
  }
  const normalizedBoardDirName = normalizePtyBoardDirName(boardDirName);
  return `${shortHash(`${normalizedProjectRoot}\0${normalizedBoardDirName}`, 16)}:${normalizedRunnerId}`;
}

function ptyRunnerKeyForScope(scope = {}, runnerId) {
  return ptyRunnerKey(scope.projectRoot, scope.boardDirName, runnerId);
}

function ptyRunnerPublicId(runnerKey) {
  const meta = ptyRunnerMeta.get(runnerKey);
  return String(meta?.runnerId || runnerKey || "");
}

function stripTerminalControlSequences(text) {
  return String(text || "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[>=][0-9;?]*/g, "");
}

function hasActiveCodexHookTrustPrompt(text) {
  const clean = stripTerminalControlSequences(text).replace(/\s+/g, " ");
  const promptIndex = clean.lastIndexOf("Hooks need review");
  if (promptIndex < 0) return false;
  const tail = clean.slice(promptIndex);
  if (
    !/Trust\s*all\s*and\s*continue/i.test(tail) ||
    !/(Press\s*enter\s*to\s*(?:confirm|continue)|esc\s*to\s*go\s*back)/i.test(tail)
  ) {
    return false;
  }
  return !/(Use \/skills|Working|Ran |exec codex)/.test(tail);
}

function scheduleCodexHookTrustPromptAccept(ptyManager, runnerKey, chunk = "") {
  if (codexHookTrustPromptAccepted.has(runnerKey) || codexHookTrustPromptTimers.has(runnerKey)) return;
  const meta = ptyRunnerMeta.get(runnerKey);
  if (String(meta?.agent || "").toLowerCase() !== "codex") return;
  if ((codexHookTrustPromptAttempts.get(runnerKey) || 0) >= 4) return;

  const snapshot = typeof ptyManager.snapshot === "function" ? ptyManager.snapshot(runnerKey) || "" : "";
  const candidate = `${snapshot.slice(-3000)}\n${String(chunk || "")}`;
  if (!hasActiveCodexHookTrustPrompt(candidate)) return;

  const promptVisible = () => {
    const live = typeof ptyManager.snapshot === "function" ? ptyManager.snapshot(runnerKey) || "" : "";
    return hasActiveCodexHookTrustPrompt(live.slice(-3000));
  };

  const send = (sequence) => {
    try { ptyManager.writeInput(runnerKey, sequence); } catch {}
  };

  // Force option 2 first. Codex versions parse selection input differently, so
  // keep fallback navigation variants and verify the prompt actually disappears.
  const variants = [
    () => { send("2"); setTimeout(() => send("\r"), 80); },        // digit + enter (most common)
    () => { send("\x1b[B"); setTimeout(() => send("\r"), 80); },   // down arrow + enter
    () => { send("j"); setTimeout(() => send("\r"), 80); },         // vim-style down + enter
    () => { send("2\r"); },                                          // combined (legacy)
  ];

  const timer = setTimeout(() => {
    codexHookTrustPromptTimers.delete(runnerKey);
    if (codexHookTrustPromptAccepted.has(runnerKey)) return;
    if (!promptVisible()) return;
    codexHookTrustPromptAttempts.set(runnerKey, (codexHookTrustPromptAttempts.get(runnerKey) || 0) + 1);

    let attempt = 0;
    const tryNext = () => {
      if (attempt >= variants.length) {
        // Let the startup watchdog retry. The TUI can miss a burst while it is
        // still painting the hook review view.
        return;
      }
      const idx = attempt;
      attempt += 1;
      variants[idx]();
      setTimeout(() => {
        if (!promptVisible()) {
          codexHookTrustPromptAccepted.add(runnerKey);
          const currentMeta = ptyRunnerMeta.get(runnerKey) || meta;
          const publicRunnerId = currentMeta?.runnerId || ptyRunnerPublicId(runnerKey);
          if (currentMeta?.projectRoot) {
            const boardRoot = path.join(currentMeta.projectRoot, currentMeta.boardDirName || defaultBoardDirName);
            appendRunnerLog(boardRoot, publicRunnerId, {
              event: "codex_hook_trust_prompt_auto_accepted",
              runner_id: publicRunnerId,
              variant: String(idx)
            });
          }
          return;
        }
        tryNext();
      }, 1500);
    };
    tryNext();
  }, 200);
  codexHookTrustPromptTimers.set(runnerKey, timer);
}

function startCodexHookTrustPromptWatchdog(ptyManager, runnerKey) {
  if (codexHookTrustPromptWatchdogs.has(runnerKey)) return;
  let ticks = 0;
  const interval = setInterval(() => {
    ticks += 1;
    const runner = typeof ptyManager.get === "function" ? ptyManager.get(runnerKey) : null;
    if (
      ticks > 60 ||
      codexHookTrustPromptAccepted.has(runnerKey) ||
      !runner ||
      runner.status !== "running"
    ) {
      clearInterval(interval);
      codexHookTrustPromptWatchdogs.delete(runnerKey);
      return;
    }
    scheduleCodexHookTrustPromptAccept(ptyManager, runnerKey);
  }, 500);
  codexHookTrustPromptWatchdogs.set(runnerKey, interval);
}

function clearCodexHookTrustPromptAutomation(runnerKey) {
  codexHookTrustPromptAccepted.delete(runnerKey);
  codexHookTrustPromptAttempts.delete(runnerKey);
  const trustPromptTimer = codexHookTrustPromptTimers.get(runnerKey);
  if (trustPromptTimer) clearTimeout(trustPromptTimer);
  codexHookTrustPromptTimers.delete(runnerKey);
  const watchdog = codexHookTrustPromptWatchdogs.get(runnerKey);
  if (watchdog) clearInterval(watchdog);
  codexHookTrustPromptWatchdogs.delete(runnerKey);
}

function boardRelPath(boardRoot, filePath) {
  const rel = path.relative(boardRoot, filePath).split(path.sep).join("/");
  return rel && !rel.startsWith("..") ? rel : filePath;
}

function readMarkdownTitleSync(filePath) {
  try {
    const text = fsSync.readFileSync(filePath, "utf8");
    const titleScalar = text.match(/^- Title:\s*(.+)$/m);
    if (titleScalar) return titleScalar[1].trim();
    const first = text.split(/\r?\n/, 1)[0] || "";
    return first.replace(/^#\s+/, "").trim();
  } catch {
    return "";
  }
}

function writeRunnerHandoffPromptFile({ boardRoot, runnerId, kind, prompt }) {
  const stateDir = path.join(boardRoot, "runners", "state");
  fsSync.mkdirSync(stateDir, { recursive: true });
  const promptPath = path.join(
    stateDir,
    `${runnerPromptFileSegment(runnerId)}-${runnerPromptFileSegment(kind)}-handoff-prompt.md`
  );
  const tmpPath = `${promptPath}.${process.pid}.${Date.now()}.tmp`;
  fsSync.writeFileSync(tmpPath, String(prompt || "").replace(/[\r\n]+$/, "") + "\n", "utf8");
  fsSync.renameSync(tmpPath, promptPath);
  return promptPath;
}

function buildInjectedHandoffPrompt({ agent, boardRoot, runnerId, kind, prompt }) {
  const normalizedAgent = String(agent || "").toLowerCase();
  if (normalizedAgent === "codex") {
    const promptPath = writeRunnerHandoffPromptFile({ boardRoot, runnerId, kind, prompt });
    return {
      prompt: `Autoflow handoff: read ${JSON.stringify(promptPath)} and follow it exactly now. Execute the single runner turn it describes, then summarize and idle.`,
      paste: "plain",
      promptPath
    };
  }
  return {
    prompt,
    paste: normalizedAgent === "claude" ? "bracketed" : "plain",
    promptPath: ""
  };
}

function verifierQueueChangeReasons(reasons) {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/verifier" || /^tickets\/verifier\/TODO-\d+\.md$/i.test(value);
  });
}

function verifierPromptLooksReady(snapshot, agent) {
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(/\u001b/g, "");
  const lines = clean
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tailLines = lines.slice(-16);
  const tail = tailLines.join("\n");
  const compactTail = tail.replace(/\s+/g, " ").trim();
  if (/\b(Working|Running command|Thinking|Compacting|Booting MCP server)\b/i.test(compactTail)) return false;
  if (/Hooks need review/i.test(tail)) return false;
  if (/(Trust\s*all\s*and\s*continue|Continue\s*without\s*trusting|hooks\s*won'?t\s*run)/i.test(compactTail)) {
    return false;
  }
  if (runnerPromptNeedsContinue(snapshot, agent)) return false;
  const promptPattern = /^[›>]\s*(?:$|gpt-|claude|sonnet|opus|haiku|.*[~/][^ ]*)/i;
  const promptLine = tailLines.slice(-8).find((line) => promptPattern.test(line));
  if (promptLine) return true;
  if (/(?:^|\s)[›>]\s*(?:gpt-|claude|sonnet|opus|haiku|[~/])/i.test(compactTail)) return true;
  if (String(agent || "").toLowerCase() !== "codex") {
    if (/bypass\s+permissions\s+on/i.test(compactTail)) return true;
    return tailLines.slice(-3).some((line) => /^[›>]\s*$/.test(line));
  }
  return /(?:^|\s)›\s*$/.test(compactTail);
}

function runnerPromptNeedsContinue(snapshot, agent) {
  if (String(agent || "").toLowerCase() !== "codex") return false;
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(/\u001b/g, "");
  const compactTail = clean
    .split(/\n/)
    .slice(-20)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  return /press\s+enter\s+to\s+continue|esc\s+to\s+go\s+back/i.test(compactTail);
}

function runnerSnapshotLooksBusy(snapshot) {
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(/\u001b/g, "");
  const compactTail = clean
    .split(/\n/)
    .slice(-24)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  if (!compactTail) return false;
  if (/\b(Working|Running command|Thinking|Compacting|Booting MCP server)\b/i.test(compactTail)) return true;
  if (/Hooks need review/i.test(compactTail)) return true;
  if (/(Trust\s*all\s*and\s*continue|Continue\s*without\s*trusting|hooks\s*won'?t\s*run)/i.test(compactTail)) return true;
  return false;
}

function runnerPromptAcceptsInjectedTurn(snapshot, agent, idleMs) {
  if (verifierPromptLooksReady(snapshot, agent)) return true;
  const fallbackIdleMs = Math.max(
    1000,
    Number.parseInt(process.env.AUTOFLOW_HANDOFF_READY_FALLBACK_IDLE_MS || "8000", 10) || 8000
  );
  if (!Number.isFinite(idleMs) || idleMs < fallbackIdleMs) return false;
  if (runnerSnapshotLooksBusy(snapshot)) return false;
  if (runnerPromptNeedsContinue(snapshot, agent)) return false;
  return true;
}

function handoffRetryDedupMs(envName, fallbackMs, dedupMs) {
  const parsed = Number.parseInt(process.env[envName] || "", 10);
  const configured = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
  return Math.max(1000, Math.min(dedupMs, configured));
}

function handoffDedupBlocks(last, fingerprint, now, dedupMs, retryMs, force) {
  if (force || !last || last.fingerprint !== fingerprint) return false;
  return now - last.at < Math.max(1000, Math.min(dedupMs, retryMs));
}

function handoffIdleStateFields(lastResult, promptPath = "") {
  return {
    last_result: lastResult,
    active_item: "",
    active_stage: "idle",
    active_ticket_id: "",
    active_ticket_path: "",
    active_ticket_title: "",
    active_spec_ref: "",
    last_handoff_prompt_path: promptPath || ""
  };
}

function pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, snapshot, agent) {
  if (!runnerPromptNeedsContinue(snapshot, agent)) return false;
  if (!mgr || typeof mgr.writeInput !== "function") return false;
  return Boolean(mgr.writeInput(runnerKey, "\r"));
}

function workerVerifierDecisionChangeReasons(reasons) {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/inprogress" || /^tickets\/inprogress\/TODO-\d+\.md$/i.test(value);
  });
}

function verifierDecisionStageForWorkerTurn(ticketPath) {
  const stage = (
    markdownScalarInSectionSync(ticketPath, "Ticket", "Stage") ||
    markdownScalarInSectionSync(ticketPath, "Worktree", "Integration Status") ||
    markdownScalarInSectionSync(ticketPath, "Goal Runtime", "Status")
  ).toLowerCase();
  if (/verified[_ -]?pending[_ -]?merge/.test(stage)) return "verified_pending_merge";
  if (/revision[_ -]?requested/.test(stage)) return "revision_requested";
  if (/replan[_ -]?requested/.test(stage)) return "replan_requested";
  return "";
}

function workerRunnerIdFromTicketSync(ticketPath) {
  for (const value of [
    markdownScalarInSectionSync(ticketPath, "Ticket", "Execution AI"),
    markdownScalarInSectionSync(ticketPath, "Ticket", "Claimed By"),
    markdownScalarInSectionSync(ticketPath, "Ticket", "AI")
  ]) {
    const token = canonicalWorkerRunnerId(String(value || "").split(":")[0]);
    if (token && !/^verifier(?:-\d+)?$/i.test(token)) return token;
  }
  return "worker";
}

function workerDecisionFingerprint(boardRoot, ticketPath, stage) {
  let mtimeMs = 0;
  try { mtimeMs = fsSync.statSync(ticketPath).mtimeMs || 0; } catch {}
  return `${boardRelPath(boardRoot, ticketPath)}:${stage}:${Math.round(mtimeMs)}`;
}

function buildWorkerVerifierDecisionTurnPrompt({ projectRoot, boardRoot, runnerId, ticketPath, stage }) {
  const relTicket = boardRelPath(boardRoot, ticketPath);
  const title = readMarkdownTitleSync(ticketPath);
  const stageGuidance = stage === "verified_pending_merge"
    ? `Verifier pass is recorded. Merge the approved worktree into the ticket merge target inside Allowed Paths, rerun required verification from that target, then call worker finalize-approved.`
    : stage === "revision_requested"
      ? `Verifier requested revision. Keep the same worktree, apply the verifier notes inside Allowed Paths, rerun local verification, then submit to verifier again.`
      : `Verifier requested replan. Run worker request-replan for this ticket before claiming anything else.`;
  return [
    `Autoflow worker verifier-decision handoff detected by Desktop.`,
    `This is a one-shot worker turn for a verifier decision that returned a ticket to tickets/inprogress/; it is not a recurring wake loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Ticket:       ${relTicket}${title ? ` — ${title}` : ""}`,
    `Stage:        ${stage}`,
    ``,
    stageGuidance,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "active-get", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `Inspect only active-get.ai_followup_scope.inspect_only_recent_sources for this ticket, then perform the next worker action recorded in the ticket.`,
    `Do not run todo-snapshot or claim another ticket while this returned verifier decision is active.`
  ].join("\n");
}

function scheduleWorkerVerifierDecisionTurn({ projectRoot, boardDirName, boardRoot, runnerId, ticketPath, stage, reason, force = false }) {
  const mgr = globalThis.__autoflowPtyManager;
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;

  const fingerprint = workerDecisionFingerprint(boardRoot, ticketPath, stage);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_DEDUP_MS || "300000", 10) || 300000);
  const last = workerVerifierDecisionLastInjected.get(runnerKey);
  if (!force && last?.fingerprint === fingerprint && now - last.at < dedupMs) return;

  const existing = workerVerifierDecisionTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_WORKER_VERIFIER_DECISION_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: { attempt: number; timer: ReturnType<typeof setTimeout> | null } = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    workerVerifierDecisionTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get(runnerKey);
      if (!live || live.status !== "running" || !safeIsFileSync(ticketPath)) {
        clearEntry();
        return;
      }
      const currentStage = verifierDecisionStageForWorkerTurn(ticketPath);
      if (!currentStage) {
        clearEntry();
        return;
      }
      const currentOwner = workerRunnerIdFromTicketSync(ticketPath);
      if (canonicalWorkerRunnerId(currentOwner) !== canonicalWorkerRunnerId(runnerId)) {
        clearEntry();
        return;
      }
      const idleMs = Number.isFinite(live.lastDataAt) && live.lastDataAt > 0
        ? Date.now() - live.lastDataAt
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildWorkerVerifierDecisionTurnPrompt({
        projectRoot,
        boardRoot,
        runnerId,
        ticketPath,
        stage: currentStage
      });
      const injectedPrompt = buildInjectedHandoffPrompt({
        agent: meta.agent,
        boardRoot,
        runnerId,
        kind: "worker-verifier-decision",
        prompt
      });
      const injected = mgr.writePrompt(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        workerVerifierDecisionLastInjected.set(runnerKey, {
          at: Date.now(),
          fingerprint: workerDecisionFingerprint(boardRoot, ticketPath, currentStage),
          reason
        });
        void writePtyRunnerStateFile(runnerKey, {
          last_result: currentStage === "verified_pending_merge"
            ? "verifier_passed_merge_pending"
            : currentStage === "revision_requested"
              ? "verifier_revise_requested"
              : "verifier_replan_requested",
          active_stage: currentStage,
          active_ticket_id: path.basename(ticketPath, ".md"),
          active_ticket_path: boardRelPath(boardRoot, ticketPath),
          active_ticket_title: readMarkdownTitleSync(ticketPath),
          last_handoff_prompt_path: injectedPrompt.promptPath || ""
        });
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  workerVerifierDecisionTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

function safeIsFileSync(filePath) {
  try {
    return fsSync.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function scheduleWorkerVerifierDecisionTurnsForScope({ projectRoot, boardDirName, boardRoot, reasons }) {
  if (!workerVerifierDecisionChangeReasons(reasons)) return;
  const candidates = listQueueFilesSync(boardRoot, "tickets/inprogress", /^TODO-\d+\.md$/i, 1000)
    .map((ticketPath) => ({
      ticketPath,
      stage: verifierDecisionStageForWorkerTurn(ticketPath),
      runnerId: workerRunnerIdFromTicketSync(ticketPath)
    }))
    .filter((item) => item.stage && item.runnerId);
  if (candidates.length === 0) return;
  const enabledWorkers = new Set(
    readRunnerConfigBlocks(projectRoot, boardDirName)
      .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "worker")
      .filter((runner) => runnerConfigBoolean(runner.enabled, true))
      .map((runner) => canonicalWorkerRunnerId(runner.id))
  );
  for (const item of candidates) {
    if (!enabledWorkers.has(canonicalWorkerRunnerId(item.runnerId))) continue;
    scheduleWorkerVerifierDecisionTurn({
      projectRoot,
      boardDirName,
      boardRoot,
      runnerId: item.runnerId,
      ticketPath: item.ticketPath,
      stage: item.stage,
      reason: (reasons || []).join(",")
    });
  }
}

function buildVerifierHandoffTurnPrompt({ projectRoot, boardRoot, boardDirName, runnerId, ticketPath }) {
  const relTicket = boardRelPath(boardRoot, ticketPath);
  const title = readMarkdownTitleSync(ticketPath);
  return [
    `Autoflow verifier handoff detected by Desktop.`,
    `This is a one-shot verifier turn for a ticket that just entered tickets/verifier/; it is not a recurring wake loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Pending verifier ticket: ${relTicket}${title ? ` — ${title}` : ""}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "verifier", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `If snapshot.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
    `If a verifier ticket exists, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources, run verifier evidence for that one ticket, make exactly one pass/revise/replan decision, run the matching verifier tool, rerun queue-snapshot once, then idle.`,
    `Do not open full AGENTS, rule docs, or unrelated project files unless the compact verifier tool fails or the scoped verifier ticket directly requires them.`
  ].join("\n");
}

function scheduleVerifierHandoffTurn({ projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }) {
  const mgr = globalThis.__autoflowPtyManager;
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;

  const pendingTickets = listQueueFilesSync(boardRoot, "tickets/verifier", /^TODO-\d+\.md$/i, 1000);
  if (pendingTickets.length === 0) return;

  const fingerprint = computeQueueFingerprint("verifier", boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_VERIFIER_HANDOFF_RETRY_MS", 30000, dedupMs);
  const last = verifierHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = verifierHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_VERIFIER_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: { attempt: number; timer: ReturnType<typeof setTimeout> | null } = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    verifierHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get(runnerKey);
      if (!live || live.status !== "running") {
        clearEntry();
        return;
      }
      const currentPending = listQueueFilesSync(boardRoot, "tickets/verifier", /^TODO-\d+\.md$/i, 1000);
      if (currentPending.length === 0) {
        clearEntry();
        return;
      }
      const idleMs = Number.isFinite(live.lastDataAt) && live.lastDataAt > 0
        ? Date.now() - live.lastDataAt
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildVerifierHandoffTurnPrompt({
        projectRoot,
        boardRoot,
        boardDirName,
        runnerId,
        ticketPath: currentPending[0]
      });
      const injectedPrompt = buildInjectedHandoffPrompt({
        agent: meta.agent,
        boardRoot,
        runnerId,
        kind: "verifier",
        prompt
      });
      const injected = mgr.writePrompt(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = computeQueueFingerprint("verifier", boardRoot);
        verifierHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(
          runnerKey,
          handoffIdleStateFields("verifier_handoff_turn_requested", injectedPrompt.promptPath)
        );
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  verifierHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

function scheduleVerifierHandoffTurnsForScope({ projectRoot, boardDirName, boardRoot, reasons }) {
  if (!verifierQueueChangeReasons(reasons)) return;
  if (listQueueFilesSync(boardRoot, "tickets/verifier", /^TODO-\d+\.md$/i, 1).length === 0) return;
  const verifierRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "verifier")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  for (const runner of verifierRunners) {
    scheduleVerifierHandoffTurn({
      projectRoot,
      boardDirName,
      boardRoot,
      runnerId: runner.id,
      reason: (reasons || []).join(",")
    });
  }
}

function plannerQueueChangeReasons(reasons) {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/prd" || /^tickets\/prd\/PRD[-_].+\.md$/i.test(value);
  });
}

function buildPlannerHandoffTurnPrompt({ projectRoot, boardRoot, runnerId, prdPath }) {
  const relPrd = boardRelPath(boardRoot, prdPath);
  const title = readMarkdownTitleSync(prdPath);
  return [
    `Autoflow planner PRD handoff detected by Desktop.`,
    `This is a one-shot planner turn for an actionable PRD in tickets/prd/; it is not a recurring wake loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Pending PRD:  ${relPrd}${title ? ` — ${title}` : ""}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "planner", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `If snapshot.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
    `If a PRD exists, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources, create the worker-facing TODO set for that one PRD, rerun queue-snapshot once, then idle.`,
    `Do not open unrelated PRDs, tickets, AGENTS, or rule docs unless the compact planner tool fails or the scoped PRD directly requires them.`
  ].join("\n");
}

function schedulePlannerHandoffTurn({ projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }) {
  const mgr = globalThis.__autoflowPtyManager;
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;

  const pendingPrds = listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000)
    .filter(plannerQueueFileIsActionableSync);
  if (pendingPrds.length === 0) return;

  const fingerprint = computeQueueFingerprint("planner", boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_PLANNER_HANDOFF_RETRY_MS", 30000, dedupMs);
  const last = plannerHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = plannerHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_PLANNER_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: { attempt: number; timer: ReturnType<typeof setTimeout> | null } = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    plannerHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get(runnerKey);
      if (!live || live.status !== "running") {
        clearEntry();
        return;
      }
      const currentPending = listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000)
        .filter(plannerQueueFileIsActionableSync);
      if (currentPending.length === 0) {
        clearEntry();
        return;
      }
      const idleMs = Number.isFinite(live.lastDataAt) && live.lastDataAt > 0
        ? Date.now() - live.lastDataAt
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildPlannerHandoffTurnPrompt({
        projectRoot,
        boardRoot,
        runnerId,
        prdPath: currentPending[0]
      });
      const injectedPrompt = buildInjectedHandoffPrompt({
        agent: meta.agent,
        boardRoot,
        runnerId,
        kind: "planner",
        prompt
      });
      const injected = mgr.writePrompt(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = computeQueueFingerprint("planner", boardRoot);
        plannerHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(
          runnerKey,
          handoffIdleStateFields("planner_handoff_turn_requested", injectedPrompt.promptPath)
        );
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  plannerHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

function schedulePlannerHandoffTurnsForScope({ projectRoot, boardDirName, boardRoot, reasons }) {
  if (!plannerQueueChangeReasons(reasons)) return;
  if (listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000).filter(plannerQueueFileIsActionableSync).length === 0) return;
  const plannerRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "planner")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  for (const runner of plannerRunners) {
    schedulePlannerHandoffTurn({
      projectRoot,
      boardDirName,
      boardRoot,
      runnerId: runner.id,
      reason: (reasons || []).join(",")
    });
  }
}

function workerTodoQueueChangeReasons(reasons) {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "tickets/todo" || /^tickets\/todo\/TODO-\d+\.md$/i.test(value);
  });
}

function workerTodoQueueFingerprint(boardRoot) {
  const parts = [];
  for (const filePath of listQueueFilesSync(boardRoot, "tickets/todo", /^TODO-\d+\.md$/i, 1000)) {
    if (!workerTodoFileIsClaimableSync(filePath)) continue;
    try {
      const stat = fsSync.statSync(filePath);
      parts.push(`${boardRelPath(boardRoot, filePath)}:${stat.size}:${stat.mtimeMs}`);
    } catch {}
  }
  return nodeCrypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

function workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId) {
  const normalizedRunnerId = canonicalWorkerRunnerId(runnerId);
  if (!normalizedRunnerId) return false;

  const stateRel = runnerStateFieldSync(boardRoot, normalizedRunnerId, "active_ticket_path")
    .split(path.sep)
    .join("/");
  if (/^tickets\/(?:inprogress|verifier|ready-to-merge)\/TODO-\d+\.md$/i.test(stateRel)) {
    const statePath = path.join(boardRoot, stateRel);
    if (safeIsFileSync(statePath)) {
      const claimedBy = canonicalWorkerRunnerId(ticketClaimedByRunnerIdSync(statePath));
      if (!claimedBy || claimedBy === normalizedRunnerId) return true;
    }
  }

  const stateTicketId = runnerActiveTicketIdSync(boardRoot, normalizedRunnerId);
  if (stateTicketId) {
    for (const relDir of ["tickets/inprogress", "tickets/verifier", "tickets/ready-to-merge"]) {
      const candidatePath = path.join(boardRoot, relDir, `${stateTicketId}.md`);
      if (!safeIsFileSync(candidatePath)) continue;
      const claimedBy = canonicalWorkerRunnerId(ticketClaimedByRunnerIdSync(candidatePath));
      if (!claimedBy || claimedBy === normalizedRunnerId) return true;
    }
  }

  for (const relDir of ["tickets/inprogress", "tickets/verifier", "tickets/ready-to-merge"]) {
    for (const ticketPath of listQueueFilesSync(boardRoot, relDir, /^TODO-\d+\.md$/i, 1000)) {
      const claimedBy = canonicalWorkerRunnerId(ticketClaimedByRunnerIdSync(ticketPath));
      if (claimedBy && claimedBy === normalizedRunnerId) return true;
    }
  }
  return false;
}

function buildWorkerTodoHandoffTurnPrompt({ projectRoot, boardRoot, runnerId, ticketPath }) {
  const relTicket = boardRelPath(boardRoot, ticketPath);
  const title = readMarkdownTitleSync(ticketPath);
  return [
    `Autoflow worker todo handoff detected by Desktop.`,
    `This is a one-shot worker turn for a ticket that just entered tickets/todo/; it is not a recurring wake loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Pending todo candidate: ${relTicket}${title ? ` — ${title}` : ""}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "active-get", "--runner", runnerId, "--max-items", "12"])}\` once.`,
    `If active-get reports an owned active ticket, handle that ticket first and do not claim another ticket.`,
    `If no owned active ticket exists, run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "todo-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once before deciding idle.`,
    `If todo-snapshot.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
    `If a candidate exists, inspect only todo-snapshot.ai_followup_scope.inspect_only_recent_sources, choose exactly one ticket, run worker claim, then run worker worktree-ensure before any product edits.`
  ].join("\n");
}

function scheduleWorkerTodoHandoffTurn({ projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }) {
  const mgr = globalThis.__autoflowPtyManager;
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;
  if (workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId)) return;

  const pendingTodos = listQueueFilesSync(boardRoot, "tickets/todo", /^TODO-\d+\.md$/i, 1000)
    .filter(workerTodoFileIsClaimableSync);
  if (pendingTodos.length === 0) return;

  const fingerprint = workerTodoQueueFingerprint(boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_WORKER_TODO_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_WORKER_TODO_HANDOFF_RETRY_MS", 15000, dedupMs);
  const last = workerTodoHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = workerTodoHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_TODO_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WORKER_TODO_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_WORKER_TODO_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: { attempt: number; timer: ReturnType<typeof setTimeout> | null } = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    workerTodoHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get(runnerKey);
      if (!live || live.status !== "running") {
        clearEntry();
        return;
      }
      if (workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId)) {
        clearEntry();
        return;
      }
      const currentPending = listQueueFilesSync(boardRoot, "tickets/todo", /^TODO-\d+\.md$/i, 1000)
        .filter(workerTodoFileIsClaimableSync);
      if (currentPending.length === 0) {
        clearEntry();
        return;
      }
      const idleMs = Number.isFinite(live.lastDataAt) && live.lastDataAt > 0
        ? Date.now() - live.lastDataAt
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildWorkerTodoHandoffTurnPrompt({
        projectRoot,
        boardRoot,
        runnerId,
        ticketPath: currentPending[0]
      });
      const injectedPrompt = buildInjectedHandoffPrompt({
        agent: meta.agent,
        boardRoot,
        runnerId,
        kind: "worker-todo",
        prompt
      });
      const injected = mgr.writePrompt(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = workerTodoQueueFingerprint(boardRoot);
        workerTodoHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(
          runnerKey,
          handoffIdleStateFields("worker_todo_handoff_turn_requested", injectedPrompt.promptPath)
        );
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  workerTodoHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

function scheduleWorkerTodoHandoffTurnsForScope({ projectRoot, boardDirName, boardRoot, reasons }) {
  if (!workerTodoQueueChangeReasons(reasons)) return;
  const pendingTodos = listQueueFilesSync(boardRoot, "tickets/todo", /^TODO-\d+\.md$/i, 1000)
    .filter(workerTodoFileIsClaimableSync);
  if (pendingTodos.length === 0) return;
  const mgr = globalThis.__autoflowPtyManager;
  if (!mgr || typeof mgr.get !== "function") return;
  const workerRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "worker")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  let scheduled = 0;
  for (const runner of workerRunners) {
    const runnerId = canonicalWorkerRunnerId(runner.id);
    if (!runnerId || workerRunnerHasOwnedActiveTicketSync(boardRoot, runnerId)) continue;
    const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
    const live = mgr.get(runnerKey);
    if (!live || live.status !== "running") continue;
    scheduleWorkerTodoHandoffTurn({
      projectRoot,
      boardDirName,
      boardRoot,
      runnerId,
      reason: (reasons || []).join(",")
    });
    scheduled += 1;
    if (scheduled >= pendingTodos.length) break;
  }
}

function wikiQueueChangeReasons(reasons) {
  return (reasons || []).some((reason) => {
    const value = String(reason || "");
    return value === "boot-catchup" || value === "wiki" || value.startsWith("wiki/") || value === "tickets/done" || value.startsWith("tickets/done/");
  });
}

function buildWikiHandoffTurnPrompt({ projectRoot, boardRoot, runnerId }) {
  return [
    `Autoflow wiki handoff detected by Desktop.`,
    `This is a one-shot wiki turn for board wiki/done changes; it is not a recurring wake loop.`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    ``,
    `Run \`${autoflowShellCommand(["tool", "runner-tool", "wiki", "tick", "--runner", runnerId, "--max-items", "12"])}\` once and let it complete.`,
    `If tick.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
    `If follow-up is needed, inspect only tick.ai_followup_scope.inspect_only_recent_sources, write or update at most one focused wiki page through wiki write-page (DB upsert; do not create .autoflow/wiki markdown), then rerun wiki tick once with --skip-telemetry.`,
    `If the rerun tick still reports ai_followup_recommended=true or recent_done_pending_review_count > 0, summarize the page you updated and the remaining count, then let the Stop hook continue the next focused wiki turn. Only idle when no follow-up remains.`,
    `Do not open unrelated tickets, full AGENTS, or broad project files unless the compact wiki tool fails or the scoped source directly requires them.`
  ].join("\n");
}

function scheduleWikiHandoffTurn({ projectRoot, boardDirName, boardRoot, runnerId, reason, force = false }) {
  const mgr = globalThis.__autoflowPtyManager;
  if (!mgr || typeof mgr.get !== "function" || typeof mgr.writePrompt !== "function") return;
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  const meta = ptyRunnerMeta.get(runnerKey);
  if (!meta || meta.projectRoot !== projectRoot || meta.boardDirName !== boardDirName) return;
  const runner = mgr.get(runnerKey);
  if (!runner || runner.status !== "running") return;
  if (!ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot, boardDirName })) return;
  if (!wikiHasPendingRunnerWorkSync(boardRoot)) return;

  const fingerprint = computeQueueFingerprint("wiki-maintainer", boardRoot);
  const now = Date.now();
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_DEDUP_MS || "300000", 10) || 300000);
  const retryDedupMs = handoffRetryDedupMs("AUTOFLOW_WIKI_HANDOFF_RETRY_MS", 30000, dedupMs);
  const last = wikiHandoffLastInjected.get(runnerKey);
  if (handoffDedupBlocks(last, fingerprint, now, dedupMs, retryDedupMs, force)) return;

  const existing = wikiHandoffTurnTimers.get(runnerKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_DELAY_MS || "1500", 10) || 1500);
  const minIdleMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_MIN_IDLE_MS || "2000", 10) || 2000);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_WIKI_HANDOFF_MAX_ATTEMPTS || "40", 10) || 40);
  const entry: { attempt: number; timer: ReturnType<typeof setTimeout> | null } = { attempt: 0, timer: null };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    wikiHandoffTurnTimers.delete(runnerKey);
  };
  const scheduleNext = (waitMs) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;
      const live = mgr.get(runnerKey);
      if (!live || live.status !== "running") {
        clearEntry();
        return;
      }
      if (!wikiHasPendingRunnerWorkSync(boardRoot)) {
        clearEntry();
        return;
      }
      const idleMs = Number.isFinite(live.lastDataAt) && live.lastDataAt > 0
        ? Date.now() - live.lastDataAt
        : Number.POSITIVE_INFINITY;
      const snapshot = typeof mgr.snapshot === "function" ? mgr.snapshot(runnerKey) || "" : "";
      const promptTail = snapshot.slice(-6000);
      if (idleMs >= minIdleMs && pokeRunnerContinuePromptIfNeeded(mgr, runnerKey, promptTail, meta.agent)) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const promptReady = runnerPromptAcceptsInjectedTurn(promptTail, meta.agent, idleMs);
      if (idleMs < minIdleMs || !promptReady) {
        if (entry.attempt >= maxAttempts) {
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }
      const prompt = buildWikiHandoffTurnPrompt({ projectRoot, boardRoot, runnerId });
      const injectedPrompt = buildInjectedHandoffPrompt({
        agent: meta.agent,
        boardRoot,
        runnerId,
        kind: "wiki",
        prompt
      });
      const injected = mgr.writePrompt(runnerKey, injectedPrompt.prompt, { paste: injectedPrompt.paste });
      if (injected) {
        const currentFingerprint = computeQueueFingerprint("wiki-maintainer", boardRoot);
        wikiHandoffLastInjected.set(runnerKey, { at: Date.now(), fingerprint: currentFingerprint, reason });
        void writePtyRunnerStateFile(
          runnerKey,
          handoffIdleStateFields("wiki_handoff_turn_requested", injectedPrompt.promptPath)
        );
      }
      clearEntry();
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };
  wikiHandoffTurnTimers.set(runnerKey, entry);
  scheduleNext(delayMs);
}

function scheduleWikiHandoffTurnsForScope({ projectRoot, boardDirName, boardRoot, reasons }) {
  if (!wikiQueueChangeReasons(reasons)) return;
  if (!wikiHasPendingRunnerWorkSync(boardRoot)) return;
  const wikiRunners = readRunnerConfigBlocks(projectRoot, boardDirName)
    .filter((runner) => normalizeRunnerRole(runner.role || inferRunnerRoleFromId(runner.id)) === "wiki-maintainer")
    .filter((runner) => runnerConfigBoolean(runner.enabled, true));
  for (const runner of wikiRunners) {
    scheduleWikiHandoffTurn({
      projectRoot,
      boardDirName,
      boardRoot,
      runnerId: runner.id,
      reason: (reasons || []).join(",")
    });
  }
}

function ptyRunnerMetaForScope(runnerId, scope = {}) {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (requestedProjectRoot) {
    const key = ptyRunnerKeyForScope(scope, runnerId);
    return { key, meta: ptyRunnerMeta.get(key) };
  }

  if (ptyRunnerMeta.has(runnerId)) {
    return { key: runnerId, meta: ptyRunnerMeta.get(runnerId) };
  }

  for (const [key, meta] of ptyRunnerMeta.entries()) {
    if (meta?.runnerId === runnerId) {
      return { key, meta };
    }
  }

  return { key: String(runnerId || ""), meta: undefined };
}

function getPtyRunnerForScope(ptyManager, runnerId, scope = {}) {
  if (!ptyManager || typeof ptyManager.get !== "function") return null;
  if (ptyRunnerMeta.has(runnerId)) return ptyManager.get(runnerId) || null;
  const { key } = ptyRunnerMetaForScope(runnerId, scope);
  return ptyManager.get(key) || null;
}

function ptyRunnerMatchesRequestedScope(ptyManager, runnerId, scope = {}) {
  const requestedProjectRoot = normalizePtyProjectRoot(scope.projectRoot);
  if (!requestedProjectRoot) return true;
  const { key } = ptyRunnerMetaForScope(runnerId, scope);
  const meta = ptyRunnerMeta.get(runnerId) || ptyRunnerMeta.get(key);
  if (meta) {
    return ptyScopeMatches(meta.projectRoot, meta.boardDirName, scope);
  }
  const runner = ptyManager && typeof ptyManager.get === "function"
    ? ptyManager.get(key) || ptyManager.get(runnerId)
    : null;
  if (runner && runner.cwd) {
    return normalizePtyProjectRoot(runner.cwd) === requestedProjectRoot;
  }
  return false;
}

function ptyRunnerScopedPayload(runnerKey, payload = {}) {
  const meta = ptyRunnerMeta.get(runnerKey);
  return {
    ...payload,
    runnerId: meta?.runnerId || runnerKey,
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
  const stoppedRunnerKeys = new Set();
  for (const [runnerKey, meta] of ptyRunnerMeta.entries()) {
    if (!ptyScopeMatches(meta.projectRoot, meta.boardDirName, scope)) continue;
    const runner = typeof ptyManager.get === "function" ? ptyManager.get(runnerKey) : null;
    forceKillRunnerPid(runner);
    if (ptyManager.stop(runnerKey, { force: Boolean(opts.force) })) {
      stoppedRunnerKeys.add(runnerKey);
      stoppedRunnerIds.add(meta.runnerId || runnerKey);
    }
  }

  for (const runner of ptyManager.list()) {
    if (!runner || stoppedRunnerKeys.has(runner.id)) continue;
    if (runner.status !== "running") continue;
    if (!ptyRunnerMatchesRequestedScope(ptyManager, runner.id, scope)) continue;
    forceKillRunnerPid(runner);
    if (ptyManager.stop(runner.id, { force: Boolean(opts.force) })) {
      stoppedRunnerKeys.add(runner.id);
      stoppedRunnerIds.add(ptyRunnerPublicId(runner.id));
    }
  }

  return Array.from(stoppedRunnerIds);
}
// runnerId -> incremental parser state for machine-readable usage events that
// appear in the current PTY stream. This watches only live runner output, never
// local session history files.
const ptyTokenUsageParseState = new Map();
const sessionTokenUsageImportTimers = new Map();
const sessionTokenUsageImportInflight = new Set();
const sessionTokenUsageImportPending = new Set();

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

function markdownScalarInSectionSync(filePath, section, field) {
  let text = "";
  try {
    text = fsSync.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inSection = heading[1].trim().toLowerCase() === String(section || "").toLowerCase();
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^-\s*([^:]+):\s*(.*?)\s*$/);
    if (match && match[1].trim().toLowerCase() === String(field || "").toLowerCase()) {
      return match[2].trim();
    }
  }
  return "";
}

function boardRootForQueueFileSync(filePath) {
  const normalized = String(filePath || "");
  const marker = `${path.sep}tickets${path.sep}`;
  const index = normalized.indexOf(marker);
  return index >= 0 ? normalized.slice(0, index) : "";
}

function boardRelForQueueFileSync(filePath) {
  const boardRoot = boardRootForQueueFileSync(filePath);
  if (!boardRoot) return "";
  return path.relative(boardRoot, filePath).split(path.sep).join("/");
}

function plannerQueueFileIsActionableSync(filePath) {
  const status = markdownScalarInSectionSync(filePath, "Project", "Status").toLowerCase();
  if (["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status)) {
    return false;
  }
  // If the file lacks the canonical PRD scalar fields (Project section with
  // Status / Goal), it is not a real PRD body but author hint/reference
  // material parked in tickets/prd/. Treat it as not actionable so planner
  // does not waste cycles on it.
  if (!status) {
    const title = markdownScalarInSectionSync(filePath, "Project", "Title");
    if (!title) return false;
  }
  return true;
}

function workerInprogressFileIsActionableSync(filePath) {
  let text = "";
  try {
    text = fsSync.readFileSync(filePath, "utf8");
  } catch {
    return false;
  }
  const stage = (
    markdownScalarInSectionSync(filePath, "Ticket", "Stage") ||
    markdownScalarInSectionSync(filePath, "Worktree", "Integration Status") ||
    markdownScalarInSectionSync(filePath, "Goal Runtime", "Status")
  ).toLowerCase();
  if (/verified[_ -]?pending[_ -]?merge/.test(stage) || /^-\s*Semantic Decision:\s*pass\s*$/mi.test(text)) {
    return true;
  }
  if (
    /verify[_ -]?pending/.test(stage) ||
    /verifier[_ -]?pending/.test(stage) ||
    /submitted[_ -]?to[_ -]?verifier/.test(stage) ||
    /awaiting[_ -]?verifier/.test(stage)
  ) {
    return false;
  }
  return true;
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

function wikiPendingReviewPathsSync(boardRoot) {
  const statePath = path.join(boardRoot, "runners", "state", "wiki-focused-review.json");
  const state = readJsonFileSync(statePath) || {};
  const reviewed = new Set(
    Array.isArray(state.reviewed_done_paths)
      ? state.reviewed_done_paths.map((item) => String(item || "")).filter(Boolean)
      : []
  );
  const pending = new Set(
    Array.isArray(state.pending_done_paths)
      ? state.pending_done_paths.map((item) => String(item || "")).filter(Boolean)
      : []
  );

  for (const filePath of walkMarkdownFilesSync(path.join(boardRoot, "tickets", "done"))) {
    const relPath = boardRelPath(boardRoot, filePath);
    if (relPath && !reviewed.has(relPath)) {
      pending.add(relPath);
    }
  }

  return [...pending].sort((left, right) => left.localeCompare(right));
}

function wikiHasPendingRunnerWorkSync(boardRoot) {
  return wikiPendingReviewPathsSync(boardRoot).length > 0;
}

// Quick scan of an inprogress ticket file for the "Claimed By:" runner id.
function ticketClaimedByRunnerIdSync(filePath) {
  try {
    const text = fsSync.readFileSync(filePath, "utf8");
    const match = text.match(/^- Claimed By:\s*(.+)$/m);
    if (!match) return "";
    const raw = match[1].trim();
    const tokenRunner = raw.includes(":") ? raw.split(":")[0] : raw;
    return tokenRunner.trim().toLowerCase();
  } catch {
    return "";
  }
}

function normalizeTodoIdSync(value) {
  const match = String(value || "").match(/(?:TODO[-_])?(\d+)/i);
  if (!match) return "";
  return `TODO-${String(Number.parseInt(match[1], 10)).padStart(3, "0")}`;
}

function runnerActiveTicketIdSync(boardRoot, runnerId) {
  try {
    const raw = fsSync.readFileSync(path.join(boardRoot, "runners", "state", `${runnerId}.state`), "utf8");
    const match = raw.match(/(?:^|\n)active_ticket_id=([^\n]*)/);
    return normalizeTodoIdSync(match ? match[1].trim() : "");
  } catch {
    return "";
  }
}

function runnerStateFieldSync(boardRoot, runnerId, field) {
  try {
    const raw = fsSync.readFileSync(path.join(boardRoot, "runners", "state", `${runnerId}.state`), "utf8");
    const match = raw.match(new RegExp(`(?:^|\\n)${String(field).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^\\n]*)`));
    return match ? String(match[1] || "").trim() : "";
  } catch {
    return "";
  }
}

function blockedActiveTicketFromPathSync(boardRoot, normalizedRunnerId, ticketPath, stateStage = "") {
  if (!ticketPath || !fsSync.existsSync(ticketPath)) return null;
  const claimedBy = ticketClaimedByRunnerIdSync(ticketPath);
  if (claimedBy && claimedBy !== normalizedRunnerId) return null;

  const ticketId = normalizeTodoIdSync(path.basename(ticketPath));
  if (!ticketId) return null;
  const ticketStage = markdownScalarInSectionSync(ticketPath, "Ticket", "Stage").toLowerCase();
  const blocked = stateStage === "blocked" || ticketStage === "blocked";
  if (!blocked) return null;

  let mtimeMs = "";
  try {
    mtimeMs = String(fsSync.statSync(ticketPath).mtimeMs || "");
  } catch {}
  const fingerprint = nodeCrypto.createHash("sha256")
    .update([ticketId, stateStage, ticketStage, mtimeMs].join("\0"))
    .digest("hex")
    .slice(0, 12);

  return {
    ticketId,
    path: `tickets/inprogress/${ticketId}.md`,
    fingerprint
  };
}

function runnerBlockedActiveTicketSync(boardRoot, runnerId, role = "") {
  if (role && normalizeRunnerRole(role) !== "worker") return null;
  const normalizedRunnerId = String(runnerId || "").trim().toLowerCase();
  if (!normalizedRunnerId) return null;
  const ticketId = runnerActiveTicketIdSync(boardRoot, normalizedRunnerId);
  const stateStage = runnerStateFieldSync(boardRoot, normalizedRunnerId, "active_stage").toLowerCase();
  if (ticketId) {
    const ticketPath = path.join(boardRoot, "tickets", "inprogress", `${ticketId}.md`);
    const blockedActive = blockedActiveTicketFromPathSync(boardRoot, normalizedRunnerId, ticketPath, stateStage);
    if (blockedActive) return blockedActive;
  }

  // If a runner restarted or active-get has not yet persisted state, the state
  // file can be empty while an inprogress ticket is still claimed by this runner.
  // Recover from the ticket ledger itself so blocked workers are still nudged.
  const claimedInprogress = listQueueFilesSync(boardRoot, "tickets/inprogress", /^TODO-\d+\.md$/, 1000)
    .filter((filePath) => ticketClaimedByRunnerIdSync(filePath) === normalizedRunnerId);
  for (const filePath of claimedInprogress) {
    const blockedActive = blockedActiveTicketFromPathSync(boardRoot, normalizedRunnerId, filePath, stateStage);
    if (blockedActive) return blockedActive;
  }
  return null;
}

function ticketAllowedPathsSync(filePath) {
  let text = "";
  try {
    text = fsSync.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  const out = [];
  let inSection = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^## Allowed Paths\b/.test(raw)) {
      inSection = true;
      continue;
    }
    if (/^## /.test(raw) && inSection) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    const match = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    const value = String(match[1] || "").replace(/`/g, "").trim();
    if (!allowedPathIsConcreteRepoPathSync(value)) continue;
    out.push(normalizeRelPathSync(value));
  }
  return [...new Set(out)].sort();
}

function allowedPathIsConcreteRepoPathSync(raw) {
  const clean = String(raw || "").replace(/`/g, "").trim();
  if (!clean) return false;
  if (/^(TBD|TODO:?|N\/A|NA|NONE)$/i.test(clean)) return false;
  if (/^TODO:?/i.test(clean)) return false;
  if (clean.startsWith("/")) return false;
  if (clean.startsWith("../") || clean.includes("/../")) return false;
  if (/[*?\[\]]/.test(clean)) return false;
  return true;
}

function normalizeRelPathSync(raw) {
  return String(raw || "").replace(/`/g, "").replace(/^[.][/]/, "").replace(/\/+$/, "").trim();
}

function workerTodoFileIsClaimableSync(filePath) {
  const candidatePaths = ticketAllowedPathsSync(filePath);
  return candidatePaths.length > 0;
}

function stripMarkdownTicksSync(value) {
  return String(value || "").replace(/^`+|`+$/g, "").trim();
}

function gitBranchExistsSync(projectRoot, branch) {
  const branchName = stripMarkdownTicksSync(branch);
  if (!projectRoot || !branchName) return false;
  try {
    const result = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function gitTrackedDirtySummarySync(projectRoot) {
  if (!projectRoot) return "";
  try {
    const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return String(result.stdout || "").trim();
  } catch {
    return "";
  }
}

function gitOutputSync(projectRoot, args) {
  if (!projectRoot) return "";
  try {
    const result = spawnSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return result.status === 0 ? String(result.stdout || "").trim() : "";
  } catch {
    return "";
  }
}

function gitStatusOkSync(projectRoot, args) {
  if (!projectRoot) return false;
  try {
    return spawnSync("git", args, { cwd: projectRoot, encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
}

// Return true if the role has actionable work in its queue directories.
// When runnerId is given (and role is worker), narrow the check to work the
// specific worker can actually pick up: owned actionable inprogress work, or
// any remaining todo with concrete Allowed Paths. Allowed Paths overlap is a
// merge warning, not a worker claim blocker.
function queueHasPendingWork(role, boardRoot, runnerId = "") {
  try {
    migrateLegacyTicketQueuesSync(boardRoot);
    if (role === "planner") {
      return listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i).some(plannerQueueFileIsActionableSync);
    }
    if (role === "worker") {
      const inprogress = listQueueFilesSync(boardRoot, "tickets/inprogress", /^TODO-\d+\.md$/);
      const readyToMerge = listQueueFilesSync(boardRoot, "tickets/ready-to-merge", /^TODO-\d+\.md$/);
      const verifier = listQueueFilesSync(boardRoot, "tickets/verifier", /^TODO-\d+\.md$/);
      const todo = listQueueFilesSync(boardRoot, "tickets/todo", /^TODO-\d+\.md$/);
      const normalizedRunnerId = String(runnerId || "").trim().toLowerCase();
      if (normalizedRunnerId) {
        const ownedInProgress = inprogress.filter((file) =>
          ticketClaimedByRunnerIdSync(file) === normalizedRunnerId
        );
        const ownedReadyToMerge = readyToMerge.filter((file) =>
          ticketClaimedByRunnerIdSync(file) === normalizedRunnerId
        );
        const ownedVerifier = verifier.filter((file) =>
          ticketClaimedByRunnerIdSync(file) === normalizedRunnerId
        );
        if (ownedInProgress.some(workerInprogressFileIsActionableSync)) return true;
        if (ownedReadyToMerge.length > 0) return true;
        if (ownedVerifier.length > 0) return true;
        if (ownedInProgress.length > 0) return false;
        return todo.some((file) => workerTodoFileIsClaimableSync(file));
      }
      return (
        inprogress.some(workerInprogressFileIsActionableSync) ||
        readyToMerge.length > 0 ||
        verifier.length > 0 ||
        todo.some((file) => workerTodoFileIsClaimableSync(file))
      );
    }
    if (role === "verifier") {
      return listQueueFilesSync(boardRoot, "tickets/verifier", /^TODO-\d+\.md$/).length > 0;
    }
    if (role === "wiki-maintainer") {
      return wikiHasPendingRunnerWorkSync(boardRoot);
    }
  } catch {
    // best-effort; return true so callers do not miss pending board work on errors
    return true;
  }
  return false;
}

// Compute a 12-char SHA256 fingerprint of a role's queue state.
//
// Per directory, callers pick between two modes:
//   - "mtime": hash filename + mtime. Sensitive to in-place edits (e.g. a
//     worker updating Notes inside its own ticket). Use for directories the
//     role actually reads content from.
//   - "names": hash filenames only. Insensitive to in-place edits. Use for
//     "gate lane" directories the role only watches for file
//     additions/removals (lane busy vs cleared).
//
// Mixing the two modes per role lets callers catch the events that matter
// (new PRD lands, lane clears, ticket promoted) while ignoring high-frequency
// no-op churn (worker edits Notes mid-ticket).
function computeQueueFingerprint(role, boardRoot) {
  /** @type {{ dir: string, mode: "mtime" | "names" }[]} */
  const entries = [];
  if (role === "planner") {
    migrateLegacyTicketQueuesSync(boardRoot);
    // PRD body content matters (status/title can change in place).
    entries.push({ dir: "tickets/prd", mode: "mtime" });
    // Final PRD merge is still planner-owned after all TODOs move under
    // tickets/done/PRD-NNN. Track directory names so the runner can notice
    // that boundary instead of reporting an empty PRD queue.
    entries.push({ dir: "tickets/done", mode: "names" });
    // Worker/verifier lanes are gate signals only — planner cares when a
    // file is moved in/out, not when the worker types into Notes.
    entries.push({ dir: "tickets/todo", mode: "names" });
    entries.push({ dir: "tickets/inprogress", mode: "names" });
    entries.push({ dir: "tickets/verifier", mode: "names" });
  } else if (role === "worker") {
    // Worker reads/writes the bodies of its own tickets, so mtime matters.
    entries.push({ dir: "tickets/inprogress", mode: "mtime" });
    entries.push({ dir: "tickets/verifier", mode: "mtime" });
    entries.push({ dir: "tickets/todo", mode: "mtime" });
  } else if (role === "verifier") {
    entries.push({ dir: "tickets/verifier", mode: "mtime" });
  } else if (role === "wiki-maintainer") {
    return computeWikiSourceHashSync(boardRoot).hash.slice(0, 12);
  }
  const parts = [];
  for (const { dir, mode } of entries) {
    const full = path.join(boardRoot, dir);
    if (!fsSync.existsSync(full)) continue;
    try {
      for (const f of fsSync.readdirSync(full).sort()) {
        if (mode === "names") {
          parts.push(`${dir}/${f}`);
          continue;
        }
        try {
          const st = fsSync.statSync(path.join(full, f));
          parts.push(`${dir}/${f}:${st.mtimeMs}`);
        } catch {}
      }
    } catch {}
  }
  return nodeCrypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

function appendRunnerLog(_boardRoot, _runnerId, _fields) {
  // Disabled: Autoflow no longer writes per-runner event logs.
}

// Inject a context compaction slash command into a PTY runner after a ticket
// boundary. Default mode is compact; hard clear is opt-in via event/env.
// Env knobs:
//   AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS   (default 1 = enabled)
//   AUTOFLOW_CONTEXT_RESET_MODE              (default compact; compact|clear|auto)
//   AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD   (default 100000; used by mode=auto)
//   AUTOFLOW_CONTEXT_RESET_DELAY_MS          (default 3000)
//   AUTOFLOW_CONTEXT_RESET_MIN_IDLE_MS       (default 2500)
//   AUTOFLOW_CONTEXT_RESET_MAX_ATTEMPTS      (default 24)
//   AUTOFLOW_CONTEXT_RESET_DEDUP_MS          (default 60000)
//   AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK  (default 1)
function normalizeContextResetMode(raw) {
  const mode = String(raw || "").trim().toLowerCase();
  return ["compact", "clear", "auto"].includes(mode) ? mode : "compact";
}

function resolveContextResetMode(requestedMode, cumulativeTokens, threshold) {
  if (requestedMode === "auto") {
    return cumulativeTokens >= threshold ? "clear" : "compact";
  }
  return requestedMode === "clear" ? "clear" : "compact";
}

function scheduleContextReset(runnerId, meta, opts = {}) {
  const enabled = (process.env.AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS ?? "1") !== "0";
  if (!enabled || !runnerId || !meta?.projectRoot) return;

  const boardDirName = meta.boardDirName || defaultBoardDirName;
  const boardRoot = path.join(meta.projectRoot, boardDirName);
  const runnerKey = ptyRunnerMeta.has(runnerId) ? runnerId : ptyRunnerKey(meta.projectRoot, boardDirName, runnerId);
  const publicRunnerId = meta.runnerId || runnerId;
  const thresholdRaw = Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD || "100000", 10);
  const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 100000;
  const respawnFallback = (process.env.AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK ?? "1") !== "0";
  const requestedMode = normalizeContextResetMode(opts.mode || process.env.AUTOFLOW_CONTEXT_RESET_MODE || "compact");
  const trigger = String(opts.trigger || opts.reason || "ticket_boundary");
  const resetReason = String(opts.reason || trigger);
  const delayMs = Math.max(500, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_DELAY_MS || "3000", 10) || 3000);
  const minIdleMs = Math.max(0, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_MIN_IDLE_MS || "2500", 10) || 2500);
  const maxAttempts = Math.max(1, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_MAX_ATTEMPTS || "24", 10) || 24);
  const dedupMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_CONTEXT_RESET_DEDUP_MS || "300000", 10) || 300000);
  const key = runnerKey;
  const existing = contextResetTimers.get(key);

  // In-flight guard: if a compact reset is already scheduled (timer pending,
  // waiting for the PTY to idle), don't restart its attempt counter. A "clear"
  // request still wins so we can escalate from compact to clear when token
  // pressure spikes. Otherwise drop the new request and let the existing
  // schedule fire on its own.
  if (existing?.timer && requestedMode !== "clear") {
    appendRunnerLog(boardRoot, publicRunnerId, {
      event: "context_reset_already_scheduled",
      runner_id: publicRunnerId,
      mode: requestedMode,
      trigger,
      reason: resetReason,
      existing_trigger: existing.trigger || "",
      existing_attempts: String(existing.attempt || 0)
    });
    return;
  }
  if (existing?.timer) clearTimeout(existing.timer);

  const now = Date.now();
  const recent = contextResetLastInjected.get(key);
  if (recent?.at && now - recent.at < dedupMs && requestedMode !== "clear") {
    appendRunnerLog(boardRoot, publicRunnerId, {
      event: "context_reset_deduped",
      runner_id: publicRunnerId,
      mode: requestedMode,
      trigger,
      reason: resetReason,
      last_mode: recent.mode || "",
      last_trigger: recent.trigger || "",
      last_reason: recent.reason || "",
      age_ms: String(Math.max(0, now - recent.at)),
      dedup_ms: String(dedupMs)
    });
    return;
  }

  const entry: { attempt: number; timer: ReturnType<typeof setTimeout> | null; trigger: string; mode: string } = {
    attempt: 0,
    timer: null,
    trigger,
    mode: requestedMode
  };
  const clearEntry = () => {
    if (entry.timer) clearTimeout(entry.timer);
    contextResetTimers.delete(key);
  };

  const scheduleNext = (waitMs) => {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.attempt += 1;

      const mgr = globalThis.__autoflowPtyManager;
      const runner = mgr && typeof mgr.get === "function" ? mgr.get(runnerKey) : null;
      if (
        !mgr ||
        !runner ||
        runner.status !== "running" ||
        !ptyRunnerMatchesRequestedScope(mgr, runnerKey, { projectRoot: meta.projectRoot, boardDirName })
      ) {
        appendRunnerLog(boardRoot, publicRunnerId, {
          event: "context_reset_cancelled",
          runner_id: publicRunnerId,
          trigger,
          reason: resetReason,
          cause: "runner_not_running"
        });
        clearEntry();
        return;
      }

      const lastDataAt = Number.isFinite(runner?.lastDataAt) ? runner.lastDataAt : 0;
      const idleMs = lastDataAt ? Date.now() - lastDataAt : Number.POSITIVE_INFINITY;
      if (idleMs < minIdleMs) {
        if (entry.attempt >= maxAttempts) {
          appendRunnerLog(boardRoot, publicRunnerId, {
            event: "context_reset_deferred_timeout",
            runner_id: publicRunnerId,
            trigger,
            reason: resetReason,
            idle_ms: String(Math.max(0, Math.round(idleMs))),
            attempts: String(entry.attempt)
          });
          clearEntry();
          return;
        }
        scheduleNext(delayMs);
        return;
      }

      let cumulativeTokens = 0;
      try {
        const statePath = path.join(boardRoot, "runners", "state", `${publicRunnerId}.state`);
        const raw = fsSync.readFileSync(statePath, "utf8");
        const m = raw.match(/(?:^|\n)cumulative_tokens=(\d+)/);
        if (m) cumulativeTokens = Number.parseInt(m[1], 10) || 0;
      } catch {}
      const mode = resolveContextResetMode(requestedMode, cumulativeTokens, threshold);
      const injected = mgr.injectContextReset(runnerKey, mode);
      if (!injected) {
        appendRunnerLog(boardRoot, publicRunnerId, {
          event: "context_reset_inject_failed",
          runner_id: publicRunnerId,
          mode,
          trigger,
          reason: resetReason
        });
        clearEntry();
        return;
      }

      appendRunnerLog(boardRoot, publicRunnerId, {
        event: "context_reset",
        runner_id: publicRunnerId,
        mode,
        trigger,
        reason: resetReason,
        cumulative_before: cumulativeTokens,
        threshold,
      });
      contextResetLastInjected.set(key, {
        at: Date.now(),
        mode,
        trigger,
        reason: resetReason
      });
      clearEntry();

      void meta;
      void publicRunnerId;

      if (respawnFallback) {
        const beforeData = runner.lastDataAt;
        setTimeout(() => {
          const r = mgr.get(runnerKey);
          if (!r || r.status !== "running") return;
          if (r.lastDataAt === beforeData) {
            appendRunnerLog(boardRoot, publicRunnerId, {
              event: "context_reset_no_output",
              runner_id: publicRunnerId,
              mode,
              threshold,
            });
          }
        }, 30000);
      }
    }, waitMs);
    if (typeof entry.timer?.unref === "function") entry.timer.unref();
  };

  contextResetTimers.set(key, entry);
  appendRunnerLog(boardRoot, publicRunnerId, {
    event: "context_reset_scheduled",
    runner_id: publicRunnerId,
    mode: requestedMode,
    trigger,
    reason: resetReason,
    delay_ms: String(delayMs),
    min_idle_ms: String(minIdleMs),
    max_attempts: String(maxAttempts)
  });
  scheduleNext(delayMs);
}

function runnerIdForContextResetQueueChange(relPath) {
  const match = String(relPath || "").match(/^runners\/state\/([A-Za-z0-9_.-]+)-context-reset\.queue\.jsonl$/);
  return match ? match[1] : "";
}

function readPendingRunnerContextResetEvents(boardRoot, runnerId) {
  if (!boardRoot || !runnerId) return [];
  const queuePath = path.join(boardRoot, "runners", "state", `${runnerId}-context-reset.queue.jsonl`);
  const pointerPath = path.join(boardRoot, "runners", "state", `${runnerId}-context-reset.pointer`);
  let pointer = "";
  try {
    pointer = fsSync.readFileSync(pointerPath, "utf8").trim();
  } catch {}
  const events = [];
  let latest = pointer;
  try {
    const raw = fsSync.readFileSync(queuePath, "utf8");
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      try {
        const event = JSON.parse(line);
        const at = String(event?.at || "");
        if (!at || (pointer && at <= pointer)) continue;
        events.push(event);
        if (!latest || at > latest) latest = at;
      } catch {}
    }
  } catch {
    return [];
  }
  if (latest && latest !== pointer) {
    try {
      fsSync.writeFileSync(pointerPath, `${latest}\n`, "utf8");
    } catch {}
  }
  return events;
}

function contextResetEventIsSchedulable(event) {
  const tool = String(event?.tool || event?.reason || "");
  const backendStatus = String(event?.backend_status || "");
  if (tool === "worker.submit-to-verifier" || backendStatus === "verify_pending") return false;
  if (tool.startsWith("verifier.")) return false;
  return true;
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

function runnerPromptFileSegment(value) {
  return String(value || "runner").replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80) || "runner";
}

function writeRunnerStartupPromptFile({ projectRoot, boardDirName, runnerId, prompt }) {
  const stateDir = path.join(projectRoot, boardDirName || defaultBoardDirName, "runners", "state");
  fsSync.mkdirSync(stateDir, { recursive: true });
  const promptPath = path.join(stateDir, `${runnerPromptFileSegment(runnerId)}-startup-prompt.md`);
  const tmpPath = `${promptPath}.${process.pid}.${Date.now()}.tmp`;
  fsSync.writeFileSync(tmpPath, String(prompt || "").replace(/[\r\n]+$/, "") + "\n", "utf8");
  fsSync.renameSync(tmpPath, promptPath);
  return promptPath;
}

function buildRunnerStartupScan({ role, runnerId }) {
	switch (normalizeRunnerRole(role)) {
    case "planner":
      return [
        `Startup scan:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "planner", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once and let it complete.`,
        `  2. If snapshot.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
        `  3. If work is needed, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources; do not open or follow references outside that scope.`,
        `  4. Create the worker-facing todo set for the selected PRD; every archived PRD must produce ≥1 Todo before idling.`,
        `  5. Rerun queue-snapshot once after the todo handoff or after confirming there is no actionable PRD input, then idle.`
      ].join("\n");
    case "worker":
      return [
        `Atomic rule: at most ONE active ticket at any moment.`,
        `Worktree cwd lock: after worker claim/worktree-ensure returns a worktree path, cd into it BEFORE any Edit/Write. Editing PROJECT_ROOT files mid-ticket clobbers other runners' working trees.`,
        `Startup scan order:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "active-get", "--runner", runnerId, "--max-items", "12"])}\` once.`,
        `  2. If active-get.active_get_terminal=true or active-get.ai_followup_reason=worker_ticket_waiting_for_verifier, summarize the compact result and idle without opening source files or running todo-snapshot.`,
        `  3. If active-get.ai_followup_reason=verifier_passed_merge_pending, do not idle and do not run todo-snapshot. Inspect only active-get.ai_followup_scope.inspect_only_recent_sources, merge the verifier-approved worktree into the ticket merge target, rerun required verification from that target, then run worker finalize-approved.`,
        `  4. If active-get.ai_followup_reason=verifier_revision_requested, do not idle and do not claim another ticket. Inspect only the scoped ticket/worktree, fix the verifier reason inside Allowed Paths, rerun local verification, then submit-to-verifier again.`,
        `  5. If active-get.ai_followup_reason=verifier_replan_requested, do not idle and do not claim another ticket. Inspect only the scoped ticket, then run worker request-replan for that ticket.`,
        `  6. If active-get.ai_followup_recommended=true, inspect only active-get.ai_followup_scope.inspect_only_recent_sources and resume that ticket. If the ticket is blocked, do one runner-owned blocked-handling pass (Allowed Paths 안 수정, 좁은 Done When/Allowed Paths 보정, verifier/replan 라우팅) before any idle decision.`,
        `  7. If no owned ticket exists, always run \`${autoflowShellCommand(["tool", "runner-tool", "worker", "todo-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once before deciding idle; active-get=false is not an idle decision.`,
        `  8. If todo-snapshot.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
        `  9. If a candidate exists, inspect only todo-snapshot.ai_followup_scope.inspect_only_recent_sources, then claim/worktree-ensure that one ticket before product edits.`,
        `  10. Do not inspect unrelated tickets or project files outside the selected ticket's Allowed Paths.`
      ].join("\n");
    case "verifier":
      return [
        `Startup scan:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "verifier", "queue-snapshot", "--runner", runnerId, "--max-items", "12"])}\` once and let it complete.`,
        `  2. If snapshot.ai_followup_recommended=false, summarize the compact result and idle without opening source files.`,
        `  3. If a verifier ticket exists, inspect only snapshot.ai_followup_scope.inspect_only_recent_sources, then run verifier evidence for that one ticket.`,
        `  4. Make exactly one semantic pass/revise/replan decision, run the matching verifier tool, rerun queue-snapshot once, then idle.`
      ].join("\n");
    case "wiki-maintainer":
      return [
        `Startup scan:`,
        `  1. Run \`${autoflowShellCommand(["tool", "runner-tool", "wiki", "tick", "--runner", runnerId, "--max-items", "12"])}\` first and let it complete; do not poll it at one-second intervals.`,
        `  2. If tick.ai_followup_recommended is false, summarize the tick result and idle without opening source files.`,
        `  3. If follow-up is needed, inspect only tick.ai_followup_scope.inspect_only_recent_sources; do not open or follow references outside that scope.`,
        `  4. Write or update at most one focused wiki page per turn via wiki write-page (DB upsert; no .autoflow/wiki markdown), then run \`${autoflowShellCommand(["tool", "runner-tool", "wiki", "tick", "--runner", runnerId, "--skip-telemetry", "--max-items", "12"])}\` once.`,
        `  5. If the rerun tick still reports ai_followup_recommended=true or recent_done_pending_review_count > 0, summarize the focused update and remaining count, then let the Stop hook continue the next wiki turn. Only idle when no follow-up remains.`
      ].join("\n");
    default:
      return "";
  }
}

// Persist a minimal state file so the renderer's existing UI (slider /
// badges / activity card) keeps working while PTY runner state is the source
// of truth.
async function writePtyRunnerStateFile(runnerId, fields) {
  try {
    const meta = ptyRunnerMeta.get(runnerId);
    if (!meta) return;
    const publicRunnerId = meta.runnerId || runnerId;
    const stateDir = path.join(meta.projectRoot, meta.boardDirName, "runners", "state");
    await fs.mkdir(stateDir, { recursive: true });
    const statePath = path.join(stateDir, `${publicRunnerId}.state`);
    let existing = "";
    try { existing = await fs.readFile(statePath, "utf8"); } catch {}
    const lines = new Map();
    for (const line of existing.split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      lines.set(line.slice(0, eq), line.slice(eq + 1));
    }
    // Defensive merge — when the existing file is missing the core spawn
    // identity fields (race against token watcher's first publish, system resume
    // wipes, manual edits) inject what we know from ptyRunnerMeta so the UI
    // never reports a live PTY runner as stopped just because the state file
    // is partial. PTY-level liveness is the truth source — state file just
    // mirrors it for the renderer.
    const ptyMgr = globalThis.__autoflowPtyManager;
    const ptyRunner = ptyMgr ? ptyMgr.get(runnerId) : null;
    const isPtyAlive = ptyRunner && ptyRunner.status === "running";
    if (isPtyAlive) {
      lines.set("id", publicRunnerId);
      if (meta.role) lines.set("role", meta.role);
      if (meta.agent) lines.set("agent", meta.agent);
      lines.set("mode", "pty");
      lines.set("status", "running");
      lines.set("runner_status", "running");
      if (ptyRunner.pid) lines.set("pid", String(ptyRunner.pid));
      if (meta.startedAt) lines.set("started_at", meta.startedAt);
      lines.set("stopped_by", "");
      if ((lines.get("last_stop_reason") || "").startsWith("startup_")) {
        lines.set("last_stop_reason", "");
      }
      if (/^(signal_|exit_)/i.test(lines.get("last_process_result") || "") || /^(user_stopped|loop_stopped)$/i.test(lines.get("last_process_result") || "")) {
        lines.set("last_process_result", "");
      }
      if (/^(user_stopped|loop_stopped)$/i.test(lines.get("last_result") || "")) {
        lines.set("last_result", "");
      }
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

function mirrorExistingPtyRunnerRunningState(runnerKey, existing, fields = {}) {
  if (!existing || existing.status !== "running") return false;
  void writePtyRunnerStateFile(runnerKey, {
    status: "running",
    runner_status: "running",
    mode: "pty",
    pid: String(existing.pid || ""),
    started_at: existing.startedAt || fields.started_at || "",
    last_event_at: new Date().toISOString(),
    stopped_by: "",
    last_stop_reason: "",
    last_process_result: "",
    ...fields
  });
  return true;
}

async function spawnRunnerPtySession(opts = {}, source = "manual") {
  const ptyManager = globalThis.__autoflowPtyManager;
  if (!ptyManager || typeof ptyManager.isAvailable !== "function" || !ptyManager.isAvailable()) {
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
  const initialPrompt = buildInitialPrompt({
    role: normalizedRole,
    agent,
    runnerId,
    projectRoot,
    boardDirName
  });
  const initialPromptFile = agent === "codex"
    ? writeRunnerStartupPromptFile({ projectRoot, boardDirName, runnerId, prompt: initialPrompt })
    : "";
  const command = buildAgentCliCommand(agent, model, reasoning, { boardDirName, initialPromptFile });
  if (!command) {
    return { ok: false, error: `unsupported agent: ${agent}` };
  }
  const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
  try {
    const existing = ptyManager.get(runnerKey);
    const existingMatchesScope = ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, {
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
      ptyManager.stop(runnerKey, { force: true });
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
    const runner = ptyManager.start(runnerKey, {
      command,
      execCommand: true,
      cwd: projectRoot,
      cols: Number.isFinite(opts.cols) ? opts.cols : 120,
      rows: Number.isFinite(opts.rows) ? opts.rows : 30,
      env: runnerEnv.env
    });
    const startedAt = new Date().toISOString();
    ptyRunnerMeta.set(runnerKey, {
      runnerId,
      role: normalizedRole,
      agent,
      projectRoot,
      boardDirName,
      codexHome: runnerEnv.codexHome,
      codexHistory: runnerEnv.codexHistory,
      startedAt
    });
    rememberProjectScope({ projectRoot, boardDirName });
    startCodexHookTrustPromptWatchdog(ptyManager, runnerKey);
    await writePtyRunnerStateFile(runnerKey, {
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
      last_event_at: startedAt,
      last_result: "",
      runner_status: "running",
      stopped_by: "",
      last_stop_reason: "",
      last_process_result: "",
      spawn_source: source
    });
    try { addPtySessionPid({ pid: runner.pid, runnerId, role: normalizedRole, agent, spawnedAt: startedAt }); } catch {}
    const promptDelay = 6000;
    if (agent === "codex" && initialPromptFile) {
      markRunnerInitialPromptSent(runnerKey);
    } else {
      setTimeout(() => {
        const paste = agent === "claude" ? "bracketed" : "plain";
        const ok = ptyManager.writePrompt(runnerKey, initialPrompt, { paste });
        if (ok) markRunnerInitialPromptSent(runnerKey);
      }, promptDelay);
    }
    setTimeout(() => {
      try {
        const snap = ptyManager.snapshot(runnerKey) || "";
      } catch (err) {
      }
    }, promptDelay + 2500);
    return { ok: true, runnerId, pid: runner.pid, status: runner.status, stdout: "" };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// Build the literal shell command to type into a PTY shell so the agent CLI
// runs in interactive (long-lived) mode. The user will see this exactly as
// if they typed it themselves. Disable destructive prompts via per-CLI flags
// so the agent can act without blocking on (y/n) prompts.
function buildAgentCliCommand(agent, model, reasoning, options = {}) {
  const parts = [];
  const rawSuffix = [];
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
      // Autoflow PTY runners are unattended automation. Bypass Codex's hook
      // trust review prompt so runner startup cannot stall before the first
      // turn; Autoflow still installs and audits the concrete Stop hook.
      parts.push(
        "codex",
        "--dangerously-bypass-approvals-and-sandbox",
        "--dangerously-bypass-hook-trust"
      );
      if (model) parts.push("-m", model);
      if (reasoning) parts.push("-c", `model_reasoning_effort="${reasoning}"`);
      if (options.initialPromptFile) rawSuffix.push(`"$(cat ${shellQuote(options.initialPromptFile)})"`);
      break;
    }
    default:
      return "";
  }
  // Quote args containing shell metacharacters so model IDs with brackets work in zsh.
  return [
    ...parts.map((p) => (/^[A-Za-z0-9_./:@%+=,-]+$/.test(p) ? p : shellQuote(p))),
    ...rawSuffix
  ]
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
  const cliShim = ensureAutoflowCliShim({ projectRoot, boardDirName });
  const runnerPath = pathWithPrependedEntries(
    cliShim.ok ? [cliShim.binDir] : [],
    augmentedPathValue(process.env.PATH || "")
  );
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
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_BOARD_ROOT: path.join(projectRoot, boardDirName),
    BOARD_ROOT: path.join(projectRoot, boardDirName),
    AUTOFLOW_BOARD_DIR_NAME: boardDirName,
    // Hooks (claude plugin, codex Stop, etc.) need to invoke the autoflow CLI
    // without hardcoding repo paths. The CLI normally runs via Electron's
    // node runtime; expose both halves so a hook wrapper can call
    // `ELECTRON_RUN_AS_NODE=1 "$AUTOFLOW_NODE_RUNTIME" "$AUTOFLOW_CLI_ENTRY" ...`.
    AUTOFLOW_NODE_RUNTIME: useElectronAsNodeRuntime() ? process.execPath : autoflowBinPath(),
    AUTOFLOW_CLI_ENTRY: autoflowBinPath(),
    AUTOFLOW_CLI_NEEDS_ELECTRON: useElectronAsNodeRuntime() ? "1" : "0",
    // Runner prompts use "$AUTOFLOW_CLI" as a single executable path. The
    // generated shim also sits at the front of PATH, so plain `autoflow`
    // resolves even on hosts where the CLI was never globally installed.
    AUTOFLOW_CLI: cliShim.ok ? cliShim.shimPath : autoflowBinPath(),
    AUTOFLOW_CLI_SHIM_ERROR: cliShim.ok ? "" : cliShim.error,
    PATH: runnerPath,
    SHELL: userLoginShell()
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
    }
  }
  return { env, codexHome, codexHistory: effectiveCodexHistory || "" };
}

function userShareRoot() {
  const override = process.env.AUTOFLOW_SHARE_ROOT;
  if (override && override.trim()) return path.resolve(override);
  return path.join(os.homedir(), ".autoflow", "share");
}

function roleInstructionPath(_boardRoot, role) {
  const shareRoot = userShareRoot();
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return path.join(shareRoot, "agents", "plan-to-ticket-agent.md");
    case "worker":
      return path.join(shareRoot, "agents", "worker-agent.md");
    case "verifier":
      return path.join(shareRoot, "agents", "verifier-agent.md");
    case "wiki-maintainer":
      return path.join(shareRoot, "agents", "wiki-maintainer-agent.md");
    case "todo":
      return path.join(shareRoot, "agents", "worker-agent.md");
    case "coordinator":
      return path.join(shareRoot, "agents", "plan-to-ticket-agent.md");
    default:
      return path.join(shareRoot, "agents", "plan-to-ticket-agent.md");
  }
}

function startupRulesPath(_boardRoot, role) {
  const shareRoot = userShareRoot();
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return path.join(shareRoot, "reference", "runner-startup-rules", "planner.md");
    case "worker":
      return path.join(shareRoot, "reference", "runner-startup-rules", "worker.md");
    case "verifier":
      return path.join(shareRoot, "reference", "runner-startup-rules", "verifier.md");
    case "wiki-maintainer":
      return path.join(shareRoot, "reference", "runner-startup-rules", "wiki-maintainer.md");
    default:
      return "";
  }
}

function commonStartupRulesPath(_boardRoot) {
  return path.join(userShareRoot(), "reference", "runner-startup-common.md");
}

function uniquePaths(paths) {
  const seen = new Set();
  return paths.filter((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

function markdownFileLink(label, filePath) {
  const safeLabel = String(label || filePath || "").replace(/[\]\n\r]/g, " ").trim() || String(filePath || "");
  const safeTarget = String(filePath || "").replace(/>/g, "%3E");
  return `[${safeLabel}](<${safeTarget}>)`;
}

function normalizeStartupPrdKey(raw) {
  const match = String(raw || "").match(/\bPRD[-_]?(\d+)\b/i);
  if (!match) return "";
  return `PRD-${String(Number.parseInt(match[1], 10)).padStart(3, "0")}`;
}

function startupPrdKeysFromText(text) {
  const keys = new Set();
  const re = /\bPRD[-_]?(\d+)\b/gi;
  let match;
  while ((match = re.exec(String(text || ""))) !== null) {
    const key = normalizeStartupPrdKey(match[0]);
    if (key) keys.add(key);
  }
  return keys;
}

function startupPrdKeyFromHandoffFile(boardRoot, filePath) {
  const rel = path.relative(path.join(boardRoot, "conversations"), filePath).split(path.sep).join("/");
  const fromPath = normalizeStartupPrdKey(rel);
  if (fromPath) return fromPath;
  try {
    return Array.from(startupPrdKeysFromText(fsSync.readFileSync(filePath, "utf8")))[0] || "";
  } catch {
    return "";
  }
}

function startupRelevantPrdKeys(boardRoot, role) {
  const keys = new Set();
  const addFromFile = (filePath) => {
    try {
      for (const key of startupPrdKeysFromText(fsSync.readFileSync(filePath, "utf8"))) {
        keys.add(key);
      }
    } catch {}
  };
  const addTicketBucket = (bucket) => {
    for (const filePath of listQueueFilesSync(boardRoot, `tickets/${bucket}`, /^TODO-\d+\.md$/i, 200)) {
      addFromFile(filePath);
    }
  };

  switch (normalizeRunnerRole(role)) {
    case "planner":
      for (const filePath of listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 200)) {
        const key = normalizeStartupPrdKey(path.basename(filePath, ".md"));
        if (key) keys.add(key);
      }
      addTicketBucket("todo");
      addTicketBucket("inprogress");
      break;
    case "worker":
      addTicketBucket("todo");
      addTicketBucket("inprogress");
      addTicketBucket("verifier");
      break;
    case "verifier":
      addTicketBucket("verifier");
      break;
    case "wiki-maintainer":
      // Wiki startup already scans conversations, so keep this list recent
      // rather than role-filtered.
      break;
    default:
      break;
  }
  return keys;
}

function collectStartupHandoffLinks({ role, projectRoot, boardDirName }, limit = 8) {
  const boardRoot = path.join(projectRoot, boardDirName || defaultBoardDirName);
  const conversationsRoot = path.join(boardRoot, "conversations");
  if (!fsSync.existsSync(conversationsRoot)) return [];
  const relevantPrdKeys = startupRelevantPrdKeys(boardRoot, role);
  const allFiles = walkMarkdownFilesSync(conversationsRoot)
    .filter((filePath) => path.basename(filePath).toLowerCase() !== "readme.md")
    .map((filePath) => {
      let stat = null;
      try { stat = fsSync.statSync(filePath); } catch {}
      const prdKey = startupPrdKeyFromHandoffFile(boardRoot, filePath);
      return {
        filePath,
        rel: path.relative(boardRoot, filePath).split(path.sep).join("/"),
        prdKey,
        mtimeMs: stat?.mtimeMs || 0
      };
    })
    .filter((entry) => entry.filePath && (!relevantPrdKeys.size || relevantPrdKeys.has(entry.prdKey)));
  return allFiles
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.rel.localeCompare(b.rel))
    .slice(0, Math.max(0, limit));
}

function buildStartupHandoffLinksBlock(options) {
  const links = collectStartupHandoffLinks(options, 8);
  if (!links.length) return [];
  return [
    `Startup handoff links:`,
    `- These links are supporting context. Do not open them until the startup scan selects the matching PRD/Todo scope.`,
    `- The PRD or ticket file remains the source of truth; handoff files preserve conversation context.`,
    ...links.map((entry) => {
      const prdSuffix = entry.prdKey ? ` (${entry.prdKey})` : "";
      return `- ${markdownFileLink(entry.rel, entry.filePath)}${prdSuffix}`;
    })
  ];
}

function startupRuleLinksBlock({ commonRulesPath, roleRulesPath }) {
  const links = [
    { label: "common runner startup rules", filePath: commonRulesPath },
    roleRulesPath ? { label: "role runner startup rules", filePath: roleRulesPath } : null
  ].filter(Boolean);
  if (!links.length) return [];
  return [
    `Startup rule links:`,
    `- These rule files are linked, not inlined. Use the compact startup tool output and the scan order below first.`,
    `- Open a linked rule file only if the compact tool fails or the selected scoped work directly requires expanded contract text.`,
    ...links.map((entry) => {
      const status = fsSync.existsSync(entry.filePath) ? "" : " (missing on disk; report this and continue with the scan order below)";
      return `- ${markdownFileLink(entry.label, entry.filePath)}${status}`;
    })
  ];
}

// Initial prompt sent once after the agent CLI is up. The Desktop start button
// opens the runner PTY for explicit user starts, then injects compact startup
// commands plus links to the expanded rule files instead of pasting them.
function buildInitialPrompt({ role, agent, runnerId, projectRoot, boardDirName }) {
  const boardRoot = path.join(projectRoot, boardDirName);
  const ticketsRoot = path.join(boardRoot, "tickets");
  const wikiRoot = path.join(boardRoot, "wiki");
  const normalizedRole = normalizeRunnerRole(role);
  const compactStartupRole = ["planner", "worker", "verifier", "wiki-maintainer"].includes(normalizedRole);
  const roleInstruction = roleInstructionPath(boardRoot, role);
  const commonRulesPath = commonStartupRulesPath(boardRoot);
  const roleRulesPath = startupRulesPath(boardRoot, role);
  const startupRuleLinks = startupRuleLinksBlock({ commonRulesPath, roleRulesPath });
  const startupHandoffLinks = buildStartupHandoffLinksBlock({ role: normalizedRole, projectRoot, boardDirName });
  const runnerStageCmd = autoflowShellCommand(["tool", "runner-stage"]);
  const runnerTokensCmd = autoflowShellCommand(["tool", "runner-tokens"]);
  // Role-specific "what to scan FIRST" so the runner picks up pre-existing
  // pending work during the visible startup turn.
  const startupScan = buildRunnerStartupScan({ role, runnerId }) || [
    `Startup scan:`,
    `  - List ${ticketsRoot} subfolders and pick up anything pending for this role.`
  ].join("\n");
  const projectAgents = path.join(projectRoot, "AGENTS.md");
  const boardAgents = path.join(boardRoot, "AGENTS.md");
  const fullContractFiles = uniquePaths(
    compactStartupRole
      ? []
      : [roleInstruction, projectAgents, boardAgents]
  );
  const contractReadIntro = compactStartupRole
    ? [
        `This startup turn is token-sensitive. Do not open full AGENTS, role docs,`,
        `or broad source searches unless the compact startup tool reports a failed`,
        `step or the scoped paths make those files directly relevant.`
      ]
    : [
        `Read these full contract files once before planning, editing board state, or`,
        `making role judgments:`
      ];
  const injectedStartupRules = normalizedRole === "wiki-maintainer"
    ? [
        `Compact wiki startup rules from the Desktop start button:`,
        `- Run the wiki tick command below once inside this visible turn.`,
        `- If tick.ai_followup_recommended=false, summarize the compact result and idle.`,
        `- If follow-up is needed, inspect only tick.ai_followup_scope.inspect_only_recent_sources.`,
        `- Do not open or follow references outside the inspect_only_recent_sources list.`,
        `- Write or update at most one focused wiki page via wiki write-page (DB upsert; no .autoflow/wiki markdown), then rerun tick with --skip-telemetry once.`,
        `- If the rerun tick still reports ai_followup_recommended=true or recent_done_pending_review_count > 0, summarize the focused update and let the Stop hook continue. Only idle when no follow-up remains.`
      ]
    : startupRuleLinks;
  const runnerTail = (() => {
    switch (normalizedRole) {
      case "planner":
        return [
          `Planner turn boundaries:`,
          `- Do not call runner-stage, runner-tokens, or date during this focused planner startup turn; Desktop tracks PTY state and usage.`,
          `- Use only planner queue-snapshot output and its ai_followup_scope before opening any board file.`,
          `- Do not open or follow references outside snapshot.ai_followup_scope.inspect_only_recent_sources.`,
          `- After the selected PRD's worker-facing todo set is created and queue-snapshot is rerun, after a required board-only blocked/replan decision, or immediately if the snapshot is idle, summarize briefly and idle.`,
          `- Every PRD must produce ≥1 Todo before being archived. The runtime slicer guarantees this on the normal path; do not idle before the slice is materialized.`
        ];
      case "worker":
        return [
          `Worker turn boundaries:`,
          `- Do not call generic runner-stage, runner-tokens, or date during this focused worker startup turn; Desktop tracks PTY state and usage.`,
          `- Use worker active-get first. When active-get reports no owned ticket, always run todo-snapshot before any idle decision.`,
          `- Do not open or follow references outside the selected ticket scope before claim/worktree-ensure.`,
          `- Product file inspection starts only after worktree-ensure succeeds and must stay inside Allowed Paths.`,
          `- After the current ticket reaches a wait state, verifier handoff, blocker, or finalization, summarize briefly and idle. If Desktop compacts the runner context later, immediately re-scan active-get plus todo-snapshot for remaining tickets.`
        ];
      case "verifier":
        return [
          `Verifier turn boundaries:`,
          `- Do not call runner-stage, runner-tokens, or date during this focused verifier startup turn; Desktop tracks PTY state and usage.`,
          `- Use only verifier queue-snapshot output and its ai_followup_scope before opening any verifier ticket.`,
          `- Gather evidence for one scoped verifier ticket and do not inspect unrelated project files outside the evidence/Allowed Paths boundary.`,
          `- After one pass/revise/replan decision and one queue-snapshot rerun, or immediately if the snapshot is idle, summarize briefly and idle.`
        ];
      case "wiki-maintainer":
        return [
        `Wiki turn boundaries:`,
        `- Do not call runner-stage during this focused wiki turn; Desktop tracks the PTY state.`,
        `- Do not run date. If no exact timestamp is already in scope, keep the existing frontmatter timestamp.`,
        `- Do not open or follow references outside tick.ai_followup_scope.inspect_only_recent_sources.`,
        `- After one focused summary once the rerun tick finishes, idle only if the rerun tick reports no follow-up. If follow-up remains, let the Stop hook continue another focused wiki turn.`
        ];
      default:
        return [
        `After the startup scan, continue this role's normal Autoflow work.`,
        `Keep working as long as anything is pending in the relevant queue.`,
        ``,
        `Hard rules: no git push; stay within the active ticket's Allowed Paths;`,
        `record durable progress in board files; do not re-read the full startup`,
        `contract files again within this session unless this runner process restarts.`,
        ``,
        `Active reporting (every turn — required):`,
        `  - On stage change: \`${runnerStageCmd} <stage> --runner ${runnerId} [--ticket <Todo-NNN>]\``,
        `  - End of turn: Desktop records provider usage automatically when exact live usage metadata is emitted.`,
        `    Do not also run \`${runnerTokensCmd} report\` for the same Desktop PTY turn.`,
        `    Only use \`${runnerTokensCmd} report --runner ${runnerId} --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]\``,
        `    in non-Desktop runs or when the host explicitly asks for a manual report and exact values are visible.`,
        `If exact values are not visible, skip token reporting; never report 0/0, placeholders, or estimates.`,
        `Format tick-id as`,
        `\`${runnerId}-<unix-epoch-sec>-<random4>\` so duplicates dedupe correctly.`
        ];
    }
  })();
  return [
    `Autoflow ${role} runner started (id=${runnerId}, agent=${agent}).`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Role:         ${normalizedRole}`,
    `Autoflow CLI: "$AUTOFLOW_CLI" is injected as a runnable shim, and its directory is first on PATH as "autoflow".`,
    `If plain "autoflow" or npx autoflow fails, use "$AUTOFLOW_CLI"; do not idle because the global CLI is missing.`,
    ``,
    ...startupHandoffLinks,
    startupHandoffLinks.length ? `` : null,
    ...injectedStartupRules,
    ``,
    `Desktop opened this PTY because the user explicitly started the runner.`,
    compactStartupRole
      ? `Run the compact startup tool inside this visible turn, then decide whether focused work is needed.`
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
    ...runnerTail
  ].filter((line) => line !== null && typeof line !== "undefined").join("\n");
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
  readBoardSnapshotCache.delete(readBoardSnapshotCacheKey(scope));
}

// Install @parcel/watcher handlers for the directories that should retrigger the
// renderer's `readBoard` snapshot. @parcel/watcher is the only board watcher:
// it avoids lossy recursive watching and supports snapshot catch-up.
//   - tickets/* (queue moves: planner / worker / manual)
//   - runners/config*.toml (agent/model/reasoning changes)
//   - runners/state/* (status flips)
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
    subscription: null,
    snapshotRefreshTimer: null,
    handoffSweepTimer: null,
    debounceTimer: null,
    lastReason: "",
    pendingReasons: new Set()
  };
  boardWatchersByScope.set(key, entry);

  const scheduleBoardRunnerHandoffs = (reasons) => {
    schedulePlannerHandoffTurnsForScope({
      projectRoot: scope.projectRoot,
      boardDirName,
      boardRoot,
      reasons
    });
    scheduleVerifierHandoffTurnsForScope({
      projectRoot: scope.projectRoot,
      boardDirName,
      boardRoot,
      reasons
    });
    scheduleWorkerTodoHandoffTurnsForScope({
      projectRoot: scope.projectRoot,
      boardDirName,
      boardRoot,
      reasons
    });
    scheduleWorkerVerifierDecisionTurnsForScope({
      projectRoot: scope.projectRoot,
      boardDirName,
      boardRoot,
      reasons
    });
    scheduleWikiHandoffTurnsForScope({
      projectRoot: scope.projectRoot,
      boardDirName,
      boardRoot,
      reasons
    });
  };

  const broadcast = () => {
    const reasons = entry.pendingReasons.size > 0
      ? Array.from(entry.pendingReasons)
      : [entry.lastReason || "board-change"];
    const reason = reasons[reasons.length - 1] || "board-change";
    entry.lastReason = "";
    entry.pendingReasons.clear();
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
    // PTY side effects are narrowly event-driven: queue handoff turns for
    // newly queued work, plus context compaction at final ticket boundaries.
    try {
      scheduleBoardRunnerHandoffs(reasons);
      const contextResetByRunner = new Map();
      for (const candidateReason of reasons) {
        const contextResetRunnerId = runnerIdForContextResetQueueChange(candidateReason);
        if (contextResetRunnerId) {
          const events = readPendingRunnerContextResetEvents(boardRoot, contextResetRunnerId);
          for (const event of events) {
            contextResetByRunner.set(contextResetRunnerId, event);
          }
        }
      }
      if (contextResetByRunner.size > 0) {
        for (const [rid, event] of contextResetByRunner.entries()) {
          const runnerKey = ptyRunnerKey(scope.projectRoot, boardDirName, rid);
          const meta = ptyRunnerMeta.get(runnerKey);
          if (!meta) {
            appendRunnerLog(boardRoot, rid, {
              event: "context_reset_event_skipped",
              runner_id: rid,
              reason: String(event?.reason || "ticket_boundary"),
              cause: "runner_meta_missing"
            });
            continue;
          }
          if (meta.projectRoot !== scope.projectRoot || meta.boardDirName !== boardDirName) continue;
          if (!contextResetEventIsSchedulable(event)) {
            appendRunnerLog(boardRoot, rid, {
              event: "context_reset_event_skipped",
              runner_id: rid,
              reason: String(event?.reason || "ticket_boundary"),
              cause: "not_final_ticket_boundary",
              tool: String(event?.tool || ""),
              backend_status: String(event?.backend_status || "")
            });
            continue;
          }
          scheduleContextReset(runnerKey, meta, {
            mode: event?.mode,
            trigger: String(event?.reason || "ticket_boundary"),
            reason: String(event?.tool || event?.reason || "ticket_boundary"),
          });
        }
      }
    } catch {}
  };

  const enqueue = (reason) => {
    const normalizedReason = reason || "board-change";
    entry.lastReason = normalizedReason || entry.lastReason || "board-change";
    entry.pendingReasons.add(normalizedReason);
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      broadcast();
    }, boardWatchDebounceMs);
  };

  // Translate an absolute path returned by @parcel/watcher into the
  // board-relative slug we feed downstream routing (`tickets/prd/PRD-001.md`).
  // Events outside the watched scope (or that we explicitly ignore) return "".
  const watchedRelPrefixes = ["tickets/", "runners/", "wiki/"];
  const toBoardRel = (absolutePath) => {
    const rel = path.relative(boardRoot, String(absolutePath || "")).split(path.sep).join("/");
    if (!rel || rel.startsWith("..")) return "";
    if (rel === "tickets" || rel === "runners" || rel === "wiki") return rel;
    if (!watchedRelPrefixes.some((prefix) => rel.startsWith(prefix))) return "";
    if (rel === "runners/logs" || rel.startsWith("runners/logs/") || rel === "logs" || rel.startsWith("logs/")) return "";
    const base = path.basename(rel);
    if (base.endsWith(".tmp") || base.endsWith(".swp") || base.endsWith("~") || base.startsWith(".#") || base.startsWith(".!")) return "";
    return rel;
  };

  const snapshotPath = path.join(boardRoot, "runners", "state", "parcel-watcher.snapshot");
  const refreshSnapshot = async () => {
    try {
      fsSync.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      await parcelWatcher.writeSnapshot(boardRoot, snapshotPath, { ignore: parcelIgnore });
    } catch {
      // best-effort
    }
  };

  const parcelIgnore = [
    "**/.git/**",
    "**/node_modules/**",
    "**/runners/logs/**",
    "**/logs/**",
    "**/*.tmp",
    "**/*.swp",
    "**/.#*",
    "**/*~"
  ];

  // Boot catch-up: if a previous snapshot exists, replay every event that
  // happened while the desktop was closed.
  // @parcel/watcher tracks file mtime+size via native FSEvents/inotify state,
  // so this catches manual file edits, external sync, or watcher gaps.
  const catchUpFromSnapshot = async () => {
    if (!fsSync.existsSync(snapshotPath)) return;
    try {
      const events = await parcelWatcher.getEventsSince(boardRoot, snapshotPath, { ignore: parcelIgnore });
      for (const event of events || []) {
        const rel = toBoardRel(event.path);
        if (rel) enqueue(rel || "boot-catchup");
      }
      if (events && events.length > 0) {
        enqueue("boot-catchup");
      }
    } catch {
      // Snapshot corrupt or incompatible — drop it and restart fresh.
      try { fsSync.rmSync(snapshotPath, { force: true }); } catch {}
    }
  };

  (async () => {
    await catchUpFromSnapshot();
    try {
      entry.subscription = await parcelWatcher.subscribe(
        boardRoot,
        (err, events) => {
          if (err) return; // best-effort; renderer can refresh on next read
          for (const event of events || []) {
            const rel = toBoardRel(event.path);
            if (rel) enqueue(rel);
          }
        },
        { ignore: parcelIgnore }
      );
    } catch {
      // If subscription fails (e.g., permissions), keep the entry alive and do
      // not crash the main process.
    }
    await refreshSnapshot();
    try {
      scheduleBoardRunnerHandoffs(["boot-catchup"]);
    } catch {}
    // Refresh snapshot every 10 minutes so a fresh boot has a recent baseline.
    entry.snapshotRefreshTimer = setInterval(() => { void refreshSnapshot(); }, 10 * 60 * 1000);
    const handoffSweepMs = Math.max(1000, Number.parseInt(process.env.AUTOFLOW_BOARD_HANDOFF_SWEEP_MS || "5000", 10) || 5000);
    entry.handoffSweepTimer = setInterval(() => {
      try {
        scheduleBoardRunnerHandoffs(["boot-catchup"]);
      } catch {}
    }, handoffSweepMs);
    if (typeof entry.handoffSweepTimer?.unref === "function") entry.handoffSweepTimer.unref();
  })();

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
  if (entry.snapshotRefreshTimer) {
    clearInterval(entry.snapshotRefreshTimer);
    entry.snapshotRefreshTimer = null;
  }
  if (entry.handoffSweepTimer) {
    clearInterval(entry.handoffSweepTimer);
    entry.handoffSweepTimer = null;
  }
  if (entry.subscription) {
    void entry.subscription.unsubscribe().catch(() => {});
    entry.subscription = null;
  }
  boardWatchersByScope.delete(key);
}

function drainBoardWatcherEntries() {
  const unsubscribes = [];
  for (const key of [...boardWatchersByScope.keys()]) {
    const entry = boardWatchersByScope.get(key);
    if (!entry) continue;
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
      entry.debounceTimer = null;
    }
    if (entry.snapshotRefreshTimer) {
      clearInterval(entry.snapshotRefreshTimer);
      entry.snapshotRefreshTimer = null;
    }
    if (entry.handoffSweepTimer) {
      clearInterval(entry.handoffSweepTimer);
      entry.handoffSweepTimer = null;
    }
    if (entry.subscription) {
      unsubscribes.push(entry.subscription.unsubscribe().catch(() => {}));
      entry.subscription = null;
    }
    boardWatchersByScope.delete(key);
  }
  return unsubscribes;
}

function disposeAllBoardWatchers() {
  void Promise.all(drainBoardWatcherEntries());
}

async function disposeAllBoardWatchersAsync() {
  await Promise.all(drainBoardWatcherEntries());
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
  // Make sure the board listener is alive whenever the renderer
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
    return;
  }

  app.dock.setIcon(appIcon);
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

// Pure-read CLI commands the desktop polls on every readBoard cycle. Each of
// these handlers reads board markdown + state files and emits a key=value
// dump on stdout; they do not spawn child processes, mutate state, or wait
// for IPC. Running them in-process avoids paying an Electron-as-node startup
// cost (~100-200ms per spawn × 5 commands × every cache TTL window) which
// otherwise shows up as continuous fan-spin while the desktop is open.
const inProcessCliCommands = new Set([
  "status",
  "metrics",
  "runners list"
]);

let cachedInProcessCliModules: any = null;
function inProcessCliModules() {
  if (cachedInProcessCliModules) return cachedInProcessCliModules;
  cachedInProcessCliModules = {
    statusProject: require("../cli/system/status").statusProject,
    metricsProject: require("../cli/system/metrics").metricsProject,
    runnersProject: require("../cli/system/runners").runnersProject
  };
  return cachedInProcessCliModules;
}

function inProcessCliKey(args) {
  if (!args.length) return "";
  if (args[0] === "runners") {
    return args[1] ? `runners ${args[1]}` : "runners";
  }
  return args[0];
}

function canRunInProcess(args) {
  return inProcessCliCommands.has(inProcessCliKey(args));
}

function runAutoflowInProcess(args, label) {
  const key = inProcessCliKey(args);
  const stdoutChunks = [];
  const stderrChunks = [];
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  const origExit = process.exit;
  let capturedExit = 0;
  const exitSentinel = new Error("__autoflow_inprocess_exit__");

  process.stdout.write = ((chunk) => {
    stdoutChunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk) => {
    stderrChunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  (process as any).exit = (code) => {
    capturedExit = typeof code === "number" ? code : 0;
    throw exitSentinel;
  };

  let thrown: any = null;
  try {
    const mods = inProcessCliModules();
    if (key === "status") {
      mods.statusProject(args.slice(1));
    } else if (key === "metrics") {
      mods.metricsProject(args.slice(1));
    } else if (key === "runners list") {
      mods.runnersProject(args.slice(1));
    } else {
      throw new Error(`runAutoflowInProcess: unsupported command ${key}`);
    }
  } catch (error) {
    if (error !== exitSentinel) {
      thrown = error;
    }
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    (process as any).exit = origExit;
  }

  if (thrown) {
    return Promise.resolve({
      ok: false,
      command: label,
      code: typeof thrown?.code === "number" ? thrown.code : 1,
      signal: "",
      stdout: stdoutChunks.join(""),
      stderr: `${stderrChunks.join("")}${thrown?.stack || thrown?.message || String(thrown)}`,
      cancelled: false,
      cacheStatus: "in-process-error"
    });
  }

  return Promise.resolve({
    ok: capturedExit === 0,
    command: label,
    code: capturedExit,
    signal: "",
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
    cancelled: false,
    cacheStatus: "in-process"
  });
}

function runAutoflowArgs(args, options = {}) {
  if (canRunInProcess(args)) {
    return runAutoflowInProcess(args, commandLabel(args));
  }
  const invocation = cliInvocation(args);
  const label = commandLabel(args);

  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...invocation.env,
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
    const env = sanitizedProcessEnv();
    if (executableOnPath(command, env)) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (exists) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(exists);
    };
    const shell = userLoginShell();
    const child = spawn(shell, loginShellCommandArgs(shell, `command -v ${shellQuote(command)}`), {
      cwd: repoRoot,
      env
    });
    const timeout = setTimeout(() => {
      child.kill();
      finish(false);
    }, 10000);

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
  env.PATH = augmentedPathValue(env.PATH);
  if (!env.SHELL) {
    env.SHELL = userLoginShell();
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

function uniqueStringValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function stringListValue(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  return typeof value === "string" ? [value] : [];
}

function settingsEnvValue(settings, key) {
  const env = settings && typeof settings.env === "object" ? settings.env : null;
  return typeof env?.[key] === "string" ? env[key] : "";
}

function normalizeClaudeModelValue(value) {
  const trimmed = String(value || "").trim();
  return trimmed;
}

function isPreferredClaudeModel(value) {
  const normalized = normalizeClaudeModelValue(value).toLowerCase();
  if (!normalized || normalized.includes("[1m]") || normalized.endsWith("-1m")) {
    return false;
  }
  const officialFullName =
    /^claude-(?:opus|sonnet)-\d+(?:-\d+)?-\d{8}$/.test(normalized) ||
    /^claude-3-(?:5|7)-sonnet-\d{8}$/.test(normalized);
  return (
    normalized === "opus" ||
    normalized === "sonnet" ||
    officialFullName
  );
}

async function readInstalledAgentProfiles() {
  const home = os.homedir();
  const [codexInstalled, claudeInstalled] = await Promise.all([
    commandExists("codex"),
    commandExists("claude")
  ]);

  const codexConfigPath = path.join(home, ".codex", "config.toml");
  const claudeSettingsPath = path.join(home, ".claude", "settings.json");

  const claudeSettings = await readJsonIfExists(claudeSettingsPath);

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
  const claudeModel = typeof claudeSettings?.model === "string" ? claudeSettings.model : "";
  const claudeReasoning =
    typeof claudeSettings?.effortLevel === "string"
      ? claudeSettings.effortLevel
      : typeof claudeSettings?.effort === "string"
        ? claudeSettings.effort
        : "";
  const claudeModels = uniqueStringValues(
    [
      claudeModel,
      ...stringListValue(claudeSettings?.availableModels),
      process.env.ANTHROPIC_MODEL,
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
      process.env.ANTHROPIC_CUSTOM_MODEL_OPTION,
      settingsEnvValue(claudeSettings, "ANTHROPIC_MODEL"),
      settingsEnvValue(claudeSettings, "ANTHROPIC_DEFAULT_OPUS_MODEL"),
      settingsEnvValue(claudeSettings, "ANTHROPIC_DEFAULT_SONNET_MODEL"),
      settingsEnvValue(claudeSettings, "ANTHROPIC_CUSTOM_MODEL_OPTION")
    ]
      .map(normalizeClaudeModelValue)
      .filter(isPreferredClaudeModel)
  );
  return {
    codex: {
      installed: codexInstalled,
      model: codexProfile.model,
      models: uniqueStringValues([codexProfile.model]),
      reasoning: codexProfile.reasoning,
      supportsReasoning: true
    },
    claude: {
      installed: claudeInstalled,
      model: claudeModel,
      models: claudeModels,
      reasoning: claudeReasoning,
      supportsReasoning: true
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

function runnerLiveLogPaths(_runner, _boardRoot) {
  return [];
}

function runnerArtifactLogPaths(_runner) {
  return [];
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

  return {
    ok: false,
    command: "runner auth",
    code: -1,
    stdout: "",
    stderr: `Runner auth prompt is not supported for agent=${options.agent || ""}.`
  };
}

async function recentRunnerArtifactLogPaths(_runner, _boardRoot, _maxFiles = 10) {
  return [];
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
  const publicRunnerId = meta.runnerId || runnerId;
  const boardRoot = path.join(meta.projectRoot, meta.boardDirName);
  const tickId = options.tickId || `${publicRunnerId}-${Math.floor(Date.now() / 1000)}-${nodeCrypto.randomBytes(2).toString("hex")}`;
  try {
    runnerTokensApi.setBoardRoot(boardRoot);
    const result = runnerTokensApi.reportCore(publicRunnerId, {
      tickId,
      input: String(usage.input || 0),
      output: String(usage.output || 0),
      cacheRead: String(usage.cacheRead || 0),
      cacheCreate: String(usage.cacheCreate || 0),
      note: options.note || `host_pty_stream:${usage.source || "usage"}`,
    });
    if (!result.ok && result.message) {
    } else if (result.message) {
    }
  } catch (error) {
  }
}

function runSessionTokenUsageImportForRunner(runnerId) {
  const meta = ptyRunnerMeta.get(runnerId);
  if (!meta || !["codex", "claude"].includes(meta.agent) || !meta.projectRoot || !meta.boardDirName) return;
  const publicRunnerId = meta.runnerId || runnerId;
  if (sessionTokenUsageImportInflight.has(runnerId)) {
    sessionTokenUsageImportPending.add(runnerId);
    return;
  }
  sessionTokenUsageImportInflight.add(runnerId);

  const boardRoot = path.join(meta.projectRoot, meta.boardDirName);
  try {
    const prevProjectRoot = process.env.AUTOFLOW_PROJECT_ROOT;
    process.env.AUTOFLOW_PROJECT_ROOT = meta.projectRoot;
    try {
      runnerTokensApi.setBoardRoot(boardRoot);
      const result = runnerTokensApi.importSessionTokenUsageCore(publicRunnerId);
      if (result.imported > 0) {
      }
    } finally {
      if (prevProjectRoot === undefined) delete process.env.AUTOFLOW_PROJECT_ROOT;
      else process.env.AUTOFLOW_PROJECT_ROOT = prevProjectRoot;
    }
  } catch (error) {
  } finally {
    sessionTokenUsageImportInflight.delete(runnerId);
    if (sessionTokenUsageImportPending.has(runnerId)) {
      sessionTokenUsageImportPending.delete(runnerId);
      scheduleSessionTokenUsageImportForRunner(runnerId);
    }
  }
}

function scheduleSessionTokenUsageImportForRunner(runnerId, delayMs = sessionTokenUsageImportDelayMs()) {
  const meta = ptyRunnerMeta.get(runnerId);
  if (!meta || !["codex", "claude"].includes(meta.agent) || !meta.projectRoot || !meta.boardDirName) return;
  const existing = sessionTokenUsageImportTimers.get(runnerId);
  if (existing) return;
  const timer = setTimeout(() => {
    sessionTokenUsageImportTimers.delete(runnerId);
    runSessionTokenUsageImportForRunner(runnerId);
  }, Math.max(0, Number(delayMs) || 0));
  if (typeof timer.unref === "function") timer.unref();
  sessionTokenUsageImportTimers.set(runnerId, timer);
}

function flushSessionTokenUsageImportForRunner(runnerId) {
  const existing = sessionTokenUsageImportTimers.get(runnerId);
  if (existing) clearTimeout(existing);
  sessionTokenUsageImportTimers.delete(runnerId);
  runSessionTokenUsageImportForRunner(runnerId);
}

function isRunnerTokenSourceAuthoritative(source) {
  return String(source || "").trim() === "llm_reported";
}

async function readRunnerTokenUsage(boardRoot, runners = []) {
  const totals = new Map();
  const stateDir = path.join(boardRoot, "runners", "state");
  for (const runner of runners) {
    const rid = runner && runner.id;
    if (!rid) continue;
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

async function enrichWikiRunnerBackgroundTasks(runners, boardRoot) {
  if (!Array.isArray(runners) || runners.length === 0) return;
  const wikiRunner = runners.find((runner) => String(runner?.role || "").toLowerCase().includes("wiki"));
  if (!wikiRunner) return;

  const stateDir = path.join(boardRoot, "runners", "state");
  const indexState = await readJsonIfExists(path.join(stateDir, "wiki-index-refresh.json")) || {};
  let pid = positiveIntegerValue(indexState.pid);
  if (!pid) {
    try {
      pid = positiveIntegerValue((await fs.readFile(path.join(stateDir, "wiki-index-refresh.lock", "pid"), "utf8")).trim());
    } catch {}
  }
  if (!pid) return;

  const identity = inspectPidIdentity(pid);
  if (!identity.alive || !commandLooksLikeAutoflowRunner(identity.command)) return;

  wikiRunner.backgroundTask = "wiki_index_refresh";
  wikiRunner.backgroundTaskLabel = "위키 인덱스 갱신 중";
  wikiRunner.backgroundTaskPid = String(pid);
  wikiRunner.backgroundTaskStartedAt = typeof indexState.last_started_at === "string" ? indexState.last_started_at : "";
  wikiRunner.backgroundTaskLogPath = typeof indexState.log_path === "string" ? indexState.log_path : "";
}

function countRunnerQueueStatus(runner, boardRoot) {
  const role = String(runner?.role || "").toLowerCase();
  const runnerId = String(runner?.id || "").trim().toLowerCase();
  const empty = {
    queueStatus: "none",
    queueStatusLabel: "처리할 작업 없음",
    queueStatusDetail: "",
    queueClaimableCount: 0,
    queueBlockedCount: 0,
    queuePendingCount: 0
  };
  try {
    if (role === "worker" || role === "ticket") {
      const inprogress = listQueueFilesSync(boardRoot, "tickets/inprogress", /^TODO-\d+\.md$/, 1000);
      const readyToMerge = listQueueFilesSync(boardRoot, "tickets/ready-to-merge", /^TODO-\d+\.md$/, 1000);
      const todo = listQueueFilesSync(boardRoot, "tickets/todo", /^TODO-\d+\.md$/, 1000);
      const ownedInProgress = inprogress.filter((file) => ticketClaimedByRunnerIdSync(file) === runnerId);
      const ownedReadyToMerge = readyToMerge.filter((file) => ticketClaimedByRunnerIdSync(file) === runnerId);
      const claimable = todo.filter((file) => workerTodoFileIsClaimableSync(file));
      const blocked = Math.max(0, todo.length - claimable.length);
      if (ownedInProgress.some(workerInprogressFileIsActionableSync) || ownedReadyToMerge.length > 0) {
        return {
          queueStatus: "owned",
          queueStatusLabel: "진행 중인 티켓 확인 중",
          queueStatusDetail: `${ownedInProgress.length + ownedReadyToMerge.length}개 담당 중`,
          queueClaimableCount: claimable.length,
          queueBlockedCount: blocked,
          queuePendingCount: todo.length
        };
      }
      if (claimable.length > 0) {
        return {
          queueStatus: "claimable",
          queueStatusLabel: "다음 티켓 확인 중",
          queueStatusDetail: `${claimable.length}개 처리 가능`,
          queueClaimableCount: claimable.length,
          queueBlockedCount: blocked,
          queuePendingCount: todo.length
        };
      }
      if (todo.length > 0 && blocked > 0) {
        return {
          queueStatus: "ticket_blocked",
          queueStatusLabel: "티켓 보완 필요",
          queueStatusDetail: `${blocked}개에 구체적인 Allowed Paths가 없음`,
          queueClaimableCount: 0,
          queueBlockedCount: blocked,
          queuePendingCount: todo.length
        };
      }
      return {
        ...empty,
        queueStatusDetail: "TODO 대기열 비어 있음"
      };
    }
    if (role === "verifier") {
      const pending = listQueueFilesSync(boardRoot, "tickets/verifier", /^TODO-\d+\.md$/, 1000).length;
      return pending > 0
        ? {
            queueStatus: "claimable",
            queueStatusLabel: "검증 티켓 확인 대기",
            queueStatusDetail: `${pending}개 대기`,
            queueClaimableCount: pending,
            queueBlockedCount: 0,
            queuePendingCount: pending
          }
        : { ...empty, queueStatusDetail: "검증 대기열 비어 있음" };
    }
    if (role === "planner" || role === "plan") {
      const pending = listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 1000)
        .filter(plannerQueueFileIsActionableSync)
        .length;
      return pending > 0
        ? {
            queueStatus: "claimable",
            queueStatusLabel: "PRD 확인 대기",
            queueStatusDetail: `${pending}개 대기`,
            queueClaimableCount: pending,
            queueBlockedCount: 0,
            queuePendingCount: pending
          }
        : { ...empty, queueStatusDetail: "PRD 대기열 비어 있음" };
    }
    if (role.includes("wiki")) {
      const pendingPaths = wikiPendingReviewPathsSync(boardRoot);
      return pendingPaths.length > 0
        ? {
            queueStatus: "claimable",
            queueStatusLabel: "위키 갱신 대기",
            queueStatusDetail: `${pendingPaths.length}개 반영 필요`,
            queueClaimableCount: 1,
            queueBlockedCount: 0,
            queuePendingCount: pendingPaths.length
          }
        : { ...empty, queueStatusDetail: "위키 변경 없음" };
    }
  } catch {
    return {
      ...empty,
      queueStatus: "unknown",
      queueStatusLabel: "대기열 확인 필요",
      queueStatusDetail: "상태 계산 실패"
    };
  }
  return empty;
}

async function enrichRunnerQueueStatus(runners, boardRoot) {
  for (const runner of runners || []) {
    Object.assign(runner, countRunnerQueueStatus(runner, boardRoot));
  }
}

function usefulPreviewValue(value) {
  const normalized = String(value || "").trim();
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
    "Plan Template",
    "Ticket"
  ]);

  return placeholders.has(normalized) ? "" : normalized.slice(0, 160);
}

function stripWorkflowTitlePrefix(value) {
  let title = String(value || "").trim();
  for (let i = 0; i < 3; i += 1) {
    const next = title
      .replace(/^(?:PRD|Project)\s+(?:(?:prd|project)[_-])?\d+\s*:\s*/i, "")
      .replace(/^(?:(?:prd|project)[_-])\d+\s*:\s*/i, "")
      .replace(/^(?:Todo|TODO|Ticket)\s*(?:(?:Todo|tickets)[_-])?\d+\s*:\s*/i, "")
      .replace(/^Todo[-_]\d+\s*:\s*/i, "")
      .replace(/^tickets[_-]\d+\s*:\s*/i, "")
      .trim();
    if (next === title) break;
    title = next;
  }
  return title;
}

function markdownPreviewTitle(content, fallback) {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const headingMatch = line.trim().match(/^#\s+(.+)$/);
    if (!headingMatch) {
      continue;
    }

    const headingTitle = stripWorkflowTitlePrefix(headingMatch[1]);
    const value = usefulPreviewValue(headingTitle);
    if (value) {
      return value;
    }
  }

  for (const line of lines) {
    const fieldMatch = line
      .trim()
      .match(/^-?\s*(?:\[[ xX]\]\s*)?(?:Title|Name|Goal|Summary):\s*(.+)$/i);
    if (!fieldMatch) {
      continue;
    }

    const value = usefulPreviewValue(stripWorkflowTitlePrefix(fieldMatch[1].replace(/^`|`$/g, "")));
    if (value) {
      return value;
    }
  }

  for (const line of lines) {
    const value = usefulPreviewValue(stripWorkflowTitlePrefix(line.trim().replace(/^#+\s*/, "")));
    if (value) {
      return value;
    }
  }

  return fallback;
}

function extractTicketScalar(content, field) {
  const re = new RegExp(`^-\\s*${field.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*:\\s*(.+?)\\s*$`, "im");
  const match = content.match(re);
  return match ? match[1].replace(/^`+|`+$/g, "").trim() : "";
}

// Resolve a ticket's parent PRD key. Tickets created under the current
// naming convention carry `- PRD Key: PRD-NNN`, but legacy tickets in
// `tickets/done/ticket_NNN/TODO-NNN.md` use older fields (`- Project Key:`,
// `- Key:`, `- Source PRD: \`tickets/prd/PRD-NNN.md\``). Try each in order
// and normalize the captured value to the canonical `PRD-NNN` form so
// renderer coverage matching does not have to special-case any of them.
function extractTicketPrdKey(content) {
  const direct =
    extractTicketScalar(content, "PRD Key") ||
    extractTicketScalar(content, "Project Key") ||
    extractTicketScalar(content, "Key");
  const sourcePrd = extractTicketScalar(content, "Source PRD");
  const sourceMatch = sourcePrd.match(/PRD-\d+/i);
  const raw = direct || (sourceMatch ? sourceMatch[0] : "");
  if (!raw) return "";
  const norm = raw.match(/PRD-\d+/i);
  return norm ? norm[0].toUpperCase() : "";
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
      acknowledged: /^-\s*\[[xX]\]\s*사람 확인 완료\s*$/m.test(content),
      prdKey: extractTicketPrdKey(content),
      stage: extractTicketScalar(content, "Stage")
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

async function readFilePrefixText(filePath, limitBytes = runnerLogPreviewReadLimitBytes) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size <= 0) {
    return { content: "", stat };
  }

  const bytesToRead = Math.min(stat.size, Math.max(1, limitBytes));
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    return { content: buffer.subarray(0, bytesRead).toString("utf8"), stat };
  } finally {
    await handle.close();
  }
}

async function readTextPreview(filePath) {
  try {
    const { content, stat } = await readFilePrefixText(filePath);
    const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) || path.basename(filePath);
    return {
      filePath,
      name: path.basename(filePath),
      title: firstLine.slice(0, 160),
      modifiedAt: stat.mtime.toISOString()
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
  const canonicalOrder = ["prd", "todo", "inprogress", "verifier", "done", "check"];
  const ignoredLegacyFolders = new Set(["inbox", "backlog", "reject", "order"]);
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

  const confinedPath = await resolveExistingPathInside(userShareRoot(), targetPath, {
    rootLabel: "Autoflow 공유 루트"
  });
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
  // only consumes the slice limits below (e.g. 16 runner logs, etc.),
  // but without an internal cap the listing helper used to readFile every
  // single file just to mtime-sort them — that read 600+ MB of runner logs
  // on every readBoard call.
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
    [".jsonl", ".json", ".env"],
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

  // Dashboard metrics come from `autoflow metrics`. Code totals are marker-based
  // there; runner state is only a fallback when metrics output is unavailable.
  const parsedMetrics = metricsResult ? parseKeyValueOutput(metricsResult.stdout) : {};
  try {
    const metricsHasCodeTotals =
      positiveIntegerValue(parsedMetrics.autoflow_code_files_changed_count) > 0 ||
      positiveIntegerValue(parsedMetrics.autoflow_code_insertions_count) > 0 ||
      positiveIntegerValue(parsedMetrics.autoflow_code_deletions_count) > 0 ||
      positiveIntegerValue(parsedMetrics.autoflow_code_volume_count) > 0;
    if (!metricsHasCodeTotals) {
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
    }
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
    logs: [],
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

function readBoardSnapshotCacheKey(options = {}) {
  return [
    options.projectRoot || "",
    options.boardDirName || defaultBoardDirName
  ].join("\0");
}

function readBoardCached(options = {}) {
  const key = readBoardSnapshotCacheKey(options);
  const entry = readBoardSnapshotCache.get(key);
  const now = Date.now();
  if (entry?.result && now - entry.updatedAt < readBoardSnapshotCacheTtlMs) {
    return Promise.resolve(entry.result);
  }
  if (entry?.promise) {
    return entry.promise;
  }
  const nextEntry = entry || { result: null, updatedAt: 0, promise: null };
  nextEntry.promise = readBoard(options)
    .then((result) => {
      nextEntry.result = result;
      nextEntry.updatedAt = Date.now();
      return result;
    })
    .finally(() => {
      nextEntry.promise = null;
    });
  readBoardSnapshotCache.set(key, nextEntry);
  return nextEntry.promise;
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
  await enrichWikiRunnerBackgroundTasks(runners, boardRoot);
  await enrichRunnerQueueStatus(runners, boardRoot);

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
//   planner         → first actionable PRD-*.md in tickets/prd/
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
  if (normalizedId) {
    keys.add(normalizedId);
    if (normalizedId.startsWith("worker-")) {
      const suffix = normalizedId.replace(/^worker-/, "");
      keys.add(`ai-${suffix}`);
    }
  } else if (role === "worker" || role === "ticket") {
    keys.add("worker");
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
  const readTitle = async (filePath) => {
    if (!filePath) return "";
    try {
      const text = await fs.readFile(filePath, "utf8");
      const beforeSplitMap = text.split(/^##\s+(?:PRD|Todo|Ticket|Implementation)\s+Split(?:\s+Map)?\s*$/m)[0];
      const titleScalar = beforeSplitMap.match(/^- Title:\s*(.+)$/m);
      if (titleScalar) return titleScalar[1].trim();
      const heading = text.match(/^#\s+(.+)$/m);
      if (heading) {
        return heading[1]
          .replace(/^(?:PRD|Project|Todo)\s+\d+\s*:\s*/i, "")
          .trim();
      }
      return "";
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
        prdKey: extractTicketPrdKey(text)
      };
    } catch {
      return null;
    }
  };
  const inprogressTickets = [];
  const verifierTickets = [];
  try {
    const entries = (await fs.readdir(path.join(ticketsRoot, "inprogress")))
      .filter((name) => /^TODO-\d+\.md$/i.test(name))
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
  try {
    const entries = (await fs.readdir(path.join(ticketsRoot, "verifier")))
      .filter((name) => /^TODO-\d+\.md$/i.test(name))
      .sort();
    for (const file of entries) {
      const ticketPath = path.join(ticketsRoot, "verifier", file);
      verifierTickets.push({
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
    runner.activeSpecRef = "";
  };
  const assignedTicketIds = new Set();
  for (const runner of runners) {
    if (isWorkerRunner(runner)) {
      const available = inprogressTickets.filter((ticket) => !assignedTicketIds.has(ticket.id));
      const byClaim = available.find((ticket) => runnerClaimsTicketFromMeta(runner, ticket.meta));
      const byState = available.find((ticket) => (runner.activeTicketId || "") === ticket.id);
      const unclaimed = available.find((ticket) => !runners.some((candidate) => runnerClaimsTicketFromMeta(candidate, ticket.meta)));
      const ticket = byClaim || byState || unclaimed;
      if (ticket) {
        assignedTicketIds.add(ticket.id);
        await assignTicketToRunner(runner, ticket);
      } else {
        clearActiveTicket(runner);
      }
    } else if (runner.role === "verifier") {
      const queuedByState = verifierTickets.find((ticket) => (runner.activeTicketId || "") === ticket.id);
      const queued = queuedByState || verifierTickets[0];
      if (queued) {
        await assignTicketToRunner(runner, queued, "verifying");
        runner.activeStage = "verifying";
        continue;
      }
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
      const activePrdId = String(runner.activeTicketId || "");
      const activePlannerStage = String(runner.activeStage || "").toLowerCase();
      const activePrdFile = /^PRD[-_].+$/i.test(activePrdId)
        ? path.join(ticketsRoot, "prd", `${activePrdId}.md`)
        : "";
      if (activePrdFile && safeIsFileSync(activePrdFile) && activePlannerStage && activePlannerStage !== "idle") {
        runner.activeTicketTitle = runner.activeTicketTitle || await readTitle(activePrdFile);
        runner.activeItem = runner.activeItem || activePrdId;
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
        "when name='wiki_index_meta' then 2",
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
    const dataSql = selectedTable === "wiki_vectors"
      ? `select chunk_id, dim, length(vector_blob) as vector_bytes, model, indexed_at from ${quotedTable} limit ${limit} offset ${offset}`
      : `select * from ${quotedTable} limit ${limit} offset ${offset}`;
    const dataRows = await sqliteJson(dbPath, dataSql);
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
    for (const { pid, command } of orphans) {
      // Process-group kill first (clean up any lingering claude/codex
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
    const runnerId = name.replace(/\.state$/, "");
    const runnerKey = ptyRunnerKey(scope.projectRoot, scope.boardDirName, runnerId);
    const ptyMgr = globalThis.__autoflowPtyManager;
    const liveRunner = ptyMgr && typeof ptyMgr.get === "function" ? ptyMgr.get(runnerKey) : null;
    if (
      liveRunner?.status === "running" &&
      ptyRunnerMatchesRequestedScope(ptyMgr, runnerKey, {
        projectRoot: scope.projectRoot,
        boardDirName: scope.boardDirName
      })
    ) {
      continue;
    }
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
    values.runner_status = "stopped";
    values.pid = "";
    values.stopped_by = "";
    values.last_stop_reason = `startup_${action}`;
    values.last_result = "loop_stopped";
    values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    // Clear active ticket — single-flow design: any unfinished blocker should
    // re-emerge through verifier replan, not as stale state on the new desktop
    // session.
    for (const key of [
      "active_item",
      "active_ticket_id",
      "active_ticket_title",
      "active_stage",
      "active_spec_ref",
      "active_ticket_path",
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
    }
  } catch {}

  // powerMonitor: when the system sleeps, PTYs are suspended (not killed) so
  // we just preserve current state. On resume, re-run self-heal in case the
  // OS or watchdogs broke any state file during the suspend window.
  try {
    powerMonitor.on("suspend", () => {
    });
    powerMonitor.on("resume", () => {
      void selfHealPtyRunnerStates();
    });
  } catch (err) {
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
  ipcMain.handle("autoflow:readBoard", withTimeout(withScopeMemory(readBoardCached), 30000));
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
  ipcMain.handle("autoflow:controlStopHook", withScopeMemory(controlStopHook));
  ipcMain.handle("autoflow:controlWatcher", withScopeMemory(controlWatcher));
  ipcMain.handle("autoflow:readBoardFile", withTimeout(withScopeMemory(readBoardFile), 30000));
  ipcMain.handle("autoflow:readStartupRules", withTimeout(withScopeMemory(readStartupRules), 10000));
  ipcMain.handle("autoflow:writeStartupRules", withTimeout(withScopeMemory(writeStartupRules), 10000));
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
  //   autoflow:runnerPtyInput   legacy renderer stdin path; rejected because terminals are read-only
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
    scheduleCodexHookTrustPromptAccept(ptyManager, runnerId, data);
    for (const usage of ptyUsageReportsFromChunk(runnerId, data)) {
      reportPtyUsageViaRunnerTool(runnerId, usage);
    }
    // Always schedule a debounced import. The debounce drops back-to-back calls
    // so this is effectively one in-process incremental sync per debounce window
    // even when stdout never emits a usage JSON line (e.g. codex). Cost is ~0
    // because the cumulative is cached.
    scheduleSessionTokenUsageImportForRunner(runnerId);
  });
  ptyManager.on("status", (payload) => {
    if (payload.status === "stopped") {
      const currentRunner = typeof ptyManager.get === "function" ? ptyManager.get(payload.runnerId) : null;
      const payloadPid = Number(payload.pid || 0);
      if (
        currentRunner?.status === "running" &&
        Number.isInteger(currentRunner.pid) &&
        currentRunner.pid > 0 &&
        Number.isInteger(payloadPid) &&
        payloadPid > 0 &&
        currentRunner.pid !== payloadPid
      ) {
        const meta = ptyRunnerMeta.get(payload.runnerId);
        const publicRunnerId = meta?.runnerId || ptyRunnerPublicId(payload.runnerId);
        if (meta?.projectRoot) {
          const boardRoot = path.join(meta.projectRoot, meta.boardDirName || defaultBoardDirName);
          appendRunnerLog(boardRoot, publicRunnerId, {
            event: "stale_pty_stop_ignored",
            runner_id: publicRunnerId,
            stopped_pid: String(payloadPid),
            live_pid: String(currentRunner.pid)
          });
        }
        return;
      }
    }
    const scopedPayload = ptyRunnerScopedPayload(payload.runnerId, payload);
    broadcastPty("autoflow:runnerPtyStatus", scopedPayload);
    // Mirror status into runner state file so legacy UI bindings keep working.
    const fields = {
      status: payload.status === "running" ? "running" : "stopped",
      runner_status: payload.status === "running" ? "running" : "stopped",
      pid: payload.status === "running" ? String(payload.pid || "") : "",
      last_event_at: new Date().toISOString()
    };
    if (payload.status === "stopped") {
      Object.assign(fields, {
        active_item: "",
        active_ticket_id: "",
        active_ticket_title: "",
        active_stage: "",
        active_spec_ref: "",
        active_ticket_path: ""
      });
      if (payload.signal) {
        fields.last_result = "loop_stopped";
        fields.last_process_result = `signal_${payload.signal}`;
        fields.last_stop_reason = `pty_signal_${payload.signal}`;
      } else if (typeof payload.exitCode === "number") {
        // Agent CLIs can exit non-zero after a successful turn because their
        // stop hooks failed or the PTY closed after completion. Keep that as
        // process telemetry instead of overwriting the last semantic runner
        // result with noisy values like exit_1.
        fields.last_process_result = `exit_${payload.exitCode}`;
      } else {
        fields.last_result = "user_stopped";
        fields.last_process_result = "user_stopped";
      }
    }
    void writePtyRunnerStateFile(payload.runnerId, fields);
      if (payload.status === "stopped") {
        flushSessionTokenUsageImportForRunner(payload.runnerId);
        const verifierTurnTimer = verifierHandoffTurnTimers.get(payload.runnerId);
        if (verifierTurnTimer?.timer) clearTimeout(verifierTurnTimer.timer);
        verifierHandoffTurnTimers.delete(payload.runnerId);
        verifierHandoffLastInjected.delete(payload.runnerId);
        const plannerTurnTimer = plannerHandoffTurnTimers.get(payload.runnerId);
        if (plannerTurnTimer?.timer) clearTimeout(plannerTurnTimer.timer);
        plannerHandoffTurnTimers.delete(payload.runnerId);
        plannerHandoffLastInjected.delete(payload.runnerId);
        const wikiTurnTimer = wikiHandoffTurnTimers.get(payload.runnerId);
        if (wikiTurnTimer?.timer) clearTimeout(wikiTurnTimer.timer);
        wikiHandoffTurnTimers.delete(payload.runnerId);
        wikiHandoffLastInjected.delete(payload.runnerId);
        const workerTodoTurnTimer = workerTodoHandoffTurnTimers.get(payload.runnerId);
        if (workerTodoTurnTimer?.timer) clearTimeout(workerTodoTurnTimer.timer);
        workerTodoHandoffTurnTimers.delete(payload.runnerId);
        workerTodoHandoffLastInjected.delete(payload.runnerId);
        const workerVerifierDecisionTimer = workerVerifierDecisionTurnTimers.get(payload.runnerId);
        if (workerVerifierDecisionTimer?.timer) clearTimeout(workerVerifierDecisionTimer.timer);
        workerVerifierDecisionTurnTimers.delete(payload.runnerId);
        workerVerifierDecisionLastInjected.delete(payload.runnerId);
        ptyRunnerMeta.delete(payload.runnerId);
        ptyTokenUsageParseState.delete(payload.runnerId);
        sessionTokenUsageImportPending.delete(payload.runnerId);
        clearCodexHookTrustPromptAutomation(payload.runnerId);
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
    if (!ptyManager.isAvailable()) {
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
    const initialPrompt = buildInitialPrompt({
      role: normalizedRole,
      agent,
      runnerId,
      projectRoot,
      boardDirName
    });
    const initialPromptFile = agent === "codex"
      ? writeRunnerStartupPromptFile({ projectRoot, boardDirName, runnerId, prompt: initialPrompt })
      : "";
    const command = buildAgentCliCommand(agent, model, reasoning, { boardDirName, initialPromptFile });
    if (!command) {
      return { ok: false, error: `unsupported agent: ${agent}` };
    }
    const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
    try {
      const existing = ptyManager.get(runnerKey);
      const existingMatchesScope = ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, {
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
        ptyManager.stop(runnerKey, { force: true });
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
      const runner = ptyManager.start(runnerKey, {
        command,
        execCommand: true,
        cwd: projectRoot,
        cols: Number.isFinite(opts.cols) ? opts.cols : 120,
        rows: Number.isFinite(opts.rows) ? opts.rows : 30,
        env: runnerEnv.env
      });
      const startedAt = new Date().toISOString();
      ptyRunnerMeta.set(runnerKey, {
        runnerId,
        role: normalizedRole,
        agent,
        projectRoot,
        boardDirName,
        codexHome: runnerEnv.codexHome,
        codexHistory: runnerEnv.codexHistory,
        startedAt
      });
      rememberProjectScope({ projectRoot, boardDirName });
      startCodexHookTrustPromptWatchdog(ptyManager, runnerKey);
      // Initial state — UI immediately reflects "running"
      void writePtyRunnerStateFile(runnerKey, {
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
        last_event_at: startedAt,
        last_result: ""
      });
      // Record PID in precise reaper registry so a desktop crash next time
      // leaves the next session a clean kill list.
      try {
        addPtySessionPid({ pid: runner.pid, runnerId, role: normalizedRole, agent, spawnedAt: startedAt });
      } catch {}
      // Wait for the agent CLI to load its TUI before pushing the initial
      // prompt. The shared delay covers the supported CLIs without making the
      // first turn feel sluggish.
      const PROMPT_INJECT_DELAY_MS = 6000;
      if (agent === "codex" && initialPromptFile) {
        markRunnerInitialPromptSent(runnerKey);
      } else {
        setTimeout(() => {
          const paste = agent === "claude" ? "bracketed" : "plain";
          const ok = ptyManager.writePrompt(runnerKey, initialPrompt, { paste });
          if (ok) markRunnerInitialPromptSent(runnerKey);
        }, PROMPT_INJECT_DELAY_MS);
      }
      // Diagnostic: dump PTY buffer 2.5s AFTER prompt write so we can see
      // whether the TUI accepted it (text in input box / model response /
      // mojibake / nothing).
      setTimeout(() => {
        try {
          const snap = ptyManager.snapshot(runnerKey) || "";
        } catch (err) {
        }
      }, PROMPT_INJECT_DELAY_MS + 2500);
      return { ok: true, runnerId, pid: runner.pid, status: runner.status };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle("autoflow:runnerPtyStop", (_event, opts = {}) => {
    const runnerKey = ptyRunnerKeyForScope(opts, opts.runnerId);
    if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, opts)) {
      return { ok: false, error: "runner scope mismatch" };
    }
    if (opts.force) {
      const runner = typeof ptyManager.get === "function" ? ptyManager.get(runnerKey) : null;
      if (Number.isInteger(runner?.pid) && runner.pid > 0) {
        killPidForcefully(runner.pid);
        removePtySessionPid(runner.pid);
      }
    }
    return { ok: ptyManager.stop(runnerKey, { force: !!opts.force }) };
  });
  ipcMain.handle("autoflow:runnerPtyResize", (_event, opts = {}) => {
    const runnerKey = ptyRunnerKeyForScope(opts, opts.runnerId);
    if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, opts)) {
      return { ok: false };
    }
    const ok = ptyManager.resize(runnerKey, opts.cols, opts.rows);
    return { ok };
  });
  ipcMain.handle("autoflow:runnerPtyInput", (_event, opts = {}) => {
    const runnerId = String(opts.runnerId || "");
    if (!runnerId) {
      return { ok: false, error: "runnerId required" };
    }
    return { ok: false, error: "runner terminal input is read-only" };
  });
  ipcMain.handle("autoflow:runnerPtySnapshot", (_event, opts = {}) => {
    const runnerKey = ptyRunnerKeyForScope(opts, opts.runnerId);
    if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, opts)) {
      return { snapshot: "" };
    }
    return { snapshot: ptyManager.snapshot(runnerKey) };
  });
  ipcMain.handle("autoflow:runnerPtyList", () => {
    return {
      runners: ptyManager.list().map((runner) => ({
        ...runner,
        runnerKey: runner.id,
        id: ptyRunnerPublicId(runner.id),
        projectRoot: ptyRunnerMeta.get(runner.id)?.projectRoot || "",
        boardDirName: ptyRunnerMeta.get(runner.id)?.boardDirName || defaultBoardDirName
      }))
    };
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
          const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
          const existing = ptyManager.list().find((r) => r.id === runnerKey && r.status === "running");
          if (existing) {
            mirrorExistingPtyRunnerRunningState(runnerKey, existing, {
              id: runnerId,
              role,
              agent,
              model,
              reasoning,
              codex_history: codexHistory,
              spawn_source: "auto-spawn-existing"
            });
            continue;
          }
          if (!(await commandExists(agent))) {
            continue;
          }
          const initialPrompt = buildInitialPrompt({ role, agent, runnerId, projectRoot, boardDirName });
          const initialPromptFile = agent === "codex"
            ? writeRunnerStartupPromptFile({ projectRoot, boardDirName, runnerId, prompt: initialPrompt })
            : "";
          const command = buildAgentCliCommand(agent, model, reasoning, { boardDirName, initialPromptFile });
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
          const runner = ptyManager.start(runnerKey, {
            command,
            execCommand: true,
            cwd: projectRoot,
            cols: 120,
            rows: 30,
            env: runnerEnv.env
          });
          ptyRunnerMeta.set(runnerKey, {
            runnerId,
            role,
            agent,
            projectRoot,
            boardDirName,
            codexHome: runnerEnv.codexHome,
            codexHistory: runnerEnv.codexHistory,
            startedAt
          });
          rememberProjectScope({ projectRoot, boardDirName });
          startCodexHookTrustPromptWatchdog(ptyManager, runnerKey);
          await writePtyRunnerStateFile(runnerKey, {
            id: runnerId, status: "running", role, agent, model, reasoning,
            mode: "pty", pid: String(runner.pid || ""), started_at: startedAt,
            codex_home: runnerEnv.codexHome || "",
            codex_history: runnerEnv.codexHistory || "",
            last_event_at: startedAt
          });
          try { addPtySessionPid({ pid: runner.pid, runnerId, role, agent, spawnedAt: startedAt }); } catch {}
          const promptDelay = 6000;
          if (agent === "codex" && initialPromptFile) {
            markRunnerInitialPromptSent(runnerKey);
          } else {
            setTimeout(() => {
              const paste = agent === "claude" ? "bracketed" : "plain";
              const ok = ptyManager.writePrompt(runnerKey, initialPrompt, { paste });
              if (ok) markRunnerInitialPromptSent(runnerKey);
            }, promptDelay);
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch (err) {
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
  clearVerifierHandoffTurnTimers();
  // 1. Kill our PTY children (zsh + claude/codex). Synchronous.
  try {
    if (globalThis.__autoflowPtyManager) {
      globalThis.__autoflowPtyManager.shutdown();
    }
  } catch {}
  // 2. Stop board watchers.
  try { disposeAllBoardWatchers(); } catch {}
  // 3. Drop the precise PTY PID registry — children are dead.
  try { clearPtySessionPids(); } catch {}
  // 4. Mark this session as cleanly shut down so next-boot reaper does not
  //    over-probe.
  try { markDesktopSessionClean(reason || "quit"); } catch {}
}

async function runShutdownCleanupAsync(reason) {
  if (appShutdownCleanupRun) return;
  appShutdownCleanupRun = true;
  if (memoryCeilingIntervalId) {
    try { clearInterval(memoryCeilingIntervalId); } catch {}
    memoryCeilingIntervalId = null;
  }
  clearVerifierHandoffTurnTimers();
  try {
    if (globalThis.__autoflowPtyManager) {
      globalThis.__autoflowPtyManager.shutdown();
    }
  } catch {}
  try { await disposeAllBoardWatchersAsync(); } catch {}
  try { clearPtySessionPids(); } catch {}
  try { markDesktopSessionClean(reason || "quit"); } catch {}
}

app.on("before-quit", () => {
  runShutdownCleanupSync("before-quit");
});

app.on("will-quit", () => {
  runShutdownCleanupSync("will-quit");
});

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.once(signal, () => {
    void (async () => {
      await runShutdownCleanupAsync(signal);
      app.exit(0);
    })();
  });
}

// Force quit on all-windows-closed (including macOS) so before-quit fires
// our synchronous PTY teardown. The macOS dock-keep convention is intentionally
// dropped — leaving the app idle in the dock while PTY children stay spawned
// causes orphan/zombie process drift after crashes or background unloads.
app.on("window-all-closed", () => {
  app.quit();
});
