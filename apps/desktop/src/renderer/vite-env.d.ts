/// <reference types="vite/client" />

type AutoflowCommand = "init" | "status" | string;

type AutoflowRunResult = {
  ok: boolean;
  command: AutoflowCommand;
  code: number;
  stdout: string;
  stderr: string;
};

type AutoflowFilePreview = {
  filePath: string;
  name: string;
  title: string;
  modifiedAt: string;
};

type AutoflowRunner = {
  id: string;
  role: string;
  agent: string;
  model: string;
  reasoning: string;
  mode: string;
  intervalSeconds: string;
  intervalEffectiveSeconds: string;
  enabled: string;
  command: string;
  commandPreview: string;
  stateStatus: string;
  activeItem: string;
  activeTicketId: string;
  activeTicketTitle: string;
  activeStage: string;
  activeSpecRef: string;
  pid: string;
  startedAt: string;
  lastEventAt: string;
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
  statePath: string;
  logPath: string;
};

type AutoflowRunnerConfigUpdate = Partial<
  Pick<AutoflowRunner, "agent" | "model" | "reasoning" | "mode" | "enabled" | "command"> & {
    interval_seconds: string;
  }
>;

type AutoflowRunnerListResult = AutoflowRunResult & {
  values?: Record<string, string>;
  runners: AutoflowRunner[];
};

type AutoflowMetricSnapshot = {
  timestamp: string;
  spec_total: number;
  ticket_total: number;
  ticket_done_count: number;
  active_ticket_count: number;
  reject_count: number;
  verifier_pass_count: number;
  verifier_fail_count: number;
  handoff_count: number;
  runner_total_count: number;
  runner_running_count: number;
  runner_idle_count: number;
  runner_stopped_count: number;
  runner_blocked_count: number;
  runner_enabled_count: number;
  runner_disabled_count: number;
  runner_invalid_config_count: number;
  runner_artifact_ok_count: number;
  runner_artifact_warning_count: number;
  runner_artifact_not_applicable_count: number;
  autoflow_commit_count: number;
  autoflow_code_files_changed_count: number;
  autoflow_code_insertions_count: number;
  autoflow_code_deletions_count: number;
  autoflow_code_volume_count: number;
  verification_pass_rate_percent: number;
  completion_rate_percent: number;
};

type AutoflowBoardSnapshot = {
  repoRoot: string;
  boardRoot: string;
  exists: boolean;
  status: Record<string, string>;
  statusResult: AutoflowRunResult | null;
  doctor: Record<string, string>;
  doctorResult: AutoflowRunResult | null;
  metrics: Record<string, string>;
  metricsResult: AutoflowRunResult | null;
  stopHook: Record<string, string>;
  stopHookResult: AutoflowRunResult | null;
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

type AutoflowAppConfig = {
  defaultBoardDirName: string;
};

type AutoflowInstalledAgentProfile = {
  installed: boolean;
  model: string;
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
    }) => Promise<AutoflowRunResult>;
    listRunners: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunnerListResult>;
    controlRunner: (options: {
      action: "start" | "stop" | "restart" | "remove";
      runnerId: string;
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunResult>;
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
    }) => Promise<AutoflowRunResult>;
    configureRunner: (options: {
      runnerId: string;
      projectRoot: string;
      boardDirName: string;
      config: AutoflowRunnerConfigUpdate;
    }) => Promise<AutoflowRunResult>;
    createRunner: (options: {
      runnerId: string;
      role: string;
      projectRoot: string;
      boardDirName: string;
      config: AutoflowRunnerConfigUpdate;
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
    }) => Promise<AutoflowRunResult>;
    writeMetricsSnapshot: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunResult>;
    controlStopHook: (options: {
      action: "install" | "remove" | "status";
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunResult>;
    controlWatcher: (options: {
      action: "start" | "stop" | "status";
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunResult>;
    readBoardFile: (options: {
      projectRoot: string;
      boardDirName: string;
      filePath: string;
    }) => Promise<AutoflowFileContentResult>;
  };
}
