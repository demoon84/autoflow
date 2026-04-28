import * as React from "react";
import { createRoot } from "react-dom/client";
import ButtonBase from "@mui/material/ButtonBase";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import AnsiToHtml from "ansi-to-html";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderOpen,
  FolderPlus,
  Inbox,
  KanbanSquare,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  TriangleAlert,
  PieChart,
  TrendingUp,
  Workflow,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { desktopTheme } from "./theme";
import "./styles.css";
import claudeAppIcon from "./assets/agent-icons/claude.png";
import codexAppIcon from "./assets/agent-icons/codex.png";
import geminiAppIcon from "./assets/agent-icons/gemini.png";

const ticketFolders = ["backlog", "todo", "inprogress", "done", "reject"] as const;

const ownerFlowStages = [
  { key: "todo", label: "대기", meta: "다음 실행 차례", icon: Layers3, tone: "flow-todo" },
  { key: "inprogress", label: "구현", meta: "mini-plan / 구현 / 검증 / 머지 통합", icon: Activity, tone: "flow-inprogress" },
  { key: "done", label: "완료", meta: "통과", icon: CheckCircle2, tone: "flow-done" },
  { key: "reject", label: "반려", meta: "재계획 필요", icon: TriangleAlert, tone: "flow-reject" }
] as const;

const mergeBotFlowStages = [
  { key: "idle", label: "대기", meta: "ready-to-merge 감시", icon: Layers3, tone: "flow-todo" },
  { key: "merging", label: "머지", meta: "PROJECT_ROOT 통합", icon: Activity, tone: "flow-inprogress" },
  { key: "done", label: "완료", meta: "통합 + 정리", icon: CheckCircle2, tone: "flow-done" },
  { key: "blocked", label: "정체", meta: "merge-blocked", icon: TriangleAlert, tone: "flow-reject" }
] as const;

const wikiBotFlowStages = [
  { key: "idle", label: "대기", meta: "다음 동기화 대기", icon: Layers3, tone: "flow-todo" },
  { key: "syncing", label: "동기화", meta: "Wiki 갱신", icon: Activity, tone: "flow-inprogress" },
  { key: "done", label: "완료", meta: "갱신 완료", icon: CheckCircle2, tone: "flow-done" },
  { key: "blocked", label: "오류", meta: "어댑터 오류", icon: TriangleAlert, tone: "flow-reject" }
] as const;

const plannerFlowStages = [
  { key: "idle", label: "대기", meta: "backlog/reject 감시", icon: Layers3, tone: "flow-todo" },
  { key: "planning", label: "계획", meta: "PRD 분해 / 재계획", icon: ClipboardList, tone: "flow-plan" },
  { key: "done", label: "완료", meta: "todo 생성 완료", icon: CheckCircle2, tone: "flow-done" },
  { key: "blocked", label: "정체", meta: "PRD 누락 등", icon: TriangleAlert, tone: "flow-reject" }
] as const;

type FlowStageDef = {
  readonly key: string;
  readonly label: string;
  readonly meta: string;
  readonly icon: typeof Layers3;
  readonly tone: string;
};

const fallbackFlowFolder = ".autoflow";
const runnerAgentOptions = ["codex", "claude", "gemini"] as const;
const runnerAgentModelOptions: Record<string, string[]> = {
  codex: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark", "gpt-5.2"],
  claude: ["opus", "opus-1m", "sonnet", "haiku"],
  gemini: [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
  ]
};
const runnerAgentReasoningOptions: Record<string, string[]> = {
  codex: ["low", "medium", "high", "xhigh"],
  claude: ["medium", "high"],
  gemini: []
};
const runnerOptionLabels: Record<string, Record<string, string>> = {
  claude: {
    opus: "Opus 4.7",
    "opus-1m": "Opus 4.7 1M",
    sonnet: "Sonnet 4.6",
    haiku: "Haiku 4.5",
    low: "낮음",
    medium: "보통",
    high: "높음",
    xhigh: "매우 높음",
    max: "Max"
  }
};
const runnerModeOptions = ["one-shot", "loop", "watch"] as const;
const runnerEnabledOptions = ["true", "false"] as const;
const runnableRunnerAgents = new Set<string>(runnerAgentOptions);

const settingsNavigation = [
  { key: "progress", label: "작업", icon: Workflow },
  { key: "kanban", label: "티켓 정보", icon: KanbanSquare },
  { key: "knowledge", label: "Wiki", icon: BookOpenText },
  { key: "snapshot", label: "통계", icon: BarChart3 }
] as const;

type SettingsSection = (typeof settingsNavigation)[number]["key"];

type RunnerDraft = {
  agent: string;
  model: string;
  reasoning: string;
  mode: string;
  intervalSeconds: string;
  enabled: string;
  command: string;
};

type InstalledAgentProfiles = AutoflowInstalledAgentProfiles;

type DisplayLog = AutoflowFilePreview & {
  source: "Board" | "Runner";
};

function initialSetting(key: string, fallback: string) {
  return window.localStorage.getItem(key) || fallback;
}

function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function dirname(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }

  const prefix = value.startsWith("/") ? "/" : "";
  return `${prefix}${parts.slice(0, -1).join("/")}`;
}

function defaultRecentProjects(currentProjectRoot: string) {
  const parent = dirname(currentProjectRoot);
  if (!parent) {
    return currentProjectRoot ? [currentProjectRoot] : [];
  }

  const commonProjectNames = ["tetris", "autoflow", "ez", "mySkills", "local-ai-proxy", "vibe-terminal"];
  const seeded = commonProjectNames.map((name) => `${parent}/${name}`);
  return currentProjectRoot ? [currentProjectRoot, ...seeded] : seeded;
}

function normalizeProjectList(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    })
    .slice(0, 8);
}

function readRecentProjects(currentProjectRoot: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("autoflow.recentProjects") || "[]");
    if (Array.isArray(parsed)) {
      return normalizeProjectList([...parsed.filter((value) => typeof value === "string"), ...defaultRecentProjects(currentProjectRoot)]);
    }
  } catch {
    // Ignore corrupt persisted UI state and fall back to the current project.
  }

  return normalizeProjectList(defaultRecentProjects(currentProjectRoot));
}

function persistRecentProjects(projects: string[]) {
  window.localStorage.setItem("autoflow.recentProjects", JSON.stringify(projects));
}

function countTickets(board: AutoflowBoardSnapshot | null) {
  if (!board) {
    return 0;
  }

  return ticketFolders.reduce((total, key) => total + (board.tickets[key]?.length || 0), 0);
}

function completedWorkKey(board: AutoflowBoardSnapshot | null) {
  if (!board?.exists) {
    return "";
  }

  const completedFiles = [...(board.tickets.done || []), ...(board.tickets.reject || [])];
  return completedFiles
    .map((file) => `${file.filePath}:${file.modifiedAt}:${file.title}`)
    .sort()
    .join("|");
}

function useAutomaticWikiUpdate(
  board: AutoflowBoardSnapshot | null,
  options: { projectRoot: string; boardDirName: string },
  loadBoard: (targetOptions?: { projectRoot: string; boardDirName: string }) => Promise<void>,
  setWikiError?: (message: string) => void
) {
  const previousCompletedWorkKeyRef = React.useRef<string | null>(null);
  const autoWikiUpdateInFlightRef = React.useRef(false);

  React.useEffect(() => {
    if (!options.projectRoot || !board?.exists) {
      previousCompletedWorkKeyRef.current = "";
      return;
    }

    const nextKey = completedWorkKey(board);
    if (previousCompletedWorkKeyRef.current === null) {
      previousCompletedWorkKeyRef.current = nextKey;
      return;
    }

    if (!nextKey || nextKey === previousCompletedWorkKeyRef.current || autoWikiUpdateInFlightRef.current) {
      return;
    }

    previousCompletedWorkKeyRef.current = nextKey;
    autoWikiUpdateInFlightRef.current = true;
    setWikiError?.("");

    window.autoflow
      .controlWiki({ action: "update", dryRun: false, ...options })
      .then(async (result) => {
        if (!result.ok) {
          setWikiError?.(result.stderr || result.stdout || "위키 자동 업데이트에 실패했습니다.");
          return;
        }

        await loadBoard(options);
      })
      .catch((error) => {
        setWikiError?.(error instanceof Error ? error.message : "위키 자동 업데이트에 실패했습니다.");
      })
      .finally(() => {
        autoWikiUpdateInFlightRef.current = false;
      });
  }, [board, loadBoard, options, setWikiError]);
}

function statusValue(status: Record<string, string>, key: string, fallback: string) {
  const value = status[key];
  return value && value.trim().length ? value : fallback;
}

function statusNumber(status: Record<string, string>, key: string, fallback = 0) {
  const parsed = Number(statusValue(status, key, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0
  }).format(value);
}

function useCountUp(target: number, durationMs = 600) {
  const [display, setDisplay] = React.useState(target);
  const displayRef = React.useRef(target);

  React.useEffect(() => {
    const start = displayRef.current;
    const end = target;
    if (start === end) return undefined;

    const startTime =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    let frameId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        displayRef.current = end;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return display;
}

function formatCompactCount(value: number) {
  const absolute = Math.abs(value);
  const formatter = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1
  });

  if (absolute >= 1_000_000) {
    return `${formatter.format(value / 1_000_000)}M`;
  }

  if (absolute >= 1_000) {
    return `${formatter.format(value / 1_000)}K`;
  }

  return formatCount(value);
}

function formatSignedCount(value: number) {
  return `${value >= 0 ? "+" : ""}${formatCount(value)}`;
}

function getWorkflowMetricCounts(board: AutoflowBoardSnapshot | null) {
  const metrics = board?.metrics || {};

  return {
    codeFilesChangedCount: statusNumber(metrics, "autoflow_code_files_changed_count"),
    codeInsertionsCount: statusNumber(metrics, "autoflow_code_insertions_count"),
    codeDeletionsCount: statusNumber(metrics, "autoflow_code_deletions_count"),
    codeVolumeCount: statusNumber(metrics, "autoflow_code_volume_count"),
    tokenUsageCount: statusNumber(metrics, "autoflow_token_usage_count"),
    tokenReportCount: statusNumber(metrics, "autoflow_token_report_count")
  };
}

