import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Archive,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./styles.css";

const ticketColumns = [
  { key: "backlog", label: "Backlog", meta: "Spec intake", icon: Inbox, tone: "lane-backlog" },
  { key: "plan", label: "Plan", meta: "Planning", icon: ClipboardList, tone: "lane-plan" },
  { key: "todo", label: "Todo", meta: "Ready", icon: Layers3, tone: "lane-todo" },
  { key: "inprogress", label: "Running", meta: "Claimed", icon: Activity, tone: "lane-inprogress" },
  { key: "verifier", label: "Verify", meta: "Review", icon: ShieldCheck, tone: "lane-verifier" },
  { key: "done", label: "Done", meta: "Passed", icon: CheckCircle2, tone: "lane-done" },
  { key: "reject", label: "Reject", meta: "Needs plan", icon: TriangleAlert, tone: "lane-reject" }
] as const;

const defaultFlowFolder = "autoflow";
const runnerAgentOptions = ["shell", "manual", "codex", "claude", "opencode", "gemini"] as const;
const runnerModeOptions = ["one-shot", "loop", "watch"] as const;
const runnerEnabledOptions = ["true", "false"] as const;
const runnableRunnerAgents = new Set<string>(runnerAgentOptions);
const runnerRoleOptions = [
  { role: "ticket-owner", label: "Owner" },
  { role: "wiki-maintainer", label: "Wiki" }
] as const;

type RunnerRole = (typeof runnerRoleOptions)[number]["role"];

type RunnerDraft = {
  agent: string;
  model: string;
  reasoning: string;
  mode: string;
  intervalSeconds: string;
  enabled: string;
  command: string;
};

type RunnerTerminalEntry = {
  id: string;
  recordedAt: string;
  result: AutoflowRunResult;
};

type RunnerArtifactEntry = {
  label: string;
  path: string;
  status: string;
};

type DisplayLog = AutoflowFilePreview & {
  source: "Board" | "Runner";
};

type SpecDraft = {
  title: string;
  goal: string;
  handoff: string;
  raw: boolean;
  archiveHandoff: boolean;
};

function initialSetting(key: string, fallback: string) {
  return window.localStorage.getItem(key) || fallback;
}

function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function emptySpecDraft(): SpecDraft {
  return {
    title: "",
    goal: "",
    handoff: "",
    raw: false,
    archiveHandoff: true
  };
}

function specDraftStorageKey(projectRoot: string) {
  return `autoflow.specDraft.${encodeURIComponent(projectRoot || "default")}`;
}

function legacySpecDraft(): SpecDraft {
  return {
    title: initialSetting("autoflow.specTitle", ""),
    goal: initialSetting("autoflow.specGoal", ""),
    handoff: initialSetting("autoflow.specHandoff", ""),
    raw: window.localStorage.getItem("autoflow.specRaw") === "true",
    archiveHandoff: true
  };
}

function hasSpecDraftContent(draft: SpecDraft) {
  return Boolean(draft.title.trim() || draft.goal.trim() || draft.handoff.trim() || draft.raw);
}

function clearLegacySpecDraft() {
  window.localStorage.removeItem("autoflow.specTitle");
  window.localStorage.removeItem("autoflow.specGoal");
  window.localStorage.removeItem("autoflow.specHandoff");
  window.localStorage.removeItem("autoflow.specRaw");
}

function readSpecDraft(projectRoot: string): SpecDraft {
  const stored = window.localStorage.getItem(specDraftStorageKey(projectRoot));
  if (!stored) {
    const legacyDraft = legacySpecDraft();
    if (hasSpecDraftContent(legacyDraft)) {
      writeSpecDraft(projectRoot, legacyDraft);
      clearLegacySpecDraft();
      return legacyDraft;
    }

    return emptySpecDraft();
  }

  try {
    const parsed = JSON.parse(stored) as Partial<SpecDraft>;
    return {
      title: String(parsed.title || ""),
      goal: String(parsed.goal || ""),
      handoff: String(parsed.handoff || ""),
      raw: parsed.raw === true,
      archiveHandoff: parsed.archiveHandoff !== false
    };
  } catch {
    return emptySpecDraft();
  }
}

function writeSpecDraft(projectRoot: string, draft: SpecDraft) {
  window.localStorage.setItem(specDraftStorageKey(projectRoot), JSON.stringify(draft));
}

function countTickets(board: AutoflowBoardSnapshot | null) {
  if (!board) {
    return 0;
  }

  return ticketColumns.reduce((total, column) => total + (board.tickets[column.key]?.length || 0), 0);
}

