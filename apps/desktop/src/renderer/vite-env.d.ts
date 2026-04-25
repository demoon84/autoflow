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

interface Window {
  autoflow: {
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
      action: "update" | "lint";
      dryRun?: boolean;
      projectRoot: string;
      boardDirName: string;
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
