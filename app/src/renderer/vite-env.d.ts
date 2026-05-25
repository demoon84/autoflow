/// <reference types="vite/client" />

type AutoflowCommand = "init" | "status" | string;

type AutoflowRunResult = {
  ok: boolean;
  command: AutoflowCommand;
  code: number;
  stdout: string;
  stderr: string;
  signal?: string;
  cancelled?: boolean;
};

type AutoflowInstallProgress = {
  invocationId?: string;
  projectRoot: string;
  boardDirName: string;
  stage: string;
  label: string;
};

type AutoflowFilePreview = {
  filePath: string;
  name: string;
  title: string;
  modifiedAt: string;
  createdAt?: string;
  prdKey?: string;
  stage?: string;
};

type AutoflowRunner = {
  id: string;
  role: string;
  agent: string;
  codexHistory: string;
  model: string;
  reasoning: string;
  mode: string;
  intervalSeconds: string;
  intervalEffectiveSeconds: string;
  enabled: string;
  command: string;
  commandPreview: string;
  stateStatus: string;
  activeRole: string;
  assignmentRole: string;
  assignmentStatus: string;
  assignedItemRef: string;
  activeItem: string;
  activeTicketId: string;
  activeTicketTitle: string;
  activeTicketPath: string;
  activeStage: string;
  activeSpecRef: string;
  pid: string;
  startedAt: string;
  lastEventAt: string;
  lastAdapterChunkAt: string;
  lastResult: string;
  lastRuntimeLog: string;
  lastPromptLog: string;
  lastStdoutLog: string;
  lastStderrLog: string;
  artifactStatus: string;
  artifactRuntimeStatus: string;
  artifactPromptStatus: string;
  artifactStdoutStatus: string;
  artifactStderrStatus: string;
  lastLogLine: string;
  conversationPreview: string;
  authRequired: boolean;
  authMessage: string;
  authUrl: string;
  authProviderBlocked?: boolean;
  backgroundTask?: string;
  backgroundTaskLabel?: string;
  backgroundTaskPid?: string;
  backgroundTaskStartedAt?: string;
  backgroundTaskLogPath?: string;
  livePtyBusy?: boolean;
  queueStatus?: string;
  queueStatusLabel?: string;
  queueStatusDetail?: string;
  queueClaimableCount?: number;
  queueBlockedCount?: number;
  queuePendingCount?: number;
  statePath: string;
  logPath: string;
  tokenUsage?: number;
  cumulativeTokens?: number;
  cumulativeTotalTokens?: number;
  cumulativeCacheReadTokens?: number;
  cumulativeCacheCreateTokens?: number;
  cumulativeLlmRequestCount?: number;
  lastTurnTokens?: number;
  lastTurnTotalTokens?: number;
  lastTurnInputTokens?: number;
  lastTurnOutputTokens?: number;
  lastTurnCacheReadTokens?: number;
  lastTurnCacheCreateTokens?: number;
  lastTurnLlmRequestCount?: number;
};

type AutoflowRunnerConfigUpdate = Partial<
  Pick<AutoflowRunner, "agent" | "model" | "reasoning" | "mode" | "enabled" | "command"> & {
    interval_seconds: string;
    codex_history: string;
  }
>;

type AutoflowRunnerListResult = AutoflowRunResult & {
  values?: Record<string, string>;
  runners: AutoflowRunner[];
};

type AutoflowRunnerResourceUsage = {
  ok: boolean;
  pid: string;
  cpuPercent: number;
  memoryPercent: number;
  rssMb: number;
  processCount: number;
  loadScore: number;
  stderr: string;
};

type AutoflowMetricSnapshot = {
  timestamp: string;
  spec_total: number;
  ticket_total: number;
  ticket_done_count: number;
  active_ticket_count: number;
  retry_order_count: number;
  handoff_count: number;
  autoflow_code_files_changed_count: number;
  autoflow_code_insertions_count: number;
  autoflow_code_deletions_count: number;
  autoflow_code_volume_count: number;
  autoflow_code_net_delta_count: number;
  autoflow_token_usage_count: number;
  autoflow_token_total_count: number;
  autoflow_token_cache_read_count: number;
  autoflow_token_cache_create_count: number;
  autoflow_llm_request_count: number;
  autoflow_token_report_count: number;
  completion_rate_percent: number;
};

type AutoflowBoardSnapshot = {
  repoRoot: string;
  boardRoot: string;
  exists: boolean;
  status: Record<string, string>;
  statusResult: AutoflowRunResult | null;
  metrics: Record<string, string>;
  metricsResult: AutoflowRunResult | null;
  watcher: Record<string, string>;
  watcherResult: AutoflowRunResult | null;
  runners: AutoflowRunner[];
  runnersResult: AutoflowRunnerListResult | null;
  tickets: Record<string, AutoflowFilePreview[]>;
  logs: AutoflowFilePreview[];
  runnerLogs: AutoflowFilePreview[];
  wikiFiles: AutoflowFilePreview[];
  metricsFiles: AutoflowFilePreview[];
  metricsHistory: AutoflowMetricSnapshot[];
  conversationFiles: AutoflowFilePreview[];
};

type AutoflowFileContentResult = {
  ok: boolean;
  filePath: string;
  name: string;
  content: string;
  truncated: boolean;
  modifiedAt: string;
  size: number;
  stderr: string;
};

type AutoflowWikiDatabaseTable = {
  name: string;
  type: string;
  rowCount: number;
};

type AutoflowWikiDatabaseColumn = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
};

