import * as React from "react";
import { createRoot } from "react-dom/client";
import AnsiToHtml from "ansi-to-html";
import { Terminal as XTermTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpenText,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Asterisk,
  ClipboardList,
  Clock3,
  FolderOpen,
  FolderPlus,
  Inbox,
  KanbanSquare,
  Layers3,
  Loader2,
  Moon,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Terminal,
  TriangleAlert,
  PieChart,
  Trash2,
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
import { cn } from "@/lib/utils";
import "./styles.css";
import claudeAppIcon from "./assets/agent-icons/claude.png";
import codexAppIcon from "./assets/agent-icons/codex.png";
import geminiAppIcon from "./assets/agent-icons/gemini.png";

type AlertSeverity = "error" | "warning" | "info" | "success";
type ThemeMode = "light" | "dark";

function readThemeMode(): ThemeMode {
  return initialSetting("autoflow.theme", "dark") === "light" ? "light" : "dark";
}

function AlertBox({
  severity,
  className,
  children,
  onClose,
  role = "alert"
}: {
  severity: AlertSeverity;
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
  role?: React.AriaRole;
}) {
  return (
    <div className={cn("af-alert", `af-alert-${severity}`, className)} role={role}>
      <div className="af-alert-content">{children}</div>
      {onClose ? (
        <Button type="button" variant="ghost" size="icon" className="af-alert-close" onClick={onClose} aria-label="닫기">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

const ticketFolders = ["backlog", "inbox", "todo", "inprogress", "done"] as const;

function DesktopGlobalLoading({
  open,
  label = "로딩 중"
}: {
  open: boolean;
  label?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="desktop-global-loading-backdrop">
      <div className="desktop-global-loading-content" role="status" aria-live="polite" aria-label={label}>
        <Loader2 className="desktop-global-loading-spinner" aria-hidden="true" />
        <span className="desktop-global-loading-text">{label}</span>
      </div>
    </div>
  );
}

function FullPageLoading({
  open,
  label = "로딩 중"
}: {
  open: boolean;
  label?: string;
}) {
  return <DesktopGlobalLoading open={open} label={label} />;
}

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
    "gemini-3-flash-preview",
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
  codex: {
    low: "낮음 (fast)",
    medium: "보통",
    high: "높음",
    xhigh: "매우 높음"
  },
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
  { key: "progress", label: "AI Autoflow", icon: Workflow },
  { key: "kanban", label: "티켓", icon: KanbanSquare },
  { key: "knowledge", label: "LLM Wiki", icon: BookOpenText },
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

type RunnerConfigApplyPending = {
  fingerprint: string;
  startedAtMs: number;
  timeoutAtMs: number;
  restartAfterSave: boolean;
};

type RunnerAuthChoice = "continue" | "cancel";
type RunnerControlAction = "start" | "stop" | "restart";
type RunnerControlOptions = {
  force?: boolean;
};

type RunnerTransitionPending = {
  action: RunnerControlAction;
  startedAtMs: number;
  timeoutAtMs: number;
  initialStatus: string;
  initialPid: string;
  initialStartedAt: string;
};

type RunnerWithConfigEvidence = AutoflowRunner & {
  configFingerprint?: string;
  appliedConfigFingerprint?: string;
  configAppliedAt?: string;
  configUpdatedAt?: string;
};

type InstalledAgentProfiles = AutoflowInstalledAgentProfiles;

type DisplayLog = AutoflowFilePreview & {
  source: "Board" | "Runner";
};

const runnerTransitionTimeoutMs = 60_000;
const runnerTransitionActionKeys = new Set(["starting", "stopping_pending", "stopping_force", "restarting"]);

function runnerActionKeyForControl(action: RunnerControlAction, force = false) {
  if (action === "start") return "starting";
  if (action === "restart") return "restarting";
  return force ? "stopping_force" : "stopping_pending";
}

function runnerActionIsTransition(actionKey: string) {
  return runnerTransitionActionKeys.has(actionKey);
}

function runnerTransitionLabel(actionKey: string) {
  switch (actionKey) {
    case "starting":
      return "시작 중...";
    case "stopping_pending":
      return "중지 예약 중...";
    case "stopping_force":
      return "강제 종료 중...";
    case "restarting":
      return "재시작 중...";
    default:
      return "";
  }
}

function runnerTransitionTargetObserved(runner: AutoflowRunner, pending: RunnerTransitionPending) {
  const status = (runner.stateStatus || "").toLowerCase();
  if (pending.action === "start") {
    return status === "running";
  }
  if (pending.action === "stop") {
    return status === "stopped";
  }
  if (pending.action === "restart") {
    return (
      status === "running" &&
      (runner.startedAt !== pending.initialStartedAt || runner.pid !== pending.initialPid || pending.initialStatus !== "running")
    );
  }
  return false;
}

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

type ProjectExistsResult = boolean | { exists: boolean };

function readProjectExistsResult(result: ProjectExistsResult) {
  if (typeof result === "boolean") {
    return result;
  }

  return Boolean(result?.exists);
}

async function filterExistingRecentProjects(projects: string[]) {
  const normalized = normalizeProjectList(projects);
  if (!normalized.length) {
    return [];
  }

  const validatedEntries = await Promise.all(
    normalized.map(async (project) => {
      try {
        const result = await window.autoflow.projectExists(project);
        return {
          project,
          exists: readProjectExistsResult(result)
        };
      } catch {
        return { project, exists: false };
      }
    })
  );

  return validatedEntries.filter((entry) => entry.exists).map((entry) => entry.project);
}

function projectExistsPathLabel(projectRoot: string) {
  return projectRoot ? `"${basename(projectRoot)}" 프로젝트 폴더를 찾을 수 없습니다.` : "프로젝트 폴더를 찾을 수 없습니다.";
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
    doneTicketCount: statusNumber(metrics, "ticket_done_count"),
    codeFilesChangedCount: statusNumber(metrics, "autoflow_code_files_changed_count"),
    codeInsertionsCount: statusNumber(metrics, "autoflow_code_insertions_count"),
    codeDeletionsCount: statusNumber(metrics, "autoflow_code_deletions_count"),
    codeVolumeCount: statusNumber(metrics, "autoflow_code_volume_count"),
    tokenUsageCount: statusNumber(metrics, "autoflow_token_usage_count"),
    tokenReportCount: statusNumber(metrics, "autoflow_token_report_count"),
    avgLeadSeconds: statusNumber(metrics, "autoflow_avg_lead_seconds"),
    avgActiveSeconds: statusNumber(metrics, "autoflow_avg_active_seconds"),
    avgTicksPerDoneTicket: statusNumber(metrics, "autoflow_avg_ticks_per_done_ticket"),
    durationTotal24hSeconds: statusNumber(metrics, "autoflow_duration_total_24h_seconds")
  };
}

function formatDurationMetric(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const formatter = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: safeSeconds < 60 ? 0 : 1
  });

  if (safeSeconds < 60) {
    return `${formatter.format(Math.round(safeSeconds))}초`;
  }

  if (safeSeconds < 3600) {
    return `${formatter.format(safeSeconds / 60)}분`;
  }

  return `${formatter.format(safeSeconds / 3600)}h`;
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
  adapter_auth_required: "인증 필요",
  dry_run: "미리 실행",
  true: "사용",
  false: "중지"
};

// Default topology is Planner AI + Impl AI + Wiki AI. Legacy role labels are
// kept so older boards with coordinator / merge runners still render readable
// names.
const runnerRoleLabels: Record<string, string> = {
  "ticket-owner": "Impl AI",
  owner: "Impl AI",
  ticket: "Impl AI",
  planner: "Planner",
  plan: "Planner",
  "wiki-maintainer": "Wiki AI",
  wiki: "Wiki AI",
  coordinator: "coordinator (legacy)",
  coord: "coordinator (legacy)",
  doctor: "coordinator (legacy)",
  diagnose: "coordinator (legacy)",
  todo: "작업자 (legacy)",
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

function runnerAppliedConfigFingerprint(runner: AutoflowRunner) {
  return (runner as RunnerWithConfigEvidence).appliedConfigFingerprint || "";
}

function runnerConfigApplyTimeoutMs(runner: AutoflowRunner) {
  const intervalSeconds = Number(runner.intervalEffectiveSeconds || runner.intervalSeconds || 60);
  const safeIntervalSeconds = Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 60;
  return Math.max((safeIntervalSeconds + 30) * 1000, 90 * 1000);
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
      "claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format stream-json --include-partial-messages --verbose",
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
    return ["gemini --skip-trust --approval-mode auto_edit --prompt prompt", model ? `--model ${shellArg(model)}` : ""]
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

function aiConversationPanelStatus(runner: AutoflowRunner) {
  const status = runner.stateStatus;

  if (status === "running" || Boolean(runner.pid)) {
    return {
      className: "ai-conversation-panel-status-running",
      dot: "●",
      label: "실행 중"
    };
  }

  if (status === "stopped") {
    return {
      className: "ai-conversation-panel-status-stopped",
      dot: "○",
      label: "정지"
    };
  }

  if (status === "blocked" || status === "needs_user") {
    return {
      className: "ai-conversation-panel-status-blocked",
      dot: "⚠",
      label: "막힘"
    };
  }

  return {
    className: "ai-conversation-panel-status-idle",
    dot: "◌",
    label: "대기"
  };
}

function runnerIsEnabled(value: string) {
  return value ? value === "true" : true;
}

// AI 주도 sh 실행 원칙: Codex/Claude 같은 어댑터의 raw transcript 가
// 그대로 들어 있는 파일 (`*_live_stdout.log`, `*_live_stderr.log`,
// `*_stdout.log`, `*_stderr.log`) 은 사용자 view 에서 숨긴다. envelope
// wrapping 없이 raw tool 호출 / diff / shell 명령이 그대로 들어 있어 필터로
// 정리할 수 없다. AI 의 narrative 는 같은 tick 의 runner 메인 로그에
// `narrative_text` envelope 으로 surface 되므로 그쪽으로 노출한다. 단,
// LiveTerminalView 는 active Claude stream-json stdout 만 별도 parser 로
// 사람이 읽는 한 줄 요약으로 변환해 붙인다. 필요하면 `.autoflow/runners/logs/`
// 의 원본 파일을 파일 시스템에서 직접 확인한다.
const RAW_ADAPTER_TRANSCRIPT_FILE = /_(?:live_)?(?:stdout|stderr)\.log$/;
function isRawAdapterTranscriptFile(filePath: string) {
  return RAW_ADAPTER_TRANSCRIPT_FILE.test(filePath);
}

function recentLogs(board: AutoflowBoardSnapshot | null, limit: number | null = 16): DisplayLog[] {
  const boardLogs = (board?.logs || []).map((log) => ({ ...log, source: "Board" as const }));
  const runnerLogs = (board?.runnerLogs || [])
    .filter((log) => !isRawAdapterTranscriptFile(log.filePath))
    .map((log) => ({ ...log, source: "Runner" as const }));

  const sorted = [...boardLogs, ...runnerLogs].sort((a, b) =>
    String(b.modifiedAt || "").localeCompare(String(a.modifiedAt || ""))
  );
  return limit == null ? sorted : sorted.slice(0, limit);
}

function selectableBoardFiles(board: AutoflowBoardSnapshot | null) {
  if (!board) {
    return [];
  }

  const ticketFiles = [
    ...ticketFolders.flatMap((key) => board.tickets[key] || []),
    ...(board.tickets.check || [])
  ];
  const visibleRunnerLogs = (board.runnerLogs || []).filter((log) => !isRawAdapterTranscriptFile(log.filePath));

  return [
    ...ticketFiles,
    ...(board.logs || []),
    ...visibleRunnerLogs,
    ...(board.wikiFiles || []),
    ...(board.metricsFiles || []),
    ...(board.conversationFiles || [])
  ];
}

function boardFileKind(filePath: string) {
  if (filePath.includes("/tickets/")) {
    return "티켓";
  }
  if (filePath.includes("/wiki/")) {
    return "위키";
  }
  if (filePath.includes("/metrics/")) {
    return "지표";
  }
  if (filePath.includes("/conversations/")) {
    return "소스 · 전달함";
  }
  if (filePath.includes("/runners/logs/")) {
    return "AI";
  }
  if (filePath.includes("/logs/")) {
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

function runnerRecoveryInProgress(runner: AutoflowRunner) {
  const activeStage = (runner.activeStage || "").toLowerCase();
  const activeRecoveryStatus = (runner.activeRecoveryStatus || "").toLowerCase();
  return activeStage === "blocked" && ["repairing", "requeued"].includes(activeRecoveryStatus);
}

function runnersNeedingAttention(runners: AutoflowRunner[]) {
  return runners.filter((runner) => {
    if ((runner.enabled || "").toLowerCase() === "false") return false;
    const stateStatus = (runner.stateStatus || "").toLowerCase();
    const activeStage = (runner.activeStage || "").toLowerCase();
    const activeRecoveryStatus = (runner.activeRecoveryStatus || "").toLowerCase();
    const lastResult = (runner.lastResult || "").toLowerCase();
    const recoveryInProgress = runnerRecoveryInProgress(runner);
    return (
      runnerHealthNeedsAttention(stateStatus) ||
      (!recoveryInProgress && runnerHealthNeedsAttention(activeStage)) ||
      runnerHealthNeedsAttention(activeRecoveryStatus) ||
      runnerHealthNeedsAttention(lastResult)
    );
  });
}

function runnerHealthToastKey(runners: AutoflowRunner[]) {
  return runners
    .map((runner) =>
      [
        runner.id,
        runner.stateStatus,
        runner.activeStage,
        runner.activeRecoveryStatus,
        runner.activeRecoveryFailureClass,
        runner.lastResult
      ].join(":")
    )
    .join("|");
}

function runnerHealthToastMessage(unhealthy: AutoflowRunner[], allRunners: AutoflowRunner[]) {
  // Single-flow design: every worker fail routes through inbox retry orders,
  // so raw failure_class / recovery_status / last_result are noise here. We
  // only surface the runner display name and its top-level stateStatus
  // (running / idle / blocked / failed) — actionable retry context lives in
  // the inbox retry order itself.
  const preview = unhealthy.slice(0, 3).map((runner) => {
    const display = displayWorkflowRunnerId(runner.id, allRunners);
    const status = runner.stateStatus ? displayStatus(runner.stateStatus) : "";
    return status ? `${display} — ${status}` : display;
  });
  const suffix = unhealthy.length > preview.length ? ` 외 ${unhealthy.length - preview.length}개` : "";
  return `런너 점검 필요 (${unhealthy.length}): ${preview.join(" / ")}${suffix}`;
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
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readThemeMode());
  const [installedAgentProfiles, setInstalledAgentProfiles] = React.useState<InstalledAgentProfiles>({});
  // Per-runner action tracker. Key = runner.id, value = action label
  // ("starting" / "stopping_pending" / "run" / "dry-run" / "config"). A globally
  // shared string used to gate every button at once; the new map lets each
  // runner's button disable independently so users can fire start/stop on
  // multiple runners in parallel.
  const [runnerActionKeys, setRunnerActionKeys] = React.useState<Record<string, string>>({});
  const runnerTransitionPendingRef = React.useRef<Record<string, RunnerTransitionPending>>({});
  const [runnerConfigApplyPending, setRunnerConfigApplyPending] = React.useState<Record<string, RunnerConfigApplyPending>>({});
  const setRunnerAction = React.useCallback((runnerId: string, action: string) => {
    setRunnerActionKeys((prev) => {
      if (action) {
        if (prev[runnerId] === action) return prev;
        return { ...prev, [runnerId]: action };
      }
      delete runnerTransitionPendingRef.current[runnerId];
      if (!(runnerId in prev)) return prev;
      const { [runnerId]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);
  const beginRunnerTransition = React.useCallback(
    (runner: AutoflowRunner, action: RunnerControlAction, force = false) => {
      const now = Date.now();
      runnerTransitionPendingRef.current[runner.id] = {
        action,
        startedAtMs: now,
        timeoutAtMs: now + runnerTransitionTimeoutMs,
        initialStatus: (runner.stateStatus || "").toLowerCase(),
        initialPid: runner.pid || "",
        initialStartedAt: runner.startedAt || ""
      };
      setRunnerAction(runner.id, runnerActionKeyForControl(action, force));
    },
    [setRunnerAction]
  );
  const [runnerError, setRunnerError] = React.useState("");
  const [runnerDrafts, setRunnerDrafts] = React.useState<Record<string, RunnerDraft>>({});
  const [runnerSavedDrafts, setRunnerSavedDrafts] = React.useState<Record<string, RunnerDraft>>({});
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
  const [globalToast, setGlobalToast] = React.useState<{
    severity: "error" | "warning" | "info" | "success";
    message: string;
  } | null>(null);
  const wikiQueryInvocationIdRef = React.useRef<string>("");
  const [metricsActionKey, setMetricsActionKey] = React.useState("");
  const [metricsError, setMetricsError] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState("");
  const [recentProjects, setRecentProjects] = React.useState(() => readRecentProjects(projectRoot));
  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const [isRefreshingRecentProjects, setIsRefreshingRecentProjects] = React.useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = React.useState<SettingsSection>(() => {
    const stored = initialSetting("autoflow.activeSettingsSection", "progress");
    if (stored === "general" || stored === "automation" || stored === "stop-hook" || stored === "watcher" || stored === "doctor" || stored === "chat") {
      return "progress";
    }
    return settingsNavigation.some((item) => item.key === stored) ? (stored as SettingsSection) : "progress";
  });
  const projectSwitcherRef = React.useRef<HTMLDivElement>(null);
  const previousSettingsSectionRef = React.useRef<SettingsSection>(activeSettingsSection);
  const authToastKeyRef = React.useRef("");
  const runnerHealthToastKeyRef = React.useRef("");

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder.trim() || fallbackFlowFolder }),
    [defaultFlowFolder, projectRoot]
  );
  const autoRefreshInFlightRef = React.useRef(false);

  React.useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("autoflow.theme", themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    if (!globalToast) return;
    const timeout = window.setTimeout(() => setGlobalToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [globalToast]);

  const pushToast = React.useCallback(
    (severity: "error" | "warning" | "info" | "success", message: string) => {
      const trimmed = (message || "").trim();
      if (!trimmed) {
        setGlobalToast(null);
        return;
      }
      setGlobalToast({ severity, message: trimmed });
    },
    []
  );

  React.useEffect(() => {
    if (setupError) pushToast("error", setupError);
  }, [setupError, pushToast]);
  React.useEffect(() => {
    if (runnerError) pushToast("error", runnerError);
  }, [runnerError, pushToast]);
  React.useEffect(() => {
    if (wikiError) pushToast("error", wikiError);
  }, [wikiError, pushToast]);
  React.useEffect(() => {
    if (metricsError) pushToast("error", metricsError);
  }, [metricsError, pushToast]);

  React.useEffect(() => {
    const authRunner = (board?.runners || []).find((runner) => runnerNeedsLogin(runner));
    if (!authRunner) {
      authToastKeyRef.current = "";
      return;
    }

    const toastKey = `${authRunner.id}:${authRunner.authMessage || ""}`;
    if (authToastKeyRef.current === toastKey) {
      return;
    }

    authToastKeyRef.current = toastKey;
    pushToast("warning", `${runnerLoginMessage(authRunner)} 러너 카드에서 Y 계속을 선택하세요.`);
  }, [board?.runners, pushToast]);

  React.useEffect(() => {
    const runners = board?.runners || [];
    const unhealthy = runnersNeedingAttention(runners);
    if (!unhealthy.length) {
      runnerHealthToastKeyRef.current = "";
      return;
    }

    const toastKey = runnerHealthToastKey(unhealthy);
    if (runnerHealthToastKeyRef.current === toastKey) {
      return;
    }

    runnerHealthToastKeyRef.current = toastKey;
    pushToast("warning", runnerHealthToastMessage(unhealthy, runners));
  }, [board?.runners, pushToast]);

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
        const configuredProjectRoot = (config as AutoflowAppConfig & { defaultProjectRoot?: string }).defaultProjectRoot;
        if (isMounted && !window.localStorage.getItem("autoflow.boardDirName")) {
          setDefaultFlowFolder(configuredBoardDirName);
        }
        if (isMounted && !window.localStorage.getItem("autoflow.projectRoot") && configuredProjectRoot) {
          setProjectRoot(configuredProjectRoot);
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
        return null;
      }

      setIsPageRefreshing(true);
      try {
        const snapshot = await window.autoflow.readBoard(targetOptions);
        setBoard(snapshot);
        setSetupError("");
        setLastUpdated(new Date().toISOString());
        return snapshot;
      } catch (error) {
        setBoard(null);
        setSetupError(error instanceof Error ? error.message : "Autoflow 상태를 확인하지 못했습니다.");
        return null;
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

    let cancelled = false;
    let pendingTimer: number | null = null;

    const refreshSnapshot = async () => {
      if (cancelled || autoRefreshInFlightRef.current) {
        return;
      }

      autoRefreshInFlightRef.current = true;
      try {
        await loadBoard();
      } catch (error) {
        // Swallow refresh errors so a single transient failure does not
        // leave the in-flight flag stuck and freeze the auto-refresh loop.
        // loadBoard already routes the error to setSetupError when it can.
        if (typeof console !== "undefined") {
          console.warn("autoflow.refreshSnapshot failed", error);
        }
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const scheduleRefresh = () => {
      if (cancelled) return;
      // Coalesce a burst of board change events from main.js. The main
      // process already debounces ~250ms; we add another small renderer-side
      // window so any in-flight load finishes before we kick off the next.
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
      }
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;
        void refreshSnapshot();
      }, 80);
    };

    // Initial snapshot load.
    void refreshSnapshot();

    // Event-driven refresh: main process pushes here when fs.watch sees
    // a relevant change inside .autoflow/{tickets,runners/state,wiki/skills-local}.
    const offBoardChange = window.autoflow.onBoardChange(() => {
      scheduleRefresh();
    });

    // Safety-net polling. fs.watch can miss events on edge cases (NFS,
    // file moves into the tree from outside, brief watcher errors). 30s
    // is rare enough to be cheap and catches anything the watcher dropped.
    const safetyInterval = window.setInterval(() => {
      void refreshSnapshot();
    }, 30000);

    return () => {
      cancelled = true;
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      window.clearInterval(safetyInterval);
      offBoardChange();
    };
  }, [loadBoard, options.projectRoot]);

  useAutomaticWikiUpdate(
    board,
    options,
    React.useCallback(async () => {
      await loadBoard();
    }, [loadBoard]),
    setWikiError
  );

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
    const invocationId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `wiki-query-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    wikiQueryInvocationIdRef.current = invocationId;
    try {
      const result = await window.autoflow.controlWiki({
        action: "query",
        terms,
        limit: 10,
        includeTickets: true,
        includeHandoffs: true,
        invocationId,
        ...options
      });
      if (result.cancelled) {
        setWikiError("위키 검색을 취소했습니다.");
        setWikiQueryResult(null);
        return;
      }
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
      const message = error instanceof Error ? error.message : "위키 검색에 실패했습니다.";
      setWikiError(`위키 검색 실패: ${message}`);
      setWikiQueryResult(null);
    } finally {
      wikiQueryInvocationIdRef.current = "";
      setWikiQueryRunning(false);
    }
  }, [
    board,
    options,
    wikiQueryInput,
    wikiQueryRunning
  ]);

  const cancelWikiQuery = React.useCallback(() => {
    const invocationId = wikiQueryInvocationIdRef.current;
    if (!invocationId) return;
    void window.autoflow.cancelInvocation(invocationId).catch(() => {
      // best effort — the user already sees the running state and a fresh
      // failure surface will come through runWikiQuery's own catch.
    });
  }, []);

  React.useEffect(() => {
    if (!board?.runners?.length) return;
    const now = Date.now();
    const runnersById = new Map(board.runners.map((runner) => [runner.id, runner]));
    const completedTransitions: string[] = [];
    const timedOutTransitions: string[] = [];

    for (const [runnerId, pending] of Object.entries(runnerTransitionPendingRef.current)) {
      const runner = runnersById.get(runnerId);
      if (!runner) {
        if (now >= pending.timeoutAtMs) timedOutTransitions.push(runnerId);
        continue;
      }
      if (runnerTransitionTargetObserved(runner, pending)) {
        completedTransitions.push(runnerId);
      } else if (now >= pending.timeoutAtMs) {
        timedOutTransitions.push(runnerId);
      }
    }

    for (const runnerId of [...completedTransitions, ...timedOutTransitions]) {
      setRunnerAction(runnerId, "");
    }
    if (timedOutTransitions.length) {
      setGlobalToast({
        severity: "warning",
        message: `${timedOutTransitions.join(", ")} runner state 확인이 실패했습니다. 새로고침 또는 재시도를 권장합니다.`
      });
    }
  }, [board?.runners, setRunnerAction]);

  React.useEffect(() => {
    const hasPendingTransition = Object.entries(runnerActionKeys).some(([, actionKey]) =>
      runnerActionIsTransition(actionKey)
    );
    if (!hasPendingTransition) return undefined;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const timedOut = Object.entries(runnerTransitionPendingRef.current)
        .filter(([, pending]) => now >= pending.timeoutAtMs)
        .map(([runnerId]) => runnerId);
      if (timedOut.length) {
        for (const runnerId of timedOut) {
          setRunnerAction(runnerId, "");
        }
        setGlobalToast({
          severity: "warning",
          message: `${timedOut.join(", ")} runner state 확인이 실패했습니다. 새로고침 또는 재시도를 권장합니다.`
        });
        return;
      }
      void loadBoard();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadBoard, runnerActionKeys, setRunnerAction]);

  React.useEffect(() => {
    if (!board?.runners?.length) return;
    const now = Date.now();
    const runnersById = new Map(board.runners.map((runner) => [runner.id, runner]));
    const completed: string[] = [];
    const timedOut: string[] = [];

    for (const [runnerId, pending] of Object.entries(runnerConfigApplyPending)) {
      const runner = runnersById.get(runnerId);
      if (!runner) continue;
      const applied = runnerAppliedConfigFingerprint(runner);
      const isApplied = Boolean(pending.fingerprint && applied && applied === pending.fingerprint);
      const isRestarted = !pending.restartAfterSave || (runner.stateStatus || "").toLowerCase() === "running";
      if (isApplied && isRestarted) {
        completed.push(runnerId);
      } else if (now >= pending.timeoutAtMs) {
        timedOut.push(runnerId);
      }
    }

    if (!completed.length && !timedOut.length) return;

    setRunnerConfigApplyPending((current) => {
      const next = { ...current };
      for (const runnerId of [...completed, ...timedOut]) {
        delete next[runnerId];
      }
      return next;
    });
    for (const runnerId of [...completed, ...timedOut]) {
      setRunnerAction(runnerId, "");
    }
    if (completed.length) {
      setGlobalToast({
        severity: "success",
        message: `${completed.join(", ")} 설정 적용 완료`
      });
    }
    if (timedOut.length) {
      setGlobalToast({
        severity: "warning",
        message: `${timedOut.join(", ")} 설정 적용 확인 시간이 초과되었습니다. 다음 상태 갱신을 확인하세요.`
      });
    }
  }, [board?.runners, runnerConfigApplyPending, setRunnerAction]);

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
        const isThisRunnerWorking = Boolean(runnerActionKeys[runner.id]);
        const baseDraft = previousDraft && (isThisRunnerWorking || previousIsDirty) ? previousDraft : runnerDraft;
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
  }, [board?.runners, installedAgentProfiles, runnerActionKeys]);

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

  // (checks tab removed — no automated intervention ledger in 3-runner topology)

  const refreshRecentProjects = React.useCallback(async () => {
    setIsRefreshingRecentProjects(true);
    try {
      const next = await filterExistingRecentProjects(recentProjects);
      if (next.length === recentProjects.length) {
        return;
      }

      persistRecentProjects(next);
      setRecentProjects(next);
      if (next.length < recentProjects.length) {
        pushToast("warning", "삭제된 최근 프로젝트 경로를 목록에서 제거했습니다.");
      }
    } finally {
      setIsRefreshingRecentProjects(false);
    }
  }, [pushToast, recentProjects]);

  React.useEffect(() => {
    if (options.projectRoot && !projectMenuOpen) {
      return;
    }

    void refreshRecentProjects();
  }, [options.projectRoot, projectMenuOpen, refreshRecentProjects]);

  const chooseProjectRoot = React.useCallback(async (selected: string) => {
    const normalized = selected.trim();
    if (!normalized) {
      return;
    }

    const exists = await window.autoflow.projectExists(normalized);
    if (!readProjectExistsResult(exists)) {
      setProjectMenuOpen(false);
      setRecentProjects((current) => {
        const next = normalizeProjectList(current.filter((project) => project !== normalized));
        persistRecentProjects(next);
        return next;
      });
      pushToast("warning", `${projectExistsPathLabel(normalized)} 목록에서 제거했습니다.`);
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
  }, [options.projectRoot, pushToast]);

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
    async (action: RunnerControlAction, runnerId: string, controlOptions: RunnerControlOptions = {}) => {
      const existingAction = runnerActionKeys[runnerId] || "";
      const forceStop = action === "stop" && Boolean(controlOptions.force);
      if (!options.projectRoot || (existingAction && !forceStop)) {
        return;
      }

      const runner = (board?.runners || []).find((candidate) => candidate.id === runnerId);
      if (!runner) {
        return;
      }
      beginRunnerTransition(runner, action, forceStop);
      setRunnerError("");
      try {
        if (runner && action === "stop" && (runner.enabled || "true") !== "false") {
          const disableResult = await window.autoflow.configureRunner({
            runnerId,
            ...options,
            config: {
              enabled: "false"
            }
          });
          if (!disableResult.ok) {
            setRunnerError(disableResult.stderr || disableResult.stdout || "AI 중지 설정 저장에 실패했습니다.");
            await loadBoard();
            setRunnerAction(runnerId, "");
            return;
          }
        }
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
              setRunnerAction(runnerId, "");
              return;
            }
          }
        }

        const result = await window.autoflow.controlRunner({
          action,
          runnerId,
          ...(forceStop ? { force: true } : {}),
          ...options
        });
        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "AI 작업에 실패했습니다.");
          await loadBoard();
          setRunnerAction(runnerId, "");
          return;
        }

        const resultCode = outputValue(result.stdout || "", "result");
        const refreshed = await loadBoard();
        const refreshedRunner = refreshed?.runners?.find((candidate) => candidate.id === runnerId);
        if (
          action === "start" &&
          (resultCode === "already_running" || resultCode === "already_running_adopted") &&
          refreshedRunner &&
          ((refreshedRunner.stateStatus || "").toLowerCase() === "running" || Boolean(refreshedRunner.pid))
        ) {
          setRunnerAction(runnerId, "");
          pushToast("success", `${displayWorkflowRunnerId(runnerId, refreshed?.runners)} runner에 재연결했습니다.`);
        }
      } catch (error) {
        setRunnerError(error instanceof Error ? error.message : "AI 작업에 실패했습니다.");
        setRunnerAction(runnerId, "");
      }
    },
    [
      beginRunnerTransition,
      board?.runners,
      installedAgentProfiles,
      loadBoard,
      options,
      pushToast,
      runnerActionKeys,
      runnerDrafts,
      setRunnerAction
    ]
  );

  const answerRunnerAuthPrompt = React.useCallback(
    async (choice: RunnerAuthChoice, runner: AutoflowRunner) => {
      if (!options.projectRoot || runnerActionKeys[runner.id]) {
        return;
      }

      if (choice === "cancel") {
        await controlRunner("stop", runner.id);
        return;
      }

      setRunnerAction(runner.id, "auth_continue");
      setRunnerError("");
      try {
        const result = await (
          window.autoflow as typeof window.autoflow & {
            continueRunnerAuth: (options: {
              runnerId: string;
              agent: string;
              projectRoot: string;
              boardDirName: string;
            }) => Promise<AutoflowRunResult>;
          }
        ).continueRunnerAuth({
          runnerId: runner.id,
          agent: runner.agent,
          ...options
        });

        if (!result.ok) {
          setRunnerError(result.stderr || result.stdout || "인증 플로우를 시작하지 못했습니다.");
          return;
        }

        const output = result.stdout || "";
        const runnerLabel = displayWorkflowRunnerId(runner.id, board?.runners);
        if (output.includes("auth_flow_already_running")) {
          pushToast("info", `${runnerLabel} 인증 처리가 이미 진행 중입니다.`);
        } else if (output.includes("auth_check_completed")) {
          pushToast("success", `${runnerLabel} 인증 확인이 끝났습니다. 러너를 다시 시작하세요.`);
        } else {
          pushToast("info", `${runnerLabel} 인증 브라우저를 열었습니다. 인증이 끝나면 러너를 다시 시작하세요.`);
        }
        void loadBoard();
      } catch (error) {
        setRunnerError(error instanceof Error ? error.message : "인증 플로우를 시작하지 못했습니다.");
      } finally {
        setRunnerAction(runner.id, "");
      }
    },
    [board?.runners, controlRunner, loadBoard, options, pushToast, runnerActionKeys, setRunnerAction]
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
      if (!options.projectRoot || runnerActionKeys[runner.id]) {
        return;
      }

      selectRunner(runner.id);
      setRunnerAction(runner.id, dryRun ? "dry-run" : "run");
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
        setRunnerAction(runner.id, "");
      }
    },
    [loadBoard, options, readLog, runnerActionKeys, selectRunner, setRunnerAction]
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
    async (runner: AutoflowRunner, restartAfterSave = false) => {
      if (!options.projectRoot || runnerActionKeys[runner.id]) {
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
      const previousRunnerSnapshot = { ...runner };
      const previousSavedDraft = runnerSavedDrafts[runner.id];
      const savedDraft: RunnerDraft = {
        agent: draft.agent,
        model: normalized.model,
        reasoning: normalized.reasoning,
        mode: "loop",
        intervalSeconds: "60",
        enabled: "true",
        command: draft.command
      };
      const rollbackOptimistic = () => {
        setRunnerDrafts((current) => ({
          ...current,
          [runner.id]: {
            agent: previousRunnerSnapshot.agent || "codex",
            model: previousRunnerSnapshot.model || "",
            reasoning: previousRunnerSnapshot.reasoning || "",
            mode: previousRunnerSnapshot.mode || "loop",
            intervalSeconds: previousRunnerSnapshot.intervalSeconds || "60",
            enabled: previousRunnerSnapshot.enabled || "true",
            command: previousRunnerSnapshot.command || ""
          }
        }));
        setRunnerSavedDrafts((current) => {
          const next = { ...current };
          if (previousSavedDraft) {
            next[runner.id] = previousSavedDraft;
          } else {
            delete next[runner.id];
          }
          return next;
        });
        setBoard((current) => {
          if (!current) return current;
          return {
            ...current,
            runners: current.runners.map((candidate) =>
              candidate.id === runner.id ? previousRunnerSnapshot : candidate
            )
          };
        });
      };

      selectRunner(runner.id);
      setRunnerError("");

      // Optimistic: 사용자 체감 latency 를 0 에 가깝게 만들기 위해 IPC 응답 전에 즉시 새 값 반영.
      setRunnerDrafts((current) => ({
        ...current,
        [runner.id]: savedDraft
      }));
      setRunnerSavedDrafts((current) => ({
        ...current,
        [runner.id]: savedDraft
      }));
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          runners: current.runners.map((candidate) =>
            candidate.id === runner.id
              ? {
                  ...candidate,
                  agent: savedDraft.agent,
                  model: savedDraft.model,
                  reasoning: savedDraft.reasoning,
                  mode: savedDraft.mode,
                  intervalSeconds: savedDraft.intervalSeconds,
                  enabled: savedDraft.enabled,
                  command: savedDraft.command
                }
              : candidate
          )
        };
      });

      // IPC 왕복 동안만 잠금. fingerprint apply 대기 (다음 tick) 는 더 이상 잠그지 않는다.
      setRunnerAction(runner.id, restartAfterSave ? "config_applying_restart" : "config_applying");

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
          rollbackOptimistic();
          setRunnerError(result.stderr || result.stdout || "AI 설정 저장에 실패했습니다.");
          setRunnerAction(runner.id, "");
          return;
        }

        if (!restartAfterSave) {
          // 새 model/agent 는 다음 runner tick (interval 안) 에 자연스럽게 적용된다.
          // 자동 재시작 없음. loadBoard 는 다음 polling cycle 에서 흡수하므로 여기서 호출하지 않는다.
          setRunnerAction(runner.id, "");
          return;
        }

        // 사용자 명시 "재시작" 흐름은 보존: controlRunner restart IPC 동안만 잠금 유지.
        const restartResult = await window.autoflow.controlRunner({
          action: "restart",
          runnerId: runner.id,
          ...options
        });
        if (!restartResult.ok) {
          setRunnerAction(runner.id, "");
          setRunnerError(restartResult.stderr || restartResult.stdout || "AI 재시작에 실패했습니다.");
          return;
        }
        setRunnerAction(runner.id, "");
      } catch (error) {
        rollbackOptimistic();
        setRunnerAction(runner.id, "");
        setRunnerError(error instanceof Error ? error.message : "AI 설정 저장에 실패했습니다.");
      }
    },
    [installedAgentProfiles, options, runnerActionKeys, runnerDrafts, runnerSavedDrafts, selectRunner, setRunnerAction]
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

  const boardInitialized = board?.status?.initialized === "true";
  const boardMissing = Boolean(options.projectRoot && board && !boardInitialized);
  const runnerCount = (board?.runners || []).filter(
    (runner) => (runner.role || "").toLowerCase() !== "self-improve"
  ).length;
  const runnersUnconfigured = Boolean(options.projectRoot && boardInitialized && runnerCount === 0);
  const setupRequired = boardMissing || runnersUnconfigured;
  const showInstallButton = Boolean(options.projectRoot && (isInstalling || setupRequired));
  const ticketTotal = countTickets(board);
  const projectLabel = options.projectRoot ? basename(options.projectRoot) : "프로젝트 없음";
  const visibleSettingsSection = setupRequired ? "progress" : activeSettingsSection;
  const selectedSettingsItem =
    settingsNavigation.find((item) => item.key === visibleSettingsSection) || settingsNavigation[0];
  const showGlobalLoading = isBoardLoading || isInstalling;

  return (
    <div className="viewer-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <main className="workspace-layout">
        <section className={`settings-page${boardMissing ? " settings-page-setup" : ""}`} aria-label="Autoflow">
          {!boardMissing ? (
            <aside className="settings-nav" aria-label="메뉴">
              <nav className="settings-nav-list" aria-label="Autoflow 메뉴">
                {settingsNavigation.map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant="ghost"
                    type="button"
                    className={`settings-nav-item${visibleSettingsSection === key ? " settings-nav-item-active" : ""}`}
                    aria-current={visibleSettingsSection === key ? "page" : undefined}
                    title={label}
                    disabled={setupRequired}
                    onClick={() => selectSettingsSection(key)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{label}</span>
                  </Button>
                ))}
              </nav>
              <div className="settings-nav-footer">
                <div className="toolbar-project-controls" ref={projectSwitcherRef}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="sidebar-theme-toggle"
                    onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
                    title={themeMode === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
                    aria-label={themeMode === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
                  >
                    {themeMode === "dark" ? (
                      <Sun className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Moon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
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
                      aria-label="설치"
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
                          <Button
                            key={project}
                            variant="ghost"
                            type="button"
                            className="project-menu-item"
                            title={isRefreshingRecentProjects ? "최근 프로젝트 경로를 확인 중입니다." : project}
                            role="menuitem"
                            disabled={isRefreshingRecentProjects}
                            onClick={() => chooseProjectRoot(project)}
                          >
                            <span>{basename(project)}</span>
                            {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="project-menu-separator" />
                      <Button
                        variant="ghost"
                        type="button"
                        className="project-menu-item project-menu-open"
                        role="menuitem"
                        onClick={browseProject}
                      >
                        <span>폴더 열기...</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          ) : null}

          <section
            className="settings-content settings-content-progress"
            aria-label={`${selectedSettingsItem.label} 화면`}
          >
            <div className="settings-content-header">
              <div className="settings-title-group">
                <h1>{selectedSettingsItem.label}</h1>
              </div>
              {lastUpdated ? (
                <div className="settings-title-status" aria-live="polite">
                  <span className="content-updated-at">마지막 업데이트 {formatDate(lastUpdated)}</span>
                </div>
              ) : null}
            </div>
            <div className="settings-content-body">
              {setupRequired && visibleSettingsSection === "progress" ? (
                <section className="setup-required-panel" aria-label="Autoflow 설치 안내">
                  <h2>
                    {boardMissing
                      ? "Autoflow가 아직 설치되지 않았습니다."
                      : "Autoflow 러너 설정이 비어 있습니다."}
                  </h2>
                  <p>
                    {boardMissing
                      ? "이 프로젝트에서 작업 상태를 보려면 먼저 Autoflow 보드를 설치해 주세요."
                      : "진행 상태를 보려면 Autoflow 보드를 다시 설치해 기본 러너를 준비해 주세요."}
                  </p>
                  <Button className="setup-required-button" disabled={isInstalling} onClick={() => void installFlow()}>
                    {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                    <span>{isInstalling ? "설치 중" : "설치"}</span>
                  </Button>
                </section>
              ) : !setupRequired && visibleSettingsSection === "progress" && (
                <section className="dashboard-area" aria-label="Autoflow 진행 상태">
                  <section className="board-section board-section-flush" aria-label="코덱스 작업 흐름">
                    <WorkflowStatStrip board={board} />
                    <TicketBoard
                      board={board}
                      installedAgentProfiles={installedAgentProfiles}
                      selectedPath={selectedLogPath}
                      onSelect={readLog}
                      options={options}
                      actionKeys={runnerActionKeys}
                      drafts={runnerDrafts}
                      savedDrafts={runnerSavedDrafts}
                      onSelectRunner={selectRunner}
                      onControl={controlRunner}
                      onRunnerAuthChoice={answerRunnerAuthPrompt}
                      onDraftChange={updateRunnerDraft}
                      onConfigure={saveRunnerConfig}
                    />
                  </section>
                </section>
              )}

              {!setupRequired && visibleSettingsSection === "kanban" && (
                <section className="dashboard-area" aria-label="티켓 정보">
                  <section className="board-section board-section-flush" aria-label="티켓 정보 보드">
                    <TicketKanban
                      board={board}
                      options={options}
                      onActionToast={pushToast}
                      onRequestRefresh={() => {
                        void loadBoard();
                      }}
                    />
                  </section>
                </section>
              )}

              {!setupRequired && visibleSettingsSection === "knowledge" && (
                <section className="dashboard-area" aria-label="Wiki">
                  <section className="board-section board-section-flush" aria-label="Wiki 본문">
                    <PageLayout
                      className="knowledge-page"
                    >
                      <div className="knowledge-split">
                        <div className="tool-panel knowledge-list-pane">
                          <WikiQueryPanel
                            query={wikiQueryInput}
                            onQueryChange={setWikiQueryInput}
                            onSubmit={runWikiQuery}
                            onCancel={cancelWikiQuery}
                            isRunning={wikiQueryRunning}
                            result={wikiQueryResult}
                            selectedPath={selectedLogPath}
                            onSelect={readWikiLog}
                          />
                          <WikiList board={board} selectedPath={selectedLogPath} onSelect={readWikiLog} />
                        </div>
                        <div className="knowledge-preview-pane">
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

            {!setupRequired && visibleSettingsSection === "snapshot" && (
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
                            aria-label="지표 스냅샷 저장"
                            disabled={!boardInitialized || Boolean(metricsActionKey)}
                            onClick={writeMetricsSnapshot}
                          >
                            {metricsActionKey === "write" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ClipboardCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Badge variant={boardInitialized ? "default" : options.projectRoot ? "destructive" : "secondary"}>
                            {boardInitialized ? "추적 중" : "없음"}
                          </Badge>
                        </div>
                      </div>
                    }
                  >
                    <div className="snapshot-panel report-panel">
                      <ReportingDashboard board={board} lastUpdated={lastUpdated} ticketTotal={ticketTotal} />
                    </div>
                  </PageLayout>
                </section>
              </section>
            )}

            </div>
          </section>
        </section>
      </main>
      {!options.projectRoot ? (
        <div className="project-required-overlay" role="dialog" aria-modal="true" aria-label="프로젝트 폴더 선택">
          <div className="project-required-card">
            <p className="project-required-description">
              Autoflow를 사용할 프로젝트 폴더를 먼저 선택해주세요.
            </p>
            <Button
              type="button"
              className="project-required-button"
              onClick={browseProject}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              <span>프로젝트 폴더 선택</span>
            </Button>
            {recentProjects.length > 0 ? (
              <div className="project-required-recent" aria-label="최근 프로젝트">
                <div className="project-required-recent-label">최근 프로젝트</div>
                <div className="project-required-recent-list">
                  {recentProjects.slice(0, 5).map((project) => (
                    <Button
                      key={project}
                      type="button"
                      variant="ghost"
                      className="project-required-recent-item"
                      title={isRefreshingRecentProjects ? "최근 프로젝트 경로를 확인 중입니다." : project}
                      disabled={isRefreshingRecentProjects}
                      onClick={() => chooseProjectRoot(project)}
                    >
                      <span>{basename(project)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <FullPageLoading open={showGlobalLoading} label="잠시만 기다려 주세요" />
      {globalToast ? (
        <div className="af-toast-region" aria-live="polite">
          <AlertBox severity={globalToast.severity} className="af-toast" onClose={() => setGlobalToast(null)}>
            {globalToast.message}
          </AlertBox>
        </div>
      ) : null}
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
  const [isRefreshingRecentProjects, setIsRefreshingRecentProjects] = React.useState(false);
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
        const configuredProjectRoot = (config as AutoflowAppConfig & { defaultProjectRoot?: string }).defaultProjectRoot;
        if (isMounted && !window.localStorage.getItem("autoflow.boardDirName")) {
          setDefaultFlowFolder(configuredBoardDirName);
        }
        if (isMounted && !window.localStorage.getItem("autoflow.projectRoot") && configuredProjectRoot) {
          setProjectRoot(configuredProjectRoot);
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

    let cancelled = false;
    let pendingTimer: number | null = null;

    const refreshSnapshot = async () => {
      if (cancelled || autoRefreshInFlightRef.current) {
        return;
      }

      autoRefreshInFlightRef.current = true;
      try {
        await loadBoard();
      } catch (error) {
        if (typeof console !== "undefined") {
          console.warn("autoflow.refreshSnapshot failed", error);
        }
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const scheduleRefresh = () => {
      if (cancelled) return;
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
      }
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;
        void refreshSnapshot();
      }, 80);
    };

    void refreshSnapshot();

    const offBoardChange = window.autoflow.onBoardChange(() => {
      scheduleRefresh();
    });

    // Safety-net polling — see `App` effect for rationale.
    const safetyInterval = window.setInterval(() => {
      void refreshSnapshot();
    }, 30000);

    return () => {
      cancelled = true;
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      window.clearInterval(safetyInterval);
      offBoardChange();
    };
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

  const sanitizeRecentProjects = React.useCallback(async () => {
    setIsRefreshingRecentProjects(true);
    try {
    const next = await filterExistingRecentProjects(recentProjects);
    if (next.length === recentProjects.length) {
      return;
    }

    persistRecentProjects(next);
    setRecentProjects(next);
    if (next.length < recentProjects.length) {
      setSetupError("삭제된 최근 프로젝트 경로를 목록에서 제거했습니다.");
    }
    } finally {
      setIsRefreshingRecentProjects(false);
    }
  }, [recentProjects]);

  React.useEffect(() => {
    if (options.projectRoot) {
      return;
    }

    void sanitizeRecentProjects();
  }, [options.projectRoot, sanitizeRecentProjects]);

  const chooseProjectRoot = React.useCallback(async (selected: string) => {
    const normalized = selected.trim();
    if (!normalized) {
      return;
    }

    const exists = await window.autoflow.projectExists(normalized);
    if (!readProjectExistsResult(exists)) {
      setProjectMenuOpen(false);
      setRecentProjects((current) => {
        const next = normalizeProjectList(current.filter((project) => project !== normalized));
        persistRecentProjects(next);
        return next;
      });
      setSetupError(`${projectExistsPathLabel(normalized)} 목록에서 제거했습니다.`);
      return;
    }

    setProjectRoot(normalized);
    setSetupError("");
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

  const boardInitialized = board?.status?.initialized === "true";
  const projectLabel = options.projectRoot ? basename(options.projectRoot) : "프로젝트 없음";
  const boardStatusLabel = !options.projectRoot ? "프로젝트 없음" : boardInitialized ? "추적 중" : "설정 필요";
  const boardStatusVariant = boardInitialized ? "default" : options.projectRoot ? "destructive" : "secondary";

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
                            <Button
                              key={project}
                              variant="ghost"
                              type="button"
                              className="project-menu-item"
                              title={isRefreshingRecentProjects ? "최근 프로젝트 경로를 확인 중입니다." : project}
                              role="menuitem"
                              disabled={isRefreshingRecentProjects}
                              onClick={() => chooseProjectRoot(project)}
                            >
                              <span>{basename(project)}</span>
                              {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="project-menu-separator" />
                  <Button
                    variant="ghost"
                    type="button"
                    className="project-menu-item project-menu-open"
                    role="menuitem"
                    onClick={browseProject}
                  >
                    <span>폴더 열기...</span>
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="essential-topbar-actions">
              {options.projectRoot && !boardInitialized ? (
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
                aria-label="새로고침"
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
                {lastUpdated ? <span>마지막 업데이트 {formatDate(lastUpdated)}</span> : null}
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
            ) : !boardInitialized ? (
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
  savedDraft,
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
  savedDraft?: RunnerDraft;
  canEditConfig: boolean;
  onSelectRunner: (runnerId: string) => void;
  onDraftChange: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure: (runner: AutoflowRunner, restartAfterSave?: boolean) => void;
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
  const baseline = savedDraft || {
    agent: runner.agent || "codex",
    model: runner.model || "",
    reasoning: runner.reasoning || "",
    mode: runner.mode || "loop",
    intervalSeconds: runner.intervalSeconds || "60",
    enabled: runner.enabled || "true",
    command: runner.command || ""
  };
  const hasDraftChanges =
    draft.agent !== baseline.agent ||
    normalized.model !== baseline.model ||
    normalized.reasoning !== baseline.reasoning ||
    baseline.mode !== "loop" ||
    baseline.intervalSeconds !== "60" ||
    baseline.enabled !== "true" ||
    draft.command !== baseline.command;
  // actionKey holds the action label for THIS runner only ("" when idle).
  const isWorking = Boolean(actionKey);
  const isApplyingConfig = actionKey === "config_applying" || actionKey === "config_applying_restart";

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
        {isApplyingConfig ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{actionKey === "config_applying_restart" ? "적용 대기..." : "저장 중..."}</span>
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

function isRunnerRowInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [role='option']"))
    : false;
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
  onControl: (action: RunnerControlAction, runnerId: string, options?: RunnerControlOptions) => void;
  onReadLog: (filePath: string) => void;
  onDraftChange: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure: (runner: AutoflowRunner, restartAfterSave?: boolean) => void;
}) {
  const runners = (board?.runners || []).filter(
    (runner) =>
      runner.role === "ticket-owner" ||
      runner.role === "owner" ||
      runner.role === "planner" ||
      runner.role === "plan" ||
      runner.role === "wiki-maintainer" ||
      runner.role === "wiki" ||
      (isCoordinatorRole(runner.role) && runnerIsEnabled(runner.enabled))
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
            <span className="ticket-workspace-tab-copy">Planner / Impl AI / Wiki AI</span>
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
            // actionKey holds the action label for THIS runner only ("" when idle).
            const isWorking = Boolean(actionKey);
            const transitionLabel = runnerTransitionLabel(actionKey);
            const canForceStop = actionKey === "stopping_pending";
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
                onPointerDown={(event) => {
                  if (isRunnerRowInteractiveTarget(event.target)) return;
                  onSelectRunner(runner.id);
                }}
              >
                <div className={`runner-status-dot ${runnerStatusTone(status)}`} aria-hidden="true" />
                <div className="runner-topbar">
                  <div className="runner-main">
                    <div className="runner-title-line">
                      <strong>{displayWorkflowRunnerId(runner.id, runners)}</strong>
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
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="runner-icon-button runner-plain-icon-button"
                          aria-label={`${runner.id} 중지`}
                          disabled={Boolean(actionKey)}
                          onClick={() => {
                            onControl("stop", runner.id);
                          }}
                        >
                          {isWorking && (actionKey === "stopping_pending" || actionKey === "stopping_force") ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                        {canForceStop ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="runner-icon-button runner-plain-icon-button"
                            aria-label={`${runner.id} 강제 종료`}
                            onClick={() => {
                              if (window.confirm(`${displayWorkflowRunnerId(runner.id, runners)} runner 를 강제 종료할까요?`)) {
                                onControl("stop", runner.id, { force: true });
                              }
                            }}
                          >
                            <TriangleAlert className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        className="runner-icon-button runner-plain-icon-button"
                        aria-label={`${runner.id} 시작`}
                        disabled={!canStart || Boolean(actionKey)}
                        onClick={() => {
                          onControl("start", runner.id);
                        }}
                      >
                        {isWorking && actionKey === "starting" ? (
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
                    {transitionLabel ? (
                      <span className="runner-transition-inline" role="status" aria-live="polite">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>{transitionLabel}</span>
                      </span>
                    ) : null}
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
                <span>
                  Planner(planner) / Impl AI(ticket-owner) / Wiki AI(wiki-maintainer) runner가 추가되면 여기에 표시됩니다.
                </span>
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

function runnerNeedsLogin(runner: AutoflowRunner) {
  return Boolean(runner.authRequired);
}

function runnerLoginMessage(runner: AutoflowRunner) {
  if (runner.authMessage) return runner.authMessage;
  const agent = runner.agent ? runner.agent.charAt(0).toUpperCase() + runner.agent.slice(1) : "Agent";
  return `${agent} 로그인이 필요합니다.`;
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
const TYPING_FLUSH_THRESHOLD_CHARS = 800;
const conversationStreamTextCache = new Map<string, string>();

function usePrefersReducedMotion() {
  const getMatch = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const [reduced, setReduced] = React.useState<boolean>(getMatch);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);
  return reduced;
}

function clampToCompleteAnsiBoundary(text: string, length: number) {
  if (length >= text.length) return length;
  const escIdx = text.lastIndexOf("\x1B", length - 1);
  if (escIdx === -1) return length;
  for (let i = escIdx + 1; i < length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0x40 && code <= 0x7e) return length;
  }
  return escIdx;
}

function initialConversationDisplayLength(streamId: string, text: string) {
  const cachedText = conversationStreamTextCache.get(streamId) || "";
  if (!text) return 0;
  if (!cachedText) return Math.max(0, text.length - TYPING_TAIL_CHARS);
  if (text === cachedText || cachedText.startsWith(text)) return text.length;
  if (text.startsWith(cachedText)) return cachedText.length;
  return text.length;
}

function overlappingConversationPrefixLength(previous: string, next: string) {
  if (!previous || !next) return 0;
  if (next.startsWith(previous)) return previous.length;
  if (previous.startsWith(next)) return next.length;

  const tailMarker = "…\n";
  const previousBody = previous.startsWith(tailMarker) ? previous.slice(tailMarker.length) : previous;
  const nextOffset = next.startsWith(tailMarker) ? tailMarker.length : 0;
  const nextBody = next.slice(nextOffset);
  const maxOverlap = Math.min(previousBody.length, nextBody.length);

  for (let length = maxOverlap; length >= 24; length -= 1) {
    if (previousBody.slice(previousBody.length - length) === nextBody.slice(0, length)) {
      return nextOffset + length;
    }
  }

  return 0;
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const streamIdRef = React.useRef(streamId);
  const previousTextRef = React.useRef(conversationStreamTextCache.get(streamId) || "");
  const [displayedLength, setDisplayedLength] = React.useState(() =>
    prefersReducedMotion ? text.length : initialConversationDisplayLength(streamId, text)
  );

  React.useEffect(() => {
    const streamChanged = streamIdRef.current !== streamId;
    const cachedText = conversationStreamTextCache.get(streamId) || "";

    if (streamChanged) {
      streamIdRef.current = streamId;
      previousTextRef.current = text;
      setDisplayedLength(
        prefersReducedMotion ? text.length : initialConversationDisplayLength(streamId, text)
      );
      conversationStreamTextCache.set(streamId, text);
      return;
    }

    const previous = previousTextRef.current;

    setDisplayedLength((current) => {
      if (!text) return 0;
      if (prefersReducedMotion) return text.length;
      const clampedCurrent = Math.min(current, text.length);

      if (!previous) {
        return Math.max(clampedCurrent, Math.max(0, text.length - TYPING_TAIL_CHARS));
      }

      if (text === previous || previous.startsWith(text)) {
        return text.length;
      }

      if (text.startsWith(previous)) {
        if (text.length - clampedCurrent > TYPING_FLUSH_THRESHOLD_CHARS) {
          return text.length;
        }
        return clampedCurrent;
      }

      const overlapLength = overlappingConversationPrefixLength(previous, text);
      if (overlapLength > 0) {
        return Math.min(clampedCurrent, overlapLength);
      }

      if (cachedText && cachedText !== previous && text.startsWith(cachedText)) {
        return Math.max(clampedCurrent, cachedText.length);
      }

      return text.length;
    });

    previousTextRef.current = text;
    conversationStreamTextCache.set(streamId, text);
  }, [streamId, text, prefersReducedMotion]);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      if (displayedLength !== text.length) {
        setDisplayedLength(text.length);
      }
      return;
    }
    if (displayedLength >= text.length) return;
    const remaining = text.length - displayedLength;
    if (remaining > TYPING_FLUSH_THRESHOLD_CHARS) {
      setDisplayedLength(text.length);
      return;
    }
    const charsPerTick = Math.max(
      1,
      Math.ceil((remaining * TYPING_TICK_MS) / TYPING_TARGET_CATCHUP_MS)
    );
    const id = window.setTimeout(() => {
      setDisplayedLength((current) => Math.min(text.length, current + charsPerTick));
    }, TYPING_TICK_MS);
    return () => window.clearTimeout(id);
  }, [text, displayedLength, prefersReducedMotion]);

  const safeDisplayedLength = clampToCompleteAnsiBoundary(text, displayedLength);
  const visibleText = text.slice(0, safeDisplayedLength);

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

  const isTyping = displayedLength < text.length;

  return (
    <div
      ref={ref}
      className={`ai-progress-conversation${isTyping ? " ai-progress-conversation-typing" : ""}`}
      role="log"
      aria-live="polite"
      aria-busy={isTyping || undefined}
      aria-label={label}
    >
      <pre>
        <span className="ai-progress-conversation-rendered" dangerouslySetInnerHTML={{ __html: html }} />
        {isTyping ? <span className="ai-progress-conversation-caret" aria-hidden="true" /> : null}
      </pre>
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
    ["티켓 파일", statusValue(metrics, "ticket_total", String(ticketTotal))],
    [
      "산출물",
      `${statusValue(metrics, "runner_artifact_ok_count", "0")} 정상 / ${statusValue(
        metrics,
        "runner_artifact_warning_count",
        "0"
      )} 주의`
    ],
    ["전달된 요청", statusValue(metrics, "handoff_count", String(board?.conversationFiles?.length || 0))],
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

type ReportInlineStat = {
  label: string;
  value: string;
  detail?: string;
  title?: string;
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
    autoflow_avg_lead_seconds: statusNumber(metrics, "autoflow_avg_lead_seconds"),
    autoflow_avg_active_seconds: statusNumber(metrics, "autoflow_avg_active_seconds"),
    autoflow_avg_ticks_per_done_ticket: statusNumber(metrics, "autoflow_avg_ticks_per_done_ticket"),
    autoflow_duration_total_24h_seconds: statusNumber(metrics, "autoflow_duration_total_24h_seconds"),
    ...{
      verifier_pass_count: statusNumber(metrics, "verifier_pass_count"),
      verifier_fail_count: statusNumber(metrics, "verifier_fail_count"),
      verification_pass_rate_percent: statusNumber(metrics, "verification_pass_rate_percent")
    },
    completion_rate_percent: statusNumber(metrics, "completion_rate_percent")
  };
}

function reportingHistory(board: AutoflowBoardSnapshot | null, ticketTotal: number, lastUpdated: string) {
  const history = [...(board?.metricsHistory || [])];
  const current = currentMetricSnapshot(board, ticketTotal, lastUpdated);

  if (current?.timestamp && history[history.length - 1]?.timestamp !== current.timestamp) {
    history.push(current);
  }

  const latest = history[history.length - 1];
  if (!latest?.timestamp) {
    return history.slice(-30);
  }

  const latestTime = new Date(latest.timestamp).getTime();
  if (Number.isNaN(latestTime)) {
    return history.slice(-30);
  }

  const weekStart = latestTime - 7 * 24 * 60 * 60 * 1000;
  const weeklyHistory = history.filter((snapshot) => {
    const snapshotTime = new Date(snapshot.timestamp).getTime();
    return Number.isFinite(snapshotTime) && snapshotTime >= weekStart;
  });

  return (weeklyHistory.length ? weeklyHistory : [latest]).slice(-30);
}

function ReportMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  className = "",
  title
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  className?: string;
  title?: string;
}) {
  return (
    <Card className={`report-metric-card ${tone} ${className}`.trim()} title={title || `${label}: ${value}, ${detail}`}>
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
    <Card className={`report-chart-card${wide ? " report-chart-wide" : ""}`} aria-label={label} title={`${title}: ${meta}`}>
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

function ReportInlineStats({ stats }: { stats: ReportInlineStat[] }) {
  return (
    <div className="report-inline-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="report-inline-stat" title={stat.title || `${stat.label}: ${stat.value}`}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.detail ? <em>{stat.detail}</em> : null}
        </div>
      ))}
    </div>
  );
}

function ReportFallback({ children }: { children: React.ReactNode }) {
  return <div className="report-fallback">{children}</div>;
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

function ReportSplitBar({ data }: { data: ReportDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="report-split-layout">
      <div className="report-split-track" aria-hidden="true">
        {data.map((item) => {
          const width = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <span
              key={item.label}
              style={{
                width: `${width}%`,
                background: item.color
              }}
            />
          );
        })}
      </div>
      <div className="report-split-legend">
        {data.map((item) => (
          <div key={item.label} className="report-split-legend-item">
            <span style={{ background: item.color }} aria-hidden="true" />
            <strong>{item.label}</strong>
            <em>{item.displayValue || formatCount(item.value)}</em>
          </div>
        ))}
      </div>
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
    doneTicketCount,
    codeFilesChangedCount,
    codeInsertionsCount,
    codeDeletionsCount,
    codeVolumeCount,
    tokenUsageCount,
    tokenReportCount,
    avgLeadSeconds,
    avgActiveSeconds,
    avgTicksPerDoneTicket,
    durationTotal24hSeconds
  } = getWorkflowMetricCounts(board);
  const hasTokenData = tokenUsageCount > 0 || tokenReportCount > 0;
  const hasTimeData = avgLeadSeconds > 0 || avgActiveSeconds > 0 || durationTotal24hSeconds > 0;

  return (
    <div className="workflow-stat-strip" aria-label="작업 흐름 지표 요약">
      <div className="workflow-stat-row workflow-stat-row-3">
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
        <div
          className={`workflow-stat-cell${hasTimeData ? "" : " workflow-stat-cell-muted"}`}
          title={`n=${formatCount(doneTicketCount)}, lead=${formatCount(avgLeadSeconds)}s, active=${formatCount(
            avgActiveSeconds
          )}s, ticks=${avgTicksPerDoneTicket.toFixed(1)}, 24h=${formatCount(durationTotal24hSeconds)}s`}
        >
          <Badge variant="secondary">평균 처리 시간</Badge>
          <strong>{formatDurationMetric(avgActiveSeconds)}</strong>
          <span>
            평균 대기시간 {formatDurationMetric(avgLeadSeconds)} / 최근 24시간 누적 처리 {formatDurationMetric(durationTotal24hSeconds)}
          </span>
        </div>
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
  const rejectCount = statusNumber(metrics, "reject_count", board?.tickets.reject?.length || 0);
  const activeCount = statusNumber(metrics, "active_ticket_count", todoCount + inprogressCount);
  const specTotal = statusNumber(metrics, "spec_total", board?.tickets.backlog?.length || 0);
  const handoffCount = statusNumber(metrics, "handoff_count", board?.conversationFiles?.length || 0);
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
  const runnerNeedsUser = (board?.runners || []).filter((runner) => {
    const recoveryStatus = (runner.activeRecoveryStatus || "").toLowerCase();
    const activeStage = (runner.activeStage || "").toLowerCase();
    return recoveryStatus === "needs_user" || activeStage === "blocked";
  }).length;
  const mergeBlockedCount = board?.tickets["merge-blocked"]?.length || 0;
  const blockedSignalCount = rejectCount + runnerBlocked + runnerNeedsUser + mergeBlockedCount;
  const hasTokenData = tokenUsageCount > 0 || tokenReportCount > 0;
  const hasCodeImpactData = codeVolumeCount > 0 || codeFilesChangedCount > 0;
  const trendMeta = snapshots.length > 1 ? "이번 7일" : snapshots.length === 1 ? "최근 스냅샷" : "전체 누적";
  const ticketStateData: ReportDatum[] = [
    { label: "대기", value: todoCount, color: reportColors.blue },
    { label: "실행", value: inprogressCount + planningCount, color: reportColors.teal },
    { label: "완료", value: doneCount, color: reportColors.green },
    { label: "반려", value: rejectCount, color: reportColors.red }
  ];
  const runnerData: ReportDatum[] = [
    { label: "실행 중", value: runnerRunning, color: reportColors.teal },
    { label: "대기", value: runnerIdle, color: reportColors.blue },
    { label: "중지", value: runnerStopped, color: reportColors.slate },
    { label: "막힘", value: runnerBlocked, color: reportColors.red }
  ];
  const codeLineData: ReportDatum[] = [
    { label: "추가 라인", value: codeInsertionsCount, displayValue: `${formatCount(codeInsertionsCount)}줄`, color: reportColors.green },
    { label: "삭제 라인", value: codeDeletionsCount, displayValue: `${formatCount(codeDeletionsCount)}줄`, color: reportColors.red }
  ];
  const secondaryStats: ReportInlineStat[] = [
    {
      label: "전달된 요청",
      value: `${formatCompactCount(handoffCount)}개`,
      detail: `${formatCount(specTotal)}개 PRD 처리`,
      title: `전달된 요청 ${formatCount(handoffCount)}개, PRD ${formatCount(specTotal)}개`
    },
    {
      label: "완료 커밋",
      value: `${formatCompactCount(commitCount)}커밋`,
      detail: "전체 누적",
      title: `완료 커밋 ${formatCount(commitCount)}커밋`
    },
    {
      label: "변경 파일",
      value: `${formatCompactCount(codeFilesChangedCount)}개`,
      detail: `${formatCount(codeVolumeCount)}줄 변경`,
      title: `변경 파일 ${formatCount(codeFilesChangedCount)}개, 변경 코드량 ${formatCount(codeVolumeCount)}줄`
    },
    {
      label: "러너 산출물",
      value: `${formatCompactCount(artifactTotal)}개`,
      detail: `${formatCount(artifactOk)} 정상 / ${formatCount(artifactWarning)} 주의`,
      title: `러너 산출물 ${formatCount(artifactTotal)}개, 정상 ${formatCount(artifactOk)}개, 주의 ${formatCount(artifactWarning)}개`
    }
  ];

  return (
    <div className="report-dashboard">
      <div className="report-metric-grid report-metric-grid-primary" aria-label="핵심 보드 상태 요약">
        <ReportMetricCard
          label="완료 티켓"
          value={`${formatCompactCount(doneCount)}개`}
          detail={`${formatPercentValue(completionRate)} 완료 · 전체 누적`}
          icon={CheckCircle2}
          tone="report-tone-green"
          title={`완료 티켓 ${formatCount(doneCount)}개, 완료율 ${formatPercentValue(completionRate)}, 전체 누적`}
        />
        <ReportMetricCard
          label="막힌 항목"
          value={`${formatCompactCount(blockedSignalCount)}개`}
          detail={
            blockedSignalCount > 0
              ? `${formatCount(rejectCount)}개 반려 / ${formatCount(runnerBlocked + runnerNeedsUser + mergeBlockedCount)}개 러너·티켓 신호`
              : "막힘 신호가 없습니다"
          }
          icon={TriangleAlert}
          tone={blockedSignalCount > 0 ? "report-tone-red" : "report-tone-blue"}
          title={`막힌 항목 ${formatCount(blockedSignalCount)}개, 반려 ${formatCount(rejectCount)}개, runnerBlocked ${formatCount(runnerBlocked)}개, needs_user/blocked 티켓 신호 ${formatCount(runnerNeedsUser + mergeBlockedCount)}개`}
        />
        <ReportMetricCard
          label="토큰 사용량"
          value={`${formatCompactCount(tokenUsageCount)}토큰`}
          detail={hasTokenData ? `${formatCount(tokenReportCount)}개 실행 로그 · 전체 누적` : "러너 실행 후 채워집니다"}
          icon={Terminal}
          tone="report-tone-violet"
          title={`토큰 사용량 ${formatCount(tokenUsageCount)}토큰, 실행 로그 ${formatCount(tokenReportCount)}개, 전체 누적`}
        />
      </div>

      <div className="report-secondary-panel" aria-label="보조 통계">
        <ReportInlineStats stats={secondaryStats} />
      </div>

      <div className="report-chart-grid">
        <ReportChartCard
          label="티켓 처리량"
          wide
          icon={BarChart3}
          title="보드 흐름"
          meta={`${formatCount(activeCount)}개 활성 / ${formatCount(ticketTotal)}개 전체`}
        >
          <ReportBarBreakdown data={ticketStateData} />
        </ReportChartCard>

        <ReportChartCard
          label="완료 추세"
          wide
          icon={TrendingUp}
          title="완료 추세"
          meta={snapshots.length ? trendMeta : "전체 누적"}
        >
          <CompletionTrend snapshots={snapshots} />
        </ReportChartCard>

        <ReportChartCard
          label="코드 영향"
          wide
          icon={ClipboardList}
          title="코드 영향"
          meta={
            hasCodeImpactData
              ? `${formatCount(codeFilesChangedCount)}개 파일 / ${formatCount(codeVolumeCount)}줄`
              : "완료 커밋 후 채워집니다"
          }
        >
          {hasCodeImpactData ? (
            <>
              <ReportInlineStats
                stats={[
                  {
                    label: "변경 파일",
                    value: `${formatCompactCount(codeFilesChangedCount)}개`,
                    detail: `${formatCount(commitCount)}커밋 기준`,
                    title: `변경 파일 ${formatCount(codeFilesChangedCount)}개, 완료 커밋 ${formatCount(commitCount)}커밋`
                  }
                ]}
              />
              <ReportSplitBar data={codeLineData} />
            </>
          ) : (
            <ReportFallback>완료 커밋 후 채워집니다</ReportFallback>
          )}
        </ReportChartCard>

        <ReportChartCard
          label="토큰 사용량"
          icon={Terminal}
          title="토큰 사용량"
          meta={hasTokenData ? `${formatCompactCount(tokenUsageCount)}토큰 · 전체 누적` : "러너 실행 후 채워집니다"}
        >
          {hasTokenData ? (
            <ReportInlineStats
              stats={[
                {
                  label: "사용 토큰",
                  value: `${formatCompactCount(tokenUsageCount)}토큰`,
                  detail: `${formatCount(tokenUsageCount)}토큰 정확값`,
                  title: `사용 토큰 ${formatCount(tokenUsageCount)}토큰`
                },
                {
                  label: "실행 로그",
                  value: `${formatCompactCount(tokenReportCount)}개`,
                  detail: "토큰 집계 기준",
                  title: `토큰 실행 로그 ${formatCount(tokenReportCount)}개`
                }
              ]}
            />
          ) : (
            <ReportFallback>러너 실행 후 채워집니다</ReportFallback>
          )}
        </ReportChartCard>

        <ReportChartCard
          label="AI 가동 상태"
          icon={Activity}
          title="러너 상태"
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
              <Button
                key={file.filePath}
                variant="ghost"
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
              </Button>
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
            <Button
              key={file.filePath}
              variant="ghost"
              type="button"
              className={`log-row${selectedPath === file.filePath ? " log-row-selected" : ""}`}
              onClick={() => onSelect(file.filePath)}
            >
              <ClipboardCheck className="h-4 w-4" />
              <div className="min-w-0">
                <strong>{file.name}</strong>
                <span>지표 · {formatDate(file.modifiedAt)}</span>
              </div>
            </Button>
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
      detail: `${handoffCount}개 전달 요청`,
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
type TicketWorkspaceStatusKey = "prd" | "order" | "todo" | "inprogress" | "ready-to-merge" | "merge-blocked" | "blocked" | "done" | "reject";
type TicketWorkspaceItemKind = "prd" | "order" | "ticket";
type TicketKanbanFolderKey = string;
type TicketPriority = "critical" | "high" | "normal" | "low";

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
  priority: TicketPriority;
  priorityRank: number;
};

type TicketWorkspaceItem = AutoflowFilePreview &
  TicketWorkspaceItemMeta & {
    kind: TicketWorkspaceItemKind;
    displayId: string;
  };

const ticketKanbanFolderOrder = ["backlog", "inbox", "todo", "inprogress", "done"] as const;
const ticketWorkspaceTabs: Array<{
  key: TicketWorkspaceTabKey;
  label: string;
  description: string;
}> = [
  { key: "prd", label: "PRD", description: "작성/보관된 PRD" },
  { key: "inbox", label: "Order", description: "빠른 오더 intake" },
  { key: "issued", label: "Ticket", description: "발급된 작업 티켓" }
];
const ticketKanbanFolderMeta: Record<string, {
  label: string;
  description: string;
}> = {
  backlog: { label: "Backlog", description: "PRD 대기" },
  inbox: { label: "Order", description: "오더 대기" },
  todo: { label: "TODO", description: "아직 시작 전" },
  inprogress: { label: "진행 중", description: "Worker가 처리중" },
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
  if (stem.startsWith("order_")) {
    return stem.replace(/^order_/, "Order-");
  }
  if (stem.startsWith("Todo-")) {
    return stem;
  }
  if (stem.startsWith("tickets_")) {
    return stem.replace(/^tickets_/, "Todo-");
  }
  return stem;
}

function sortFilesByModifiedAt(files: AutoflowFilePreview[]) {
  return [...files].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

function numericIdFromBoardFile(file: AutoflowFilePreview) {
  const match = file.name.match(/_(\d+)\.md$/);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function normalizeTicketPriority(value: string): TicketPriority | null {
  const normalized = value
    .replace(/[#`"'\[\]:]/g, " ")
    .trim()
    .toLowerCase();

  if (normalized === "critical" || normalized === "crit" || normalized === "p0") {
    return "critical";
  }
  if (normalized === "high" || normalized === "p1") {
    return "high";
  }
  if (normalized === "normal" || normalized === "medium" || normalized === "default" || normalized === "p2") {
    return "normal";
  }
  if (normalized === "low" || normalized === "p3") {
    return "low";
  }
  return null;
}

function ticketPriorityRank(priority: TicketPriority) {
  const ranks: Record<TicketPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3
  };
  return ranks[priority];
}

function extractMarkdownPriority(content: string): TicketPriority {
  const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const frontmatterPriority = frontmatterMatch?.[1]?.match(/^priority:\s*(.*?)\s*$/im)?.[1];
  const fromFrontmatter = frontmatterPriority ? normalizeTicketPriority(frontmatterPriority) : null;
  if (fromFrontmatter) {
    return fromFrontmatter;
  }

  const bodyPriority = content.match(/^-?\s*Priority:\s*(.*?)\s*$/im)?.[1];
  const fromBody = bodyPriority ? normalizeTicketPriority(bodyPriority) : null;
  if (fromBody) {
    return fromBody;
  }

  const titleLine = content.match(/^(?:-\s*)?Title:\s*(.*?)\s*$/im)?.[1] || content.match(/^#\s+(.*?)\s*$/m)?.[1] || "";
  if (/\[critical\]|🚨/i.test(titleLine)) {
    return "critical";
  }
  if (/\[high\]|⚠️|⚠/i.test(titleLine)) {
    return "high";
  }

  return "normal";
}

function compareTicketWorkspaceItems(left: TicketWorkspaceItem, right: TicketWorkspaceItem) {
  if (left.priorityRank !== right.priorityRank) {
    return left.priorityRank - right.priorityRank;
  }

  const modified = right.modifiedAt.localeCompare(left.modifiedAt);
  if (modified !== 0) {
    return modified;
  }

  const leftId = numericIdFromBoardFile(left);
  const rightId = numericIdFromBoardFile(right);
  if (leftId !== rightId) {
    return leftId - rightId;
  }

  return left.filePath.localeCompare(right.filePath);
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
  return /^Todo-\d+\.md$/i.test(file.name) || /^tickets_\d+\.md$/i.test(file.name);
}

function isOrderBoardFile(file: AutoflowFilePreview) {
  return /^order_\d+(?:_retry_\d+_\d{8}T\d{6}Z)?\.md$/i.test(file.name);
}

function isInboxOrderBoardFile(file: AutoflowFilePreview) {
  return isOrderBoardFile(file) && boardPath(file.filePath).includes("/tickets/inbox/");
}

function isRejectBoardFile(file: AutoflowFilePreview) {
  return /^reject_\d+\.md$/i.test(file.name);
}

function markdownScalar(content: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = content.match(new RegExp(`^- (?:${escaped.join("|")}):[ \\t]*(.*)$`, "im"));
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
  if (isPrdBoardFile(file)) {
    return "prd";
  }
  if (isInboxOrderBoardFile(file)) {
    return "order";
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
  if (normalized.includes("/tickets/done/")) {
    return "done";
  }
  return null;
}

function ticketWorkspaceStatusLabel(statusKey: TicketWorkspaceStatusKey, file: AutoflowFilePreview, content: string) {
  if (statusKey === "prd") {
    return boardPath(file.filePath).includes("/tickets/backlog/") ? "PRD" : "보관 PRD";
  }

  if (statusKey === "order") {
    return markdownScalar(content, ["Status"]) || "Order";
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

  const labels: Record<Exclude<TicketWorkspaceStatusKey, "prd" | "order" | "inprogress" | "ready-to-merge" | "merge-blocked" | "blocked">, string> = {
    todo: "발급됨",
    done: "완료",
    reject: "반려"
  };
  return labels[statusKey];
}

function ticketWorkspaceStatusVariant(statusKey: TicketWorkspaceStatusKey) {
  if (statusKey === "blocked" || statusKey === "merge-blocked" || statusKey === "reject") {
    return "destructive" as const;
  }

  if (statusKey === "inprogress" || statusKey === "ready-to-merge" || statusKey === "done") {
    return "default" as const;
  }

  return "secondary" as const;
}

function extractTicketWorkspaceMeta(file: AutoflowFilePreview, content: string, runners?: AutoflowRunner[]): TicketWorkspaceItemMeta {
  const id = markdownScalar(content, ["ID"]) || workflowFileDisplayName(file.name);
  const ai = markdownScalar(content, ["AI", "Execution AI", "Owner"]);
  const claimedBy = markdownScalar(content, ["Claimed By"]);
  const title = markdownScalar(content, ["Title"]) || markdownSectionPreview(content, "Request") || file.title || file.name;
  const stage = markdownScalar(content, ["Stage"]);
  const fileStatusKey = ticketWorkspaceStatusForFile(file) || "todo";
  const statusKey = fileStatusKey === "inprogress" && stage.toLowerCase() === "blocked" ? "blocked" : fileStatusKey;
  const priority = extractMarkdownPriority(content);
  return {
    id,
    title,
    projectKey: projectKeyFromBoardFile(file, content),
    stage,
    aiLabel: displayWorkflowRunnerId(ai, runners),
    claimedByLabel: displayWorkflowRunnerId(claimedBy, runners),
    lastUpdated: markdownScalar(content, ["Last Updated"]),
    statusKey,
    statusLabel: ticketWorkspaceStatusLabel(statusKey, file, content),
    statusVariant: ticketWorkspaceStatusVariant(statusKey),
    priority,
    priorityRank: ticketPriorityRank(priority)
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
  const files = Object.values(board?.tickets || {}).flatMap((folderFiles) =>
    folderFiles.filter(isOrderBoardFile)
  );

  return sortFilesByModifiedAt(files);
}

function ticketWorkspaceTabFromStorage(value: string | null): TicketWorkspaceTabKey {
  return ticketWorkspaceTabs.some((tab) => tab.key === value) ? (value as TicketWorkspaceTabKey) : "issued";
}

function ticketKanbanFolderForItem(item: TicketWorkspaceItem): TicketKanbanFolderKey {
  if (isRejectBoardFile(item)) {
    return "reject";
  }
  return ticketFolderKeyFromFile(item);
}

function boardFileNameFromPath(filePath: string) {
  return filePath.split("/").pop() || filePath;
}

function resolveTicketWorkspaceDetailItem(
  items: TicketWorkspaceItem[],
  activeDetailPath: string,
  fallback: TicketWorkspaceItem | null
) {
  if (!activeDetailPath) return null;

  const exactItem = items.find((item) => item.filePath === activeDetailPath);
  if (exactItem) return exactItem;

  const activeName = boardFileNameFromPath(activeDetailPath);
  const movedTicket = /^Todo-\d+\.md$/i.test(activeName) || activeName.startsWith("tickets_")
    ? items.find((item) => item.kind === "ticket" && item.name === activeName)
    : null;

  return movedTicket || fallback;
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
  const ItemIcon = item?.kind === "prd" ? ClipboardCheck : item?.kind === "order" ? Inbox : ClipboardList;
  const metaRows = item
    ? [
        ["ID", item.id || item.displayId],
        ["PRD Key", item.projectKey],
        ["Stage", item.stage || item.statusLabel],
        ["Worker", item.aiLabel],
        ["Claimed By", item.claimedByLabel],
        ["Last Updated", item.lastUpdated || formatDate(item.modifiedAt)]
      ].filter(([, value]) => Boolean(value))
    : [];

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent
        className="workflow-pin-layer-panel workflow-pin-layer-default ticket-detail-layer-panel"
        overlayClassName="workflow-pin-layer-overlay"
        keepMounted
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
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="workflow-pin-layer-close"
                onClick={onClose}
                aria-label="닫기"
                autoFocus
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
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

function ticketWorkspaceKanbanColumnsForFiles(
  files: AutoflowFilePreview[],
  defaultFolders: readonly string[] = []
) {
  const folderKeys = new Set<string>(defaultFolders);
  for (const file of files) {
    const key = ticketFolderKeyFromFile(file);
    if (key) folderKeys.add(key);
  }
  const orderedKeys = [
    ...ticketKanbanFolderOrder.filter((key) => folderKeys.has(key)),
    ...[...folderKeys].filter((key) => !ticketKanbanFolderOrder.includes(key as typeof ticketKanbanFolderOrder[number])).sort()
  ];

  return orderedKeys.map((key) => ({
    key,
    label: ticketKanbanFolderMeta[key]?.label || key,
    path: `tickets/${key}`,
    description: ticketKanbanFolderMeta[key]?.description || "사용자 정의 폴더"
  }));
}

function ticketWorkspaceItemKindForFile(file: AutoflowFilePreview): TicketWorkspaceItemKind {
  if (isPrdBoardFile(file)) {
    return "prd";
  }
  if (isOrderBoardFile(file)) {
    return "order";
  }
  return "ticket";
}

function TicketWorkspaceKanbanView({
  files,
  options,
  runners,
  defaultFolders,
  ariaLabel = "폴더 기준 칸반",
  onActionToast,
  onRequestRefresh
}: {
  files: AutoflowFilePreview[];
  options?: { projectRoot: string; boardDirName: string };
  runners?: AutoflowRunner[];
  defaultFolders?: readonly string[];
  ariaLabel?: string;
  onActionToast?: (severity: AlertSeverity, message: string) => void;
  onRequestRefresh?: () => Promise<void> | void;
}) {
  const [metaByPath, setMetaByPath] = React.useState<Record<string, TicketWorkspaceItemMeta>>({});
  const [activeDetailPath, setActiveDetailPath] = React.useState("");
  const [activeDetailSnapshot, setActiveDetailSnapshot] = React.useState<TicketWorkspaceItem | null>(null);
  const [detailContent, setDetailContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [detailContentPath, setDetailContentPath] = React.useState("");
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<TicketWorkspaceItem | null>(null);
  const [deleteInProgress, setDeleteInProgress] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const itemButtonRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

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
        const fallbackKey: TicketWorkspaceStatusKey =
          ticketWorkspaceStatusForFile(file) ||
          (isOrderBoardFile(file) ? "order" : isPrdBoardFile(file) ? "prd" : "todo");
        nextMeta[file.filePath] = result.ok
          ? extractTicketWorkspaceMeta(file, result.content || "", runners)
          : {
              id: workflowFileDisplayName(file.name),
              title: file.title || file.name,
              projectKey: projectKeyFromBoardFile(file, ""),
              stage: "",
              aiLabel: "",
              claimedByLabel: "",
              lastUpdated: "",
              statusKey: fallbackKey,
              statusLabel: ticketWorkspaceStatusLabel(fallbackKey, file, ""),
              statusVariant: ticketWorkspaceStatusVariant(fallbackKey),
              priority: "normal",
              priorityRank: ticketPriorityRank("normal")
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
  }, [files, options, runners]);

  const items = React.useMemo<TicketWorkspaceItem[]>(
    () =>
      files.map((file) => {
        const meta = metaByPath[file.filePath];
        const itemKind = ticketWorkspaceItemKindForFile(file);
        const fallbackKey: TicketWorkspaceStatusKey =
          ticketWorkspaceStatusForFile(file) ||
          (itemKind === "order" ? "order" : itemKind === "prd" ? "prd" : "todo");
        const statusKey = meta?.statusKey || fallbackKey;
        return {
          ...file,
          kind: itemKind,
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
          statusVariant: meta?.statusVariant || ticketWorkspaceStatusVariant(statusKey),
          priority: meta?.priority || "normal",
          priorityRank: meta?.priorityRank ?? ticketPriorityRank("normal")
        };
      }).sort(compareTicketWorkspaceItems),
    [files, metaByPath]
  );

  const kanbanColumns = React.useMemo(
    () => ticketWorkspaceKanbanColumnsForFiles(files, defaultFolders),
    [files, defaultFolders]
  );
  const kanbanColumnStyle = {
    "--ticket-kanban-column-count": Math.max(kanbanColumns.length, 1)
  } as React.CSSProperties;

  const activeDetailItem = React.useMemo(
    () => resolveTicketWorkspaceDetailItem(items, activeDetailPath, activeDetailSnapshot),
    [activeDetailPath, activeDetailSnapshot, items]
  );

  React.useEffect(() => {
    if (!activeDetailPath) {
      setActiveDetailSnapshot(null);
      return;
    }
    if (!activeDetailItem) return;

    setActiveDetailSnapshot(activeDetailItem);
    if (activeDetailItem.filePath !== activeDetailPath) {
      setActiveDetailPath(activeDetailItem.filePath);
    }
  }, [activeDetailItem, activeDetailPath]);

  const closeDetailLayer = React.useCallback(() => {
    const previousPath = activeDetailPath;
    setActiveDetailPath("");
    setActiveDetailSnapshot(null);
    setDetailContent(null);
    setDetailContentPath("");
    setDetailLoading(false);
    setDetailError("");
    if (previousPath) {
      window.setTimeout(() => itemButtonRefs.current[previousPath]?.focus(), 0);
    }
  }, [activeDetailPath]);

  const openDetailLayer = React.useCallback((filePath: string) => {
    const nextItem = items.find((item) => item.filePath === filePath) || null;
    setActiveDetailSnapshot(nextItem);
    setDetailContent(null);
    setDetailContentPath("");
    setDetailError("");
    setDetailLoading(true);
    setActiveDetailPath(filePath);
  }, [items]);

  const requestDelete = React.useCallback((item: TicketWorkspaceItem) => {
    setDeleteError("");
    setDeleteTarget(item);
  }, []);

  const closeDeleteDialog = React.useCallback(() => {
    if (deleteInProgress) return;
    setDeleteTarget(null);
    setDeleteError("");
  }, [deleteInProgress]);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !options?.projectRoot) {
      setDeleteError("삭제 대상을 찾을 수 없습니다.");
      return;
    }

    if (!isInboxOrderBoardFile(deleteTarget)) {
      const message = "대기 Order 항목만 삭제할 수 있습니다.";
      setDeleteError(message);
      onActionToast?.("warning", message);
      return;
    }

    setDeleteInProgress(true);
    setDeleteError("");
    try {
      const result = await window.autoflow.deleteInboxOrderFile({
        ...options,
        filePath: deleteTarget.filePath
      });
      if (!result.ok) {
        const message = result.stderr || "삭제에 실패했습니다.";
        setDeleteError(message);
        onActionToast?.("error", message);
        return;
      }

      onActionToast?.("success", `${deleteTarget.displayId} 삭제를 완료했습니다.`);
      if (activeDetailPath === deleteTarget.filePath) {
        closeDetailLayer();
      }
      setDeleteTarget(null);
      setDeleteError("");
      await onRequestRefresh?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.";
      setDeleteError(message);
      onActionToast?.("error", message);
    } finally {
      setDeleteInProgress(false);
    }
  }, [activeDetailPath, closeDetailLayer, deleteTarget, onActionToast, onRequestRefresh, options]);

  // Fetch the detail body once per *file path* — not per render. board polling
  // produces a fresh `activeDetailItem` reference every tick, which used to
  // re-trigger this effect and clear `detailContent` mid-view, causing the
  // panel body to blink. Depending on filePath + scoped options keeps the
  // fetch idempotent for the open ticket.
  const activeDetailFilePath = activeDetailItem?.filePath || "";
  const optionsProjectRoot = options?.projectRoot || "";
  const optionsBoardDirName = options?.boardDirName || "";
  React.useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setDetailError("");
      if (!activeDetailFilePath) {
        setDetailContent(null);
        setDetailContentPath("");
        setDetailLoading(false);
        return;
      }
      if (!optionsProjectRoot) {
        setDetailError("프로젝트 루트가 설정되어 있지 않습니다.");
        setDetailLoading(false);
        return;
      }

      // Only blank the content when switching to a *different* file. Re-loading
      // the same file (e.g. after a refresh) keeps the previous body visible
      // until the new copy lands, so the panel stays steady.
      setDetailContent((prev) => (detailContentPath === activeDetailFilePath ? prev : null));
      if (detailContentPath !== activeDetailFilePath) {
        setDetailContentPath("");
      }
      setDetailLoading(true);

      try {
        const result = await window.autoflow.readBoardFile({
          projectRoot: optionsProjectRoot,
          boardDirName: optionsBoardDirName,
          filePath: activeDetailFilePath
        });
        if (cancelled) return;
        if (!result.ok) {
          setDetailError(result.stderr || "파일 미리보기에 실패했습니다.");
          return;
        }
        setDetailContent(result);
        setDetailContentPath(activeDetailFilePath);
      } catch (error) {
        if (!cancelled) {
          setDetailError(error instanceof Error ? error.message : "파일 미리보기에 실패했습니다.");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailFilePath, optionsProjectRoot, optionsBoardDirName]);

  return (
    <>
      <div className="ticket-workspace-kanban-layout">
        <div className="ticket-workspace-kanban-pane">
          <div
            className="ticket-workspace-kanban-columns"
            aria-label={ariaLabel}
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
                        const canDelete = item.kind === "order";
                        const isDeletingThis = deleteTarget?.filePath === item.filePath;
                        const showPriorityBadge = item.priority === "critical" || item.priority === "high";
                        return (
                          <div
                            key={item.filePath}
                            ref={(node) => {
                              itemButtonRefs.current[item.filePath] = node;
                            }}
                            className="ticket-kanban-card"
                            onClick={() => openDetailLayer(item.filePath)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openDetailLayer(item.filePath);
                              }
                            }}
                            title={item.title}
                            aria-haspopup="dialog"
                          >
                            <span className="ticket-kanban-card-topline">
                              <span className="ticket-kanban-card-id">{item.displayId}</span>
                              <span className="ticket-kanban-card-controls">
                                {showPriorityBadge ? (
                                  <Badge
                                    className={`ticket-priority-badge ticket-priority-badge-${item.priority}`}
                                    variant={item.priority === "critical" ? "destructive" : "secondary"}
                                  >
                                    {item.priority}
                                  </Badge>
                                ) : null}
                                <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                                {canDelete ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="ticket-kanban-card-delete-button"
                                    disabled={isDeletingThis && deleteInProgress}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      requestDelete(item);
                                    }}
                                    title={`${item.displayId} 삭제`}
                                    aria-label={`${item.displayId} 삭제`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                ) : null}
                              </span>
                            </span>
                            <strong>{item.title}</strong>
                            <span className="ticket-kanban-card-meta">{metaText || item.filePath}</span>
                            <time>{formatDate(item.modifiedAt)}</time>
                          </div>
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
      <TicketDetailLayer
        item={activeDetailItem}
        content={detailContentPath === activeDetailPath ? detailContent : null}
        loading={Boolean(activeDetailPath) && (detailLoading || (detailContentPath !== activeDetailPath && !detailError))}
        error={detailError}
        onOpenChange={(open) => {
          if (!open) {
            closeDetailLayer();
          }
        }}
        onClose={closeDetailLayer}
      />
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDialog();
          }
        }}
      >
        <DialogContent
          className="workflow-pin-layer-panel ticket-delete-confirm-dialog"
          overlayClassName="workflow-pin-layer-overlay"
          keepMounted
          aria-describedby={undefined}
        >
          {deleteTarget ? (
            <>
              <div className="workflow-pin-layer-header">
                <div className="workflow-pin-layer-heading">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <DialogTitle asChild>
                    <strong>Order 항목 삭제 확인</strong>
                  </DialogTitle>
                </div>
              </div>
              <div className="ticket-delete-confirm-body">
                <DialogDescription>
                  삭제 대상 파일: <strong>{deleteTarget.displayId}</strong>
                  <br />
                  {deleteTarget.filePath}
                </DialogDescription>
                <p>이 항목을 삭제하면 파일이 즉시 제거되며, 되돌릴 수 없습니다.</p>
                {deleteError ? <div className="workflow-pin-detail-error">{deleteError}</div> : null}
                <div className="ticket-delete-confirm-actions">
                  <Button type="button" variant="outline" size="sm" onClick={closeDeleteDialog} disabled={deleteInProgress}>
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void confirmDelete()}
                    disabled={deleteInProgress}
                  >
                    {deleteInProgress ? "삭제 중..." : "삭제"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
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
      closeLayer();
    },
    [closeLayer]
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

  if (files.length === 0 && !showWhenEmpty) return null;

  return (
    <>
      <Button
        variant="outline"
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
      </Button>
      <Dialog open={layerOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`workflow-pin-layer-panel workflow-pin-layer-${variant}`}
          overlayClassName="workflow-pin-layer-overlay"
          keepMounted
          aria-describedby={undefined}
        >
          <div className="workflow-pin-layer-header">
            <div className="workflow-pin-layer-heading">
              {pinIcon}
              <DialogTitle asChild>
                <strong>{layerHeading}</strong>
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="workflow-pin-layer-close"
              onClick={closeLayer}
              aria-label="닫기"
            >
              ✕
            </Button>
          </div>
          <div className="workflow-pin-layer-split">
            <div className="workflow-pin-layer-list-pane">
              {files.length ? (
                <ul className="workflow-pin-list">
                  {files.map((file) => {
                    const isActive = detailFile?.filePath === file.filePath;
                    return (
                      <li key={file.filePath}>
                        <Button
                          variant="ghost"
                          type="button"
                          className={`workflow-pin-item${isActive ? " workflow-pin-item-active" : ""}`}
                          onClick={() => handleOpenDetail(file)}
                          aria-pressed={isActive}
                          title={file.title || file.name}
                        >
                          <strong className="workflow-pin-item-id">{workflowFileDisplayName(file.name)}</strong>
                          {file.title ? <span className="workflow-pin-item-title">{file.title}</span> : null}
                          {file.stateLabel ? (
                            <Badge
                              variant={file.stateTone === "destructive" ? "destructive" : file.stateTone === "success" ? "default" : "secondary"}
                              className={`workflow-pin-item-badge workflow-pin-item-badge-${file.stateTone || "neutral"}`}
                            >
                              {file.stateLabel}
                            </Badge>
                          ) : null}
                          <time>{formatDate(file.modifiedAt)}</time>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="workflow-pin-empty">{emptyText || "표시할 항목이 없습니다."}</p>
              )}
            </div>
            <div className="workflow-pin-layer-detail-pane">
              {detailFile ? (
                <div className="workflow-pin-detail">
                  <strong className="workflow-pin-detail-title">
                    {workflowFileDisplayName(detailFile.name)}
                  </strong>
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
                <div className="workflow-pin-detail-placeholder">
                  <p>선택된 항목이 없습니다</p>
                </div>
              )}
            </div>
          </div>
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
  const SelectedDetailIcon = selectedItem?.kind === "prd" ? ClipboardCheck : selectedItem?.kind === "order" ? Inbox : ClipboardList;
  const selectedKindLabel = selectedItem?.kind === "prd" ? "PRD" : selectedItem?.kind === "order" ? "Order" : "Ticket";

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
              <strong>{selectedKindLabel}</strong>
            </div>
            <strong className="workflow-pin-layer-title">{selectedItem.displayId}</strong>
            {selectedItem.priority === "critical" || selectedItem.priority === "high" ? (
              <Badge
                className={`ticket-priority-badge ticket-priority-badge-${selectedItem.priority}`}
                variant={selectedItem.priority === "critical" ? "destructive" : "secondary"}
              >
                {selectedItem.priority}
              </Badge>
            ) : null}
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
  options,
  onActionToast,
  onRequestRefresh
}: {
  board: AutoflowBoardSnapshot | null;
  options?: { projectRoot: string; boardDirName: string };
  onActionToast?: (severity: AlertSeverity, message: string) => void;
  onRequestRefresh?: () => Promise<void> | void;
}) {
  const issuedFiles = React.useMemo(() => ticketWorkspaceFiles(board), [board]);
  const prdFiles = React.useMemo(() => prdWorkspaceFiles(board), [board]);
  const inboxFiles = React.useMemo(() => inboxWorkspaceFiles(board), [board]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<TicketWorkspaceTabKey>(() =>
    ticketWorkspaceTabFromStorage(window.localStorage.getItem("autoflow.activeTicketWorkspaceTab"))
  );

  React.useEffect(() => {
    window.localStorage.setItem("autoflow.activeTicketWorkspaceTab", activeWorkspaceTab);
  }, [activeWorkspaceTab]);

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
                </Button>
              ))}
            </div>
            <span className="ticket-workspace-tab-copy">{activeTabMeta.description}</span>
          </div>
        }
      >
        <div className="ticket-workspace-tab-panel" role="tabpanel" aria-label={activeTabMeta.label}>
          {activeWorkspaceTab === "prd" ? (
            <TicketWorkspaceKanbanView
              key="prd"
              files={prdFiles}
              options={options}
              runners={board?.runners}
              defaultFolders={["backlog", "done"]}
              ariaLabel="폴더 기준 PRD 칸반"
            />
          ) : null}
          {activeWorkspaceTab === "inbox" ? (
            <TicketWorkspaceKanbanView
              key="inbox"
              files={inboxFiles}
              options={options}
              runners={board?.runners}
              defaultFolders={["inbox", "done"]}
              ariaLabel="폴더 기준 Order 칸반"
              onActionToast={onActionToast}
              onRequestRefresh={onRequestRefresh}
            />
          ) : null}
          {activeWorkspaceTab === "issued" ? (
            <TicketWorkspaceKanbanView
              key="issued"
              files={issuedFiles}
              options={options}
              runners={board?.runners}
              defaultFolders={["todo", "inprogress", "done"]}
              ariaLabel="폴더 기준 티켓 칸반"
            />
          ) : null}
        </div>
      </PageLayout>
    </section>
  );
}

function TicketBoard({
  board,
  installedAgentProfiles = {},
  selectedPath: _selectedPath,
  onSelect,
  options,
  actionKeys = {},
  drafts = {},
  savedDrafts = {},
  onSelectRunner,
  onControl,
  onRunnerAuthChoice,
  onDraftChange,
  onConfigure
}: {
  board: AutoflowBoardSnapshot | null;
  installedAgentProfiles?: InstalledAgentProfiles;
  selectedPath: string;
  onSelect: (filePath: string) => void;
  options?: { projectRoot: string; boardDirName: string };
  // Per-runner action tracker (key=runner.id, value=action label such as
  // "starting"/"stopping_pending"/"run"/"dry-run"/"config"). Empty/missing means
  // that runner's row is idle and its buttons are interactable.
  actionKeys?: Record<string, string>;
  drafts?: Record<string, RunnerDraft>;
  savedDrafts?: Record<string, RunnerDraft>;
  onSelectRunner?: (runnerId: string) => void;
  onControl?: (action: RunnerControlAction, runnerId: string, options?: RunnerControlOptions) => void;
  onRunnerAuthChoice?: (choice: RunnerAuthChoice, runner: AutoflowRunner) => void;
  onDraftChange?: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure?: (runner: AutoflowRunner, restartAfterSave?: boolean) => void;
}) {
  if (!board) {
    return (
      <PageLayout>
        <div className="ai-progress-board" data-runner-count={0} aria-label="AI별 작업 진행률" aria-busy="true" />
      </PageLayout>
    );
  }

  const runners = sortProgressBoardRunners(
    (board?.runners || []).filter((runner) => (runner.role || "").toLowerCase() !== "self-improve")
  );
  const backlogSpecs = (board?.tickets.backlog || [])
    .filter((file) => {
      const name = file?.name || "";
      return name.startsWith("prd_") || name.startsWith("project_");
    })
    .map((file) => ({ ...file, stateLabel: "대기", stateTone: "neutral" } as WorkflowFileEntry));
  const inboxOrders = (board?.tickets.inbox || [])
    .filter(isOrderBoardFile)
    .map((file) => ({ ...file, stateLabel: "대기", stateTone: "neutral" } as WorkflowFileEntry));
  const doneOrders = (board?.tickets.done || [])
    .filter(isOrderBoardFile)
    .map((file) => ({ ...file } as WorkflowFileEntry));
  const doneSpecs = (board?.tickets.done || [])
    .filter((file) => {
      const name = file?.name || "";
      return name.startsWith("prd_") || name.startsWith("project_");
    })
    .map((file) => ({ ...file } as WorkflowFileEntry));
  const todoTickets = (board?.tickets.todo || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file, stateLabel: "TODO", stateTone: "neutral" } as WorkflowFileEntry));
  const doneTickets = (board?.tickets.done || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file } as WorkflowFileEntry));
  const inprogressTickets = (board?.tickets.inprogress || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file } as WorkflowFileEntry));
  const specNumericId = (name: string) => {
    const match = name.match(/(?:prd|project)_(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const ticketNumericId = (name: string) => {
    const match = name.match(/(?:Todo-|tickets_)(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const orderNumericId = (name: string) => {
    const match = name.match(/order_(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const specFiles: WorkflowFileEntry[] = [...backlogSpecs, ...doneSpecs].sort(
    (a, b) => specNumericId(b.name) - specNumericId(a.name)
  );
  const orderFilesById = new Map<string, WorkflowFileEntry>();
  for (const order of [...inboxOrders, ...doneOrders]) {
    if (!orderFilesById.has(order.name)) {
      orderFilesById.set(order.name, order);
    }
  }
  const orderFiles: WorkflowFileEntry[] = Array.from(orderFilesById.values()).sort(
    (a, b) => orderNumericId(b.name) - orderNumericId(a.name)
  );
  const todoFilesById = new Map<string, WorkflowFileEntry>();
  for (const ticket of [...todoTickets, ...inprogressTickets, ...doneTickets]) {
    if (!todoFilesById.has(ticket.name)) {
      todoFilesById.set(ticket.name, ticket);
    }
  }
  const todoFiles: WorkflowFileEntry[] = Array.from(todoFilesById.values()).sort(
    (a, b) => ticketNumericId(b.name) - ticketNumericId(a.name)
  );
  const prdPinTitle = `PRD (${backlogSpecs.length}/${specFiles.length})`;
  const orderPinTitle = `ORDER (${inboxOrders.length}/${orderFiles.length})`;
  const todoPinTitle = `TODO (${todoTickets.length}/${todoFiles.length})`;
  const hasWorkflowPins = Boolean(specFiles.length || orderFiles.length || todoFiles.length);
  const boardInitialized = board?.status?.initialized === "true";
  const boardMissing = Boolean(options?.projectRoot && board && !boardInitialized);

  const hasHeader = Boolean(hasWorkflowPins);

  return (
    <PageLayout
      header={
        hasHeader ? (
          <div className="workflow-pin-strip" aria-label="작업 흐름 요약">
            {hasWorkflowPins ? (
              <WorkflowPinLayer
                files={orderFiles}
                options={options}
                pinTitle={orderPinTitle}
                pinIcon={<Inbox className="h-4 w-4" aria-hidden="true" />}
                variant="default"
                layerHeading={orderPinTitle}
                emptyText="아직 들어온 오더가 없습니다."
                showWhenEmpty
              />
            ) : null}
            {hasWorkflowPins ? (
              <WorkflowPinLayer
                files={specFiles}
                options={options}
                pinTitle={prdPinTitle}
                pinIcon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
                variant="default"
                layerHeading={prdPinTitle}
                emptyText="아직 작성된 PRD가 없습니다."
                showWhenEmpty
              />
            ) : null}
            {hasWorkflowPins ? (
              <WorkflowPinLayer
                files={todoFiles}
                options={options}
                pinTitle={todoPinTitle}
                pinIcon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                variant="default"
                layerHeading={todoPinTitle}
                emptyText="아직 발급된 TODO 티켓이 없습니다."
                showWhenEmpty
              />
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="ai-progress-board" data-runner-count={runners.length} aria-label="AI별 작업 진행률">
        {boardMissing ? (
          <div className="ai-progress-empty ai-progress-empty-install">
            <FolderPlus className="h-5 w-5" aria-hidden="true" />
            <strong>Autoflow가 아직 설치되지 않았습니다.</strong>
            <span>왼쪽 아래 설치 버튼을 눌러 이 프로젝트에 Autoflow 보드를 먼저 설치해 주세요.</span>
          </div>
        ) : runners.length ? (
          runners.map((runner) => (
            <AiProgressRow
              key={runner.id}
              runner={runner}
              onSelect={onSelect}
              installedAgentProfiles={installedAgentProfiles}
              options={options}
              actionKey={actionKeys[runner.id] || ""}
              draft={drafts[runner.id]}
              savedDraft={savedDrafts[runner.id]}
              onSelectRunner={onSelectRunner}
              onControl={onControl}
              onRunnerAuthChoice={onRunnerAuthChoice}
              onDraftChange={onDraftChange}
              onConfigure={onConfigure}
            />
          ))
        ) : (
          <div className="ai-progress-empty">
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

function formatRunnerElapsedSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0s";
  const s = Math.floor(totalSeconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function useRunnerActivity(runner: AutoflowRunner): { elapsed: string; tokens: number } {
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  const isRunning = stateStatus === "running" && Boolean(runner.pid);

  React.useEffect(() => {
    if (!isRunning) return;
    const handle = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [isRunning]);

  const tokens = typeof runner.tokenUsage === "number" ? runner.tokenUsage : 0;
  const startSource = runner.lastEventAt || runner.lastAdapterChunkAt || runner.startedAt || "";
  const startMs = Date.parse(startSource);
  if (!isRunning || !startSource || !Number.isFinite(startMs)) {
    // stopped 거나 anchor 없으면 elapsed 는 "—" 로 — 토큰 사용량 바는 항상 표시.
    return { elapsed: "—", tokens };
  }

  const elapsedSec = Math.max(0, (nowMs - startMs) / 1000);

  return { elapsed: formatRunnerElapsedSeconds(elapsedSec), tokens };
}

// manual_order_196 (2026-05-09): stdout 파일의 마지막 N 바이트를 1초마다
// 폴링해서 진짜 터미널 뷰처럼 streaming. board snapshot 의 conversationPreview
// 보다 훨씬 fresh — 사용자가 AI 가 실제로 뱉는 raw stdout 을 본다.
// manual_order_196 (2026-05-09): runner stdout 이 ANSI escape 없는 plain
// key=value text 라 xterm theme palette 가 적용될 색 자체가 없다. 기존
// ConversationStream 의 LOG_TOKEN_REGEX (line ~3548) 를 그대로 재사용해
// 토큰 종류별로 ANSI escape 로 wrap 한다. xterm 이 그 escape 를 해석해 색을
// 입혀 ConversationStream 시절의 컬러감을 회복.
const LOG_TOKEN_ANSI: Record<string, string> = {
  ts: "\x1b[36m", // cyan
  date: "\x1b[36m",
  time: "\x1b[36m",
  path: "\x1b[34m", // blue
  key: "\x1b[35m", // magenta
  str: "\x1b[32m", // green
  good: "\x1b[92m", // bright green
  bad: "\x1b[31m", // red
  warn: "\x1b[33m", // yellow
  active: "\x1b[36m",
  num: "\x1b[33m"
};

function colorizeLogChunk(chunk: string): string {
  if (!chunk) return "";
  let out = "";
  let lastIndex = 0;
  LOG_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LOG_TOKEN_REGEX.exec(chunk)) !== null) {
    if (match.index > lastIndex) {
      out += chunk.slice(lastIndex, match.index);
    }
    const groups = match.groups || {};
    let prefix = "";
    for (const key of Object.keys(LOG_TOKEN_ANSI)) {
      if (groups[key]) {
        prefix = LOG_TOKEN_ANSI[key];
        break;
      }
    }
    out += prefix ? `${prefix}${match[0]}\x1b[0m` : match[0];
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < chunk.length) out += chunk.slice(lastIndex);
  return out;
}

// vibe-terminal (`document/lab/vibe-terminal/src/renderer/renderer.js`)
// 의 패턴 그대로. read-only 라 PTY 입력 forwarding / wheel handler 만 생략.
// scrollback / debounce / chunk flush / theme 은 vibe 와 동일.
const LIVE_TERMINAL_SCROLLBACK = 50000;
const LIVE_TERMINAL_FIT_DEBOUNCE_MS = 50;
const LIVE_TERMINAL_FONT_FAMILY =
  '"D2Coding", "Cascadia Mono", "Consolas", "Courier New", monospace';
const LIVE_TERMINAL_FONT_SIZE = 12;

// prd_225 (2026-05-09): xterm theme 을 라이트/다크 카드 톤에 정렬한다.
// LOG_TOKEN_ANSI 는 ANSI palette index (\x1b[36m = cyan 등) 만 쓰므로 같은
// escape 가 palette 에 따라 색이 달라진다. 라이트 팔레트는 ansiConverter
// (line ~3515) 의 colors map 톤을 차용해 ConversationStream 시리즈와 시각
// 일관성을 맞췄고, 다크 팔레트는 기존 vibe-terminal 톤을 유지한다.
const LIVE_TERMINAL_THEME_LIGHT = {
  background: "#FFFFFF",
  foreground: "#1f2937",
  cursor: "#1f2937",
  cursorAccent: "#FFFFFF",
  selectionBackground: "rgba(31, 41, 55, 0.18)",
  selectionInactiveBackground: "rgba(31, 41, 55, 0.10)",
  scrollbarSliderBackground: "rgba(31, 41, 55, 0.20)",
  scrollbarSliderHoverBackground: "rgba(31, 41, 55, 0.32)",
  scrollbarSliderActiveBackground: "rgba(31, 41, 55, 0.42)",
  overviewRulerBorder: "#FFFFFF",
  black: "#1f2937",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#4b5563",
  brightBlack: "#6b7280",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#111827"
} as const;

const LIVE_TERMINAL_THEME_DARK = {
  background: "#2d323b",
  foreground: "#d6d8de",
  cursor: "#aeafad",
  cursorAccent: "#2d323b",
  selectionBackground: "rgba(255, 255, 255, 0.2)",
  selectionInactiveBackground: "rgba(255, 255, 255, 0.12)",
  scrollbarSliderBackground: "rgba(121, 121, 121, 0.36)",
  scrollbarSliderHoverBackground: "rgba(121, 121, 121, 0.52)",
  scrollbarSliderActiveBackground: "rgba(121, 121, 121, 0.64)",
  overviewRulerBorder: "#2d323b",
  black: "#3a3f4a",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#d6d8de",
  brightBlack: "#6b7280",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#f3f4f6"
} as const;

function readDocumentThemeMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function liveTerminalThemeFor(mode: "light" | "dark") {
  return mode === "dark" ? LIVE_TERMINAL_THEME_DARK : LIVE_TERMINAL_THEME_LIGHT;
}

function LiveTerminalView({
  text,
  ariaLabel
}: {
  text: string;
  ariaLabel: string;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const terminalRef = React.useRef<XTermTerminal | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const fitTimerRef = React.useRef<number | null>(null);
  const fitRafRef = React.useRef<number | null>(null);
  const pendingChunksRef = React.useRef<string[]>([]);
  const flushRafRef = React.useRef<number | null>(null);
  const writtenLengthRef = React.useRef(0);
  const [terminalThemeMode, setTerminalThemeMode] = React.useState<
    "light" | "dark"
  >(() => readDocumentThemeMode());

  // prd_225: <html data-theme="..."> 변화를 구독해 xterm theme 도 즉시 swap.
  // 사용자가 헤더 토글을 누르면 documentElement.dataset.theme 가 바뀌므로
  // MutationObserver 한 개로 충분하다. prop drilling / context 도입 없음.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const apply = () => setTerminalThemeMode(readDocumentThemeMode());
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || terminalRef.current) return;

    // vibe-terminal renderer.js line 5389~5413 옵션 풀세트.
    const terminal = new XTermTerminal({
      cursorBlink: true,
      convertEol: true,
      disableStdin: true,
      allowProposedApi: false,
      fontFamily: LIVE_TERMINAL_FONT_FAMILY,
      fontSize: LIVE_TERMINAL_FONT_SIZE,
      lineHeight: 1.2,
      rescaleOverlappingGlyphs: false,
      scrollback: LIVE_TERMINAL_SCROLLBACK,
      overviewRuler: { width: 1 },
      theme: { ...liveTerminalThemeFor(readDocumentThemeMode()) }
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    try {
      fitAddon.fit();
    } catch {
      // host 가 layout 안정 전이면 fit 실패 — ResizeObserver 가 곧 재시도.
    }
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenLengthRef.current = 0;

    // vibe-terminal scheduleFitAndResize (renderer.js line 3647) 와 동일
    // 패턴: 50ms setTimeout debounce → RAF 안에서 fit. layout/padding 변화가
    // 모두 settled 된 다음 paint 에 fit.
    const scheduleFit = () => {
      if (fitTimerRef.current !== null) {
        window.clearTimeout(fitTimerRef.current);
      }
      if (fitRafRef.current !== null) {
        cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
      fitTimerRef.current = window.setTimeout(() => {
        fitTimerRef.current = null;
        fitRafRef.current = requestAnimationFrame(() => {
          fitRafRef.current = null;
          try {
            fitAddonRef.current?.fit();
          } catch {
            // ignore transient fit errors
          }
        });
      }, LIVE_TERMINAL_FIT_DEBOUNCE_MS);
    };

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (fitTimerRef.current !== null) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
      if (fitRafRef.current !== null) {
        cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
      if (flushRafRef.current !== null) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      pendingChunksRef.current = [];
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      writtenLengthRef.current = 0;
    };
  }, []);

  // prd_225: themeMode 가 바뀌면 이미 mount 된 xterm 의 theme 만 swap.
  // xterm Terminal#options.theme setter 가 palette 를 즉시 반영한다.
  React.useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = { ...liveTerminalThemeFor(terminalThemeMode) };
  }, [terminalThemeMode]);

  // vibe-terminal scheduleTerminalOutputFlush (renderer.js line 3716) 패턴:
  // pendingChunks 배열에 push 한 뒤 RAF 안에서 join → terminal.write. 매
  // text 갱신마다 즉시 write 하지 않고 한 프레임에 모아 흘려 깜빡임 감소.
  React.useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const written = writtenLengthRef.current;
    if (text.length === written) return;
    let chunk: string;
    if (text.length < written || !text.startsWith(text.slice(0, written))) {
      terminal.reset();
      chunk = text;
    } else {
      chunk = text.slice(written);
    }
    writtenLengthRef.current = text.length;
    if (!chunk) return;
    pendingChunksRef.current.push(colorizeLogChunk(chunk));
    if (flushRafRef.current !== null) return;
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null;
      const term = terminalRef.current;
      const buffered = pendingChunksRef.current;
      pendingChunksRef.current = [];
      if (!term || buffered.length === 0) return;
      term.write(buffered.join(""));
    });
  }, [text]);

  return (
    <div
      className="live-terminal-view"
      role="log"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div ref={hostRef} className="live-terminal-view-host" />
    </div>
  );
}

function previewText(value: unknown, maxLength = 80): string {
  let text = "";
  if (typeof value === "string") {
    text = value;
  } else if (value != null) {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

function contentTextFromBlock(block: unknown): string {
  if (typeof block === "string") return block;
  if (!block || typeof block !== "object") return "";
  const record = block as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  if (Array.isArray(record.content)) {
    return record.content.map(contentTextFromBlock).filter(Boolean).join("");
  }
  return "";
}

function summarizeClaudeContentBlock(block: unknown): string[] {
  if (!block || typeof block !== "object") return [];
  const record = block as Record<string, unknown>;
  const type = String(record.type || "");
  if (type === "text") {
    const text = typeof record.text === "string" ? record.text : "";
    return text ? [text] : [];
  }
  if (type === "tool_use") {
    const name = typeof record.name === "string" ? record.name : "tool";
    const input = previewText(record.input, 96);
    return [`[tool] ${name}${input ? ` ${input}` : ""}`];
  }
  if (type === "tool_result") {
    const content = previewText(contentTextFromBlock(record.content), 80);
    return [`[result] ${content}`.trim()];
  }
  return [];
}

function summarizeClaudeStreamEvent(obj: Record<string, unknown>): string[] {
  const event = obj.event && typeof obj.event === "object" ? (obj.event as Record<string, unknown>) : obj;
  const eventType = String(event.type || "");
  if (eventType === "message_delta") {
    const delta = event.delta && typeof event.delta === "object" ? (event.delta as Record<string, unknown>) : {};
    const text = previewText(delta.text || delta.stop_reason || "", 120);
    return text ? [text] : [];
  }
  if (eventType === "content_block_delta") {
    const delta = event.delta && typeof event.delta === "object" ? (event.delta as Record<string, unknown>) : {};
    const text = typeof delta.text === "string" ? delta.text : "";
    return text ? [text] : [];
  }
  return [];
}

function summarizeClaudeJsonLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "";
  }
  if (!parsed || typeof parsed !== "object") return "";
  const obj = parsed as Record<string, unknown>;
  const type = String(obj.type || "");

  if (type === "system" && obj.subtype === "init") {
    const tools = Array.isArray(obj.tools) ? obj.tools.length : undefined;
    const model = typeof obj.model === "string" ? obj.model : "";
    return `[init] tools=${tools ?? 0}${model ? ` model=${model}` : ""}`;
  }

  if (type === "assistant" || type === "user") {
    const message = obj.message && typeof obj.message === "object" ? (obj.message as Record<string, unknown>) : {};
    const content = Array.isArray(message.content) ? message.content : [];
    return content.flatMap(summarizeClaudeContentBlock).join("\n");
  }

  if (type === "stream_event" || type === "message_delta") {
    return summarizeClaudeStreamEvent(obj).join("\n");
  }

  if (type === "text") {
    return typeof obj.text === "string" ? obj.text : "";
  }

  if (type === "tool_use") {
    const name = typeof obj.name === "string" ? obj.name : "tool";
    const input = previewText(obj.input, 96);
    return `[tool] ${name}${input ? ` ${input}` : ""}`;
  }

  if (type === "tool_result") {
    const content = previewText(contentTextFromBlock(obj.content), 80);
    return `[result] ${content}`.trim();
  }

  if (type === "result" && obj.subtype === "success") {
    const result = previewText(obj.result, 120);
    return `[done] ${result}`.trim();
  }

  return "";
}

function summarizeClaudeJsonLines(content: string): string {
  if (!content.trim()) return "";
  const lines = content
    .split(/\r?\n/)
    .map(summarizeClaudeJsonLine)
    .filter(Boolean);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function useLiveStdoutText(
  runner: AutoflowRunner,
  options?: { projectRoot: string; boardDirName: string },
  maxBytes = 16 * 1024
): string {
  const projectRoot = options?.projectRoot || "";
  const boardDirName = options?.boardDirName || "";
  const logsRoot =
    runner.id && projectRoot && boardDirName
      ? `${projectRoot.replace(/[\\/]+$/, "")}/${boardDirName}/runners/logs/${runner.id}.log`
      : "";
  const activeStdoutPath =
    runner.lastStdoutLog && /_live_stdout\.log$/.test(runner.lastStdoutLog)
      ? runner.lastStdoutLog
      : "";

  const [text, setText] = React.useState("");

  React.useEffect(() => {
    if (!logsRoot || !projectRoot || !boardDirName) {
      setText("");
      return;
    }
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const persistent = await window.autoflow.tailBoardFile({
          projectRoot,
          boardDirName,
          filePath: logsRoot,
          maxBytes
        });
        if (cancelled) return;
        let merged = persistent.ok ? persistent.content || "" : "";
        if (activeStdoutPath) {
          const active = await window.autoflow.tailBoardFile({
            projectRoot,
            boardDirName,
            filePath: activeStdoutPath,
            maxBytes
          });
          if (cancelled) return;
          if (active.ok && active.content) {
            const summarized = summarizeClaudeJsonLines(active.content);
            if (summarized) {
              merged = `${merged}${merged.endsWith("\n") || !merged ? "" : "\n"}${summarized}`;
            }
          }
        }
        setText(merged);
      } catch {
        // best-effort polling — swallow read errors
      }
    };
    void fetchOnce();
    const handle = window.setInterval(fetchOnce, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [logsRoot, activeStdoutPath, projectRoot, boardDirName, maxBytes]);

  return text;
}

function useLiveStdoutRate(
  runner: AutoflowRunner,
  options?: { projectRoot: string; boardDirName: string }
): { bytesPerSec: number; totalBytes: number } | null {
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  const isRunning = stateStatus === "running" && Boolean(runner.pid);
  const projectRoot = options?.projectRoot || "";
  const boardDirName = options?.boardDirName || "";
  const persistentLog =
    runner.id && projectRoot && boardDirName
      ? `${projectRoot.replace(/[\\/]+$/, "")}/${boardDirName}/runners/logs/${runner.id}.log`
      : "";
  const stdoutPath = runner.lastStdoutLog || persistentLog;

  const [sample, setSample] = React.useState<{ size: number; ts: number } | null>(null);
  const [rate, setRate] = React.useState(0);
  const lastSampleRef = React.useRef<{ size: number; ts: number } | null>(null);

  React.useEffect(() => {
    if (!isRunning || !stdoutPath || !projectRoot || !boardDirName) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const result = await window.autoflow.readBoardFile({
          projectRoot,
          boardDirName,
          filePath: stdoutPath
        });
        if (cancelled || !result.ok) return;
        const now = Date.now();
        const size = typeof result.size === "number" ? result.size : 0;
        const prev = lastSampleRef.current;
        if (prev && now > prev.ts) {
          const dt = (now - prev.ts) / 1000;
          const dSize = Math.max(0, size - prev.size);
          setRate(dt > 0 ? dSize / dt : 0);
        }
        lastSampleRef.current = { size, ts: now };
        setSample({ size, ts: now });
      } catch {
        // best-effort polling — swallow read errors
      }
    };
    void fetchOnce();
    const handle = window.setInterval(fetchOnce, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [isRunning, stdoutPath, projectRoot, boardDirName]);

  if (!isRunning || !sample) return null;
  return { bytesPerSec: rate, totalBytes: sample.size };
}

function formatRate(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "0 B/s";
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
  return `${(kb / 1024).toFixed(2)} MB/s`;
}

function RunnerActivityFooter({
  runner,
  options
}: {
  runner: AutoflowRunner;
  options?: { projectRoot: string; boardDirName: string };
}) {
  const activity = useRunnerActivity(runner);
  // useCountUp 은 IPC 가 token 값을 갱신하면 600ms 동안 부드럽게 카운트.
  const animatedTokens = useCountUp(activity.tokens);
  const liveRate = useLiveStdoutRate(runner, options);
  const rateLabel = liveRate ? formatRate(liveRate.bytesPerSec) : "0 B/s";
  // PRD 224: running 이 아닐 때 activity footer 를 dimmed 로 표시해 사용자가
  // "지금 살아 있는지" 신호를 시각적으로 구분할 수 있게 한다. 토큰 누적 값은
  // stopped 후에도 정보 가치가 있어 숨기지 않고 dim 처리.
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  const isRunning = stateStatus === "running" && Boolean(runner.pid);
  return (
    <footer
      className="ai-conversation-panel-activity"
      data-running={isRunning ? "true" : "false"}
      aria-live="polite"
      title={`마지막 이벤트로부터 ${activity.elapsed} 경과 · 누적 토큰 ${activity.tokens.toLocaleString()}${liveRate ? ` · stdout 누적 ${liveRate.totalBytes.toLocaleString()} B` : ""}`}
    >
      <span>{activity.elapsed}</span>
      <span className="ai-conversation-panel-activity-sep" aria-hidden="true">·</span>
      <span>↓ {animatedTokens.toLocaleString()} tokens</span>
      {rateLabel ? (
        <>
          <span className="ai-conversation-panel-activity-sep" aria-hidden="true">·</span>
          <span className="ai-conversation-panel-activity-rate">{rateLabel}</span>
        </>
      ) : null}
    </footer>
  );
}

function AiConversationPanel({
  runner,
  runnerLabel,
  agentLabel,
  text
}: {
  runner: AutoflowRunner;
  runnerLabel: string;
  agentLabel: string;
  text: string;
}) {
  const panelStatus = aiConversationPanelStatus(runner);

  return (
    <article className="ai-conversation-panel" aria-label={`${runnerLabel} 처리 내용`}>
      <header className="ai-conversation-panel-head">
        <strong>{runnerLabel}</strong>
        <span>{agentLabel}</span>
        <span
          className={`ai-conversation-panel-status ${panelStatus.className}`}
          aria-live="polite"
        >
          <span className="ai-conversation-panel-status-dot" aria-hidden="true">
            {panelStatus.dot}
          </span>
          <span className="ai-conversation-panel-status-label">{panelStatus.label}</span>
        </span>
      </header>
      <ConversationStream label={`${runnerLabel} 최근 터미널 출력`} text={text} streamId={`panel:${runnerLabel}`} />
      <RunnerActivityFooter runner={runner} />
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
  const activeRecoveryStatus = (runner.activeRecoveryStatus || "").toLowerCase();
  const hasActiveTicket = Boolean(runner.activeTicketId);
  const stateSignalText = [
    runner.activeItem,
    runner.activeRecoveryReason,
    runner.activeRecoveryStatus,
    runner.activeRecoveryFailureClass,
    runner.lastResult,
    runner.lastLogLine
  ]
    .join(" ")
    .toLowerCase();
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
    if (/^(stalled|blocked|repairing|requeued|needs_user)$/.test(activeRecoveryStatus)) return "planning";
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
    if (/^(executing|claimed|inprogress|ready_to_merge|ready-to-merge|review|merging)$/.test(activeStage)) {
      return "inprogress";
    }
    return "inprogress";
  }

  if (/\bdone\b|\bpass\b|\bcomplete\b|adapter_exit_0/.test(stateText)) return "done";

  return "todo";
}

type RunnerDelaySeverity = "waiting" | "suspect" | "stuck";

type RunnerDelayStage = {
  severity: RunnerDelaySeverity;
  label: string;
  badgeVariant: "secondary" | "outline" | "destructive";
  className: string;
  title: string;
};

const DEFAULT_RUNNER_DELAY_SUSPECT_SECONDS = 600;
const RUNNER_ADAPTER_TIMEOUT_SECONDS = 1200;

function parsePositiveSeconds(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatRunnerDelayAge(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) return `${safeSeconds}초`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return remainder ? `${minutes}분 ${remainder}초` : `${minutes}분`;
}

function runnerDelayStage(runner: AutoflowRunner): RunnerDelayStage | null {
  if ((runner.stateStatus || "").toLowerCase() !== "running") return null;
  const eventTimes = [runner.lastEventAt, runner.lastAdapterChunkAt]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => !Number.isNaN(value));
  if (eventTimes.length === 0) return null;
  const freshestEventTime = Math.max(...eventTimes);
  const ageSec = (Date.now() - freshestEventTime) / 1000;
  const suspectThresholdSec = parsePositiveSeconds(
    runner.heartbeatStaleThresholdSeconds,
    DEFAULT_RUNNER_DELAY_SUSPECT_SECONDS
  );
  const stuckThresholdSec = Math.max(RUNNER_ADAPTER_TIMEOUT_SECONDS, suspectThresholdSec);
  const ageLabel = formatRunnerDelayAge(ageSec);
  const timeoutLabel = formatRunnerDelayAge(RUNNER_ADAPTER_TIMEOUT_SECONDS);
  const timeoutRemainingLabel = formatRunnerDelayAge(Math.max(0, RUNNER_ADAPTER_TIMEOUT_SECONDS - ageSec));

  if (ageSec >= stuckThresholdSec) {
    return {
      severity: "stuck",
      label: "멈춤 가능",
      badgeVariant: "destructive",
      className: "ai-progress-delay-badge ai-progress-delay-badge-stuck",
      title: `최근 heartbeat/chunk 신호 기준 ${ageLabel} 동안 새 신호가 없습니다. 정상 worker/planner 호출도 5~10분 걸릴 수 있지만, 기본 adapter timeout ${timeoutLabel} 기준을 넘어 멈춤 가능성이 큽니다.`
    };
  }

  if (ageSec >= suspectThresholdSec) {
    return {
      severity: "suspect",
      label: "응답 지연 의심",
      badgeVariant: "outline",
      className: "ai-progress-delay-badge ai-progress-delay-badge-suspect",
      title: `최근 heartbeat/chunk 신호 기준 ${ageLabel} 동안 새 신호가 없습니다. 정상 worker/planner 호출은 5~10분 걸릴 수 있어 즉시 실패로 보지 않으며, 기본 adapter timeout ${timeoutLabel}까지 약 ${timeoutRemainingLabel} 남았습니다.`
    };
  }

  if ((runner.activeStage || "").toLowerCase() === "adapter_running") {
    return {
      severity: "waiting",
      label: "LLM 응답 대기 중",
      badgeVariant: "secondary",
      className: "ai-progress-delay-badge ai-progress-delay-badge-waiting",
      title: `최근 heartbeat/chunk 신호 기준 ${ageLabel} 경과했습니다. LLM 호출 중이며 정상 worker/planner 호출은 5~10분 걸릴 수 있습니다. 기본 adapter timeout ${timeoutLabel} 기준으로 아직 정상 대기 범위입니다.`
    };
  }

  return null;
}

function runnerProgressDetail(runner: AutoflowRunner) {
  // Recovery reason / failure_class strings (e.g. "recovery_state_blocked",
  // "dirty_root") are no longer surfaced — single-flow fail handling routes
  // every blocker to inbox retry, so users only need the active title.
  if (runner.activeTicketTitle) {
    return runner.activeTicketTitle;
  }

  if (runner.activeItem) {
    return runner.activeItem;
  }

  if ((runner.lastResult || "").toLowerCase() === "adapter_auth_required") {
    return runnerLoginMessage(runner);
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

function canonicalWorkflowRunnerRole(value: string) {
  const normalized = (value || "").toLowerCase();
  if (/^(owner|worker|ai)-/.test(normalized)) return "ticket-owner";
  if (/^(planner|plan)-/.test(normalized)) return "planner";
  if (/^(wiki-maintainer|wiki)-/.test(normalized)) return "wiki-maintainer";
  return "";
}

function runnerRoleMatchesDisplayRole(role: string, displayRole: string) {
  const normalized = (role || "").toLowerCase();
  if (displayRole === "ticket-owner") {
    return normalized === "ticket-owner" || normalized === "owner" || normalized === "ticket";
  }
  if (displayRole === "planner") {
    return normalized === "planner" || normalized === "plan";
  }
  if (displayRole === "wiki-maintainer") {
    return normalized === "wiki-maintainer" || normalized === "wiki";
  }
  return normalized === displayRole;
}

function enabledWorkflowRunnerCount(runners: AutoflowRunner[] | undefined, displayRole: string) {
  if (!runners?.length || !displayRole) return 0;
  return runners.filter((runner) => runnerIsEnabled(runner.enabled) && runnerRoleMatchesDisplayRole(runner.role, displayRole)).length;
}

function workflowRoleIsSingleton(runners: AutoflowRunner[] | undefined, displayRole: string) {
  return enabledWorkflowRunnerCount(runners, displayRole) === 1;
}

function displayWorkflowRunnerId(value: string, runners?: AutoflowRunner[]) {
  if (!value) return value;
  const role = canonicalWorkflowRunnerRole(value);
  const singleton = workflowRoleIsSingleton(runners, role);
  if (/^owner-/.test(value)) return singleton ? "worker" : value.replace(/^owner-/, "worker-");
  if (/^worker-/.test(value)) return singleton ? "worker" : value;
  if (/^ai-/i.test(value)) return singleton ? "worker" : value.replace(/^ai-/i, "worker-");
  if (/^planner-\d+$/.test(value) || /^plan-\d+$/.test(value)) {
    return singleton ? "planner" : value.replace(/^plan-/, "planner-");
  }
  if (value === "merge-1") return "머지봇";
  if (/^merge-\d+$/.test(value)) return value.replace(/^merge-/, "머지봇-");
  if (value === "wiki-maintainer-1" || value === "wiki") return singleton ? "LLM Wiki" : "LLM Wiki-1";
  if (/^wiki-maintainer-\d+$/.test(value)) return value.replace(/^wiki-maintainer-/, "LLM Wiki-");
  if (/^wiki-\d+$/.test(value)) return value.replace(/^wiki-/, "LLM Wiki-");
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
  if (role === "wiki-maintainer" || role === "wiki" || role.includes("wiki")) return "LLM Wiki";

  const metaLabel = displayWorkflowRunnerId(runner.id);
  const agentName = runner.agent ? runner.agent.charAt(0).toUpperCase() + runner.agent.slice(1) : "AI";
  return metaLabel ? `${agentName}(${metaLabel})` : agentName;
}

function progressBoardRunnerOrder(runner: AutoflowRunner) {
  const role = (runner.role || "").toLowerCase();
  const idRole = canonicalWorkflowRunnerRole(runner.id);
  if (["planner", "plan", "orchestrator"].includes(role) || idRole === "planner") return 0;
  if (["ticket-owner", "worker", "ticket", "owner"].includes(role) || idRole === "ticket-owner") return 1;
  if (role === "wiki-maintainer" || role === "wiki" || role.includes("wiki") || idRole === "wiki-maintainer") return 2;
  return 3;
}

function sortProgressBoardRunners(runners: AutoflowRunner[]) {
  return runners
    .map((runner, index) => ({ runner, index }))
    .sort((a, b) => progressBoardRunnerOrder(a.runner) - progressBoardRunnerOrder(b.runner) || a.index - b.index)
    .map(({ runner }) => runner);
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

function displayActiveTicketBadge(value: string) {
  return workflowFileDisplayName(value.endsWith(".md") ? value : `${value}.md`);
}

function activeTicketSummary(runner: AutoflowRunner) {
  if (!runner.activeTicketId) {
    return "";
  }

  const title = runner.activeTicketTitle || runner.activeItem || "제목 없음";
  const projectKey = projectKeyFromSpecRef(runner.activeSpecRef);
  const ticketLabel = displayActiveTicketBadge(runner.activeTicketId);
  return projectKey ? `${ticketLabel} — ${title} (${projectKey})` : `${ticketLabel} — ${title}`;
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
  savedDraft,
  onSelectRunner,
  onControl,
  onRunnerAuthChoice,
  onDraftChange,
  onConfigure
}: {
  runner: AutoflowRunner;
  onSelect: (filePath: string) => void;
  installedAgentProfiles?: InstalledAgentProfiles;
  options?: { projectRoot: string; boardDirName: string };
  actionKey?: string;
  draft?: RunnerDraft;
  savedDraft?: RunnerDraft;
  onSelectRunner?: (runnerId: string) => void;
  onControl?: (action: RunnerControlAction, runnerId: string, options?: RunnerControlOptions) => void;
  onRunnerAuthChoice?: (choice: RunnerAuthChoice, runner: AutoflowRunner) => void;
  onDraftChange?: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure?: (runner: AutoflowRunner, restartAfterSave?: boolean) => void;
}) {
  const currentKey = runnerStageKey(runner);
  const hideProgressTrack = isCoordinatorRole(runner.role);
  const flowStages = flowStagesForRunner(runner);
  const stage = flowStages.find((candidate) => candidate.key === currentKey) || flowStages[Math.min(1, flowStages.length - 1)];
  const stageIndex = flowStages.findIndex((candidate) => candidate.key === currentKey);
  const stageCount = Math.max(1, flowStages.length);
  const progressStepCount = Math.max(1, stageCount - 1);
  const progressFillPercent = stageIndex > 0 ? (stageIndex / progressStepCount) * 100 : 0;
  const progressScale = String(Math.max(0, Math.min(1, progressFillPercent / 100)));
  const status = runner.stateStatus || "idle";
  const role = (runner.role || "").toLowerCase();
  const isWorkerProgressRow = role === "ticket-owner" || role === "owner" || role === "ticket";
  const isBlocked = (runner.activeStage || "").toLowerCase() === "blocked";
  const detail = runnerProgressDetail(runner);
  const delayStage = runnerDelayStage(runner);
  const detailTimestamp = timestampFromRunnerLog(detail);
  const displayDetail = isMachineRunnerLog(detail) ? "" : detail;
  const ticketSummary = activeTicketSummary(runner);
  const detailText = ticketSummary && detail === runner.activeTicketTitle ? "" : displayDetail;
  const agentLabel = displayProgressRunnerLabel(runner);
  const agentTitle = displayProgressRoleLabel(runner);
  const isRunnerActive =
    (runner.stateStatus || "").toLowerCase() === "running" && Boolean(runner.pid);
  const liveStdoutText = useLiveStdoutText(runner, options);
  const previewText = runnerConversationText(runner);
  // 종료(idle/stopped) 상태면 터미널을 비운다. 실행 중일 때만 내용 표시.
  const conversationText = isRunnerActive ? (liveStdoutText || previewText) : "";
  const statusLower = status.toLowerCase();
  const mode = "loop";
  // actionKey holds the action label for THIS runner only ("" when idle).
  const isWorking = Boolean(actionKey);
  const transitionLabel = runnerTransitionLabel(actionKey);
  const canForceStop = actionKey === "stopping_pending";
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
  const isApplyingConfig = actionKey === "config_applying" || actionKey === "config_applying_restart";
  const showConversation = shouldShowConversation(runner) || Boolean(liveStdoutText);
  const showAuthPrompt = runnerNeedsLogin(runner) && Boolean(onRunnerAuthChoice);
  const showAgentConfig =
    runner.role === "wiki-maintainer" ||
    runner.role === "wiki" ||
    runner.role === "ticket-owner" ||
    runner.role === "owner" ||
    runner.role === "planner" ||
    runner.role === "plan";

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
    const ticketId = runner.activeTicketId;
    const numericMatch = ticketId.match(/(\d+)/);
    const ticketFiles = new Set<string>();
    ticketFiles.add(`${ticketId}.md`);
    if (numericMatch) {
      const n = numericMatch[1];
      ticketFiles.add(`Todo-${n}.md`);
      ticketFiles.add(`tickets_${n}.md`);
    }
    const folders = ["inprogress", "todo"];
    const candidatePaths: string[] = [];
    for (const folder of folders) {
      for (const file of ticketFiles) {
        candidatePaths.push(`${projectRoot}/${boardDir}/tickets/${folder}/${file}`);
      }
    }
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
          <div className={`ai-progress-agent-title${isWorkerProgressRow ? " ai-progress-agent-title-worker" : ""}`}>
            <AgentAppIcon agent={runner.agent || ""} />
            <div className="ai-progress-agent-label-cluster">
              <strong>{agentTitle}</strong>
            </div>
          </div>
        </div>
        {canControl ? (
          <div className="ai-progress-actions" aria-label={`${agentTitle} 제어`}>
            {canStop ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="runner-icon-button runner-plain-icon-button"
                  aria-label={`${runner.id} 중지`}
                  disabled={Boolean(actionKey)}
                  onClick={() => {
                    onControl?.("stop", runner.id);
                  }}
                >
                  {isWorking && (actionKey === "stopping_pending" || actionKey === "stopping_force") ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
                {canForceStop ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="runner-icon-button runner-plain-icon-button"
                    aria-label={`${runner.id} 강제 종료`}
                    onClick={() => {
                      if (window.confirm(`${displayWorkflowRunnerId(runner.id)} runner 를 강제 종료할까요?`)) {
                        onControl?.("stop", runner.id, { force: true });
                      }
                    }}
                  >
                    <TriangleAlert className="h-4 w-4" />
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="runner-icon-button runner-plain-icon-button"
                aria-label={`${runner.id} 시작`}
                disabled={!canStart || Boolean(actionKey)}
                onClick={() => {
                  onControl?.("start", runner.id);
                }}
              >
                {isWorking && actionKey === "starting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {!hideProgressTrack ? (
        <div
          className={`ai-progress-track ${currentKey === "reject" || currentKey === "blocked" ? "ai-progress-track-reject" : ""}`}
          style={{ "--progress-scale": progressScale, "--stage-count": String(flowStages.length) } as React.CSSProperties}
          aria-label={`${agentLabel} 현재 단계 ${stage.label}`}
        >
          {flowStages.map((step, index) => {
            const stepState = flowStepState(step.key, currentKey, flowStages);
            const stepPosition = flowStages.length > 1 ? (index / (flowStages.length - 1)) * 100 : 0;
            return (
              <div
                key={step.key}
                className={`ai-progress-step ai-progress-step-${stepState}`}
                style={{ "--step-position": stepPosition } as React.CSSProperties}
              >
                <span className={`ai-progress-dot ${step.tone}`} aria-hidden="true" />
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="ai-progress-current">
        <Badge
          variant={isBlocked ? "destructive" : "secondary"}
          className="ai-progress-status-badge"
        >
          {isBlocked ? "막힘" : displayStatus(status)}
        </Badge>
        {isApplyingConfig ? (
          <Badge variant="outline" className="ai-progress-config-pending-badge">
            적용 대기
          </Badge>
        ) : null}
        {transitionLabel ? (
          <Badge variant="outline" className="runner-transition-inline" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{transitionLabel}</span>
          </Badge>
        ) : null}
        {detailText ? <p title={detailText}>{detailText}</p> : null}
        {delayStage ? (
          <Badge
            variant={delayStage.badgeVariant}
            className={delayStage.className}
            title={delayStage.title}
          >
            {delayStage.label}
          </Badge>
        ) : null}
        {runner.activeTicketId ? (
          <Button
            variant="ghost"
            type="button"
            className="ai-progress-active-ticket-button"
            onClick={openTicketDialog}
            title={`${displayActiveTicketBadge(runner.activeTicketId)} 티켓 보기`}
          >
            <Badge variant="outline" className="ai-progress-active-ticket">
              {displayActiveTicketBadge(runner.activeTicketId)}
            </Badge>
          </Button>
        ) : null}
      </div>
      {canConfigure ? (
        <RunnerConfigControls
          runner={runner}
          installedAgentProfiles={installedAgentProfiles || {}}
          actionKey={actionKey}
          draft={runnerDraft}
          savedDraft={savedDraft}
          canEditConfig={canEditConfig}
          onSelectRunner={onSelectRunner!}
          onDraftChange={onDraftChange!}
          onConfigure={onConfigure!}
          showAgent={showAgentConfig}
          className={`ai-progress-config runner-config${showAgentConfig ? " ai-progress-config-with-agent" : ""}`}
        />
      ) : null}
      {showAuthPrompt ? (
        <div className="runner-auth-prompt" role="group" aria-label={`${agentTitle} 인증 선택`}>
          <div className="runner-auth-copy">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            <span>{runnerLoginMessage(runner)}</span>
          </div>
          <div className="runner-auth-actions">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={Boolean(actionKey)}
              onClick={() => onRunnerAuthChoice?.("continue", runner)}
            >
              {actionKey === "auth_continue" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Y 계속</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(actionKey)}
              onClick={() => onRunnerAuthChoice?.("cancel", runner)}
            >
              <X className="h-4 w-4" />
              <span>n 취소</span>
            </Button>
          </div>
        </div>
      ) : null}
      <LiveTerminalView text={conversationText} ariaLabel={`${agentLabel} 라이브 터미널`} />
      <RunnerActivityFooter runner={runner} options={options} />
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent
          className="workflow-pin-layer-panel workflow-pin-layer-default"
          overlayClassName="workflow-pin-layer-overlay"
          keepMounted
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
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="workflow-pin-layer-close"
              onClick={() => setTicketDialogOpen(false)}
              aria-label="닫기"
            >
              ✕
            </Button>
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
  onSelect,
  limit = 16,
  className
}: {
  board: AutoflowBoardSnapshot | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
  limit?: number | null;
  className?: string;
}) {
  const logs = React.useMemo(() => recentLogs(board, limit), [board, limit]);

  if (!logs.length) {
    return <div className="empty-panel">로그가 없습니다</div>;
  }

  return (
    <div className={`log-list${className ? ` ${className}` : ""}`}>
      {logs.map((log) => (
        <Button
          key={log.filePath}
          variant="ghost"
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
        </Button>
      ))}
    </div>
  );
}


function WikiQueryPanel({
  query,
  onQueryChange,
  onSubmit,
  onCancel,
  isRunning,
  result,
  selectedPath,
  onSelect
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isRunning: boolean;
  result: WikiQueryParsed | null;
  selectedPath: string;
  onSelect: (filePath: string) => void;
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
        {isRunning && onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            <Square className="h-4 w-4" />
            <span>취소</span>
          </Button>
        ) : null}
      </form>
      {result ? (
        result.results.length === 0 ? (
          <div className="empty-panel">일치하는 결과가 없습니다</div>
        ) : (
          <div className="log-list wiki-query-results">
            {result.results.map((entry) => (
              <Button
                key={entry.path}
                variant="ghost"
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
              </Button>
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
  const entries = [
    ...(board?.wikiFiles || []).map((file) => ({ kind: "wiki" as const, file })),
    ...(board?.conversationFiles || []).map((file) => ({ kind: "handoff" as const, file }))
  ].sort((a, b) =>
    String(b.file.modifiedAt || "").localeCompare(String(a.file.modifiedAt || ""))
  );

  if (!entries.length) {
    return <div className="empty-panel">No wiki pages</div>;
  }

  return (
    <div className="log-list knowledge-list">
      {entries.map(({ kind, file }) => (
        <Button
          key={file.filePath}
          variant="ghost"
          type="button"
          className={`log-row${selectedPath === file.filePath ? " log-row-selected" : ""}`}
          onClick={() => onSelect(file.filePath)}
        >
          {kind === "wiki" ? (
            <BookOpenText className="h-4 w-4" />
          ) : (
            <ClipboardList className="h-4 w-4" />
          )}
          <div className="min-w-0">
            <strong>{file.name}</strong>
            <span>
              {kind === "wiki" ? "Wiki" : "Source · Handoff"} · {formatDate(file.modifiedAt)}
            </span>
            <p>{file.title}</p>
          </div>
        </Button>
      ))}
    </div>
  );
}

// AI 주도 sh 실행 원칙: 사용자 view 에는 AI 가 한 일(narrative)만 보이고,
// sh tool 의 raw protocol — envelope 마커, key=value 프로토콜 라인,
// 그리고 어댑터(Codex/Claude) transcript 안의 tool 호출/diff/shell 명령
// 같은 raw transcript 본문 — 은 모두 숨긴다. 디버그가 필요하면 원본은
// .autoflow/runners/logs/ 의 raw 파일에서 확인할 수 있고, UI 에서는
// 헤더의 "raw +N" 토글로 펼칠 수 있다.
//
// 룰:
//  - `*_begin` / `*_end` envelope 마커 자체는 항상 strip.
//  - `narrative_text` envelope 안의 content 는 AI 의 최종 메시지이므로 KEEP.
//  - 그 외 envelope (adapter_stdout, adapter_stderr, recovery_signal,
//    runtime_output, finish.output, adapter_prompt 등) 안의 content 는
//    DROP — AI 가 도구로 한 일이지 AI 가 사용자에게 한 말이 아님.
//  - envelope 밖에서 `narrative=<text>` 한 줄은 prose 로 surface.
//  - envelope 밖에서 snake_case `key=value` 는 protocol 이므로 DROP.
//  - 그 외 prose 라인은 KEEP.
const NARRATIVE_KEEP_ENVELOPES = new Set<string>(["narrative_text"]);

function summarizeRunnerLogForUserView(rawContent: string): { content: string; hidLines: number } {
  if (!rawContent) {
    return { content: rawContent, hidLines: 0 };
  }
  const ENVELOPE_BEGIN = /^([a-z_][a-z0-9_.]*)_begin$/;
  const ENVELOPE_END = /^([a-z_][a-z0-9_.]*)_end$/;
  const PROTOCOL_KV = /^[a-z_][a-z0-9_.]*=/;
  const lines = rawContent.split(/\r?\n/);
  const out: string[] = [];
  const envelopeStack: string[] = [];
  let hid = 0;
  let lastBlank = true;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/u, "");
    const trimmed = line.trim();
    const beginMatch = ENVELOPE_BEGIN.exec(trimmed);
    if (beginMatch) {
      envelopeStack.push(beginMatch[1]);
      hid++;
      continue;
    }
    const endMatch = ENVELOPE_END.exec(trimmed);
    if (endMatch) {
      const idx = envelopeStack.lastIndexOf(endMatch[1]);
      if (idx >= 0) {
        envelopeStack.splice(idx, 1);
      }
      hid++;
      continue;
    }
    const insideEnvelope = envelopeStack.length > 0;
    // Innermost envelope wins: nested transcript (e.g. recovery_signal) inside
    // a narrative_text wrapper still gets dropped.
    const innermost = envelopeStack[envelopeStack.length - 1];
    const insideKeepEnvelope = !!innermost && NARRATIVE_KEEP_ENVELOPES.has(innermost);
    if (insideEnvelope && !insideKeepEnvelope) {
      // Drop everything inside transcript / protocol envelopes.
      hid++;
      continue;
    }
    if (!insideEnvelope && PROTOCOL_KV.test(line)) {
      if (line.startsWith("narrative=")) {
        const text = line.slice("narrative=".length);
        if (text) {
          out.push(text);
          lastBlank = false;
        }
      } else {
        hid++;
      }
      continue;
    }
    if (line === "") {
      if (!lastBlank) {
        out.push("");
        lastBlank = true;
      }
      continue;
    }
    out.push(line);
    lastBlank = false;
  }
  while (out.length && out[out.length - 1] === "") {
    out.pop();
  }
  return { content: out.join("\n"), hidLines: hid };
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
  const [showRaw, setShowRaw] = React.useState(false);
  const summary = React.useMemo(
    () => (preview?.content ? summarizeRunnerLogForUserView(preview.content) : { content: "", hidLines: 0 }),
    [preview?.content]
  );
  const displayContent = preview ? (showRaw ? preview.content : summary.content) : "";
  const placeholder = showRaw ? "(비어 있음)" : "(AI 가 정리한 메시지가 없습니다)";
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
        {!isLoading && preview && summary.hidLines > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="log-preview-raw-toggle"
            onClick={() => setShowRaw((current) => !current)}
            title={showRaw ? "AI 정리 본문만 보기" : `숨겨진 sh raw 라인 ${summary.hidLines}개 펼치기`}
          >
            {showRaw ? "AI 본문" : `raw +${summary.hidLines}`}
          </Button>
        ) : null}
        {headerAction}
      </div>
      {error ? <div className="log-preview-error">{error}</div> : null}
      {!error && preview ? <pre>{displayContent || placeholder}</pre> : null}
      {!error && !preview ? <div className="empty-panel log-preview-empty">선택된 로그가 없습니다</div> : null}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