function formatPercentValue(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const statusLabels: Record<string, string> = {
  ok: "정상",
  idle: "대기",
  running: "실행 중",
  blocked: "막힘",
  failed: "실패",
  fail: "실패",
  stopped: "중지됨",
  warning: "주의",
  error: "오류",
  planning: "계획 중",
  executing: "구현 중",
  verifying: "검증 중",
  done: "완료",
  rejected: "반려",
  disabled: "꺼짐",
  not_applicable: "해당 없음",
  unknown: "알 수 없음",
  absent: "없음",
  installed: "설치됨",
  missing: "없음",
  started: "시작됨",
  already_running: "이미 실행 중",
  stale_pid: "오래된 PID",
  stale_pid_removed: "오래된 PID 제거됨",
  dry_run: "미리 실행",
  true: "사용",
  false: "중지"
};

// Default topology is Plan AI + Impl AI. Legacy role labels are kept so older
// boards with coordinator / wiki-maintainer / merge / verifier runners still
// render readable names.
const runnerRoleLabels: Record<string, string> = {
  "ticket-owner": "Impl AI",
  owner: "Impl AI",
  ticket: "Impl AI",
  planner: "Plan AI",
  plan: "Plan AI",
  "wiki-maintainer": "Wiki AI",
  wiki: "Wiki AI",
  coordinator: "coordinator (legacy)",
  coord: "coordinator (legacy)",
  doctor: "coordinator (legacy)",
  diagnose: "coordinator (legacy)",
  todo: "작업자 (legacy)",
  verifier: "검증자 (legacy)",
  veri: "검증자 (legacy)",
  watcher: "감시기",
  runner: "AI"
};

const runnerModeLabels: Record<string, string> = {
  "one-shot": "1회 실행",
  loop: "반복 실행",
  watch: "파일 감시"
};

const artifactLabels: Record<string, string> = {
  runtime: "런타임",
  prompt: "프롬프트",
  stdout: "표준 출력",
  stderr: "표준 오류"
};

function displayStatus(value: string) {
  const adapterExit = value.match(/^adapter_exit_(\d+)$/);
  if (adapterExit) {
    return adapterExit[1] === "0" ? "정상 종료" : `종료 ${adapterExit[1]}`;
  }

  const loopExit = value.match(/^loop_waiting_exit_(\d+)$/);
  if (loopExit) {
    return loopExit[1] === "0" ? "다음 실행 대기" : `종료 ${loopExit[1]} 후 대기`;
  }

  return statusLabels[value] || value || "-";
}

function displayRunnerRole(value: string) {
  return runnerRoleLabels[value] || value || "AI";
}

function displayRunnerMode(value: string) {
  return runnerModeLabels[value] || value || "-";
}

function displayArtifactLabel(value: string) {
  return artifactLabels[value] || value || "산출물";
}

function uniqueOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function displayRunnerOption(agent: string, value: string) {
  return runnerOptionLabels[agent]?.[value] || value;
}

function runnerProfileForAgent(agent: string, installedAgentProfiles: InstalledAgentProfiles) {
  return (
    installedAgentProfiles[agent] || {
      installed: false,
      model: "",
      reasoning: "",
      supportsReasoning: agent !== "gemini"
    }
  );
}

function runnerModelChoices(agent: string, installedAgentProfiles: InstalledAgentProfiles, currentValue = "") {
  const profile = runnerProfileForAgent(agent, installedAgentProfiles);
  return uniqueOptions([currentValue, profile.model, ...(runnerAgentModelOptions[agent] || [])]);
}

function runnerReasoningChoices(agent: string, installedAgentProfiles: InstalledAgentProfiles, currentValue = "") {
  const profile = runnerProfileForAgent(agent, installedAgentProfiles);
  if (!profile.supportsReasoning) {
    return [];
  }

  if (agent === "claude") {
    return uniqueOptions(runnerAgentReasoningOptions.claude || []);
  }

  return uniqueOptions([currentValue, profile.reasoning, ...(runnerAgentReasoningOptions[agent] || [])]);
}

function normalizeRunnerSelections(
  agent: string,
  model: string,
  reasoning: string,
  installedAgentProfiles: InstalledAgentProfiles
) {
  const profile = runnerProfileForAgent(agent, installedAgentProfiles);
  const modelChoices = runnerModelChoices(agent, installedAgentProfiles, model);
  const normalizedModel = modelChoices[0] || "";
  const reasoningChoices = runnerReasoningChoices(agent, installedAgentProfiles, reasoning);
  const normalizedReasoning =
    agent === "claude" && profile.supportsReasoning
      ? reasoningChoices.includes(reasoning)
        ? reasoning
        : "high"
      : profile.supportsReasoning
        ? reasoningChoices[0] || ""
        : "";

  return {
    model: normalizedModel,
    reasoning: normalizedReasoning,
    supportsReasoning: profile.supportsReasoning,
    modelChoices,
    reasoningChoices
  };
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
  board: AutoflowBoardSnapshot | null,
  defaultBoardDirName: string
) {
  const projectRoot = board?.status.project_root || "<project-root>";
  const boardDirName = board?.status.board_dir_name || defaultBoardDirName;
  const role = runRoleForRunner(runner.role);
  const model = draft.model.trim();
  const reasoning = draft.reasoning.trim();
  const commandOverride = draft.command.trim();

  if (commandOverride) {
    return `사용자 명령: ${commandOverride} < $AUTOFLOW_PROMPT_FILE`;
  }

  if (draft.mode === "loop") {
    const interval = draft.intervalSeconds.trim() || runner.intervalEffectiveSeconds || "60";
    return `${interval}초마다 반복: autoflow runners start ${shellArg(runner.id)} ${shellArg(projectRoot)} ${shellArg(
      boardDirName
    )}`;
  }

  if (draft.mode === "watch") {
    return `파일 감시: autoflow watch-bg ${shellArg(projectRoot)} ${shellArg(boardDirName)}`;
  }

  if (draft.agent === "codex") {
    return [
      "codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check",
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
      "claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text",
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

function runnerIsEnabled(value: string) {
  return value ? value === "true" : true;
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

  const ticketFiles = ticketFolders.flatMap((key) => board.tickets[key] || []);

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
    return "티켓";
  }
  if (normalizedPath.includes("/wiki/")) {
    return "위키";
  }
  if (normalizedPath.includes("/metrics/")) {
    return "지표";
  }
  if (normalizedPath.includes("/conversations/")) {
    return "소스 · Handoff";
  }
  if (normalizedPath.includes("/runners/logs/")) {
    return "AI";
  }
  if (normalizedPath.includes("/logs/")) {
    return "로그";
  }

  return "파일";
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

type WikiQuerySnippet = { line: number; text: string };
type WikiQueryResult = {
  path: string;
  title: string;
  kind: string;
  score: number;
  snippets: WikiQuerySnippet[];
};
type WikiQueryParsed = {
  status: string;
  reason: string;
  resultCount: number;
  results: WikiQueryResult[];
};

function parseWikiQueryOutput(output: string): WikiQueryParsed {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0) {
      values[line.slice(0, index)] = line.slice(index + 1);
    }
  }

  const total = Number(values.result_count || "0") || 0;
  const results: WikiQueryResult[] = [];
  for (let i = 1; i <= total; i++) {
    const path = values[`result.${i}.path`];
    if (!path) continue;
    const score = Number(values[`result.${i}.score`] || "0") || 0;
    const snippetCount = Number(values[`result.${i}.snippet_count`] || "0") || 0;
    const snippets: WikiQuerySnippet[] = [];
    for (let s = 1; s <= snippetCount; s++) {
      const lineNo = Number(values[`result.${i}.snippet.${s}.line`] || "0") || 0;
      const text = values[`result.${i}.snippet.${s}.text`] || "";
      if (text) snippets.push({ line: lineNo, text });
    }
    results.push({
      path,
      title: values[`result.${i}.title`] || path,
      kind: values[`result.${i}.kind`] || "other",
      score,
      snippets
    });
  }

  return {
    status: values.status || "",
    reason: values.reason || "",
    resultCount: total,
    results
  };
}

const WIKI_QUERY_KIND_LABEL: Record<string, string> = {
  wiki: "Wiki",
  "wiki-decision": "Wiki · Decision",
  "wiki-feature": "Wiki · Feature",
  "wiki-architecture": "Wiki · Architecture",
  "wiki-learning": "Wiki · Learning",
  "ticket-done": "Ticket · Done",
  "ticket-reject": "Ticket · Reject",
  handoff: "Handoff",
  log: "Log",
  other: "Other"
};

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

function runnerHealthNeedsAttention(value: string) {
  return ["blocked", "error", "fail", "failed", "missing", "stale_pid", "warning"].includes(value);
}

function App() {
  const [projectRoot, setProjectRoot] = React.useState(() => initialSetting("autoflow.projectRoot", ""));
  const [defaultFlowFolder, setDefaultFlowFolder] = React.useState(() =>
    initialSetting("autoflow.boardDirName", fallbackFlowFolder)
  );
  const [board, setBoard] = React.useState<AutoflowBoardSnapshot | null>(null);
  const [isBoardLoading, setIsBoardLoading] = React.useState(false);
  const [isPageRefreshing, setIsPageRefreshing] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [installedAgentProfiles, setInstalledAgentProfiles] = React.useState<InstalledAgentProfiles>({});
  const [runnerActionKey, setRunnerActionKey] = React.useState("");
  const [runnerError, setRunnerError] = React.useState("");
  const [runnerDrafts, setRunnerDrafts] = React.useState<Record<string, RunnerDraft>>({});
  const [selectedRunnerId, setSelectedRunnerId] = React.useState("");
  const [selectedLogPath, setSelectedLogPath] = React.useState("");
  const [boardSearch, setBoardSearch] = React.useState("");
  const [logPreview, setLogPreview] = React.useState<AutoflowFileContentResult | null>(null);
  const [isReadingLog, setIsReadingLog] = React.useState(false);
  const [logError, setLogError] = React.useState("");
  const [setupError, setSetupError] = React.useState("");
  const [wikiError, setWikiError] = React.useState("");
  const [wikiQueryInput, setWikiQueryInput] = React.useState("");
  const [wikiQueryRunning, setWikiQueryRunning] = React.useState(false);
  const [wikiQueryResult, setWikiQueryResult] = React.useState<WikiQueryParsed | null>(null);
  const [wikiQueryIncludeTickets, setWikiQueryIncludeTickets] = React.useState(true);
  const [wikiQueryIncludeHandoffs, setWikiQueryIncludeHandoffs] = React.useState(true);
  const [sourcesOpen, setSourcesOpen] = React.useState(true);
  const [metricsActionKey, setMetricsActionKey] = React.useState("");
  const [metricsError, setMetricsError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState("");
  const [recentProjects, setRecentProjects] = React.useState(() => readRecentProjects(projectRoot));
  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = React.useState<SettingsSection>(() => {
    const stored = initialSetting("autoflow.activeSettingsSection", "progress");
    if (stored === "logs") {
      return "snapshot";
    }
    if (stored === "general" || stored === "automation" || stored === "stop-hook" || stored === "watcher" || stored === "doctor") {
      return "progress";
    }
    return settingsNavigation.some((item) => item.key === stored) ? (stored as SettingsSection) : "progress";
  });
  const projectSwitcherRef = React.useRef<HTMLDivElement>(null);
  const previousSettingsSectionRef = React.useRef<SettingsSection>(activeSettingsSection);

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder.trim() || fallbackFlowFolder }),
    [defaultFlowFolder, projectRoot]
  );
  const autoRefreshInFlightRef = React.useRef(false);

  const selectRunner = React.useCallback((runnerId: string) => {
    setSelectedRunnerId((current) => (current === runnerId ? current : runnerId));
  }, []);

  const selectSettingsSection = React.useCallback((section: SettingsSection) => {
    window.localStorage.setItem("autoflow.activeSettingsSection", section);
    setProjectMenuOpen(false);
    setActiveSettingsSection(section);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    Promise.all([window.autoflow.getConfig(), window.autoflow.listInstalledAgentProfiles()])
      .then(([config, profiles]) => {
        const configuredBoardDirName = config.defaultBoardDirName || fallbackFlowFolder;
        if (isMounted && !window.localStorage.getItem("autoflow.boardDirName")) {
          setDefaultFlowFolder(configuredBoardDirName);
        }
        if (isMounted) {
          setInstalledAgentProfiles(profiles || {});
        }
      })
      .catch(() => {
        if (isMounted) {
          setDefaultFlowFolder(fallbackFlowFolder);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const loadBoard = React.useCallback(
    async (targetOptions = options) => {
      window.localStorage.setItem("autoflow.boardDirName", targetOptions.boardDirName);
      window.localStorage.setItem("autoflow.projectRoot", targetOptions.projectRoot);

      if (!targetOptions.projectRoot) {
        setBoard(null);
        setLastUpdated("");
        setIsBoardLoading(false);
        setIsPageRefreshing(false);
        setSetupError("");
        setRunnerError("");
        setWikiError("");
        setMetricsError("");
        return;
      }

      setIsPageRefreshing(true);
      try {
        const snapshot = await window.autoflow.readBoard(targetOptions);
        setBoard(snapshot);
        setSetupError("");
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        setBoard(null);
        setSetupError(error instanceof Error ? error.message : "Autoflow 상태를 확인하지 못했습니다.");
      } finally {
        setIsBoardLoading(false);
        setIsPageRefreshing(false);
      }
    },
    [options]
  );

  React.useEffect(() => {
    setBoard(null);
    setLastUpdated("");
    setIsBoardLoading(Boolean(options.projectRoot));
  }, [options.boardDirName, options.projectRoot]);

  React.useEffect(() => {
    if (!options.projectRoot) {
      void loadBoard();
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

    void refreshSnapshot();

    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadBoard, options.projectRoot]);

  useAutomaticWikiUpdate(board, options, loadBoard, setWikiError);

  const runWikiQuery = React.useCallback(async () => {
    if (!options.projectRoot || wikiQueryRunning) return;
    const terms = wikiQueryInput
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    if (terms.length === 0) {
      setWikiError("검색어를 한 개 이상 입력하세요.");
      return;
    }
    setWikiError("");
    setWikiQueryRunning(true);
    try {
      const result = await window.autoflow.controlWiki({
        action: "query",
        terms,
        limit: 10,
        includeTickets: wikiQueryIncludeTickets,
        includeHandoffs: wikiQueryIncludeHandoffs,
        ...options
      });
      if (!result.ok) {
        setWikiError(result.stderr || result.stdout || "위키 검색에 실패했습니다.");
        setWikiQueryResult(null);
        return;
      }
      const parsed = parseWikiQueryOutput(result.stdout);
      if (parsed.status === "blocked") {
        const reason = parsed.reason || "no_results";
        setWikiError(`위키 검색이 차단되었습니다 (${reason}).`);
        setWikiQueryResult(null);
        return;
      }
      const boardRoot = board?.boardRoot || `${options.projectRoot}/${options.boardDirName}`;
      const separator = boardRoot.includes("\\") ? "\\" : "/";
      const absResults = parsed.results.map((entry) => ({
        ...entry,
        path: `${boardRoot}${separator}${entry.path}`
      }));
      setWikiQueryResult({ ...parsed, results: absResults });
    } catch (error) {
      setWikiError(error instanceof Error ? error.message : "위키 검색에 실패했습니다.");
      setWikiQueryResult(null);
    } finally {
      setWikiQueryRunning(false);
    }
  }, [
    board,
    options,
    wikiQueryIncludeHandoffs,
    wikiQueryIncludeTickets,
    wikiQueryInput,
    wikiQueryRunning
  ]);

  React.useEffect(() => {
    const runners = board?.runners || [];
    setRunnerDrafts((previous) => {
      const next: Record<string, RunnerDraft> = {};
      for (const runner of runners) {
        const runnerDraft = {
          agent: runner.agent || "codex",
          model: runner.model || "",
          reasoning: runner.reasoning || "",
          mode: runner.mode || "loop",
          intervalSeconds: runner.intervalSeconds || "60",
          enabled: runner.enabled || "true",
          command: runner.command || ""
        };
        const previousDraft = previous[runner.id];
        const previousIsDirty = previousDraft
          ? previousDraft.agent !== runnerDraft.agent ||
            previousDraft.model !== runnerDraft.model ||
            previousDraft.reasoning !== runnerDraft.reasoning ||
            previousDraft.mode !== runnerDraft.mode ||
            previousDraft.intervalSeconds !== runnerDraft.intervalSeconds ||
            previousDraft.enabled !== runnerDraft.enabled ||
            previousDraft.command !== runnerDraft.command
          : false;
        const baseDraft = previousDraft && (runnerActionKey || previousIsDirty) ? previousDraft : runnerDraft;
        const normalized = normalizeRunnerSelections(
          baseDraft.agent || "codex",
          baseDraft.model || "",
          baseDraft.reasoning || "",
          installedAgentProfiles
        );
        next[runner.id] =
          {
            ...baseDraft,
            model: normalized.model,
            reasoning: normalized.reasoning
          };
      }
      return next;
    });
  }, [board?.runners, installedAgentProfiles, runnerActionKey]);

  React.useEffect(() => {
    const runners = board?.runners || [];
    if (!runners.length) {
      setSelectedRunnerId("");
      return;
    }

    if (!selectedRunnerId || !runners.some((runner) => runner.id === selectedRunnerId)) {
      setSelectedRunnerId(runners[0].id);
    }
  }, [board?.runners, selectedRunnerId]);

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
    if (
      previousSettingsSectionRef.current === "knowledge" &&
      activeSettingsSection !== "knowledge"
    ) {
      setSelectedLogPath("");
      setLogPreview(null);
      setLogError("");
    }

    previousSettingsSectionRef.current = activeSettingsSection;
  }, [activeSettingsSection]);

  const chooseProjectRoot = React.useCallback((selected: string) => {
    const normalized = selected.trim();
    if (!normalized) {
      return;
    }

    if (normalized !== options.projectRoot) {
      setIsBoardLoading(true);
    }
    setProjectRoot(normalized);
    setProjectMenuOpen(false);
    setRecentProjects((current) => {
      const next = normalizeProjectList([normalized, ...current]);
      persistRecentProjects(next);
      return next;
    });
  }, [options.projectRoot]);

  const browseProject = React.useCallback(async () => {
    setProjectMenuOpen(false);
    const selected = await window.autoflow.selectProject();
    if (selected) {
      chooseProjectRoot(selected);
    }
  }, [chooseProjectRoot]);

  React.useEffect(() => {
    if (!projectMenuOpen) {
      return undefined;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && projectSwitcherRef.current?.contains(target)) {
        return;
      }

      setProjectMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [projectMenuOpen]);

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
      chooseProjectRoot(root);
      setIsInstalling(true);
      setSetupError("");
      try {
        const result = await window.autoflow.installBoard(targetOptions);
        if (!result.ok) {
          setSetupError(result.stderr || "설치에 실패했습니다.");
          return;
        }

        await loadBoard(targetOptions);
      } finally {
        setIsInstalling(false);
      }
    },
    [chooseProjectRoot, defaultFlowFolder, isInstalling, loadBoard, options.projectRoot]
  );

  const controlRunner = React.useCallback(
    async (action: "start" | "stop" | "restart", runnerId: string) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const actionKey = `${action}:${runnerId}`;
      selectRunner(runnerId);
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const runner = (board?.runners || []).find((candidate) => candidate.id === runnerId);
        if (runner && (action === "start" || action === "restart")) {
          const draft = runnerDrafts[runner.id] || {
            agent: runner.agent || "codex",
            model: runner.model || "",
            reasoning: runner.reasoning || "",
            mode: runner.mode || "loop",
            intervalSeconds: runner.intervalSeconds || "60",
            enabled: runner.enabled || "true",
            command: runner.command || ""
          };
          const normalized = normalizeRunnerSelections(draft.agent, draft.model, draft.reasoning, installedAgentProfiles);
          const needsLoopNormalization =
            (runner.mode || "loop") !== "loop" ||
            (runner.enabled || "true") !== "true" ||
            draft.agent !== (runner.agent || "codex") ||
            normalized.model !== (runner.model || "") ||
            normalized.reasoning !== (runner.reasoning || "");

          if (needsLoopNormalization) {
            const configResult = await window.autoflow.configureRunner({
              runnerId,
              ...options,
              config: {
                agent: draft.agent,
                model: normalized.model,
                reasoning: normalized.reasoning,
                mode: "loop",
                interval_seconds: "60",
                enabled: "true",
                command: draft.command
              }
            });

            if (!configResult.ok) {
              setRunnerError(configResult.stderr || configResult.stdout || "AI 설정 저장에 실패했습니다.");
              return;
            }
          }
        }

        const result = await window.autoflow.controlRunner({
          action,
          runnerId,
          ...options
        });
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "AI 작업에 실패했습니다.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [board?.runners, installedAgentProfiles, loadBoard, options, runnerActionKey, runnerDrafts, selectRunner]
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
          setLogError(result.stderr || "파일 미리보기에 실패했습니다.");
          return;
        }

        setLogPreview(result);
      } finally {
        setIsReadingLog(false);
      }
    },
    [options]
  );

  const readWikiLog = React.useCallback(
    async (filePath: string) => {
      if (!filePath) {
        return;
      }
      await readLog(filePath);
    },
    [readLog]
  );

  const runRunner = React.useCallback(
    async (runner: AutoflowRunner, dryRun = false) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const actionKey = `${dryRun ? "dry-run" : "run"}:${runner.id}`;
      selectRunner(runner.id);
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.runRole({
          role: runRoleForRunner(runner.role),
          runnerId: runner.id,
          dryRun,
          ...options
        });
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "AI 1회 실행에 실패했습니다.");
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
    [loadBoard, options, readLog, runnerActionKey, selectRunner]
  );

  const updateRunnerDraft = React.useCallback((runnerId: string, field: keyof RunnerDraft, value: string) => {
    setRunnerDrafts((current) => {
      const existing = {
        agent: current[runnerId]?.agent || "codex",
        model: current[runnerId]?.model || "",
        reasoning: current[runnerId]?.reasoning || "",
        mode: current[runnerId]?.mode || "loop",
        intervalSeconds: current[runnerId]?.intervalSeconds || "60",
        enabled: current[runnerId]?.enabled || "true",
        command: current[runnerId]?.command || ""
      };

      if (field === "agent") {
        const normalized = normalizeRunnerSelections(value, "", "", installedAgentProfiles);
        return {
          ...current,
          [runnerId]: {
            ...existing,
            agent: value,
            model: normalized.model,
            reasoning: normalized.reasoning
          }
        };
      }

      return {
        ...current,
        [runnerId]: {
          ...existing,
          [field]: value
        }
      };
    });
  }, [installedAgentProfiles]);

  const saveRunnerConfig = React.useCallback(
    async (runner: AutoflowRunner) => {
      if (!options.projectRoot || runnerActionKey) {
        return;
      }

      const draft = runnerDrafts[runner.id] || {
        agent: runner.agent || "codex",
        model: runner.model || "",
        reasoning: runner.reasoning || "",
        mode: runner.mode || "loop",
        intervalSeconds: runner.intervalSeconds || "60",
        enabled: runner.enabled || "true",
        command: runner.command || ""
      };
      const normalized = normalizeRunnerSelections(draft.agent, draft.model, draft.reasoning, installedAgentProfiles);
      const actionKey = `config:${runner.id}`;
      selectRunner(runner.id);
      setRunnerActionKey(actionKey);
      setRunnerError("");
      try {
        const result = await window.autoflow.configureRunner({
          runnerId: runner.id,
          ...options,
          config: {
            agent: draft.agent,
            model: normalized.model,
            reasoning: normalized.reasoning,
            mode: "loop",
            interval_seconds: "60",
            enabled: "true",
            command: draft.command
          }
        });
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "AI 설정 저장에 실패했습니다.");
        }

        await loadBoard();
      } finally {
        setRunnerActionKey("");
      }
    },
    [installedAgentProfiles, loadBoard, options, runnerActionKey, runnerDrafts, selectRunner]
  );

  const writeMetricsSnapshot = React.useCallback(async () => {
    if (!options.projectRoot || metricsActionKey) {
      return;
    }

    setMetricsActionKey("write");
    setMetricsError("");
    try {
      const result = await window.autoflow.writeMetricsSnapshot(options);
      if (!result.ok) {
        setMetricsError(result.stderr || result.stdout || "지표 스냅샷 저장에 실패했습니다.");
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
  }, [loadBoard, metricsActionKey, options, readLog]);

  const boardExists = Boolean(board?.exists);
  const showInstallButton = Boolean(options.projectRoot && (isInstalling || (board && !board.exists)));
  const ticketTotal = countTickets(board);
  const projectLabel = options.projectRoot ? basename(options.projectRoot) : "프로젝트 없음";
  const selectedSettingsItem =
    settingsNavigation.find((item) => item.key === activeSettingsSection) || settingsNavigation[0];

  return (
    <div className="viewer-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <main className="workspace-layout">
        <section className="settings-page" aria-label="Autoflow">
          <aside className="settings-nav" aria-label="메뉴">
            <nav className="settings-nav-list" aria-label="Autoflow 메뉴">
              {settingsNavigation.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`settings-nav-item${activeSettingsSection === key ? " settings-nav-item-active" : ""}`}
                  aria-current={activeSettingsSection === key ? "page" : undefined}
                  title={label}
                  onClick={() => selectSettingsSection(key)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="settings-nav-footer">
              <div className="toolbar-project-controls" ref={projectSwitcherRef}>
                <Button
                  variant="outline"
                  className="footer-project-button"
                  title={options.projectRoot || "프로젝트 폴더 선택"}
                  aria-expanded={projectMenuOpen}
                  onClick={() => setProjectMenuOpen((current) => !current)}
                >
                  {isBoardLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                  <span>{options.projectRoot ? projectLabel : "프로젝트 폴더 선택"}</span>
                </Button>
                {showInstallButton ? (
                  <Button
                    variant="outline"
                    className="footer-project-install-button"
                    title="설치"
                    aria-label="설치"
                    data-tooltip="설치"
                    disabled={isInstalling}
                    onClick={() => void installFlow()}
                  >
                    {isInstalling ? "설치 중" : "설치"}
                  </Button>
                ) : null}
                {projectMenuOpen ? (
                  <div className="project-menu" role="menu" aria-label="최근 프로젝트">
                    <div className="project-menu-kicker">최근</div>
                    <div className="project-menu-list">
                      {recentProjects.map((project) => {
                        const selected = project === options.projectRoot;
                        return (
                          <button
                            key={project}
                            type="button"
                            className="project-menu-item"
                            title={project}
                            role="menuitem"
                            onClick={() => chooseProjectRoot(project)}
                          >
                            <span>{basename(project)}</span>
                            {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="project-menu-separator" />
                    <button type="button" className="project-menu-item project-menu-open" role="menuitem" onClick={browseProject}>
                      <span>폴더 열기...</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section
            className="settings-content settings-content-progress"
            aria-label={`${selectedSettingsItem.label} 화면`}
          >
            <div className="settings-content-header">
              <div className="settings-title-group">
                <h1>{selectedSettingsItem.label}</h1>
              </div>
              <div className="settings-title-status" aria-live="polite">
                {isPageRefreshing ? (
                  <Loader2 className="page-refresh-spinner h-4 w-4 animate-spin" aria-label="페이지 갱신 중" />
                ) : null}
                <span className="content-updated-at">
                  {lastUpdated ? `마지막 업데이트 ${formatDate(lastUpdated)}` : "미표기"}
                </span>
              </div>
            </div>
            <div className="settings-content-body">
              {setupError ? (
                <p className="setup-error" role="alert">
                  {setupError}
                </p>
              ) : null}

              {activeSettingsSection === "progress" && (
                <section className="dashboard-area" aria-label="Autoflow 진행 상태">
                  <section className="board-section board-section-flush" aria-label="코덱스 작업 흐름">
                    {runnerError ? <div className="runner-error">{runnerError}</div> : null}
                    <WorkflowStatStrip board={board} />
                    <TicketBoard
                      board={board}
                      installedAgentProfiles={installedAgentProfiles}
                      selectedPath={selectedLogPath}
                      onSelect={readLog}
                      options={options}
                      actionKey={runnerActionKey}
                      drafts={runnerDrafts}
                      onSelectRunner={selectRunner}
                      onControl={controlRunner}
                      onDraftChange={updateRunnerDraft}
                      onConfigure={saveRunnerConfig}
                    />
                  </section>
                </section>
              )}

              {activeSettingsSection === "kanban" && (
                <section className="dashboard-area" aria-label="티켓 정보">
                  <section className="board-section board-section-flush" aria-label="티켓 정보 보드">
                    <TicketKanban board={board} options={options} />
                  </section>
                </section>
              )}

              {activeSettingsSection === "knowledge" && (
                <section className="dashboard-area" aria-label="Wiki">
                  <section className="board-section board-section-flush" aria-label="Wiki 본문">
                    <PageLayout
                      className="knowledge-page"
                    >
                      <div className="knowledge-split">
                        <div className="tool-panel knowledge-list-pane">
                          {wikiError ? <div className="knowledge-error">{wikiError}</div> : null}
                          <WikiQueryPanel
                            query={wikiQueryInput}
                            onQueryChange={setWikiQueryInput}
                            onSubmit={runWikiQuery}
                            isRunning={wikiQueryRunning}
                            result={wikiQueryResult}
                            selectedPath={selectedLogPath}
                            onSelect={readWikiLog}
                            includeTickets={wikiQueryIncludeTickets}
                            onIncludeTicketsChange={setWikiQueryIncludeTickets}
                            includeHandoffs={wikiQueryIncludeHandoffs}
                            onIncludeHandoffsChange={setWikiQueryIncludeHandoffs}
                          />
                          <div className="knowledge-stack">
                            <WikiList board={board} selectedPath={selectedLogPath} onSelect={readWikiLog} />
                            <section className="knowledge-sources" aria-label="Sources">
                              <button
                                type="button"
                                className="panel-subheading knowledge-sources-toggle"
                                onClick={() => setSourcesOpen((prev) => !prev)}
                                aria-expanded={sourcesOpen}
                              >
                                <ChevronDown className={`h-4 w-4 knowledge-sources-chevron${sourcesOpen ? "" : " knowledge-sources-chevron-closed"}`} aria-hidden="true" />
                                <span>Sources</span>
                              </button>
                              {sourcesOpen && (
                                <HandoffList board={board} selectedPath={selectedLogPath} onSelect={readWikiLog} />
                              )}
                            </section>
                          </div>
                        </div>
                        <div
                          className="knowledge-preview-pane"
                        >
                          <LogPreview
                            preview={logPreview}
                            isLoading={isReadingLog}
                            error={logError}
                          />
                        </div>
                      </div>
                    </PageLayout>
                  </section>
                </section>
              )}

            {activeSettingsSection === "snapshot" && (
              <section className="dashboard-area" aria-label="통계">
                <section className="board-section board-section-flush" aria-label="통계 본문">
                  <PageLayout
                    className="snapshot-page"
                    header={
                      <div className="snapshot-page-toolbar">
                        <div className="workflow-pin-layer-heading">
                          <BarChart3 className="h-4 w-4" aria-hidden="true" />
                          <strong>Report</strong>
                        </div>
                        <div className="snapshot-actions">
                          <Button
                            variant="outline"
                            size="icon"
                            className="snapshot-action-button"
                            title="지표 스냅샷 저장"
                            aria-label="지표 스냅샷 저장"
                            data-tooltip="지표 스냅샷 저장"
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
                            {boardExists ? "추적 중" : "없음"}
                          </Badge>
                        </div>
                      </div>
                    }
                  >
                    <div className="snapshot-panel report-panel">
                      {metricsError ? <div className="snapshot-error">{metricsError}</div> : null}
                      <ReportingDashboard board={board} lastUpdated={lastUpdated} ticketTotal={ticketTotal} />
                      <BoardSearch
                        board={board}
                        query={boardSearch}
                        selectedPath={selectedLogPath}
                        onQueryChange={setBoardSearch}
                        onSelect={readLog}
                      />
                      <MetricsHistory board={board} selectedPath={selectedLogPath} onSelect={readLog} />
                      <div className="snapshot-subsection">
                        <div className="section-heading compact">
                          <div>
                            <div className="section-kicker">이력</div>
                            <h3>최근 로그</h3>
                          </div>
                          <Clock3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <LogList board={board} selectedPath={selectedLogPath} onSelect={readLog} />
                      </div>
                      <LogPreview preview={logPreview} isLoading={isReadingLog} error={logError} />
                    </div>
                  </PageLayout>
                </section>
              </section>
            )}

            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function EssentialApp() {
  const [projectRoot, setProjectRoot] = React.useState(() => initialSetting("autoflow.projectRoot", ""));
  const [defaultFlowFolder, setDefaultFlowFolder] = React.useState(() =>
    initialSetting("autoflow.boardDirName", fallbackFlowFolder)
  );
  const [board, setBoard] = React.useState<AutoflowBoardSnapshot | null>(null);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [installedAgentProfiles, setInstalledAgentProfiles] = React.useState<InstalledAgentProfiles>({});
  const [setupError, setSetupError] = React.useState("");
  const [selectedLogPath, setSelectedLogPath] = React.useState("");
  const [logPreview, setLogPreview] = React.useState<AutoflowFileContentResult | null>(null);
  const [isReadingLog, setIsReadingLog] = React.useState(false);
  const [logError, setLogError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState("");
  const [recentProjects, setRecentProjects] = React.useState(() => readRecentProjects(projectRoot));
  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const projectSwitcherRef = React.useRef<HTMLDivElement>(null);
  const autoRefreshInFlightRef = React.useRef(false);

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder.trim() || fallbackFlowFolder }),
    [defaultFlowFolder, projectRoot]
  );

  const loadBoard = React.useCallback(
    async (targetOptions = options) => {
      window.localStorage.setItem("autoflow.boardDirName", targetOptions.boardDirName);
      window.localStorage.setItem("autoflow.projectRoot", targetOptions.projectRoot);

      if (!targetOptions.projectRoot) {
        setBoard(null);
        setLastUpdated("");
        setSetupError("");
        return;
      }

      try {
        const snapshot = await window.autoflow.readBoard(targetOptions);
        setBoard(snapshot);
        setSetupError("");
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        setBoard(null);
        setSetupError(error instanceof Error ? error.message : "Autoflow 상태를 확인하지 못했습니다.");
      }
    },
    [options]
  );

  React.useEffect(() => {
    let isMounted = true;

    Promise.all([window.autoflow.getConfig(), window.autoflow.listInstalledAgentProfiles()])
      .then(([config, profiles]) => {
        const configuredBoardDirName = config.defaultBoardDirName || fallbackFlowFolder;
        if (isMounted && !window.localStorage.getItem("autoflow.boardDirName")) {
          setDefaultFlowFolder(configuredBoardDirName);
        }
        if (isMounted) {
          setInstalledAgentProfiles(profiles || {});
        }
      })
      .catch(() => {
        if (isMounted) {
          setDefaultFlowFolder(fallbackFlowFolder);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    setBoard(null);
    setLastUpdated("");
    setSelectedLogPath("");
    setLogPreview(null);
    setLogError("");
  }, [options.boardDirName, options.projectRoot]);

  React.useEffect(() => {
    if (!options.projectRoot) {
      void loadBoard();
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

    void refreshSnapshot();

    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadBoard, options.projectRoot]);

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

  const chooseProjectRoot = React.useCallback((selected: string) => {
    const normalized = selected.trim();
    if (!normalized) {
      return;
    }

    setProjectRoot(normalized);
    setProjectMenuOpen(false);
    setRecentProjects((current) => {
      const next = normalizeProjectList([normalized, ...current]);
      persistRecentProjects(next);
      return next;
    });
  }, []);

  const browseProject = React.useCallback(async () => {
    setProjectMenuOpen(false);
    const selected = await window.autoflow.selectProject();
    if (selected) {
      chooseProjectRoot(selected);
    }
  }, [chooseProjectRoot]);

  React.useEffect(() => {
    if (!projectMenuOpen) {
      return undefined;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && projectSwitcherRef.current?.contains(target)) {
        return;
      }

      setProjectMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [projectMenuOpen]);

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
      chooseProjectRoot(root);
      setIsInstalling(true);
      setSetupError("");
      try {
        const result = await window.autoflow.installBoard(targetOptions);
        if (!result.ok) {
          setSetupError(result.stderr || "설치에 실패했습니다.");
          return;
        }

        await loadBoard(targetOptions);
      } finally {
        setIsInstalling(false);
      }
    },
    [chooseProjectRoot, defaultFlowFolder, isInstalling, loadBoard, options.projectRoot]
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
          setLogError(result.stderr || "파일 미리보기에 실패했습니다.");
          return;
        }

        setLogPreview(result);
      } finally {
        setIsReadingLog(false);
      }
    },
    [options]
  );

  const boardExists = Boolean(board?.exists);
  const projectLabel = options.projectRoot ? basename(options.projectRoot) : "프로젝트 없음";
  const boardStatusLabel = !options.projectRoot ? "프로젝트 없음" : boardExists ? "추적 중" : "설정 필요";
  const boardStatusVariant = boardExists ? "default" : options.projectRoot ? "destructive" : "secondary";

  return (
    <div className="viewer-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <main className="workspace-layout">
        <section className="essential-page" aria-label="Autoflow">
          <header className="essential-topbar">
            <div className="toolbar-project-controls essential-project-controls" ref={projectSwitcherRef}>
              <Button
                variant="outline"
                className="footer-project-button"
                title={options.projectRoot || "프로젝트 폴더 선택"}
                aria-expanded={projectMenuOpen}
                onClick={() => setProjectMenuOpen((current) => !current)}
              >
                <FolderOpen className="h-4 w-4" />
                <span>{options.projectRoot ? projectLabel : "프로젝트 폴더 선택"}</span>
              </Button>
              {projectMenuOpen ? (
                <div className="project-menu" role="menu" aria-label="최근 프로젝트">
                  <div className="project-menu-kicker">최근</div>
                  <div className="project-menu-list">
                    {recentProjects.map((project) => {
                      const selected = project === options.projectRoot;
                      return (
                        <button
                          key={project}
                          type="button"
                          className="project-menu-item"
                          title={project}
                          role="menuitem"
                          onClick={() => chooseProjectRoot(project)}
                        >
                          <span>{basename(project)}</span>
                          {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="project-menu-separator" />
                  <button type="button" className="project-menu-item project-menu-open" role="menuitem" onClick={browseProject}>
                    <span>폴더 열기...</span>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="essential-topbar-actions">
              {options.projectRoot && !boardExists ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="essential-setup-button"
                  disabled={isInstalling}
                  onClick={() => void installFlow()}
                >
                  {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                  <span>설치</span>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                className="essential-icon-button"
                title="새로고침"
                aria-label="새로고침"
                data-tooltip="새로고침"
                disabled={!options.projectRoot}
                onClick={() => void loadBoard()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <section className="essential-content" aria-label="진행 상태 화면">
            <div className="essential-title-row">
              <div>
                <div className="section-kicker">Autoflow</div>
                <h1>진행 상태</h1>
              </div>
              <div className="essential-status">
                <Badge variant={boardStatusVariant}>{boardStatusLabel}</Badge>
                <span>{lastUpdated ? `마지막 업데이트 ${formatDate(lastUpdated)}` : "미표기"}</span>
              </div>
            </div>

            {setupError ? (
              <p className="setup-error" role="alert">
                {setupError}
              </p>
            ) : null}

            {!options.projectRoot ? (
              <section className="essential-empty" aria-label="프로젝트 선택">
                <FolderOpen className="h-5 w-5" aria-hidden="true" />
                <h2>프로젝트 선택</h2>
                <Button className="essential-primary-button" onClick={browseProject}>
                  <FolderOpen className="h-4 w-4" />
                  <span>폴더 열기</span>
                </Button>
              </section>
            ) : !boardExists ? (
              <section className="essential-empty" aria-label="Autoflow 설치">
                <FolderPlus className="h-5 w-5" aria-hidden="true" />
                <h2>Autoflow 설정</h2>
                <Button className="essential-primary-button" disabled={isInstalling} onClick={() => void installFlow()}>
                  {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                  <span>설치</span>
                </Button>
              </section>
            ) : (
              <section className="dashboard-area" aria-label="Autoflow 진행 상태">
                <section className="board-section board-section-flush" aria-label="코덱스 작업 흐름">
                  <div className="section-heading">
                    <div>
                      <h3>작업 흐름</h3>
                    </div>
                  </div>
                  <WorkflowStatStrip board={board} />
                  <TicketBoard
                    board={board}
                    installedAgentProfiles={installedAgentProfiles}
                    selectedPath={selectedLogPath}
                    onSelect={readLog}
                    options={options}
                  />
                </section>

                <section className="lower-grid essential-inspector-grid" aria-label="코덱스 진행 로그">
                  <div className="tool-panel">
                    <div className="section-heading compact">
                      <div>
                        <div className="section-kicker">이력</div>
                        <h3>최근 로그</h3>
                      </div>
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <LogList board={board} selectedPath={selectedLogPath} onSelect={readLog} />
                  </div>

                  <div className="tool-panel essential-preview-panel">
                    <LogPreview preview={logPreview} isLoading={isReadingLog} error={logError} />
                  </div>
                </section>
              </section>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function RunnerConfigControls({
  runner,
  installedAgentProfiles,
  actionKey,
  draft,
  canEditConfig,
  onSelectRunner,
  onDraftChange,
  onConfigure,
  showAgent = true,
  className = "runner-config"
}: {
  runner: AutoflowRunner;
  installedAgentProfiles: InstalledAgentProfiles;
  actionKey: string;
  draft: RunnerDraft;
  canEditConfig: boolean;
  onSelectRunner: (runnerId: string) => void;
  onDraftChange: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure: (runner: AutoflowRunner) => void;
  showAgent?: boolean;
  className?: string;
}) {
  const normalized = normalizeRunnerSelections(draft.agent, draft.model, draft.reasoning, installedAgentProfiles);
  const modelChoices = normalized.modelChoices;
  const reasoningChoices = normalized.reasoningChoices;
  const modelSelectDisabled = Boolean(actionKey) || !canEditConfig || modelChoices.length === 0;
  const reasoningSelectDisabled =
    Boolean(actionKey) || !canEditConfig || !normalized.supportsReasoning || reasoningChoices.length === 0;
  const reasoningSelectValue = normalized.supportsReasoning && reasoningChoices.length ? normalized.reasoning : "unsupported";
  const agentOptions = runnerAgentOptions.includes(draft.agent as (typeof runnerAgentOptions)[number])
    ? runnerAgentOptions
    : [draft.agent, ...runnerAgentOptions];
  const hasDraftChanges =
    draft.agent !== (runner.agent || "codex") ||
    normalized.model !== (runner.model || "") ||
    normalized.reasoning !== (runner.reasoning || "") ||
    (runner.mode || "loop") !== "loop" ||
    (runner.intervalSeconds || "60") !== "60" ||
    (runner.enabled || "true") !== "true" ||
    draft.command !== (runner.command || "");
  const isWorking = actionKey.endsWith(`:${runner.id}`);

  return (
    <div className={`${className}${showAgent ? "" : " runner-config-no-agent"}`}>
      {showAgent ? (
        <Select
          value={draft.agent}
          disabled={Boolean(actionKey) || !canEditConfig}
          onValueChange={(value) => {
            onSelectRunner(runner.id);
            onDraftChange(runner.id, "agent", value);
          }}
        >
          <SelectTrigger className="runner-select runner-agent-select" aria-label={`${runner.id} 에이전트`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agentOptions.map((agent) => (
              <SelectItem key={agent} value={agent}>
                {agent}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={modelChoices.length ? normalized.model : undefined}
        disabled={modelSelectDisabled}
        onValueChange={(value) => {
          onSelectRunner(runner.id);
          onDraftChange(runner.id, "model", value);
        }}
      >
        <SelectTrigger className="runner-select" aria-label={`${runner.id} 모델`}>
          <SelectValue placeholder="모델 없음" />
        </SelectTrigger>
        <SelectContent>
          {modelChoices.map((model) => (
            <SelectItem key={model} value={model}>
              {displayRunnerOption(draft.agent, model)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={reasoningSelectValue}
        disabled={reasoningSelectDisabled}
        onValueChange={(value) => {
          onSelectRunner(runner.id);
          onDraftChange(runner.id, "reasoning", value);
        }}
      >
        <SelectTrigger className="runner-select" aria-label={`${runner.id} 추론 강도`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {normalized.supportsReasoning ? (
            reasoningChoices.map((reasoning) => (
              <SelectItem key={reasoning} value={reasoning}>
                {displayRunnerOption(draft.agent, reasoning)}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="unsupported">{normalized.supportsReasoning ? "선택 없음" : "지원 안 함"}</SelectItem>
          )}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="runner-save-button"
        aria-label={`${runner.id} 저장`}
        disabled={!canEditConfig || !hasDraftChanges || Boolean(actionKey)}
        onClick={() => {
          onSelectRunner(runner.id);
          onConfigure(runner);
        }}
      >
        {isWorking && actionKey.startsWith("config:") ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>저장</span>
          </>
        ) : (
          <>
            <span>저장</span>
            {hasDraftChanges ? <span className="runner-save-dirty-dot" aria-hidden="true" /> : null}
          </>
        )}
      </Button>
    </div>
  );
}

function RunnerConsole({
  board,
  defaultBoardDirName,
  installedAgentProfiles,
  actionKey,
  error,
  drafts,
  selectedRunnerId,
  onSelectRunner,
  onControl,
  onReadLog,
  onDraftChange,
  onConfigure
}: {
  board: AutoflowBoardSnapshot | null;
  defaultBoardDirName: string;
  installedAgentProfiles: InstalledAgentProfiles;
  actionKey: string;
  error: string;
  drafts: Record<string, RunnerDraft>;
  selectedRunnerId: string;
  onSelectRunner: (runnerId: string) => void;
  onControl: (action: "start" | "stop" | "restart", runnerId: string) => void;
  onReadLog: (filePath: string) => void;
  onDraftChange: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure: (runner: AutoflowRunner) => void;
}) {
  const runners = (board?.runners || []).filter(
    (runner) =>
      runner.role === "ticket-owner" ||
      runner.role === "owner" ||
      runner.role === "planner" ||
      runner.role === "plan" ||
      runner.role === "wiki-maintainer" ||
      runner.role === "wiki" ||
      isCoordinatorRole(runner.role)
  );
  const runningCount = runners.filter((runner) => runner.stateStatus === "running" || Boolean(runner.pid)).length;
  const stoppedCount = runners.filter((runner) => (runner.stateStatus || "") === "stopped").length;
  const blockedCount = runners.filter(
    (runner) => (runner.activeStage || "").toLowerCase() === "blocked"
  ).length;

  return (
    <section className="runner-console" aria-label="Autoflow AI 설정">
      <PageLayout
        className="runner-console-page"
        header={
          <div className="runner-page-toolbar">
            <div className="runner-page-summary">
              <Badge variant="secondary">AI {runners.length}</Badge>
              <Badge variant={runningCount ? "default" : "secondary"}>실행 {runningCount}</Badge>
              {blockedCount ? <Badge variant="destructive">막힘 {blockedCount}</Badge> : null}
              <Badge variant="outline">중지 {stoppedCount}</Badge>
            </div>
            <span className="ticket-workspace-tab-copy">Plan AI / Impl AI / Wiki AI</span>
          </div>
        }
      >
        <div className="runner-section runner-console-body">
          {error ? <div className="runner-error">{error}</div> : null}

          <div className="runner-grid">
            {runners.length ? (
              runners.map((runner) => {
            const enabled = runnerIsEnabled(runner.enabled);
            const status = runner.stateStatus || "idle";
            const mode = "loop";
            const intervalLabel = runner.intervalSeconds || runner.intervalEffectiveSeconds || "60";
            const isWorking = actionKey.endsWith(`:${runner.id}`);
            const canStart = mode === "loop";
            const canStop = status === "running" || Boolean(runner.pid);
            const canEditConfig = status !== "running";
            const draft = drafts[runner.id] || {
              agent: runner.agent || "codex",
              model: runner.model || "",
              reasoning: runner.reasoning || "",
              mode,
              intervalSeconds: runner.intervalSeconds || "60",
              enabled: runner.enabled || "true",
              command: runner.command || ""
            };
            const doctorId = runnerDoctorId(runner.id);
            const roleHealth = board?.doctor[`check.${doctorId}_role`] || "";
            const adapterHealth = board?.doctor[`check.${doctorId}_adapter`] || "";
            const enabledHealth = board?.doctor[`check.${doctorId}_enabled`] || "";
            const modeHealth = board?.doctor[`check.${doctorId}_mode`] || "";
            const intervalHealth = board?.doctor[`check.${doctorId}_interval`] || "";
            const pidHealth = board?.doctor[`check.${doctorId}_pid`] || "";
            const showRoleHealth = runnerHealthNeedsAttention(roleHealth);
            const showAdapterHealth = enabled || runnerHealthNeedsAttention(adapterHealth);
            const showEnabledHealth = runnerHealthNeedsAttention(enabledHealth);
            const showModeHealth = Boolean(modeHealth) && (enabled || runnerHealthNeedsAttention(modeHealth));
            const showIntervalHealth = Boolean(intervalHealth) && (enabled || runnerHealthNeedsAttention(intervalHealth));
            const showPidHealth = Boolean(runner.pid) || runnerHealthNeedsAttention(pidHealth);
            const runnerEventRaw = runner.activeItem || runner.lastResult || "이벤트 없음";
            const runnerEvent = isMachineRunnerLog(runnerEventRaw) ? "이벤트 없음" : runnerEventRaw;
            const selected = selectedRunnerId === runner.id;
            return (
              <article
                key={runner.id}
                className={`runner-row${selected ? " runner-row-selected" : ""}`}
                aria-current={selected ? "true" : undefined}
                onFocusCapture={() => onSelectRunner(runner.id)}
                onPointerDown={() => onSelectRunner(runner.id)}
              >
                <div className={`runner-status-dot ${runnerStatusTone(status)}`} aria-hidden="true" />
                <div className="runner-topbar">
                  <div className="runner-main">
                    <div className="runner-title-line">
                      <strong>{displayWorkflowRunnerId(runner.id)}</strong>
                    </div>
                    <span>
                      {runner.agent || "에이전트"} {runner.model ? `- ${runner.model}` : ""} - 반복 실행 / {intervalLabel}s
                    </span>
                    <div className="runner-health-line">
                      {showRoleHealth ? (
                        <span className={`runner-health-pill ${runnerHealthTone(roleHealth)}`}>
                          역할 {displayStatus(roleHealth)}
                        </span>
                      ) : null}
                      {showAdapterHealth ? (
                        <span className={`runner-health-pill ${runnerHealthTone(adapterHealth)}`}>
                          어댑터 {displayStatus(adapterHealth)}
                        </span>
                      ) : null}
                      {showEnabledHealth ? (
                        <span className={`runner-health-pill ${runnerHealthTone(enabledHealth)}`}>
                          사용 {displayStatus(enabledHealth)}
                        </span>
                      ) : null}
                      {showModeHealth ? (
                        <span className={`runner-health-pill ${runnerHealthTone(modeHealth)}`}>
                          모드 {displayStatus(modeHealth)}
                        </span>
                      ) : null}
                      {showIntervalHealth ? (
                        <span className={`runner-health-pill ${runnerHealthTone(intervalHealth)}`}>
                          주기 {displayStatus(intervalHealth)}
                        </span>
                      ) : null}
                      {showPidHealth ? (
                        <span className={`runner-health-pill ${runnerHealthTone(pidHealth)}`}>
                          PID {displayStatus(pidHealth)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="runner-actions">
                    {canStop ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="runner-icon-button runner-plain-icon-button"
                        title="중지"
                        data-tooltip="중지"
                        aria-label={`${runner.id} 중지`}
                        disabled={Boolean(actionKey)}
                        onClick={() => {
                          onSelectRunner(runner.id);
                          onControl("stop", runner.id);
                        }}
                      >
                        {isWorking && actionKey.startsWith("stop:") ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        className="runner-icon-button runner-plain-icon-button"
                        title={mode === "loop" ? "시작" : "반복 모드에서만 시작할 수 있습니다"}
                        data-tooltip={mode === "loop" ? "시작" : "반복 모드에서만 시작할 수 있습니다"}
                        aria-label={`${runner.id} 시작`}
                        disabled={!canStart || Boolean(actionKey)}
                        onClick={() => {
                          onSelectRunner(runner.id);
                          onControl("start", runner.id);
                        }}
                      >
                        {isWorking && actionKey.startsWith("start:") ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="runner-details">
                  <div className="runner-state">
                    <strong>{displayStatus(status)}</strong>
                    <span>{runnerEvent}</span>
                    {runner.lastLogLine ? (
                      <span className="runner-log-tail" title={runner.lastLogLine}>
                        {runner.lastLogLine}
                      </span>
                    ) : null}
                  </div>
                  <RunnerConfigControls
                    runner={runner}
                    installedAgentProfiles={installedAgentProfiles}
                    actionKey={actionKey}
                    draft={draft}
                    canEditConfig={canEditConfig}
                    onSelectRunner={onSelectRunner}
                    onDraftChange={onDraftChange}
                    onConfigure={onConfigure}
                  />
                </div>
              </article>
            );
              })
            ) : (
              <div className="ai-progress-empty runner-empty-state">
                <strong>AI가 없습니다</strong>
                <span>Plan AI(planner) / Impl AI(ticket-owner) / Wiki AI(wiki-maintainer) runner가 추가되면 여기에 표시됩니다.</span>
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    </section>
  );
}

function runnerConversationText(runner: AutoflowRunner) {
  return (runner.conversationPreview || runner.lastLogLine || "").trim();
}

function shouldShowConversation(runner: AutoflowRunner) {
  return Boolean(runnerConversationText(runner));
}

const ansiConverter = new AnsiToHtml({
  fg: "#1f2937",
  bg: "transparent",
  newline: false,
  escapeXML: true,
  colors: {
    0: "#1f2937",
    1: "#dc2626",
    2: "#16a34a",
    3: "#ca8a04",
    4: "#2563eb",
    5: "#9333ea",
    6: "#0891b2",
    7: "#4b5563",
    8: "#6b7280",
    9: "#ef4444",
    10: "#22c55e",
    11: "#eab308",
    12: "#3b82f6",
    13: "#a855f7",
    14: "#06b6d4",
    15: "#111827"
  }
});

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtmlText(value: string) {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

const LOG_TOKEN_REGEX = new RegExp(
  [
    "(?<ts>\\b\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?\\b)",
    "(?<date>\\b\\d{4}-\\d{2}-\\d{2}\\b)",
    "(?<time>\\b\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?\\b)",
    "(?<path>(?:~|\\.{0,2}\\/)[\\w./@\\-]+)",
    "(?<key>\\b[a-zA-Z][\\w\\-]*(?==))",
    "(?<str>\"[^\"\\n]*\"|'[^'\\n]*')",
    "(?<good>\\b(?:ok|ready|pass|passed|done|success|completed|merged|approved|enabled)\\b)",
    "(?<bad>\\b(?:error|errors|fail|failed|failure|blocked|reject|rejected|aborted|timeout|denied|fatal|panic)\\b)",
    "(?<warn>\\b(?:idle|pending|waiting|skipped|skip|warn|warning|stale|deprecated)\\b)",
    "(?<active>\\b(?:working|inprogress|in-progress|running|started|launching|starting)\\b)",
    "(?<num>\\b\\d+(?:\\.\\d+)?(?:ms|us|ns|s|kb|mb|gb)?\\b)"
  ].join("|"),
  "gi"
);

function highlightLogLine(line: string) {
  if (!line) return "";
  let result = "";
  let lastIndex = 0;
  LOG_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LOG_TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtmlText(line.slice(lastIndex, match.index));
    }
    const groups = match.groups || {};
    let cls = "";
    if (groups.ts || groups.date || groups.time) cls = "log-token-ts";
    else if (groups.path) cls = "log-token-path";
    else if (groups.key) cls = "log-token-key";
    else if (groups.str) cls = "log-token-str";
    else if (groups.good) cls = "log-token-good";
    else if (groups.bad) cls = "log-token-bad";
    else if (groups.warn) cls = "log-token-warn";
    else if (groups.active) cls = "log-token-active";
    else if (groups.num) cls = "log-token-num";
    if (cls) {
      result += `<span class="${cls}">${escapeHtmlText(match[0])}</span>`;
    } else {
      result += escapeHtmlText(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    result += escapeHtmlText(line.slice(lastIndex));
  }
  return result;
}

function highlightLogText(text: string) {
  const cleaned = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
  return cleaned.split("\n").map(highlightLogLine).join("\n");
}

const TYPING_TAIL_CHARS = 400;
const TYPING_TICK_MS = 16;
const TYPING_TARGET_CATCHUP_MS = 1500;
const conversationStreamTextCache = new Map<string, string>();

function initialConversationDisplayLength(streamId: string, text: string) {
  const cachedText = conversationStreamTextCache.get(streamId) || "";
  if (!text) return 0;
  if (!cachedText) return Math.max(0, text.length - TYPING_TAIL_CHARS);
  if (text === cachedText || cachedText.startsWith(text)) return text.length;
  if (text.startsWith(cachedText)) return cachedText.length;
  return text.length;
}

function ConversationStream({
  label,
  text,
  streamId = label
}: {
  label: string;
  text: string;
  streamId?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const previousTextRef = React.useRef(conversationStreamTextCache.get(streamId) || text);
  const [displayedLength, setDisplayedLength] = React.useState(() =>
    initialConversationDisplayLength(streamId, text)
  );

  React.useEffect(() => {
    const previous = previousTextRef.current;
    const cachedText = conversationStreamTextCache.get(streamId) || "";

    if (!cachedText) {
      if (text) {
        setDisplayedLength((current) => current || Math.max(0, text.length - TYPING_TAIL_CHARS));
      }
      conversationStreamTextCache.set(streamId, text);
      previousTextRef.current = text;
      return;
    }

    if (text === cachedText || cachedText.startsWith(text)) {
      setDisplayedLength(text.length);
    } else if (text.startsWith(previous)) {
      setDisplayedLength((current) => Math.min(text.length, Math.max(current, previous.length)));
    } else if (cachedText && text.startsWith(cachedText)) {
      setDisplayedLength(cachedText.length);
    } else {
      setDisplayedLength(text.length);
    }

    previousTextRef.current = text;
    conversationStreamTextCache.set(streamId, text);
  }, [streamId, text]);

  React.useEffect(() => {
    if (displayedLength >= text.length) return;
    const remaining = text.length - displayedLength;
    const charsPerTick = Math.max(
      1,
      Math.ceil((remaining * TYPING_TICK_MS) / TYPING_TARGET_CATCHUP_MS)
    );
    const id = window.setTimeout(() => {
      setDisplayedLength((current) => Math.min(text.length, current + charsPerTick));
    }, TYPING_TICK_MS);
    return () => window.clearTimeout(id);
  }, [text, displayedLength]);

  const visibleText = text.slice(0, displayedLength);

  const html = React.useMemo(() => {
    if (!visibleText) return "";
    try {
      return highlightLogText(visibleText);
    } catch {
      return escapeHtmlText(visibleText.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, ""));
    }
  }, [visibleText]);

  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="ai-progress-conversation"
      role="log"
      aria-live="polite"
      aria-label={label}
    >
      <pre dangerouslySetInnerHTML={{ __html: html }} />
    </div>
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
    ["흐름 소스", board?.exists ? "autoflow 발견" : "없음"],
    ["버전", statusValue(status, "board_version", "-")],
    ["상태", displayStatus(statusValue(doctor, "status", board?.exists ? "unknown" : "-"))],
    ["완료율", `${statusValue(metrics, "completion_rate_percent", "0.0")}%`],
    ["통과율", `${statusValue(metrics, "verification_pass_rate_percent", "0.0")}%`],
    ["티켓 파일", statusValue(metrics, "ticket_total", String(ticketTotal))],
    [
      "산출물",
      `${statusValue(metrics, "runner_artifact_ok_count", "0")} 정상 / ${statusValue(
        metrics,
        "runner_artifact_warning_count",
        "0"
      )} 주의`
    ],
    ["인수인계", statusValue(metrics, "handoff_count", String(board?.conversationFiles?.length || 0))],
    ["업데이트", lastUpdated ? formatDate(lastUpdated) : "-"]
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

type ReportDatum = {
  label: string;
  value: number;
  displayValue?: string;
  detail?: string;
  color: string;
};

const reportColors = {
  blue: "#4f7db8",
  teal: "#5f968d",
  green: "#6f9f73",
  amber: "#bc8d3e",
  red: "#b86d67",
  violet: "#7f72b2",
  slate: "#8b948f"
};

function currentMetricSnapshot(
  board: AutoflowBoardSnapshot | null,
  ticketTotal: number,
  lastUpdated: string
): AutoflowMetricSnapshot | null {
  if (!board?.exists) {
    return null;
  }

  const metrics = board.metrics || {};
  return {
    timestamp: statusValue(metrics, "timestamp", lastUpdated),
    spec_total: statusNumber(metrics, "spec_total"),
    ticket_total: statusNumber(metrics, "ticket_total", ticketTotal),
    ticket_done_count: statusNumber(metrics, "ticket_done_count"),
    active_ticket_count: statusNumber(metrics, "active_ticket_count"),
    reject_count: statusNumber(metrics, "reject_count"),
    verifier_pass_count: statusNumber(metrics, "verifier_pass_count"),
    verifier_fail_count: statusNumber(metrics, "verifier_fail_count"),
    handoff_count: statusNumber(metrics, "handoff_count", board.conversationFiles?.length || 0),
    runner_total_count: statusNumber(metrics, "runner_total_count", board.runners?.length || 0),
    runner_running_count: statusNumber(metrics, "runner_running_count"),
    runner_idle_count: statusNumber(metrics, "runner_idle_count"),
    runner_stopped_count: statusNumber(metrics, "runner_stopped_count"),
    runner_blocked_count: statusNumber(metrics, "runner_blocked_count"),
    runner_enabled_count: statusNumber(metrics, "runner_enabled_count", board.runners?.length || 0),
    runner_disabled_count: statusNumber(metrics, "runner_disabled_count"),
    runner_invalid_config_count: statusNumber(metrics, "runner_invalid_config_count"),
    runner_artifact_ok_count: statusNumber(metrics, "runner_artifact_ok_count"),
    runner_artifact_warning_count: statusNumber(metrics, "runner_artifact_warning_count"),
    runner_artifact_not_applicable_count: statusNumber(metrics, "runner_artifact_not_applicable_count"),
    autoflow_commit_count: statusNumber(metrics, "autoflow_commit_count"),
    autoflow_code_files_changed_count: statusNumber(metrics, "autoflow_code_files_changed_count"),
    autoflow_code_insertions_count: statusNumber(metrics, "autoflow_code_insertions_count"),
    autoflow_code_deletions_count: statusNumber(metrics, "autoflow_code_deletions_count"),
    autoflow_code_volume_count: statusNumber(metrics, "autoflow_code_volume_count"),
    autoflow_token_usage_count: statusNumber(metrics, "autoflow_token_usage_count"),
    autoflow_token_report_count: statusNumber(metrics, "autoflow_token_report_count"),
    verification_pass_rate_percent: statusNumber(metrics, "verification_pass_rate_percent"),
    completion_rate_percent: statusNumber(metrics, "completion_rate_percent")
  };
}

function reportingHistory(board: AutoflowBoardSnapshot | null, ticketTotal: number, lastUpdated: string) {
  const history = [...(board?.metricsHistory || [])];
  const current = currentMetricSnapshot(board, ticketTotal, lastUpdated);

  if (current?.timestamp && history[history.length - 1]?.timestamp !== current.timestamp) {
    history.push(current);
  }

  return history.slice(-30);
}

function ReportMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  className = ""
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  className?: string;
}) {
  return (
    <Card className={`report-metric-card ${tone} ${className}`.trim()}>
      <CardContent className="report-metric-card-content">
        <div className="report-metric-icon">
          <Icon className="h-4 w-4" />
        </div>
        <div className="report-metric-copy">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
        <em>{detail}</em>
      </CardContent>
    </Card>
  );
}

function ReportChartCard({
  label,
  wide = false,
  icon: Icon,
  title,
  meta,
  children
}: {
  label: string;
  wide?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`report-chart-card${wide ? " report-chart-wide" : ""}`} aria-label={label}>
      <CardContent className="report-chart-card-content">
        <div className="report-chart-heading">
          <Icon className="h-4 w-4" />
          <div>
            <h3>{title}</h3>
            <span>{meta}</span>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ReportBarBreakdown({ data }: { data: ReportDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="report-bar-list">
      {data.map((item) => {
        const width = total > 0 ? Math.max(4, (item.value / total) * 100) : 0;
        return (
          <div key={item.label} className="report-bar-row">
            <div className="report-bar-row-label">
              <span>{item.label}</span>
              <strong>{item.displayValue || formatCount(item.value)}</strong>
            </div>
            <div className="report-bar-track" aria-hidden="true">
              <span
                className="report-bar-fill"
                style={{
                  width: `${width}%`,
                  background: item.color
                }}
              />
            </div>
            {item.detail ? <em>{item.detail}</em> : null}
          </div>
        );
      })}
    </div>
  );
}

function ReportDonutChart({
  data,
  centerValue,
  centerLabel
}: {
  data: ReportDatum[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const segments = data
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 100;
      cursor = end;
      return `${item.color} ${start}% ${end}%`;
    });
  const background = segments.length ? `conic-gradient(${segments.join(", ")})` : "var(--muted)";

  return (
    <div className="report-donut-layout">
      <div className="report-donut" style={{ background }} aria-label={`${centerLabel} ${centerValue}`}>
        <div>
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="report-donut-legend">
        {data.map((item) => (
          <div key={item.label} className="report-donut-legend-item">
            <span style={{ background: item.color }} aria-hidden="true" />
            <strong>{item.label}</strong>
            <em>{item.displayValue || formatCount(item.value)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletionTrend({ snapshots }: { snapshots: AutoflowMetricSnapshot[] }) {
  const width = 520;
  const height = 168;
  const padding = 18;
  const values = snapshots.map((snapshot) => snapshot.completion_rate_percent);
  const maxValue = Math.max(100, ...values);
  const points = snapshots.map((snapshot, index) => {
    const x =
      snapshots.length <= 1
        ? width / 2
        : padding + (index / (snapshots.length - 1)) * (width - padding * 2);
    const y = height - padding - (snapshot.completion_rate_percent / maxValue) * (height - padding * 2);
    return { x, y, snapshot };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const doneDelta = first && last ? last.ticket_done_count - first.ticket_done_count : 0;

  return (
    <div className="report-trend">
      {points.length ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="완료율 추세">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
          <polyline points={polyline} />
          {points.map((point) => (
            <circle key={point.snapshot.timestamp} cx={point.x} cy={point.y} r="4" />
          ))}
        </svg>
      ) : (
        <div className="empty-panel report-trend-empty">저장된 지표가 없습니다</div>
      )}
      <div className="report-trend-caption">
        <span>{snapshots.length > 1 ? `${snapshots.length}개 지점` : "현재 지점"}</span>
        <strong>{last ? formatPercentValue(last.completion_rate_percent) : "0.0%"}</strong>
        <em>{doneDelta > 0 ? `+${formatCount(doneDelta)} 완료` : "추가 완료 없음"}</em>
      </div>
    </div>
  );
}

function WorkflowStatStrip({ board }: { board: AutoflowBoardSnapshot | null }) {
  const {
    codeFilesChangedCount,
    codeInsertionsCount,
    codeDeletionsCount,
    codeVolumeCount,
    tokenUsageCount,
    tokenReportCount
  } = getWorkflowMetricCounts(board);
  const hasTokenData = tokenUsageCount > 0 || tokenReportCount > 0;

  return (
    <div className="workflow-stat-strip" aria-label="작업 흐름 지표 요약">
      <div className="workflow-stat-cell">
        <Badge variant="secondary">변경 코드량</Badge>
        <strong>{formatCount(codeVolumeCount)}줄</strong>
        <span>
          {formatSignedCount(codeInsertionsCount)} / -{formatCount(codeDeletionsCount)} 라인 · 변경 파일{" "}
          {formatCount(codeFilesChangedCount)}
        </span>
      </div>
      <div className={`workflow-stat-cell${hasTokenData ? "" : " workflow-stat-cell-muted"}`}>
        <Badge variant="secondary">토큰 사용량</Badge>
        <strong>{formatCount(tokenUsageCount)}</strong>
        <span>실행 로그 {formatCount(tokenReportCount)}개</span>
      </div>
    </div>
  );
}

function ReportingDashboard({
  board,
  lastUpdated,
  ticketTotal
}: {
  board: AutoflowBoardSnapshot | null;
  lastUpdated: string;
  ticketTotal: number;
}) {
  const metrics = board?.metrics || {};
  const doneCount = statusNumber(metrics, "ticket_done_count");
  const todoCount = statusNumber(metrics, "ticket_todo_count", board?.tickets.todo?.length || 0);
  const inprogressCount = statusNumber(metrics, "ticket_inprogress_count", board?.tickets.inprogress?.length || 0);
  const planningCount = statusNumber(metrics, "ticket_planning_count");
  const verifierCount = statusNumber(metrics, "ticket_verifier_count", board?.tickets.verifier?.length || 0);
  const rejectCount = statusNumber(metrics, "reject_count", board?.tickets.reject?.length || 0);
  const activeCount = statusNumber(metrics, "active_ticket_count", todoCount + inprogressCount + verifierCount);
  const specTotal = statusNumber(metrics, "spec_total", board?.tickets.backlog?.length || 0);
  const handoffCount = statusNumber(metrics, "handoff_count", board?.conversationFiles?.length || 0);
  const passCount = statusNumber(metrics, "verifier_pass_count");
  const failCount = statusNumber(metrics, "verifier_fail_count");
  const verifierTotal = statusNumber(metrics, "verifier_total", passCount + failCount);
  const passRate = statusNumber(metrics, "verification_pass_rate_percent");
  const completionRate = statusNumber(metrics, "completion_rate_percent");
  const artifactOk = statusNumber(metrics, "runner_artifact_ok_count");
  const artifactWarning = statusNumber(metrics, "runner_artifact_warning_count");
  const artifactTotal = artifactOk + artifactWarning;
  const commitCount = statusNumber(metrics, "autoflow_commit_count");
  const {
    codeFilesChangedCount,
    codeInsertionsCount,
    codeDeletionsCount,
    codeVolumeCount,
    tokenUsageCount,
    tokenReportCount
  } = getWorkflowMetricCounts(board);
  const runnerRunning = statusNumber(metrics, "runner_running_count");
  const runnerIdle = statusNumber(metrics, "runner_idle_count");
  const runnerStopped = statusNumber(metrics, "runner_stopped_count");
  const runnerBlocked = statusNumber(metrics, "runner_blocked_count");
  const snapshots = reportingHistory(board, ticketTotal, lastUpdated);
  const ticketStateData: ReportDatum[] = [
    { label: "대기", value: todoCount, color: reportColors.blue },
    { label: "실행", value: inprogressCount + planningCount, color: reportColors.teal },
    { label: "검증", value: verifierCount, color: reportColors.violet },
    { label: "완료", value: doneCount, color: reportColors.green },
    { label: "반려", value: rejectCount, color: reportColors.red }
  ];
  const verifierData: ReportDatum[] = [
    { label: "통과", value: passCount, color: reportColors.green },
    { label: "실패", value: failCount, color: reportColors.red }
  ];
  const runnerData: ReportDatum[] = [
    { label: "실행 중", value: runnerRunning, color: reportColors.teal },
    { label: "대기", value: runnerIdle, color: reportColors.blue },
    { label: "중지", value: runnerStopped, color: reportColors.slate },
    { label: "막힘", value: runnerBlocked, color: reportColors.red }
  ];
  const codeImpactData: ReportDatum[] = [
    { label: "변경 파일", value: codeFilesChangedCount, color: reportColors.blue },
    { label: "추가 라인", value: codeInsertionsCount, color: reportColors.green },
    { label: "삭제 라인", value: codeDeletionsCount, color: reportColors.red }
  ];
  const aiUsageData: ReportDatum[] = [
    {
      label: "사용 토큰",
      value: tokenUsageCount,
      displayValue: formatCount(tokenUsageCount),
      color: reportColors.violet,
      detail: `${formatCount(tokenReportCount)}개 실행 로그`
    },
    { label: "AI 산출물", value: artifactTotal, color: reportColors.amber }
  ];

  return (
    <div className="report-dashboard">
      <div className="report-metric-grid" aria-label="처리 지표 요약">
        <ReportMetricCard
          label="완료 티켓"
          value={formatCount(doneCount)}
          detail={`${formatPercentValue(completionRate)} 완료`}
          icon={CheckCircle2}
          tone="report-tone-green"
        />
        <ReportMetricCard
          label="검증 실행"
          value={formatCount(verifierTotal)}
          detail={`${formatCount(passCount)} 통과 / ${formatCount(failCount)} 실패`}
          icon={ShieldCheck}
          tone="report-tone-violet"
        />
        <ReportMetricCard
          label="완료 커밋"
          value={formatCount(commitCount)}
          detail={`${formatCount(codeFilesChangedCount)}개 코드 파일`}
          icon={Archive}
          tone="report-tone-blue"
        />
        <ReportMetricCard
          label="인수인계"
          value={formatCount(handoffCount)}
          detail={`${formatCount(specTotal)}개 PRD`}
          icon={Archive}
          tone="report-tone-blue"
        />
        <ReportMetricCard
          label="AI 산출물"
          value={formatCount(artifactTotal)}
          detail={`${formatCount(artifactOk)} 정상 / ${formatCount(artifactWarning)} 주의`}
          icon={Terminal}
          tone="report-tone-amber"
        />
        <ReportMetricCard
          label="변경 코드량"
          value={`${formatCount(codeVolumeCount)}줄`}
          detail={`${formatSignedCount(codeInsertionsCount)} / -${formatCount(codeDeletionsCount)} · ${formatCount(codeFilesChangedCount)}개 파일`}
          icon={ClipboardList}
          tone="report-tone-green"
          className="report-metric-card-secondary"
        />
        <ReportMetricCard
          label="토큰 사용량"
          value={formatCount(tokenUsageCount)}
          detail={`${formatCount(tokenReportCount)}개 실행 로그 기준`}
          icon={Terminal}
          tone="report-tone-violet"
          className="report-metric-card-secondary"
        />
      </div>

      <div className="report-chart-grid">
        <ReportChartCard
          label="티켓 처리량"
          wide
          icon={BarChart3}
          title="티켓 처리량"
          meta={`${formatCount(activeCount)}개 활성 / ${formatCount(ticketTotal)}개 전체`}
        >
          <ReportBarBreakdown data={ticketStateData} />
        </ReportChartCard>

        <ReportChartCard
          label="검증 결과"
          icon={PieChart}
          title="검증 결과"
          meta={`${formatPercentValue(passRate)} 통과율`}
        >
          <ReportDonutChart data={verifierData} centerValue={formatCount(verifierTotal)} centerLabel="검증" />
        </ReportChartCard>

        <ReportChartCard
          label="완료 추세"
          wide
          icon={TrendingUp}
          title="완료 추세"
          meta={snapshots.length ? formatDate(snapshots[snapshots.length - 1].timestamp) : "이력 없음"}
        >
          <CompletionTrend snapshots={snapshots} />
        </ReportChartCard>

        <ReportChartCard
          label="코드 영향"
          wide
          icon={ClipboardList}
          title="코드 영향"
          meta={`${formatCount(commitCount)}개 완료 커밋 기준`}
        >
          <ReportBarBreakdown data={codeImpactData} />
        </ReportChartCard>

        <ReportChartCard
          label="AI 사용량"
          icon={Terminal}
          title="AI 사용량"
          meta={`${formatCompactCount(tokenUsageCount)} 토큰`}
        >
          <ReportBarBreakdown data={aiUsageData} />
        </ReportChartCard>

        <ReportChartCard
          label="AI 가동 상태"
          icon={Activity}
          title="AI 가동"
          meta={`${formatCount(statusNumber(metrics, "runner_enabled_count", board?.runners?.length || 0))}개 사용`}
        >
          <ReportBarBreakdown data={runnerData} />
        </ReportChartCard>
      </div>
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
          placeholder="파일 찾기"
          aria-label="보드 파일 찾기"
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
                    {boardFileKind(file.filePath)} · {formatDate(file.modifiedAt)}
                  </span>
                  <p>{file.title}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-panel board-search-empty">검색 결과가 없습니다</div>
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
        <span>지표 이력</span>
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
                <span>지표 · {formatDate(file.modifiedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-panel metrics-empty">지표 스냅샷이 없습니다</div>
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
  const ownerActiveCount = statusValue(
    metrics,
    "ticket_owner_active_count",
    statusValue(status, "ticket_owner_active_count", String(board?.tickets.inprogress?.length || 0))
  );
  const planningCount = statusValue(metrics, "ticket_planning_count", statusValue(status, "ticket_planning_count", "0"));
  const cards = [
    {
      label: "PRD",
      value: statusValue(metrics, "spec_total", statusValue(status, "spec_count", String(board?.tickets.backlog?.length || 0))),
      detail: `${handoffCount}개 인수인계`,
      icon: ClipboardCheck,
      tone: "metric-blue"
    },
    {
      label: "대기열",
      value: statusValue(status, "ticket_todo_count", String(board?.tickets.todo?.length || 0)),
      detail: "준비된 티켓",
      icon: Layers3,
      tone: "metric-amber"
    },
    {
      label: "AI",
      value: ownerActiveCount,
      detail: `계획 ${planningCount}개 / AI ${runnerRunningCount}/${runnerEnabledCount}`,
      icon: Activity,
      tone: "metric-teal"
    },
    {
      label: "통과율",
      value: `${passRate}%`,
      detail: `${passCount}/${verifierTotal}`,
      icon: ShieldCheck,
      tone: "metric-violet"
    },
    {
      label: "완료",
      value: statusValue(metrics, "ticket_done_count", statusValue(status, "ticket_done_count", String(board?.tickets.done?.length || 0))),
      detail: `${statusValue(metrics, "completion_rate_percent", "0.0")}% 완료`,
      icon: Archive,
      tone: "metric-green"
    }
  ];

  return (
    <section className="metrics-strip" aria-label="코덱스 진행 요약">
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

type WorkflowFileEntry = AutoflowFilePreview & {
  stateLabel?: string;
  stateTone?: "neutral" | "success" | "destructive";
  displayName?: string;
};

type TicketWorkspaceTabKey = "prd" | "inbox" | "issued";
type TicketWorkspaceStatusKey = "prd" | "memo" | "todo" | "inprogress" | "ready-to-merge" | "merge-blocked" | "blocked" | "verifier" | "done" | "reject";
type TicketWorkspaceItemKind = "prd" | "memo" | "ticket";
type TicketKanbanFolderKey = string;

type TicketWorkspaceItemMeta = {
  id: string;
  title: string;
  projectKey: string;
  stage: string;
  aiLabel: string;
  claimedByLabel: string;
  lastUpdated: string;
  statusKey: TicketWorkspaceStatusKey;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive";
};

type TicketWorkspaceItem = AutoflowFilePreview &
  TicketWorkspaceItemMeta & {
    kind: TicketWorkspaceItemKind;
    displayId: string;
  };

const ticketKanbanFolderOrder = ["backlog", "todo", "inprogress", "done", "reject"] as const;
const ticketWorkspaceTabs: Array<{
  key: TicketWorkspaceTabKey;
  label: string;
  description: string;
}> = [
  { key: "prd", label: "PRD", description: "작성/보관된 PRD" },
  { key: "inbox", label: "인박스", description: "빠른 메모 intake" },
  { key: "issued", label: "발급 티켓", description: "발급된 작업 티켓" }
];
const ticketKanbanFolderMeta: Record<string, {
  label: string;
  description: string;
}> = {
  backlog: { label: "Backlog", description: "PRD 대기" },
  todo: { label: "TODO", description: "아직 시작 전" },
  inprogress: { label: "진행 중", description: "AI가 처리 중" },
  done: { label: "완료", description: "완료 기록" },
  reject: { label: "반려", description: "재시도/검토 필요" }
};

function workflowFileDisplayName(name: string) {
  const stem = name.replace(/\.md$/, "");
  if (stem.startsWith("prd_")) {
    return stem.replace(/^prd_/, "PRD-");
  }
  if (stem.startsWith("project_")) {
    return stem.replace(/^project_/, "PRD-");
  }
  if (stem.startsWith("reject_")) {
    return stem.replace(/^reject_/, "Reject-");
  }
  if (stem.startsWith("memo_")) {
    return stem.replace(/^memo_/, "Memo-");
  }
  if (stem.startsWith("tickets_")) {
    return stem.replace(/^tickets_/, "Ticket-");
  }
  return stem;
}

function sortFilesByModifiedAt(files: AutoflowFilePreview[]) {
  return [...files].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

function boardPath(value: string) {
  return value.replace(/\\/g, "/");
}

function ticketFolderKeyFromFile(file: AutoflowFilePreview) {
  const match = boardPath(file.filePath).match(/\/tickets\/([^/]+)/);
  return match?.[1] || "";
}

function isTicketWorkspaceBoardFile(file: AutoflowFilePreview) {
  return isPrdBoardFile(file) || isTicketBoardFile(file) || isRejectBoardFile(file);
}

function isPrdBoardFile(file: AutoflowFilePreview) {
  return /^pr(?:d|oject)_\d+\.md$/i.test(file.name);
}

function isTicketBoardFile(file: AutoflowFilePreview) {
  return /^tickets_\d+\.md$/i.test(file.name);
}

function isMemoBoardFile(file: AutoflowFilePreview) {
  return /^memo_\d+\.md$/i.test(file.name);
}

function isRejectBoardFile(file: AutoflowFilePreview) {
  return /^reject_\d+\.md$/i.test(file.name);
}

function isInboxMemoBoardFile(file: AutoflowFilePreview) {
  return isMemoBoardFile(file) && boardPath(file.filePath).includes("/tickets/inbox/");
}

function markdownScalar(content: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = content.match(new RegExp(`^- (?:${escaped.join("|")}):\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || "";
}

function markdownSectionPreview(content: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^##\\s+${escapedHeading}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s+|$)`, "im"));
  if (!match) {
    return "";
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#")) || "";
}

function projectKeyFromBoardFile(file: AutoflowFilePreview, content: string) {
  return (
    markdownScalar(content, ["Project Key", "PRD Key"]) ||
    projectKeyFromSpecRef(file.filePath) ||
    projectKeyFromSpecRef(file.name)
  );
}

function ticketWorkspaceStatusForFile(file: AutoflowFilePreview): TicketWorkspaceStatusKey | null {
  const normalized = boardPath(file.filePath);
  if (isInboxMemoBoardFile(file)) {
    return "memo";
  }
  if (isPrdBoardFile(file)) {
    return "prd";
  }
  if (isRejectBoardFile(file)) {
    return "reject";
  }
  if (!isTicketBoardFile(file)) {
    return null;
  }
  if (normalized.includes("/tickets/todo/")) {
    return "todo";
  }
  if (normalized.includes("/tickets/inprogress/")) {
    return "inprogress";
  }
  if (normalized.includes("/tickets/ready-to-merge/")) {
    return "ready-to-merge";
  }
  if (normalized.includes("/tickets/merge-blocked/")) {
    return "merge-blocked";
  }
  if (normalized.includes("/tickets/verifier/")) {
    return "verifier";
  }
  if (normalized.includes("/tickets/done/")) {
    return "done";
  }
  return null;
}

function ticketWorkspaceStatusLabel(statusKey: TicketWorkspaceStatusKey, file: AutoflowFilePreview, content: string) {
  if (statusKey === "prd") {
    return boardPath(file.filePath).includes("/tickets/backlog/") ? "PRD" : "보관 PRD";
  }

  if (statusKey === "memo") {
    return markdownScalar(content, ["Status"]) || "인박스";
  }

  if (statusKey === "blocked") {
    return "막힘";
  }

  if (statusKey === "ready-to-merge") {
    return "머지 대기";
  }

  if (statusKey === "merge-blocked") {
    return "머지 막힘";
  }

  if (statusKey === "inprogress") {
    const stage = markdownScalar(content, ["Stage"]).toLowerCase();
    return displayStatus(stage || "executing");
  }

  const labels: Record<Exclude<TicketWorkspaceStatusKey, "prd" | "memo" | "inprogress" | "ready-to-merge" | "merge-blocked" | "blocked">, string> = {
    todo: "발급됨",
    verifier: "검증",
    done: "완료",
    reject: "반려"
  };
  return labels[statusKey];
}

function ticketWorkspaceStatusVariant(statusKey: TicketWorkspaceStatusKey) {
  if (statusKey === "blocked" || statusKey === "merge-blocked" || statusKey === "reject") {
    return "destructive" as const;
  }

  if (statusKey === "inprogress" || statusKey === "ready-to-merge" || statusKey === "verifier" || statusKey === "done") {
    return "default" as const;
  }

  return "secondary" as const;
}

function extractTicketWorkspaceMeta(file: AutoflowFilePreview, content: string): TicketWorkspaceItemMeta {
  const id = markdownScalar(content, ["ID"]) || workflowFileDisplayName(file.name);
  const ai = markdownScalar(content, ["AI", "Execution AI", "Owner"]);
  const claimedBy = markdownScalar(content, ["Claimed By"]);
  const title = markdownScalar(content, ["Title"]) || markdownSectionPreview(content, "Request") || file.title || file.name;
  const stage = markdownScalar(content, ["Stage"]);
  const fileStatusKey = ticketWorkspaceStatusForFile(file) || "todo";
  const statusKey = fileStatusKey === "inprogress" && stage.toLowerCase() === "blocked" ? "blocked" : fileStatusKey;
  return {
    id,
    title,
    projectKey: projectKeyFromBoardFile(file, content),
    stage,
    aiLabel: displayWorkflowRunnerId(ai),
    claimedByLabel: displayWorkflowRunnerId(claimedBy),
    lastUpdated: markdownScalar(content, ["Last Updated"]),
    statusKey,
    statusLabel: ticketWorkspaceStatusLabel(statusKey, file, content),
    statusVariant: ticketWorkspaceStatusVariant(statusKey)
  };
}

function ticketWorkspaceFiles(board: AutoflowBoardSnapshot | null) {
  const files = Object.values(board?.tickets || {}).flatMap((folderFiles) =>
    folderFiles.filter(isTicketWorkspaceBoardFile)
  );

  return sortFilesByModifiedAt(files);
}

function prdWorkspaceFiles(board: AutoflowBoardSnapshot | null) {
  const files = Object.values(board?.tickets || {}).flatMap((folderFiles) =>
    folderFiles.filter(isPrdBoardFile)
  );

  return sortFilesByModifiedAt(files);
}

function inboxWorkspaceFiles(board: AutoflowBoardSnapshot | null) {
  return sortFilesByModifiedAt((board?.tickets.inbox || []).filter(isInboxMemoBoardFile));
}

function ticketWorkspaceTabFromStorage(value: string | null): TicketWorkspaceTabKey {
  return ticketWorkspaceTabs.some((tab) => tab.key === value) ? (value as TicketWorkspaceTabKey) : "issued";
}

function ticketKanbanColumnsForBoard(board: AutoflowBoardSnapshot | null) {
  const existingKeys = new Set(Object.keys(board?.tickets || {}));
  const orderedKeys = [
    ...ticketKanbanFolderOrder.filter((key) => existingKeys.has(key)),
    ...[...existingKeys].filter((key) => !ticketKanbanFolderOrder.includes(key as typeof ticketKanbanFolderOrder[number])).sort()
  ];

  return orderedKeys.map((key) => ({
    key,
    label: ticketKanbanFolderMeta[key]?.label || key,
    path: `tickets/${key}`,
    description: ticketKanbanFolderMeta[key]?.description || "사용자 정의 폴더"
  }));
}

function ticketKanbanFolderForItem(item: TicketWorkspaceItem): TicketKanbanFolderKey {
  return ticketFolderKeyFromFile(item);
}

function TicketDetailLayer({
  item,
  content,
  loading,
  error,
  onOpenChange,
  onClose
}: {
  item: TicketWorkspaceItem | null;
  content: AutoflowFileContentResult | null;
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}) {
  const ItemIcon = item?.kind === "prd" ? ClipboardCheck : item?.kind === "memo" ? Inbox : ClipboardList;
  const metaRows = item
    ? [
        ["ID", item.id || item.displayId],
        ["PRD Key", item.projectKey],
        [item.kind === "memo" ? "Status" : "Stage", item.stage || item.statusLabel],
        ["AI", item.aiLabel],
        ["Claimed By", item.claimedByLabel],
        ["Last Updated", item.lastUpdated || formatDate(item.modifiedAt)]
      ].filter(([, value]) => Boolean(value))
    : [];

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent
        className="workflow-pin-layer-panel workflow-pin-layer-default ticket-detail-layer-panel"
        overlayClassName="workflow-pin-layer-overlay"
        aria-describedby={undefined}
      >
        {item ? (
          <>
            <div className="workflow-pin-layer-header ticket-detail-layer-header">
              <div className="workflow-pin-layer-heading">
                <ItemIcon className="h-4 w-4" aria-hidden="true" />
                <DialogTitle asChild>
                  <strong>{item.displayId}</strong>
                </DialogTitle>
              </div>
              <Badge className="ticket-workspace-detail-badge" variant={item.statusVariant}>
                {item.statusLabel}
              </Badge>
              <time>{formatDate(item.modifiedAt)}</time>
              <span className="ticket-detail-layer-path">{item.filePath}</span>
              <button
                type="button"
                className="workflow-pin-layer-close"
                onClick={onClose}
                aria-label="닫기"
                autoFocus
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="ticket-workspace-detail-summary ticket-detail-layer-summary">
              <h4>{item.title}</h4>
              <dl className="ticket-detail-layer-meta">
                {metaRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="workflow-pin-detail ticket-workspace-detail-body ticket-detail-layer-body">
              {loading ? (
                <div className="workflow-pin-detail-loading">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>불러오는 중…</span>
                </div>
              ) : null}
              {error ? <div className="workflow-pin-detail-error">{error}</div> : null}
              {!error && content ? (
                <div className="workflow-pin-detail-body">
                  {content.content ? (
                    <MarkdownViewer content={content.content} />
                  ) : (
                    <p className="workflow-pin-detail-empty">(비어 있음)</p>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TicketWorkspaceListView({
  files,
  kind,
  options,
  emptyTitle,
  emptyDescription
}: {
  files: AutoflowFilePreview[];
  kind: TicketWorkspaceItemKind;
  options?: { projectRoot: string; boardDirName: string };
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [metaByPath, setMetaByPath] = React.useState<Record<string, TicketWorkspaceItemMeta>>({});
  const [activeDetailPath, setActiveDetailPath] = React.useState("");
  const [detailContent, setDetailContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");
  const itemButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      if (!options?.projectRoot || files.length === 0) {
        if (!cancelled) {
          setMetaByPath({});
        }
        return;
      }

      const nextMeta: Record<string, TicketWorkspaceItemMeta> = {};
      const results = await Promise.all(
        files.map(async (file) => {
          const result = await window.autoflow.readBoardFile({
            ...options,
            filePath: file.filePath
          });
          return { file, result };
        })
      );

      for (const { file, result } of results) {
        const statusKey = ticketWorkspaceStatusForFile(file) || (kind === "memo" ? "memo" : "prd");
        nextMeta[file.filePath] = result.ok
          ? extractTicketWorkspaceMeta(file, result.content || "")
          : {
              id: workflowFileDisplayName(file.name),
              title: file.title || file.name,
              projectKey: projectKeyFromBoardFile(file, ""),
              stage: "",
              aiLabel: "",
              claimedByLabel: "",
              lastUpdated: "",
              statusKey,
              statusLabel: ticketWorkspaceStatusLabel(statusKey, file, ""),
              statusVariant: ticketWorkspaceStatusVariant(statusKey)
            };
      }

      if (!cancelled) {
        setMetaByPath(nextMeta);
      }
    };

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [files, kind, options]);

  const items = React.useMemo<TicketWorkspaceItem[]>(
    () =>
      files.map((file) => {
        const meta = metaByPath[file.filePath];
        const statusKey = meta?.statusKey || ticketWorkspaceStatusForFile(file) || (kind === "memo" ? "memo" : "prd");
        return {
          ...file,
          kind,
          displayId: workflowFileDisplayName(file.name),
          title: meta?.title || file.title || file.name,
          projectKey: meta?.projectKey || projectKeyFromBoardFile(file, ""),
          id: meta?.id || workflowFileDisplayName(file.name),
          stage: meta?.stage || "",
          aiLabel: meta?.aiLabel || "",
          claimedByLabel: meta?.claimedByLabel || "",
          lastUpdated: meta?.lastUpdated || "",
          statusKey,
          statusLabel: meta?.statusLabel || ticketWorkspaceStatusLabel(statusKey, file, ""),
          statusVariant: meta?.statusVariant || ticketWorkspaceStatusVariant(statusKey)
        };
      }),
    [files, kind, metaByPath]
  );

  const activeDetailItem = React.useMemo(
    () => items.find((item) => item.filePath === activeDetailPath) || null,
    [activeDetailPath, items]
  );

  const closeDetailLayer = React.useCallback(() => {
    const previousPath = activeDetailPath;
    setActiveDetailPath("");
    setDetailContent(null);
    setDetailError("");
    if (previousPath) {
      window.setTimeout(() => itemButtonRefs.current[previousPath]?.focus(), 0);
    }
  }, [activeDetailPath]);

  React.useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setDetailContent(null);
      setDetailError("");
      if (!activeDetailItem) {
        return;
      }
      if (!options?.projectRoot) {
        if (!cancelled) {
          setDetailError("프로젝트 루트가 설정되어 있지 않습니다.");
        }
        return;
      }

      if (!cancelled) {
        setDetailLoading(true);
      }
      try {
        const result = await window.autoflow.readBoardFile({
          ...options,
          filePath: activeDetailItem.filePath
        });
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setDetailError(result.stderr || "파일 미리보기에 실패했습니다.");
          return;
        }
        setDetailContent(result);
      } catch (error) {
        if (!cancelled) {
          setDetailError(error instanceof Error ? error.message : "파일 미리보기에 실패했습니다.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [activeDetailItem, options]);

  if (items.length === 0) {
    return (
      <div className="ticket-workspace-empty">
        <strong>{emptyTitle}</strong>
        <span>{emptyDescription}</span>
      </div>
    );
  }

  return (
    <>
      <div className="ticket-workspace-list-pane">
        <div className="ticket-workspace-list">
          {items.map((item) => {
            const ItemIcon = item.kind === "memo" ? Inbox : ClipboardCheck;
            return (
              <ButtonBase
                key={item.filePath}
                ref={(node) => {
                  itemButtonRefs.current[item.filePath] = node;
                }}
                type="button"
                className="ticket-workspace-item"
                onClick={() => setActiveDetailPath(item.filePath)}
                title={item.title}
                aria-haspopup="dialog"
              >
                <span className="ticket-workspace-item-icon">
                  <ItemIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="ticket-workspace-item-main">
                  <strong>{item.title}</strong>
                  <span>{item.filePath}</span>
                </span>
                <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                <time>{formatDate(item.modifiedAt)}</time>
              </ButtonBase>
            );
          })}
        </div>
      </div>
      <TicketDetailLayer
        item={activeDetailItem}
        content={detailContent}
        loading={detailLoading}
        error={detailError}
        onOpenChange={(open) => {
          if (!open) {
            closeDetailLayer();
          }
        }}
        onClose={closeDetailLayer}
      />
    </>
  );
}

function WorkflowPinLayer({
  files,
  options,
  pinTitle,
  pinSubtitle,
  pinIcon,
  variant,
  layerHeading,
  layerHelpText,
  emptyText,
  showWhenEmpty = false
}: {
  files: WorkflowFileEntry[];
  options?: { projectRoot: string; boardDirName: string };
  pinTitle: string;
  pinSubtitle?: string;
  pinIcon: React.ReactNode;
  variant: "default" | "destructive";
  layerHeading: string;
  layerHelpText: string;
  emptyText?: string;
  showWhenEmpty?: boolean;
}) {
  const [layerOpen, setLayerOpen] = React.useState(false);
  const [detailFile, setDetailFile] = React.useState<WorkflowFileEntry | null>(null);
  const [detailContent, setDetailContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");

  const closeLayer = React.useCallback(() => {
    setLayerOpen(false);
    setDetailFile(null);
    setDetailContent(null);
    setDetailError("");
  }, []);

  React.useEffect(() => {
    if (files.length === 0 && layerOpen && !showWhenEmpty) {
      closeLayer();
    }
  }, [closeLayer, files.length, layerOpen, showWhenEmpty]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        setLayerOpen(true);
        return;
      }
      // Dialog close asks to close: if currently in detail view, go back to list instead
      if (detailFile) {
        setDetailFile(null);
        setDetailContent(null);
        setDetailError("");
        return;
      }
      closeLayer();
    },
    [closeLayer, detailFile]
  );

  const handleOpenDetail = React.useCallback(
    async (file: WorkflowFileEntry) => {
      setDetailFile(file);
      setDetailError("");
      setDetailContent(null);
      if (!options?.projectRoot) {
        setDetailError("프로젝트 루트가 설정되어 있지 않습니다.");
        return;
      }
      setDetailLoading(true);
      try {
        const result = await window.autoflow.readBoardFile({
          ...options,
          filePath: file.filePath
        });
        if (!result.ok) {
          setDetailError(result.stderr || "파일 미리보기에 실패했습니다.");
          return;
        }
        setDetailContent(result);
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : "파일 미리보기에 실패했습니다.");
      } finally {
        setDetailLoading(false);
      }
    },
    [options]
  );

  const handleBackToList = () => {
    setDetailFile(null);
    setDetailContent(null);
    setDetailError("");
  };

  if (files.length === 0 && !showWhenEmpty) return null;

  return (
    <>
      <button
        type="button"
        className={`workflow-pin workflow-pin-${variant}`}
        onClick={() => setLayerOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={layerOpen}
        aria-label={`${pinTitle} — 클릭하여 세부 내용 보기`}
      >
        <span className="workflow-pin-icon">{pinIcon}</span>
        <span className="workflow-pin-body">
          <strong>{pinTitle}</strong>
          {pinSubtitle ? <span>{pinSubtitle}</span> : null}
        </span>
        <span className="workflow-pin-cta" aria-hidden="true">
          세부 보기
        </span>
      </button>
      <Dialog open={layerOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`workflow-pin-layer-panel workflow-pin-layer-${variant}`}
          overlayClassName="workflow-pin-layer-overlay"
          aria-describedby={undefined}
        >
          <div className="workflow-pin-layer-header">
            {detailFile ? (
              <button
                type="button"
                className="workflow-pin-layer-back"
                onClick={handleBackToList}
                aria-label="목록으로 돌아가기"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>이전</span>
              </button>
            ) : (
              <div className="workflow-pin-layer-heading">
                {pinIcon}
                <DialogTitle asChild>
                  <strong>{layerHeading}</strong>
                </DialogTitle>
              </div>
            )}
            {detailFile ? (
              <DialogTitle asChild>
                <strong className="workflow-pin-layer-title">
                  {workflowFileDisplayName(detailFile.name)}
                </strong>
              </DialogTitle>
            ) : null}
            <button
              type="button"
              className="workflow-pin-layer-close"
              onClick={closeLayer}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          {detailFile ? (
            <div className="workflow-pin-detail">
              {detailLoading ? (
                <div className="workflow-pin-detail-loading">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>불러오는 중…</span>
                </div>
              ) : null}
              {detailError ? (
                <div className="workflow-pin-detail-error">{detailError}</div>
              ) : null}
              {!detailError && detailContent ? (
                <div className="workflow-pin-detail-body">
                  {detailContent.content ? (
                    <MarkdownViewer content={detailContent.content} />
                  ) : (
                    <p className="workflow-pin-detail-empty">(비어 있음)</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <DialogDescription className="workflow-pin-layer-help">
                {layerHelpText}
              </DialogDescription>
              {files.length ? (
                <ul className="workflow-pin-list">
                  {files.map((file) => (
                    <li key={file.filePath}>
                      <button
                        type="button"
                        className="workflow-pin-item"
                        onClick={() => handleOpenDetail(file)}
                        title={file.title || file.name}
                      >
                        <strong>{workflowFileDisplayName(file.name)}</strong>
                        {file.title ? <span>{file.title}</span> : null}
                        {file.stateLabel ? (
                          <span
                            className={`workflow-pin-item-badge workflow-pin-item-badge-${file.stateTone || "neutral"}`}
                          >
                            {file.stateLabel}
                          </span>
                        ) : null}
                        <time>{formatDate(file.modifiedAt)}</time>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="workflow-pin-empty">{emptyText || "표시할 항목이 없습니다."}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TicketWorkspaceDetailPane({
  selectedItem,
  detailLoading,
  detailError,
  detailContent
}: {
  selectedItem: TicketWorkspaceItem | null;
  detailLoading: boolean;
  detailError: string;
  detailContent: AutoflowFileContentResult | null;
}) {
  const SelectedDetailIcon = selectedItem?.kind === "prd" ? ClipboardCheck : ClipboardList;

  return (
    <div className="ticket-workspace-detail-pane workflow-pin-layer-default">
      {!selectedItem ? (
        <div className="ticket-workspace-empty ticket-workspace-detail-empty">
          <strong>항목을 선택하세요.</strong>
          <span>선택한 PRD 또는 티켓의 메타데이터와 Markdown 본문이 여기에 표시됩니다.</span>
        </div>
      ) : (
        <>
          <header className="workflow-pin-layer-header ticket-workspace-detail-head">
            <div className="workflow-pin-layer-heading">
              <SelectedDetailIcon className="h-4 w-4" aria-hidden="true" />
              <strong>{selectedItem.kind === "prd" ? "PRD" : "Ticket"}</strong>
            </div>
            <strong className="workflow-pin-layer-title">{selectedItem.displayId}</strong>
            <Badge className="ticket-workspace-detail-badge" variant={selectedItem.statusVariant}>
              {selectedItem.statusLabel}
            </Badge>
          </header>
          <div className="ticket-workspace-detail-summary">
            <h4>{selectedItem.title}</h4>
            <div className="ticket-workspace-detail-meta">
              {selectedItem.projectKey ? <span>프로젝트 키 · {selectedItem.projectKey}</span> : null}
              {selectedItem.aiLabel ? <span>담당 · {selectedItem.aiLabel}</span> : null}
              <time>{formatDate(selectedItem.modifiedAt)}</time>
              <span>{selectedItem.filePath}</span>
            </div>
          </div>
          <div className="workflow-pin-detail ticket-workspace-detail-body">
            {detailLoading ? (
              <div className="workflow-pin-detail-loading">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>불러오는 중…</span>
              </div>
            ) : null}
            {detailError ? <div className="workflow-pin-detail-error">{detailError}</div> : null}
            {!detailError && detailContent ? (
              <div className="workflow-pin-detail-body">
                {detailContent.content ? (
                  <MarkdownViewer content={detailContent.content} />
                ) : (
                  <p className="workflow-pin-detail-empty">(비어 있음)</p>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function TicketKanban({
  board,
  options
}: {
  board: AutoflowBoardSnapshot | null;
  options?: { projectRoot: string; boardDirName: string };
}) {
  const files = React.useMemo(() => ticketWorkspaceFiles(board), [board]);
  const prdFiles = React.useMemo(() => prdWorkspaceFiles(board), [board]);
  const inboxFiles = React.useMemo(() => inboxWorkspaceFiles(board), [board]);
  const kanbanColumns = React.useMemo(() => ticketKanbanColumnsForBoard(board), [board]);
  const kanbanColumnStyle = {
    "--ticket-kanban-column-count": Math.max(kanbanColumns.length, 1)
  } as React.CSSProperties;
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<TicketWorkspaceTabKey>(() =>
    ticketWorkspaceTabFromStorage(window.localStorage.getItem("autoflow.activeTicketWorkspaceTab"))
  );
  const [metaByPath, setMetaByPath] = React.useState<Record<string, TicketWorkspaceItemMeta>>({});
  const [activeDetailPath, setActiveDetailPath] = React.useState("");
  const [detailContent, setDetailContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");
  const itemButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      if (!options?.projectRoot || files.length === 0) {
        if (!cancelled) {
          setMetaByPath({});
        }
        return;
      }

      const nextMeta: Record<string, TicketWorkspaceItemMeta> = {};
      const results = await Promise.all(
        files.map(async (file) => {
          const result = await window.autoflow.readBoardFile({
            ...options,
            filePath: file.filePath
          });
          return { file, result };
        })
      );

      for (const { file, result } of results) {
        nextMeta[file.filePath] = result.ok
          ? extractTicketWorkspaceMeta(file, result.content || "")
          : {
              id: workflowFileDisplayName(file.name),
              title: file.title || file.name,
              projectKey: projectKeyFromBoardFile(file, ""),
              stage: "",
              aiLabel: "",
              claimedByLabel: "",
              lastUpdated: "",
              statusKey: ticketWorkspaceStatusForFile(file) || "todo",
              statusLabel: ticketWorkspaceStatusLabel(ticketWorkspaceStatusForFile(file) || "todo", file, ""),
              statusVariant: ticketWorkspaceStatusVariant(ticketWorkspaceStatusForFile(file) || "todo")
            };
      }

      if (!cancelled) {
        setMetaByPath(nextMeta);
      }
    };

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [files, options]);

  React.useEffect(() => {
    window.localStorage.setItem("autoflow.activeTicketWorkspaceTab", activeWorkspaceTab);
  }, [activeWorkspaceTab]);

  const items = React.useMemo<TicketWorkspaceItem[]>(
    () =>
      files.map((file) => {
        const meta = metaByPath[file.filePath];
        const statusKey = meta?.statusKey || ticketWorkspaceStatusForFile(file) || "todo";
        return {
          ...file,
          kind: isPrdBoardFile(file) ? "prd" : isInboxMemoBoardFile(file) ? "memo" : "ticket",
          displayId: workflowFileDisplayName(file.name),
          title: meta?.title || file.title || file.name,
          projectKey: meta?.projectKey || projectKeyFromBoardFile(file, ""),
          id: meta?.id || workflowFileDisplayName(file.name),
          stage: meta?.stage || "",
          aiLabel: meta?.aiLabel || "",
          claimedByLabel: meta?.claimedByLabel || "",
          lastUpdated: meta?.lastUpdated || "",
          statusKey,
          statusLabel: meta?.statusLabel || ticketWorkspaceStatusLabel(statusKey, file, ""),
          statusVariant: meta?.statusVariant || ticketWorkspaceStatusVariant(statusKey)
        };
      }),
    [files, metaByPath]
  );

  const activeDetailItem = React.useMemo(
    () => items.find((item) => item.filePath === activeDetailPath) || null,
    [activeDetailPath, items]
  );

  const restoreFocusToItem = React.useCallback((filePath: string) => {
    window.setTimeout(() => itemButtonRefs.current[filePath]?.focus(), 0);
  }, []);

  const closeDetailLayer = React.useCallback(() => {
    const previousPath = activeDetailPath;
    setActiveDetailPath("");
    setDetailContent(null);
    setDetailError("");
    if (previousPath) {
      restoreFocusToItem(previousPath);
    }
  }, [activeDetailPath, restoreFocusToItem]);

  const handleDetailOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        closeDetailLayer();
      }
    },
    [closeDetailLayer]
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setDetailContent(null);
      setDetailError("");
      if (!activeDetailItem) {
        return;
      }
      if (!options?.projectRoot) {
        if (!cancelled) {
          setDetailError("프로젝트 루트가 설정되어 있지 않습니다.");
        }
        return;
      }

      if (!cancelled) {
        setDetailLoading(true);
      }
      try {
        const result = await window.autoflow.readBoardFile({
          ...options,
          filePath: activeDetailItem.filePath
        });
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setDetailError(result.stderr || "파일 미리보기에 실패했습니다.");
          return;
        }
        setDetailContent(result);
      } catch (error) {
        if (!cancelled) {
          setDetailError(error instanceof Error ? error.message : "파일 미리보기에 실패했습니다.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [activeDetailItem, options]);

  const boardIsEmpty = items.length === 0;
  const activeTabMeta = ticketWorkspaceTabs.find((tab) => tab.key === activeWorkspaceTab) || ticketWorkspaceTabs[2];

  return (
    <section className="ticket-kanban-board" aria-label="티켓 정보">
      <PageLayout
        className="ticket-workspace-page"
        header={
          <div className="ticket-workspace-toolbar">
            <div className="ticket-workspace-tabs" role="tablist" aria-label="티켓 작업공간 보기">
              {ticketWorkspaceTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant="ghost"
                  type="button"
                  role="tab"
                  className="ticket-workspace-tab-trigger"
                  data-state={activeWorkspaceTab === tab.key ? "active" : "inactive"}
                  aria-selected={activeWorkspaceTab === tab.key}
                  onClick={() => setActiveWorkspaceTab(tab.key)}
                >
                  <span>{tab.label}</span>
                  <Badge variant="secondary">
                    {tab.key === "prd" ? prdFiles.length : tab.key === "inbox" ? inboxFiles.length : items.length}
                  </Badge>
                </Button>
              ))}
            </div>
            <span className="ticket-workspace-tab-copy">{activeTabMeta.description}</span>
          </div>
        }
      >
        <div className="ticket-workspace-tab-panel" role="tabpanel" aria-label={activeTabMeta.label}>
          {activeWorkspaceTab === "prd" ? (
            <TicketWorkspaceListView
              files={prdFiles}
              kind="prd"
              options={options}
              emptyTitle="표시할 PRD가 없습니다."
              emptyDescription="tickets/backlog 또는 tickets/done에 PRD가 생기면 여기에 표시됩니다."
            />
          ) : null}
          {activeWorkspaceTab === "inbox" ? (
            <TicketWorkspaceListView
              files={inboxFiles}
              kind="memo"
              options={options}
              emptyTitle="인박스 메모가 없습니다."
              emptyDescription="tickets/inbox/memo_*.md 파일이 있으면 읽기 전용 목록으로 표시됩니다."
            />
          ) : null}
          {activeWorkspaceTab === "issued" ? (
            boardIsEmpty ? (
              <div className="ticket-kanban-empty ticket-workspace-empty">
                <strong>표시할 티켓이 없습니다.</strong>
                <span>tickets 폴더에 티켓이 생기면 폴더 기준 칸반으로 표시됩니다.</span>
              </div>
            ) : (
              <div className="ticket-workspace-kanban-layout">
                <div className="ticket-workspace-kanban-pane">
                  <div
                    className="ticket-workspace-kanban-columns"
                    aria-label="폴더 기준 티켓 칸반"
                    style={kanbanColumnStyle}
                  >
                    {kanbanColumns.map((column) => {
                      const columnItems = items.filter((item) => ticketKanbanFolderForItem(item) === column.key);
                      return (
                        <section key={column.key} className={`ticket-kanban-column ticket-kanban-column-${column.key}`}>
                          <header className="ticket-kanban-column-header">
                            <div>
                              <strong>{column.label}</strong>
                              <span>{column.path}</span>
                            </div>
                            <Badge variant="secondary">{columnItems.length}</Badge>
                          </header>
                          <div className="ticket-kanban-column-note">{column.description}</div>
                          {columnItems.length === 0 ? (
                            <div className="ticket-kanban-column-empty">비어 있음</div>
                          ) : (
                            <div className="ticket-kanban-card-list">
                              {columnItems.map((item) => {
                                const metaText = [item.projectKey, item.aiLabel].filter(Boolean).join(" · ");
                                return (
                                  <button
                                    key={item.filePath}
                                    ref={(node) => {
                                      itemButtonRefs.current[item.filePath] = node;
                                    }}
                                    type="button"
                                    className="ticket-kanban-card"
                                    onClick={() => setActiveDetailPath(item.filePath)}
                                    title={item.title}
                                    aria-haspopup="dialog"
                                  >
                                    <span className="ticket-kanban-card-topline">
                                      <span className="ticket-kanban-card-id">{item.displayId}</span>
                                      <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                                    </span>
                                    <strong>{item.title}</strong>
                                    <span className="ticket-kanban-card-meta">{metaText || item.filePath}</span>
                                    <time>{formatDate(item.modifiedAt)}</time>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          ) : null}
        </div>
      </PageLayout>
      <TicketDetailLayer
        item={activeDetailItem}
        content={detailContent}
        loading={detailLoading}
        error={detailError}
        onOpenChange={handleDetailOpenChange}
        onClose={closeDetailLayer}
      />
    </section>
  );
}

function TicketBoard({
  board,
  installedAgentProfiles = {},
  selectedPath: _selectedPath,
  onSelect,
  options,
  actionKey = "",
  drafts = {},
  onSelectRunner,
  onControl,
  onDraftChange,
  onConfigure
}: {
  board: AutoflowBoardSnapshot | null;
  installedAgentProfiles?: InstalledAgentProfiles;
  selectedPath: string;
  onSelect: (filePath: string) => void;
  options?: { projectRoot: string; boardDirName: string };
  actionKey?: string;
  drafts?: Record<string, RunnerDraft>;
  onSelectRunner?: (runnerId: string) => void;
  onControl?: (action: "start" | "stop" | "restart", runnerId: string) => void;
  onDraftChange?: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure?: (runner: AutoflowRunner) => void;
}) {
  const runners = (board?.runners || []).filter((runner) => (runner.role || "").toLowerCase() !== "self-improve");
  const rejectFiles = (board?.tickets.reject || [])
    .filter((file) => file.name.startsWith("reject_"))
    .map((file) => ({ ...file, stateLabel: "반려", stateTone: "destructive" } as WorkflowFileEntry));
  const backlogSpecs = (board?.tickets.backlog || [])
    .filter((file) => file.name.startsWith("prd_") || file.name.startsWith("project_"))
    .map((file) => ({ ...file, stateLabel: "대기", stateTone: "neutral" } as WorkflowFileEntry));
  const doneSpecs = (board?.tickets.done || [])
    .filter((file) => file.name.startsWith("prd_") || file.name.startsWith("project_"))
    .map((file) => ({ ...file } as WorkflowFileEntry));
  const todoTickets = (board?.tickets.todo || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file, stateLabel: "TODO", stateTone: "neutral" } as WorkflowFileEntry));
  const specNumericId = (name: string) => {
    const match = name.match(/(?:prd|project)_(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const ticketNumericId = (name: string) => {
    const match = name.match(/tickets_(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const specFiles: WorkflowFileEntry[] = [...backlogSpecs, ...doneSpecs].sort(
    (a, b) => specNumericId(b.name) - specNumericId(a.name)
  );
  const todoFiles: WorkflowFileEntry[] = todoTickets.sort(
    (a, b) => ticketNumericId(b.name) - ticketNumericId(a.name)
  );
  const prdPinTitle = `PRD ${specFiles.length}건${backlogSpecs.length ? ` · 대기 ${backlogSpecs.length}건` : ""}`;
  const todoPinTitle = `TODO ${todoFiles.length}건`;

  const hasHeader = Boolean(specFiles.length || todoFiles.length || rejectFiles.length);

  return (
    <PageLayout
      header={
        hasHeader ? (
          <div className="workflow-pin-strip" aria-label="작업 흐름 요약">
            {specFiles.length ? (
              <WorkflowPinLayer
                files={specFiles}
                options={options}
                pinTitle={prdPinTitle}
                pinIcon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
                variant="default"
                layerHeading={prdPinTitle}
                layerHelpText="작성된 PRD 목록입니다. 항목을 클릭하면 본문이 이 화면에서 열립니다."
              />
            ) : null}
            {specFiles.length || todoFiles.length ? (
              <WorkflowPinLayer
                files={todoFiles}
                options={options}
                pinTitle={todoPinTitle}
                pinIcon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                variant="default"
                layerHeading={todoPinTitle}
                layerHelpText="아직 시작되지 않은 TODO 티켓 목록입니다. 항목을 클릭하면 티켓 본문이 이 화면에서 열립니다."
                emptyText="아직 발급된 TODO 티켓이 없습니다."
                showWhenEmpty
              />
            ) : null}
            {rejectFiles.length ? (
              <WorkflowPinLayer
                files={rejectFiles}
                options={options}
                pinTitle={`반려 ${rejectFiles.length}건 보류`}
                pinIcon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
                variant="destructive"
                layerHeading={`반려 ${rejectFiles.length}건 보류 중`}
                layerHelpText="AI 는 반려 티켓을 자동 재시도 상한까지 다시 todo 로 되돌릴 수 있습니다. 항목을 클릭하면 reject 본문이 이 화면에서 열립니다."
              />
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="ai-progress-board" data-runner-count={runners.length} aria-label="AI별 작업 진행률">
        {runners.length ? (
          runners.map((runner) => (
            <AiProgressRow
              key={runner.id}
              runner={runner}
              onSelect={onSelect}
              installedAgentProfiles={installedAgentProfiles}
              options={options}
              actionKey={actionKey}
              draft={drafts[runner.id]}
              onSelectRunner={onSelectRunner}
              onControl={onControl}
              onDraftChange={onDraftChange}
              onConfigure={onConfigure}
            />
          ))
        ) : (
          <div className="ai-progress-empty">
            <strong>AI가 없습니다</strong>
            <span>runner 설정이 추가되면 진행 상태가 여기에 표시됩니다.</span>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

function PageLayout({
  header,
  children,
  className
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`page-layout${className ? ` ${className}` : ""}`}>
      {header ? (
        <>
          <div className="page-layout-header">{header}</div>
          <hr className="page-layout-divider" aria-hidden="true" />
        </>
      ) : null}
      <div className="page-layout-body">{children}</div>
    </div>
  );
}

function AiConversationPanel({
  runnerLabel,
  agentLabel,
  text
}: {
  runner: AutoflowRunner;
  runnerLabel: string;
  agentLabel: string;
  text: string;
}) {
  return (
    <article className="ai-conversation-panel" aria-label={`${runnerLabel} 처리 내용`}>
      <header className="ai-conversation-panel-head">
        <strong>{runnerLabel}</strong>
        <span>{agentLabel}</span>
      </header>
      <ConversationStream label={`${runnerLabel} 최근 터미널 출력`} text={text} streamId={`panel:${runnerLabel}`} />
    </article>
  );
}

function flowStepState(
  stepKey: string,
  currentKey: string,
  stages: readonly FlowStageDef[] = ownerFlowStages
) {
  const terminalKeys = new Set(["reject", "blocked"]);
  if (terminalKeys.has(currentKey)) {
    if (terminalKeys.has(stepKey)) {
      return "active";
    }

    return stepKey === "done" ? "idle" : "complete";
  }

  const currentIndex = stages.findIndex((stage) => stage.key === currentKey);
  const stepIndex = stages.findIndex((stage) => stage.key === stepKey);

  if (terminalKeys.has(stepKey) || stepIndex > currentIndex) {
    return "idle";
  }

  return stepIndex === currentIndex ? "active" : "complete";
}

function flowStagesForRunner(runner: AutoflowRunner): readonly FlowStageDef[] {
  const role = (runner.role || "").toLowerCase();
  if (role === "merge-bot" || role === "merge") return mergeBotFlowStages;
  if (role.includes("wiki")) return wikiBotFlowStages;
  if (role === "planner" || role === "plan") return plannerFlowStages;
  return ownerFlowStages;
}

function runnerStageKey(runner: AutoflowRunner): string {
  const status = (runner.stateStatus || "").toLowerCase();
  const role = (runner.role || "").toLowerCase();
  const activeStage = (runner.activeStage || "").toLowerCase();
  const hasActiveTicket = Boolean(runner.activeTicketId);
  const stateSignalText = [runner.activeItem, runner.lastResult, runner.lastLogLine].join(" ").toLowerCase();
  const stateText = [stateSignalText, runner.conversationPreview].join(" ").toLowerCase();
  const isFailLike =
    status === "failed" ||
    /^(rejected|reject|fail|failed|error|adapter_exit_[1-9])$/.test(activeStage) ||
    /\bfailed\b|\berror\b|adapter_exit_[1-9]/.test(stateSignalText);

  if (role === "merge-bot" || role === "merge") {
    if (isFailLike || /\bmerge[-_]?blocked\b|\b_persistent\b|\bblocked_(?:cherry_pick|rebase|dirty_scope|missing_)/.test(stateText)) return "blocked";
    if (hasActiveTicket) return "merging";
    if (/event=post_merge_cleanup|\bstatus=done\b|\bintegrated\b/.test(stateText)) return "done";
    return "idle";
  }

  if (role.includes("wiki")) {
    if (isFailLike) return "blocked";
    if (status === "running" && (hasActiveTicket || /event=adapter_start|\bstatus=running\b/.test(stateText))) return "syncing";
    if (/event=adapter_finish.*status=ok|\bwiki_(?:updated|sync_ok)\b/.test(stateText)) return "done";
    return "idle";
  }

  if (role === "planner" || role === "plan") {
    const hasPlannerIdleSignal =
      /\bno_actionable_plan_input\b|\bidle_wait_for_backlog_or_reject\b|\bruntime_status=idle\b|\bstatus=idle\b/.test(stateText);
    if (isFailLike) return "blocked";
    if (hasPlannerIdleSignal && !hasActiveTicket && !runner.activeItem) return "idle";
    if (/\bsource=backlog-to-todo\b|\bsource=reject-replan\b|\btodo_ticket=/.test(stateText)) return "done";
    if (status === "running" && (hasActiveTicket || /\bevent=adapter_start\b/.test(stateText))) return "planning";
    return "idle";
  }

  if (isFailLike) return "reject";

  if (/\bcommitted_via_inline_merge\b|event=adapter_finish.*status=ok/.test(stateText)) return "done";

  if (hasActiveTicket) {
    if (/^(done|pass|complete|completed|committed_via_inline_merge)$/.test(activeStage)) return "done";
    if (/^(blocked|merge_blocked|merge-blocked|rejected|reject)$/.test(activeStage)) return "reject";
    if (/^(executing|claimed|inprogress|verifying|verifier|ready_for_verification|ready_to_merge|ready-to-merge|review|merging)$/.test(activeStage)) {
      return "inprogress";
    }
    return "inprogress";
  }

  if (/\bdone\b|\bpass\b|\bcomplete\b|adapter_exit_0/.test(stateText)) return "done";

  return "todo";
}

function runnerHeartbeatStale(runner: AutoflowRunner) {
  if ((runner.stateStatus || "").toLowerCase() !== "running") return false;
  if (!runner.lastEventAt) return false;
  const eventTime = new Date(runner.lastEventAt).getTime();
  if (Number.isNaN(eventTime)) return false;
  const ageSec = (Date.now() - eventTime) / 1000;
  const intervalSec = Number(runner.intervalEffectiveSeconds || runner.intervalSeconds || 60) || 60;
  return ageSec > Math.max(intervalSec * 3, 180);
}

function runnerProgressDetail(runner: AutoflowRunner) {
  if (runner.activeTicketTitle) {
    return runner.activeTicketTitle;
  }

  if (runner.activeItem) {
    return runner.activeItem;
  }

  if (runner.lastResult) {
    return displayStatus(runner.lastResult);
  }

  if (runner.lastLogLine) {
    return runner.lastLogLine;
  }

  return runnerIsEnabled(runner.enabled) ? "대기 중 — 처리할 백로그/티켓 없음" : "중지됨";
}

function timestampFromRunnerLog(value: string) {
  return value.match(/\btimestamp=([^\s]+)/)?.[1] || "";
}

function isMachineRunnerLog(value: string) {
  return Boolean(timestampFromRunnerLog(value)) && /^timestamp=\S+(\s+\w+=\S+)*$/.test(value.trim());
}

function displayWorkflowRunnerId(value: string) {
  if (!value) return value;
  if (/^owner-/.test(value)) return value.replace(/^owner-/, "AI-");
  if (/^worker-/.test(value)) return value.replace(/^worker-/, "AI-");
  if (value === "merge-1") return "머지봇";
  if (/^merge-\d+$/.test(value)) return value.replace(/^merge-/, "머지봇-");
  if (value === "wiki-maintainer-1" || value === "wiki-1") return "위키봇";
  if (/^wiki-maintainer-\d+$/.test(value)) return value.replace(/^wiki-maintainer-/, "위키봇-");
  if (/^wiki-\d+$/.test(value)) return value.replace(/^wiki-/, "위키봇-");
  if (value === "coordinator-1") return "coordinator";
  return value;
}

function isCoordinatorRole(value: string) {
  return ["coordinator", "coord", "doctor", "diagnose"].includes((value || "").toLowerCase());
}

function displayProgressRunnerLabel(runner: AutoflowRunner) {
  const agent = runner.agent || "AI";
  return isCoordinatorRole(runner.role) ? `${agent}(coordinator)` : agent;
}

function displayProgressRoleLabel(runner: AutoflowRunner) {
  const role = (runner.role || "").toLowerCase();
  if (role === "planner" || role === "plan") return "Planner";
  if (role === "ticket-owner" || role === "owner") return "Worker";
  if (role === "wiki-maintainer" || role === "wiki" || role.includes("wiki")) return "위키봇";

  const metaLabel = displayWorkflowRunnerId(runner.id);
  const agentName = runner.agent ? runner.agent.charAt(0).toUpperCase() + runner.agent.slice(1) : "AI";
  return metaLabel ? `${agentName}(${metaLabel})` : agentName;
}

function AgentAppIcon({ agent }: { agent: string }) {
  const agentKey = (agent || "").toLowerCase();
  const iconAsset =
    agentKey === "codex"
      ? codexAppIcon
      : agentKey === "claude"
        ? claudeAppIcon
        : agentKey === "gemini"
          ? geminiAppIcon
          : "";

  if (iconAsset) {
    return (
      <span className="ai-agent-app-icon ai-agent-app-icon-image" aria-hidden="true">
        <img src={iconAsset} alt="" />
      </span>
    );
  }

  const iconClassName = `ai-agent-app-icon ai-agent-app-icon-${agentKey || "default"}`;

  return (
    <span className={iconClassName} aria-hidden="true">
      <Sparkles size={13} strokeWidth={2.2} />
    </span>
  );
}

function projectKeyFromSpecRef(value: string) {
  return value.match(/(prd_\d+|project_\d+)/)?.[1] || "";
}

function activeTicketSummary(runner: AutoflowRunner) {
  if (!runner.activeTicketId) {
    return "";
  }

  const title = runner.activeTicketTitle || runner.activeItem || "제목 없음";
  const projectKey = projectKeyFromSpecRef(runner.activeSpecRef);
  return projectKey ? `${runner.activeTicketId} — ${title} (${projectKey})` : `${runner.activeTicketId} — ${title}`;
}

function activeTicketPath(runner: AutoflowRunner) {
  return runner.activeTicketId ? `tickets/inprogress/${runner.activeTicketId}.md` : "";
}

function AiProgressRow({
  runner,
  onSelect: _onSelect,
  installedAgentProfiles,
  options,
  actionKey = "",
  draft,
  onSelectRunner,
  onControl,
  onDraftChange,
  onConfigure
}: {
  runner: AutoflowRunner;
  onSelect: (filePath: string) => void;
  installedAgentProfiles?: InstalledAgentProfiles;
  options?: { projectRoot: string; boardDirName: string };
  actionKey?: string;
  draft?: RunnerDraft;
  onSelectRunner?: (runnerId: string) => void;
  onControl?: (action: "start" | "stop" | "restart", runnerId: string) => void;
  onDraftChange?: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure?: (runner: AutoflowRunner) => void;
}) {
  const currentKey = runnerStageKey(runner);
  const hideProgressTrack = isCoordinatorRole(runner.role);
  const flowStages = flowStagesForRunner(runner);
  const stage = flowStages.find((candidate) => candidate.key === currentKey) || flowStages[Math.min(1, flowStages.length - 1)];
  const stageIndex = flowStages.findIndex((candidate) => candidate.key === currentKey);
  const stageCount = Math.max(1, flowStages.length);
  const progressFillPercent = stageIndex > 0 ? (stageIndex / stageCount) * 100 : 0;
  const progressValue = progressFillPercent <= 0 ? "0px" : `${progressFillPercent}%`;
  const status = runner.stateStatus || "idle";
  const role = (runner.role || "").toLowerCase();
  const isWorkerProgressRow = role === "ticket-owner" || role === "owner" || role === "ticket";
  const isBlocked = (runner.activeStage || "").toLowerCase() === "blocked";
  const detail = runnerProgressDetail(runner);
  const detailTimestamp = timestampFromRunnerLog(detail);
  const displayDetail = isMachineRunnerLog(detail) ? "" : detail;
  const ticketSummary = activeTicketSummary(runner);
  const detailText = ticketSummary && detail === runner.activeTicketTitle ? "" : displayDetail;
  const agentLabel = displayProgressRunnerLabel(runner);
  const agentTitle = displayProgressRoleLabel(runner);
  const tokenUsageValue = typeof runner.tokenUsage === "number" ? runner.tokenUsage : 0;
  const animatedTokenUsage = useCountUp(tokenUsageValue);
  const tokenUsageLabel = animatedTokenUsage > 0 ? `${formatCount(animatedTokenUsage)} 토큰 사용` : "";
  const conversationText = runnerConversationText(runner);
  const showConversation = shouldShowConversation(runner);
  const statusLower = status.toLowerCase();
  const mode = "loop";
  const isWorking = actionKey.endsWith(`:${runner.id}`);
  const canStart = mode === "loop";
  const canStop = statusLower === "running" || Boolean(runner.pid);
  const canEditConfig = statusLower !== "running";
  const runnerDraft = draft || {
    agent: runner.agent || "codex",
    model: runner.model || "",
    reasoning: runner.reasoning || "",
    mode,
    intervalSeconds: runner.intervalSeconds || "60",
    enabled: runner.enabled || "true",
    command: runner.command || ""
  };
  const canConfigure = Boolean(onSelectRunner && onDraftChange && onConfigure);
  const canControl = Boolean(onSelectRunner && onControl);

  const [ticketDialogOpen, setTicketDialogOpen] = React.useState(false);
  const [ticketContent, setTicketContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [ticketLoading, setTicketLoading] = React.useState(false);
  const [ticketError, setTicketError] = React.useState("");

  const openTicketDialog = React.useCallback(async () => {
    if (!runner.activeTicketId) return;
    setTicketDialogOpen(true);
    setTicketContent(null);
    setTicketError("");
    if (!options?.projectRoot) {
      setTicketError("프로젝트 루트가 설정되어 있지 않습니다.");
      return;
    }
    const boardDir = options.boardDirName || ".autoflow";
    const projectRoot = options.projectRoot.replace(/[\\/]+$/, "");
    const ticketFile = `${runner.activeTicketId}.md`;
    const candidatePaths = [
      `${projectRoot}/${boardDir}/tickets/inprogress/${ticketFile}`,
      `${projectRoot}/${boardDir}/tickets/todo/${ticketFile}`,
      `${projectRoot}/${boardDir}/tickets/verifier/${ticketFile}`,
      `${projectRoot}/${boardDir}/tickets/reject/${ticketFile}`
    ];
    setTicketLoading(true);
    try {
      let lastError = "";
      for (const candidate of candidatePaths) {
        const result = await window.autoflow.readBoardFile({
          projectRoot: options.projectRoot,
          boardDirName: options.boardDirName,
          filePath: candidate
        });
        if (result.ok) {
          setTicketContent(result);
          setTicketError("");
          return;
        }
        lastError = result.stderr || lastError;
      }
      setTicketError(lastError || "티켓 파일을 찾을 수 없습니다.");
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : "티켓을 불러오지 못했습니다.");
    } finally {
      setTicketLoading(false);
    }
  }, [options, runner.activeTicketId]);

  return (
    <article
      data-runner-role={runner.role}
      className={`ai-progress-row ai-progress-${currentKey}${isWorkerProgressRow ? " ai-progress-row-worker" : ""}${
        hideProgressTrack ? " ai-progress-row-no-track" : ""
      }`}
    >
      <div className="ai-progress-row-top">
        <div className="ai-progress-agent">
          <div>
            <div className="ai-progress-agent-title">
              <AgentAppIcon agent={runner.agent || ""} />
              <strong>{agentTitle}</strong>
            </div>
            {tokenUsageLabel ? (
              <span className="ai-progress-token-usage">{tokenUsageLabel}</span>
            ) : null}
          </div>
        </div>
        {!hideProgressTrack ? (
          <div
            className={`ai-progress-track ${currentKey === "reject" || currentKey === "blocked" ? "ai-progress-track-reject" : ""}`}
            style={{ "--progress-value": progressValue, "--stage-count": String(flowStages.length) } as React.CSSProperties}
            aria-label={`${agentLabel} 현재 단계 ${stage.label}`}
          >
            {flowStages.map((step) => {
              const stepState = flowStepState(step.key, currentKey, flowStages);
              return (
                <div key={step.key} className={`ai-progress-step ai-progress-step-${stepState}`}>
                  <span className={`ai-progress-dot ${step.tone}`} aria-hidden="true" />
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {canControl ? (
          <div className="ai-progress-actions" aria-label={`${agentTitle} 제어`}>
            {canStop ? (
              <Button
                variant="outline"
                size="icon"
                className="runner-icon-button runner-plain-icon-button"
                title="중지"
                data-tooltip="중지"
                aria-label={`${runner.id} 중지`}
                disabled={Boolean(actionKey)}
                onClick={() => {
                  onSelectRunner?.(runner.id);
                  onControl?.("stop", runner.id);
                }}
              >
                {isWorking && actionKey.startsWith("stop:") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="runner-icon-button runner-plain-icon-button"
                title={mode === "loop" ? "시작" : "반복 모드에서만 시작할 수 있습니다"}
                data-tooltip={mode === "loop" ? "시작" : "반복 모드에서만 시작할 수 있습니다"}
                aria-label={`${runner.id} 시작`}
                disabled={!canStart || Boolean(actionKey)}
                onClick={() => {
                  onSelectRunner?.(runner.id);
                  onControl?.("start", runner.id);
                }}
              >
                {isWorking && actionKey.startsWith("start:") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="ai-progress-current">
        <Badge
          variant={isBlocked ? "destructive" : "secondary"}
          className="ai-progress-status-badge"
        >
          {isBlocked ? "막힘" : displayStatus(status)}
        </Badge>
        {detailText ? <p title={detailText}>{detailText}</p> : null}
        {runnerHeartbeatStale(runner) ? (
          <Badge
            variant="destructive"
            className="ai-progress-stale-badge"
            title="3분 이상 새 이벤트가 없습니다 — 어댑터 락 대기 또는 멈춤 가능성"
          >
            응답 지연
          </Badge>
        ) : null}
        {runner.activeTicketId ? (
          <button
            type="button"
            className="ai-progress-active-ticket-button"
            onClick={openTicketDialog}
            title={`#${runner.activeTicketId} 티켓 보기`}
          >
            <Badge variant="outline" className="ai-progress-active-ticket">
              #{runner.activeTicketId}
            </Badge>
          </button>
        ) : null}
      </div>
      {canConfigure ? (
        <RunnerConfigControls
          runner={runner}
          installedAgentProfiles={installedAgentProfiles || {}}
          actionKey={actionKey}
          draft={runnerDraft}
          canEditConfig={canEditConfig}
          onSelectRunner={onSelectRunner!}
          onDraftChange={onDraftChange!}
          onConfigure={onConfigure!}
          showAgent={false}
          className="ai-progress-config runner-config"
        />
      ) : null}
      {showConversation ? (
        <ConversationStream label={`${agentLabel} 최근 터미널 출력`} text={conversationText} streamId={`progress:${runner.id}`} />
      ) : null}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent
          className="workflow-pin-layer-panel workflow-pin-layer-default"
          overlayClassName="workflow-pin-layer-overlay"
          aria-describedby={undefined}
        >
          <div className="workflow-pin-layer-header">
            <div className="workflow-pin-layer-heading">
              <KanbanSquare className="h-4 w-4" aria-hidden="true" />
              <DialogTitle asChild>
                <strong>
                  {runner.activeTicketId
                    ? workflowFileDisplayName(`${runner.activeTicketId}.md`)
                    : "티켓"}
                  {runner.activeTicketTitle ? (
                    <span className="ai-ticket-dialog-subtitle"> · {runner.activeTicketTitle}</span>
                  ) : null}
                </strong>
              </DialogTitle>
            </div>
            <button
              type="button"
              className="workflow-pin-layer-close"
              onClick={() => setTicketDialogOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <div className="workflow-pin-detail">
            {ticketLoading ? (
              <div className="workflow-pin-detail-loading">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>불러오는 중…</span>
              </div>
            ) : null}
            {ticketError ? <div className="workflow-pin-detail-error">{ticketError}</div> : null}
            {!ticketError && ticketContent ? (
              <div className="workflow-pin-detail-body">
                {ticketContent.content ? (
                  <MarkdownViewer content={ticketContent.content} />
                ) : (
                  <p className="workflow-pin-detail-empty">(비어 있음)</p>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </article>
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
    return <div className="empty-panel">로그가 없습니다</div>;
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
              {log.source === "Board" ? "보드" : "AI"} · {formatDate(log.modifiedAt)}
            </span>
            <p>{log.title}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function WikiQueryPanel({
  query,
  onQueryChange,
  onSubmit,
  isRunning,
  result,
  selectedPath,
  onSelect,
  includeTickets,
  onIncludeTicketsChange,
  includeHandoffs,
  onIncludeHandoffsChange
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  isRunning: boolean;
  result: WikiQueryParsed | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
  includeTickets: boolean;
  onIncludeTicketsChange: (value: boolean) => void;
  includeHandoffs: boolean;
  onIncludeHandoffsChange: (value: boolean) => void;
}) {
  return (
    <div className="wiki-query-panel">
      <form
        className="wiki-query-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="검색어를 띄어쓰기로 구분해 입력하세요 (예: auth session)"
          aria-label="위키 검색어"
          className="wiki-query-input"
        />
        <Button type="submit" variant="default" size="sm" disabled={isRunning}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span>검색</span>
        </Button>
      </form>
      <div className="wiki-query-toggles">
        <label>
          <input
            type="checkbox"
            checked={includeTickets}
            onChange={(event) => onIncludeTicketsChange(event.target.checked)}
          />
          완료/거절 티켓 포함
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeHandoffs}
            onChange={(event) => onIncludeHandoffsChange(event.target.checked)}
          />
          인수인계 포함
        </label>
      </div>
      {result ? (
        result.results.length === 0 ? (
          <div className="empty-panel">일치하는 결과가 없습니다</div>
        ) : (
          <div className="log-list wiki-query-results">
            {result.results.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`log-row${selectedPath === entry.path ? " log-row-selected" : ""}`}
                onClick={() => onSelect(entry.path)}
              >
                <Search className="h-4 w-4" />
                <div className="min-w-0">
                  <strong>{entry.title}</strong>
                  <span>
                    {WIKI_QUERY_KIND_LABEL[entry.kind] || entry.kind} · score {entry.score} · {entry.path}
                  </span>
                  {entry.snippets.length ? (
                    <p title={entry.snippets.map((snip) => `L${snip.line}: ${snip.text}`).join("\n")}>
                      L{entry.snippets[0].line}: {entry.snippets[0].text}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )
      ) : null}
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
            <span>Wiki · {formatDate(page.modifiedAt)}</span>
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
      <div className="knowledge-source-header">
        <span>Conversation handoff inputs</span>
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
                <span>Source · Handoff · {formatDate(handoff.modifiedAt)}</span>
                <p>{handoff.title}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-panel handoff-empty">No source handoffs</div>
      )}
    </div>
  );
}

function LogPreview({
  preview,
  isLoading,
  error,
  headerAction
}: {
  preview: AutoflowFileContentResult | null;
  isLoading: boolean;
  error: string;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="log-preview">
      <div className="log-preview-header">
        <strong>{preview?.name || "로그 미리보기"}</strong>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {!isLoading && preview?.truncated ? (
          <Badge variant="outline" className="log-preview-badge">
            일부만 표시
          </Badge>
        ) : null}
        {headerAction}
      </div>
      {error ? <div className="log-preview-error">{error}</div> : null}
      {!error && preview ? <pre>{preview.content || "(비어 있음)"}</pre> : null}
      {!error && !preview ? <div className="empty-panel log-preview-empty">선택된 로그가 없습니다</div> : null}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={desktopTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