type AutoflowWikiDatabaseResult = {
  ok: boolean;
  dbPath: string;
  selectedTable: string;
  tables: AutoflowWikiDatabaseTable[];
  columns: AutoflowWikiDatabaseColumn[];
  rows: Record<string, string>[];
  rowCount: number;
  limit: number;
  offset: number;
  stderr: string;
};

type AutoflowAppConfig = {
  defaultProjectRoot: string;
  blockedProjectRoots?: string[];
  defaultBoardDirName: string;
};

type AutoflowInstalledAgentProfile = {
  installed: boolean;
  model: string;
  models?: string[];
  reasoning: string;
  supportsReasoning: boolean;
};

type AutoflowInstalledAgentProfiles = Record<string, AutoflowInstalledAgentProfile>;

interface Window {
  autoflow: {
    getConfig: () => Promise<AutoflowAppConfig>;
    listInstalledAgentProfiles: () => Promise<AutoflowInstalledAgentProfiles>;
    selectProject: () => Promise<string>;
    readBoard: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowBoardSnapshot>;
    installBoard: (options: {
      projectRoot: string;
      boardDirName: string;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    listRunners: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunnerListResult>;
    runnerResourceUsage: (options: {
      pid: string;
    }) => Promise<AutoflowRunnerResourceUsage>;
    controlRunner: (options: {
      action: "start" | "stop" | "restart" | "remove";
      runnerId: string;
      projectRoot: string;
      boardDirName: string;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    closeProjectRunners: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<{
      ok: boolean;
      stoppedCount: number;
      ptyStoppedCount: number;
      stateStoppedCount: number;
      runnerIds: string[];
      stderr: string;
    }>;
    listRunnerArtifacts: (options: {
      runnerId: string;
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunResult>;
    runRole: (options: {
      role: string;
      runnerId: string;
      projectRoot: string;
      boardDirName: string;
      dryRun?: boolean;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    configureRunner: (options: {
      runnerId: string;
      projectRoot: string;
      boardDirName: string;
      config: AutoflowRunnerConfigUpdate;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    createRunner: (options: {
      runnerId: string;
      role: string;
      projectRoot: string;
      boardDirName: string;
      config: AutoflowRunnerConfigUpdate;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    continueRunnerAuth: (options: {
      runnerId: string;
      agent: string;
      projectRoot: string;
      boardDirName: string;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    controlWiki: (options: {
      action: "update" | "lint" | "query";
      dryRun?: boolean;
      projectRoot: string;
      boardDirName: string;
      terms?: string[];
      limit?: number;
      includeTickets?: boolean;
      includeHandoffs?: boolean;
      includeSnippets?: boolean;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    browseWikiDatabase: (options: {
      projectRoot: string;
      boardDirName: string;
      table?: string;
      limit?: number;
      offset?: number;
    }) => Promise<AutoflowWikiDatabaseResult>;
    writeMetricsSnapshot: (options: {
      projectRoot: string;
      boardDirName: string;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    controlWatcher: (options: {
      action: "start" | "stop" | "status";
      projectRoot: string;
      boardDirName: string;
      invocationId?: string;
    }) => Promise<AutoflowRunResult>;
    readBoardFile: (options: {
      projectRoot: string;
      boardDirName: string;
      filePath: string;
    }) => Promise<AutoflowFileContentResult>;
    readStartupRules: (options: {
      projectRoot: string;
      boardDirName: string;
      kind: "common" | "role";
      role?: string;
    }) => Promise<AutoflowFileContentResult>;
    writeStartupRules: (options: {
      projectRoot: string;
      boardDirName: string;
      kind: "common" | "role";
      role?: string;
      content: string;
    }) => Promise<AutoflowFileContentResult>;
    tailBoardFile: (options: {
      projectRoot: string;
      boardDirName: string;
      filePath: string;
      maxBytes?: number;
    }) => Promise<AutoflowFileContentResult>;
    projectExists: (projectRoot: string) => Promise<{ exists: boolean }>;
    cancelInvocation: (
      invocationId: string
    ) => Promise<{ ok: boolean; cancelled: boolean; reason?: string }>;
    runnerPtyStart: () => Promise<{ ok: false; error: string }>;
    runnerPtySpawn: (options: {
      runnerId: string;
      role: string;
      agent: string;
      model?: string;
      reasoning?: string;
      projectRoot: string;
      boardDirName: string;
      cols?: number;
      rows?: number;
      freshSession?: boolean;
    }) => Promise<{ ok: boolean; runnerId?: string; pid?: number; status?: string; error?: string }>;
    runnerPtyStop: (options: {
      runnerId: string;
      projectRoot?: string;
      boardDirName?: string;
      force?: boolean;
    }) => Promise<{ ok: boolean; error?: string }>;
    runnerPtyResize: (options: {
      runnerId: string;
      projectRoot?: string;
      boardDirName?: string;
      cols: number;
      rows: number;
    }) => Promise<{ ok: boolean }>;
    runnerPtySnapshot: (options: {
      runnerId: string;
      projectRoot?: string;
      boardDirName?: string;
    }) => Promise<{ snapshot: string }>;
    runnerPtyInput: (options: {
      runnerId: string;
      projectRoot?: string;
      boardDirName?: string;
      data: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    runnerPtyList: () => Promise<{
      runners: Array<{
        id: string;
        status: string;
        pid?: number;
        cwd?: string;
        command?: string;
        startedAt?: string;
      }>;
    }>;
    onBoardChange: (
      handler: (payload: {
        projectRoot: string;
        boardDirName: string;
        reason: string;
      }) => void
    ) => () => void;
    onInstallProgress: (handler: (payload: AutoflowInstallProgress) => void) => () => void;
  };
}
