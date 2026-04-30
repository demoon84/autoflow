const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = process.env.AUTOFLOW_REPO_ROOT || path.resolve(__dirname, "../../..");
const scaffoldManifestPath = path.join(repoRoot, "scaffold", "manifest.toml");

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
const readBoardDiagnosticCacheTtlMs = 60 * 1000;
const readBoardDiagnosticCache = new Map();
const knownProjectScopes = new Map();
const activeChildProcesses = new Set();
// invocationId → child process. Lets the renderer cancel a long-running
// CLI call (runRole / controlWiki --synth / installBoard / etc.) by id.
const cancellableInvocations = new Map();
let runnerShutdownInProgress = false;

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
    child.kill("SIGTERM");
  } catch (error) {
    return { ok: false, cancelled: false, reason: error.message || "kill_failed" };
  }
  cancellableInvocations.delete(invocationId);
  return { ok: true, cancelled: true };
}

function appConfig() {
  return {
    defaultBoardDirName
  };
}

function rememberProjectScope(options) {
  if (!options || typeof options.projectRoot !== "string" || !options.projectRoot) {
    return;
  }
  const boardDirName = options.boardDirName || defaultBoardDirName;
  const key = `${options.projectRoot}\0${boardDirName}`;
  if (!knownProjectScopes.has(key)) {
    knownProjectScopes.set(key, { projectRoot: options.projectRoot, boardDirName });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: "코덱스 작업 흐름",
    backgroundColor: "#f7f7f7",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // macOS: 데스크탑 4(=Mission Control space 4) 에서 시작되도록 Ctrl+4 를 먼저 보낸 뒤,
  // 잠시 모든 space 에 보이게 했다가 현재(=Desktop 4) space 에 고정한다.
  // 사전 설정 필요: System Settings -> Keyboard -> Keyboard Shortcuts -> Mission Control
  // 에서 "Switch to Desktop 4" 단축키 활성화, 그리고 Electron(또는 터미널)의 Accessibility 권한.
  win.once("ready-to-show", () => {
    if (process.platform === "darwin") {
      // key code 21 = "4", control down -> macOS "Switch to Desktop 4" 단축키.
      execFile(
        "osascript",
        ["-e", 'tell application "System Events" to key code 21 using control down'],
        () => {
          // 단축키가 비활성화돼 있어도 창은 어쨌든 띄워야 하므로 결과는 무시.
          setTimeout(() => {
            win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            win.show();
            win.focus();
            win.setVisibleOnAllWorkspaces(false);
          }, 350);
        }
      );
    } else {
      win.show();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }
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
      activeChildProcesses.delete(child);
      clearCancellableInvocation(invocationId);
      resolve({
        ok: false,
        command: label,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });

    child.on("close", (code, signal) => {
      activeChildProcesses.delete(child);
      clearCancellableInvocation(invocationId);
      const cancelled = signal === "SIGTERM" || signal === "SIGKILL";
      resolve({
        ok: !cancelled && isSuccessfulAutoflowResult(code, stdout),
        command: label,
        code,
        signal: signal || "",
        cancelled,
        stdout,
        stderr: cancelled ? `${stderr}\n[cancelled by renderer]` : stderr
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

function startCachedAutoflowRefresh(command, options, key, entry) {
  const targetEntry =
    entry || {
      result: null,
      updatedAt: 0,
      promise: null
    };

  targetEntry.promise = runAutoflow(command, options)
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
    return Promise.resolve(cloneRunResult(entry.result));
  }

  if (entry?.result) {
    if (!entry.promise) {
      void startCachedAutoflowRefresh(command, options, key, entry);
    }
    return Promise.resolve(cloneRunResult(entry.result));
  }

  if (entry?.promise) {
    return entry.promise.then(cloneRunResult);
  }

  return startCachedAutoflowRefresh(command, options, key).then(cloneRunResult);
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
    sourceRoot: "integrations/claude/skills",
    sourceRel: "af/SKILL.md",
    targetRel: ".claude/skills/af/SKILL.md"
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
  {
    sourceRoot: "integrations/codex/skills",
    sourceRel: "af/SKILL.md",
    targetRel: ".codex/skills/af/SKILL.md"
  },
  {
    sourceRoot: "integrations/codex/skills",
    sourceRel: "af/agents/openai.yaml",
    targetRel: ".codex/skills/af/agents/openai.yaml"
  }
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
      activeTicketId: values[`${prefix}active_ticket_id`] || "",
      activeTicketTitle: values[`${prefix}active_ticket_title`] || "",
      activeStage: values[`${prefix}active_stage`] || "",
      activeSpecRef: values[`${prefix}active_spec_ref`] || "",
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
      logPath: values[`${prefix}log_path`] || "",
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

  // Single stray log/path line (e.g. wiki-1 stderr that contains only its own
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
const runnerLiveLogNamePattern = /^(.+?)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_live_(?:stdout|stderr)\.log$/;
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
const liveTokenLogCache = new Map();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numberAfterTokenMarker(lower, marker) {
  const markerPattern = new RegExp(`(^|[^a-z0-9_])${escapeRegExp(marker)}[^0-9]*([0-9][0-9,]*)`);
  const match = lower.match(markerPattern);
  return match ? Number.parseInt(match[2].replace(/,/g, ""), 10) : -1;
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

function parseTokenUsageChunk(chunk, prior) {
  const combined = (prior?.tail || "") + chunk;
  const lines = combined.split("\n");
  const newTail = lines.pop() ?? "";
  let total = prior?.tokens ?? 0;
  let waiting = prior?.waiting ?? false;

  for (const rawLine of lines) {
    const clean = rawLine.replace(/\r$/, "").replace(ansiEscapePattern, "");
    const lower = clean.toLowerCase();

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

    const tokensUsedIdx = lower.indexOf("tokens used");
    if (tokensUsedIdx >= 0) {
      const after = clean.slice(tokensUsedIdx + "tokens used".length).replace(/,/g, "");
      const inlineMatch = after.match(/[0-9]+/);
      if (inlineMatch) {
        total += Number.parseInt(inlineMatch[0], 10);
      } else {
        waiting = true;
      }
      continue;
    }

    if (lower.match(totalTokensMarkerPattern) || lower.includes("totaltokens")) {
      const tokenLineTotal = tokenUsageFromLine(lower);
      if (tokenLineTotal > 0) total += tokenLineTotal;
      continue;
    }

    if (
      /(input|output|prompt|completion|cache|cached|reasoning)[_ -]?tokens/.test(lower) ||
      /(input|output|prompt|completion|cache|cached|reasoning)tokens/.test(lower)
    ) {
      const tokenLineTotal = tokenUsageFromLine(lower);
      if (tokenLineTotal > 0) total += tokenLineTotal;
    }
  }

  return { tokens: total, waiting, tail: newTail };
}

async function aggregateLiveTokenUsage(logsDir) {
  const totals = new Map();
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

async function readRunnerTokenUsage(boardRoot) {
  const totals = new Map();
  const cachePath = path.join(boardRoot, "metrics", "token-cache.tsv");

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
    const match = path.basename(parts[0]).match(runnerLogNamePattern);
    if (!match) continue;
    totals.set(match[1], (totals.get(match[1]) || 0) + tokenCount);
  }

  const liveTotals = await aggregateLiveTokenUsage(path.join(boardRoot, "runners", "logs"));
  for (const [runnerId, count] of liveTotals) {
    totals.set(runnerId, (totals.get(runnerId) || 0) + count);
  }

  return totals;
}

async function enrichRunnerTerminalPreviews(runners, boardRoot) {
  const tokenUsageByRunner = await readRunnerTokenUsage(boardRoot);
  return Promise.all(
    runners.map(async (runner) => {
      const conversationPreview = await runnerConversationPreview(runner, boardRoot);
      const quotaInfo = await runnerQuotaInfo({ ...runner, conversationPreview }, boardRoot);
      return {
        ...runner,
        ...quotaInfo,
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
    return {
      filePath,
      name,
      title: markdownPreviewTitle(content, name),
      modifiedAt: stat.mtime.toISOString(),
      createdAt: new Date(birthMs).toISOString()
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

async function listTicketFolders(ticketsRoot) {
  if (!(await pathExists(ticketsRoot))) {
    return [];
  }

  const entries = await fs.readdir(ticketsRoot, { withFileTypes: true });
  const canonicalOrder = ["backlog", "inbox", "todo", "inprogress", "done", "reject"];
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
      return left.localeCompare(right);
    });
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

  const [
    statusResult,
    runnersResult,
    doctorResult,
    metricsResult,
    stopHookResult,
    watcherResult
  ] = exists
    ? await Promise.all([
        runAutoflow("status", { projectRoot, boardDirName: normalizedBoardDirName }),
        listRunners({ projectRoot, boardDirName: normalizedBoardDirName }),
        runAutoflowCached("doctor", { projectRoot, boardDirName: normalizedBoardDirName }),
        runAutoflowCached("metrics", { projectRoot, boardDirName: normalizedBoardDirName }),
        runAutoflow("stop-hook-status", { projectRoot, boardDirName: normalizedBoardDirName }),
        runAutoflow("watch-status", { projectRoot, boardDirName: normalizedBoardDirName })
      ])
    : [null, null, null, null, null, null];

  const ticketGroups = {};
  for (const folder of await listTicketFolders(ticketsRoot)) {
    ticketGroups[folder] = await listMarkdownFiles(path.join(ticketsRoot, folder), folder === "done");
  }

  const logs = await listMarkdownFiles(path.join(boardRoot, "logs"), true);
  const runnerLogs = await listTextFiles(path.join(boardRoot, "runners", "logs"), [".log"], true);
  const wikiFiles = await listMarkdownFiles(path.join(boardRoot, "wiki"), true);
  const metricsFiles = await listTextFiles(path.join(boardRoot, "metrics"), [".jsonl", ".json"], true);
  const metricsHistory = exists ? await readMetricsHistory(boardRoot) : [];
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
    hostSkillsResult,
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
    metricsHistory,
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
  const boardRoot = path.join(options.projectRoot, boardDirName);
  const runners = await enrichRunnerTerminalPreviews(parsed.runners, boardRoot);

  return {
    ...result,
    values: parsed.values,
    runners
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
  return (...args) =>
    Promise.race([
      Promise.resolve().then(() => handler(...args)),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`autoflow IPC handler timed out after ${ms}ms`)),
          ms
        )
      )
    ]);
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
        values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
        try {
          await fs.writeFile(filePath, serializeRunnerState(values), "utf8");
        } catch {}
      })
  );
  return killedCount;
}

async function shutdownAllRunners() {
  if (runnerShutdownInProgress) return 0;
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

// ---------------------------------------------------------------------------
// Desktop chat surface (prd_068)
// ---------------------------------------------------------------------------

const CHAT_THREAD_FILE = "desktop-chat.md";
const CHAT_ARCHIVE_DIR = "desktop-chat-archive";
const CHAT_DEFAULT_CONTEXT = parseInt(process.env.AUTOFLOW_DESKTOP_CHAT_CONTEXT || "20", 10) || 20;
const CHAT_DEFAULT_SUMMARY_THRESHOLD =
  parseInt(process.env.AUTOFLOW_DESKTOP_CHAT_SUMMARY_THRESHOLD || "50", 10) || 50;
const CHAT_DEFAULT_WIKI_ANSWERS_TOPK =
  parseInt(process.env.AUTOFLOW_DESKTOP_CHAT_WIKI_ANSWERS_TOPK || "3", 10) || 3;
const CHAT_DEFAULT_SNAPSHOT_BUDGET =
  parseInt(process.env.AUTOFLOW_DESKTOP_CHAT_SNAPSHOT_BUDGET || "1500", 10) || 1500;
const CHAT_PROMPT_FILE_NAMES = {
  base: "chat-base.txt",
  spec: "spec-author.txt",
  order: "order-intake.txt",
  boardSnapshot: "board-snapshot.tpl.txt",
  wikiAnswers: "wiki-answers.tpl.txt"
};
const CHAT_MODES = new Set(["auto", "memo", "prd"]);

function safeJoinUnderBoard(boardRoot, ...segments) {
  const target = path.resolve(boardRoot, ...segments);
  const rel = path.relative(boardRoot, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("chat_path_outside_board");
  }
  return target;
}

function chatThreadPath(boardRoot) {
  return safeJoinUnderBoard(boardRoot, "conversations", CHAT_THREAD_FILE);
}

function chatArchiveDirPath(boardRoot) {
  return safeJoinUnderBoard(boardRoot, "conversations", CHAT_ARCHIVE_DIR);
}

function parseChatFrontmatter(text) {
  const empty = { frontmatter: {}, body: text || "" };
  if (!text || !text.startsWith("---")) return empty;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return empty;
  const fmText = text.slice(4, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const frontmatter = {};
  const lines = fmText.split("\n");
  let arrayKey = null;
  for (const raw of lines) {
    const line = raw;
    if (arrayKey && /^\s+-\s+/.test(line)) {
      const value = line.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, "");
      frontmatter[arrayKey] = frontmatter[arrayKey] || [];
      frontmatter[arrayKey].push(value);
      continue;
    }
    arrayKey = null;
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const rawValue = m[2];
    if (rawValue === "" || rawValue === "[]") {
      frontmatter[key] = rawValue === "[]" ? [] : "";
      arrayKey = rawValue === "" ? key : null;
      continue;
    }
    frontmatter[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
  return { frontmatter, body };
}

function serializeChatFrontmatter(frontmatter) {
  const lines = ["---"];
  const ordered = [
    "provider",
    "model",
    "project_root",
    "created_at",
    "last_active_at",
    "mode",
    "wiki_cite",
    "summary_handover",
    "summary",
    "prior_summary",
    "prior_archive_path",
    "saved_paths"
  ];
  const keys = new Set(ordered);
  for (const key of Object.keys(frontmatter)) {
    if (!keys.has(key)) ordered.push(key);
    keys.add(key);
  }
  for (const key of ordered) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, key)) continue;
    const value = frontmatter[key];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
        }
      }
    } else if (value === undefined || value === null || value === "") {
      lines.push(`${key}: ""`);
    } else {
      const stringified = String(value);
      if (/[:#"\n]/.test(stringified)) {
        lines.push(`${key}: "${stringified.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${stringified}`);
      }
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function parseChatMessages(body) {
  const messages = [];
  const lines = (body || "").split("\n");
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(user|assistant|system)\s+@\s+([^\s]+)\s*$/i);
    if (m) {
      if (current) {
        current.content = current.content.replace(/\n+$/, "");
        messages.push(current);
      }
      current = { role: m[1].toLowerCase(), at: m[2], content: "" };
      continue;
    }
    if (current) {
      current.content += line + "\n";
    }
  }
  if (current) {
    current.content = current.content.replace(/\n+$/, "");
    messages.push(current);
  }
  return messages;
}

function serializeChatMessages(messages) {
  return messages
    .map((m) => `## ${m.role} @ ${m.at}\n\n${(m.content || "").trim()}\n`)
    .join("\n");
}

async function ensureChatDirs(boardRoot) {
  await fs.mkdir(path.dirname(chatThreadPath(boardRoot)), { recursive: true });
  await fs.mkdir(chatArchiveDirPath(boardRoot), { recursive: true });
}

async function readChatThread(boardRoot) {
  await ensureChatDirs(boardRoot);
  const threadPath = chatThreadPath(boardRoot);
  let text = "";
  try {
    text = await fs.readFile(threadPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { exists: false, frontmatter: {}, messages: [], threadPath };
  }
  const { frontmatter, body } = parseChatFrontmatter(text);
  const messages = parseChatMessages(body);
  return { exists: true, frontmatter, messages, threadPath };
}

async function writeChatThread(boardRoot, frontmatter, messages) {
  const threadPath = chatThreadPath(boardRoot);
  await ensureChatDirs(boardRoot);
  const fm = { ...frontmatter };
  fm.last_active_at = new Date().toISOString();
  if (!fm.created_at) fm.created_at = fm.last_active_at;
  const text = serializeChatFrontmatter(fm) + serializeChatMessages(messages);
  await fs.writeFile(threadPath, text, "utf8");
  return { threadPath, frontmatter: fm };
}

function clipText(value, maxBytes) {
  if (!value) return "(none)";
  const limit = maxBytes > 0 ? maxBytes : CHAT_DEFAULT_SNAPSHOT_BUDGET;
  const buf = Buffer.from(value, "utf8");
  if (buf.length <= limit) return value;
  return buf.subarray(0, limit).toString("utf8") + "\n…(truncated)";
}

async function readFirstParagraph(filePath, maxBytes) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return clipText(text.trim(), maxBytes);
  } catch (error) {
    if (error.code === "ENOENT") return "(none)";
    throw error;
  }
}

async function readMarkdownTitle(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const stripped = text.replace(/^---[\s\S]*?\n---\n/, "");
    const m = stripped.match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
    const headings = stripped.match(/^##\s+(.+)$/m);
    if (headings) return headings[1].trim();
    return path.basename(filePath, ".md");
  } catch {
    return path.basename(filePath, ".md");
  }
}

async function listMarkdownFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function buildWikiAnswerCatalog(boardRoot, budgetBytes) {
  const dir = path.join(boardRoot, "wiki", "answers");
  const files = await listMarkdownFiles(dir);
  const catalog = [];
  for (const file of files) {
    if (file === "README.md") continue;
    const filePath = path.join(dir, file);
    let text = "";
    try {
      text = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const { frontmatter } = parseChatFrontmatter(text);
    const slug = frontmatter.slug || path.basename(file, ".md");
    const titleMatch = text.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : slug;
    const terms = Array.isArray(frontmatter.terms) ? frontmatter.terms : [];
    catalog.push({ slug, title, terms, path: `wiki/answers/${file}`, fullPath: filePath, raw: text });
  }
  if (!budgetBytes) return catalog;
  let used = 0;
  const trimmed = [];
  for (const entry of catalog) {
    const line = `- ${entry.slug} :: ${entry.title} :: ${entry.terms.join(", ")}\n`;
    used += Buffer.byteLength(line, "utf8");
    trimmed.push(entry);
    if (used >= budgetBytes) break;
  }
  return trimmed;
}

async function listSubdirEntries(dir, limit) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort()
      .slice(0, limit);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function listRecentDoneTickets(boardRoot, limit) {
  const doneRoot = path.join(boardRoot, "tickets", "done");
  let projects;
  try {
    projects = await fs.readdir(doneRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const collected = [];
  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const projDir = path.join(doneRoot, proj.name);
    let files;
    try {
      files = await fs.readdir(projDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      if (!/^tickets_\d+\.md$/.test(file.name)) continue;
      const filePath = path.join(projDir, file.name);
      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        continue;
      }
      collected.push({ projectKey: proj.name, file: file.name, mtime: stat.mtimeMs, filePath });
    }
  }
  collected.sort((a, b) => b.mtime - a.mtime);
  const top = collected.slice(0, limit);
  const enriched = [];
  for (const entry of top) {
    const title = await readMarkdownTitle(entry.filePath);
    enriched.push({ projectKey: entry.projectKey, file: entry.file, title });
  }
  return enriched;
}

async function listInprogressTickets(boardRoot) {
  const dir = path.join(boardRoot, "tickets", "inprogress");
  const files = await listMarkdownFiles(dir);
  const result = [];
  for (const file of files) {
    if (!/^tickets_\d+\.md$/.test(file)) continue;
    const title = await readMarkdownTitle(path.join(dir, file));
    result.push({ file, title });
  }
  return result;
}

async function listInboxBacklog(boardRoot, sub) {
  const dir = path.join(boardRoot, "tickets", sub);
  const files = await listMarkdownFiles(dir);
  const result = [];
  for (const file of files) {
    const title = await readMarkdownTitle(path.join(dir, file));
    result.push({ file, title });
  }
  return result;
}

async function buildBoardSnapshot(boardRoot, options = {}) {
  const budget = options.budgetBytes || CHAT_DEFAULT_SNAPSHOT_BUDGET;
  const wiki = path.join(boardRoot, "wiki");
  const sections = [];
  sections.push("### wiki/index.md");
  sections.push(await readFirstParagraph(path.join(wiki, "index.md"), budget));
  sections.push("");
  sections.push("### wiki/project-overview.md");
  sections.push(await readFirstParagraph(path.join(wiki, "project-overview.md"), budget));
  sections.push("");
  sections.push("### wiki/log.md (recent entries)");
  sections.push(await readFirstParagraph(path.join(wiki, "log.md"), budget));
  sections.push("");

  const answers = await buildWikiAnswerCatalog(boardRoot, budget);
  sections.push("### wiki/answers/ catalogue (slug :: title :: terms)");
  if (answers.length === 0) {
    sections.push("(none)");
  } else {
    for (const a of answers) {
      sections.push(`- ${a.slug} :: ${a.title} :: ${a.terms.join(", ") || "(no terms)"}`);
    }
  }
  sections.push("");

  for (const sub of ["architecture", "decisions", "features", "learnings", "sources"]) {
    const files = await listSubdirEntries(path.join(wiki, sub), 10);
    sections.push(`### wiki/${sub}/ (top 10 files)`);
    sections.push(files.length === 0 ? "(none)" : files.map((f) => `- ${f}`).join("\n"));
    sections.push("");
  }

  const done = await listRecentDoneTickets(boardRoot, 10);
  sections.push("### tickets/done/ (most recent 10)");
  if (done.length === 0) {
    sections.push("(none)");
  } else {
    for (const d of done) {
      sections.push(`- ${d.projectKey}/${d.file} :: ${d.title}`);
    }
  }
  sections.push("");

  const inprogress = await listInprogressTickets(boardRoot);
  sections.push("### tickets/inprogress/ (active)");
  if (inprogress.length === 0) {
    sections.push("(none)");
  } else {
    for (const t of inprogress) {
      sections.push(`- ${t.file} :: ${t.title}`);
    }
  }
  sections.push("");

  const inbox = await listInboxBacklog(boardRoot, "inbox");
  sections.push("### tickets/inbox/ (memos awaiting promotion)");
  if (inbox.length === 0) {
    sections.push("(none)");
  } else {
    for (const m of inbox) {
      sections.push(`- ${m.file} :: ${m.title}`);
    }
  }
  sections.push("");

  const backlog = await listInboxBacklog(boardRoot, "backlog");
  sections.push("### tickets/backlog/ (PRDs awaiting execution)");
  if (backlog.length === 0) {
    sections.push("(none)");
  } else {
    for (const p of backlog) {
      sections.push(`- ${p.file} :: ${p.title}`);
    }
  }
  sections.push("");

  return { text: sections.join("\n"), wikiAnswers: answers };
}

function tokenizeForWikiMatch(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9가-힣_\-]+/)
    .filter((tok) => tok && tok.length >= 2);
}

function scoreWikiAnswer(answer, tokens) {
  if (tokens.length === 0) return 0;
  const slugTokens = tokenizeForWikiMatch(answer.slug);
  const termTokens = tokenizeForWikiMatch((answer.terms || []).join(" "));
  const titleTokens = tokenizeForWikiMatch(answer.title);
  const haystack = new Set([...slugTokens, ...termTokens, ...titleTokens]);
  let score = 0;
  for (const tok of tokens) {
    if (haystack.has(tok)) score += 2;
    for (const term of answer.terms || []) {
      if (String(term).toLowerCase().includes(tok)) score += 1;
    }
    if (answer.slug && answer.slug.toLowerCase().includes(tok)) score += 1;
  }
  return score;
}

function selectRelevantWikiAnswers(catalog, recentUserMessages, topK) {
  const tokens = recentUserMessages
    .flatMap((msg) => tokenizeForWikiMatch(msg))
    .filter((tok, idx, arr) => arr.indexOf(tok) === idx);
  if (tokens.length === 0) return [];
  const scored = catalog
    .map((entry) => ({ entry, score: scoreWikiAnswer(entry, tokens) }))
    .filter((row) => row.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, topK)).map((row) => row.entry);
}

async function readChatPromptText(promptName) {
  const repoRootChatPrompts = path.join(repoRoot, "runtime", "board-scripts", "chat-prompts", promptName);
  try {
    return await fs.readFile(repoRootChatPrompts, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return "";
  }
}

async function buildSystemPrompt(options) {
  const {
    boardRoot,
    mode,
    wikiCite,
    summaryHandover,
    snapshotBudgetBytes,
    wikiTopK,
    recentUserMessages
  } = options;
  const base = await readChatPromptText(CHAT_PROMPT_FILE_NAMES.base);
  const modeFile =
    mode === "memo"
      ? CHAT_PROMPT_FILE_NAMES.order
      : mode === "prd"
        ? CHAT_PROMPT_FILE_NAMES.spec
        : null;
  const modeText = modeFile ? await readChatPromptText(modeFile) : "";
  const boardHeader = await readChatPromptText(CHAT_PROMPT_FILE_NAMES.boardSnapshot);
  const wikiHeader = await readChatPromptText(CHAT_PROMPT_FILE_NAMES.wikiAnswers);

  const snapshot = await buildBoardSnapshot(boardRoot, { budgetBytes: snapshotBudgetBytes });
  let wikiSection = wikiHeader;
  if (!wikiCite) {
    wikiSection += "\n(disabled — Wiki citation toggle is OFF)\n";
  } else {
    const matched = selectRelevantWikiAnswers(snapshot.wikiAnswers, recentUserMessages, wikiTopK);
    if (matched.length === 0) {
      wikiSection += "\n(none)\n";
    } else {
      wikiSection += "\n";
      for (const ans of matched) {
        wikiSection += `\n--- wiki/answers/${ans.slug}.md ---\n${ans.raw.trim()}\n`;
      }
    }
  }

  const parts = [];
  parts.push(base.trim());
  if (modeText) parts.push(modeText.trim());
  parts.push(`${boardHeader.trim()}\n\n${snapshot.text}`);
  parts.push(wikiSection.trim());
  parts.push(
    `## Toggle state\n- mode=${mode}\n- wiki_cite=${wikiCite ? "on" : "off"}\n- summary_handover=${summaryHandover ? "on" : "off"}`
  );
  return { systemPrompt: parts.join("\n\n"), attachedWikiPaths: snapshot.wikiAnswers.map((a) => a.path) };
}

function selectAttachedWikiPaths(systemPrompt) {
  const matches = systemPrompt.match(/wiki\/answers\/[A-Za-z0-9_\-]+\.md/g) || [];
  return Array.from(new Set(matches));
}

function shouldRecommendMemo(messages) {
  const userTurns = messages.filter((m) => m.role === "user").length;
  return userTurns < 3;
}

async function chatLoad(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const thread = await readChatThread(boardRoot);
  const snapshot = await buildBoardSnapshot(boardRoot, {
    budgetBytes: CHAT_DEFAULT_SNAPSHOT_BUDGET
  });
  return {
    threadPath: thread.threadPath,
    frontmatter: thread.frontmatter,
    messages: thread.messages,
    boardSnapshotPreview: snapshot.text,
    wikiAnswerCatalog: snapshot.wikiAnswers.map((a) => ({
      slug: a.slug,
      title: a.title,
      terms: a.terms,
      path: a.path
    })),
    suggestedMode: shouldRecommendMemo(thread.messages) ? "memo" : "prd"
  };
}

async function chatAppend(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const message = options.message || {};
  if (!message.role || !message.content) throw new Error("invalid_message");
  const at = message.at || new Date().toISOString();
  const role = String(message.role).toLowerCase();
  if (!["user", "assistant", "system"].includes(role)) throw new Error("invalid_role");
  const thread = await readChatThread(boardRoot);
  const fm = thread.frontmatter || {};
  if (!fm.project_root) fm.project_root = projectRoot;
  fm.last_active_at = at;
  const messages = thread.messages.concat([{ role, at, content: String(message.content).trim() }]);
  await writeChatThread(boardRoot, fm, messages);
  return { ok: true, count: messages.length };
}

async function chatSend(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const mode = CHAT_MODES.has(options.mode) ? options.mode : "auto";
  const wikiCite = options.wikiCite !== false;
  const summaryHandover = options.summaryHandover !== false;
  const contextLimit = Math.max(2, parseInt(options.contextLimit, 10) || CHAT_DEFAULT_CONTEXT);
  const wikiTopK = Math.max(0, parseInt(options.wikiTopK, 10) || CHAT_DEFAULT_WIKI_ANSWERS_TOPK);
  const snapshotBudget =
    Math.max(256, parseInt(options.snapshotBudgetBytes, 10) || CHAT_DEFAULT_SNAPSHOT_BUDGET);
  const agent = options.agent || "claude";
  const model = options.model || "";
  const reasoning = options.reasoning || "";
  const invocationId = typeof options.invocationId === "string" ? options.invocationId : "";

  const thread = await readChatThread(boardRoot);
  const messages = thread.messages.slice(-contextLimit);
  const recentUser = messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content);

  const { systemPrompt } = await buildSystemPrompt({
    boardRoot,
    mode,
    wikiCite,
    summaryHandover,
    snapshotBudgetBytes: snapshotBudget,
    wikiTopK,
    recentUserMessages: recentUser
  });

  let prefix = "";
  if (summaryHandover && thread.frontmatter.prior_summary) {
    prefix += `## Prior thread summary\n${thread.frontmatter.prior_summary}\n\n`;
  }
  if (thread.frontmatter.summary) {
    prefix += `## Current thread summary\n${thread.frontmatter.summary}\n\n`;
  }
  const conversation = messages
    .map((m) => `## ${m.role}\n${m.content}`)
    .join("\n\n");
  const fullPrompt = `${systemPrompt}\n\n${prefix}${conversation}\n\n## assistant\n`;

  const tmpDir = path.join(os.tmpdir(), "autoflow-desktop-chat");
  await fs.mkdir(tmpDir, { recursive: true });
  const promptFile = path.join(tmpDir, `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fs.writeFile(promptFile, fullPrompt, "utf8");

  const chatScript = path.join(repoRoot, "runtime", "board-scripts", "chat-once.sh");
  const args = [
    chatScript,
    "--agent",
    agent,
    "--prompt-file",
    promptFile,
    "--working-root",
    projectRoot
  ];
  if (model) args.push("--model", model);
  if (reasoning) args.push("--reasoning", reasoning);

  return await new Promise((resolve) => {
    const child = spawn("bash", args, { cwd: projectRoot });
    if (invocationId) registerCancellableInvocation(invocationId, child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", async (code) => {
      if (invocationId) clearCancellableInvocation(invocationId);
      try {
        await fs.unlink(promptFile);
      } catch {}
      const ok = code === 0 && /status=ok/.test(stderr);
      const reason = (stderr.match(/reason=([^\n]+)/) || [, ""])[1].trim();
      resolve({
        ok,
        exitCode: code,
        response: stdout.trim(),
        stderr: stderr.trim(),
        reason: ok ? "" : reason || "adapter_failed",
        attachedWikiPaths: selectAttachedWikiPaths(systemPrompt)
      });
    });
  });
}

async function chatSummarize(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const thread = await readChatThread(boardRoot);
  if (thread.messages.length < CHAT_DEFAULT_SUMMARY_THRESHOLD) {
    return { ok: true, updated: false, reason: "below_threshold" };
  }
  const transcript = thread.messages.map((m) => `## ${m.role}\n${m.content}`).join("\n\n");
  const sys =
    "Summarize the user's chat with the Autoflow Desktop assistant in Korean. " +
    "Focus on key decisions, open questions, and user preferences. <= 8 bullet lines.";
  const tmpDir = path.join(os.tmpdir(), "autoflow-desktop-chat");
  await fs.mkdir(tmpDir, { recursive: true });
  const promptFile = path.join(tmpDir, `summary-${Date.now()}.txt`);
  await fs.writeFile(promptFile, `${sys}\n\n${transcript}`, "utf8");
  const chatScript = path.join(repoRoot, "runtime", "board-scripts", "chat-once.sh");
  const args = [
    chatScript,
    "--agent",
    options.agent || "claude",
    "--prompt-file",
    promptFile,
    "--working-root",
    projectRoot
  ];
  return await new Promise((resolve) => {
    const child = spawn("bash", args, { cwd: projectRoot });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.on("close", async () => {
      try {
        await fs.unlink(promptFile);
      } catch {}
      const summary = stdout.trim();
      if (!summary) return resolve({ ok: false, updated: false, reason: "empty_summary" });
      const fm = { ...(thread.frontmatter || {}) };
      fm.summary = summary;
      await writeChatThread(boardRoot, fm, thread.messages);
      resolve({ ok: true, updated: true, summary });
    });
  });
}

async function chatReset(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const thread = await readChatThread(boardRoot);
  if (!thread.exists) {
    await ensureChatDirs(boardRoot);
    return { ok: true, archivedTo: "", priorSummary: "" };
  }
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .replace(/(\d{8})T(\d{6}).*/, "$1-$2Z");
  const archivePath = path.join(chatArchiveDirPath(boardRoot), `${stamp}.md`);
  await ensureChatDirs(boardRoot);
  await fs.rename(thread.threadPath, archivePath);
  const priorSummary = (thread.frontmatter && thread.frontmatter.summary) || "";
  const newFm = {
    project_root: projectRoot,
    created_at: new Date().toISOString(),
    saved_paths: [],
    prior_summary: priorSummary,
    prior_archive_path: archivePath
  };
  await writeChatThread(boardRoot, newFm, []);
  return { ok: true, archivedTo: archivePath, priorSummary };
}

async function nextNumberedSlot(dir, prefix, extension) {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  const re = new RegExp("^" + prefix + "_(\\d+)" + extension.replace(".", "\\.") + "$");
  let max = 0;
  for (const entry of entries) {
    const m = entry.match(re);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  const next = max + 1;
  return String(next).padStart(3, "0");
}

async function appendSavedPath(boardRoot, savedPath) {
  const thread = await readChatThread(boardRoot);
  if (!thread.exists) return;
  const fm = { ...(thread.frontmatter || {}) };
  const list = Array.isArray(fm.saved_paths) ? fm.saved_paths : [];
  if (!list.includes(savedPath)) list.push(savedPath);
  fm.saved_paths = list;
  await writeChatThread(boardRoot, fm, thread.messages);
}

async function saveMemoFromChat(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const inboxDir = safeJoinUnderBoard(boardRoot, "tickets", "inbox");
  const slot = await nextNumberedSlot(inboxDir, "memo", ".md");
  const file = `memo_${slot}.md`;
  const target = path.join(inboxDir, file);
  const body = String(options.body || "").trim();
  if (!body) throw new Error("empty_memo_body");
  await fs.writeFile(target, body.endsWith("\n") ? body : body + "\n", "utf8");
  await appendSavedPath(boardRoot, target);
  return { ok: true, savedPath: target, file };
}

async function saveSpecFromChat(options) {
  const projectRoot = options.projectRoot || "";
  if (!projectRoot) throw new Error("missing_project_root");
  const boardDirName = options.boardDirName || defaultBoardDirName;
  if (!safeBoardDirNamePattern.test(boardDirName)) throw new Error("invalid_board_dir_name");
  const boardRoot = path.join(projectRoot, boardDirName);
  const backlogDir = safeJoinUnderBoard(boardRoot, "tickets", "backlog");
  const slot = await nextNumberedSlot(backlogDir, "prd", ".md");
  const file = `prd_${slot}.md`;
  const target = path.join(backlogDir, file);
  const body = String(options.body || "").trim();
  if (!body) throw new Error("empty_spec_body");
  await fs.writeFile(target, body.endsWith("\n") ? body : body + "\n", "utf8");
  await appendSavedPath(boardRoot, target);
  return { ok: true, savedPath: target, file };
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
  ipcMain.handle("autoflow:listRunners", withTimeout(withScopeMemory(listRunners), 30000));
  ipcMain.handle("autoflow:controlRunner", withScopeMemory(controlRunner));
  ipcMain.handle(
    "autoflow:listRunnerArtifacts",
    withTimeout(withScopeMemory(listRunnerArtifacts), 30000)
  );
  ipcMain.handle("autoflow:runRole", withScopeMemory(runRole));
  ipcMain.handle("autoflow:configureRunner", withScopeMemory(configureRunner));
  ipcMain.handle("autoflow:createRunner", withScopeMemory(createRunner));
  ipcMain.handle("autoflow:controlWiki", withScopeMemory(controlWiki));
  ipcMain.handle("autoflow:writeMetricsSnapshot", withScopeMemory(writeMetricsSnapshot));
  ipcMain.handle("autoflow:controlStopHook", withScopeMemory(controlStopHook));
  ipcMain.handle("autoflow:controlWatcher", withScopeMemory(controlWatcher));
  ipcMain.handle("autoflow:readBoardFile", withTimeout(withScopeMemory(readBoardFile), 30000));
  // Desktop chat surface (prd_068).
  ipcMain.handle("autoflow:chatLoad", withTimeout(withScopeMemory(chatLoad), 30000));
  ipcMain.handle("autoflow:chatAppend", withTimeout(withScopeMemory(chatAppend), 30000));
  ipcMain.handle("autoflow:chatSend", withScopeMemory(chatSend));
  ipcMain.handle("autoflow:chatSummarize", withScopeMemory(chatSummarize));
  ipcMain.handle("autoflow:chatReset", withTimeout(withScopeMemory(chatReset), 30000));
  ipcMain.handle("autoflow:saveMemo", withTimeout(withScopeMemory(saveMemoFromChat), 30000));
  ipcMain.handle("autoflow:saveSpec", withTimeout(withScopeMemory(saveSpecFromChat), 30000));
  // Cancel a still-running long IPC call by invocationId. No timeout: the
  // call must always be reachable so the user can recover from a hung action.
  ipcMain.handle("autoflow:cancelInvocation", (_event, invocationId) =>
    cancelInvocation(invocationId)
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (runnerShutdownInProgress) {
    return;
  }
  if (knownProjectScopes.size === 0 && activeChildProcesses.size === 0) {
    return;
  }
  event.preventDefault();

  const shutdownTimeoutMs = 5000;
  const cleanup = shutdownAllRunners().catch(() => 0);
  const timeout = new Promise((resolve) => setTimeout(resolve, shutdownTimeoutMs));
  Promise.race([cleanup, timeout]).finally(() => {
    app.exit(0);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