function statusValue(status: Record<string, string>, key: string, fallback: string) {
  const value = status[key];
  return value && value.trim().length ? value : fallback;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function runRoleForRunner(role: string) {
  if (role === "ticket-owner" || role === "owner") {
    return "ticket";
  }

  if (role === "wiki-maintainer") {
    return "wiki";
  }

  return role || "todo";
}

function shellArg(value: string) {
  if (!value) {
    return "";
  }

  if (/^[A-Za-z0-9_./:@%-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function commandPreviewForRunner(
  runner: AutoflowRunner,
  draft: RunnerDraft,
  board: AutoflowBoardSnapshot | null
) {
  const projectRoot = board?.status.project_root || "<project-root>";
  const boardDirName = board?.status.board_dir_name || "autoflow";
  const role = runRoleForRunner(runner.role);
  const model = draft.model.trim();
  const reasoning = draft.reasoning.trim();
  const commandOverride = draft.command.trim();

  if (commandOverride) {
    return `custom: ${commandOverride} < $AUTOFLOW_PROMPT_FILE`;
  }

  if (draft.mode === "loop") {
    const interval = draft.intervalSeconds.trim() || runner.intervalEffectiveSeconds || "60";
    return `loop every ${interval}s: autoflow runners start ${shellArg(runner.id)} ${shellArg(projectRoot)} ${shellArg(
      boardDirName
    )}`;
  }

  if (draft.mode === "watch") {
    return `watch: autoflow watch-bg ${shellArg(projectRoot)} ${shellArg(boardDirName)}`;
  }

  if (draft.agent === "codex") {
    return [
      "codex exec --full-auto --skip-git-repo-check",
      "-C",
      shellArg(projectRoot),
      model ? `-m ${shellArg(model)}` : "",
      reasoning ? `-c ${shellArg(`model_reasoning_effort="${reasoning}"`)}` : "",
      "-"
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (draft.agent === "claude") {
    return [
      "claude -p --permission-mode dontAsk --output-format text",
      model ? `--model ${shellArg(model)}` : "",
      reasoning ? `--effort ${shellArg(reasoning)}` : "",
      "prompt"
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (draft.agent === "opencode") {
    return [
      "opencode run",
      model ? `--model ${shellArg(model)}` : "",
      reasoning ? `--variant ${shellArg(reasoning)}` : "",
      "prompt"
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (draft.agent === "gemini") {
    return ["gemini --approval-mode auto_edit --prompt prompt", model ? `--model ${shellArg(model)}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  return `autoflow run ${shellArg(role)} ${shellArg(projectRoot)} ${shellArg(boardDirName)} --runner ${shellArg(
    runner.id
  )}`;
}

function runnerStatusTone(status: string) {
  if (status === "running") {
    return "runner-status-running";
  }

  if (status === "blocked" || status === "failed") {
    return "runner-status-blocked";
  }

  if (status === "stopped") {
    return "runner-status-stopped";
  }

  return "runner-status-idle";
}

function runnerIdPrefix(role: string) {
  if (role === "ticket-owner" || role === "owner" || role === "ticket") {
    return "owner";
  }

  if (role === "wiki-maintainer") {
    return "wiki";
  }

  return role || "runner";
}

function runnerIsEnabled(value: string) {
  return value ? value === "true" : true;
}

function nextRunnerId(runners: AutoflowRunner[], role: string) {
  const prefix = runnerIdPrefix(role);
  const matcher = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;

  for (const runner of runners) {
    const match = runner.id.match(matcher);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `${prefix}-${max + 1}`;
}

function recentLogs(board: AutoflowBoardSnapshot | null): DisplayLog[] {
  const boardLogs = (board?.logs || []).map((log) => ({ ...log, source: "Board" as const }));
  const runnerLogs = (board?.runnerLogs || []).map((log) => ({ ...log, source: "Runner" as const }));

  return [...boardLogs, ...runnerLogs]
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, 16);
}

function selectableBoardFiles(board: AutoflowBoardSnapshot | null) {
  if (!board) {
    return [];
  }

  const ticketFiles = ticketColumns.flatMap((column) => board.tickets[column.key] || []);

  return [
    ...ticketFiles,
    ...(board.logs || []),
    ...(board.runnerLogs || []),
    ...(board.wikiFiles || []),
    ...(board.metricsFiles || []),
    ...(board.conversationFiles || [])
  ];
}

function boardFileKind(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath.includes("/tickets/")) {
    return "Ticket";
  }
  if (normalizedPath.includes("/wiki/")) {
    return "Wiki";
  }
  if (normalizedPath.includes("/metrics/")) {
    return "Metrics";
  }
  if (normalizedPath.includes("/conversations/")) {
    return "Handoff";
  }
  if (normalizedPath.includes("/runners/logs/")) {
    return "Runner";
  }
  if (normalizedPath.includes("/logs/")) {
    return "Log";
  }

  return "File";
}

function searchBoardFiles(board: AutoflowBoardSnapshot | null, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return selectableBoardFiles(board)
    .filter((file) => {
      const haystack = `${file.name}\n${file.title}\n${file.filePath}`.toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, 8);
}

function runArtifactPath(output: string) {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0) {
      values[line.slice(0, index)] = line.slice(index + 1);
    }
  }

  return (
    values.runtime_output_log_path ||
    values.stdout_log_path ||
    values.prompt_log_path ||
    values.stderr_log_path ||
    ""
  );
}

function outputValue(output: string, key: string) {
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0 && line.slice(0, index) === key) {
      return line.slice(index + 1);
    }
  }

  return "";
}

function prefixedValues(values: Record<string, string>, prefix: string) {
  return Object.entries(values)
    .filter(([key]) => key.startsWith(prefix))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function runnerDoctorId(runnerId: string) {
  return `runner_${runnerId.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function runnerHealthTone(value: string) {
  if (value === "warning") {
    return "runner-health-warning";
  }

  if (value === "error" || value === "fail" || value === "failed") {
    return "runner-health-fail";
  }

  if (value === "disabled" || value === "not_applicable" || value === "unknown") {
    return "runner-health-muted";
  }

  return "runner-health-ok";
}

function runnerArtifactEntries(runner: AutoflowRunner) {
  return [
    { label: "runtime", path: runner.lastRuntimeLog, status: runner.artifactRuntimeStatus || "absent" },
    { label: "prompt", path: runner.lastPromptLog, status: runner.artifactPromptStatus || "absent" },
    { label: "stdout", path: runner.lastStdoutLog, status: runner.artifactStdoutStatus || "absent" },
    { label: "stderr", path: runner.lastStderrLog, status: runner.artifactStderrStatus || "absent" }
  ];
}

function preferredRunnerArtifact(runner: AutoflowRunner) {
  const entries = runnerArtifactEntries(runner);
  return entries.find((entry) => entry.path && entry.status === "ok") || entries.find((entry) => entry.path) || null;
}

function runnerArtifactSummary(runner: AutoflowRunner) {
  return runnerArtifactEntries(runner)
    .map((entry) => `${entry.label}:${entry.status}`)
    .join(" ");
}

function terminalArtifactEntries(output: string): RunnerArtifactEntry[] {
  const count = Number.parseInt(outputValue(output, "artifact_count") || "0", 10);
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const item = index + 1;
    return {
      label: outputValue(output, `artifact.${item}.label`) || `artifact ${item}`,
      path: outputValue(output, `artifact.${item}.path`),
      status: outputValue(output, `artifact.${item}.status`) || "unknown"
    };
  });
}

function terminalOutputTail(value: string) {
  const limit = 12000;
  if (value.length <= limit) {
    return value;
  }

  return value.slice(value.length - limit);
}

function hasLiveProcess(board: AutoflowBoardSnapshot | null) {
  if (!board) {
    return false;
  }

  const runnerIsLive = (board.runners || []).some(
    (runner) => runner.stateStatus === "running" || Boolean(runner.pid)
  );
  const watcherIsLive = board.watcher?.status === "running";

  return runnerIsLive || watcherIsLive;
}

function App() {
  const [projectRoot, setProjectRoot] = React.useState(() => initialSetting("autoflow.projectRoot", ""));
  const initialDraft = React.useMemo(() => readSpecDraft(projectRoot), []);
  const [board, setBoard] = React.useState<AutoflowBoardSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [runnerActionKey, setRunnerActionKey] = React.useState("");
  const [runnerError, setRunnerError] = React.useState("");
  const [runnerTerminal, setRunnerTerminal] = React.useState<RunnerTerminalEntry | null>(null);
  const [runnerTerminalHistory, setRunnerTerminalHistory] = React.useState<RunnerTerminalEntry[]>([]);
  const [runnerDrafts, setRunnerDrafts] = React.useState<Record<string, RunnerDraft>>({});
  const [selectedLogPath, setSelectedLogPath] = React.useState("");
  const [boardSearch, setBoardSearch] = React.useState("");
  const [logPreview, setLogPreview] = React.useState<AutoflowFileContentResult | null>(null);
  const [isReadingLog, setIsReadingLog] = React.useState(false);
  const [logError, setLogError] = React.useState("");
  const [specTitle, setSpecTitle] = React.useState(initialDraft.title);
  const [specGoal, setSpecGoal] = React.useState(initialDraft.goal);
  const [specHandoff, setSpecHandoff] = React.useState(initialDraft.handoff);
  const [specRaw, setSpecRaw] = React.useState(initialDraft.raw);
  const [specArchiveHandoff, setSpecArchiveHandoff] = React.useState(initialDraft.archiveHandoff);
  const [isCreatingSpec, setIsCreatingSpec] = React.useState(false);
  const [specError, setSpecError] = React.useState("");
  const [setupError, setSetupError] = React.useState("");
  const [wikiActionKey, setWikiActionKey] = React.useState("");
  const [wikiError, setWikiError] = React.useState("");
  const [metricsActionKey, setMetricsActionKey] = React.useState("");
  const [metricsError, setMetricsError] = React.useState("");
  const [stopHookActionKey, setStopHookActionKey] = React.useState("");
  const [stopHookError, setStopHookError] = React.useState("");
  const [watcherActionKey, setWatcherActionKey] = React.useState("");
  const [watcherError, setWatcherError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState("");

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder }),
    [projectRoot]
  );
  const specDraftProjectRef = React.useRef(options.projectRoot);
  const skipNextSpecDraftWriteRef = React.useRef(false);
  const autoRefreshInFlightRef = React.useRef(false);
  const runnerTerminalCounterRef = React.useRef(0);

  const recordRunnerTerminal = React.useCallback((result: AutoflowRunResult) => {
    const entry = {
      id: `${Date.now()}-${runnerTerminalCounterRef.current++}`,
      recordedAt: new Date().toISOString(),
      result
    };
    setRunnerTerminal(entry);
    setRunnerTerminalHistory((current) => [entry, ...current].slice(0, 5));
  }, []);

  const loadBoard = React.useCallback(
    async (targetOptions = options) => {
      window.localStorage.setItem("autoflow.projectRoot", targetOptions.projectRoot);

      if (!targetOptions.projectRoot) {
        setBoard(null);
        setLastUpdated("");
        setSetupError("");
        setRunnerError("");
        setWikiError("");
        setMetricsError("");
        setStopHookError("");
        setWatcherError("");
        return;
      }

      const snapshot = await window.autoflow.readBoard(targetOptions);
      setBoard(snapshot);
      setLastUpdated(new Date().toISOString());
    },
    [options]
  );

  const refreshBoard = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadBoard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadBoard]);

  React.useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const autoRefreshActive = hasLiveProcess(board);
  React.useEffect(() => {
    if (!options.projectRoot || !autoRefreshActive) {
      return undefined;
    }

    const refreshSnapshot = async () => {
      if (autoRefreshInFlightRef.current) {
        return;
      }

      autoRefreshInFlightRef.current = true;
      try {
        await loadBoard();
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [autoRefreshActive, loadBoard, options.projectRoot]);

  React.useEffect(() => {
    const runners = board?.runners || [];
    setRunnerDrafts((previous) => {
      const next: Record<string, RunnerDraft> = {};
      for (const runner of runners) {
        next[runner.id] =
          runnerActionKey && previous[runner.id]
            ? previous[runner.id]
            : {
                agent: runner.agent || "shell",
                model: runner.model || "",
                reasoning: runner.reasoning || "",
                mode: runner.mode || "one-shot",
                intervalSeconds: runner.intervalSeconds || "60",
                enabled: runner.enabled || "true",
                command: runner.command || ""
              };
      }
      return next;
    });
  }, [board?.runners, runnerActionKey]);

  React.useEffect(() => {
    if (!selectedLogPath) {
      return;
    }

    const selectedExists = selectableBoardFiles(board).some((file) => file.filePath === selectedLogPath);
    if (!selectedExists) {
      setSelectedLogPath("");
      setLogPreview(null);
      setLogError("");
    }
  }, [board, selectedLogPath]);

  React.useEffect(() => {
    const draft = readSpecDraft(options.projectRoot);
    specDraftProjectRef.current = options.projectRoot;
    skipNextSpecDraftWriteRef.current = true;
    setSpecTitle(draft.title);
    setSpecGoal(draft.goal);
    setSpecHandoff(draft.handoff);
    setSpecRaw(draft.raw);
    setSpecArchiveHandoff(draft.archiveHandoff);
    setSpecError("");
  }, [options.projectRoot]);

  React.useEffect(() => {
    if (skipNextSpecDraftWriteRef.current) {
      skipNextSpecDraftWriteRef.current = false;
      return;
    }

    writeSpecDraft(specDraftProjectRef.current, {
      title: specTitle,
      goal: specGoal,
      handoff: specHandoff,
      raw: specRaw,
      archiveHandoff: specArchiveHandoff
    });
  }, [specArchiveHandoff, specGoal, specHandoff, specRaw, specTitle]);

  const browseProject = React.useCallback(async () => {
    const selected = await window.autoflow.selectProject();
    if (selected) {
      setProjectRoot(selected);
    }
  }, []);

  const installFlow = React.useCallback(
    async (targetRoot = options.projectRoot) => {
      let root = targetRoot;
      if (!root) {
        root = await window.autoflow.selectProject();
      }

      if (!root || isInstalling) {
        return;
      }

      const targetOptions = { projectRoot: root, boardDirName: defaultFlowFolder };
      setProjectRoot(root);
      setIsInstalling(true);
      setSetupError("");
      try {
        const result = await window.autoflow.installBoard(targetOptions);
        if (!result.ok) {
          setSetupError(result.stderr || "Install failed.");
          return;
        }

        await loadBoard(targetOptions);
      } finally {
        setIsInstalling(false);
      }
    },
    [isInstalling, loadBoard, options.projectRoot]
  );

  const controlRunner = React.useCallback(
    async (action: "start" | "stop" | "restart", runnerId: string) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const actionKey = `${action}:${runnerId}`;
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.controlRunner({
          action,
          runnerId,
          ...options
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "Runner action failed.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [loadBoard, options, recordRunnerTerminal, runnerActionKey]
  );

  const controlStopHook = React.useCallback(
    async (action: "install" | "remove" | "status") => {
      if (!options.projectRoot || stopHookActionKey) {
        return;
      }

      setStopHookActionKey(action);
      setStopHookError("");
      try {
        const result = await window.autoflow.controlStopHook({
          action,
          ...options
        });
        if (!result.ok) {
          setStopHookError(result.stderr || result.stdout || "Stop hook action failed.");
        }

        await loadBoard();
      } finally {
        setStopHookActionKey("");
      }
    },
    [loadBoard, options, stopHookActionKey]
  );

  const controlWatcher = React.useCallback(
    async (action: "start" | "stop" | "status") => {
      if (!options.projectRoot || watcherActionKey) {
        return;
      }

      setWatcherActionKey(action);
      setWatcherError("");
      try {
        const result = await window.autoflow.controlWatcher({
          action,
          ...options
        });
        if (!result.ok) {
          setWatcherError(result.stderr || result.stdout || "Watcher action failed.");
        }

        await loadBoard();
      } finally {
        setWatcherActionKey("");
      }
    },
    [loadBoard, options, watcherActionKey]
  );

  const createRunner = React.useCallback(
    async (role: RunnerRole) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const runnerId = nextRunnerId(board?.runners || [], role);
      const actionKey = `add:${role}`;
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.createRunner({
          runnerId,
          role,
          ...options,
          config: {
            agent: role === "ticket-owner" ? "codex" : "shell",
            mode: "one-shot",
            interval_seconds: "60",
            enabled: "true"
          }
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "Runner add failed.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [board?.runners, loadBoard, options, recordRunnerTerminal, runnerActionKey]
  );

  const removeRunner = React.useCallback(
    async (runner: AutoflowRunner) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      if (!window.confirm(`Remove runner ${runner.id}?`)) {
        return;
      }

      const actionKey = `remove:${runner.id}`;
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.controlRunner({
          action: "remove",
          runnerId: runner.id,
          ...options
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "Runner remove failed.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [loadBoard, options, recordRunnerTerminal, runnerActionKey]
  );

  const listRunnerArtifacts = React.useCallback(
    async (runner: AutoflowRunner) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const actionKey = `artifacts:${runner.id}`;
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.listRunnerArtifacts({
          runnerId: runner.id,
          ...options
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "Runner artifact list failed.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [loadBoard, options, recordRunnerTerminal, runnerActionKey]
  );

  const readLog = React.useCallback(
    async (filePath: string) => {
      if (!options.projectRoot || !filePath) {
        return;
      }

      setSelectedLogPath(filePath);
      setIsReadingLog(true);
      setLogError("");
      try {
        const result = await window.autoflow.readBoardFile({
          ...options,
          filePath
        });
        if (!result.ok) {
          setLogPreview(null);
          setLogError(result.stderr || "Log preview failed.");
          return;
        }

        setLogPreview(result);
      } finally {
        setIsReadingLog(false);
      }
    },
    [options]
  );

  const runRunner = React.useCallback(
    async (runner: AutoflowRunner, dryRun = false) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const actionKey = `${dryRun ? "dry-run" : "run"}:${runner.id}`;
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.runRole({
          role: runRoleForRunner(runner.role),
          runnerId: runner.id,
          dryRun,
          ...options
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "Runner tick failed.");
        }

        await loadBoard();
        const artifactPath = runArtifactPath(result.stdout);
        if (artifactPath) {
          await readLog(artifactPath);
        }
      } finally {
        setRunnerActionKey("");
      }
    },
    [loadBoard, options, readLog, recordRunnerTerminal, runnerActionKey]
  );

  const clearSpecDraft = React.useCallback(() => {
    setSpecTitle("");
    setSpecGoal("");
    setSpecHandoff("");
    setSpecRaw(false);
    setSpecArchiveHandoff(true);
    setSpecError("");
  }, []);

  const createSpec = React.useCallback(async (dryRunOwner = false) => {
    if (!options.projectRoot || isCreatingSpec) {
      return;
    }

    setIsCreatingSpec(true);
    setSpecError("");
    try {
      const result = await window.autoflow.createSpec({
        ...options,
        title: specTitle,
        goal: specGoal,
        handoff: specHandoff,
        raw: specRaw,
        archiveHandoff: specArchiveHandoff
      });
      if (!result.ok) {
        setSpecError(result.stderr || result.stdout || "Spec create failed.");
        return;
      }

      await loadBoard();
      const specFile = outputValue(result.stdout, "spec_file");
      if (specFile) {
        await readLog(specFile);
      }

      if (dryRunOwner) {
        const ownerRunner = (board?.runners || []).find(
          (runner) =>
            (runner.role === "ticket-owner" || runner.role === "owner") && runnerIsEnabled(runner.enabled)
        );
        if (!ownerRunner) {
          setSpecError("Spec was created, but no enabled ticket owner runner is available for dry-run.");
        } else {
          const ownerResult = await window.autoflow.runRole({
            role: "ticket",
            runnerId: ownerRunner.id,
            dryRun: true,
            ...options
          });
          if (!ownerResult.ok) {
            setSpecError(ownerResult.stderr || ownerResult.stdout || "Ticket owner dry-run failed.");
          }
          const artifactPath = runArtifactPath(ownerResult.stdout);
          if (artifactPath) {
            await readLog(artifactPath);
          }
          await loadBoard();
        }
      }

      clearSpecDraft();
    } finally {
      setIsCreatingSpec(false);
    }
  }, [
    board?.runners,
    clearSpecDraft,
    isCreatingSpec,
    loadBoard,
    options,
    readLog,
    specGoal,
    specHandoff,
    specArchiveHandoff,
    specRaw,
    specTitle
  ]);

  const updateRunnerDraft = React.useCallback((runnerId: string, field: keyof RunnerDraft, value: string) => {
    setRunnerDrafts((current) => ({
      ...current,
      [runnerId]: {
        agent: current[runnerId]?.agent || "shell",
        model: current[runnerId]?.model || "",
        reasoning: current[runnerId]?.reasoning || "",
        mode: current[runnerId]?.mode || "one-shot",
        intervalSeconds: current[runnerId]?.intervalSeconds || "60",
        enabled: current[runnerId]?.enabled || "true",
        command: current[runnerId]?.command || "",
        [field]: value
      }
    }));
  }, []);

  const saveRunnerConfig = React.useCallback(
    async (runner: AutoflowRunner) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const draft = runnerDrafts[runner.id] || {
        agent: runner.agent || "shell",
        model: runner.model || "",
        reasoning: runner.reasoning || "",
        mode: runner.mode || "one-shot",
        intervalSeconds: runner.intervalSeconds || "60",
        enabled: runner.enabled || "true",
        command: runner.command || ""
      };
      const actionKey = `config:${runner.id}`;
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.configureRunner({
          runnerId: runner.id,
          ...options,
          config: {
            agent: draft.agent,
            model: draft.model,
            reasoning: draft.reasoning,
            mode: draft.mode,
            interval_seconds: draft.intervalSeconds,
            enabled: draft.enabled,
            command: draft.command
          }
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "Runner config failed.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [loadBoard, options, recordRunnerTerminal, runnerActionKey, runnerDrafts]
  );

  const controlWiki = React.useCallback(
    async (action: "update" | "lint", dryRun = false) => {
      if (!options.projectRoot || wikiActionKey) {
        return;
      }

      const actionKey = dryRun ? "update-dry-run" : action;
      setWikiActionKey(actionKey);
      setWikiError("");
      try {
        const result = await window.autoflow.controlWiki({
          action,
          dryRun,
          ...options
        });
        recordRunnerTerminal(result);
        if (!result.ok) {
          setWikiError(result.stderr || result.stdout || "Wiki action failed.");
          return;
        }

        await loadBoard();
        const updatedFile = outputValue(result.stdout, "updated_file.1");
        if (updatedFile) {
          await readLog(updatedFile);
        }
      } finally {
        setWikiActionKey("");
      }
    },
    [loadBoard, options, readLog, recordRunnerTerminal, wikiActionKey]
  );

  const writeMetricsSnapshot = React.useCallback(async () => {
    if (!options.projectRoot || metricsActionKey) {
      return;
    }

    setMetricsActionKey("write");
    setMetricsError("");
    try {
      const result = await window.autoflow.writeMetricsSnapshot(options);
      recordRunnerTerminal(result);
      if (!result.ok) {
        setMetricsError(result.stderr || result.stdout || "Metrics snapshot write failed.");
        return;
      }

      await loadBoard();
      const snapshotFile = outputValue(result.stdout, "snapshot_file");
      if (snapshotFile) {
        await readLog(snapshotFile);
      }
    } finally {
      setMetricsActionKey("");
    }
  }, [loadBoard, metricsActionKey, options, readLog, recordRunnerTerminal]);

  const boardExists = Boolean(board?.exists);
  const ticketTotal = countTickets(board);
  const projectLabel = options.projectRoot ? basename(options.projectRoot) : "No project";

  return (
    <div className="viewer-shell">
      <header className="top-viewer-bar">
        <div className="brand-panel">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="min-w-0">
            <h1>Codex Flow</h1>
            <p>Autoflow Console</p>
          </div>
        </div>

        <div className="viewer-title">
          <strong>Codex Runner Flow</strong>
          <span>Tracking tickets and local runners</span>
        </div>

        <div className="top-actions">
          <div className="status-chip">
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>
              {lastUpdated ? `Updated ${formatDate(lastUpdated)}${autoRefreshActive ? " / auto" : ""}` : "No snapshot"}
            </span>
          </div>
          <Button variant="default" className="refresh-button" disabled={isRefreshing} onClick={refreshBoard}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="workspace">
        <SummaryGrid board={board} />

        <SpecIntake
          boardExists={boardExists}
          title={specTitle}
          goal={specGoal}
          handoff={specHandoff}
          raw={specRaw}
          archiveHandoff={specArchiveHandoff}
          error={specError}
          isCreating={isCreatingSpec}
          onTitleChange={setSpecTitle}
          onGoalChange={setSpecGoal}
          onHandoffChange={setSpecHandoff}
          onRawChange={setSpecRaw}
          onArchiveHandoffChange={setSpecArchiveHandoff}
          onClear={clearSpecDraft}
          onCreate={createSpec}
        />

        <RunnerConsole
          board={board}
          actionKey={runnerActionKey}
          error={runnerError}
          drafts={runnerDrafts}
          onControl={controlRunner}
          onAddRole={createRunner}
          onRemove={removeRunner}
          onArtifacts={listRunnerArtifacts}
          onReadLog={readLog}
          onDraftChange={updateRunnerDraft}
          onConfigure={saveRunnerConfig}
          onRun={runRunner}
        />

        <RunnerTerminalPanel
          selected={runnerTerminal}
          actionKey={runnerActionKey || (wikiActionKey ? `wiki:${wikiActionKey}` : metricsActionKey ? "metrics:write" : "")}
          history={runnerTerminalHistory}
          onSelect={setRunnerTerminal}
          onReadLog={readLog}
        />

        <section className="board-section" aria-label="Codex work flow">
          <div className="section-heading">
            <div>
              <h3>Agent Ticket Flow</h3>
            </div>
            <Badge variant="outline" className="count-badge">
              {ticketTotal} files
            </Badge>
          </div>
          <TicketBoard board={board} selectedPath={selectedLogPath} onSelect={readLog} />
        </section>

        <section className="lower-grid" aria-label="Codex progress logs and snapshot">
          <div className="tool-panel">
            <div className="section-heading compact">
              <div>
                <div className="section-kicker">History</div>
                <h3>Recent Logs</h3>
              </div>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <LogList board={board} selectedPath={selectedLogPath} onSelect={readLog} />
          </div>

          <div className="tool-panel">
            <div className="section-heading compact">
              <div>
                <div className="section-kicker">Knowledge</div>
                <h3>Wiki & Handoffs</h3>
              </div>
              <div className="knowledge-actions">
                <Button
                  variant="outline"
                  size="icon"
                  className="knowledge-action-button"
                  title="Dry-run wiki update"
                  aria-label="Dry-run wiki update"
                  disabled={!boardExists || Boolean(wikiActionKey)}
                  onClick={() => controlWiki("update", true)}
                >
                  {wikiActionKey === "update-dry-run" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Terminal className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="knowledge-action-button"
                  title="Update wiki"
                  aria-label="Update wiki"
                  disabled={!boardExists || Boolean(wikiActionKey)}
                  onClick={() => controlWiki("update", false)}
                >
                  {wikiActionKey === "update" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="knowledge-action-button"
                  title="Lint wiki"
                  aria-label="Lint wiki"
                  disabled={!boardExists || Boolean(wikiActionKey)}
                  onClick={() => controlWiki("lint", false)}
                >
                  {wikiActionKey === "lint" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {wikiError ? <div className="knowledge-error">{wikiError}</div> : null}
            <div className="knowledge-stack">
              <WikiList board={board} selectedPath={selectedLogPath} onSelect={readLog} />
              <HandoffList board={board} selectedPath={selectedLogPath} onSelect={readLog} />
            </div>
          </div>

          <div className="snapshot-panel">
            <div className="section-heading compact">
              <div>
                <div className="section-kicker">Snapshot</div>
                <h3>Progress Snapshot</h3>
              </div>
              <div className="snapshot-actions">
                <Button
                  variant="outline"
                  size="icon"
                  className="snapshot-action-button"
                  title="Write metrics snapshot"
                  aria-label="Write metrics snapshot"
                  disabled={!boardExists || Boolean(metricsActionKey)}
                  onClick={writeMetricsSnapshot}
                >
                  {metricsActionKey === "write" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4" />
                  )}
                </Button>
                <Badge variant={boardExists ? "default" : options.projectRoot ? "destructive" : "secondary"}>
                  {boardExists ? "tracking" : "missing"}
                </Badge>
              </div>
            </div>
            {metricsError ? <div className="snapshot-error">{metricsError}</div> : null}
            <SnapshotGrid board={board} lastUpdated={lastUpdated} ticketTotal={ticketTotal} />
            <BoardSearch
              board={board}
              query={boardSearch}
              selectedPath={selectedLogPath}
              onQueryChange={setBoardSearch}
              onSelect={readLog}
            />
            <MetricsHistory board={board} selectedPath={selectedLogPath} onSelect={readLog} />
            <StopHookPanel
              board={board}
              actionKey={stopHookActionKey}
              error={stopHookError}
              onControl={controlStopHook}
            />
            <WatcherPanel
              board={board}
              actionKey={watcherActionKey}
              error={watcherError}
              onControl={controlWatcher}
            />
            <DoctorPanel board={board} />
            <LogPreview preview={logPreview} isLoading={isReadingLog} error={logError} />
          </div>
        </section>
      </main>

      <footer className="project-switcher" aria-label="Codex progress source settings">
        <div className="switcher-status">
          <span className={boardExists ? "status-dot status-dot-ok" : "status-dot"} />
          <div>
            <strong>{projectLabel}</strong>
            <span>
              {setupError ||
                (boardExists ? "autoflow loaded" : options.projectRoot ? "autoflow not installed" : "No project")}
            </span>
          </div>
        </div>

        <div className="switcher-field project-root-field">
          <Label htmlFor="projectRoot">Project Root</Label>
          <div className="input-with-action">
            <Input
              id="projectRoot"
              value={projectRoot}
              spellCheck={false}
              placeholder="/path/to/project"
              onChange={(event) => setProjectRoot(event.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              className="browse-button"
              title="Browse project"
              onClick={browseProject}
              aria-label="Browse project"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {options.projectRoot && !boardExists ? (
          <Button className="setup-button" disabled={isInstalling} onClick={() => void installFlow()}>
            {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Install Autoflow
          </Button>
        ) : (
          <Badge variant="secondary" className="switcher-count">
            {ticketTotal} files
          </Badge>
        )}
      </footer>
    </div>
  );
}

function RunnerConsole({
  board,
  actionKey,
  error,
  drafts,
  onControl,
  onAddRole,
  onRemove,
  onArtifacts,
  onReadLog,
  onDraftChange,
  onConfigure,
  onRun
}: {
  board: AutoflowBoardSnapshot | null;
  actionKey: string;
  error: string;
  drafts: Record<string, RunnerDraft>;
  onControl: (action: "start" | "stop" | "restart", runnerId: string) => void;
  onAddRole: (role: RunnerRole) => void;
  onRemove: (runner: AutoflowRunner) => void;
  onArtifacts: (runner: AutoflowRunner) => void;
  onReadLog: (filePath: string) => void;
  onDraftChange: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure: (runner: AutoflowRunner) => void;
  onRun: (runner: AutoflowRunner, dryRun?: boolean) => void;
}) {
  const runners = board?.runners || [];

  return (
    <section className="runner-section" aria-label="Autoflow runner console">
      <div className="section-heading">
        <div>
          <h3>Runner Console</h3>
        </div>
        <div className="runner-heading-actions">
          <Badge variant="outline" className="count-badge">
            {runners.length} runners
          </Badge>
          <div className="runner-add-actions">
            {runnerRoleOptions.map(({ role, label }) => (
              <Button
                key={role}
                variant="outline"
                size="sm"
                className="runner-add-button"
                title={`Add ${label} runner`}
                aria-label={`Add ${label} runner`}
                disabled={Boolean(actionKey)}
                onClick={() => onAddRole(role)}
              >
                {actionKey === `add:${role}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error ? <div className="runner-error">{error}</div> : null}

      <div className="runner-grid">
        {runners.length ? (
          runners.map((runner) => {
            const enabled = runnerIsEnabled(runner.enabled);
            const status = runner.stateStatus || "idle";
            const mode = runner.mode || "one-shot";
            const intervalLabel = runner.intervalSeconds || runner.intervalEffectiveSeconds || "60";
            const isWorking = actionKey.endsWith(`:${runner.id}`);
            const canRun = enabled && mode === "one-shot" && runnableRunnerAgents.has(runner.agent || "shell");
            const canStart = enabled && mode === "loop";
            const canStop = status === "running" || Boolean(runner.pid);
            const draft = drafts[runner.id] || {
              agent: runner.agent || "shell",
              model: runner.model || "",
              reasoning: runner.reasoning || "",
              mode,
              intervalSeconds: runner.intervalSeconds || "60",
              enabled: runner.enabled || "true",
              command: runner.command || ""
            };
            const agentOptions = runnerAgentOptions.includes(draft.agent as (typeof runnerAgentOptions)[number])
              ? runnerAgentOptions
              : [draft.agent, ...runnerAgentOptions];
            const modeOptions = runnerModeOptions.includes(draft.mode as (typeof runnerModeOptions)[number])
              ? runnerModeOptions
              : [draft.mode, ...runnerModeOptions];
            const enabledOptions = runnerEnabledOptions.includes(draft.enabled as (typeof runnerEnabledOptions)[number])
              ? runnerEnabledOptions
              : [draft.enabled, ...runnerEnabledOptions];
            const hasDraftChanges =
              draft.agent !== (runner.agent || "shell") ||
              draft.model !== (runner.model || "") ||
              draft.reasoning !== (runner.reasoning || "") ||
              draft.mode !== mode ||
              draft.intervalSeconds !== (runner.intervalSeconds || "60") ||
              draft.enabled !== (runner.enabled || "true") ||
              draft.command !== (runner.command || "");
            const localCommandPreview = commandPreviewForRunner(runner, draft, board);
            const commandPreview = hasDraftChanges ? localCommandPreview : runner.commandPreview || localCommandPreview;
            const doctorId = runnerDoctorId(runner.id);
            const roleHealth = board?.doctor[`check.${doctorId}_role`] || "unknown";
            const adapterHealth = board?.doctor[`check.${doctorId}_adapter`] || "unknown";
            const enabledHealth = board?.doctor[`check.${doctorId}_enabled`] || "unknown";
            const modeHealth = board?.doctor[`check.${doctorId}_mode`] || "unknown";
            const intervalHealth = board?.doctor[`check.${doctorId}_interval`] || "unknown";
            const artifactHealth = runner.artifactStatus || board?.doctor[`check.${doctorId}_artifacts`] || "unknown";
            const pidHealth = board?.doctor[`check.${doctorId}_pid`] || "unknown";
            const lastRunArtifact = preferredRunnerArtifact(runner);
            const artifactEntries = runnerArtifactEntries(runner);
            const artifactSummary = runnerArtifactSummary(runner);
            const showPidHealth = mode === "loop" || Boolean(runner.pid) || pidHealth === "warning";
            const showIntervalHealth = mode === "loop" || intervalHealth === "warning";
            const showArtifactHealth = artifactHealth !== "not_applicable" && artifactHealth !== "unknown";
            const showRoleHealth = roleHealth === "warning";
            const showEnabledHealth = enabledHealth === "warning";
            const runnerEvent = runner.activeItem || runner.lastResult || runner.lastEventAt || "No event";

            return (
              <article key={runner.id} className="runner-row">
                <div className={`runner-status-dot ${runnerStatusTone(status)}`} aria-hidden="true" />
                <div className="runner-main">
                  <div className="runner-title-line">
                    <strong>{runner.id}</strong>
                    <Badge variant={enabled ? "secondary" : "outline"}>{runner.role || "runner"}</Badge>
                  </div>
                  <span>
                    {runner.agent || "agent"} {runner.model ? `- ${runner.model}` : ""} - {mode}
                    {mode === "loop" ? ` / ${intervalLabel}s` : ""}
                  </span>
                  <div className="runner-health-line">
                    {showRoleHealth ? (
                      <span className={`runner-health-pill ${runnerHealthTone(roleHealth)}`}>role {roleHealth}</span>
                    ) : null}
                    <span className={`runner-health-pill ${runnerHealthTone(adapterHealth)}`}>
                      adapter {adapterHealth}
                    </span>
                    {showEnabledHealth ? (
                      <span className={`runner-health-pill ${runnerHealthTone(enabledHealth)}`}>
                        enabled {enabledHealth}
                      </span>
                    ) : null}
                    <span className={`runner-health-pill ${runnerHealthTone(modeHealth)}`}>mode {modeHealth}</span>
                    {showIntervalHealth ? (
                      <span className={`runner-health-pill ${runnerHealthTone(intervalHealth)}`}>
                        interval {intervalHealth}
                      </span>
                    ) : null}
                    {showPidHealth ? (
                      <span className={`runner-health-pill ${runnerHealthTone(pidHealth)}`}>pid {pidHealth}</span>
                    ) : null}
                    {showArtifactHealth ? (
                      <span className={`runner-health-pill ${runnerHealthTone(artifactHealth)}`}>
                        artifact {artifactHealth}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="runner-state">
                  <strong>{status}</strong>
                  <span>{runnerEvent}</span>
                  {runner.lastResult && runner.lastEventAt ? (
                    <span className="runner-state-muted">{runner.lastEventAt}</span>
                  ) : null}
                  {runner.lastLogLine ? (
                    <span className="runner-log-tail" title={runner.lastLogLine}>
                      {runner.lastLogLine}
                    </span>
                  ) : null}
                </div>
                <div className="runner-actions">
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title={mode === "one-shot" ? "Dry run" : "Dry run requires one-shot mode"}
                    aria-label={`Dry run ${runner.id}`}
                    disabled={!canRun || Boolean(actionKey)}
                    onClick={() => onRun(runner, true)}
                  >
                    {isWorking && actionKey.startsWith("dry-run:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Terminal className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title={mode === "one-shot" ? "Run one tick" : "Run one tick requires one-shot mode"}
                    aria-label={`Run ${runner.id}`}
                    disabled={!canRun || Boolean(actionKey)}
                    onClick={() => onRun(runner, false)}
                  >
                    {isWorking && actionKey.startsWith("run:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title={mode === "loop" ? "Start loop" : "Start requires loop mode"}
                    aria-label={`Start ${runner.id}`}
                    disabled={!canStart || Boolean(actionKey)}
                    onClick={() => onControl("start", runner.id)}
                  >
                    {isWorking && actionKey.startsWith("start:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Activity className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title="Stop runner"
                    aria-label={`Stop ${runner.id}`}
                    disabled={!canStop || Boolean(actionKey)}
                    onClick={() => onControl("stop", runner.id)}
                  >
                    {isWorking && actionKey.startsWith("stop:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title={mode === "loop" ? "Restart loop" : "Restart requires loop mode"}
                    aria-label={`Restart ${runner.id}`}
                    disabled={!canStart || Boolean(actionKey)}
                    onClick={() => onControl("restart", runner.id)}
                  >
                    {isWorking && actionKey.startsWith("restart:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title="List artifact status"
                    aria-label={`List ${runner.id} artifacts`}
                    disabled={Boolean(actionKey)}
                    onClick={() => onArtifacts(runner)}
                  >
                    {isWorking && actionKey.startsWith("artifacts:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardList className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title="Open runner log"
                    aria-label={`Open ${runner.id} log`}
                    disabled={!runner.logPath || Boolean(actionKey)}
                    onClick={() => onReadLog(runner.logPath)}
                  >
                    <BookOpenText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title={
                      lastRunArtifact
                        ? `Open ${lastRunArtifact.label} artifact (${artifactSummary})`
                        : `No run artifact (${artifactSummary})`
                    }
                    aria-label={`Open ${runner.id} last run artifact`}
                    disabled={!lastRunArtifact?.path || Boolean(actionKey)}
                    onClick={() => lastRunArtifact?.path && onReadLog(lastRunArtifact.path)}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title="Remove runner"
                    aria-label={`Remove ${runner.id}`}
                    disabled={Boolean(actionKey)}
                    onClick={() => onRemove(runner)}
                  >
                    {isWorking && actionKey.startsWith("remove:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="runner-artifacts" aria-label={`${runner.id} run artifacts`}>
                  {artifactEntries.map((artifact) => {
                    const canOpenArtifact = Boolean(artifact.path && artifact.status === "ok");
                    return (
                      <button
                        key={artifact.label}
                        type="button"
                        className={`runner-artifact-chip ${runnerHealthTone(artifact.status)}`}
                        title={`${artifact.label}: ${artifact.status}${artifact.path ? ` - ${artifact.path}` : ""}`}
                        aria-label={`${runner.id} ${artifact.label} artifact ${artifact.status}`}
                        disabled={!canOpenArtifact || Boolean(actionKey)}
                        onClick={() => {
                          if (artifact.path) {
                            onReadLog(artifact.path);
                          }
                        }}
                      >
                        <span>{artifact.label}</span>
                        <strong>{artifact.status}</strong>
                      </button>
                    );
                  })}
                </div>
                <div className="runner-config">
                  <select
                    className="runner-select runner-agent-select"
                    value={draft.agent}
                    aria-label={`${runner.id} agent`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "agent", event.target.value)}
                  >
                    {agentOptions.map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </select>
                  <select
                    className="runner-select runner-mode-select"
                    value={draft.mode}
                    aria-label={`${runner.id} mode`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "mode", event.target.value)}
                  >
                    {modeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                  <select
                    className="runner-select runner-enabled-select"
                    value={draft.enabled}
                    aria-label={`${runner.id} enabled`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "enabled", event.target.value)}
                  >
                    {enabledOptions.map((enabledValue) => (
                      <option key={enabledValue} value={enabledValue}>
                        {enabledValue === "true" ? "enabled" : enabledValue === "false" ? "disabled" : enabledValue}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="runner-config-input"
                    value={draft.intervalSeconds}
                    inputMode="numeric"
                    min={1}
                    max={86400}
                    spellCheck={false}
                    placeholder="interval"
                    aria-label={`${runner.id} loop interval seconds`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "intervalSeconds", event.target.value)}
                  />
                  <Input
                    className="runner-config-input"
                    value={draft.model}
                    spellCheck={false}
                    placeholder="model"
                    aria-label={`${runner.id} model`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "model", event.target.value)}
                  />
                  <Input
                    className="runner-config-input"
                    value={draft.reasoning}
                    spellCheck={false}
                    placeholder="reasoning"
                    aria-label={`${runner.id} reasoning`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "reasoning", event.target.value)}
                  />
                  <Input
                    className="runner-config-input runner-command-input"
                    value={draft.command}
                    spellCheck={false}
                    placeholder="command override"
                    aria-label={`${runner.id} command override`}
                    disabled={Boolean(actionKey)}
                    onChange={(event) => onDraftChange(runner.id, "command", event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button"
                    title="Save runner config"
                    aria-label={`Save ${runner.id} config`}
                    disabled={!hasDraftChanges || Boolean(actionKey)}
                    onClick={() => onConfigure(runner)}
                  >
                    {isWorking && actionKey.startsWith("config:") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="runner-command-preview" title={commandPreview}>
                    <Terminal className="h-4 w-4" aria-hidden="true" />
                    <code>{commandPreview}</code>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-panel runner-empty">No runners</div>
        )}
      </div>
    </section>
  );
}

function RunnerTerminalPanel({
  selected,
  actionKey,
  history,
  onSelect,
  onReadLog
}: {
  selected: RunnerTerminalEntry | null;
  actionKey: string;
  history: RunnerTerminalEntry[];
  onSelect: (entry: RunnerTerminalEntry) => void;
  onReadLog: (filePath: string) => void;
}) {
  const result = selected?.result || null;
  const output = result ? terminalOutputTail([result.stdout, result.stderr].filter(Boolean).join("\n")) : "";
  const artifacts = result ? terminalArtifactEntries(result.stdout) : [];

  return (
    <section className="runner-terminal-panel" aria-label="Runner command output">
      <div className="section-heading compact">
        <div>
          <div className="section-kicker">Terminal</div>
          <h3>Runner Output</h3>
        </div>
        <Badge variant={result?.ok ? "default" : result ? "destructive" : "secondary"}>
          {actionKey || (selected ? formatDate(selected.recordedAt) : "idle")}
        </Badge>
      </div>
      <div className="runner-terminal-meta">
        <Terminal className="h-4 w-4" aria-hidden="true" />
        <code>{result?.command || "autoflow runners"}</code>
      </div>
      {history.length ? (
        <div className="runner-terminal-history" aria-label="Recent runner command output">
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === selected?.id ? "runner-terminal-history-active" : ""}
              title={`${formatDate(entry.recordedAt)} ${entry.result.command}`}
              onClick={() => onSelect(entry)}
            >
              <span>{entry.result.command}</span>
              <em>{formatDate(entry.recordedAt)}</em>
              <strong>{entry.result.ok ? "ok" : `exit ${entry.result.code}`}</strong>
            </button>
          ))}
        </div>
      ) : null}
      {artifacts.length ? (
        <div className="runner-terminal-artifacts" aria-label="Runner output artifacts">
          {artifacts.map((artifact) => {
            const canOpenArtifact = Boolean(artifact.path && artifact.status === "ok");
            return (
              <button
                key={artifact.label}
                type="button"
                className={`runner-artifact-chip ${runnerHealthTone(artifact.status)}`}
                title={`${artifact.label}: ${artifact.status}${artifact.path ? ` - ${artifact.path}` : ""}`}
                aria-label={`${artifact.label} artifact ${artifact.status}`}
                disabled={!canOpenArtifact}
                onClick={() => {
                  if (artifact.path) {
                    onReadLog(artifact.path);
                  }
                }}
              >
                <span>{artifact.label}</span>
                <strong>{artifact.status}</strong>
              </button>
            );
          })}
        </div>
      ) : null}
      {output ? <pre>{output}</pre> : <div className="runner-terminal-empty">No runner output</div>}
    </section>
  );
}

function SpecIntake({
  boardExists,
  title,
  goal,
  handoff,
  raw,
  archiveHandoff,
  error,
  isCreating,
  onTitleChange,
  onGoalChange,
  onHandoffChange,
  onRawChange,
  onArchiveHandoffChange,
  onClear,
  onCreate
}: {
  boardExists: boolean;
  title: string;
  goal: string;
  handoff: string;
  raw: boolean;
  archiveHandoff: boolean;
  error: string;
  isCreating: boolean;
  onTitleChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onHandoffChange: (value: string) => void;
  onRawChange: (value: boolean) => void;
  onArchiveHandoffChange: (value: boolean) => void;
  onClear: () => void;
  onCreate: (dryRunOwner?: boolean) => void;
}) {
  const titleReady = raw || title.trim().length > 0;
  const canCreate = boardExists && titleReady && handoff.trim().length > 0 && !isCreating;
  const hasDraft = title.trim().length > 0 || goal.trim().length > 0 || handoff.trim().length > 0 || raw;
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter" || !canCreate) {
        return;
      }

      event.preventDefault();
      onCreate(event.shiftKey);
    },
    [canCreate, onCreate]
  );

  return (
    <section className="spec-section" aria-label="Autoflow spec intake">
      <div className="section-heading">
        <div>
          <h3>Spec Intake</h3>
        </div>
        <div className="spec-actions">
          <Button className="spec-secondary-button" disabled={!hasDraft || isCreating} onClick={onClear}>
            <Trash2 className="h-4 w-4" />
            Clear Draft
          </Button>
          <Button className="spec-secondary-button" disabled={!canCreate} onClick={() => onCreate(true)}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
            Create + Owner Dry Run
          </Button>
          <Button className="spec-create-button" disabled={!canCreate} onClick={() => onCreate(false)}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Create Spec
          </Button>
        </div>
      </div>

      {error ? <div className="runner-error">{error}</div> : null}

      <div className="spec-intake-grid">
        <div className="spec-fields">
          <Input
            value={title}
            spellCheck={false}
            placeholder={raw ? "Spec title (optional)" : "Spec title"}
            aria-label="Spec title"
            disabled={!boardExists || isCreating}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <Input
            value={goal}
            spellCheck={false}
            placeholder="Goal"
            aria-label="Spec goal"
            disabled={!boardExists || isCreating || raw}
            onChange={(event) => onGoalChange(event.target.value)}
          />
          <label className="spec-raw-toggle">
            <input
              type="checkbox"
              checked={raw}
              disabled={!boardExists || isCreating}
              onChange={(event) => onRawChange(event.target.checked)}
            />
            <span>Raw markdown</span>
          </label>
          <label className="spec-raw-toggle">
            <input
              type="checkbox"
              checked={archiveHandoff}
              disabled={!boardExists || isCreating}
              onChange={(event) => onArchiveHandoffChange(event.target.checked)}
            />
            <span>Archive handoff</span>
          </label>
        </div>
        <textarea
          className="spec-handoff"
          value={handoff}
          spellCheck={false}
          placeholder={raw ? "# Project Spec..." : "Paste conversation handoff or #autoflow summary here"}
          aria-label="Conversation handoff"
          disabled={!boardExists || isCreating}
          onChange={(event) => onHandoffChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </section>
  );
}

function SnapshotGrid({
  board,
  lastUpdated,
  ticketTotal
}: {
  board: AutoflowBoardSnapshot | null;
  lastUpdated: string;
  ticketTotal: number;
}) {
  const status = board?.status || {};
  const doctor = board?.doctor || {};
  const metrics = board?.metrics || {};
  const rows = [
    ["Flow Source", board?.exists ? "autoflow found" : "Missing"],
    ["Version", statusValue(status, "board_version", "-")],
    ["Health", statusValue(doctor, "status", board?.exists ? "unknown" : "-")],
    ["Completion", `${statusValue(metrics, "completion_rate_percent", "0.0")}%`],
    ["Pass Rate", `${statusValue(metrics, "verification_pass_rate_percent", "0.0")}%`],
    ["Ticket Files", statusValue(metrics, "ticket_total", String(ticketTotal))],
    [
      "Artifacts",
      `${statusValue(metrics, "runner_artifact_ok_count", "0")} ok / ${statusValue(
        metrics,
        "runner_artifact_warning_count",
        "0"
      )} warn`
    ],
    ["Handoffs", statusValue(metrics, "handoff_count", String(board?.conversationFiles?.length || 0))],
    ["Updated", lastUpdated ? formatDate(lastUpdated) : "-"]
  ];

  return (
    <div className="snapshot-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="snapshot-item">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function BoardSearch({
  board,
  query,
  selectedPath,
  onQueryChange,
  onSelect
}: {
  board: AutoflowBoardSnapshot | null;
  query: string;
  selectedPath: string;
  onQueryChange: (query: string) => void;
  onSelect: (filePath: string) => void;
}) {
  const results = React.useMemo(() => searchBoardFiles(board, query), [board, query]);
  const hasQuery = Boolean(query.trim());

  return (
    <div className="board-search-panel">
      <div className="board-search-field">
        <Search className="h-4 w-4" aria-hidden="true" />
        <Input
          value={query}
          spellCheck={false}
          placeholder="Find files"
          aria-label="Find board files"
          disabled={!board?.exists}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      {hasQuery ? (
        results.length ? (
          <div className="board-search-results">
            {results.map((file) => (
              <button
                key={file.filePath}
                type="button"
                className={`log-row${selectedPath === file.filePath ? " log-row-selected" : ""}`}
                onClick={() => onSelect(file.filePath)}
              >
                <Search className="h-4 w-4" />
                <div className="min-w-0">
                  <strong>{file.name}</strong>
                  <span>
                    {boardFileKind(file.filePath)} - {formatDate(file.modifiedAt)}
                  </span>
                  <p>{file.title}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-panel board-search-empty">No matches</div>
        )
      ) : null}
    </div>
  );
}

function MetricsHistory({
  board,
  selectedPath,
  onSelect
}: {
  board: AutoflowBoardSnapshot | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
}) {
  const files = board?.metricsFiles || [];

  return (
    <div className="metrics-history">
      <div className="panel-subheading">
        <span>Metric History</span>
        <Badge variant="outline">{files.length}</Badge>
      </div>
      {files.length ? (
        <div className="metrics-history-list">
          {files.map((file) => (
            <button
              key={file.filePath}
              type="button"
              className={`log-row${selectedPath === file.filePath ? " log-row-selected" : ""}`}
              onClick={() => onSelect(file.filePath)}
            >
              <ClipboardCheck className="h-4 w-4" />
              <div className="min-w-0">
                <strong>{file.name}</strong>
                <span>Metrics - {formatDate(file.modifiedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-panel metrics-empty">No metric snapshots</div>
      )}
    </div>
  );
}

function StopHookPanel({
  board,
  actionKey,
  error,
  onControl
}: {
  board: AutoflowBoardSnapshot | null;
  actionKey: string;
  error: string;
  onControl: (action: "install" | "remove" | "status") => void;
}) {
  const stopHook = board?.stopHook || {};
  const status = statusValue(stopHook, "status", board?.exists ? "unknown" : "-");
  const installed = status === "installed";
  const tone = installed ? "stop-hook-installed" : status === "missing" ? "stop-hook-missing" : "stop-hook-unknown";

  return (
    <div className={`stop-hook-panel ${tone}`}>
      <div className="stop-hook-main">
        <div className="stop-hook-title">
          <ShieldCheck className="h-4 w-4" />
          <div>
            <strong>Stop Hook</strong>
            <span>{status}</span>
          </div>
        </div>
        <div className="stop-hook-actions">
          <Button
            variant="outline"
            size="icon"
            className="runner-icon-button"
            title="Refresh stop hook"
            aria-label="Refresh stop hook"
            disabled={!board?.exists || Boolean(actionKey)}
            onClick={() => onControl("status")}
          >
            {actionKey === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            className="stop-hook-button"
            disabled={!board?.exists || installed || Boolean(actionKey)}
            onClick={() => onControl("install")}
          >
            {actionKey === "install" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Install
          </Button>
          <Button
            variant="outline"
            className="stop-hook-button"
            disabled={!board?.exists || !installed || Boolean(actionKey)}
            onClick={() => onControl("remove")}
          >
            {actionKey === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove
          </Button>
        </div>
      </div>
      {error ? <div className="stop-hook-error">{error}</div> : null}
    </div>
  );
}

function WatcherPanel({
  board,
  actionKey,
  error,
  onControl
}: {
  board: AutoflowBoardSnapshot | null;
  actionKey: string;
  error: string;
  onControl: (action: "start" | "stop" | "status") => void;
}) {
  const watcher = board?.watcher || {};
  const status = statusValue(watcher, "status", board?.exists ? "unknown" : "-");
  const running = status === "running" || status === "already_running" || status === "started";
  const stale = status === "stale_pid" || status === "stale_pid_removed";
  const tone = running ? "watcher-running" : stale ? "watcher-stale" : "watcher-idle";

  return (
    <div className={`watcher-panel ${tone}`}>
      <div className="watcher-main">
        <div className="watcher-title">
          <Activity className="h-4 w-4" />
          <div>
            <strong>File Watcher</strong>
            <span>{watcher.pid ? `${status} - pid ${watcher.pid}` : status}</span>
          </div>
        </div>
        <div className="watcher-actions">
          <Button
            variant="outline"
            size="icon"
            className="runner-icon-button"
            title="Refresh watcher"
            aria-label="Refresh watcher"
            disabled={!board?.exists || Boolean(actionKey)}
            onClick={() => onControl("status")}
          >
            {actionKey === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            className="watcher-button"
            disabled={!board?.exists || running || Boolean(actionKey)}
            onClick={() => onControl("start")}
          >
            {actionKey === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start
          </Button>
          <Button
            variant="outline"
            className="watcher-button"
            disabled={!board?.exists || (!running && !stale) || Boolean(actionKey)}
            onClick={() => onControl("stop")}
          >
            {actionKey === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            Stop
          </Button>
        </div>
      </div>
      {error ? <div className="watcher-error">{error}</div> : null}
    </div>
  );
}

function DoctorPanel({ board }: { board: AutoflowBoardSnapshot | null }) {
  const doctor = board?.doctor || {};
  const errors = prefixedValues(doctor, "error.");
  const warnings = prefixedValues(doctor, "warning.");
  const messages = [...errors, ...warnings].slice(0, 4);
  const status = statusValue(doctor, "status", board?.exists ? "unknown" : "-");
  const tone = errors.length ? "doctor-fail" : warnings.length ? "doctor-warning" : "doctor-ok";

  return (
    <div className={`doctor-panel ${tone}`}>
      <div className="doctor-panel-header">
        <strong>Doctor</strong>
        <Badge variant={errors.length ? "destructive" : warnings.length ? "outline" : "secondary"}>{status}</Badge>
      </div>
      {messages.length ? (
        <ul>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        <p>{board?.exists ? "No health messages" : "No board snapshot"}</p>
      )}
    </div>
  );
}

function SummaryGrid({ board }: { board: AutoflowBoardSnapshot | null }) {
  const status = board?.status || {};
  const metrics = board?.metrics || {};
  const passRate = statusValue(metrics, "verification_pass_rate_percent", "0.0");
  const passCount = statusValue(metrics, "verifier_pass_count", "0");
  const verifierTotal = statusValue(metrics, "verifier_total", "0");
  const handoffCount = statusValue(metrics, "handoff_count", String(board?.conversationFiles?.length || 0));
  const runnerRunningCount = statusValue(metrics, "runner_running_count", "0");
  const runnerTotalCount = statusValue(metrics, "runner_total_count", String(board?.runners?.length || 0));
  const runnerEnabledCount = statusValue(metrics, "runner_enabled_count", runnerTotalCount);
  const cards = [
    {
      label: "Specs",
      value: statusValue(metrics, "spec_total", statusValue(status, "spec_count", String(board?.tickets.backlog?.length || 0))),
      detail: `${handoffCount} handoffs`,
      icon: ClipboardCheck,
      tone: "metric-blue"
    },
    {
      label: "Todo",
      value: statusValue(status, "ticket_todo_count", String(board?.tickets.todo?.length || 0)),
      detail: "ready",
      icon: Layers3,
      tone: "metric-amber"
    },
    {
      label: "Running",
      value: statusValue(metrics, "active_ticket_count", String(board?.tickets.inprogress?.length || 0)),
      detail: `${runnerRunningCount}/${runnerEnabledCount} enabled`,
      icon: Activity,
      tone: "metric-teal"
    },
    {
      label: "Pass Rate",
      value: `${passRate}%`,
      detail: `${passCount}/${verifierTotal}`,
      icon: ShieldCheck,
      tone: "metric-violet"
    },
    {
      label: "Done",
      value: statusValue(metrics, "ticket_done_count", statusValue(status, "ticket_done_count", String(board?.tickets.done?.length || 0))),
      detail: `${statusValue(metrics, "completion_rate_percent", "0.0")}% complete`,
      icon: Archive,
      tone: "metric-green"
    }
  ];

  return (
    <section className="metrics-strip" aria-label="Codex progress summary">
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <article key={label} className={`metric-card ${tone}`}>
          <div className="metric-icon">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
          <em>{detail}</em>
        </article>
      ))}
    </section>
  );
}

function TicketBoard({
  board,
  selectedPath,
  onSelect
}: {
  board: AutoflowBoardSnapshot | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
}) {
  return (
    <div className="ticket-board">
      {ticketColumns.map(({ key, label, meta, icon: Icon, tone }) => {
        const items = board?.tickets[key] || [];
        return (
          <section key={key} className={`ticket-lane ${tone}`}>
            <header>
              <div className="lane-title">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
              <Badge variant="secondary">{items.length}</Badge>
            </header>
            <p>{meta}</p>
            <div className="ticket-stack">
              {items.length ? (
                items.map((item) => (
                  <button
                    key={item.filePath}
                    type="button"
                    className={`ticket-card${selectedPath === item.filePath ? " ticket-card-selected" : ""}`}
                    onClick={() => onSelect(item.filePath)}
                  >
                    <div className="ticket-card-top">
                      <strong>{item.name}</strong>
                      <span>{formatDate(item.modifiedAt)}</span>
                    </div>
                    <p>{item.title}</p>
                  </button>
                ))
              ) : (
                <div className="empty-lane">Empty</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LogList({
  board,
  selectedPath,
  onSelect
}: {
  board: AutoflowBoardSnapshot | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
}) {
  const logs = React.useMemo(() => recentLogs(board), [board]);

  if (!logs.length) {
    return <div className="empty-panel">No logs</div>;
  }

  return (
    <div className="log-list">
      {logs.map((log) => (
        <button
          key={log.filePath}
          type="button"
          className={`log-row${selectedPath === log.filePath ? " log-row-selected" : ""}`}
          onClick={() => onSelect(log.filePath)}
        >
          <Terminal className="h-4 w-4" />
          <div className="min-w-0">
            <strong>{log.name}</strong>
            <span>
              {log.source} - {formatDate(log.modifiedAt)}
            </span>
            <p>{log.title}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function WikiList({
  board,
  selectedPath,
  onSelect
}: {
  board: AutoflowBoardSnapshot | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
}) {
  const pages = board?.wikiFiles || [];

  if (!pages.length) {
    return <div className="empty-panel">No wiki pages</div>;
  }

  return (
    <div className="log-list knowledge-list">
      {pages.map((page) => (
        <button
          key={page.filePath}
          type="button"
          className={`log-row${selectedPath === page.filePath ? " log-row-selected" : ""}`}
          onClick={() => onSelect(page.filePath)}
        >
          <BookOpenText className="h-4 w-4" />
          <div className="min-w-0">
            <strong>{page.name}</strong>
            <span>Wiki - {formatDate(page.modifiedAt)}</span>
            <p>{page.title}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function HandoffList({
  board,
  selectedPath,
  onSelect
}: {
  board: AutoflowBoardSnapshot | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
}) {
  const handoffs = board?.conversationFiles || [];

  return (
    <div className="handoff-block">
      <div className="panel-subheading">
        <span>Handoffs</span>
        <Badge variant="outline">{handoffs.length}</Badge>
      </div>
      {handoffs.length ? (
        <div className="log-list handoff-list">
          {handoffs.map((handoff) => (
            <button
              key={handoff.filePath}
              type="button"
              className={`log-row${selectedPath === handoff.filePath ? " log-row-selected" : ""}`}
              onClick={() => onSelect(handoff.filePath)}
            >
              <ClipboardList className="h-4 w-4" />
              <div className="min-w-0">
                <strong>{handoff.name}</strong>
                <span>Handoff - {formatDate(handoff.modifiedAt)}</span>
                <p>{handoff.title}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-panel handoff-empty">No handoffs</div>
      )}
    </div>
  );
}

function LogPreview({
  preview,
  isLoading,
  error
}: {
  preview: AutoflowFileContentResult | null;
  isLoading: boolean;
  error: string;
}) {
  return (
    <div className="log-preview">
      <div className="log-preview-header">
        <strong>{preview?.name || "Log Preview"}</strong>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {!isLoading && preview?.truncated ? (
          <Badge variant="outline" className="log-preview-badge">
            truncated
          </Badge>
        ) : null}
      </div>
      {error ? <div className="log-preview-error">{error}</div> : null}
      {!error && preview ? <pre>{preview.content || "(empty)"}</pre> : null}
      {!error && !preview ? <div className="empty-panel log-preview-empty">No log selected</div> : null}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
