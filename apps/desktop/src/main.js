const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
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
let runnerShutdownInProgress = false;

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
    activeChildProcesses.add(child);

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
      resolve({
        ok: false,
        command: label,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });

    child.on("close", (code) => {
      activeChildProcesses.delete(child);
      resolve({
        ok: isSuccessfulAutoflowResult(code, stdout),
        command: label,
        code,
        stdout,
        stderr
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
    const invocation =
      process.platform === "win32"
        ? {
            command: "powershell.exe",
            args: [
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-Command",
              "& { param($Name) if (Get-Command -Name $Name -ErrorAction SilentlyContinue) { exit 0 } exit 1 }",
              command
            ]
          }
        : {
            command: "bash",
            args: ["-lc", `command -v ${command}`]
          };
    let settled = false;
    const finish = (exists) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(exists);
    };
    const child = spawn(invocation.command, invocation.args, {
      cwd: repoRoot,
      env: process.env,
      windowsHide: true
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

  const kept = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const matchTarget = cleanConversationLine(line);
    if (conversationDropPatterns.some((pattern) => pattern.test(matchTarget))) continue;
    kept.push(line);
  }

  while (kept.length && !kept[0].trim()) kept.shift();
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();

  const collapsed = collapseRepeatedConversationLines(kept);

  let conversation = collapsed.join("\n");
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
  const canonicalOrder = ["backlog", "todo", "inprogress", "done", "reject"];
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

function listChildPids(parentPid) {
  if (process.platform === "win32") return [];
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

  if (process.platform === "win32") {
    try {
      const { spawnSync } = require("node:child_process");
      const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore"
      });
      return result.status === 0;
    } catch {
      return false;
    }
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

  ipcMain.handle("autoflow:getConfig", () => appConfig());
  ipcMain.handle("autoflow:listInstalledAgentProfiles", () => readInstalledAgentProfiles());
  ipcMain.handle("autoflow:readBoard", withScopeMemory(readBoard));
  ipcMain.handle("autoflow:installBoard", withScopeMemory(installBoard));
  ipcMain.handle("autoflow:listRunners", withScopeMemory(listRunners));
  ipcMain.handle("autoflow:controlRunner", withScopeMemory(controlRunner));
  ipcMain.handle("autoflow:listRunnerArtifacts", withScopeMemory(listRunnerArtifacts));
  ipcMain.handle("autoflow:runRole", withScopeMemory(runRole));
  ipcMain.handle("autoflow:configureRunner", withScopeMemory(configureRunner));
  ipcMain.handle("autoflow:createRunner", withScopeMemory(createRunner));
  ipcMain.handle("autoflow:controlWiki", withScopeMemory(controlWiki));
  ipcMain.handle("autoflow:writeMetricsSnapshot", withScopeMemory(writeMetricsSnapshot));
  ipcMain.handle("autoflow:controlStopHook", withScopeMemory(controlStopHook));
  ipcMain.handle("autoflow:controlWatcher", withScopeMemory(controlWatcher));
  ipcMain.handle("autoflow:readBoardFile", withScopeMemory(readBoardFile));

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
