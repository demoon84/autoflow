import * as React from "react";
import { createRoot } from "react-dom/client";
import AnsiToHtml from "ansi-to-html";
import Chart from "chart.js/auto";
import type { ChartConfiguration } from "chart.js";
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
  Computer,
  Database,
  FileText,
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
  Square,
  Sun,
  Terminal,
  Table2,
  TriangleAlert,
  PieChart,
  Trash2,
  Workflow,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import "./styles.css";
import claudeAppIcon from "./assets/agent-icons/claude.png";
import codexAppIcon from "./assets/agent-icons/codex.png";
import { WikiPanel } from "./wiki-panel";

type AlertSeverity = "error" | "warning" | "info" | "success";
type ThemeMode = "light" | "dark";

const RUNNER_RESOURCE_USAGE_POLL_MS = 2000;

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

const ticketFolders = ["prd", "todo", "inprogress", "done"] as const;
const initialInstallProgressLabel = "설치 준비 중입니다.";

function createRendererInvocationId(prefix: string) {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildBoardScopeKey(target: { projectRoot: string; boardDirName: string }) {
  if (!target.projectRoot) return "";
  return `${target.projectRoot}::${target.boardDirName}`;
}

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

const workerFlowStages = [
  { key: "idle", label: "대기", meta: "다음 실행 차례", icon: Layers3, tone: "flow-todo" },
  { key: "inprogress", label: "구현", meta: "mini-plan / 구현 / 검증", icon: Activity, tone: "flow-inprogress" },
  { key: "merging", label: "마무리", meta: "PRD worktree 반영", icon: CheckCircle2, tone: "flow-done" }
] as const;

const wikiBotFlowStages = [
  { key: "idle", label: "대기", meta: "다음 동기화 대기", icon: Layers3, tone: "flow-todo" },
  { key: "syncing", label: "작성중", meta: "Wiki 갱신", icon: Activity, tone: "flow-inprogress" }
] as const;

const plannerFlowStages = [
  { key: "idle", label: "대기", meta: "prd 감시", icon: Layers3, tone: "flow-todo" },
  { key: "planning", label: "계획", meta: "PRD 분해 / 재계획", icon: ClipboardList, tone: "flow-plan" },
  { key: "generating-todo", label: "티켓생성", meta: "todo 생성 완료", icon: CheckCircle2, tone: "flow-done" }
] as const;

type FlowStageDef = {
  readonly key: string;
  readonly label: string;
  readonly meta: string;
  readonly icon: typeof Layers3;
  readonly tone: string;
};

const fallbackFlowFolder = ".autoflow";
const runnerAgentOptions = ["codex", "claude"] as const;
const runnerAgentModelOptions: Record<string, string[]> = {
  codex: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"],
  claude: ["opus", "sonnet"]
};
const runnerAgentReasoningOptions: Record<string, string[]> = {
  codex: ["medium", "high", "xhigh"],
  claude: ["medium", "high", "xhigh", "max"]
};
const runnerOptionLabels: Record<string, Record<string, string>> = {
  codex: {
    medium: "보통",
    high: "높음",
    xhigh: "매우 높음"
  },
  claude: {
    opus: "Opus 4.7",
    sonnet: "Sonnet 4.6",
    "claude-opus-4-1-20250805": "Opus 4.1",
    "claude-opus-4-20250514": "Opus 4",
    "claude-sonnet-4-20250514": "Sonnet 4",
    "claude-3-7-sonnet-20250219": "Claude 3.7 Sonnet",
    "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
    medium: "보통",
    high: "높음",
    xhigh: "매우 높음",
    max: "Max"
  }
};

function normalizeRunnerReasoningValue(agent: string, value: string) {
  const options = runnerAgentReasoningOptions[agent] || [];
  const normalized = (value || "").trim().toLowerCase();
  if (!options.length) return normalized;
  return options.includes(normalized) ? normalized : "medium";
}
const runnerModeOptions = ["one-shot", "loop", "watch"] as const;
const runnerEnabledOptions = ["true", "false"] as const;
const runnableRunnerAgents = new Set<string>(runnerAgentOptions);

const settingsNavigation = [
  { key: "progress", label: "AI Agent", icon: Computer },
  { key: "kanban", label: "티켓", icon: KanbanSquare },
  { key: "knowledge", label: "LLM위키", icon: BookOpenText },
  { key: "snapshot", label: "운영 통계", icon: BarChart3 }
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

type WorkflowBoardOptions = {
  projectRoot: string;
  boardDirName: string;
  allRunners?: AutoflowRunner[];
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

function defaultRecentProjects(currentProjectRoot: string) {
  return currentProjectRoot ? [currentProjectRoot] : [];
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

function normalizedProjectRootKey(value: string) {
  return value.trim().replace(/[\\/]+$/, "");
}

function isBlockedProjectRoot(projectRoot: string, blockedProjectRoots: string[]) {
  if (!projectRoot || blockedProjectRoots.length === 0) {
    return false;
  }

  const projectKey = normalizedProjectRootKey(projectRoot);
  return blockedProjectRoots.some((blockedRoot) => normalizedProjectRootKey(blockedRoot) === projectKey);
}

function filterBlockedProjectRoots(projects: string[], blockedProjectRoots: string[]) {
  if (blockedProjectRoots.length === 0) {
    return projects;
  }

  return projects.filter((project) => !isBlockedProjectRoot(project, blockedProjectRoots));
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

const projectTabsStorageKey = "autoflow.projectTabs";

function readProjectTabs(currentProjectRoot: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(projectTabsStorageKey) || "[]");
    if (Array.isArray(parsed)) {
      const saved = normalizeProjectList(parsed.filter((value) => typeof value === "string"));
      return currentProjectRoot && !saved.includes(currentProjectRoot)
        ? normalizeProjectList([currentProjectRoot, ...saved])
        : saved;
    }
  } catch {
    // Ignore corrupt persisted UI state and keep the active project reachable.
  }

  return normalizeProjectList(currentProjectRoot ? [currentProjectRoot] : []);
}

function persistProjectTabs(projects: string[]) {
  window.localStorage.setItem(projectTabsStorageKey, JSON.stringify(projects));
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

  const completedFiles = board.tickets.done || [];
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
    codeNetDeltaCount: statusNumber(metrics, "autoflow_code_net_delta_count"),
    tokenUsageCount: statusNumber(metrics, "autoflow_token_usage_count"),
	    tokenReportCount: statusNumber(metrics, "autoflow_llm_request_count") || statusNumber(metrics, "autoflow_token_report_count"),
    tokenCacheReadCount: statusNumber(metrics, "autoflow_token_cache_read_count"),
    tokenUsage1hCount: statusNumber(metrics, "autoflow_token_usage_1h_count"),
    tokenUsage24hCount: statusNumber(metrics, "autoflow_token_usage_24h_count"),
    tokenInput1hCount: statusNumber(metrics, "autoflow_token_input_1h_count"),
    tokenOutput1hCount: statusNumber(metrics, "autoflow_token_output_1h_count"),
    tokenCache1hCount: statusNumber(metrics, "autoflow_token_cache_1h_count"),
    tokenInput24hCount: statusNumber(metrics, "autoflow_token_input_24h_count"),
    tokenOutput24hCount: statusNumber(metrics, "autoflow_token_output_24h_count"),
    tokenCache24hCount: statusNumber(metrics, "autoflow_token_cache_24h_count")
  };
}

function parseMetricJsonObject(value: string) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseMetricJsonArray(value: string): Array<Record<string, unknown>> {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  } catch {
    return [];
  }
}

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSortedBreakdown(raw: Record<string, unknown>, fallbackCount = 8) {
  return Object.entries(raw)
    .map(([label, rawValue]) => ({ label, value: toNumber(rawValue) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, fallbackCount);
}

type ReportBreakdownItem = { label: string; value: number };

function mergeBreakdownLabels(items: ReportBreakdownItem[], labelFor: (label: string) => string): ReportBreakdownItem[] {
  const totals = new Map<string, number>();

  for (const item of items) {
    const label = labelFor(item.label);
    totals.set(label, (totals.get(label) || 0) + item.value);
  }

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "ko-KR"));
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
  claimed: "작업 확보됨",
  inprogress: "진행 중",
  verifying: "검증 중",
  verify_pending: "검증 대기",
  verifier_pending: "검증 대기",
  verifier_pass: "검증 통과",
  verifier_passed: "검증 통과",
  verifier_passed_worker_finalization_pending: "검증 통과 · Worker 마무리",
  verifier_revise: "수정 요청",
  verifier_replan: "재계획 요청",
  verifier_reject: "검증 반려",
  verifier_rejected: "검증 반려",
  verified_pending_merge: "검증 통과 · Worker 마무리",
  needs_ai_merge: "Worker 마무리 필요",
  ai_merge_required: "Worker 마무리 필요",
  revision_requested: "수정 요청",
  replan_requested: "재계획 요청",
  merging: "Worker 마무리 중",
  done: "완료",
  completed: "완료",
  complete: "완료",
  committed_via_completion_finalizer: "완료 커밋 생성됨",
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
  active_get: "작업 상태 확인됨",
  no_owned_inprogress_ticket: "담당 티켓 없음",
  runner_has_active_ticket: "담당 티켓 처리 중",
  worker_owned_ticket_pending: "담당 티켓 진행 대기",
  worker_ticket_blocked: "티켓 보완 필요",
  worker_ticket_waiting_for_verifier: "Verifier 응답 대기",
  worker_work_blocked: "처리할 work item 없음",
  worker_work_claimable: "처리 가능한 work item 있음",
  planner_handoff_turn_requested: "Planner 호출 요청됨",
  verifier_handoff_turn_requested: "Verifier 호출 요청됨",
  verifier_revision_requested: "검증 수정 요청 확인됨",
  verifier_replan_requested: "검증 재계획 요청 확인됨",
  worker_work_handoff_turn_requested: "Worker 호출 요청됨",
  wiki_handoff_turn_requested: "Wiki 호출 요청됨",
  wiki_idle_no_followup: "처리할 작업 없음",
  dry_run: "미리 실행",
  true: "사용",
  false: "중지"
};

// Default topology is planner + worker + verifier + wiki.
const runnerRoleLabels: Record<string, string> = {
  "worker": "Worker",
  ticket: "Worker",
  planner: "Planner",
  plan: "Planner",
  "wiki-maintainer": "Wiki",
  wiki: "Wiki",
  verifier: "Verifier",
  coordinator: "coordinator (legacy)",
  coord: "coordinator (legacy)",
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
  const raw = (value || "").trim();
  const normalized = raw.toLowerCase();
  const processExit = normalized.match(/^exit_(\d+)$/);
  if (processExit) {
    return processExit[1] === "0" ? "정상 종료" : "오류로 종료됨";
  }

  if (normalized === "loop_stopped") {
    return "중지됨";
  }

  if (normalized === "runner_start_requested") {
    return "시작 요청됨";
  }

  const adapterExit = normalized.match(/^adapter_exit_(\d+)$/);
  if (adapterExit) {
    return adapterExit[1] === "0" ? "정상 종료" : "오류로 종료됨";
  }

  const signalExit = normalized.match(/^signal_(.+)$/);
  if (signalExit) {
    const signal = signalExit[1].toUpperCase();
    if (signal === "9" || signal === "SIGKILL") return "강제 종료됨";
    if (signal === "15" || signal === "SIGTERM") return "종료됨";
    return `신호 ${signalExit[1]} 종료`;
  }

  const loopExit = normalized.match(/^loop_waiting_exit_(\d+)$/);
  if (loopExit) {
    return loopExit[1] === "0" ? "다음 실행 대기" : `종료 ${loopExit[1]} 후 대기`;
  }

  const stageResult = normalized.match(/^stage_(.+)$/);
  if (stageResult) {
    return displayStatus(stageResult[1]);
  }

  const verifierDecision = normalized.match(/^verifier_(pass|revise|replan|reject)$/);
  if (verifierDecision) {
    return statusLabels[`verifier_${verifierDecision[1]}`] || raw;
  }

  return statusLabels[normalized] || raw || "-";
}

function displayActiveItemLabel(value: string) {
  const displayedStatus = displayStatus(value);
  if (displayedStatus !== (value || "").trim() && displayedStatus !== "-") {
    return displayedStatus;
  }
  return displayActiveTicketBadge(value);
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

function normalizeRunnerModelValue(agent: string, value: string) {
  const trimmed = value.trim();
  if (agent !== "claude") {
    return trimmed;
  }

  return trimmed;
}

function isPreferredClaudeModel(value: string) {
  const normalized = normalizeRunnerModelValue("claude", value).toLowerCase();
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

function displayRunnerOption(agent: string, value: string) {
  const mapped = runnerOptionLabels[agent]?.[value];
  if (mapped) {
    return mapped;
  }

  if (agent === "claude" && value.endsWith("[1m]")) {
    const base = value.slice(0, -4);
    const baseLabel = runnerOptionLabels.claude?.[base];
    return baseLabel ? `${baseLabel} 1M` : value;
  }

  return value;
}

function runnerProfileForAgent(agent: string, installedAgentProfiles: InstalledAgentProfiles) {
  return (
    installedAgentProfiles[agent] || {
    installed: false,
    model: "",
    reasoning: "",
    supportsReasoning: true
  }
);
}

function runnerModelChoices(agent: string, installedAgentProfiles: InstalledAgentProfiles, currentValue = "") {
  const profile = runnerProfileForAgent(agent, installedAgentProfiles);
  const discoveredModels = Array.isArray(profile.models) ? profile.models : [];
  const optionValues = [currentValue, profile.model, ...discoveredModels, ...(runnerAgentModelOptions[agent] || [])];
  const filteredValues = agent === "claude" ? optionValues.filter(isPreferredClaudeModel) : optionValues;
  return uniqueOptions(
    filteredValues.map((value) => normalizeRunnerModelValue(agent, value))
  );
}

function runnerReasoningChoices(agent: string, installedAgentProfiles: InstalledAgentProfiles, currentValue = "") {
  const profile = runnerProfileForAgent(agent, installedAgentProfiles);
  if (!profile.supportsReasoning) {
    return [];
  }
  return runnerAgentReasoningOptions[agent] || uniqueOptions([currentValue, profile.reasoning]);
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
  const normalizedRequestedReasoning = normalizeRunnerReasoningValue(agent, reasoning);
  const normalizedReasoning =
    agent === "claude" && profile.supportsReasoning
      ? reasoningChoices.includes(normalizedRequestedReasoning)
        ? normalizedRequestedReasoning
        : "medium"
      : profile.supportsReasoning
        ? (reasoningChoices.includes(normalizedRequestedReasoning) ? normalizedRequestedReasoning : reasoningChoices[0] || "")
        : "";

  return {
    model: normalizedModel,
    reasoning: normalizedReasoning,
    supportsReasoning: profile.supportsReasoning,
    modelChoices,
    reasoningChoices
  };
}

function runnerDraftFromRunner(runner: AutoflowRunner): RunnerDraft {
  const mode = runnerDefaultMode(runner);
  const intervalSeconds = runnerDefaultIntervalSeconds(runner);
  return {
    agent: runner.agent || "codex",
    model: runner.model || "",
    reasoning: normalizeRunnerReasoningValue(runner.agent || "codex", runner.reasoning || ""),
    mode: runner.mode || mode,
    intervalSeconds: runner.intervalSeconds || intervalSeconds,
    enabled: runner.enabled || "true",
    command: runner.command || ""
  };
}

function isWikiRunner(runner: Pick<AutoflowRunner, "id" | "role">) {
  const id = (runner.id || "").toLowerCase();
  const role = (runner.role || "").toLowerCase();
  return id === "wiki" || id.startsWith("wiki-") || role === "wiki" || role === "wiki-maintainer";
}

function runnerConfiguredRole(runner: Pick<AutoflowRunner, "role">) {
  return (runner.role || "").toLowerCase();
}

function runnerCurrentRoleValue(
  runner: Pick<AutoflowRunner, "role"> & Partial<Pick<AutoflowRunner, "activeRole" | "assignmentRole">>
) {
  return (runner.activeRole || runner.assignmentRole || runner.role || "").toLowerCase();
}

function runnerUsesScheduledLoop(runner: Pick<AutoflowRunner, "id" | "role">) {
  return false;
}

function runnerDefaultMode(runner: Pick<AutoflowRunner, "id" | "role">) {
  return runnerUsesScheduledLoop(runner) ? "loop" : "";
}

function runnerDefaultIntervalSeconds(runner: Pick<AutoflowRunner, "id" | "role">) {
  return runnerUsesScheduledLoop(runner) ? "60" : "";
}

function runnerDraftsEqual(left?: RunnerDraft, right?: RunnerDraft) {
  if (!left || !right) return false;
  return (
    left.agent === right.agent &&
    left.model === right.model &&
    left.reasoning === right.reasoning &&
    left.mode === right.mode &&
    left.intervalSeconds === right.intervalSeconds &&
    left.enabled === right.enabled &&
    left.command === right.command
  );
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
  if (role === "worker") {
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
  const reasoning = normalizeRunnerReasoningValue(draft.agent, draft.reasoning);
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

function recentLogs(board: AutoflowBoardSnapshot | null, limit: number | null = 16): DisplayLog[] {
  const runnerLogs = (board?.runnerLogs || []).map((log) => ({ ...log, source: "Runner" as const }));

  const sorted = [...runnerLogs].sort((a, b) =>
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
  return [
    ...ticketFiles,
    ...(board.runnerLogs || []),
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
  vectorScore: number | null;
  bm25Score: number | null;
  startLine: number | null;
  endLine: number | null;
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
    const prefix = values[`match.${i}.path`] ? `match.${i}` : `result.${i}`;
    const path = values[`${prefix}.path`];
    if (!path) continue;
    const score = Number(values[`${prefix}.score`] || "0") || 0;
    const vectorScoreValue = Number(values[`${prefix}.vector_score`] || "");
    const bm25ScoreValue = Number(values[`${prefix}.bm25_score`] || "");
    const startLineValue = Number(values[`${prefix}.chunk_start_line`] || values[`${prefix}.start_line`] || "");
    const endLineValue = Number(values[`${prefix}.chunk_end_line`] || values[`${prefix}.end_line`] || "");
    const snippetCount = Number(values[`${prefix}.snippet_count`] || "0") || 0;
    const snippets: WikiQuerySnippet[] = [];
    for (let s = 1; s <= snippetCount; s++) {
      const lineNo = Number(values[`${prefix}.snippet.${s}.line`] || "0") || 0;
      const text = values[`${prefix}.snippet.${s}.text`] || "";
      if (text) snippets.push({ line: lineNo, text });
    }
    results.push({
      path,
      title: (values[`${prefix}.title`] || wikiTitleFromPath(path)).replace(/^#+\s*/, "").trim(),
      kind: values[`${prefix}.kind`] || wikiKindFromPath(path),
      score,
      vectorScore: Number.isFinite(vectorScoreValue) ? vectorScoreValue : null,
      bm25Score: Number.isFinite(bm25ScoreValue) ? bm25ScoreValue : null,
      startLine: Number.isFinite(startLineValue) && startLineValue > 0 ? startLineValue : null,
      endLine: Number.isFinite(endLineValue) && endLineValue > 0 ? endLineValue : null,
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

function wikiTitleFromPath(filePath: string) {
  const name = filePath.split(/[\\/]/).pop() || filePath;
  const base = name.replace(/\.md$/i, "");
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ") || filePath;
}

function wikiKindFromPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/decisions/")) return "wiki-decision";
  if (normalized.includes("/architecture")) return "wiki-architecture";
  if (normalized.includes("/answers/")) return "wiki-answer";
  if (normalized.includes("/operations/")) return "wiki-operation";
  if (normalized.includes("/tickets/done/")) return "ticket-done";
  if (normalized.includes("/tickets/reject/")) return "ticket-reject";
  if (normalized.includes("/conversations/")) return "handoff";
  if (normalized.includes("/logs/")) return "log";
  if (normalized.includes("/wiki/") || normalized.startsWith("wiki/")) return "wiki";
  return "other";
}

function formatWikiScore(value: number | null | undefined) {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return "-";
  }
  return Number(value).toFixed(3);
}

const WIKI_QUERY_KIND_LABEL: Record<string, string> = {
  wiki: "Wiki",
  "wiki-decision": "Wiki · Decision",
  "wiki-architecture": "Wiki · Architecture",
  "wiki-answer": "Wiki · Answer",
  "wiki-operation": "Wiki · Operation",
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

function runnerHealthNeedsAttention(value: string) {
  return ["blocked", "error", "fail", "failed", "missing", "stale_pid", "warning"].includes(value);
}

function runnerHasLiveProcess(runner: AutoflowRunner) {
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  return stateStatus === "running" || Boolean(runner.pid);
}

function runnerBlockedNeedsAttention(runner: AutoflowRunner) {
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  const activeStage = (runner.activeStage || "").toLowerCase();
  if (stateStatus === "blocked" || stateStatus === "failed") return true;
  if (activeStage !== "blocked") return false;
  return !runnerHasLiveProcess(runner);
}

function runnersNeedingAttention(runners: AutoflowRunner[]) {
  return runners.filter((runner) => {
    if ((runner.enabled || "").toLowerCase() === "false") return false;
    const stateStatus = (runner.stateStatus || "").toLowerCase();
    const lastResult = (runner.lastResult || "").toLowerCase();
    return (
      runnerHealthNeedsAttention(stateStatus) ||
      runnerBlockedNeedsAttention(runner) ||
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
        runner.lastResult
      ].join(":")
    )
    .join("|");
}

function runnerHealthToastMessage(unhealthy: AutoflowRunner[], allRunners: AutoflowRunner[]) {
  // Single-flow design: verifier replan happens in-place on the PRD ticket,
  // so raw last_result is noise here. We only surface the runner display name
  // and its top-level stateStatus (running / idle / blocked / failed) —
  // actionable retry context lives in the active ticket itself.
  const preview = unhealthy.slice(0, 3).map((runner) => {
    const display = displayAiAgentRunnerLabel(runner.id, allRunners);
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
  const [installProgressLabel, setInstallProgressLabel] = React.useState(initialInstallProgressLabel);
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
  const [wikiDbSelectedTable, setWikiDbSelectedTable] = React.useState("wiki");
  const [wikiDbResult, setWikiDbResult] = React.useState<AutoflowWikiDatabaseResult | null>(null);
  const [wikiDbLoading, setWikiDbLoading] = React.useState(false);
  const [wikiDbError, setWikiDbError] = React.useState("");
  const [globalToast, setGlobalToast] = React.useState<{
    severity: "error" | "warning" | "info" | "success";
    message: string;
  } | null>(null);
  const wikiQueryInvocationIdRef = React.useRef<string>("");
  const installInvocationIdRef = React.useRef<string>("");
  const [lastUpdated, setLastUpdated] = React.useState("");
  const [projectTabs, setProjectTabs] = React.useState(() => readProjectTabs(projectRoot));
  const [isRefreshingProjectTabs, setIsRefreshingProjectTabs] = React.useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = React.useState<SettingsSection>(() => {
    const stored = initialSetting("autoflow.activeSettingsSection", "progress");
    if (stored === "general" || stored === "automation" || stored === "watcher" || stored === "chat") {
      return "progress";
    }
    return settingsNavigation.some((item) => item.key === stored) ? (stored as SettingsSection) : "progress";
  });
  const previousSettingsSectionRef = React.useRef<SettingsSection>(activeSettingsSection);
  const authToastKeyRef = React.useRef("");
  const runnerHealthToastKeyRef = React.useRef("");

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder.trim() || fallbackFlowFolder }),
    [defaultFlowFolder, projectRoot]
  );
  const autoRefreshInFlightRef = React.useRef(false);
  const boardScopeKeyRef = React.useRef(buildBoardScopeKey(options));

  React.useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("autoflow.theme", themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    if (!globalToast) return;
    const timeout = window.setTimeout(() => setGlobalToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [globalToast]);

  React.useEffect(() => {
    return window.autoflow.onInstallProgress((payload) => {
      const activeInvocationId = installInvocationIdRef.current;
      if (!activeInvocationId || payload.invocationId !== activeInvocationId || !payload.label) {
        return;
      }
      setInstallProgressLabel(payload.label);
    });
  }, []);

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
    pushToast(
      "warning",
      runnerCanContinueAuth(authRunner)
        ? `${runnerLoginMessage(authRunner)} 러너 카드에서 Y 계속을 선택하세요.`
        : runnerLoginMessage(authRunner)
    );
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
    setActiveSettingsSection(section);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    Promise.all([window.autoflow.getConfig(), window.autoflow.listInstalledAgentProfiles()])
      .then(([config, profiles]) => {
        const configuredBoardDirName = config.defaultBoardDirName || fallbackFlowFolder;
        const blockedProjectRoots = Array.isArray(config.blockedProjectRoots) ? config.blockedProjectRoots : [];
        const configuredProjectRootRaw = (config as AutoflowAppConfig & { defaultProjectRoot?: string }).defaultProjectRoot || "";
        const configuredProjectRoot = isBlockedProjectRoot(configuredProjectRootRaw, blockedProjectRoots)
          ? ""
          : configuredProjectRootRaw;
        if (isMounted && !window.localStorage.getItem("autoflow.boardDirName")) {
          setDefaultFlowFolder(configuredBoardDirName);
        }
        if (isMounted && isBlockedProjectRoot(window.localStorage.getItem("autoflow.projectRoot") || "", blockedProjectRoots)) {
          window.localStorage.removeItem("autoflow.projectRoot");
          setProjectRoot("");
          setProjectTabs((current) => {
            const next = filterBlockedProjectRoots(current, blockedProjectRoots);
            persistProjectTabs(next);
            return next;
          });
        }
        if (isMounted && !window.localStorage.getItem("autoflow.projectRoot") && configuredProjectRoot) {
          setProjectRoot(configuredProjectRoot);
          setProjectTabs((current) => {
            const next = normalizeProjectList(current.includes(configuredProjectRoot) ? current : [...current, configuredProjectRoot]);
            persistProjectTabs(next);
            return next;
          });
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

      const targetScopeKey = buildBoardScopeKey(targetOptions);
      const scopeMatches = () => boardScopeKeyRef.current === targetScopeKey;

      if (!targetOptions.projectRoot) {
        if (!scopeMatches()) return null;
        setBoard(null);
        setLastUpdated("");
        setIsBoardLoading(false);
        setIsPageRefreshing(false);
        setSetupError("");
        setRunnerError("");
        setWikiError("");
        return null;
      }

      setIsPageRefreshing(true);
      try {
        const snapshot = await window.autoflow.readBoard(targetOptions);
        if (!scopeMatches()) return null;
        setBoard(snapshot);
        setSetupError("");
        setLastUpdated(new Date().toISOString());
        return snapshot;
      } catch (error) {
        if (!scopeMatches()) return null;
        setBoard(null);
        setSetupError(error instanceof Error ? error.message : "Autoflow 상태를 확인하지 못했습니다.");
        return null;
      } finally {
        if (scopeMatches()) {
          setIsBoardLoading(false);
          setIsPageRefreshing(false);
        }
      }
    },
    [options]
  );

  React.useEffect(() => {
    boardScopeKeyRef.current = buildBoardScopeKey(options);
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
          void error;
        }
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const scheduleRefresh = () => {
      if (cancelled) return;
      // Coalesce a burst of board change events from main.ts. The main
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

    // Event-driven refresh: main process pushes here when @parcel/watcher sees
    // a relevant change inside .autoflow/{tickets,runners/state}.
    const offBoardChange = window.autoflow.onBoardChange(() => {
      scheduleRefresh();
    });

    // Safety-net polling catches permission errors, native watcher failures, or
    // other rare delivery gaps. 30s is rare enough to be cheap.
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

  const resetWikiQuery = React.useCallback(() => {
    if (wikiQueryRunning) {
      cancelWikiQuery();
    }
    wikiQueryInvocationIdRef.current = "";
    setWikiQueryInput("");
    setWikiQueryResult(null);
    setWikiError("");
    setWikiQueryRunning(false);
  }, [cancelWikiQuery, wikiQueryRunning]);

  React.useEffect(() => {
    setWikiDbResult(null);
    setWikiDbError("");
    setWikiDbSelectedTable("wiki");
  }, [options.boardDirName, options.projectRoot]);

  const loadWikiDatabase = React.useCallback(
    async (table = wikiDbSelectedTable) => {
      if (!options.projectRoot || wikiDbLoading) return;
      setWikiDbLoading(true);
      setWikiDbError("");
      try {
        const result = await window.autoflow.browseWikiDatabase({
          ...options,
          table,
          limit: 40
        });
        if (!result.ok) {
          setWikiDbResult(result);
          setWikiDbError(result.stderr || "위키를 읽지 못했습니다.");
          return;
        }
        setWikiDbResult(result);
        setWikiDbSelectedTable(result.selectedTable || table);
      } catch (error) {
        setWikiDbError(error instanceof Error ? error.message : "위키를 읽지 못했습니다.");
      } finally {
        setWikiDbLoading(false);
      }
    },
    [options, wikiDbLoading, wikiDbSelectedTable]
  );

  const selectWikiDatabaseTable = React.useCallback(
    (table: string) => {
      if (!table || table === wikiDbSelectedTable) return;
      setWikiDbSelectedTable(table);
      void loadWikiDatabase(table);
    },
    [loadWikiDatabase, wikiDbSelectedTable]
  );

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
    setRunnerSavedDrafts((current) => {
      const next: Record<string, RunnerDraft> = {};
      let changed = false;
      for (const runner of runners) {
        const runnerDraft = runnerDraftFromRunner(runner);
        const currentSaved = current[runner.id];
        const currentDraft = runnerDrafts[runner.id];
        const hasLocalUnsavedEdit =
          Boolean(currentSaved && currentDraft && !runnerDraftsEqual(currentDraft, currentSaved)) &&
          !runnerDraftsEqual(currentDraft, runnerDraft);
        next[runner.id] = hasLocalUnsavedEdit && currentSaved ? currentSaved : runnerDraft;
        if (!runnerDraftsEqual(next[runner.id], current[runner.id])) {
          changed = true;
        }
      }
      if (Object.keys(current).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : current;
    });
    setRunnerDrafts((previous) => {
      const next: Record<string, RunnerDraft> = {};
      for (const runner of runners) {
        const runnerDraft = runnerDraftFromRunner(runner);
        const previousDraft = previous[runner.id];
        const savedDraft = runnerSavedDrafts[runner.id];
        const previousHasUnsavedEdits = Boolean(previousDraft && savedDraft && !runnerDraftsEqual(previousDraft, savedDraft));
        const isThisRunnerWorking = Boolean(runnerActionKeys[runner.id]);
        const baseDraft = previousDraft && (isThisRunnerWorking || previousHasUnsavedEdits) ? previousDraft : runnerDraft;
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
  }, [board?.runners, installedAgentProfiles, runnerActionKeys, runnerSavedDrafts]);

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

  // Checks tab removed; runtime state now comes from runner assignment evidence.

  const refreshProjectTabs = React.useCallback(async () => {
    setIsRefreshingProjectTabs(true);
    try {
      const next = await filterExistingRecentProjects(projectTabs);
      if (next.length === projectTabs.length) {
        return;
      }

      persistProjectTabs(next);
      setProjectTabs(next);
      if (options.projectRoot && !next.includes(options.projectRoot)) {
        const fallbackProject = next[0] || "";
        if (fallbackProject !== options.projectRoot) {
          setIsBoardLoading(Boolean(fallbackProject));
          setProjectRoot(fallbackProject);
        }
      }
      if (next.length < projectTabs.length) {
        pushToast("warning", "삭제된 프로젝트 경로를 탭에서 제거했습니다.");
      }
    } finally {
      setIsRefreshingProjectTabs(false);
    }
  }, [options.projectRoot, projectTabs, pushToast]);

  React.useEffect(() => {
    void refreshProjectTabs();
  }, [refreshProjectTabs]);

  const chooseProjectRoot = React.useCallback(async (selected: string) => {
    const normalized = selected.trim();
    if (!normalized) {
      return;
    }

    const exists = await window.autoflow.projectExists(normalized);
    if (!readProjectExistsResult(exists)) {
      setProjectTabs((current) => {
        const next = normalizeProjectList(current.filter((project) => project !== normalized));
        persistProjectTabs(next);
        if (normalized === options.projectRoot) {
          const fallbackProject = next[0] || "";
          setIsBoardLoading(Boolean(fallbackProject));
          setProjectRoot(fallbackProject);
        }
        return next;
      });
      pushToast("warning", `${projectExistsPathLabel(normalized)} 목록에서 제거했습니다.`);
      return;
    }

    if (normalized !== options.projectRoot) {
      setIsBoardLoading(true);
    }
    setProjectRoot(normalized);
    setProjectTabs((current) => {
      const next = normalizeProjectList(current.includes(normalized) ? current : [...current, normalized]);
      persistProjectTabs(next);
      return next;
    });
  }, [options.projectRoot, pushToast]);

  const addProjectFolder = React.useCallback(async () => {
    const selected = await window.autoflow.selectProject();
    if (selected) {
      chooseProjectRoot(selected);
    }
  }, [chooseProjectRoot]);

  const closeProjectTab = React.useCallback(
    async (projectToClose: string) => {
      const normalized = projectToClose.trim();
      if (!normalized) {
        return;
      }

      setIsRefreshingProjectTabs(true);
      try {
        const closeResult = await window.autoflow.closeProjectRunners({
          projectRoot: normalized,
          boardDirName: options.boardDirName
        });
        if (!closeResult.ok) {
          pushToast("error", closeResult.stderr || `${basename(normalized)} 폴더의 러너 종료에 실패했습니다.`);
          return;
        }

        setProjectTabs((current) => {
          const closedIndex = current.findIndex((project) => project === normalized);
          const next = normalizeProjectList(current.filter((project) => project !== normalized));
          persistProjectTabs(next);

          if (normalized === options.projectRoot) {
            const fallbackProject = next[closedIndex] || next[closedIndex - 1] || next[0] || "";
            setIsBoardLoading(Boolean(fallbackProject));
            setProjectRoot(fallbackProject);
          }

          return next;
        });

        if (closeResult.stoppedCount > 0) {
          pushToast("success", `${basename(normalized)} 폴더의 실행 중인 러너 ${closeResult.stoppedCount}개를 종료했습니다.`);
        }
      } catch (error) {
        pushToast(
          "error",
          error instanceof Error ? error.message : `${basename(normalized)} 폴더의 러너 종료에 실패했습니다.`
        );
      } finally {
        setIsRefreshingProjectTabs(false);
      }
    },
    [options.boardDirName, options.projectRoot, pushToast]
  );

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
      const invocationId = createRendererInvocationId("install");
      installInvocationIdRef.current = invocationId;
      chooseProjectRoot(root);
      setIsInstalling(true);
      setInstallProgressLabel("설치 위치를 확인하고 있습니다.");
      setSetupError("");
      try {
        const result = await window.autoflow.installBoard({ ...targetOptions, invocationId });
        if (!result.ok) {
          setSetupError(result.stderr || "설치에 실패했습니다.");
          return;
        }

        setInstallProgressLabel("설치가 완료되었습니다. 보드 상태를 불러오는 중입니다.");
        await loadBoard(targetOptions);
      } finally {
        setIsInstalling(false);
        installInvocationIdRef.current = "";
        setInstallProgressLabel(initialInstallProgressLabel);
      }
    },
    [chooseProjectRoot, defaultFlowFolder, isInstalling, loadBoard, options.projectRoot]
  );

  const controlRunner = React.useCallback(
    async (action: RunnerControlAction, runnerId: string, controlOptions: RunnerControlOptions = {}) => {
      const existingAction = runnerActionKeys[runnerId] || "";
      const forceStop = action === "stop" && Boolean(controlOptions.force);
      if (!options.projectRoot || isBoardLoading || (existingAction && !forceStop)) {
        return;
      }

      const runner = (board?.runners || []).find((candidate) => candidate.id === runnerId);
      if (!runner) {
        return;
      }
      beginRunnerTransition(runner, action, forceStop);
      setRunnerError("");
      try {
        if (runner && (action === "start" || action === "restart")) {
          const currentRunnerDraft = runnerDraftFromRunner(runner);
          const draft = runnerDrafts[runner.id] || currentRunnerDraft;
          const savedDraft = runnerSavedDrafts[runner.id] || currentRunnerDraft;
          const normalized = normalizeRunnerSelections(draft.agent, draft.model, draft.reasoning, installedAgentProfiles);
          const normalizedDraft = {
            ...draft,
            model: normalized.model,
            reasoning: normalized.reasoning
          };
          const hasUnsavedConfigEdit = !runnerDraftsEqual(normalizedDraft, savedDraft);
          const needsLoopNormalization =
            (runner.mode || "") !== "" ||
            (runner.intervalSeconds || "") !== "" ||
            (runner.enabled || "true") !== "true" ||
            hasUnsavedConfigEdit;

          if (needsLoopNormalization) {
            const config: AutoflowRunnerConfigUpdate = {
              enabled: "true"
            };
            if (hasUnsavedConfigEdit) {
              config.agent = draft.agent;
              config.model = normalized.model;
              config.reasoning = normalized.reasoning;
              config.command = draft.command;
            }
            const configResult = await window.autoflow.configureRunner({
              runnerId,
              ...options,
              config
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
          pushToast("success", `${displayAiAgentRunnerLabel(runnerId, refreshed?.runners)} runner에 재연결했습니다.`);
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
      isBoardLoading,
      loadBoard,
      options,
      pushToast,
      runnerActionKeys,
      runnerDrafts,
      runnerSavedDrafts,
      setRunnerAction
    ]
  );

  const answerRunnerAuthPrompt = React.useCallback(
    async (choice: RunnerAuthChoice, runner: AutoflowRunner) => {
      if (!options.projectRoot || isBoardLoading || runnerActionKeys[runner.id]) {
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
        const runnerLabel = displayAiAgentRunnerLabel(runner.id, board?.runners);
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
    [board?.runners, controlRunner, isBoardLoading, loadBoard, options, pushToast, runnerActionKeys, setRunnerAction]
  );

  const readLog = React.useCallback(
    async (filePath: string) => {
      if (!options.projectRoot || isBoardLoading || !filePath) {
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
    [isBoardLoading, options]
  );

  const runRunner = React.useCallback(
    async (runner: AutoflowRunner, dryRun = false) => {
      if (!options.projectRoot || isBoardLoading || runnerActionKeys[runner.id]) {
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
    [isBoardLoading, loadBoard, options, readLog, runnerActionKeys, selectRunner, setRunnerAction]
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
      if (!options.projectRoot || isBoardLoading || runnerActionKeys[runner.id]) {
        return;
      }

      const draft = runnerDrafts[runner.id] || {
        agent: runner.agent || "codex",
        model: runner.model || "",
        reasoning: runner.reasoning || "",
        mode: runner.mode || runnerDefaultMode(runner),
        intervalSeconds: runner.intervalSeconds || runnerDefaultIntervalSeconds(runner),
        enabled: runner.enabled || "true",
        command: runner.command || ""
      };
      const normalized = normalizeRunnerSelections(draft.agent, draft.model, draft.reasoning, installedAgentProfiles);
      const previousRunnerSnapshot = { ...runner };
      const previousSavedDraft = runnerSavedDrafts[runner.id];
      const scheduledLoop = runnerUsesScheduledLoop(runner);
      const savedDraft: RunnerDraft = {
        agent: draft.agent,
        model: normalized.model,
        reasoning: normalized.reasoning,
        mode: scheduledLoop ? "loop" : "",
        intervalSeconds: scheduledLoop ? "60" : "",
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
            mode: previousRunnerSnapshot.mode || runnerDefaultMode(previousRunnerSnapshot),
            intervalSeconds: previousRunnerSnapshot.intervalSeconds || runnerDefaultIntervalSeconds(previousRunnerSnapshot),
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
        const config: AutoflowRunnerConfigUpdate = {
          agent: draft.agent,
          model: normalized.model,
          reasoning: normalized.reasoning,
          enabled: "true",
          command: draft.command
        };
        const result = await window.autoflow.configureRunner({
          runnerId: runner.id,
          ...options,
          config
        });
        if (!result.ok) {
          rollbackOptimistic();
          setRunnerError(result.stderr || result.stdout || "AI 설정 저장에 실패했습니다.");
          setRunnerAction(runner.id, "");
          return;
        }

        await loadBoard();

        if (!restartAfterSave) {
          // 새 model/agent 는 다음 runner tick (interval 안) 에 자연스럽게 적용된다.
          // 저장 직후에는 실제 config.local.toml 기준으로 다시 읽어 낙관 UI와
          // 파일 상태가 갈라지지 않게 한다.
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
    [installedAgentProfiles, isBoardLoading, loadBoard, options, runnerActionKeys, runnerDrafts, runnerSavedDrafts, selectRunner, setRunnerAction]
  );

  const boardInitialized = board?.status?.initialized === "true";
  const boardMissing = Boolean(options.projectRoot && board && !boardInitialized);
  const runnerCount = (board?.runners || []).filter(
    (runner) => (runner.role || "").toLowerCase() !== "self-improve"
  ).length;
  const runnersUnconfigured = Boolean(options.projectRoot && boardInitialized && runnerCount === 0);
  const setupRequired = boardMissing || runnersUnconfigured;
  const showInstallButton = Boolean(options.projectRoot && (isInstalling || setupRequired));
  const ticketTotal = countTickets(board);
  const visibleSettingsSection = setupRequired ? "progress" : activeSettingsSection;
  const selectedSettingsItem =
    settingsNavigation.find((item) => item.key === visibleSettingsSection) || settingsNavigation[0];
  const isProjectSwitching = Boolean(options.projectRoot && isBoardLoading && !isInstalling);
  const showGlobalLoading = isInstalling || isProjectSwitching;
  const globalLoadingLabel = isInstalling
    ? installProgressLabel
    : isProjectSwitching
    ? "프로젝트 폴더를 전환 중입니다."
    : "잠시만 기다려 주세요";

  React.useEffect(() => {
    if (setupRequired || visibleSettingsSection !== "knowledge" || !options.projectRoot) return;
    if (wikiDbResult?.dbPath) return;
    void loadWikiDatabase(wikiDbSelectedTable);
  }, [
    loadWikiDatabase,
    options.projectRoot,
    setupRequired,
    visibleSettingsSection,
    wikiDbResult?.dbPath,
    wikiDbSelectedTable
  ]);

  return (
    <div className="viewer-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <main className="workspace-layout">
        <section className="settings-page" aria-label="Autoflow">
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
                <div className="toolbar-project-controls">
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
                </div>
              </div>
            </aside>

          <section
            className="settings-content settings-content-progress"
            aria-label={`${selectedSettingsItem.label} 화면`}
          >
            <div className="settings-content-header">
              <Tabs
                value={options.projectRoot || "__empty__"}
                onValueChange={(value) => {
                  if (value !== "__empty__") void chooseProjectRoot(value);
                }}
                className="project-tabs-titlebar"
              >
                {projectTabs.length ? (
                  <TabsList className="project-tabs-list" aria-label="추가된 프로젝트 폴더">
                    {projectTabs.map((project) => (
                      <div key={project} className="project-tab-shell" role="presentation">
                        <TabsTrigger
                          value={project}
                          className="project-tab-trigger"
                          title={project}
                          disabled={isRefreshingProjectTabs}
                        >
                          <FolderOpen className="h-4 w-4" aria-hidden="true" />
                          <span>{basename(project)}</span>
                        </TabsTrigger>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="project-tab-close"
                          title={`${basename(project)} 닫기`}
                          aria-label={`${basename(project)} 탭 닫기`}
                          disabled={isRefreshingProjectTabs}
                          onClick={(event) => {
                            event.stopPropagation();
                            closeProjectTab(project);
                          }}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </TabsList>
                ) : (
                  <span className="project-tabs-empty">추가된 폴더 없음</span>
                )}
              </Tabs>
              <div className="project-tabs-titlebar-actions">
                <Button
                  variant="outline"
                  size="icon"
                  className="titlebar-folder-add-button"
                  title="프로젝트 폴더 추가"
                  aria-label="프로젝트 폴더 추가"
                  disabled={isRefreshingProjectTabs}
                  onClick={addProjectFolder}
                >
                  {isRefreshingProjectTabs ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                </Button>
              </div>
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
                      onActionToast={pushToast}
                      onRequestRefresh={() => {
                        void loadBoard();
                      }}
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
                <section className="dashboard-area" aria-label="LLM위키">
                  <section className="board-section board-section-flush" aria-label="LLM위키 본문">
                    <PageLayout className="knowledge-page">
                      <div className="knowledge-db-body">
                        {/* WikiPanel 내부에서 wikiTreeChanged 이벤트를 구독해 트리와 본문을 reload 한다. */}
                        <WikiPanel projectRoot={options.projectRoot} boardDirName={options.boardDirName} />
                        <WikiDatabasePanel
                          result={wikiDbResult}
                          isLoading={wikiDbLoading}
                          error={wikiDbError}
                          selectedTable={wikiDbSelectedTable}
                          onSelectTable={selectWikiDatabaseTable}
                          onRefresh={() => void loadWikiDatabase(wikiDbSelectedTable)}
                        />
                      </div>
                    </PageLayout>
                  </section>
                </section>
              )}

            {!setupRequired && visibleSettingsSection === "snapshot" && (
              <section className="dashboard-area" aria-label="통계">
                <section className="board-section board-section-flush" aria-label="통계 본문">
                  <PageLayout className="snapshot-page">
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
        <div className="project-required-overlay" role="dialog" aria-modal="true" aria-label="프로젝트 폴더 추가">
          <div className="project-required-card">
            <p className="project-required-description">
              Autoflow를 사용할 프로젝트 폴더를 추가해 주세요.
            </p>
            <Button
              type="button"
              className="project-required-button"
              onClick={addProjectFolder}
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              <span>폴더 추가</span>
            </Button>
            {projectTabs.length > 0 ? (
              <div className="project-required-recent" aria-label="추가된 프로젝트">
                <div className="project-required-recent-label">추가된 폴더</div>
                <div className="project-required-recent-list">
                  {projectTabs.slice(0, 5).map((project) => (
                    <Button
                      key={project}
                      type="button"
                      variant="ghost"
                      className="project-required-recent-item"
                      title={isRefreshingProjectTabs ? "프로젝트 경로를 확인 중입니다." : project}
                      disabled={isRefreshingProjectTabs}
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
      <FullPageLoading open={showGlobalLoading} label={globalLoadingLabel} />
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
  const [installProgressLabel, setInstallProgressLabel] = React.useState(initialInstallProgressLabel);
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
  const installInvocationIdRef = React.useRef<string>("");
  const autoRefreshInFlightRef = React.useRef(false);

  const options = React.useMemo(
    () => ({ projectRoot: projectRoot.trim(), boardDirName: defaultFlowFolder.trim() || fallbackFlowFolder }),
    [defaultFlowFolder, projectRoot]
  );

  React.useEffect(() => {
    return window.autoflow.onInstallProgress((payload) => {
      const activeInvocationId = installInvocationIdRef.current;
      if (!activeInvocationId || payload.invocationId !== activeInvocationId || !payload.label) {
        return;
      }
      setInstallProgressLabel(payload.label);
    });
  }, []);

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
        const blockedProjectRoots = Array.isArray(config.blockedProjectRoots) ? config.blockedProjectRoots : [];
        const configuredProjectRootRaw = (config as AutoflowAppConfig & { defaultProjectRoot?: string }).defaultProjectRoot || "";
        const configuredProjectRoot = isBlockedProjectRoot(configuredProjectRootRaw, blockedProjectRoots)
          ? ""
          : configuredProjectRootRaw;
        if (isMounted && !window.localStorage.getItem("autoflow.boardDirName")) {
          setDefaultFlowFolder(configuredBoardDirName);
        }
        if (isMounted && isBlockedProjectRoot(window.localStorage.getItem("autoflow.projectRoot") || "", blockedProjectRoots)) {
          window.localStorage.removeItem("autoflow.projectRoot");
          setProjectRoot("");
          setRecentProjects((current) => {
            const next = filterBlockedProjectRoots(current, blockedProjectRoots);
            persistRecentProjects(next);
            return next;
          });
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
          void error;
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
      const invocationId = createRendererInvocationId("install");
      installInvocationIdRef.current = invocationId;
      chooseProjectRoot(root);
      setIsInstalling(true);
      setInstallProgressLabel("설치 위치를 확인하고 있습니다.");
      setSetupError("");
      try {
        const result = await window.autoflow.installBoard({ ...targetOptions, invocationId });
        if (!result.ok) {
          setSetupError(result.stderr || "설치에 실패했습니다.");
          return;
        }

        setInstallProgressLabel("설치가 완료되었습니다. 보드 상태를 불러오는 중입니다.");
        await loadBoard(targetOptions);
      } finally {
        setIsInstalling(false);
        installInvocationIdRef.current = "";
        setInstallProgressLabel(initialInstallProgressLabel);
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
  const scheduledLoop = runnerUsesScheduledLoop(runner);
  const expectedMode = scheduledLoop ? "loop" : "";
  const expectedIntervalSeconds = scheduledLoop ? "60" : "";
  const baseline = savedDraft || {
    agent: runner.agent || "codex",
    model: runner.model || "",
    reasoning: runner.reasoning || "",
    mode: runner.mode || expectedMode,
    intervalSeconds: runner.intervalSeconds || expectedIntervalSeconds,
    enabled: runner.enabled || "true",
    command: runner.command || ""
  };
  const hasDraftChanges =
    draft.agent !== baseline.agent ||
    normalized.model !== baseline.model ||
    normalized.reasoning !== baseline.reasoning ||
    baseline.mode !== expectedMode ||
    baseline.intervalSeconds !== expectedIntervalSeconds ||
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
  onReadLog: (filePath: string) => void;
  onDraftChange: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure: (runner: AutoflowRunner, restartAfterSave?: boolean) => void;
}) {
  const runners = (board?.runners || []).filter(
    (runner) =>
      runner.role === "worker" ||
      runner.role === "planner" ||
      runner.role === "plan" ||
      runner.role === "wiki-maintainer" ||
      runner.role === "wiki" ||
      runner.role === "verifier" ||
      (isCoordinatorRole(runner.role) && runnerIsEnabled(runner.enabled))
  );
  const runningCount = runners.filter((runner) => runner.stateStatus === "running" || Boolean(runner.pid)).length;
  const stoppedCount = runners.filter((runner) => (runner.stateStatus || "") === "stopped").length;
  const blockedCount = runners.filter(runnerBlockedNeedsAttention).length;

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
            <span className="ticket-workspace-tab-copy">Planner / Worker / Verifier / Wiki</span>
          </div>
        }
      >
        <div className="runner-section runner-console-body">
          {error ? <div className="runner-error">{error}</div> : null}

          <div className="runner-grid">
            {runners.length ? (
              runners.map((runner) => {
            const status = runner.stateStatus || "idle";
            const scheduledLoop = runnerUsesScheduledLoop(runner);
            const intervalLabel = scheduledLoop ? (runner.intervalSeconds || runner.intervalEffectiveSeconds || "60") : "";
            const runnerCadenceLabel = scheduledLoop ? `반복 실행 / ${intervalLabel}s` : "수동 실행";
            const transitionLabel = runnerTransitionLabel(actionKey);
            const canEditConfig = status !== "running";
            const draft = drafts[runner.id] || runnerDraftFromRunner(runner);
            const runnerEventRaw = runner.activeItem || runner.lastResult || "";
            const runnerEventValue = runner.activeItem
              ? displayActiveItemLabel(runner.activeItem)
              : runner.lastResult
                ? displayStatus(runner.lastResult)
                : "이벤트 없음";
            const runnerEvent = isMachineRunnerLog(runnerEventRaw) ? "이벤트 없음" : runnerEventValue;
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
                      {runner.agent || "에이전트"} {runner.model ? `- ${runner.model}` : ""} - {runnerCadenceLabel}
                    </span>
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
                  플래너(planner) / 워커(worker) / 검증(verifier) / 위키(wiki-maintainer) 러너가 추가되면 여기에 표시됩니다.
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

function runnerCanContinueAuth(runner: AutoflowRunner) {
  return false;
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

function ReportMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  className = "",
  title,
  children
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={`report-metric-card ${tone} ${className}`.trim()} aria-label={title || `${label}: ${value}, ${detail}`}>
      <CardContent className="report-metric-card-content">
        <div className="report-metric-icon">
          <Icon className="h-4 w-4" />
        </div>
        <div className="report-metric-copy">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
        <em className="report-metric-detail">{detail}</em>
        {children ? <div className="report-metric-card-children">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

type ReportChartPalette = {
  text: string;
  muted: string;
  grid: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
};

function readReportChartPalette(canvas: HTMLCanvasElement): ReportChartPalette {
  const styles = getComputedStyle(canvas);
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    text: color("--foreground", "#d1d3d9"),
    muted: color("--muted-foreground", "#8b8e94"),
    grid: color("--border", "#33353b"),
    chart1: color("--chart-1", "#71a1fe"),
    chart2: color("--chart-2", "#6db083"),
    chart3: color("--chart-3", "#ecbc7b"),
    chart4: color("--chart-4", "#f57e84"),
    chart5: color("--chart-5", "#538af9")
  };
}

function reportChartColors(palette: ReportChartPalette) {
  return [palette.chart1, palette.chart2, palette.chart3, palette.chart4, palette.chart5, palette.muted];
}

function truncateChartLabel(label: string, maxLength = 22) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label;
}

function formatHourChartLabel(hour: number, includeDate = false) {
  const date = new Date(hour * 1000);
  const hourLabel = `${String(date.getHours()).padStart(2, "0")}시`;
  if (!includeDate) {
    return hourLabel;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${hourLabel}`;
}

function ReportHorizontalBarChart({
  title,
  items,
  unit = "토큰"
}: {
  title: string;
  items: ReportBreakdownItem[];
  unit?: string;
}) {
  const itemsSignature = items.map((item) => `${item.label}:${item.value}`).join("|");
  const chartItems = React.useMemo(() => items.filter((item) => item.value > 0), [itemsSignature]);
  const chartSignature = chartItems.map((item) => `${item.label}:${item.value}`).join("|");
  const total = chartItems.reduce((sum, item) => sum + item.value, 0);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const chartHeight = Math.max(190, Math.min(360, chartItems.length * 44 + 76));

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chartItems.length || total <= 0) {
      return undefined;
    }

    const palette = readReportChartPalette(canvas);
    const labels = chartItems.map((item) => item.label);
    const values = chartItems.map((item) => item.value);
    const maxValue = Math.max(...values, 1);
    const config: ChartConfiguration<"bar", number[], string> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
            backgroundColor: palette.chart1,
            borderColor: palette.chart1,
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: 18
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: { right: 8 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = Number(context.parsed.x || context.raw || 0);
                const ratio = total > 0 ? ` · ${((value / total) * 100).toFixed(1)}%` : "";
                return `${formatCount(value)}${unit ? ` ${unit}` : ""}${ratio}`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: maxValue * 1.08,
            border: { display: false },
            grid: { color: palette.grid },
            ticks: {
              color: palette.muted,
              callback: (value) => formatCompactCount(Number(value))
            }
          },
          y: {
            border: { display: false },
            grid: { display: false },
            ticks: {
              color: palette.text,
              callback: (value) => truncateChartLabel(labels[Number(value)] || String(value))
            }
          }
        }
      }
    };
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [chartSignature, title, total, unit]);

  if (!chartItems.length || total <= 0) {
    return <div className="report-fallback">{`${title}: 데이터 없음`}</div>;
  }

  return (
    <div className="report-chart-shell" aria-label={title}>
      <div className="report-chart-title">{title}</div>
      <div className="report-chart-canvas-wrap" style={{ height: chartHeight }}>
        <canvas ref={canvasRef} role="img" aria-label={`${title} 차트`} />
      </div>
      <div className="report-chart-summary" aria-label={`${title} 상위 항목`}>
        {chartItems.slice(0, 4).map((item) => {
          const ratio = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <span key={item.label}>
              <strong>{item.label}</strong>
              <em>{formatCount(item.value)}{unit ? ` ${unit}` : ""} · {ratio.toFixed(1)}%</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ReportDoughnutChart({
  title,
  items,
  unit = "개"
}: {
  title: string;
  items: ReportBreakdownItem[];
  unit?: string;
}) {
  const itemsSignature = items.map((item) => `${item.label}:${item.value}`).join("|");
  const chartItems = React.useMemo(() => items.filter((item) => item.value > 0), [itemsSignature]);
  const chartSignature = chartItems.map((item) => `${item.label}:${item.value}`).join("|");
  const total = chartItems.reduce((sum, item) => sum + item.value, 0);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chartItems.length || total <= 0) {
      return undefined;
    }

    const palette = readReportChartPalette(canvas);
    const labels = chartItems.map((item) => item.label);
    const config: ChartConfiguration<"doughnut", number[], string> = {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: chartItems.map((item) => item.value),
            backgroundColor: reportChartColors(palette),
            borderColor: palette.grid,
            borderWidth: 1,
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: palette.muted,
              padding: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = Number(context.raw || 0);
                const ratio = total > 0 ? ` · ${((value / total) * 100).toFixed(1)}%` : "";
                return `${context.label}: ${formatCount(value)}${unit ? ` ${unit}` : ""}${ratio}`;
              }
            }
          }
        }
      }
    };
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [chartSignature, title, total, unit]);

  if (!chartItems.length || total <= 0) {
    return <div className="report-fallback">{`${title}: 데이터 없음`}</div>;
  }

  return (
    <div className="report-chart-shell" aria-label={title}>
      <div className="report-chart-title">{title}</div>
      <div className="report-chart-canvas-wrap report-chart-canvas-wrap-doughnut">
        <canvas ref={canvasRef} role="img" aria-label={`${title} 차트`} />
      </div>
      <div className="report-chart-summary" aria-label={`${title} 항목`}>
        {chartItems.slice(0, 4).map((item) => {
          const ratio = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <span key={item.label}>
              <strong>{item.label}</strong>
              <em>{formatCount(item.value)}{unit ? ` ${unit}` : ""} · {ratio.toFixed(1)}%</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ReportCodeImpactChart({
  title,
  insertions,
  deletions
}: {
  title: string;
  insertions: number;
  deletions: number;
}) {
  const chartItems = React.useMemo(
    () => [
      { label: "추가", value: Math.max(insertions, 0) },
      { label: "삭제", value: Math.max(deletions, 0) }
    ],
    [insertions, deletions]
  );
  const total = chartItems.reduce((sum, item) => sum + item.value, 0);
  const chartSignature = chartItems.map((item) => `${item.label}:${item.value}`).join("|");
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || total <= 0) {
      return undefined;
    }

    const palette = readReportChartPalette(canvas);
    const labels = chartItems.map((item) => item.label);
    const config: ChartConfiguration<"bar", number[], string> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "라인",
            data: chartItems.map((item) => item.value),
            backgroundColor: [palette.chart2, palette.chart4],
            borderColor: [palette.chart2, palette.chart4],
            borderRadius: 7,
            borderSkipped: false,
            maxBarThickness: 46
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${formatCount(Number(context.raw || 0))} 라인`
            }
          }
        },
        scales: {
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: palette.text }
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: palette.grid },
            ticks: {
              color: palette.muted,
              callback: (value) => formatCompactCount(Number(value))
            }
          }
        }
      }
    };
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [chartItems, chartSignature, title, total]);

  if (total <= 0) {
    return <div className="report-fallback">{`${title}: 데이터 없음`}</div>;
  }

  return (
    <div className="report-chart-shell" aria-label={title}>
      <div className="report-chart-title">{title}</div>
      <div className="report-chart-canvas-wrap report-chart-canvas-wrap-compact">
        <canvas ref={canvasRef} role="img" aria-label={`${title} 차트`} />
      </div>
    </div>
  );
}

function ReportHourlyTokenChart({
  title,
  data
}: {
  title: string;
  data: Array<{ hour: number; input: number; output: number; cache: number }>;
}) {
  const dataSignature = data.map((entry) => `${entry.hour}:${entry.input}:${entry.output}:${entry.cache}`).join("|");
  const currentHour = Math.floor(Date.now() / 3_600_000) * 3600;
  const chartData = React.useMemo(() => {
    const normalized = data
      .map((entry) => ({
        hour: Math.floor(safeNumber(entry?.hour) / 3600) * 3600,
        input: Math.max(safeNumber(entry?.input), 0),
        output: Math.max(safeNumber(entry?.output), 0),
        cache: Math.max(safeNumber(entry?.cache), 0)
      }))
      .filter((entry) => entry.hour > 0);
    const buckets = new Map(normalized.map((entry) => [entry.hour, entry]));
    const endHour = Math.max(currentHour, ...normalized.map((entry) => entry.hour));

    return Array.from({ length: 24 }, (_, index) => {
      const hour = endHour - (23 - index) * 3600;
      return buckets.get(hour) || { hour, input: 0, output: 0, cache: 0 };
    });
  }, [currentHour, dataSignature]);
  const chartSignature = chartData.map((entry) => `${entry.hour}:${entry.input}:${entry.output}:${entry.cache}`).join("|");
  const usageTotal = chartData.reduce((sum, entry) => sum + entry.input + entry.output, 0);
  const cacheTotal = chartData.reduce((sum, entry) => sum + entry.cache, 0);
  const usageCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const cacheCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = usageCanvasRef.current;
    if (!canvas || usageTotal <= 0) {
      return undefined;
    }

    const palette = readReportChartPalette(canvas);
    const labels = chartData.map((entry) => formatHourChartLabel(entry.hour));
    const fullLabels = chartData.map((entry) => formatHourChartLabel(entry.hour, true));
    const config: ChartConfiguration<"bar", number[], string> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "입력",
            data: chartData.map((entry) => entry.input),
            backgroundColor: palette.chart1,
            borderColor: palette.chart1,
            borderRadius: 4,
            stack: "tokens",
            maxBarThickness: 20
          },
          {
            label: "출력",
            data: chartData.map((entry) => entry.output),
            backgroundColor: palette.chart2,
            borderColor: palette.chart2,
            borderRadius: 4,
            stack: "tokens",
            maxBarThickness: 20
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: palette.muted,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              title: (contexts) => fullLabels[contexts[0]?.dataIndex || 0] || title,
              label: (context) => `${context.dataset.label}: ${formatCount(Number(context.raw || 0))} 토큰`,
              footer: (contexts) => {
                const index = contexts[0]?.dataIndex ?? 0;
                const entry = chartData[index];
                const sum = entry ? entry.input + entry.output : 0;
                return `합계 ${formatCount(sum)} 토큰`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            border: { display: false },
            grid: { display: false },
            ticks: {
              color: palette.muted,
              maxRotation: 0,
              callback: (_value, index) => (index % 4 === 0 || index === labels.length - 1 ? labels[index] : "")
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            border: { display: false },
            grid: { color: palette.grid },
            ticks: {
              color: palette.muted,
              callback: (value) => formatCompactCount(Number(value))
            }
          }
        }
      }
    };
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [chartSignature, title, usageTotal]);

  React.useEffect(() => {
    const canvas = cacheCanvasRef.current;
    if (!canvas || cacheTotal <= 0) {
      return undefined;
    }

    const palette = readReportChartPalette(canvas);
    const labels = chartData.map((entry) => formatHourChartLabel(entry.hour));
    const fullLabels = chartData.map((entry) => formatHourChartLabel(entry.hour, true));
    const cacheTitle = "최근 24시간 캐시 토큰 추세";
    const config: ChartConfiguration<"bar", number[], string> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "캐시",
            data: chartData.map((entry) => entry.cache),
            backgroundColor: palette.chart3,
            borderColor: palette.chart3,
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 20
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              boxHeight: 8,
              boxWidth: 8,
              color: palette.muted,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              title: (contexts) => fullLabels[contexts[0]?.dataIndex || 0] || cacheTitle,
              label: (context) => `캐시: ${formatCount(Number(context.raw || 0))} 토큰`
            }
          }
        },
        scales: {
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: {
              color: palette.muted,
              maxRotation: 0,
              callback: (_value, index) => (index % 4 === 0 || index === labels.length - 1 ? labels[index] : "")
            }
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: palette.grid },
            ticks: {
              color: palette.muted,
              callback: (value) => formatCompactCount(Number(value))
            }
          }
        }
      }
    };
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [cacheTotal, chartSignature]);

  if (usageTotal <= 0 && cacheTotal <= 0) {
    return <div className="report-fallback">{`${title}: 데이터 없음`}</div>;
  }

  return (
    <>
      {usageTotal > 0 ? (
        <div className="report-chart-shell" aria-label={title}>
          <div className="report-chart-title">{title}</div>
          <div className="report-chart-canvas-wrap report-chart-canvas-wrap-hourly">
            <canvas ref={usageCanvasRef} role="img" aria-label={`${title} 차트`} />
          </div>
        </div>
      ) : null}
      {cacheTotal > 0 ? (
        <div className="report-chart-shell" aria-label="최근 24시간 캐시 토큰 추세">
          <div className="report-chart-title">최근 24시간 캐시 토큰 추세</div>
          <div className="report-chart-canvas-wrap report-chart-canvas-wrap-hourly">
            <canvas ref={cacheCanvasRef} role="img" aria-label="최근 24시간 캐시 토큰 추세 차트" />
          </div>
        </div>
      ) : null}
    </>
  );
}

function WorkflowStatStrip({ board }: { board: AutoflowBoardSnapshot | null }) {
  const {
    codeFilesChangedCount,
    codeInsertionsCount,
    codeDeletionsCount,
    codeVolumeCount,
    tokenUsageCount,
    tokenReportCount,
    tokenCacheReadCount
  } = getWorkflowMetricCounts(board);
  const hasTokenData = tokenUsageCount > 0 || tokenReportCount > 0 || tokenCacheReadCount > 0;

  return (
    <div className="workflow-stat-strip" aria-label="작업 흐름 지표 요약">
      <div className="workflow-stat-row workflow-stat-row-2">
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
          <span>· LLM 요청 {formatCount(tokenReportCount)} · cache read {formatCount(tokenCacheReadCount)}</span>
        </div>
      </div>
    </div>
  );
}

function ReportHeroStat({
  label,
  value,
  detail,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className={`report-hero-stat report-hero-stat-${tone}`}>
      <div className="report-hero-stat-icon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="report-hero-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </div>
  );
}

function ReportHero({
  boardExists,
  lastUpdatedLabel,
  ticketTotal,
  codeVolumeCount,
  tokenUsage24hCount,
  runnerRunning,
  runnerBlocked
}: {
  boardExists: boolean;
  lastUpdatedLabel: string;
  ticketTotal: number;
  codeVolumeCount: number;
  tokenUsage24hCount: number;
  runnerRunning: number;
  runnerBlocked: number;
}) {
  return (
    <section className="report-hero" aria-label="운영 통계 요약">
      <div className="report-hero-copy">
        <div className="report-hero-kicker">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          <span>{boardExists ? "보드 추적 중" : "보드 없음"}</span>
        </div>
        <h2>운영 통계</h2>
        <p>
          마지막 업데이트 <strong>{lastUpdatedLabel}</strong>
        </p>
      </div>
      <div className="report-hero-stats">
        <ReportHeroStat
          label="티켓 총량"
          value={`${formatCount(ticketTotal)}개`}
          detail="주문 / PRD / 대기 / 진행 / 완료"
          icon={Database}
          tone="blue"
        />
        <ReportHeroStat
          label="코드 변경량"
          value={`${formatCompactCount(codeVolumeCount)}줄`}
          detail="완료 커밋 누적 기준"
          icon={FolderPlus}
          tone="green"
        />
        <ReportHeroStat
          label="24h 토큰"
          value={`${formatCompactCount(tokenUsage24hCount)}토큰`}
          detail="최근 토큰 기록 기준"
          icon={Terminal}
          tone="violet"
        />
        <ReportHeroStat
          label="러너 실행"
          value={`${formatCount(runnerRunning)}개`}
          detail={`${formatCount(runnerBlocked)}개 막힘`}
          icon={Activity}
          tone="amber"
        />
      </div>
    </section>
  );
}

function displayReportRunnerLabel(value: string, runners?: AutoflowRunner[]) {
  const runner = runners?.find((candidate) => candidate.id === value);
  if (runner) {
    const roleLabel = displayProgressRoleLabel(runner, runners);
    if (roleLabel) return roleLabel;
  }

  const label = displayWorkflowRunnerId(value, runners);
  const normalized = (label || value || "").toLowerCase();
  const workerMatch = normalized.match(/^worker-(\d+)$/);
  const wikiMatch = label.match(/^위키-(\d+)$/);

  if (normalized === "planner") return "Planner";
  if (normalized === "verifier") return "Verifier";
  if (normalized === "worker") return "Worker";
  if (normalized === "unknown") return "역할 미확인";
  if (workerMatch) return `Worker${workerMatch[1]}`;
  if (label === "위키") return "Wiki";
  if (normalized === "wiki") return "Wiki";
  if (wikiMatch) return `Wiki${wikiMatch[1]}`;

  return label;
}

function reportRunnerSortWeight(value: string) {
  const role = startupRuleRoleForValue(value);
  if (role === "planner") return 10;
  if (role === "worker") return 20;
  if (role === "verifier") return 30;
  if (role === "wiki-maintainer") return 40;
  return 90;
}

function ReportingDashboard({
  board,
  lastUpdated,
  ticketTotal,
}: {
  board: AutoflowBoardSnapshot | null;
  lastUpdated: string;
  ticketTotal: number;
}) {
  const metrics = board?.metrics || {};
  const runners = board?.runners || [];
  const {
    codeFilesChangedCount,
    codeVolumeCount,
    tokenUsageCount,
    tokenReportCount,
    tokenCacheReadCount,
    codeInsertionsCount,
    codeDeletionsCount,
    codeNetDeltaCount,
    tokenUsage1hCount,
    tokenUsage24hCount,
    tokenInput1hCount,
    tokenOutput1hCount,
    tokenCache1hCount,
    tokenInput24hCount,
    tokenOutput24hCount,
    tokenCache24hCount
  } = getWorkflowMetricCounts(board);
  const runnerRunning = runners.filter(runnerHasLiveProcess).length;
  const runnerBlocked = runners.filter(runnerBlockedNeedsAttention).length;
  const runnerEnabled = runners.filter((runner) => runnerIsEnabled(runner.enabled)).length;
  const tokenHourlyBuckets = parseMetricJsonArray(statusValue(metrics, "autoflow_token_hourly_24h_json", "[]"))
    .map((entry) => ({
      hour: safeNumber(entry.hour),
      input: safeNumber(entry.input),
      output: safeNumber(entry.output),
      cache: safeNumber(entry.cache)
    }));
  const tokenRoleBreakdownRaw =
    statusValue(metrics, "autoflow_token_role_breakdown_json", "") ||
    statusValue(metrics, "autoflow_token_runner_breakdown_json", "{}");
  const tokenRoleBreakdown = mergeBreakdownLabels(
    buildSortedBreakdown(parseMetricJsonObject(tokenRoleBreakdownRaw)),
    (label) => displayReportRunnerLabel(label, runners)
  );
  const modelBreakdown = buildSortedBreakdown(parseMetricJsonObject(statusValue(metrics, "autoflow_token_model_breakdown_json", "{}")));
  const runnerNeedUser = runners.filter(runnerBlockedNeedsAttention).length;
  const ticketBreakdown = [
    { label: "PRD", value: board?.tickets.prd?.length || 0 },
    { label: "대기", value: board?.tickets.todo?.length || 0 },
    { label: "진행", value: board?.tickets.inprogress?.length || 0 },
    { label: "검증", value: board?.tickets.verifier?.length || 0 },
    { label: "완료", value: board?.tickets.done?.length || 0 }
  ];
  const runnerStatusBreakdown = [
    { label: "실행 중", value: runnerRunning },
    { label: "막힘", value: runnerBlocked },
    { label: "대기/중지", value: Math.max(runners.length - runnerRunning - runnerBlocked, 0) }
  ];

  const hasCodeImpactData =
    codeVolumeCount > 0 ||
    codeFilesChangedCount > 0 ||
    codeInsertionsCount > 0 ||
    codeDeletionsCount > 0;
  const hasTokenData =
    tokenUsageCount > 0 ||
    tokenCacheReadCount > 0 ||
    tokenReportCount > 0 ||
    tokenUsage1hCount > 0 ||
    tokenUsage24hCount > 0 ||
    tokenRoleBreakdown.length > 0 ||
    modelBreakdown.length > 0;
  const hasRunnerData = runners.length > 0;

  const runnerRows = React.useMemo(() => {
    return runners
      .map((runner) => ({
        id: runner.id,
        label: displayReportRunnerLabel(runner.id, runners),
        status: displayStatus(runner.stateStatus || "idle"),
        lastEvent: runner.lastEventAt ? formatDate(runner.lastEventAt) : "-"
      }))
      .sort(
        (left, right) =>
          reportRunnerSortWeight(left.id) - reportRunnerSortWeight(right.id) || left.label.localeCompare(right.label, "ko-KR")
      );
  }, [runners]);

  const totalTickets = formatCount(ticketTotal);
  const lastUpdatedLabel = lastUpdated ? formatDate(lastUpdated) : "미확인";
  const runnerStatusNote =
    `${formatCount(runnerRunning)}개 실행 / ${formatCount(runnerBlocked)}개 막힘` +
    (runnerNeedUser > 0 ? ` / ${formatCount(runnerNeedUser)}개 needs_user` : "");

  return (
    <div className="report-dashboard" aria-label={`통계 카드 ${totalTickets}개 · 마지막 업데이트 ${lastUpdatedLabel}`}>
      <ReportHero
        boardExists={Boolean(board?.exists)}
        lastUpdatedLabel={lastUpdatedLabel}
        ticketTotal={ticketTotal}
        codeVolumeCount={codeVolumeCount}
        tokenUsage24hCount={tokenUsage24hCount}
        runnerRunning={runnerRunning}
        runnerBlocked={runnerBlocked}
      />
      <div className="report-metric-grid report-metric-grid-primary" aria-label="핵심 보드 상태 요약">
        <ReportMetricCard
          label="티켓 흐름"
          value={`${formatCompactCount(ticketTotal)}개`}
          detail="보드 원장 상태별 분포"
          icon={Database}
          tone="report-tone-amber"
          className="report-metric-card-tickets"
          title={`티켓 흐름 ${formatCount(ticketTotal)}개`}
        >
          <ReportHorizontalBarChart title="티켓 상태 분포" items={ticketBreakdown} unit="개" />
        </ReportMetricCard>
        <ReportMetricCard
          label="코드 영향"
          value={`${formatCompactCount(codeFilesChangedCount)}개`}
          detail={hasCodeImpactData ? "변경 파일/추가/삭제/순변동" : "완료 커밋 후 채워집니다"}
          icon={FolderPlus}
          tone="report-tone-green"
          className="report-metric-card-code"
          title={`코드 영향 ${formatCount(codeFilesChangedCount)}개 파일, ${formatCount(codeVolumeCount)}줄 변경`}
        >
          <div className="report-inline-stats">
            <div className="report-inline-stat">
              <span>변경 파일</span>
              <strong>{formatCount(codeFilesChangedCount)}</strong>
            </div>
            <div className="report-inline-stat">
              <span>추가</span>
              <strong>{formatSignedCount(codeInsertionsCount)}</strong>
            </div>
            <div className="report-inline-stat">
              <span>삭제</span>
              <strong>-{formatCount(codeDeletionsCount)}</strong>
            </div>
            <div className="report-inline-stat">
              <span>순변동</span>
              <strong>{formatSignedCount(codeNetDeltaCount)}</strong>
            </div>
          </div>
          {hasCodeImpactData ? (
            <ReportCodeImpactChart title="코드 라인 변경" insertions={codeInsertionsCount} deletions={codeDeletionsCount} />
          ) : null}
        </ReportMetricCard>
        <ReportMetricCard
          label="토큰 사용량"
          value={`${formatCompactCount(tokenUsageCount)}토큰`}
	          detail={hasTokenData ? `${formatCount(tokenReportCount)} LLM 요청 · 전체 누적` : "러너 실행 후 채워집니다"}
          icon={Terminal}
          tone="report-tone-violet"
          className="report-metric-card-token"
	          title={`토큰 사용량 ${formatCount(tokenUsageCount)}토큰, LLM 요청 ${formatCount(tokenReportCount)}, cache read ${formatCount(tokenCacheReadCount)}, 전체 누적`}
        >
          {hasTokenData ? (
            <>
              <div className="report-inline-stats">
                <div className="report-inline-stat">
                  <span>누적</span>
                  <strong>{formatCount(tokenUsageCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>cache read</span>
                  <strong>{formatCount(tokenCacheReadCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>최근 1h</span>
                  <strong>{formatCount(tokenUsage1hCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>최근 24h</span>
                  <strong>{formatCount(tokenUsage24hCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>입력</span>
                  <strong>{formatCount(tokenInput24hCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>출력</span>
                  <strong>{formatCount(tokenOutput24hCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>캐시 입력</span>
                  <strong>{formatCount(tokenCache24hCount)}</strong>
                </div>
                <div className="report-inline-stat">
                  <span>역할별</span>
                  <strong>{tokenRoleBreakdown.length}개</strong>
                </div>
                <div className="report-inline-stat">
                  <span>모델별</span>
                  <strong>{modelBreakdown.length}개</strong>
                </div>
              </div>
              {tokenInput1hCount + tokenOutput1hCount + tokenCache1hCount > 0 ? (
                <div className="report-inline-stat">
                  <span>최근 1h 상세</span>
                  <em>
                    입력 {formatCount(tokenInput1hCount)} / 출력 {formatCount(tokenOutput1hCount)} / 캐시 {formatCount(tokenCache1hCount)}
                  </em>
                </div>
              ) : null}
              <ReportHorizontalBarChart title="역할별 누적 토큰" items={tokenRoleBreakdown} />
              {modelBreakdown.length ? <ReportHorizontalBarChart title="모델별 누적 토큰" items={modelBreakdown} /> : null}
              <ReportHourlyTokenChart title="최근 24시간 입력/출력 토큰 추세" data={tokenHourlyBuckets} />
            </>
          ) : (
            <div className="report-fallback">러너 토큰 기록이 없어 분해 데이터가 없습니다</div>
          )}
        </ReportMetricCard>
        <ReportMetricCard
          label="러너 상태"
          value={`${formatCompactCount(runnerEnabled)}개`}
          detail={runnerStatusNote}
          icon={Activity}
          tone="report-tone-blue"
          className="report-metric-card-runners"
          title={`러너 상태 ${formatCount(runnerRunning)}개 실행 중, ${formatCount(runnerBlocked)}개 막힘`}
        >
          <div className="report-inline-stats">
            <div className="report-inline-stat">
              <span>러너 총 수</span>
              <strong>{formatCount(runners.length)}</strong>
            </div>
            <div className="report-inline-stat">
              <span>활성화</span>
              <strong>{formatCount(runnerEnabled)}</strong>
            </div>
            <div className="report-inline-stat">
              <span>실행 중</span>
              <strong>{formatCount(runnerRunning)}</strong>
            </div>
            <div className="report-inline-stat">
              <span>막힘</span>
              <strong>{formatCount(runnerBlocked)}</strong>
            </div>
            {runnerRows.map((runner) => (
              <div key={runner.id} className="report-inline-stat">
                <span>{runner.label}</span>
                <strong>{runner.status}</strong>
                <em>마지막 이벤트 {runner.lastEvent}</em>
              </div>
            ))}
            {!hasRunnerData ? <div className="report-fallback">러너 설정이 없습니다</div> : null}
          </div>
          {hasRunnerData ? <ReportDoughnutChart title="러너 상태 분포" items={runnerStatusBreakdown} unit="개" /> : null}
        </ReportMetricCard>
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
  const runners = board?.runners || [];
  const handoffCount = statusValue(metrics, "handoff_count", String(board?.conversationFiles?.length || 0));
  const runnerRunningCount = runners.filter((runner) => {
    const state = (runner.stateStatus || "").toLowerCase();
    return state === "running" || Boolean(runner.pid);
  }).length;
  const runnerEnabledCount = runners.filter((runner) => runnerIsEnabled(runner.enabled)).length;
  const workerActiveCount = statusValue(
    metrics,
    "ticket_worker_active_count",
    statusValue(status, "ticket_worker_active_count", String(board?.tickets.inprogress?.length || 0))
  );
  const cards = [
    {
      label: "PRD",
      value: statusValue(metrics, "spec_total", statusValue(status, "spec_count", String(board?.tickets.prd?.length || 0))),
      detail: `${handoffCount}개 전달 요청`,
      icon: ClipboardCheck,
      tone: "metric-blue"
    },
    {
      label: "대기열",
      value: statusValue(status, "work_item_pending_count", String(board?.tickets.todo?.length || 0)),
      detail: "준비된 work item",
      icon: Layers3,
      tone: "metric-amber"
    },
    {
      label: "AI",
      value: workerActiveCount,
      detail: `AI ${formatCount(runnerRunningCount)}/${formatCount(runnerEnabledCount)} 실행`,
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

type TicketWorkspaceTabKey = "prd" | "todo" | "coverage";
type TicketWorkspaceStatusKey = "prd" | "todo" | "inprogress" | "verifier" | "blocked" | "done";
type TicketWorkspaceItemKind = "prd" | "ticket";
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

const prdKeyPattern = /PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+/i;
const namespacedPrdFilePattern = /^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i;
const namespacedTodoFilePattern = /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i;
const legacyPrdFilePattern = /^pr(?:d|oject)_\d+\.md$/i;
const legacyTodoFilePattern = /^(?:Todo-\d+|tickets_\d+)\.md$/i;

const ticketKanbanFolderOrder = ["prd", "todo", "inprogress", "verifier", "done"] as const;
const ticketWorkspaceTabs: Array<{
  key: TicketWorkspaceTabKey;
  label: string;
  description: string;
}> = [
  { key: "prd", label: "PRD", description: "작성/보관된 PRD" },
  { key: "todo", label: "WORK", description: "PRD-derived work item" },
  { key: "coverage", label: "맵", description: "PRD ↔ work item 커버리지" }
];
const ticketKanbanFolderMeta: Record<string, {
  label: string;
  description: string;
}> = {
  prd: { label: "PRD", description: "PRD 대기" },
  todo: { label: "WORK", description: "아직 시작 전" },
  inprogress: { label: "진행 중", description: "Worker가 처리중" },
  verifier: { label: "검증 대기", description: "Verifier가 확인할 항목" },
  done: { label: "완료", description: "완료 기록" }
};

function workflowFileDisplayName(name: string) {
  // Filenames are stored in the new PRD-NNN.md / TODO-NNN.md convention, so
  // the stem is already the display id.
  return name.replace(/\.md$/, "");
}

function sortFilesByModifiedAt(files: AutoflowFilePreview[]) {
  return [...files].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

function numericIdFromBoardFile(file: AutoflowFilePreview) {
  const match = file.name.match(/^(?:PRD|TODO)-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?(\d+)(?:_retry_.*)?\.md$/i);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function compareTicketWorkspaceItems(left: TicketWorkspaceItem, right: TicketWorkspaceItem) {
  const leftId = numericIdFromBoardFile(left);
  const rightId = numericIdFromBoardFile(right);
  if (leftId !== rightId) {
    return rightId - leftId;
  }

  const modified = right.modifiedAt.localeCompare(left.modifiedAt);
  if (modified !== 0) {
    return modified;
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

function isPrdBoardFile(file: AutoflowFilePreview) {
  return namespacedPrdFilePattern.test(file.name) || legacyPrdFilePattern.test(file.name);
}

function isTicketBoardFile(file: AutoflowFilePreview) {
  return namespacedTodoFilePattern.test(file.name) || legacyTodoFilePattern.test(file.name);
}

function markdownScalar(content: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = content.match(new RegExp(`^- (?:${escaped.join("|")}):[ \\t]*(.*)$`, "im"));
  return match?.[1]?.trim() || "";
}

function ticketMarkdownDisplayContent(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:[-*]\s*)?Priority\s*:/i.test(line))
    .join("\n");
}

function normalizePrdKey(value: string): string {
  const match = value.match(prdKeyPattern);
  return match ? match[0].replace(/^prd-/i, "PRD-") : "";
}

function prdKeyFromTicketContent(content: string): string {
  const direct =
    markdownScalar(content, ["PRD Key"]) ||
    markdownScalar(content, ["Project Key"]) ||
    markdownScalar(content, ["Key"]);
  const sourcePrd = markdownScalar(content, ["Source PRD"]);
  return normalizePrdKey(direct || sourcePrd);
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

function stripWorkflowTitlePrefix(value: string) {
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
  if (!isTicketBoardFile(file)) {
    return null;
  }
  if (normalized.includes("/tickets/todo/")) {
    return "todo";
  }
  if (normalized.includes("/tickets/inprogress/")) {
    return "inprogress";
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
    return boardPath(file.filePath).includes("/tickets/prd/") ? "PRD" : "보관 PRD";
  }

  if (statusKey === "blocked") {
    return "막힘";
  }

  if (statusKey === "verifier") {
    return "검증 대기";
  }

  if (statusKey === "inprogress") {
    const stage = markdownScalar(content, ["Stage"]).toLowerCase();
    return displayStatus(stage || "executing");
  }

  const labels: Record<Exclude<TicketWorkspaceStatusKey, "prd" | "inprogress" | "verifier" | "blocked">, string> = {
    todo: "발급됨",
    done: "완료"
  };
  return labels[statusKey];
}

function ticketWorkspaceStatusVariant(statusKey: TicketWorkspaceStatusKey) {
  if (statusKey === "blocked") {
    return "destructive" as const;
  }

  if (statusKey === "inprogress" || statusKey === "verifier" || statusKey === "done") {
    return "default" as const;
  }

  return "secondary" as const;
}

function extractTicketWorkspaceMeta(file: AutoflowFilePreview, content: string, runners?: AutoflowRunner[]): TicketWorkspaceItemMeta {
  const id = markdownScalar(content, ["ID"]) || workflowFileDisplayName(file.name);
  const ai = markdownScalar(content, ["AI", "Execution AI", "Worker"]);
  const claimedBy = markdownScalar(content, ["Claimed By"]);
  const title = stripWorkflowTitlePrefix(
    markdownScalar(content, ["Title"]) || markdownSectionPreview(content, "Request") || file.title || file.name
  );
  const stage = markdownScalar(content, ["Stage"]);
  const fileStatusKey = ticketWorkspaceStatusForFile(file) || "todo";
  const statusKey = fileStatusKey === "inprogress" && stage.toLowerCase() === "blocked" ? "blocked" : fileStatusKey;
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
    statusVariant: ticketWorkspaceStatusVariant(statusKey)
  };
}

function todoWorkspaceFiles(board: AutoflowBoardSnapshot | null) {
  const files = Object.values(board?.tickets || {}).flatMap((folderFiles) =>
    folderFiles.filter(isTicketBoardFile)
  );

  return sortFilesByModifiedAt(files);
}

function prdWorkspaceFiles(board: AutoflowBoardSnapshot | null) {
  const files = Object.values(board?.tickets || {}).flatMap((folderFiles) =>
    folderFiles.filter(isPrdBoardFile)
  );

  return sortFilesByModifiedAt(files);
}

function ticketWorkspaceTabFromStorage(value: string | null): TicketWorkspaceTabKey {
  if (value === "order" || value === "inbox") return "prd";
  if (value === "issued") return "todo";
  return ticketWorkspaceTabs.some((tab) => tab.key === value) ? (value as TicketWorkspaceTabKey) : "todo";
}

function ticketKanbanFolderForItem(item: TicketWorkspaceItem): TicketKanbanFolderKey {
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
  const movedTicket = namespacedTodoFilePattern.test(activeName) || legacyTodoFilePattern.test(activeName)
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
  const ItemIcon = item?.kind === "prd" ? ClipboardCheck : ClipboardList;
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
                    <MarkdownViewer content={ticketMarkdownDisplayContent(content.content)} />
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
  return "ticket";
}

function TicketWorkspaceKanbanView({
  files,
  options,
  runners,
  defaultFolders,
  ariaLabel = "폴더 기준 칸반"
}: {
  files: AutoflowFilePreview[];
  options?: WorkflowBoardOptions;
  runners?: AutoflowRunner[];
  defaultFolders?: readonly string[];
  ariaLabel?: string;
}) {
  const [metaByPath, setMetaByPath] = React.useState<Record<string, TicketWorkspaceItemMeta>>({});
  const [activeDetailPath, setActiveDetailPath] = React.useState("");
  const [activeDetailSnapshot, setActiveDetailSnapshot] = React.useState<TicketWorkspaceItem | null>(null);
  const [detailContent, setDetailContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [detailContentPath, setDetailContentPath] = React.useState("");
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");
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
          (isPrdBoardFile(file) ? "prd" : "todo");
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
              statusVariant: ticketWorkspaceStatusVariant(fallbackKey)
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
          (itemKind === "prd" ? "prd" : "todo");
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
          statusVariant: meta?.statusVariant || ticketWorkspaceStatusVariant(statusKey)
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

  // Fetch the detail body once per file path. Board polling produces fresh item
  // references every tick, so path + scoped options are the stable inputs.
  const activeDetailFilePath = activeDetailItem?.filePath || "";
  const optionsProjectRoot = options?.projectRoot || "";
  const optionsBoardDirName = options?.boardDirName || "";

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

  // Keep source fetch idempotent for the open ticket.
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
                  {columnItems.length === 0 ? (
                    <div className="ticket-kanban-column-empty">비어 있음</div>
                  ) : (
                    <div className="ticket-kanban-card-list">
                      {columnItems.map((item) => {
                        const metaText = [item.projectKey, item.aiLabel].filter(Boolean).join(" · ");
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
                                <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
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
  options?: WorkflowBoardOptions;
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
        title={pinSubtitle || `${pinTitle} — 클릭하여 세부 내용 보기`}
        aria-label={pinSubtitle ? `${pinTitle} — ${pinSubtitle} — 클릭하여 세부 내용 보기` : `${pinTitle} — 클릭하여 세부 내용 보기`}
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
                      <li key={file.filePath} className="workflow-pin-list-item">
                        <Button
                          variant="ghost"
                          type="button"
                          className={`workflow-pin-item${isActive ? " workflow-pin-item-active" : ""}`}
                          onClick={() => handleOpenDetail(file)}
                          aria-pressed={isActive}
                          title={file.title || file.name}
                        >
                          <span className="workflow-pin-item-side">
                            <strong className="workflow-pin-item-id">{workflowFileDisplayName(file.name)}</strong>
                            {file.stateLabel ? (
                              <Badge
                                variant={file.stateTone === "destructive" ? "destructive" : file.stateTone === "success" ? "default" : "secondary"}
                                className={`workflow-pin-item-badge workflow-pin-item-badge-${file.stateTone || "neutral"}`}
                              >
                                {file.stateLabel}
                              </Badge>
                            ) : null}
                          </span>
                          {file.title ? <span className="workflow-pin-item-title">{file.title}</span> : null}
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
                        <MarkdownViewer content={ticketMarkdownDisplayContent(detailContent.content)} />
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
  const SelectedDetailIcon = selectedItem?.kind === "prd" ? ClipboardCheck : ClipboardList;
  const selectedKindLabel = selectedItem?.kind === "prd" ? "PRD" : "WORK";

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
                  <MarkdownViewer content={ticketMarkdownDisplayContent(detailContent.content)} />
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

type CoverageStageKey = "todo" | "inprogress" | "verifier" | "done";

type CoverageTodoRef = {
  file: WorkflowFileEntry;
  stage: CoverageStageKey;
};

type CoveragePrdEntry = {
  prdKey: string;
  displayId: string;
  title: string;
  prdStatus: "open" | "done" | "missing";
  prdFile?: WorkflowFileEntry;
  todos: CoverageTodoRef[];
  counts: Record<CoverageStageKey, number>;
  total: number;
  closure: number;
};

type CoverageData = {
  entries: CoveragePrdEntry[];
  unmapped: CoverageTodoRef[];
  prdCount: number;
  mappedTodoCount: number;
  unmappedTodoCount: number;
  totalTodoCount: number;
  doneTodoCount: number;
  avgClosure: number;
};

function isPrdFileName(name: string): boolean {
  return namespacedPrdFilePattern.test(name);
}

function isTodoFileName(name: string): boolean {
  return namespacedTodoFilePattern.test(name);
}

function prdKeyFromFileName(name: string): string {
  const stem = name.replace(/\.md$/i, "");
  return /^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+$/i.test(stem) ? normalizePrdKey(stem) : "";
}

function prdKeyFromDonePath(filePath: string): string {
  const norm = filePath.replace(/\\/g, "/");
  const m = norm.match(/\/tickets\/done\/([^/]+)\//);
  if (!m) return "";
  const candidate = m[1];
  return /^PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+$/i.test(candidate) ? normalizePrdKey(candidate) : "";
}

function buildPrdCoverage(board: AutoflowBoardSnapshot | null, prdKeyByPath: Record<string, string> = {}): CoverageData {
  const empty: CoverageData = {
    entries: [],
    unmapped: [],
    prdCount: 0,
    mappedTodoCount: 0,
    unmappedTodoCount: 0,
    totalTodoCount: 0,
    doneTodoCount: 0,
    avgClosure: 0,
  };
  if (!board) return empty;

  const prdMap = new Map<string, { prdKey: string; title: string; prdStatus: "open" | "done"; prdFile: WorkflowFileEntry }>();
  for (const file of board.tickets.prd || []) {
    if (!isPrdFileName(file.name)) continue;
    const key = prdKeyFromFileName(file.name);
    if (!key) continue;
    prdMap.set(key, { prdKey: key, title: file.title || key, prdStatus: "open", prdFile: file });
  }
  for (const file of board.tickets.done || []) {
    if (!isPrdFileName(file.name)) continue;
    const key = prdKeyFromFileName(file.name);
    if (!key) continue;
    if (!prdMap.has(key)) {
      prdMap.set(key, { prdKey: key, title: file.title || key, prdStatus: "done", prdFile: file });
    }
  }

  const todoRefs: Array<CoverageTodoRef & { prdKey: string }> = [];
  const collectFrom = (bucket: CoverageStageKey, files: WorkflowFileEntry[] | undefined) => {
    for (const file of files || []) {
      if (!isTodoFileName(file.name)) continue;
      const key = normalizePrdKey(file.prdKey || "") || prdKeyByPath[file.filePath] || prdKeyFromDonePath(file.filePath) || "";
      const coverageFile = key && file.prdKey !== key ? { ...file, prdKey: key } : file;
      todoRefs.push({ file: coverageFile, stage: bucket, prdKey: key });
    }
  };
  collectFrom("todo", board.tickets.todo);
  collectFrom("inprogress", board.tickets.inprogress);
  collectFrom("verifier", board.tickets.verifier);
  collectFrom("done", board.tickets.done);

  const todosByPrd = new Map<string, CoverageTodoRef[]>();
  const unmapped: CoverageTodoRef[] = [];
  for (const ref of todoRefs) {
    if (!ref.prdKey) {
      unmapped.push({ file: ref.file, stage: ref.stage });
      continue;
    }
    const list = todosByPrd.get(ref.prdKey) || [];
    list.push({ file: ref.file, stage: ref.stage });
    todosByPrd.set(ref.prdKey, list);
  }

  const allKeys = new Set<string>([...prdMap.keys(), ...todosByPrd.keys()]);
  const entries: CoveragePrdEntry[] = Array.from(allKeys).map((key) => {
    const prd = prdMap.get(key);
    const todos = (todosByPrd.get(key) || []).sort((a, b) => a.file.name.localeCompare(b.file.name));
    const counts: Record<CoverageStageKey, number> = { todo: 0, inprogress: 0, verifier: 0, done: 0 };
    for (const t of todos) counts[t.stage] = (counts[t.stage] || 0) + 1;
    const total = todos.length;
    const closure = total > 0 ? Math.round((counts.done / total) * 100) : 0;
    return {
      prdKey: key,
      displayId: workflowFileDisplayName(`${key}.md`),
      title: prd?.title || key,
      prdStatus: prd ? prd.prdStatus : "missing",
      prdFile: prd?.prdFile,
      todos,
      counts,
      total,
      closure,
    };
  });
  const prdNumericIdValue = (prdKey: string): number => {
    const m = prdKey.match(/[-_](\d+)$/);
    return m ? Number.parseInt(m[1], 10) : -1;
  };
  entries.sort((a, b) => {
    const an = prdNumericIdValue(a.prdKey);
    const bn = prdNumericIdValue(b.prdKey);
    if (an !== bn) return bn - an;
    return b.prdKey.localeCompare(a.prdKey);
  });

  const mappedTodoCount = todoRefs.length - unmapped.length;
  const doneTodoCount = todoRefs.filter((ref) => ref.stage === "done").length;
  const closureValues = entries.filter((entry) => entry.total > 0).map((entry) => entry.closure);
  const avgClosure = closureValues.length > 0
    ? Math.round(closureValues.reduce((sum, v) => sum + v, 0) / closureValues.length)
    : 0;

  return {
    entries,
    unmapped: unmapped.sort((a, b) => a.file.name.localeCompare(b.file.name)),
    prdCount: allKeys.size,
    mappedTodoCount,
    unmappedTodoCount: unmapped.length,
    totalTodoCount: todoRefs.length,
    doneTodoCount,
    avgClosure,
  };
}

const coverageStageMeta: Record<CoverageStageKey, { label: string; tone: "neutral" | "info" | "warning" | "success" }> = {
  todo: { label: "대기", tone: "neutral" },
  inprogress: { label: "진행", tone: "info" },
  verifier: { label: "검증", tone: "warning" },
  done: { label: "완료", tone: "success" },
};

function PrdCoverageView({ board, options }: { board: AutoflowBoardSnapshot | null; options?: WorkflowBoardOptions }) {
  const coverageTodoFiles = React.useMemo(() => {
    if (!board) return [];
    return ["todo", "inprogress", "verifier", "done"].flatMap((bucket) =>
      (board.tickets[bucket] || []).filter((file): file is WorkflowFileEntry => isTodoFileName(file.name))
    );
  }, [board]);
  const coverageTodoFingerprint = React.useMemo(() => (
    coverageTodoFiles.map((file) => `${file.filePath}:${file.modifiedAt}:${file.prdKey || ""}`).join("\n")
  ), [coverageTodoFiles]);
  const [contentPrdKeysByPath, setContentPrdKeysByPath] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let cancelled = false;
    const missingPrdKeyFiles = coverageTodoFiles.filter((file) => !normalizePrdKey(file.prdKey || ""));
    if (!options?.projectRoot || missingPrdKeyFiles.length === 0) {
      setContentPrdKeysByPath({});
      return () => {
        cancelled = true;
      };
    }
    const readOptions: WorkflowBoardOptions = {
      projectRoot: options.projectRoot,
      boardDirName: options.boardDirName,
    };
    void Promise.all(
      missingPrdKeyFiles.map(async (file): Promise<[string, string]> => {
        try {
          const result = await window.autoflow.readBoardFile({
            ...readOptions,
            filePath: file.filePath
          });
          return [file.filePath, result.ok ? prdKeyFromTicketContent(result.content || "") : ""];
        } catch {
          return [file.filePath, ""];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setContentPrdKeysByPath(Object.fromEntries(entries.filter(([, key]) => Boolean(key))));
    });
    return () => {
      cancelled = true;
    };
  }, [coverageTodoFiles, coverageTodoFingerprint, options?.projectRoot, options?.boardDirName]);
  const data = React.useMemo(() => buildPrdCoverage(board, contentPrdKeysByPath), [board, contentPrdKeysByPath]);
  const [selectedFile, setSelectedFile] = React.useState<WorkflowFileEntry | null>(null);
  const [detailContent, setDetailContent] = React.useState<AutoflowFileContentResult | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");

  const closeLayer = React.useCallback(() => {
    setSelectedFile(null);
    setDetailContent(null);
    setDetailError("");
  }, []);

  const handleOpenFile = React.useCallback(async (file: WorkflowFileEntry) => {
    setSelectedFile(file);
    setDetailContent(null);
    setDetailError("");
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
  }, [options]);

  const hasEntries = data.entries.length > 0 || data.unmapped.length > 0;

  if (!hasEntries) {
    return (
      <div className="prd-coverage-empty" role="status">
        <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        <span>아직 매핑할 PRD 또는 work item이 없습니다.</span>
      </div>
    );
  }

  return (
    <div className="prd-coverage-view" aria-label="PRD 커버리지 맵">
      <header className="prd-coverage-summary">
        <article className="prd-coverage-summary-card">
          <span>PRD</span>
          <strong>{data.prdCount}</strong>
        </article>
        <article className="prd-coverage-summary-card">
          <span>매핑된 work item</span>
          <strong>{data.mappedTodoCount}</strong>
          <em>/ {data.totalTodoCount}</em>
        </article>
        <article className="prd-coverage-summary-card">
          <span>완료된 work item</span>
          <strong>{data.doneTodoCount}</strong>
          <em>/ {data.totalTodoCount}</em>
        </article>
        <article className="prd-coverage-summary-card">
          <span>평균 PRD 커버리지</span>
          <strong>{data.avgClosure}%</strong>
        </article>
        {data.unmappedTodoCount > 0 ? (
          <article className="prd-coverage-summary-card prd-coverage-summary-warning">
            <span>PRD없는 work item</span>
            <strong>{data.unmappedTodoCount}</strong>
          </article>
        ) : null}
      </header>
      <div className="prd-coverage-grid">
        {data.entries.map((entry) => (
          <PrdCoverageCard key={entry.prdKey} entry={entry} onOpenFile={handleOpenFile} />
        ))}
        {data.unmapped.length > 0 ? (
          <PrdCoverageUnmappedCard todos={data.unmapped} onOpenFile={handleOpenFile} />
        ) : null}
      </div>
      <PrdCoverageDetailLayer
        file={selectedFile}
        content={detailContent}
        loading={detailLoading}
        error={detailError}
        onOpenChange={(open) => { if (!open) closeLayer(); }}
        onClose={closeLayer}
      />
    </div>
  );
}

function PrdCoverageDetailLayer({
  file,
  content,
  loading,
  error,
  onOpenChange,
  onClose,
}: {
  file: WorkflowFileEntry | null;
  content: AutoflowFileContentResult | null;
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}) {
  const isPrd = file ? isPrdFileName(file.name) : false;
  const ItemIcon = isPrd ? ClipboardCheck : ClipboardList;
  const displayId = file ? workflowFileDisplayName(file.name) : "";
  const title = file?.title || displayId;
  const prdKey = file
    ? (isPrd
        ? prdKeyFromFileName(file.name) || prdKeyFromDonePath(file.filePath)
        : (file.prdKey || prdKeyFromDonePath(file.filePath) || ""))
    : "";
  const stage = file?.stage || "";
  const stageLabel = stage && coverageStageMeta[stage as CoverageStageKey]
    ? coverageStageMeta[stage as CoverageStageKey].label
    : stage;
  const statusLabel = isPrd
    ? (file?.filePath.includes("/tickets/done/") ? "PRD 완료" : "PRD 열림")
    : stageLabel || "work item";
  const statusVariant: "default" | "secondary" | "destructive" = isPrd
    ? (file?.filePath.includes("/tickets/done/") ? "default" : "secondary")
    : "secondary";
  const metaRows: Array<[string, string]> = file
    ? [
        ["ID", displayId],
        ["PRD Key", prdKey],
        ["Stage", stageLabel],
        ["Last Updated", formatDate(file.modifiedAt)],
      ].filter(([, value]) => Boolean(value)) as Array<[string, string]>
    : [];

  return (
    <Dialog open={Boolean(file)} onOpenChange={onOpenChange}>
      <DialogContent
        className="workflow-pin-layer-panel workflow-pin-layer-default ticket-detail-layer-panel"
        overlayClassName="workflow-pin-layer-overlay"
        keepMounted
        aria-describedby={undefined}
      >
        {file ? (
          <>
            <div className="workflow-pin-layer-header ticket-detail-layer-header">
              <div className="workflow-pin-layer-heading">
                <ItemIcon className="h-4 w-4" aria-hidden="true" />
                <DialogTitle asChild>
                  <strong>{displayId}</strong>
                </DialogTitle>
              </div>
              <Badge className="ticket-workspace-detail-badge" variant={statusVariant}>
                {statusLabel}
              </Badge>
              <time>{formatDate(file.modifiedAt)}</time>
              <span className="ticket-detail-layer-path">{file.filePath}</span>
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
              <h4>{title}</h4>
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
                    <MarkdownViewer content={ticketMarkdownDisplayContent(content.content)} />
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

function PrdCoverageCard({
  entry,
  onOpenFile,
}: {
  entry: CoveragePrdEntry;
  onOpenFile: (file: WorkflowFileEntry) => void | Promise<void>;
}) {
  const isResearchOnly = entry.prdStatus === "done" && entry.total === 0;
  const isPrdOnlyDone =
    entry.prdStatus === "done" && entry.total > 0 && entry.counts.done < entry.total;
  const statusTone = isResearchOnly
    ? "research"
    : isPrdOnlyDone
      ? "prd-only-done"
      : entry.prdStatus;
  const statusLabel = isResearchOnly
    ? "구현 없이 완료"
    : entry.prdStatus === "open"
      ? "PRD 열림"
      : entry.prdStatus === "done"
        ? isPrdOnlyDone
          ? "PRD 완료 · work item 진행"
          : "전체 완료"
        : "PRD 없음";
  const prdClickable = Boolean(entry.prdFile);
  return (
    <article className={`prd-coverage-card prd-coverage-card-${statusTone}`} aria-label={`${entry.displayId} 커버리지`}>
      <header className="prd-coverage-card-header">
        {prdClickable && entry.prdFile ? (
          <button
            type="button"
            className="prd-coverage-card-title prd-coverage-card-title-button"
            onClick={() => onOpenFile(entry.prdFile as WorkflowFileEntry)}
            title={`${entry.displayId} 내용 열기`}
          >
            <strong>{entry.displayId}</strong>
            <span title={entry.title}>{entry.title}</span>
          </button>
        ) : (
          <div className="prd-coverage-card-title">
            <strong>{entry.displayId}</strong>
            <span title={entry.title}>{entry.title}</span>
          </div>
        )}
        <span className={`prd-coverage-status prd-coverage-status-${statusTone}`}>{statusLabel}</span>
      </header>
      {entry.total > 0 ? (
        <ul className="prd-coverage-todos" aria-label="자식 work item 목록">
          {entry.todos.map((todo) => (
            <li key={todo.file.filePath} className={`prd-coverage-todo prd-coverage-todo-${todo.stage}`}>
              <button
                type="button"
                className="prd-coverage-todo-button"
                onClick={() => onOpenFile(todo.file)}
                title={`${todo.file.name} 내용 열기`}
              >
                <span className="prd-coverage-todo-id">{workflowFileDisplayName(todo.file.name)}</span>
                <span className="prd-coverage-todo-stage">{coverageStageMeta[todo.stage].label}</span>
                <span className="prd-coverage-todo-title" title={todo.file.title}>{todo.file.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function PrdCoverageUnmappedCard({
  todos,
  onOpenFile,
}: {
  todos: CoverageTodoRef[];
  onOpenFile: (file: WorkflowFileEntry) => void | Promise<void>;
}) {
  return (
    <article className="prd-coverage-card prd-coverage-card-unmapped" aria-label="PRD없는 work item">
      <header className="prd-coverage-card-header">
        <div className="prd-coverage-card-title">
          <strong>PRD없는 work item</strong>
        </div>
        <span className="prd-coverage-status prd-coverage-status-unmapped">{todos.length}</span>
      </header>
      <ul className="prd-coverage-todos" aria-label="자식 work item 목록">
        {todos.map((todo) => (
          <li key={todo.file.filePath} className={`prd-coverage-todo prd-coverage-todo-${todo.stage}`}>
            <button
              type="button"
              className="prd-coverage-todo-button"
              onClick={() => onOpenFile(todo.file)}
              title={`${todo.file.name} 내용 열기`}
            >
              <span className="prd-coverage-todo-id">{todo.file.name.replace(/\.md$/, "")}</span>
              <span className="prd-coverage-todo-stage">{coverageStageMeta[todo.stage].label}</span>
              <span className="prd-coverage-todo-title" title={todo.file.title}>{todo.file.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function TicketKanban({
  board,
  options,
  onActionToast,
  onRequestRefresh
}: {
  board: AutoflowBoardSnapshot | null;
  options?: WorkflowBoardOptions;
  onActionToast?: (severity: AlertSeverity, message: string) => void;
  onRequestRefresh?: () => Promise<void> | void;
}) {
  const todoFiles = React.useMemo(() => todoWorkspaceFiles(board), [board]);
  const prdFiles = React.useMemo(() => prdWorkspaceFiles(board), [board]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<TicketWorkspaceTabKey>(() =>
    ticketWorkspaceTabFromStorage(window.localStorage.getItem("autoflow.activeTicketWorkspaceTab"))
  );

  React.useEffect(() => {
    window.localStorage.setItem("autoflow.activeTicketWorkspaceTab", activeWorkspaceTab);
  }, [activeWorkspaceTab]);

  const activeTabMeta = ticketWorkspaceTabs.find((tab) => tab.key === activeWorkspaceTab) || ticketWorkspaceTabs[ticketWorkspaceTabs.length - 1];

  return (
    <section className="ticket-kanban-board" aria-label="티켓 정보">
      <PageLayout
        className="ticket-workspace-page"
        header={
          <div className="ticket-workspace-toolbar">
            <Tabs value={activeWorkspaceTab} onValueChange={(value) => setActiveWorkspaceTab(ticketWorkspaceTabFromStorage(value))}>
              <TabsList className="ticket-workspace-tabs" aria-label="티켓 작업공간 보기">
                {ticketWorkspaceTabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key} className="ticket-workspace-tab-trigger">
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
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
              defaultFolders={["prd", "done"]}
              ariaLabel="폴더 기준 PRD 칸반"
            />
          ) : null}
          {activeWorkspaceTab === "coverage" ? (
            <PrdCoverageView key="coverage" board={board} options={options} />
          ) : null}
          {activeWorkspaceTab === "todo" ? (
            <TicketWorkspaceKanbanView
              key="todo"
              files={todoFiles}
              options={options}
              runners={board?.runners}
              defaultFolders={["todo", "inprogress", "verifier", "done"]}
              ariaLabel="폴더 기준 work item 칸반"
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
  onConfigure,
  onActionToast,
  onRequestRefresh
}: {
  board: AutoflowBoardSnapshot | null;
  installedAgentProfiles?: InstalledAgentProfiles;
  selectedPath: string;
  onSelect: (filePath: string) => void;
  options?: WorkflowBoardOptions;
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
  onActionToast?: (severity: AlertSeverity, message: string) => void;
  onRequestRefresh?: () => Promise<void> | void;
}) {
  if (!board) {
    return (
      <PageLayout>
        <div className="ai-progress-board" data-runner-count={0} aria-label="AI별 작업 진행률" aria-busy="true" />
      </PageLayout>
    );
  }

  const allProgressRunners = sortProgressBoardRunners(
    (board?.runners || []).filter((runner) => (runner.role || "").toLowerCase() !== "self-improve")
  );
  const runners = allProgressRunners.filter(runnerShouldShowOnAiProgressBoard);
  const plannerRunners: AutoflowRunner[] = [];
  const workerRunners: AutoflowRunner[] = [];
  const verifierRunners: AutoflowRunner[] = [];
  const wikiRunners: AutoflowRunner[] = [];
  const otherRunners: AutoflowRunner[] = [];
  for (const runner of runners) {
    const role = startupRuleRoleForRunner(runner);
    if (role === "planner") plannerRunners.push(runner);
    else if (role === "worker") workerRunners.push(runner);
    else if (role === "verifier") verifierRunners.push(runner);
    else if (role === "wiki-maintainer") wikiRunners.push(runner);
    else otherRunners.push(runner);
  }
  const hasVerifierRunner = verifierRunners.length > 0;
  const renderProgressRow = (runner: AutoflowRunner) => (
    <AiProgressRow
      key={runner.id}
      runner={runner}
      onSelect={onSelect}
      installedAgentProfiles={installedAgentProfiles}
      options={options ? { ...options, allRunners: allProgressRunners } : undefined}
      actionKey={actionKeys[runner.id] || ""}
      draft={drafts[runner.id]}
      savedDraft={savedDrafts[runner.id]}
      onSelectRunner={onSelectRunner}
      onControl={onControl}
      onRunnerAuthChoice={onRunnerAuthChoice}
      onDraftChange={onDraftChange}
      onConfigure={onConfigure}
    />
  );
  const prdSpecs = (board?.tickets.prd || [])
    .filter((file) => {
      const name = file?.name || "";
      return name.startsWith("PRD-");
    })
    .map((file) => ({ ...file, stateLabel: "대기", stateTone: "neutral" } as WorkflowFileEntry));
  const doneSpecs = (board?.tickets.done || [])
    .filter((file) => {
      const name = file?.name || "";
      return name.startsWith("PRD-");
    })
    .map((file) => ({ ...file, stateLabel: "완료", stateTone: "success" } as WorkflowFileEntry));
  const todoTickets = (board?.tickets.todo || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file, stateLabel: "대기", stateTone: "neutral" } as WorkflowFileEntry));
  const doneTickets = (board?.tickets.done || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file, stateLabel: "완료", stateTone: "success" } as WorkflowFileEntry));
  const inprogressTickets = (board?.tickets.inprogress || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file, stateLabel: "진행 중", stateTone: "neutral" } as WorkflowFileEntry));
  const verifierTickets = (board?.tickets.verifier || [])
    .filter(isTicketBoardFile)
    .map((file) => ({ ...file, stateLabel: "검증 대기", stateTone: "neutral" } as WorkflowFileEntry));
  const specNumericId = (name: string) => {
    const match = name.match(/PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const ticketNumericId = (name: string) => {
    const match = name.match(/TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const specFiles: WorkflowFileEntry[] = [...prdSpecs, ...doneSpecs].sort(
    (a, b) => specNumericId(b.name) - specNumericId(a.name)
  );
  const todoFilesById = new Map<string, WorkflowFileEntry>();
  for (const ticket of [...todoTickets, ...inprogressTickets, ...verifierTickets, ...doneTickets]) {
    if (!todoFilesById.has(ticket.name)) {
      todoFilesById.set(ticket.name, ticket);
    }
  }
  const todoFiles: WorkflowFileEntry[] = Array.from(todoFilesById.values()).sort(
    (a, b) => ticketNumericId(b.name) - ticketNumericId(a.name)
  );
  const prdPinTitle = `PRD (${prdSpecs.length}/${specFiles.length})`;
  const activeWorkCount = todoTickets.length + inprogressTickets.length + verifierTickets.length;
  const todoPinTitle = `WORK (${activeWorkCount}/${todoFiles.length})`;
  const hasWorkflowPins = Boolean(specFiles.length || todoFiles.length);
  const boardInitialized = board?.status?.initialized === "true";
  const boardMissing = Boolean(options?.projectRoot && board && !boardInitialized);

  const hasHeader = Boolean(hasWorkflowPins);

  return (
    <PageLayout
      header={
        hasHeader ? (
          <div className="workflow-pin-strip" aria-label="작업 흐름 요약">
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
                <WorkflowPinLayer
                  files={todoFiles}
                  options={options}
                  pinTitle={todoPinTitle}
                  pinIcon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                  variant="default"
                  layerHeading={todoPinTitle}
                  emptyText="아직 발급된 work item이 없습니다."
                  showWhenEmpty
                />
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
            <>
              {plannerRunners.map(renderProgressRow)}
              {workerRunners.map(renderProgressRow)}
              {hasVerifierRunner ? (
                verifierRunners.map(renderProgressRow)
              ) : (
                <article
                  className="ai-progress-row ai-progress-row-placeholder ai-progress-row-placeholder-verifier"
                  data-runner-role="verifier"
                  data-runner-id="verifier"
                  aria-label="Verifier 자리 (대기 중)"
                >
                  <div className="ai-progress-row-placeholder-body">
                    <strong>Verifier</strong>
                    <span>config.local.toml에 verifier 블록을 추가하면 활성화됩니다.</span>
                  </div>
                </article>
              )}
              {wikiRunners.map(renderProgressRow)}
              {otherRunners.map(renderProgressRow)}
            </>
        ) : (
          <div className="ai-progress-empty">
            <span>설정된 러너가 없습니다.</span>
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

  const tokens = Math.max(
    typeof runner.tokenUsage === "number" ? runner.tokenUsage : 0,
    typeof runner.cumulativeTokens === "number" ? runner.cumulativeTokens : 0
  );
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
const LIVE_TERMINAL_FONT_SIZE = 10;

// PRD-225 (2026-05-09): xterm theme 을 라이트/다크 카드 톤에 정렬한다.
// LOG_TOKEN_ANSI 는 ANSI palette index (\x1b[36m = cyan 등) 만 쓰므로 같은
// escape 가 palette 에 따라 색이 달라진다. 라이트 팔레트는 ansiConverter
// (line ~3515) 의 colors map 톤을 차용해 ConversationStream 시리즈와 시각
// 일관성을 맞췄고, 다크 팔레트는 기존 vibe-terminal 톤을 유지한다.
const LIVE_TERMINAL_THEME_LIGHT = {
  background: "#F3F6FA",
  foreground: "#111827",
  cursor: "#2563EB",
  cursorAccent: "#F3F6FA",
  selectionBackground: "rgba(37, 99, 235, 0.20)",
  selectionInactiveBackground: "rgba(37, 99, 235, 0.10)",
  scrollbarSliderBackground: "rgba(30, 64, 175, 0.18)",
  scrollbarSliderHoverBackground: "rgba(30, 64, 175, 0.28)",
  scrollbarSliderActiveBackground: "rgba(30, 64, 175, 0.38)",
  overviewRulerBorder: "#F3F6FA",
  black: "#111827",
  red: "#B42318",
  green: "#047857",
  yellow: "#B45309",
  blue: "#1D4ED8",
  magenta: "#7C3AED",
  cyan: "#0369A1",
  white: "#64748B",
  brightBlack: "#334155",
  brightRed: "#DC2626",
  brightGreen: "#059669",
  brightYellow: "#C2410C",
  brightBlue: "#2563EB",
  brightMagenta: "#9333EA",
  brightCyan: "#0284C7",
  brightWhite: "#0F172A"
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

function liveTerminalReadabilityFor(mode: "light" | "dark") {
  return {
    fontWeight: mode === "light" ? "500" : "400",
    fontWeightBold: "700",
    minimumContrastRatio: mode === "light" ? 4.5 : 1
  } as const;
}

function applyLiveTerminalAppearance(terminal: XTermTerminal, mode: "light" | "dark") {
  const readability = liveTerminalReadabilityFor(mode);
  terminal.options.theme = { ...liveTerminalThemeFor(mode) };
  terminal.options.fontWeight = readability.fontWeight;
  terminal.options.fontWeightBold = readability.fontWeightBold;
  terminal.options.minimumContrastRatio = readability.minimumContrastRatio;
}

function normalizeLiveTerminalProjectRoot(value: string) {
  return String(value || "").replace(/[\\/]+$/, "");
}

function livePtyPayloadMatchesScope(payload: any, projectRoot: string, boardDirName: string) {
  const expectedProjectRoot = normalizeLiveTerminalProjectRoot(projectRoot);
  if (!expectedProjectRoot) return true;
  const payloadProjectRoot = normalizeLiveTerminalProjectRoot(String(payload?.projectRoot || ""));
  if (!payloadProjectRoot || payloadProjectRoot !== expectedProjectRoot) return false;
  return String(payload?.boardDirName || ".autoflow") === String(boardDirName || ".autoflow");
}

function stripLivePtyControlSequences(text: string) {
  return String(text || "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[>=][0-9;?]*/g, "");
}

function livePtySnapshotLooksBusy(snapshot: string) {
  const clean = stripLivePtyControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(/\u001b/g, "");
  const compactTail = clean
    .split(/\n/)
    .slice(-24)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  if (!compactTail) return false;
  if (/\b(Working|Running command|Waiting for background terminal|Thinking|Compacting|Booting MCP server)\b/i.test(compactTail)) return true;
  if (/Hooks need review/i.test(compactTail)) return true;
  if (/(Trust\s*all\s*and\s*continue|Continue\s*without\s*trusting|hooks\s*won'?t\s*run)/i.test(compactTail)) return true;
  return false;
}

function useLivePtyActivity(runner: AutoflowRunner, options?: WorkflowBoardOptions) {
  const projectRoot = options?.projectRoot || "";
  const boardDirName = options?.boardDirName || ".autoflow";
  const runnerId = runner.id;
  const runnerStatus = runner.stateStatus || "";
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const isRunning = runnerStatus.toLowerCase() === "running" && Boolean(runner.pid);
    if (!isRunning || !runnerId || !projectRoot) {
      setBusy(false);
      return;
    }

    let cancelled = false;
    let tail = "";
    const updateBusy = () => {
      if (!cancelled) {
        setBusy(livePtySnapshotLooksBusy(tail));
      }
    };

    window.autoflow
      .runnerPtySnapshot({ runnerId, projectRoot, boardDirName })
      .then((result) => {
        if (cancelled) return;
        tail = String(result?.snapshot || "").slice(-6000);
        updateBusy();
      })
      .catch(() => {
        if (!cancelled) setBusy(false);
      });

    const offBytes = (window.autoflow as any).onRunnerPtyBytes?.((payload: any) => {
      if (!payload || String(payload.runnerId || "") !== runnerId) return;
      if (!livePtyPayloadMatchesScope(payload, projectRoot, boardDirName)) return;
      tail = `${tail}${String(payload.data || "")}`.slice(-6000);
      updateBusy();
    }) || (() => {});
    const offStatus = (window.autoflow as any).onRunnerPtyStatus?.((payload: any) => {
      if (!payload || String(payload.runnerId || "") !== runnerId) return;
      if (!livePtyPayloadMatchesScope(payload, projectRoot, boardDirName)) return;
      const nextStatus = String(payload.status || "").toLowerCase();
      if (runnerPtyStatusIsInactive(nextStatus)) {
        tail = "";
        setBusy(false);
      }
    }) || (() => {});

    return () => {
      cancelled = true;
      offBytes();
      offStatus();
    };
  }, [boardDirName, projectRoot, runner.pid, runnerId, runnerStatus]);

  return { busy };
}

// vibe-terminal appendOutput 패턴: PTY 는 작은 chunk 가 실시간 도착하므로
// 자연스럽게 타이핑처럼 보임. 우리는 1초 polling 으로 큰 diff 가 한 번에
// 오므로, 8자씩 16ms 간격 drip 으로 같은 느낌을 시뮬레이션한다.
const TYPEWRITER_CHARS_PER_TICK = 8;
const TYPEWRITER_INTERVAL_MS = 16;

const RUNNER_RATE_LIMIT_QUOTA_KEYWORD_PATTERN =
  /\b(?:rate limit|too many requests|429)\b/i;
const RUNNER_QUOTA_EXHAUSTED_KEYWORD_PATTERN =
  /\b(?:usage limit|quota exceeded|resource_exhausted|model_capacity_exhausted)\b/i;

function extractRunnerQuotaRetryAfter(text: string): string {
  const tryAgainMatch = text.match(/try again at\s+([^\n.]+)/i);
  if (tryAgainMatch?.[1]) return tryAgainMatch[1].trim();
  const resetMatch = text.match(/quota[\s\S]{0,80}?reset[\s\S]{0,40}?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/i);
  return resetMatch?.[1]?.trim() || "";
}

type RunnerQuotaToastSignal = {
  kind: "rate_limit" | "quota_exhausted";
  fingerprint: string;
  retryAfter: string;
};

function runnerQuotaToastSignal(runner: AutoflowRunner | undefined, text: string): RunnerQuotaToastSignal | null {
  if (!runner) return null;
  const lastResult = (runner.lastResult || "").toLowerCase();
  const hasLastResultSignal = lastResult === "quota_limited";
  const hasRateLimitStdoutSignal = RUNNER_RATE_LIMIT_QUOTA_KEYWORD_PATTERN.test(text);
  const hasQuotaExhaustedStdoutSignal = RUNNER_QUOTA_EXHAUSTED_KEYWORD_PATTERN.test(text);

  if (!hasLastResultSignal && !hasRateLimitStdoutSignal && !hasQuotaExhaustedStdoutSignal) return null;

  const kind: RunnerQuotaToastSignal["kind"] = hasRateLimitStdoutSignal
    ? "rate_limit"
    : hasQuotaExhaustedStdoutSignal
      ? "quota_exhausted"
      : "quota_exhausted";

  return {
    kind,
    fingerprint: `quota:${runner.id}:${kind}`,
    retryAfter: extractRunnerQuotaRetryAfter(text)
  };
}

// Direct PTY byte stream → xterm. No file polling, no JSON summarization.
// Subscribes to main-process IPC channel and writes raw bytes (with ANSI
// escape codes) straight into xterm — same as vibe-terminal.
function LivePtyView({
  runnerId,
  projectRoot,
  boardDirName,
  ariaLabel,
  clearOnStopped = true,
  runnerStatus = ""
}: {
  runnerId: string;
  projectRoot: string;
  boardDirName: string;
  ariaLabel: string;
  clearOnStopped?: boolean;
  runnerStatus?: string;
}) {
  const LIVE_TERMINAL_SCROLLBAR_WIDTH_PX = 4;
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const terminalRef = React.useRef<XTermTerminal | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const fitTimerRef = React.useRef<number | null>(null);
  const fitRafRef = React.useRef<number | null>(null);
  const pendingChunksRef = React.useRef<string[]>([]);
  const flushRafRef = React.useRef<number | null>(null);
  const [terminalThemeMode, setTerminalThemeMode] = React.useState<
    "light" | "dark"
  >(() => readDocumentThemeMode());
  const resetTerminal = React.useCallback(() => {
    if (flushRafRef.current !== null) {
      window.cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    pendingChunksRef.current = [];
    try { terminalRef.current?.reset(); } catch {}
  }, []);
  const syncPtyColsWithTerminal = React.useCallback(() => {
    if (!runnerId) return;
    const term = terminalRef.current;
    if (!term || term.cols <= 0 || term.rows <= 0) return;
    const resizeFn = (window.autoflow as any).runnerPtyResize;
    if (typeof resizeFn !== "function") return;
    void resizeFn({
      runnerId,
      projectRoot,
      boardDirName,
      cols: term.cols,
      rows: term.rows
    });
  }, [boardDirName, projectRoot, runnerId]);
  const fitAndResize = React.useCallback(() => {
    const host = hostRef.current;
    const fit = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!host || !fit || !terminal) return;
    const prevPaddingRight = host.style.paddingRight;
    host.style.paddingRight = `${LIVE_TERMINAL_SCROLLBAR_WIDTH_PX}px`;
    try {
      fit.fit();
      syncPtyColsWithTerminal();
    } finally {
      host.style.paddingRight = prevPaddingRight;
    }
  }, [syncPtyColsWithTerminal]);
  const scheduleFitAndResize = React.useCallback((delayMs = LIVE_TERMINAL_FIT_DEBOUNCE_MS) => {
    if (fitTimerRef.current !== null) {
      window.clearTimeout(fitTimerRef.current);
    }
    if (fitRafRef.current !== null) {
      window.cancelAnimationFrame(fitRafRef.current);
      fitRafRef.current = null;
    }
    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = null;
      fitRafRef.current = window.requestAnimationFrame(() => {
        fitRafRef.current = null;
        try { fitAndResize(); } catch {}
      });
    }, delayMs);
  }, [fitAndResize]);

  // Mount xterm once.
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || terminalRef.current) return;
    const terminal = new XTermTerminal({
      cursorBlink: false,
      cursorStyle: "bar",
      cursorInactiveStyle: "none",
      convertEol: false,
      disableStdin: true,
      allowProposedApi: false,
      fontFamily: LIVE_TERMINAL_FONT_FAMILY,
      fontSize: LIVE_TERMINAL_FONT_SIZE,
      lineHeight: 1.2,
      ...liveTerminalReadabilityFor(terminalThemeMode),
      rescaleOverlappingGlyphs: false,
      scrollback: LIVE_TERMINAL_SCROLLBACK,
      theme: liveTerminalThemeFor(terminalThemeMode)
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host);
    terminalRef.current = terminal;
    fitAddonRef.current = fit;
    fitAndResize();
    const postMountFitTimers = [0, 80, 220, 500].map((delayMs) => window.setTimeout(() => {
      scheduleFitAndResize(0);
    }, delayMs));
    return () => {
      postMountFitTimers.forEach((timer) => window.clearTimeout(timer));
      if (fitTimerRef.current !== null) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
      if (fitRafRef.current !== null) {
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
      try { terminal.dispose(); } catch {}
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
    // Theme handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardDirName, fitAndResize, projectRoot, runnerId]);

  // Theme observer (light/dark swap on data-theme change)
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
    const terminal = terminalRef.current;
    if (!terminal) return;
    applyLiveTerminalAppearance(terminal, terminalThemeMode);
  }, [terminalThemeMode]);

  // Resize on host element changes (debounced fit).
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => scheduleFitAndResize());
    observer.observe(host);
    return () => {
      observer.disconnect();
      if (fitTimerRef.current !== null) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
      if (fitRafRef.current !== null) {
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
    };
  }, [scheduleFitAndResize]);

  // Subscribe to PTY bytes for this runner. Buffer + RAF flush so multiple
  // chunks within a frame coalesce into a single xterm.write() call.
  React.useEffect(() => {
    if (!runnerId) return;
    let unsubscribe: undefined | (() => void);
    let cancelled = false;
    const inactive = runnerPtyStatusIsInactive(runnerStatus);

    if (clearOnStopped && inactive) {
      resetTerminal();
      return;
    }

    const flushPending = () => {
      flushRafRef.current = null;
      const term = terminalRef.current;
      const chunks = pendingChunksRef.current;
      if (!term || chunks.length === 0) return;
      const merged = chunks.join("");
      pendingChunksRef.current = [];
      try { term.write(merged); } catch {}
    };

    const writeChunk = (data: string) => {
      if (!data) return;
      pendingChunksRef.current.push(data);
      if (flushRafRef.current !== null) return;
      flushRafRef.current = window.requestAnimationFrame(flushPending);
    };

    // Replay buffered bytes from main on subscribe so the terminal shows
    // history when the renderer mounts mid-session.
    void (async () => {
      if (!runnerPtyStatusAllowsSnapshot(runnerStatus)) return;
      try {
        const res = await (window.autoflow as any).runnerPtySnapshot({
          runnerId,
          projectRoot,
          boardDirName
        });
        if (cancelled) return;
        if (res && typeof res.snapshot === "string" && res.snapshot) {
          writeChunk(res.snapshot);
        }
      } catch {}
    })();

    unsubscribe = (window.autoflow as any).onRunnerPtyBytes((payload: any) => {
      if (!payload || payload.runnerId !== runnerId) return;
      if (!livePtyPayloadMatchesScope(payload, projectRoot, boardDirName)) return;
      writeChunk(String(payload.data || ""));
    });

    return () => {
      cancelled = true;
      if (flushRafRef.current !== null) {
        window.cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      pendingChunksRef.current = [];
      try { unsubscribe?.(); } catch {}
      try { terminalRef.current?.reset(); } catch {}
    };
  }, [boardDirName, clearOnStopped, projectRoot, resetTerminal, runnerId, runnerStatus]);

  React.useEffect(() => {
    if (!clearOnStopped) return;
    if (runnerPtyStatusIsInactive(runnerStatus)) {
      resetTerminal();
    }
  }, [clearOnStopped, resetTerminal, runnerStatus]);

  React.useEffect(() => {
    if (!clearOnStopped || !runnerId) return;
    const subscribeStatus = (window.autoflow as any).onRunnerPtyStatus;
    if (typeof subscribeStatus !== "function") return;
    const unsubscribe = subscribeStatus((payload: any) => {
      if (!payload || payload.runnerId !== runnerId) return;
      if (!livePtyPayloadMatchesScope(payload, projectRoot, boardDirName)) return;
      if (runnerPtyStatusIsInactive(String(payload.status || ""))) {
        resetTerminal();
      }
    });
    return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, [boardDirName, clearOnStopped, projectRoot, resetTerminal, runnerId]);

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

function runnerPtyStatusIsStopped(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "stopped" || normalized === "user_stopped" || normalized === "failed" || normalized === "errored";
}

function runnerPtyStatusIsInactive(status: string) {
  const normalized = status.toLowerCase();
  return !normalized || normalized === "idle" || runnerPtyStatusIsStopped(normalized);
}

function runnerPtyStatusAllowsSnapshot(status: string) {
  return status.toLowerCase() === "running";
}

const LIVE_TERMINAL_IDLE_STAGES = new Set(["todo", "idle"]);

function LiveTerminalView({
  text,
  ariaLabel,
  runner,
  agentLabel,
  stageKey
}: {
  text: string;
  ariaLabel: string;
  runner?: AutoflowRunner;
  agentLabel?: string;
  stageKey?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const terminalRef = React.useRef<XTermTerminal | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const fitTimerRef = React.useRef<number | null>(null);
  const fitRafRef = React.useRef<number | null>(null);
  const pendingChunksRef = React.useRef<string[]>([]);
  const flushRafRef = React.useRef<number | null>(null);
  const writtenLengthRef = React.useRef(0);
  // typewriter drip refs
  const typewriterQueueRef = React.useRef<string>("");
  const typewriterTimerRef = React.useRef<number | null>(null);
  const [terminalThemeMode, setTerminalThemeMode] = React.useState<
    "light" | "dark"
  >(() => readDocumentThemeMode());
  const [dismissedQuotaFingerprint, setDismissedQuotaFingerprint] = React.useState("");
  const quotaSignal = runnerQuotaToastSignal(runner, text);
  const showQuotaToast =
    Boolean(quotaSignal) && quotaSignal?.fingerprint !== dismissedQuotaFingerprint;
  const quotaAgentLabel = agentLabel || runner?.agent || runner?.id || "AI";
  const quotaToastTitle = quotaSignal?.kind === "rate_limit" ? "API 속도 제한" : "사용 한도 소진";
  const quotaToastBody =
    quotaSignal?.kind === "rate_limit"
      ? `일시적 제한입니다. 잠시 후 자동으로 재시도됩니다.${quotaSignal.retryAfter ? ` ${quotaSignal.retryAfter}에 재개 가능.` : ""}`
      : `${quotaAgentLabel} 한도가 소진됐습니다. 모델을 교체하거나 한도 회복을 기다려주세요.`;

  // PRD-225: <html data-theme="..."> 변화를 구독해 xterm theme 도 즉시 swap.
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
    const initialThemeMode = readDocumentThemeMode();
    const terminal = new XTermTerminal({
      cursorBlink: false,
      cursorStyle: "bar",
      cursorInactiveStyle: "none",
      convertEol: true,
      disableStdin: true,
      allowProposedApi: false,
      fontFamily: LIVE_TERMINAL_FONT_FAMILY,
      fontSize: LIVE_TERMINAL_FONT_SIZE,
      lineHeight: 1.2,
      ...liveTerminalReadabilityFor(initialThemeMode),
      rescaleOverlappingGlyphs: false,
      scrollback: LIVE_TERMINAL_SCROLLBACK,
      overviewRuler: { width: 1 },
      theme: { ...liveTerminalThemeFor(initialThemeMode) }
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
      if (typewriterTimerRef.current !== null) {
        window.clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      typewriterQueueRef.current = "";
      pendingChunksRef.current = [];
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      writtenLengthRef.current = 0;
    };
  }, []);

  // PRD-225: themeMode 가 바뀌면 이미 mount 된 xterm 의 theme 만 swap.
  // xterm Terminal#options.theme setter 가 palette 를 즉시 반영한다.
  React.useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    applyLiveTerminalAppearance(terminal, terminalThemeMode);
  }, [terminalThemeMode]);

  // vibe-terminal pattern: 새 chunk 를 pendingChunksRef 에 push 하고
  // requestAnimationFrame 으로 한 frame 안에 모인 chunk 를 한 번 write 한다.
  // typewriter drip 제거 — 60FPS RAF 가 자연스러운 streaming 느낌. drip 은
  // 인공 지연이라 오히려 stutter 만 만든다.
  React.useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const written = writtenLengthRef.current;
    // reset: 텍스트 축소(idle clear) 또는 내용 완전 교체
    if (text.length < written || (written > 0 && !text.startsWith(text.slice(0, written)))) {
      if (flushRafRef.current !== null) {
        window.cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
      pendingChunksRef.current = [];
      terminal.reset();
      writtenLengthRef.current = 0;
      if (!text) return;
      writtenLengthRef.current = text.length;
      try { terminal.write(colorizeLogChunk(text)); } catch { /* disposed */ }
      return;
    }
    // 증분 append: 새 chars 를 pendingChunks 에 push, RAF 로 batch flush
    if (text.length === written) return;
    const chunk = text.slice(written);
    writtenLengthRef.current = text.length;
    if (!chunk) return;
    pendingChunksRef.current.push(colorizeLogChunk(chunk));
    if (flushRafRef.current !== null) return; // 이미 frame 예약됨
    flushRafRef.current = window.requestAnimationFrame(() => {
      flushRafRef.current = null;
      const term = terminalRef.current;
      const chunks = pendingChunksRef.current;
      if (!term || chunks.length === 0) return;
      const merged = chunks.join("");
      pendingChunksRef.current = [];
      try { term.write(merged); } catch { /* disposed */ }
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
      {(() => {
        if (text) return null;
        const status = (runner?.stateStatus || "").toLowerCase();
        const isStopped = status === "stopped" || status === "user_stopped" || status === "failed";
        const stage = (stageKey || "").toLowerCase();
        const isIdle = LIVE_TERMINAL_IDLE_STAGES.has(stage) || !stage;
        let message: string;
        let tone: string;
        if (isStopped || isIdle) {
          return null;
        } else {
          message = "AI 응답 대기 중 입니다.";
          tone = "active";
        }
        return (
          <div
            className={`live-terminal-view-status-badge live-terminal-view-status-badge--${tone}${showQuotaToast ? " live-terminal-view-status-badge--above-quota" : ""}`}
            aria-hidden="true"
          >
            {message}
          </div>
        );
      })()}
      {showQuotaToast && quotaSignal ? (
        <div className="live-terminal-view-quota-toast" role="alert" aria-live="assertive">
          <TriangleAlert className="live-terminal-view-quota-toast-icon" aria-hidden="true" />
          <div className="live-terminal-view-quota-toast-copy">
            <strong>{quotaToastTitle}</strong>
            <span>
              {quotaToastBody}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="live-terminal-view-quota-toast-close"
            aria-label="토큰 한도 안내 닫기"
            onClick={() => setDismissedQuotaFingerprint(quotaSignal.fingerprint)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
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

function summarizeCodexJsonLine(line: string): string {
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

  if (type === "item.completed") {
    const item = obj.item && typeof obj.item === "object" ? (obj.item as Record<string, unknown>) : {};
    const itemType = String(item.type || "");
    if (itemType === "agent_message") {
      return typeof item.text === "string" ? item.text : "";
    }
    if (itemType === "command_execution") {
      const cmd = previewText(item.command, 60);
      const out = previewText(item.aggregated_output, 80);
      if (out) return `[result] ${out}`;
      return `[tool] ${cmd}`.trim();
    }
    if (itemType === "local_shell_call") {
      const cmd = previewText(item.command, 60);
      return `[tool] ${cmd}`.trim();
    }
    if (itemType === "local_shell_call_output") {
      const out = previewText(item.output, 80);
      return `[result] ${out}`.trim();
    }
    return "";
  }

  if (type === "item.started") {
    const item = obj.item && typeof obj.item === "object" ? (obj.item as Record<string, unknown>) : {};
    const itemType = String(item.type || "");
    if (itemType === "command_execution" || itemType === "local_shell_call") {
      const cmd = previewText(item.command, 60);
      return `[tool] ${cmd}`.trim();
    }
    return "";
  }

  if (type === "turn.completed") {
    return "[done]";
  }

  return "";
}

function summarizeCodexJsonLines(content: string): string {
  if (!content.trim()) return "";
  const lines = content
    .split(/\r?\n/)
    .map(summarizeCodexJsonLine)
    .filter(Boolean);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function detectAndSummarizeJsonLines(content: string): string {
  const firstLine = content.trimStart().slice(0, 200);
  if (firstLine.includes('"thread.started"') || firstLine.includes('"turn.started"') || firstLine.includes('"item.')) {
    return summarizeCodexJsonLines(content) || content;
  }
  return summarizeClaudeJsonLines(content) || content;
}

function useLiveStdoutText(
  runner: AutoflowRunner,
  options?: WorkflowBoardOptions,
  maxBytes = 16 * 1024
): string {
  const projectRoot = options?.projectRoot || "";
  const boardDirName = options?.boardDirName || "";
  const activeStdoutPath =
    runner.lastStdoutLog && /_live_stdout\.log$/.test(runner.lastStdoutLog)
      ? runner.lastStdoutLog
      : "";

  const [text, setText] = React.useState("");

  React.useEffect(() => {
    if (!activeStdoutPath || !projectRoot || !boardDirName) {
      setText("");
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const fetchOnce = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await window.autoflow.tailBoardFile({
          projectRoot,
          boardDirName,
          filePath: activeStdoutPath,
          maxBytes
        });
        if (cancelled) return;
        const raw = result.ok ? result.content || "" : "";
        setText(raw);
      } catch {
        // best-effort polling — swallow read errors
      } finally {
        inFlight = false;
      }
    };
    void fetchOnce();
    const handle = window.setInterval(fetchOnce, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [activeStdoutPath, projectRoot, boardDirName, maxBytes]);

  return text;
}

function useRunnerResourceUsage(running: boolean, pid: string): AutoflowRunnerResourceUsage | null {
  const [usage, setUsage] = React.useState<AutoflowRunnerResourceUsage | null>(null);

  React.useEffect(() => {
    if (!running || !pid) {
      setUsage(null);
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const fetchUsage = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const nextUsage = await window.autoflow.runnerResourceUsage({ pid });
        if (!cancelled) {
          setUsage(nextUsage?.ok ? nextUsage : null);
        }
      } catch {
        if (!cancelled) setUsage(null);
      } finally {
        inFlight = false;
      }
    };
    void fetchUsage();
    const handle = window.setInterval(fetchUsage, RUNNER_RESOURCE_USAGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [pid, running]);

  return usage;
}

function formatResourcePercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatResourceMemory(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1024) return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)}GB`;
  return `${value.toFixed(value >= 100 ? 0 : 1)}MB`;
}

function RunnerResourceUsage({ running, pid }: { running: boolean; pid: string }) {
  const usage = useRunnerResourceUsage(running, pid);
  const measuredUsage = usage?.ok ? usage : null;
  const cpuLabel = formatResourcePercent(measuredUsage?.cpuPercent);
  const memoryLabel = formatResourceMemory(measuredUsage?.rssMb);
  const title = !running
    ? "러너 정지됨 · CPU - · 메모리 -"
    : measuredUsage
    ? `러너 실행 중 · CPU ${cpuLabel} · 메모리 ${memoryLabel} · 프로세스 ${measuredUsage.processCount}`
    : "러너 실행 중 · 부하 측정 중";
  const segments = [
    ["CPU", cpuLabel],
    ["메모리", memoryLabel]
  ];

  return (
    <span
      className="runner-resource-usage"
      data-running={running ? "true" : "false"}
      data-loading={running && !usage?.ok ? "true" : "false"}
      aria-label={title}
      title={title}
    >
      {segments.map(([label, value]) => (
        <span className="ai-conversation-panel-activity-metric runner-resource-usage-segment" key={label}>
          <span className="ai-conversation-panel-activity-label runner-resource-usage-label">{label}</span>
          <strong className="ai-conversation-panel-activity-value runner-resource-usage-value">{value}</strong>
        </span>
      ))}
    </span>
  );
}

function RunnerActivityFooter({ runner }: { runner: AutoflowRunner }) {
  const activity = useRunnerActivity(runner);
  const animatedTokens = useCountUp(activity.tokens);
  const rawCacheReadTokens = typeof runner.cumulativeCacheReadTokens === "number" ? runner.cumulativeCacheReadTokens : 0;
  const cacheReadTokens = rawCacheReadTokens;
  const llmRequestCount = Math.max(
    typeof runner.cumulativeLlmRequestCount === "number" ? runner.cumulativeLlmRequestCount : 0,
    typeof runner.lastTurnLlmRequestCount === "number" ? runner.lastTurnLlmRequestCount : 0
  );
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  const isRunning = stateStatus === "running" && Boolean(runner.pid);
  const pidLabel = isRunning ? `PID ${runner.pid}` : "";
  const pidValue = isRunning ? String(runner.pid) : "";
  const tokenTitle = cacheReadTokens > 0
    ? `토큰 ${activity.tokens.toLocaleString()} · LLM 요청 ${llmRequestCount.toLocaleString()} · 캐시 읽기 ${cacheReadTokens.toLocaleString()}`
    : `토큰 ${activity.tokens.toLocaleString()} · LLM 요청 ${llmRequestCount.toLocaleString()}`;
  const footerTitle = pidLabel ? `${tokenTitle} · ${pidLabel}` : tokenTitle;
  return (
    <footer
      className="ai-conversation-panel-activity"
      data-running={isRunning ? "true" : "false"}
      aria-live="polite"
      title={footerTitle}
    >
      <div className="ai-conversation-panel-activity-row ai-conversation-panel-activity-row-inline">
        <span className="ai-conversation-panel-activity-band ai-conversation-panel-activity-band-primary">
          <span className="ai-conversation-panel-activity-metric">
            <span className="ai-conversation-panel-activity-label">토큰</span>
            <strong className="ai-conversation-panel-activity-value">{animatedTokens.toLocaleString()}</strong>
          </span>
          <span className="ai-conversation-panel-activity-metric ai-conversation-panel-activity-metric-end">
            <span className="ai-conversation-panel-activity-label">LLM 요청</span>
            <strong className="ai-conversation-panel-activity-value">{llmRequestCount.toLocaleString()}</strong>
          </span>
          <span className="ai-conversation-panel-activity-metric ai-conversation-panel-activity-metric-end">
            <span className="ai-conversation-panel-activity-label">캐시</span>
            <strong className="ai-conversation-panel-activity-value">{cacheReadTokens.toLocaleString()}</strong>
          </span>
        </span>
        <span className="ai-conversation-panel-activity-band ai-conversation-panel-activity-band-hardware">
          <RunnerResourceUsage running={isRunning} pid={runner.pid} />
          {pidValue ? (
            <span className="ai-conversation-panel-activity-metric ai-conversation-panel-activity-metric-end ai-conversation-panel-activity-pid">
              <span className="ai-conversation-panel-activity-label">PID</span>
              <strong className="ai-conversation-panel-activity-value">{pidValue}</strong>
            </span>
          ) : null}
        </span>
      </div>
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

function stageIsTerminal(key: string, stages: readonly FlowStageDef[]): boolean {
  const last = stages[stages.length - 1];
  return Boolean(last && last.key === key);
}

function flowStepState(
  stepKey: string,
  currentKey: string,
  stages: readonly FlowStageDef[] = workerFlowStages
) {
  const terminalKeys = new Set(["reject", "blocked", "done", "failed"]);
  if (terminalKeys.has(currentKey)) {
    if (terminalKeys.has(stepKey) || stageIsTerminal(stepKey, stages)) {
      return "active";
    }

    return "complete";
  }

  const currentIndex = stages.findIndex((stage) => stage.key === currentKey);
  const stepIndex = stages.findIndex((stage) => stage.key === stepKey);
  if (currentIndex < 0) {
    return "complete";
  }

  if (terminalKeys.has(stepKey) || stepIndex > currentIndex) {
    return "idle";
  }

  return stepIndex === currentIndex ? "active" : "complete";
}

function flowStagesForRunner(runner: AutoflowRunner): readonly FlowStageDef[] {
  const role = displayRoleKeyForRunner(runner) || runnerCurrentRoleValue(runner);
  if (role.includes("wiki")) return wikiBotFlowStages;
  if (role === "planner" || role === "plan") return plannerFlowStages;
  return workerFlowStages;
}

function runnerStageKey(runner: AutoflowRunner): string {
  const status = (runner.stateStatus || "").toLowerCase();
  const role = displayRoleKeyForRunner(runner) || runnerCurrentRoleValue(runner);
  const activeStage = (runner.activeStage || "").toLowerCase();
  const runnerActiveTicket = runnerHasActiveWorkContext(runner);
  const stateSignalText = [
    runner.activeItem,
    runner.lastResult,
    runner.lastLogLine
  ]
    .join(" ")
    .toLowerCase();
  const cycleResult = runnerCycleResult(runner);

  // 종료 신호(done/blocked/failed/reject)는 slider의 단계가 아니라 별도 사이드 배지로 표시한다.
  if (cycleResult) {
    return "idle";
  }

  // stopped runner has no live work — slider should reflect idle, not the
  // last cycle's done/failure pattern stuck in lastResult/lastLogLine.
  if (status === "stopped" || status === "user_stopped") {
    if (role.includes("wiki")) return "idle";
    if (role === "planner" || role === "plan") return "idle";
    return "idle";
  }
  const stateText = [stateSignalText, runner.conversationPreview].join(" ").toLowerCase();
  const hasWorkerIdleSignal = /\b(ticket_inputs_unchanged|no_actionable_ticket)\b/.test(stateText);
  const hasCompletionFinalizerCommit = /\bcommitted_via_completion_finalizer\b/.test(stateText);
  const isFailLike =
    status === "failed" ||
    /^(rejected|reject|fail|failed|error|adapter_exit_[1-9])$/.test(activeStage) ||
    /\bfailed\b|\berror\b|adapter_exit_[1-9]/.test(stateSignalText);

  if (role.includes("wiki")) {
    if (runner.backgroundTask) return "syncing";
    if (isFailLike) return "idle";
    if (status === "running" && (runnerActiveTicket || /event=adapter_start|\bstatus=running\b/.test(stateText))) return "syncing";
    if (/event=adapter_finish.*status=ok|\bwiki_(?:updated|sync_ok)\b/.test(stateText)) return "syncing";
    return "idle";
  }

  if (role === "planner" || role === "plan") {
    const hasPlannerIdleSignal =
      /\bno_actionable_plan_input\b|\bidle_wait_for_order_or_prd\b|\bruntime_status=idle\b|\bstatus=idle\b/.test(stateText);
    if (isFailLike) return "blocked";
    if (hasPlannerIdleSignal && !runnerActiveTicket && !runner.activeItem) return "idle";
    if (/\bsource=prd-to-todo\b|\btodo_ticket=/.test(stateText)) return "generating-todo";
    if (status === "running" && (runnerActiveTicket || /\bevent=adapter_start\b/.test(stateText))) return "planning";
    if (runnerActiveTicket) return "generating-todo";
    return "idle";
  }

  if (isFailLike) return "reject";

  // worker idle signal must beat the generic adapter_finish=ok heuristic —
  // an idle tick that found no todo also emits adapter_finish status=ok.
  if (hasWorkerIdleSignal && !runnerActiveTicket) return "idle";

  if (hasCompletionFinalizerCommit) return "done";

  if (runnerActiveTicket) {
    if (/^(merging)$/.test(activeStage)) return "merging";
    if (/^(executing|claimed|inprogress|review|merging)$/.test(activeStage)) {
      return "inprogress";
    }
    return "inprogress";
  }

  if (hasWorkerIdleSignal) return "idle";

  if (runnerActiveTicket && /\bdone\b|\bpass\b|\bcomplete\b/.test(stateText)) return "done";

  return "idle";
}

function runnerLivePtyBusyStageKey(runner: AutoflowRunner) {
  const role = displayRoleKeyForRunner(runner) || runnerCurrentRoleValue(runner);
  if (role.includes("wiki")) return "syncing";
  if (role === "planner" || role === "plan") return "planning";
  return "inprogress";
}

function runnerHasActiveWorkContext(runner: AutoflowRunner) {
  const activeStage = (runner.activeStage || "").toLowerCase();
  const activeStageCarriesWork =
    /^(planning|generating-todo|claimed|executing|inprogress|verifying|verify_pending|verifier_pending|merging|revision_requested|replan_requested|blocked)$/.test(activeStage);
  const hasOpenAssignment = runnerHasOpenAssignment(runner);
  return Boolean(
    runner.activeItem ||
    runner.activeTicketTitle ||
    runner.activeSpecRef ||
    (hasOpenAssignment && (runner.activeTicketId || runner.activeTicketPath || runner.assignedItemRef)) ||
    activeStageCarriesWork
  );
}

function runnerSuccessSignalIsStale(runner: AutoflowRunner, value: string) {
  if (runnerHasActiveWorkContext(runner)) return false;
  return /(done|pass|complete|completed|committed_via_completion_finalizer|verifier_pass|verifier_passed|needs_ai_merge)/i.test(value || "");
}

function runnerCycleResult(runner: AutoflowRunner): "done" | "blocked" | "reject" | "" {
  const status = (runner.stateStatus || "").toLowerCase();
  const activeStage = (runner.activeStage || "").toLowerCase();
  const lastResult = (runner.lastResult || "").toLowerCase();
  const stateSignalText = [
    runner.activeItem,
    lastResult,
    runner.lastLogLine
  ].join(" ").toLowerCase();

  if (/\bfailed\b|\bfail\b|\badapter_exit_[1-9]\b|\berror\b/.test(stateSignalText) || status === "failed") {
    return "reject";
  }

  if (/\bblocked\b|\bneeds_user\b/.test(stateSignalText) || status === "blocked") {
    return "blocked";
  }

  if (
    runnerHasActiveWorkContext(runner) &&
    /\bdone\b|\bpass\b|\bcomplete\b|\bcompleted\b|\bcommitted_via_completion_finalizer\b/.test(stateSignalText)
  ) {
    return "done";
  }

  if (/\b(reject|rejected)\b/.test(stateSignalText) || /\b(rejected|reject)\b/.test(activeStage)) {
    return "reject";
  }

  return "";
}

function runnerHandoffResultIsInternal(value: string) {
  return /_handoff_turn_requested$/i.test(value || "");
}

function runnerQueueStatusText(runner: AutoflowRunner) {
  return compactStatusParts([runner.queueStatusLabel || "", runner.queueStatusDetail || ""]).join(" · ");
}

function runnerProgressDetail(runner: AutoflowRunner) {
  // Blocker classification strings (e.g. "dirty_root") are no longer surfaced —
  // single-flow fail handling resurfaces every blocker through verifier replan,
  // so users only need the active title.
  if (runner.backgroundTaskLabel) {
    return runner.backgroundTaskLabel;
  }

  if (runner.activeTicketTitle) {
    return runner.activeTicketTitle;
  }

  if (runner.activeItem) {
    return displayActiveItemLabel(runner.activeItem);
  }

  if (runnerHasAssignmentAwaitingStart(runner)) {
    const assignedLabel = displayActiveItemLabel(runner.assignedItemRef || runner.activeTicketPath || "");
    return assignedLabel || "러너 시작 필요";
  }

  const statusLower = (runner.stateStatus || "").toLowerCase();
  const lastResultLower = (runner.lastResult || "").toLowerCase();

  if (lastResultLower === "adapter_auth_required") {
    return runnerLoginMessage(runner);
  }

  const queueStatusText = runnerQueueStatusText(runner);

  if (statusLower === "running" && lastResultLower === "runner_start_requested") {
    if (queueStatusText) {
      return queueStatusText;
    }
    return "다음 작업 확인 중";
  }

  if (runnerHandoffResultIsInternal(lastResultLower) && queueStatusText) {
    return queueStatusText;
  }

  if (runner.lastResult && !runnerSuccessSignalIsStale(runner, runner.lastResult)) {
    return displayStatus(runner.lastResult);
  }

  if (runner.lastLogLine && !runnerSuccessSignalIsStale(runner, runner.lastLogLine)) {
    return runner.lastLogLine;
  }

  if (runnerIsEnabled(runner.enabled) && statusLower === "running") {
    if (queueStatusText) {
      return queueStatusText;
    }
    return "대기 중 — 다음 작업 확인 대기";
  }

  return runnerIsEnabled(runner.enabled) ? "대기 중 — 처리할 티켓 없음" : "중지됨";
}

type RunnerStatusTone = "idle" | "running" | "stopped" | "blocked" | "done" | "error" | "auth" | "pending";

function stageStatusLabel(stageKey: string, stageLabel: string | undefined, role: string) {
  const normalizedRole = role.toLowerCase();
  if (stageKey === "idle") return "대기 중";
  if (stageKey === "planning") return "계획 중";
  if (stageKey === "generating-todo") return "티켓 생성 중";
  if (stageKey === "inprogress") return normalizedRole === "verifier" ? "검증 중" : "구현 중";
  if (stageKey === "merging") return "Worker 마무리 중";
  if (stageKey === "syncing") return "위키 작성 중";
  if (!stageLabel) return "실행 중";
  return stageLabel.endsWith("중") ? stageLabel : `${stageLabel} 중`;
}

function compactStatusParts(parts: Array<string | false | null | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index);
}

function idleStatusDetailText(value: string) {
  return (value || "").replace(/^대기\s*중(?:\s*[—–-]\s*)?/u, "").trim();
}

function runnerDetailLooksLikeEmptyQueue(runner: AutoflowRunner, detailText: string) {
  const text = [
    runner.queueStatus,
    runner.queueStatusLabel,
    runner.queueStatusDetail,
    detailText
  ].join(" ");
  return (
    (runner.queueStatus || "").toLowerCase() === "none" ||
    /처리할 작업 없음|대기열 비어 있음|변경 없음/.test(text)
  );
}

function runnerStatusSummaryTitle(runner: AutoflowRunner, label: string, detail: string, currentKey: string) {
  void currentKey;
  return compactStatusParts([
    detail ? `${label} · ${detail}` : label,
    runnerHasActiveWorkContext(runner) && runner.activeTicketId ? `작업=${displayActiveTicketBadge(runner.activeTicketId)}` : "",
    runner.lastResult && !runnerHandoffResultIsInternal(runner.lastResult) && !runnerSuccessSignalIsStale(runner, runner.lastResult)
      ? `최근 결과=${displayStatus(runner.lastResult)}`
      : ""
  ]).join("\n");
}

function runnerStatusSummary({
  runner,
  status,
  statusLower,
  currentKey,
  stageLabel,
  role,
  isBlocked,
  cycleResult,
  activeTicketLabel,
  detailText,
  transitionLabel,
  isApplyingConfig,
  showAuthPrompt,
  livePtyBusy
}: {
  runner: AutoflowRunner;
  status: string;
  statusLower: string;
  currentKey: string;
  stageLabel?: string;
  role: string;
  isBlocked: boolean;
  cycleResult: "done" | "blocked" | "reject" | "";
  activeTicketLabel: string;
  detailText: string;
  transitionLabel: string;
  isApplyingConfig: boolean;
  showAuthPrompt: boolean;
  livePtyBusy: boolean;
}) {
  let label = displayStatus(status);
  let tone: RunnerStatusTone = "idle";
  let detailParts: string[] = [];

  if (showAuthPrompt) {
    label = "인증 필요";
    tone = "auth";
    detailParts = compactStatusParts([runnerLoginMessage(runner)]);
  } else if (transitionLabel) {
    label = transitionLabel;
    tone = "pending";
    detailParts = compactStatusParts([activeTicketLabel]);
  } else if (isApplyingConfig) {
    label = "설정 적용 중";
    tone = "pending";
    detailParts = compactStatusParts([activeTicketLabel]);
  } else if (runner.backgroundTaskLabel) {
    label = runner.backgroundTaskLabel;
    tone = "running";
    detailParts = compactStatusParts([activeTicketLabel]);
  } else if (
    !runner.pid ||
    statusLower === "stopped" ||
    statusLower === "user_stopped"
  ) {
    label = "중지됨";
    tone = "stopped";
    detailParts = [];
  } else if (runnerHasAssignmentAwaitingStart(runner)) {
    label = "시작 필요";
    tone = "pending";
    detailParts = compactStatusParts([activeTicketLabel, detailText]);
  } else if (isBlocked || cycleResult === "blocked") {
    label = "막힘";
    tone = "blocked";
    detailParts = compactStatusParts([activeTicketLabel, detailText || "확인 필요"]);
  } else if (cycleResult === "reject") {
    label = "반려";
    tone = "error";
    detailParts = compactStatusParts([activeTicketLabel, detailText]);
  } else if (cycleResult === "done") {
    label = "완료";
    tone = "done";
    detailParts = compactStatusParts([activeTicketLabel, detailText]);
  } else if (statusLower === "running") {
    // running 이라도 실제로 처리 중인 ticket 이 없으면 "대기 중" 으로 표시.
    // sidecar 가 PTY 가 살아있다는 사실만으로 status=running 을 덮어쓸 수
    // 있어서, active_ticket_id 가 비어있는데 단계 라벨이 표시되는 모순을 막는다.
    const hasActiveTicket =
      Boolean(runner.activeTicketId && runner.activeTicketId.trim()) ||
      Boolean(runner.activeItem && runner.activeItem.trim());
    if (hasActiveTicket) {
      label = stageStatusLabel(currentKey, stageLabel, role);
      tone = "running";
      detailParts = compactStatusParts([
        activeTicketLabel,
        currentKey === "idle" ? idleStatusDetailText(detailText) : detailText
      ]);
    } else {
      label = "대기 중";
      tone = "idle";
      detailParts = compactStatusParts([idleStatusDetailText(detailText)]);
    }
  } else if (statusLower === "idle") {
    // idle 일 때는 실제로 처리 중 ticket 이 있을 때만 단계 라벨 유지.
    // active_stage 만 stale 로 남아있는 경우는 idle 로 본다 — "처리할 작업
    // 없음" 같은 detail 이 함께 표시되는데 단계 라벨이 보이는 모순을 막는다.
    const hasActiveTicket =
      Boolean(runner.activeTicketId && runner.activeTicketId.trim()) ||
      Boolean(runner.activeItem && runner.activeItem.trim());
    if (hasActiveTicket) {
      label = stageStatusLabel(currentKey, stageLabel, role);
      tone = "running";
      detailParts = compactStatusParts([activeTicketLabel, detailText]);
    } else {
      label = "대기 중";
      tone = "idle";
      detailParts = compactStatusParts([idleStatusDetailText(detailText)]);
    }
  } else if (statusLower === "failed" || statusLower === "error") {
    tone = "error";
    detailParts = compactStatusParts([activeTicketLabel, detailText]);
  } else {
    detailParts = compactStatusParts([activeTicketLabel, detailText]);
  }

  const detail = detailParts.join(" · ");
  return {
    label,
    detail,
    tone,
    title: runnerStatusSummaryTitle(runner, label, detail, currentKey)
  };
}

function timestampFromRunnerLog(value: string) {
  return value.match(/\btimestamp=([^\s]+)/)?.[1] || "";
}

function isMachineRunnerLog(value: string) {
  return Boolean(timestampFromRunnerLog(value)) && /^timestamp=\S+(\s+\w+=\S+)*$/.test(value.trim());
}

function canonicalWorkflowRunnerRole(value: string) {
  const normalized = (value || "").toLowerCase();
  if (normalized === "worker" || /^(worker|ai)-/.test(normalized)) return "worker";
  if (normalized === "planner" || /^(planner|plan)-/.test(normalized)) return "planner";
  if (normalized === "wiki" || /^(wiki-maintainer|wiki)-/.test(normalized)) return "wiki-maintainer";
  return "";
}

function startupRuleRoleForValue(value: string) {
  const normalized = (value || "").toLowerCase();
  if (normalized === "worker" || normalized === "ticket" || /^(worker|ai)-/.test(normalized)) return "worker";
  if (normalized === "planner" || normalized === "plan" || /^(planner|plan)-/.test(normalized)) return "planner";
  if (normalized === "verifier" || normalized === "verify" || /^verifier-/.test(normalized)) return "verifier";
  if (normalized === "wiki-maintainer" || normalized === "wiki" || /^(wiki-maintainer|wiki)-/.test(normalized)) {
    return "wiki-maintainer";
  }
  return "";
}

function startupRuleRoleForRunner(runner: AutoflowRunner) {
  return (
    startupRuleRoleForValue(runner.activeRole) ||
    startupRuleRoleForValue(runner.assignmentRole) ||
    startupRuleRoleForValue(runner.role) ||
    startupRuleRoleForValue(inferredActiveRoleForRunner(runner)) ||
    startupRuleRoleForValue(runner.id)
  );
}

function runnerShouldShowOnAiProgressBoard(runner: AutoflowRunner) {
  return Boolean((runner.id || "").trim());
}

function runnerHasOpenAssignment(runner: AutoflowRunner) {
  const assignmentStatus = (runner.assignmentStatus || "").toLowerCase();
  const queueStatus = (runner.queueStatus || "").toLowerCase();
  const stateStatus = (runner.stateStatus || "").toLowerCase();
  const hasAssignedRef = Boolean(runner.assignedItemRef || runner.activeTicketId || runner.activeTicketPath || runner.activeItem);
  if (
    hasAssignedRef &&
    !runner.pid &&
    ["none", "idle", "empty"].includes(queueStatus) &&
    ["", "idle", "stopped"].includes(stateStatus)
  ) {
    return false;
  }
  return Boolean(
    assignmentStatus &&
    !["completed", "released"].includes(assignmentStatus) &&
    hasAssignedRef
  );
}

function runnerHasAssignmentAwaitingStart(runner: AutoflowRunner) {
  if (!runnerHasOpenAssignment(runner)) return false;
  if (runner.pid) return false;
  const status = (runner.stateStatus || "").toLowerCase();
  return status !== "running" && status !== "starting" && status !== "restarting";
}

function runnerRoleMatchesDisplayRole(role: string, displayRole: string) {
  const normalized = (role || "").toLowerCase();
  if (displayRole === "worker") {
    return normalized === "worker" || normalized === "ticket";
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
  const workerAliasMatch = value.match(/^(?:worker|ai)-(\d+)$/i);
  if (value === "worker") return "worker";
  if (singleton && role === "worker") return "worker";
  if (workerAliasMatch) {
    const suffix = workerAliasMatch[1];
    return suffix === "1" ? "worker" : `worker-${suffix}`;
  }
  if (/^planner-\d+$/.test(value) || /^plan-\d+$/.test(value)) {
    return singleton ? "planner" : value.replace(/^plan-/, "planner-");
  }
  if (value === "wiki-maintainer-1" || value === "wiki") return singleton ? "wiki" : "wiki-1";
  if (/^wiki-maintainer-\d+$/.test(value)) return value.replace(/^wiki-maintainer-/, "wiki-");
  if (/^wiki-\d+$/.test(value)) return value.replace(/^wiki-/, "wiki-");
  if (value === "coordinator-1") return "coordinator";
  return value;
}

function titleCaseWorkflowRunnerId(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayProgressWorkerLabel(runner: AutoflowRunner, runners?: AutoflowRunner[]) {
  const id = (runner.id || "").toLowerCase();
  const visibleWorkers = runners?.filter((candidate) => startupRuleRoleForRunner(candidate) === "worker");
  const visibleWorkerIndex = visibleWorkers?.findIndex((candidate) => candidate.id === runner.id);
  if (typeof visibleWorkerIndex === "number" && visibleWorkerIndex >= 0) {
    if ((visibleWorkers?.length || 0) <= 1) return "Worker";
    return `Worker${visibleWorkerIndex + 1}`;
  }

  if (id === "worker" || id === "ai") return "Worker";

  const numbered = id.match(/^(?:worker|ai)-(\d+)$/);
  if (numbered) return `Worker${Number.parseInt(numbered[1], 10) + 1}`;

  return titleCaseWorkflowRunnerId(displayWorkflowRunnerId(runner.id, runners) || "worker");
}

function isCoordinatorRole(value: string) {
  return ["coordinator", "coord"].includes((value || "").toLowerCase());
}

function displayRoleKeyForValue(value: string) {
  const normalized = (value || "").toLowerCase();
  if (normalized === "worker" || normalized === "ticket" || /^(worker|ai)-/.test(normalized)) return "worker";
  if (normalized === "planner" || normalized === "plan" || /^(planner|plan)-/.test(normalized)) return "planner";
  if (normalized === "verifier" || normalized === "verify" || /^verifier-/.test(normalized)) return "verifier";
  if (normalized === "wiki-maintainer" || normalized === "wiki" || /^(wiki-maintainer|wiki)-/.test(normalized)) return "wiki";
  return "";
}

function inferredActiveRoleForRunner(runner: AutoflowRunner) {
  const activeStage = (runner.activeStage || "").toLowerCase();
  const activeTicketId = (runner.activeTicketId || "").trim();
  const signalText = [
    runner.lastResult,
    runner.lastLogLine,
    runner.activeItem,
    runner.activeTicketPath,
    runner.assignedItemRef,
    runner.queueStatusLabel,
    runner.queueStatusDetail,
    runner.backgroundTask,
    runner.backgroundTaskLabel
  ]
    .join(" ")
    .toLowerCase();

  if (/^merging$/.test(activeStage) || /\bneeds_ai_merge\b|\bai_merge_required\b|\bmerging\b/.test(signalText)) return "worker";
  if (/\bworker[_-]|\bworker_ticket\b|\bfinish_ticket\b/.test(signalText)) return "worker";
  if (/^(planning|generating-todo)$/.test(activeStage) || /\bplanner[_-]|\bprd-to-todo\b|\btodo_ticket=/.test(signalText)) {
    return "planner";
  }
  if (/^verifier[_-]/.test(activeStage) || /\bverifier[_-]|\bverifier\b/.test(signalText)) return "verifier";
  if (/\bwiki[_-]|\bwiki-maintainer\b|\bllm wiki\b/.test(signalText)) return "wiki-maintainer";
  if (/^(claimed|executing|inprogress|verify_pending|verifier_pending)$/.test(activeStage)) {
    return "worker";
  }
  if (activeTicketId.startsWith("PRD-")) return "planner";
  if (activeTicketId) return "worker";
  return "";
}

function displayRoleKeyForRunner(runner: AutoflowRunner) {
  return (
    displayRoleKeyForValue(runner.activeRole) ||
    displayRoleKeyForValue(runner.assignmentRole) ||
    displayRoleKeyForValue(runner.role) ||
    displayRoleKeyForValue(inferredActiveRoleForRunner(runner))
  );
}

function displayProgressRoleName(roleKey: string) {
  if (roleKey === "planner") return "Planner";
  if (roleKey === "worker") return "Worker";
  if (roleKey === "verifier") return "Verifier";
  if (roleKey === "wiki") return "Wiki";
  return "";
}

function displayProgressRunnerLabel(runner: AutoflowRunner, runners?: AutoflowRunner[]) {
  if (isCoordinatorRole(runner.role)) return "Coordinator";
  return displayProgressRoleLabel(runner, runners);
}

function displayProgressRoleLabel(runner: AutoflowRunner, runners?: AutoflowRunner[]) {
  const roleKey = displayRoleKeyForRunner(runner) || displayRoleKeyForValue(runner.id);
  const roleName = displayProgressRoleName(roleKey);
  if (roleName) return roleName;
  if (startupRuleRoleForRunner(runner) === "worker") return displayProgressWorkerLabel(runner, runners);

  const metaLabel = displayWorkflowRunnerId(runner.id, runners);
  return metaLabel ? titleCaseWorkflowRunnerId(metaLabel) : "Runner";
}

function displayAiAgentRunnerLabel(value: string, runners?: AutoflowRunner[]) {
  const runner = runners?.find((candidate) => candidate.id === value);
  if (runner) return displayProgressRoleLabel(runner, runners);
  return titleCaseWorkflowRunnerId(displayWorkflowRunnerId(value, runners));
}

function progressBoardRunnerOrder(runner: AutoflowRunner) {
  const role = displayRoleKeyForRunner(runner) || runnerCurrentRoleValue(runner);
  const runnerId = (runner.id || "").toLowerCase();
  const idRole = canonicalWorkflowRunnerRole(runner.id);
  if (["planner", "plan"].includes(role) || idRole === "planner") return 0;
  if (["worker", "ticket"].includes(role) || idRole === "worker") return 1;
  if (role === "verifier") return 2;
  if (role === "wiki-maintainer" || role === "wiki" || role.includes("wiki") || idRole === "wiki-maintainer") return 3;
  if (runnerId === "worker") return 4;
  if (/^worker-\d+$/.test(runnerId)) return 5;
  if (runnerId === "verifier") return 6;
  if (
    runnerId === "wiki" ||
    runnerId === "wiki-maintainer" ||
    /^wiki-\d+$/.test(runnerId) ||
    /^wiki-maintainer-\d+$/.test(runnerId)
  ) {
    return 7;
  }
  return 8;
}

function sortProgressBoardRunners(runners: AutoflowRunner[]) {
  return runners
    .map((runner, index) => ({ runner, index }))
    .sort((a, b) => {
      return progressBoardRunnerOrder(a.runner) - progressBoardRunnerOrder(b.runner) || a.index - b.index;
    })
    .map(({ runner }) => runner);
}

const AGENT_APP_ICONS: Record<string, string> = {
  claude: claudeAppIcon,
  codex: codexAppIcon
};

function normalizeAgentIconKey(agent: string) {
  const normalized = (agent || "").trim().toLowerCase();
  if (normalized.includes("claude")) return "claude";
  if (normalized.includes("codex")) return "codex";
  return normalized;
}

function AgentAppIcon({ agent }: { agent?: string }) {
  const iconKey = normalizeAgentIconKey(agent || "codex");
  const iconSrc = AGENT_APP_ICONS[iconKey];
  if (!iconSrc) {
    return (
      <span className="ai-agent-app-icon ai-agent-app-icon-fallback" aria-hidden="true">
        <Workflow size={14} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className={`ai-agent-app-icon ai-agent-app-icon-${iconKey}`} aria-hidden="true">
      <img src={iconSrc} alt="" />
    </span>
  );
}

function projectKeyFromSpecRef(value: string) {
  return value.match(/(PRD-\d+|PRD-\d+)/)?.[1] || "";
}

function displayActiveTicketBadge(value: string) {
  const trimmed = value.trim();
  const basename = trimmed.split(/[\\/]/).filter(Boolean).pop() || trimmed;
  return workflowFileDisplayName(basename.endsWith(".md") ? basename : `${basename}.md`);
}

function canonicalActiveItemLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return displayActiveTicketBadge(trimmed).toLowerCase();
}

function repeatsActiveTicketBadge(value: string, activeTicketId: string) {
  const normalizedValue = value.trim().toLowerCase();
  const normalizedTicketId = activeTicketId.trim().toLowerCase();
  if (!normalizedValue || !normalizedTicketId) return false;
  return (
    normalizedValue === normalizedTicketId ||
    normalizedValue === displayActiveTicketBadge(activeTicketId).toLowerCase() ||
    canonicalActiveItemLabel(normalizedValue) === canonicalActiveItemLabel(normalizedTicketId)
  );
}

function activeItemFileAliases(value: string) {
  const stem = value.replace(/\.md$/i, "");
  const aliases = new Set<string>([`${stem}.md`]);
  const numericMatch = stem.match(/(\d+)/);
  if (numericMatch) {
    const id = numericMatch[1];
    aliases.add(`TODO-${id}.md`);
    aliases.add(`TODO-${id}.md`);
  }
  return [...aliases];
}

function activeItemPreviewPaths(runner: AutoflowRunner) {
  const activeId = (runner.activeTicketId || "").trim().replace(/\.md$/i, "");
  if (!activeId) return [];

  const paths = new Set<string>();
  const addFiles = (folders: string[], files: string[]) => {
    for (const folder of folders) {
      for (const file of files) {
        paths.add(`tickets/${folder}/${file}`);
      }
    }
  };

  if (runner.activeSpecRef) {
    paths.add(runner.activeSpecRef);
  }
  if (runner.activeTicketPath) {
    paths.add(runner.activeTicketPath);
  }
  if (activeId.startsWith("PRD-")) {
    addFiles(["prd", "backlog"], [`${activeId}.md`]);
  }

  addFiles(["inprogress", "verifier", "todo"], activeItemFileAliases(activeId));
  return [...paths];
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
  options?: WorkflowBoardOptions;
  actionKey?: string;
  draft?: RunnerDraft;
  savedDraft?: RunnerDraft;
  onSelectRunner?: (runnerId: string) => void;
  onControl?: (action: RunnerControlAction, runnerId: string, options?: RunnerControlOptions) => void;
  onRunnerAuthChoice?: (choice: RunnerAuthChoice, runner: AutoflowRunner) => void;
  onDraftChange?: (runnerId: string, field: keyof RunnerDraft, value: string) => void;
  onConfigure?: (runner: AutoflowRunner, restartAfterSave?: boolean) => void;
}) {
  const livePtyActivity = useLivePtyActivity(runner, options);
  const livePtyBusy = Boolean(runner.livePtyBusy) || livePtyActivity.busy;
  const baseCurrentKey = runnerStageKey(runner);
  const currentKey = livePtyBusy && baseCurrentKey === "idle"
    ? runnerLivePtyBusyStageKey(runner)
    : baseCurrentKey;
  const hideProgressTrack = isCoordinatorRole(runner.role);
  const flowStages = flowStagesForRunner(runner);
  const stage = flowStages.find((candidate) => candidate.key === currentKey) || flowStages[Math.min(1, flowStages.length - 1)];
  const stageIndex = flowStages.findIndex((candidate) => candidate.key === currentKey);
  const stageCount = Math.max(1, flowStages.length);
  const progressStepCount = Math.max(1, stageCount - 1);
  const progressScale = String(
    Math.max(0, Math.min(1, (stageIndex > 0 ? (stageIndex / progressStepCount) * 100 : 0) / 100))
  );
  const cycleResult = runnerCycleResult(runner);
  const status = runner.stateStatus || "idle";
  const role = displayRoleKeyForRunner(runner) || runnerCurrentRoleValue(runner);
  const isWorkerProgressRow = role === "worker" || role === "ticket";
  const isBlocked = runnerBlockedNeedsAttention(runner);
  const detail = runnerProgressDetail(runner);
  const detailTimestamp = timestampFromRunnerLog(detail);
  const displayDetail = isMachineRunnerLog(detail) ? "" : detail;
  const hasActiveWorkContext = runnerHasActiveWorkContext(runner);
  const activeTicketLabel = hasActiveWorkContext
    ? runner.activeTicketId
      ? displayActiveTicketBadge(runner.activeTicketId)
      : runner.assignedItemRef
        ? displayActiveTicketBadge(runner.assignedItemRef)
        : ""
    : "";
  const activeTicketTitle = runner.activeTicketTitle && !repeatsActiveTicketBadge(runner.activeTicketTitle, runner.activeTicketId)
    ? runner.activeTicketTitle
    : "";
  const detailText = displayDetail && !repeatsActiveTicketBadge(displayDetail, runner.activeTicketId) ? displayDetail : "";
  const agentLabel = displayProgressRunnerLabel(runner);
  const agentTitle = displayProgressRoleLabel(runner, options?.allRunners);
  const isRunnerActive =
    (runner.stateStatus || "").toLowerCase() === "running" && Boolean(runner.pid);
  const liveStdoutText = useLiveStdoutText(runner, options);
  // 실행 중일 때만 live stdout 표시. previewText fallback 없음 —
  // previewText 가 먼저 쓰이면 writtenLengthRef 가 오염돼 typewriter 가 깨진다.
  const conversationText = isRunnerActive ? liveStdoutText : "";
  const statusLower = status.toLowerCase();
  const scheduledLoop = runnerUsesScheduledLoop(runner);
  const mode = scheduledLoop ? (runner.mode || "loop") : "";
  const isWorking = Boolean(actionKey);
  const transitionLabel = runnerTransitionLabel(actionKey);
  const canForceStop = actionKey === "stopping_pending";
  const canStart = scheduledLoop ? mode === "loop" : true;
  const canStop = statusLower === "running" || Boolean(runner.pid);
  const canEditConfig = statusLower !== "running";
  const runnerDraft = draft || runnerDraftFromRunner(runner);
  const canConfigure = Boolean(onSelectRunner && onDraftChange && onConfigure);
  const canControl = Boolean(onSelectRunner && onControl);
  const isApplyingConfig = actionKey === "config_applying" || actionKey === "config_applying_restart";
  const showConversation = Boolean(liveStdoutText) || shouldShowConversation(runner);
  const showAuthPrompt = runnerNeedsLogin(runner) && Boolean(onRunnerAuthChoice);
  const canContinueAuth = runnerCanContinueAuth(runner);
  const statusSummary = runnerStatusSummary({
    runner,
    status,
    statusLower,
    currentKey,
    stageLabel: stage?.label,
    role,
    isBlocked,
    cycleResult,
    activeTicketLabel,
    detailText,
    transitionLabel,
    isApplyingConfig,
    showAuthPrompt,
    livePtyBusy
  });
  const showAgentConfig = true;

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
    const candidatePaths = activeItemPreviewPaths(runner).map((filePath) =>
      filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath) ? filePath : `${projectRoot}/${boardDir}/${filePath}`
    );
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
      data-runner-id={runner.id}
      className={`ai-progress-row ai-progress-${currentKey}${isWorkerProgressRow ? " ai-progress-row-worker" : ""}${
        hideProgressTrack ? " ai-progress-row-no-track" : ""
      }`}
    >
      <div className="ai-progress-row-top">
        <div className="ai-progress-agent">
          <div className={`ai-progress-agent-title${isWorkerProgressRow ? " ai-progress-agent-title-worker" : ""}`}>
            <AgentAppIcon agent={runnerDraft.agent || runner.agent || "codex"} />
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
                  aria-label={`${agentTitle} 정지`}
                  title={`${agentTitle} 정지`}
                  disabled={Boolean(actionKey)}
                  onClick={() => {
                    onSelectRunner?.(runner.id);
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
                    aria-label={`${agentTitle} 강제 종료`}
                    title={`${agentTitle} 강제 종료`}
                    onClick={() => {
                      if (window.confirm(`${agentTitle} 러너를 강제 종료할까요?`)) {
                        onSelectRunner?.(runner.id);
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
                aria-label={`${agentTitle} 시작`}
                title={`${agentTitle} 시작`}
                disabled={!canStart || Boolean(actionKey)}
                onClick={() => {
                  onSelectRunner?.(runner.id);
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
      {/* Dot/track row removed — current stage is now shown inline next to
          the agent title via `.ai-progress-agent-stage`. The agentTitle area
          is the single source of truth for "what is this runner doing". */}

      <div className="ai-progress-current">
        {runner.activeTicketId ? (
          <Button
            variant="ghost"
            type="button"
            className="ai-progress-status-summary-button"
            onClick={openTicketDialog}
            title={statusSummary.title}
            aria-label={`${statusSummary.label}${statusSummary.detail ? `, ${statusSummary.detail}` : ""} 미리 보기`}
          >
            <span className="ai-progress-status-summary" data-tone={statusSummary.tone}>
              <span className="ai-progress-status-main">{statusSummary.label}</span>
              {statusSummary.detail ? <span className="ai-progress-status-detail">{statusSummary.detail}</span> : null}
            </span>
          </Button>
        ) : (
          <span className="ai-progress-status-summary" data-tone={statusSummary.tone} title={statusSummary.title}>
            <span className="ai-progress-status-main">{statusSummary.label}</span>
            {statusSummary.detail ? <span className="ai-progress-status-detail">{statusSummary.detail}</span> : null}
          </span>
        )}
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
            {canContinueAuth ? (
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
            ) : null}
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
      <LivePtyView
        key={`${options?.projectRoot || ""}\0${options?.boardDirName || ".autoflow"}\0${runner.id}`}
        runnerId={runner.id}
        projectRoot={options?.projectRoot || ""}
        boardDirName={options?.boardDirName || ".autoflow"}
        ariaLabel={`${agentLabel} 라이브 터미널`}
        clearOnStopped
        runnerStatus={status}
      />
      <RunnerActivityFooter runner={runner} />
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
                    : "항목"}
                  {activeTicketTitle ? (
                    <span className="ai-ticket-dialog-subtitle"> · {activeTicketTitle}</span>
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
                  <MarkdownViewer content={ticketMarkdownDisplayContent(ticketContent.content)} />
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
  onReset,
  isRunning,
  result
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onReset: () => void;
  isRunning: boolean;
  result: WikiQueryParsed | null;
}) {
  const canReset = query.trim().length > 0 || Boolean(result) || isRunning;
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
        {canReset ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="wiki-query-reset"
            onClick={onReset}
          >
            <RotateCcw className="h-4 w-4" />
            <span>초기화</span>
          </Button>
        ) : null}
      </form>
    </div>
  );
}

function WikiQueryResultsList({
  result,
  selectedPath,
  onSelect
}: {
  result: WikiQueryParsed;
  selectedPath: string;
  onSelect: (filePath: string) => void;
}) {
  if (result.results.length === 0) {
    return <div className="empty-panel knowledge-list">일치하는 결과가 없습니다</div>;
  }

  return (
    <div className="log-list knowledge-list wiki-query-results">
      {result.results.map((entry, index) => {
        const scoreMeta = [
          `score ${formatWikiScore(entry.score)}`,
          entry.vectorScore == null ? "" : `vector ${formatWikiScore(entry.vectorScore)}`,
          entry.bm25Score == null ? "" : `BM25 ${formatWikiScore(entry.bm25Score)}`
        ].filter(Boolean);
        const lineMeta = entry.startLine
          ? `L${entry.startLine}${entry.endLine && entry.endLine !== entry.startLine ? `-${entry.endLine}` : ""}`
          : "";
        return (
          <Button
            key={`${entry.path}-${index}`}
            variant="ghost"
            type="button"
            className={`log-row${selectedPath === entry.path ? " log-row-selected" : ""}`}
            onClick={() => onSelect(entry.path)}
          >
            <Search className="h-4 w-4" />
            <div className="min-w-0">
              <strong>{entry.title}</strong>
              <span>
                {[WIKI_QUERY_KIND_LABEL[entry.kind] || entry.kind, ...scoreMeta, lineMeta]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {entry.snippets.length ? (
                <p title={entry.snippets.map((snip) => `L${snip.line}: ${snip.text}`).join("\n")}>
                  L{entry.snippets[0].line}: {entry.snippets[0].text}
                </p>
              ) : (
                <p>{entry.path}</p>
              )}
            </div>
          </Button>
        );
      })}
    </div>
  );
}

function boardRelativeFilePath(filePath: string, board: AutoflowBoardSnapshot | null) {
  const normalized = filePath.replace(/\\/g, "/");
  const boardRoot = (board?.boardRoot || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (boardRoot && normalized.startsWith(`${boardRoot}/`)) {
    return normalized.slice(boardRoot.length + 1);
  }
  const sidecarIndex = normalized.indexOf("/.autoflow/");
  if (sidecarIndex >= 0) {
    return normalized.slice(sidecarIndex + 11);
  }
  return normalized;
}

function wikiListGroup(relativePath: string, kind: "wiki" | "handoff") {
  if (kind === "handoff") return "Source · Handoff";
  const path = relativePath.replace(/\\/g, "/").toLowerCase();
  if (path === "wiki/project-overview.md") return "Overview";
  if (path === "wiki/index.md") return "Index";
  if (path.includes("/decisions/")) return "Decisions";
  if (path.includes("/architecture")) return "Architecture";
  if (path.includes("/answers/")) return "Answers";
  if (path.includes("/operations/")) return "Operations";
  return "Wiki";
}

function wikiListDisplayTitle(file: AutoflowFilePreview, relativePath: string, kind: "wiki" | "handoff") {
  const title = String(file.title || "").replace(/^#+\s*/, "").trim();
  const name = String(file.name || "").trim();
  const lowerTitle = title.toLowerCase();
  const lowerName = name.toLowerCase();
  if (title && lowerTitle !== lowerName && !/^<.*>$/.test(title)) {
    return title;
  }
  if (kind === "handoff") {
    return title || name || relativePath;
  }
  return wikiTitleFromPath(relativePath);
}

function isLowSignalWikiFile(file: AutoflowFilePreview, relativePath: string) {
  const name = String(file.name || "").toLowerCase();
  const path = relativePath.replace(/\\/g, "/").toLowerCase();
  if (name === "skill-template.md") return true;
  if (name === "readme.md") return true;
  return path.includes("/templates/");
}

function wikiListPriority(file: AutoflowFilePreview, relativePath: string, kind: "wiki" | "handoff") {
  if (kind === "handoff") return 80;
  const path = relativePath.replace(/\\/g, "/").toLowerCase();
  if (path === "wiki/project-overview.md") return 0;
  if (path === "wiki/index.md") return 1;
  if (path.includes("/decisions/")) return 10;
  if (path.includes("/architecture")) return 20;
  if (path.includes("/answers/")) return 30;
  if (path.includes("/operations/")) return 40;
  if (isLowSignalWikiFile(file, relativePath)) return 90;
  return 50;
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
  const allEntries = [
    ...(board?.wikiFiles || []).map((file) => ({ kind: "wiki" as const, file })),
    ...(board?.conversationFiles || []).map((file) => ({ kind: "handoff" as const, file }))
  ].map((entry) => ({
    ...entry,
    relativePath: boardRelativeFilePath(entry.file.filePath, board)
  }));
  const semanticEntries = allEntries.filter(
    (entry) => entry.kind !== "wiki" || !isLowSignalWikiFile(entry.file, entry.relativePath)
  );
  const entries = (semanticEntries.length ? semanticEntries : allEntries)
    .sort((a, b) =>
      wikiListPriority(a.file, a.relativePath, a.kind) -
        wikiListPriority(b.file, b.relativePath, b.kind) ||
      String(b.file.modifiedAt || "").localeCompare(String(a.file.modifiedAt || "")) ||
      a.relativePath.localeCompare(b.relativePath)
    )
    .slice(0, 24);

  if (!entries.length) {
    return <div className="empty-panel">No wiki pages</div>;
  }

  return (
    <div className="log-list knowledge-list">
      {entries.map(({ kind, file, relativePath }) => (
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
            <strong>{wikiListDisplayTitle(file, relativePath, kind)}</strong>
            <span>
              {wikiListGroup(relativePath, kind)} · {formatDate(file.modifiedAt)}
            </span>
            <p>{relativePath}</p>
          </div>
        </Button>
      ))}
    </div>
  );
}

function wikiDbTableLabel(name: string) {
  if (name === "wiki") return "canonical markdown";
  if (name === "raw") return "raw sources";
  if (name === "done") return "done evidence";
  return "markdown";
}

function wikiDbCellPreview(value: string) {
  if (!value) return "";
  return value.length > 240 ? `${value.slice(0, 240)}...` : value;
}

function WikiDatabasePanel({
  result,
  isLoading,
  error,
  selectedTable,
  onSelectTable,
  onRefresh
}: {
  result: AutoflowWikiDatabaseResult | null;
  isLoading: boolean;
  error: string;
  selectedTable: string;
  onSelectTable: (table: string) => void;
  onRefresh: () => void;
}) {
  const activeTable = result?.selectedTable || selectedTable || "wiki";
  const dbPath = result?.dbPath || ".autoflow/wiki";
  const columns = result?.columns?.length
    ? result.columns
    : Object.keys(result?.rows?.[0] || {}).map((name) => ({
      name,
      type: "",
      notNull: false,
      primaryKey: false
    }));
  const rows = result?.rows || [];

  return (
    <div className="wiki-db-panel">
      <aside className="wiki-db-sidebar" aria-label="위키 파일 그룹">
        <div className="wiki-db-sidebar-header">
          <BookOpenText className="h-4 w-4" />
          <div className="min-w-0">
            <strong>{basename(dbPath)}</strong>
            <span title={dbPath}>{dbPath}</span>
          </div>
        </div>
        <div className="wiki-db-table-list">
          {(result?.tables || []).map((table) => (
            <Button
              key={table.name}
              type="button"
              variant="ghost"
              className={`wiki-db-table-button${table.name === activeTable ? " wiki-db-table-button-active" : ""}`}
              onClick={() => onSelectTable(table.name)}
              title={table.name}
            >
              <FileText className="h-4 w-4" />
              <div className="wiki-db-table-button-copy">
                <strong>{table.name}</strong>
                <span>{wikiDbTableLabel(table.name)}</span>
              </div>
              <small>{formatCount(table.rowCount)}</small>
            </Button>
          ))}
        </div>
      </aside>
      <section className="wiki-db-table-pane" aria-label="위키 markdown 파일">
        <div className="wiki-db-table-header">
          <div className="wiki-db-table-heading">
            <FileText className="h-4 w-4" />
            <div className="min-w-0">
              <strong>{activeTable}</strong>
              <span>
                {formatCount(result?.rowCount || rows.length)} files · {formatCount(columns.length)} fields
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="wiki-db-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="위키 새로고침"
            title="위키 새로고침"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        {error ? <div className="knowledge-error wiki-db-error">{error}</div> : null}
        {!error && isLoading ? (
          <div className="empty-panel wiki-db-empty">위키를 읽는 중입니다</div>
        ) : null}
        {!error && !isLoading && !rows.length ? (
          <div className="empty-panel wiki-db-empty">표시할 markdown 파일이 없습니다</div>
        ) : null}
        {!error && rows.length ? (
          <div className="wiki-db-table-scroll">
            <table className="wiki-db-table">
              <thead>
                <tr>
                  <th className="wiki-db-row-number">#</th>
                  {columns.map((column) => (
                    <th key={column.name} title={column.type || column.name}>
                      <span>{column.name}</span>
                      {column.primaryKey ? <em>PK</em> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${activeTable}-${rowIndex}`}>
                    <td className="wiki-db-row-number">{(result?.offset || 0) + rowIndex + 1}</td>
                    {columns.map((column) => {
                      const value = String(row[column.name] ?? "");
                      return (
                        <td key={column.name} title={wikiDbCellPreview(value)}>
                          {wikiDbCellPreview(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LogPreview({
  preview,
  isLoading,
  error,
  headerAction,
  fallbackTitle = "로그 미리보기",
  emptyMessage = "선택된 로그가 없습니다"
}: {
  preview: AutoflowFileContentResult | null;
  isLoading: boolean;
  error: string;
  headerAction?: React.ReactNode;
  fallbackTitle?: string;
  emptyMessage?: string;
}) {
  const displayContent = preview ? preview.content : "";
  const headerTitle = preview?.name || fallbackTitle;
  const showHeader = Boolean(headerTitle || isLoading || preview?.truncated || headerAction);
  return (
    <div className="log-preview">
      {showHeader ? (
        <div className="log-preview-header">
          {headerTitle ? <strong>{headerTitle}</strong> : null}
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {!isLoading && preview?.truncated ? (
            <Badge variant="outline" className="log-preview-badge">
              일부만 표시
            </Badge>
          ) : null}
          {headerAction}
        </div>
      ) : null}
      {error ? <div className="log-preview-error">{error}</div> : null}
      {!error && preview ? <pre>{displayContent || "(비어 있음)"}</pre> : null}
      {!error && !preview ? <div className="empty-panel log-preview-empty">{emptyMessage}</div> : null}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
