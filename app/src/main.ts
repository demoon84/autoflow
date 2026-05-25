// @ts-nocheck
// main.ts is the Electron entry point. Uses require/JS style so the
// compact tsconfig.main.json (strict: false) covers it; the @ts-nocheck
// directive tells IDEs to use the same loose checking, since IDEs
// occasionally apply workspace-strict settings to this file.
const {app, BrowserWindow, dialog, ipcMain, nativeImage, powerMonitor, screen: electronScreen} = require("electron");
const {spawn, execFile, spawnSync} = require("node:child_process");
const nodeCrypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const parcelWatcher = require("@parcel/watcher");
const os = require("node:os");
const path = require("node:path");
const {PtyRunnerManager} = require("./main/runner-pty-manager");
const runnerTokensApi = require("../runtime/system/runner-tokens");
const {
    shellQuote,
    shellScriptSingleQuote,
    uniquePathEntries,
    existingDirEntries,
    nvmNodeBinEntries,
    augmentedPathValue,
    pathWithPrependedEntries,
    executableOnPath,
    userLoginShell,
    loginShellCommandArgs,
    autoflowShellCommand
} = require("./main/shell-path");
const {
    autoflowHomeRoot,
    coreRegistryPath,
    coreBundledShareRoot,
    isAutoflowCoreRoot,
    readJsonFileSync,
    coreVersion,
    nowIso,
    desktopCoreName,
    activeCoreRegistryEntry,
    ensureDesktopCoreRegistered,
    autoflowBinPath,
    useElectronAsNodeRuntime
} = require("./main/core-registry");
const {
    cliInvocation,
    requiredTsxCliPath,
    runtimeTsInvocation,
    runnerTokensInvocation,
    sessionTokenUsageImportDelayMs,
    ensureAutoflowCliShim
} = require("./main/cli-invocation");
const {
    stripTomlComment,
    parseTomlStringValue,
    parseTomlManifestScalar,
    scaffoldManifestValue,
    readScaffoldManifestSourceEntries
} = require("./main/manifest-toml");
const {
    boardManifestShareRoot,
    resolvedShareRoot,
    runnerConfigReadPath,
    readRunnerConfigBlocks,
    readRunnerConfigBlock,
    safeAssignmentSegment,
    readRunnerAssignmentSync,
    activeAssignmentStatus,
    currentRunnerAssignmentRole,
    ensureWikiAssignmentForPendingWorkSync,
    runnerStateAssignmentRole,
    inferRunnerRoleFromId,
    resolveRunnerStartRole,
    runnerConfigBoolean,
    canonicalWorkerRunnerId
} = require("./main/runner-config-read");
const {
    runnerTokenStateDefaults,
    runnerTokenAccountingKeys,
    runnerCodeAccountingKeys,
    runnerTokenAccountingResetFields,
    isRunnerTokenSourceAuthoritative,
    preserveLatestRunnerAccountingFields,
    writePtyRunnerStateFile,
    mirrorExistingPtyRunnerRunningState
} = require("./main/runner-state-write");
const {
    clearVerifierHandoffTurnTimers,
    writeRunnerHandoffPromptFile,
    buildInjectedHandoffPrompt,
    verifierQueueChangeReasons,
    verifierPromptLooksReady,
    runnerPromptNeedsContinue,
    runnerSnapshotLooksBusy,
    runnerPromptAcceptsInjectedTurn,
    handoffRetryDedupMs,
    handoffDedupBlocks,
    handoffIdleStateFields,
    pokeRunnerContinuePromptIfNeeded,
    workerVerifierDecisionChangeReasons,
    verifierDecisionStageForWorkerTurn,
    workerRunnerIdFromTicketSync,
    workerDecisionFingerprint,
    scheduleWorkerVerifierDecisionTurn,
    scheduleWorkerVerifierDecisionTurnsForScope,
    scheduleVerifierHandoffTurn,
    scheduleVerifierHandoffTurnsForScope,
    plannerQueueChangeReasons,
    schedulePlannerHandoffTurn,
    schedulePlannerHandoffTurnsForScope,
    workerTodoQueueChangeReasons,
    workerTodoQueueFingerprint,
    workerRunnerHasOwnedActiveTicketSync,
    scheduleWorkerTodoHandoffTurn,
    scheduleWorkerTodoHandoffTurnsForScope,
    wikiQueueChangeReasons,
    scheduleWikiHandoffTurn,
    scheduleWikiHandoffTurnsForScope,
    clearAllHandoffTimersForRunner
} = require("./main/handoff-turns");
const {
    buildAgentCliCommand,
    buildRunnerPtyEnv
} = require("./main/agent-cli-command");
const {
    initBoardWatcher,
    projectScopeKey,
    ensureBoardWatcher,
    disposeBoardWatcherForScope,
    disposeAllBoardWatchers,
    disposeAllBoardWatchersAsync
} = require("./main/board-watcher");
const {
    userShareRoot,
    roleInstructionPath,
    startupRulesPath,
    commonStartupRulesPath,
    buildInitialPrompt
} = require("./main/initial-prompt");
const {
    macOsDesktopSpaceKeyCodes,
    defaultMacOsDesktopSpaceNumber,
    windowStatePath,
    normalizeWindowBounds,
    readWindowState,
    writeWindowState,
    trackWindowState,
    switchToMacOsDesktopSpace
} = require("./main/window-state");
const {
    initCliRunnerControl,
    cliRunnerControlRequestKey,
    stateHasCliRunnerControlRequest,
    markCliRunnerControlFailed,
    processCliRunnerControlRequest,
    reconcileCliRunnerControlRequestsForScope
} = require("./main/cli-runner-control");
const {
    defaultBoardDirName: getDefaultBoardDirName,
    shortHash,
    normalizePtyProjectRoot,
    normalizePtyBoardDirName,
    ptyScopeMatches,
    parsePositiveIntegerOrDefault,
    ptyRunnerKey,
    ptyRunnerKeyForScope,
    ptyRunnerMeta,
    ptyRunnerPublicId,
    ptyRunnerMetaForScope,
    getPtyRunnerForScope,
    ptyRunnerMatchesRequestedScope,
    ptyRunnerScopedPayload
} = require("./main/pty-scope");
const {
    normalizeRunnerRole,
    boardRelPath,
    readMarkdownTitleSync,
    safeIsFileSync,
    migrateLegacyTicketQueueSync,
    migrateLegacyTicketQueuesSync,
    listQueueFilesSync,
    markdownScalarInSectionSync,
    plannerQueueFileIsActionableSync,
    workerInprogressFileIsActionableSync,
    workItemQueueFilePattern,
    walkMarkdownFilesSync,
    computeWikiSourceHashSync,
    wikiPendingReviewPathsSync,
    wikiHasPendingRunnerWorkSync,
    ticketClaimedByRunnerIdSync,
    normalizeTodoIdSync,
    runnerActiveTicketIdSync,
    runnerStateFieldSync,
    blockedActiveTicketFromPathSync,
    runnerBlockedActiveTicketSync,
    ticketAllowedPathsSync,
    allowedPathIsConcreteRepoPathSync,
    normalizeRelPathSync,
    workerTodoFileIsClaimableSync,
    stripMarkdownTicksSync,
    gitBranchExistsSync,
    gitTrackedDirtySummarySync,
    gitOutputSync,
    gitStatusOkSync,
    queueHasPendingWork,
    computeQueueFingerprint,
    appendRunnerLog
} = require("./main/board-queue");
const {
    safeCodexHomeSegment,
    normalizeCodexHistoryMode,
    defaultCodexHomePath,
    defaultClaudeHomePath,
    copyCodexHomeFileIfFresh,
    ensureCodexRunnerHome,
    supportedCodexProfile,
    normalizeRunnerReasoningValue,
    stripTerminalControlSequences,
    hasActiveCodexHookTrustPrompt,
    scheduleCodexHookTrustPromptAccept,
    startCodexHookTrustPromptWatchdog,
    clearCodexHookTrustPromptAutomation
} = require("./main/codex");
const {
    DEFAULT_MEMORY_CEILING_MB,
    DEFAULT_MEMORY_CHECK_INTERVAL_SECONDS,
    DEFAULT_MEMORY_RESTART_COOLDOWN_SECONDS,
    BYTES_PER_MEGABYTE,
    readMemoryCeilingConfig,
    bytesToMegabytes,
    cancellableInvocations,
    registerCancellableInvocation,
    clearCancellableInvocation,
    desktopSessionStatePath,
    writeJsonFileSync,
    markDesktopSessionStarted,
    markDesktopSessionClean,
    ptySessionPidsPath,
    readPtySessionPids,
    writePtySessionPids,
    addPtySessionPid,
    removePtySessionPid,
    clearPtySessionPids,
    reapPreviousPtySessionPids,
} = require("./main/process-control");
const {
    normalizeContextResetMode,
    resolveContextResetMode,
    scheduleContextReset,
    runnerIdForContextResetQueueChange,
    readPendingRunnerContextResetEvents,
    contextResetEventIsSchedulable,
    markRunnerInitialPromptSent,
    runnerInitialPromptWasSent,
    runnerPromptFileSegment,
    writeRunnerStartupPromptFile,
    buildRunnerStartupScan
} = require("./main/context-reset");

function ignoreBrokenPipe(stream: any) {
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

ensureDesktopCoreRegistered(repoRoot);

// Legacy Autoflow Stop hook 등록을 부팅 시 한 번 정리. 이전 설치가 만들어 둔
// ~/.codex/hooks.json 과 isolated codex home 의 hooks.json 잔재를 제거한다.
const {cleanupLegacyStopHooks} = require("./main/legacy-stop-hook-cleanup");
cleanupLegacyStopHooks();

initBoardWatcher({
    clearReadBoardCachesForScope,
    reconcileCliRunnerControlRequestsForScope
});

initCliRunnerControl({
    spawnRunnerPtySession,
    readRunnerStateValues,
    writeRunnerStateAtomic,
    killPidForcefully,
    clearReadBoardCachesForScope,
    publishBoardChange
});

if (process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA) {
    app.setPath("userData", process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA);
    app.setPath("sessionData", path.join(process.env.AUTOFLOW_DESKTOP_DEV_USER_DATA, "session"));
}

const allowedCommands = new Set([
    "init",
    "status",
    "metrics",
    "watch-bg",
    "watch-status",
    "watch-stop"
]);
const allowedRunnerActions = new Set(["start", "stop", "restart", "remove"]);
const allowedWatcherActions = new Set(["start", "stop", "status"]);
const allowedWikiActions = new Set(["update", "lint", "query"]);
const RUNNER_RESOURCE_USAGE_MAX_CPU_PERCENT = 180;
const RUNNER_RESOURCE_USAGE_MAX_MEMORY_PERCENT = 12;
// Roles accepted by `autoflow run <role>` per app/cli/system/run-role.ts
// case statement. Active: worker / planner / verifier / wiki (with their
// ticket, plan, wiki-maintainer aliases).
// PRD authoring: spec.
const allowedRunRoles = new Set([
    "ticket", "worker",
    "planner", "plan",
    "spec", "prd-author",
    "verifier",
    "wiki", "wiki-maintainer"
]);
// Active runner roles: worker / planner / verifier / wiki-maintainer (with
// plan / wiki aliases). Coordinator stays idle/noop when encountered.
// Mirrors runner role validation in app/cli/system/runners.ts.
const allowedRunnerRoles = new Set([
    "worker", "ticket",
    "planner", "plan",
    "verifier",
    "wiki-maintainer", "wiki"
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
    "autoflow_token_report_count",
    "autoflow_llm_request_count",
    "completion_rate_percent"
];

const metricSnapshotStringKeys = new Set([
    "project_root",
    "board_root"
]);


const defaultBoardDirName = scaffoldManifestValue("install", "default_board_dir", ".autoflow");

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
const activeChildProcesses = new Set();
// invocationId → child process. Lets the renderer cancel a long-running
// CLI call (runRole / controlWiki --synth / installBoard / etc.) by id.
const agentAuthStatusCache = new Map();
let runnerShutdownInProgress = false;
let appQuitInProgress = false;
let memoryCeilingIntervalId = null;
let lastMemoryCeilingRestartAt = 0;
let memoryCeilingRestartInProgress = false;


async function performMemoryCeilingRestart() {
    if (memoryCeilingRestartInProgress || runnerShutdownInProgress) {
        return;
    }
    memoryCeilingRestartInProgress = true;
    runnerShutdownInProgress = true;

    try {
        const shutdownTimeoutMs = 5000;
        const cleanup = shutdownAllRunners({allowWhileInProgress: true}).catch(() => 0);
        const timeout = new Promise((resolve) => setTimeout(resolve, shutdownTimeoutMs));
        await Promise.race([cleanup, timeout]);
        try {
            await forceKillSurvivingRunners();
        } catch {
        }
        markDesktopSessionClean("memory_ceiling_relaunch");
    } finally {
        try {
            app.relaunch();
        } catch {
        }
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


function cancelInvocation(invocationId: any) {
    if (typeof invocationId !== "string" || !invocationId) {
        return {ok: false, cancelled: false, reason: "invalid_id"};
    }
    const child = cancellableInvocations.get(invocationId);
    if (!child) {
        return {ok: true, cancelled: false, reason: "not_found"};
    }
    try {
        terminateAutoflowChild(child, "cancelled by renderer");
    } catch (error: any) {
        return {ok: false, cancelled: false, reason: error.message || "kill_failed"};
    }
    cancellableInvocations.delete(invocationId);
    return {ok: true, cancelled: true};
}

function appConfig() {
    return {
        defaultProjectRoot: process.env.AUTOFLOW_DESKTOP_DEFAULT_PROJECT_ROOT || "",
        blockedProjectRoots: [],
        defaultBoardDirName
    };
}

function sameResolvedPath(left: any, right: any) {
    const normalize = (value) => path.resolve(String(value || "")).replace(/[\\/]+$/, "");
    return normalize(left) === normalize(right);
}

function isPathInside(rootPath: any, targetPath: any) {
    const relativePath = path.relative(rootPath, targetPath);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function resolveExistingPathInside(rootPath: any, targetPath: any, options: any = {}) {
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
        return {ok: true, targetPath: resolvedTarget, relativePath, stderr: ""};
    } catch (error: any) {
        return {
            ok: false,
            targetPath: resolvedTarget,
            relativePath,
            stderr: error && error.message ? error.message : String(error)
        };
    }
}


// PTY spawn PID registry — records every shell PID we spawn during this
// desktop session so a subsequent crash leaves us a precise list to reap on
// next boot. Lives in userData (same dir as desktop-session-state.json) so it
// survives process death.


// Startup reaper for PTY-side survivors. Reads the precise PID list written
// during the previous desktop session and kills any that are still alive.
// More targeted than the ps-based legacy reaper — covers the case where the
// desktop crashed while node-pty children were still attached.

// Per-live-PTY metadata captured at spawn time so prompts and main can update
// the runner state file on lifecycle events.
// Internal PTY keys include the project scope; board-facing runnerId remains
// the stable runner id (`planner`, `worker`, etc.).
//   ptyRunnerKey -> { runnerId, role, agent, projectRoot, boardDirName, startedAt }


function stopPtyRunnersForScope(scope: any = {}, opts: any = {}) {
    const ptyManager = (globalThis as any).__autoflowPtyManager;
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
        if (ptyManager.stop(runnerKey, {force: Boolean(opts.force)})) {
            stoppedRunnerKeys.add(runnerKey);
            stoppedRunnerIds.add(meta.runnerId || runnerKey);
        }
    }

    for (const runner of ptyManager.list()) {
        if (!runner || stoppedRunnerKeys.has(runner.id)) continue;
        if (runner.status !== "running") continue;
        if (!ptyRunnerMatchesRequestedScope(ptyManager, runner.id, scope)) continue;
        forceKillRunnerPid(runner);
        if (ptyManager.stop(runner.id, {force: Boolean(opts.force)})) {
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


// Persist a minimal state file so the renderer's existing UI (slider /
// badges / activity card) keeps working while PTY runner state is the source
// of truth.


async function spawnRunnerPtySession(opts: any = {}, source: any = "manual") {
    const ptyManager = (globalThis as any).__autoflowPtyManager;
    if (!ptyManager || typeof ptyManager.isAvailable !== "function" || !ptyManager.isAvailable()) {
        return {ok: false, error: "node-pty unavailable (rebuild required)"};
    }
    const projectRoot = String(opts.projectRoot || "");
    const boardDirName = String(opts.boardDirName || ".autoflow");
    const runnerId = String(opts.runnerId || "");
    if (!runnerId || !projectRoot) {
        return {ok: false, error: "runnerId and projectRoot required"};
    }
    const diskRunnerConfig = readRunnerConfigBlock(projectRoot, boardDirName, runnerId);
    const role = resolveRunnerStartRole({
        projectRoot,
        boardDirName,
        runnerId,
        diskRunnerConfig,
        requestedRole: opts.role
    });
    const normalizedRole = normalizeRunnerRole(role);
    if (normalizedRole === "coordinator") {
        return {ok: false, error: "coordinator is not a runner; use planner, worker, verifier, or wiki runners."};
    }
    const agent = String(diskRunnerConfig.agent || opts.agent || "codex").toLowerCase();
    const model = String(diskRunnerConfig.model ?? opts.model ?? "");
    const reasoning = String(diskRunnerConfig.reasoning ?? opts.reasoning ?? "");
    const codexHistory = normalizeCodexHistoryMode(diskRunnerConfig.codex_history ?? opts.codexHistory ?? "");
    if (!(await commandExists(agent))) {
        return {ok: false, error: `${agent} CLI not found in shell PATH`};
    }
    if (normalizedRole === "wiki-maintainer") {
        ensureWikiAssignmentForPendingWorkSync({
            projectRoot,
            boardDirName,
            boardRoot: path.join(projectRoot, boardDirName),
            runnerId
        });
    }
    const initialPrompt = buildInitialPrompt({
        role: normalizedRole,
        agent,
        runnerId,
        projectRoot,
        boardDirName
    });
    const initialPromptFile = agent === "codex"
        ? writeRunnerStartupPromptFile({projectRoot, boardDirName, runnerId, prompt: initialPrompt})
        : "";
    const command = buildAgentCliCommand(agent, model, reasoning, {boardDirName, initialPromptFile});
    if (!command) {
        return {ok: false, error: `unsupported agent: ${agent}`};
    }
    const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
    try {
        const existing = ptyManager.get(runnerKey);
        const existingMatchesScope = ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, {
            projectRoot,
            boardDirName
        });
        const freshSessionRequested = Boolean(opts.freshSession) || normalizedRole === "wiki-maintainer";
        if (existing && existing.status === "running") {
            if (freshSessionRequested || !existingMatchesScope || (existing.command && existing.command !== command)) {
                // 기존 PTY 가 살아있지만 fresh 가 요청됐거나 scope/command 가 바뀌었으면 죽이고 새로 spawn.
                if (Number.isInteger(existing.pid) && existing.pid > 0) {
                    killPidForcefully(existing.pid);
                    removePtySessionPid(existing.pid);
                }
                ptyManager.stop(runnerKey, {force: true});
                await new Promise((resolve) => setTimeout(resolve, 300));
            } else {
                // 동일 scope/command 로 이미 running 인 PTY 가 있다 — 새 spawn 하지 않고 기존을 그대로 반환.
                // 중복 spawn (race 로 인한 worker PTY 2개 동시 실행) 을 막는다.
                return {
                    ok: true,
                    runnerId,
                    pid: existing.pid,
                    status: existing.status,
                    stdout: "",
                    reused: true
                };
            }
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
        rememberProjectScope({projectRoot, boardDirName});
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
            control_action: "",
            control_source: "",
            control_requested_at: "",
            control_force: "",
            spawn_source: source
        });
        try {
            addPtySessionPid({pid: runner.pid, runnerId, role: normalizedRole, agent, spawnedAt: startedAt});
        } catch {
        }
        const promptDelay = 6000;
        if (agent === "codex" && initialPromptFile) {
            markRunnerInitialPromptSent(runnerKey);
        } else {
            setTimeout(() => {
                const paste = agent === "claude" ? "bracketed" : "plain";
                const ok = ptyManager.writePrompt(runnerKey, initialPrompt, {paste});
                if (ok) markRunnerInitialPromptSent(runnerKey);
            }, promptDelay);
        }
        setTimeout(() => {
            try {
                const snap = ptyManager.snapshot(runnerKey) || "";
            } catch (err: any) {
            }
        }, promptDelay + 2500);
        return {ok: true, runnerId, pid: runner.pid, status: runner.status, stdout: ""};
    } catch (err: any) {
        return {ok: false, error: String(err && err.message ? err.message : err)};
    }
}


// Build the literal shell command to type into a PTY shell so the agent CLI
// runs in interactive (long-lived) mode. The user will see this exactly as
// if they typed it themselves. Disable destructive prompts via per-CLI flags
// so the agent can act without blocking on (y/n) prompts.


// Initial prompt sent once after the agent CLI is up. The Desktop start button
// opens the runner PTY for explicit user starts, then injects compact startup
// commands plus links to the expanded rule files instead of pasting them.


function clearReadBoardDiagnosticCacheForScope(scope: any = {}) {
    const projectRoot = scope.projectRoot || "";
    const boardDirName = scope.boardDirName || defaultBoardDirName;
    for (const key of readBoardDiagnosticCache.keys()) {
        const [, cachedProjectRoot, cachedBoardDirName] = String(key).split("\0");
        if (cachedProjectRoot === projectRoot && cachedBoardDirName === boardDirName) {
            readBoardDiagnosticCache.delete(key);
        }
    }
}

function clearReadBoardCachesForScope(scope: any = {}) {
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


function rememberProjectScope(options: any) {
    if (!options || typeof options.projectRoot !== "string" || !options.projectRoot) {
        return;
    }
    const boardDirName = options.boardDirName || defaultBoardDirName;
    const key = projectScopeKey(options.projectRoot, boardDirName);
    const scope = {projectRoot: options.projectRoot, boardDirName};
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
    void reconcileCliRunnerControlRequestsForScope(scope, ["scope-remembered"]).catch(() => {
    });
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
        trafficLightPosition: {x: 16, y: 16},
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
                win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});
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

function commandLabel(args: any) {
    return args.join(" ");
}

function scopedArgs(command: any, options: any = {}) {
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

function inProcessCliKey(args: any) {
    if (!args.length) return "";
    if (args[0] === "runners") {
        return args[1] ? `runners ${args[1]}` : "runners";
    }
    return args[0];
}

function canRunInProcess(args: any) {
    return inProcessCliCommands.has(inProcessCliKey(args));
}

function runAutoflowInProcess(args: any, label: any) {
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
    } catch (error: any) {
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

function runAutoflowArgs(args: any, options: any = {}) {
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
                timeoutSignal.addEventListener("abort", abortHandler, {once: true});
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

function isSuccessfulAutoflowResult(code: any, stdout: any) {
    if (code !== 0) {
        return false;
    }

    const status = parseKeyValueOutput(stdout).status;
    return status !== "blocked" && status !== "fail" && status !== "error";
}

function runAutoflow(command: any, options: any = {}) {
    return runAutoflowArgs(scopedArgs(command, options), options);
}

function readBoardDiagnosticCacheKey(command: any, options: any = {}) {
    return [
        command,
        options.projectRoot || "",
        options.boardDirName || defaultBoardDirName
    ].join("\0");
}

function cloneRunResult(result: any) {
    return result ? {...result} : result;
}

function markReadBoardFallback(result: any, fallback: any) {
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

function diagnosticErrorMessage(error: any, fallbackMessage: any) {
    if (!error) {
        return fallbackMessage;
    }
    if (typeof error === "string") {
        return error;
    }
    return error.message || String(error) || fallbackMessage;
}

function readBoardDiagnosticErrorResult(command: any, options: any = {}, error: any, fallback: any = {}) {
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

function withReadBoardDiagnosticTimeout(source: any, task: any, fallbackResult: any, timeoutMs: any = readBoardDiagnosticTimeoutMs) {
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
                settle(fallbackResult(error, {cacheStatus: "error"}));
            });
    });
}

function runReadBoardDiagnostic(command: any, options: any = {}) {
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

function startCachedAutoflowRefresh(command: any, options: any, key: any, entry: any) {
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

function runAutoflowCached(command: any, options: any = {}, ttlMs: any = readBoardDiagnosticCacheTtlMs) {
    const key = readBoardDiagnosticCacheKey(command, options);
    const entry = readBoardDiagnosticCache.get(key);
    const now = Date.now();

    if (entry?.result && now - entry.updatedAt < ttlMs) {
        return Promise.resolve(markReadBoardFallback(cloneRunResult(entry.result), {cacheStatus: "fresh"}));
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

function emptyCachedAutoflowResult(command: any, options: any = {}, fallback: any = {}) {
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

function runAutoflowCachedOrRefresh(command: any, options: any = {}, ttlMs: any = readBoardDiagnosticCacheTtlMs) {
    const key = readBoardDiagnosticCacheKey(command, options);
    const entry = readBoardDiagnosticCache.get(key);
    const now = Date.now();

    if (entry?.result && now - entry.updatedAt < ttlMs) {
        return Promise.resolve(markReadBoardFallback(cloneRunResult(entry.result), {cacheStatus: "fresh"}));
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
            .then((result) => markReadBoardFallback(cloneRunResult(result), {cacheStatus: "miss"}));
    }

    return entry.promise.then((result) =>
        markReadBoardFallback(cloneRunResult(result), {
            refreshInFlight: true,
            cacheStatus: "pending"
        })
    );
}

function clearReadBoardDiagnosticCache(command: any, options: any = {}) {
    readBoardDiagnosticCache.delete(readBoardDiagnosticCacheKey(command, options));
}

function parseKeyValueOutput(output: any) {
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
    const installTypes = new Set(["host", "user_home"]);
    for (const entry of readScaffoldManifestSourceEntries().filter((sourceEntry) => installTypes.has(sourceEntry.type))) {
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

function renderProjectTemplate(content: any, boardDirName: any) {
    return content
        .replaceAll("{{BOARD_DIR}}", boardDirName || defaultBoardDirName)
        .replaceAll("{{SHARE_ROOT}}", userShareRoot())
        .replaceAll("{{CODEX_HOME}}", defaultCodexHomePath())
        .replaceAll("{{CLAUDE_HOME}}", defaultClaudeHomePath())
        .replaceAll("{{USER_HOME}}", os.homedir());
}

async function syncProjectHostSkillAsset(projectRoot: any, boardDirName: any, asset: any) {
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
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    await fs.mkdir(path.dirname(targetPath), {recursive: true});
    await fs.writeFile(targetPath, sourceContent, "utf8");
    return "created";
}

async function ensureProjectHostSkills(options: any = {}) {
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
        } catch (error: any) {
            result.ok = false;
            result.stderr = error.message || String(error);
            return result;
        }
    }

    return result;
}

function commandExists(command: any) {
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

function runCommandWithTimeout(command: any, args: any = [], options: any = {}, timeoutMs: any = 5000) {
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
            } catch {
            }
            finish({ok: false, code: -1, stdout, stderr: `${stderr}\n[timeout]`});
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
            finish({ok: false, code: -1, stdout, stderr: `${stderr}${error.message || String(error)}`});
        });
        child.on("close", (code) => {
            finish({ok: code === 0, code, stdout, stderr});
        });
    });
}

function sanitizedProcessEnv() {
    const env = {...process.env};
    delete env.npm_config_prefix;
    delete env.NPM_CONFIG_PREFIX;
    env.PATH = augmentedPathValue(env.PATH);
    if (!env.SHELL) {
        env.SHELL = userLoginShell();
    }
    return env;
}

function normalizeAgentKey(agent: any) {
    return String(agent || "").trim().toLowerCase();
}

async function readJsonIfExists(filePath: any) {
    try {
        const content = await fs.readFile(filePath, "utf8");
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function uniqueStringValues(values: any) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function stringListValue(value: any) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === "string");
    }

    return typeof value === "string" ? [value] : [];
}

function settingsEnvValue(settings: any, key: any) {
    const env = settings && typeof settings.env === "object" ? settings.env : null;
    return typeof env?.[key] === "string" ? env[key] : "";
}

function normalizeClaudeModelValue(value: any) {
    const trimmed = String(value || "").trim();
    return trimmed;
}

function isPreferredClaudeModel(value: any) {
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
        } catch {
        }
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
            reasoning: normalizeRunnerReasoningValue("claude", claudeReasoning),
            supportsReasoning: true
        }
    };
}

function parseRunnerListOutput(output: any) {
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
            activeRole: values[`${prefix}active_role`] || "",
            assignmentRole: values[`${prefix}assignment_role`] || "",
            assignmentStatus: values[`${prefix}assignment_status`] || "",
            assignedItemRef: values[`${prefix}assigned_item_ref`] || "",
            activeItem: values[`${prefix}active_item`] || "",
            activeTicketId: values[`${prefix}active_ticket_id`] || "",
            activeTicketTitle: values[`${prefix}active_ticket_title`] || "",
            activeTicketPath: values[`${prefix}active_ticket_path`] || "",
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
            cumulativeLlmRequestCount: positiveIntegerValue(values[`${prefix}cumulative_llm_request_count`]),
            lastTurnTokens: positiveIntegerValue(values[`${prefix}last_turn_tokens`]),
            lastTurnTotalTokens: positiveIntegerValue(values[`${prefix}last_turn_total_tokens`]),
            lastTurnInputTokens: positiveIntegerValue(values[`${prefix}last_turn_input_tokens`]),
            lastTurnOutputTokens: positiveIntegerValue(values[`${prefix}last_turn_output_tokens`]),
            lastTurnCacheReadTokens: positiveIntegerValue(values[`${prefix}last_turn_cache_read_tokens`]),
            lastTurnCacheCreateTokens: positiveIntegerValue(values[`${prefix}last_turn_cache_create_tokens`]),
            lastTurnLlmRequestCount: positiveIntegerValue(values[`${prefix}last_turn_llm_request_count`]),
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

function extractAgentConversation(text: any, maxChars: any = 4000) {
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

async function readTailText(filePath: any, limitBytes: any = runnerTerminalPreviewLimitBytes) {
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

function runnerLiveLogPaths(_runner: any, _boardRoot: any) {
    return [];
}

function runnerArtifactLogPaths(_runner: any) {
    return [];
}

function runnerQuotaInfoFromText(text: any) {
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
        return {quotaLimited: false, quotaResetLabel: ""};
    }

    const resetMatch = clean.match(/\bresets?\s+([^\r\n]+)/i);
    return {
        quotaLimited: true,
        quotaResetLabel: resetMatch?.[1]?.trim() || ""
    };
}

function combineRunnerQuotaInfo(current: any, next: any) {
    if (current.quotaLimited) {
        return current.quotaResetLabel || !next.quotaResetLabel
            ? current
            : {...current, quotaResetLabel: next.quotaResetLabel};
    }

    return next.quotaLimited ? next : current;
}

function extractAuthUrl(text: any) {
    const urls = (text || "").match(authUrlPattern) || [];
    if (!urls.length) return "";
    const authLike = urls.find((url) => /auth|login|oauth|device|account|signin|sign-in/i.test(url));
    return authLike || urls[0] || "";
}

function runnerAuthInfoFromText(text: any, agent: any) {
    const clean = (text || "").replace(conversationAnsiEscapePattern, "");
    if (!clean.trim()) {
        return {authRequired: false, authMessage: "", authUrl: "", authProviderBlocked: false};
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
        return {authRequired: false, authMessage: "", authUrl: "", authProviderBlocked: false};
    }

    const label = agentDisplayLabels[normalizeAgentKey(agent)] || agent || "Agent";
    return {
        authRequired: true,
        authMessage: `${label} 로그인이 필요합니다.`,
        authUrl,
        authProviderBlocked: false
    };
}

function combineRunnerAuthInfo(current: any, next: any) {
    if (next.authProviderBlocked) {
        return next;
    }
    if (current.authProviderBlocked) {
        return current;
    }
    if (current.authRequired) {
        return current.authUrl || !next.authUrl ? current : {...current, authUrl: next.authUrl};
    }

    return next.authRequired ? next : current;
}

async function agentIsLoggedIn(agent: any) {
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
            {cwd: repoRoot, env: sanitizedProcessEnv()},
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
            {cwd: repoRoot, env: sanitizedProcessEnv()},
            5000
        );
        const output = `${result.stdout || ""}\n${result.stderr || ""}`;
        loggedIn = result.ok && /\blogged in\b/i.test(output) && !/\bnot logged in\b/i.test(output);
    }

    agentAuthStatusCache.set(key, {checkedAt: now, loggedIn});
    return loggedIn;
}

async function continueRunnerAuth(options: any = {}) {
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

async function recentRunnerArtifactLogPaths(_runner: any, _boardRoot: any, _maxFiles: any = 10) {
    return [];
}

async function runnerQuotaInfo(runner: any, boardRoot: any) {
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
        quotaInfo = combineRunnerQuotaInfo(quotaInfo, runnerQuotaInfoFromText(text));
        if (quotaInfo.quotaLimited && quotaInfo.quotaResetLabel) {
            break;
        }
    }

    return quotaInfo;
}

async function runnerAuthInfo(runner: any, boardRoot: any) {
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
        authInfo = combineRunnerAuthInfo(authInfo, runnerAuthInfoFromText(text, runner.agent));
        if (authInfo.authRequired && authInfo.authUrl) {
            break;
        }
    }

    if (authInfo.authRequired && !authInfo.authProviderBlocked && await agentIsLoggedIn(runner.agent)) {
        return {authRequired: false, authMessage: "", authUrl: ""};
    }

    return authInfo;
}

async function runnerConversationPreview(runner: any, boardRoot: any) {
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


async function pathExists(filePath: any) {
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

function positiveIntegerValue(value: any) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function usageReportFromJsonLine(line: any) {
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

function ptyUsageReportsFromChunk(runnerId: any, chunk: any) {
    const state = ptyTokenUsageParseState.get(runnerId) || {tail: ""};
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

function reportPtyUsageViaRunnerTool(runnerId: any, usage: any, options: any = {}) {
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
    } catch (error: any) {
    }
}

function runSessionTokenUsageImportForRunner(runnerId: any) {
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
    } catch (error: any) {
    } finally {
        sessionTokenUsageImportInflight.delete(runnerId);
        if (sessionTokenUsageImportPending.has(runnerId)) {
            sessionTokenUsageImportPending.delete(runnerId);
            scheduleSessionTokenUsageImportForRunner(runnerId);
        }
    }
}

function scheduleSessionTokenUsageImportForRunner(runnerId: any, delayMs: any = sessionTokenUsageImportDelayMs()) {
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

function flushSessionTokenUsageImportForRunner(runnerId: any) {
    const existing = sessionTokenUsageImportTimers.get(runnerId);
    if (existing) clearTimeout(existing);
    sessionTokenUsageImportTimers.delete(runnerId);
    runSessionTokenUsageImportForRunner(runnerId);
}


async function readRunnerTokenUsage(boardRoot: any, runners: any = []) {
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
        } catch {
        }
    }

    return totals;
}

async function enrichRunnerTerminalPreviews(runners: any, boardRoot: any) {
    const tokenUsageByRunner = await readRunnerTokenUsage(boardRoot, runners);
    return Promise.all(
        runners.map(async (runner) => {
            const conversationPreview = await runnerConversationPreview(runner, boardRoot);
            const quotaInfo = await runnerQuotaInfo({...runner, conversationPreview}, boardRoot);
            const authInfo = await runnerAuthInfo({...runner, conversationPreview}, boardRoot);
            const parsedTokenUsage = Math.max(
                positiveIntegerValue(runner.tokenUsage),
                positiveIntegerValue(runner.cumulativeTokens)
            );
            const stateTokenUsage = tokenUsageByRunner.get(runner.id);
            return {
                ...runner,
                ...quotaInfo,
                ...authInfo,
                conversationPreview,
                tokenUsage: typeof stateTokenUsage === "number" ? stateTokenUsage : parsedTokenUsage
            };
        })
    );
}

async function enrichWikiRunnerBackgroundTasks(runners: any, boardRoot: any) {
    if (!Array.isArray(runners) || runners.length === 0) return;
    const wikiRunner = runners.find((runner) => String(runner?.role || "").toLowerCase().includes("wiki"));
    if (!wikiRunner) return;

    const stateDir = path.join(boardRoot, "runners", "state");
    const indexState = await readJsonIfExists(path.join(stateDir, "wiki-index-refresh.json")) || {};
    let pid = positiveIntegerValue(indexState.pid);
    if (!pid) {
        try {
            pid = positiveIntegerValue((await fs.readFile(path.join(stateDir, "wiki-index-refresh.lock", "pid"), "utf8")).trim());
        } catch {
        }
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

function enrichLivePtyRunnerActivity(runners: any, projectRoot: any, boardDirName: any) {
    const ptyManager = (globalThis as any).__autoflowPtyManager;
    if (!ptyManager || typeof ptyManager.get !== "function" || !Array.isArray(runners)) return;
    for (const runner of runners) {
        const runnerId = String(runner?.id || "").trim();
        if (!runnerId) continue;
        const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
        const liveRunner = ptyManager.get(runnerKey);
        if (!liveRunner || liveRunner.status !== "running") {
            runner.livePtyBusy = false;
            continue;
        }
        const snapshot = typeof ptyManager.snapshot === "function"
            ? ptyManager.snapshot(runnerKey) || ""
            : "";
        runner.livePtyBusy = runnerSnapshotLooksBusy(snapshot.slice(-6000));
    }
}

function countRunnerQueueStatus(runner: any, boardRoot: any) {
    const role = String(runner?.role || "").toLowerCase();
    const runnerId = String(runner?.id || "").trim().toLowerCase();
    const assignmentStatus = String(runner?.assignmentStatus || "").toLowerCase();
    const assignedItemRef = String(runner?.assignedItemRef || "").trim();
    const empty = {
        queueStatus: "none",
        queueStatusLabel: "처리할 작업 없음",
        queueStatusDetail: "",
        queueClaimableCount: 0,
        queueBlockedCount: 0,
        queuePendingCount: 0
    };
    try {
        if (["leased", "running"].includes(assignmentStatus) && assignedItemRef) {
            return {
                queueStatus: "owned",
                queueStatusLabel: "배정 작업 진행 중",
                queueStatusDetail: assignedItemRef.replace(/^tickets\//, ""),
                queueClaimableCount: 0,
                queueBlockedCount: 0,
                queuePendingCount: 0
            };
        }
        if (role === "worker" || role === "ticket") {
            const inprogress = listQueueFilesSync(boardRoot, "tickets/inprogress", workItemQueueFilePattern, 1000);
            const todo = listQueueFilesSync(boardRoot, "tickets/todo", workItemQueueFilePattern, 1000);
            const ownedInProgress = inprogress.filter((file) => ticketClaimedByRunnerIdSync(file) === runnerId);
            const claimable = todo.filter((file) => workerTodoFileIsClaimableSync(file));
            const blocked = Math.max(0, todo.length - claimable.length);
            if (ownedInProgress.some(workerInprogressFileIsActionableSync)) {
                return {
                    queueStatus: "owned",
                    queueStatusLabel: "진행 중인 티켓 확인 중",
                    queueStatusDetail: `${ownedInProgress.length}개 담당 중`,
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
                queueStatusDetail: "work item 대기열 비어 있음"
            };
        }
        if (role === "verifier") {
            const pending = listQueueFilesSync(boardRoot, "tickets/verifier", workItemQueueFilePattern, 1000).length;
            return pending > 0
                ? {
                    queueStatus: "claimable",
                    queueStatusLabel: "검증 티켓 확인 대기",
                    queueStatusDetail: `${pending}개 대기`,
                    queueClaimableCount: pending,
                    queueBlockedCount: 0,
                    queuePendingCount: pending
                }
                : {...empty, queueStatusDetail: "검증 대기열 비어 있음"};
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
                : {...empty, queueStatusDetail: "PRD 대기열 비어 있음"};
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
                : {...empty, queueStatusDetail: "위키 변경 없음"};
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

async function enrichRunnerQueueStatus(runners: any, boardRoot: any) {
    for (const runner of runners || []) {
        Object.assign(runner, countRunnerQueueStatus(runner, boardRoot));
    }
}

function usefulPreviewValue(value: any) {
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

function stripWorkflowTitlePrefix(value: any) {
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

function markdownPreviewTitle(content: any, fallback: any) {
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

function extractTicketScalar(content: any, field: any) {
    const re = new RegExp(`^-\\s*${field.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*:\\s*(.+?)\\s*$`, "im");
    const match = content.match(re);
    return match ? match[1].replace(/^`+|`+$/g, "").trim() : "";
}

const ticketPrdKeyPattern = /PRD-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+/i;

// Resolve a ticket's parent PRD key. Tickets carry `- PRD Key: ...`, while
// older tickets may use `Project Key`, `Key`, or `Source PRD`. Preserve the
// namespace segment when present so PRD-demoon2016-007 still matches its PRD.
function extractTicketPrdKey(content: any) {
    const direct =
        extractTicketScalar(content, "PRD Key") ||
        extractTicketScalar(content, "Project Key") ||
        extractTicketScalar(content, "Key");
    const sourcePrd = extractTicketScalar(content, "Source PRD");
    const sourceMatch = sourcePrd.match(ticketPrdKeyPattern);
    const raw = direct || (sourceMatch ? sourceMatch[0] : "");
    if (!raw) return "";
    const norm = raw.match(ticketPrdKeyPattern);
    return norm ? norm[0].replace(/^prd-/i, "PRD-") : "";
}

async function readMarkdownPreview(filePath: any) {
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

async function readFilePrefixText(filePath: any, limitBytes: any = runnerLogPreviewReadLimitBytes) {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size <= 0) {
        return {content: "", stat};
    }

    const bytesToRead = Math.min(stat.size, Math.max(1, limitBytes));
    const handle = await fs.open(filePath, "r");
    try {
        const buffer = Buffer.alloc(bytesToRead);
        const {bytesRead} = await handle.read(buffer, 0, bytesToRead, 0);
        return {content: buffer.subarray(0, bytesRead).toString("utf8"), stat};
    } finally {
        await handle.close();
    }
}

async function readTextPreview(filePath: any) {
    try {
        const {content, stat} = await readFilePrefixText(filePath);
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

function byName(a: any, b: any) {
    return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
}

function byMostRecent(a: any, b: any) {
    return String(b?.modifiedAt ?? "").localeCompare(String(a?.modifiedAt ?? ""));
}

// Walk a directory tree gathering absolute file paths matching `predicate`.
// Pure path discovery — never opens or reads file contents — so very large
// log directories (10k+ files, hundreds of MB) stay cheap. Callers that only
// need a top-N preview should use this helper plus `selectTopFilePaths` and
// then preview only the selected slice, instead of readFile-ing every file
// up front.
async function walkFilePaths(directory: any, recursive: any, predicate: any) {
    if (!(await pathExists(directory))) {
        return [];
    }

    const entries = await fs.readdir(directory, {withFileTypes: true});
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
async function selectTopFilePaths(filePaths: any, {limit, orderBy = "mtime"}: any = {}) {
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
                return {filePath, mtimeMs: stat.mtimeMs || 0};
            } catch {
                return {filePath, mtimeMs: 0};
            }
        })
    );
    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return stats.slice(0, limit).map((entry) => entry.filePath);
}

async function listMarkdownFiles(directory: any, recursive: any = false, options: any = {}) {
    if (!(await pathExists(directory))) {
        return [];
    }

    const paths = await walkFilePaths(directory, recursive, (name) => name.endsWith(".md"));
    const selected = await selectTopFilePaths(paths, options);
    const previews = await Promise.all(selected.map((filePath) => readMarkdownPreview(filePath)));
    return previews.sort(byName);
}

async function listTicketFolders(ticketsRoot: any) {
    if (!(await pathExists(ticketsRoot))) {
        return [];
    }

    const entries = await fs.readdir(ticketsRoot, {withFileTypes: true});
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

async function listTextFiles(directory: any, extensions: any, recursive: any = false, options: any = {}) {
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

function normalizeMetricSnapshot(rawSnapshot: any) {
    if (!rawSnapshot || typeof rawSnapshot !== "object") {
        return null;
    }

    const timestamp = typeof rawSnapshot.timestamp === "string" ? rawSnapshot.timestamp : "";
    if (!timestamp) {
        return null;
    }

    const snapshot = {timestamp};
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

async function readMetricsHistory(boardRoot: any) {
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
            const {bytesRead} = await handle.read(buffer, 0, bytesToRead, start);
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

async function readBoardFile(options: any = {}) {
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
            const {bytesRead} = await handle.read(buffer, 0, bytesToRead, 0);
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
    } catch (error: any) {
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

async function resolveStartupRulesDocument(options: any = {}) {
    const empty = {
        ok: false,
        filePath: "",
        name: "",
        stderr: ""
    };
    if (!options.projectRoot) {
        return {...empty, stderr: "Project root is required."};
    }

    const boardDirName = options.boardDirName || defaultBoardDirName;
    if (!isSafeBoardDirName(boardDirName)) {
        return {...empty, stderr: "Invalid board directory name."};
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
    } catch (error: any) {
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

async function readStartupRules(options: any = {}) {
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
    } catch (error: any) {
        return {
            ...empty,
            stderr: error && error.message ? String(error.message) : "Startup rule document could not be read."
        };
    }
}

async function writeStartupRules(options: any = {}) {
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
    } catch (error: any) {
        return {
            ...empty,
            content,
            stderr: error && error.message ? String(error.message) : "Startup rule document could not be saved."
        };
    }
}


async function readBoard({projectRoot, boardDirName}: any) {
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
        ? await ensureProjectHostSkills({projectRoot, boardDirName: normalizedBoardDirName})
        : null;

    const diagnosticTasks = [
        {
            source: "status",
            run: () => runAutoflowCachedOrRefresh("status", {projectRoot, boardDirName: normalizedBoardDirName}),
            fallback: (error) => readBoardDiagnosticErrorResult("status", {
                projectRoot,
                boardDirName: normalizedBoardDirName
            }, error)
        },
        {
            source: "runners",
            run: () => listRunnersCachedOrRefresh({projectRoot, boardDirName: normalizedBoardDirName}),
            fallback: (error) => runnerListErrorResult({projectRoot, boardDirName: normalizedBoardDirName}, error)
        },
        {
            source: "metrics",
            run: () => runReadBoardDiagnostic("metrics", {projectRoot, boardDirName: normalizedBoardDirName}),
            fallback: (error) => readBoardDiagnosticErrorResult("metrics", {
                projectRoot,
                boardDirName: normalizedBoardDirName
            }, error)
        },
        {
            source: "watch-status",
            run: () => runAutoflowCachedOrRefresh("watch-status", {projectRoot, boardDirName: normalizedBoardDirName}),
            fallback: (error) => readBoardDiagnosticErrorResult("watch-status", {
                projectRoot,
                boardDirName: normalizedBoardDirName
            }, error)
        }
    ];
    const diagnosticResults = exists
        ? await Promise.allSettled(diagnosticTasks.map((task) => task.run()))
        : [];
    const [
        statusResult,
        runnersResult,
        metricsResult,
        watcherResult
    ] = exists
        ? diagnosticResults.map((settled, index) => (
            settled.status === "fulfilled"
                ? settled.value
                : diagnosticTasks[index].fallback(settled.reason)
        ))
        : [null, null, null, null];
    const fallbackSources = [
        ["status", statusResult],
        ["runners", runnersResult],
        ["metrics", metricsResult],
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
        {limit: 16, orderBy: "mtime"}
    );
    const wikiFiles = await listMarkdownFiles(path.join(boardRoot, "wiki"), true, {
        limit: 80,
        orderBy: "mtime"
    });
    const metricsFiles = await listTextFiles(
        path.join(boardRoot, "metrics"),
        [".jsonl", ".json", ".env"],
        true,
        {limit: 8, orderBy: "mtime"}
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
                const codeSource = String(runner?.codeSource || "none");
                return codeSource !== "none" || role === "worker" || role === "ticket" || id === "worker" || id.startsWith("worker-");
            };
            const codeTotals = {
                files: 0,
                insertions: 0,
                deletions: 0,
                volume: 0,
                net: 0,
            };
            const codeEntries = new Map();
            for (const runner of (runnersResult?.runners || [])) {
                if (!ownsCodeMetrics(runner)) continue;
                const volume = positiveIntegerValue(runner.cumulativeCodeVolume);
                const insertions = positiveIntegerValue(runner.cumulativeCodeInsertions);
                const deletions = positiveIntegerValue(runner.cumulativeCodeDeletions);
                const files = positiveIntegerValue(runner.cumulativeCodeFilesChanged);
                if (volume <= 0 && insertions <= 0 && deletions <= 0 && files <= 0) continue;
                const key = runner.lastCodeTicketId ? `ticket:${runner.lastCodeTicketId}` : `runner:${runner.id || codeEntries.size}`;
                const reportedAtMs = Date.parse(String(runner.lastCodeReportedAt || "")) || 0;
                const entry = {
                    files,
                    insertions,
                    deletions,
                    volume,
                    net: Number.parseInt(String(runner.cumulativeCodeNetDelta || "0"), 10) || 0,
                    reportedAtMs,
                };
                const current = codeEntries.get(key);
                if (!current || reportedAtMs > current.reportedAtMs || (reportedAtMs === current.reportedAtMs && volume > current.volume)) {
                    codeEntries.set(key, entry);
                }
            }
            for (const entry of codeEntries.values()) {
                codeTotals.files += entry.files;
                codeTotals.insertions += entry.insertions;
                codeTotals.deletions += entry.deletions;
                codeTotals.volume += entry.volume;
                codeTotals.net += entry.net;
            }
            parsedMetrics.autoflow_code_files_changed_count = String(codeTotals.files);
            parsedMetrics.autoflow_code_insertions_count = String(codeTotals.insertions);
            parsedMetrics.autoflow_code_deletions_count = String(codeTotals.deletions);
            parsedMetrics.autoflow_code_volume_count = String(codeTotals.volume);
            parsedMetrics.autoflow_code_net_delta_count = String(codeTotals.net);
        }
    } catch {
    }
    try {
        const metricsHasTokenTotals =
            positiveIntegerValue(parsedMetrics.autoflow_token_usage_count) > 0 ||
            positiveIntegerValue(parsedMetrics.autoflow_token_cache_read_count) > 0 ||
            positiveIntegerValue(parsedMetrics.autoflow_llm_request_count) > 0 ||
            positiveIntegerValue(parsedMetrics.autoflow_token_report_count) > 0;
        if (!metricsHasTokenTotals) {
            let runnerTokenTotal = 0;
            let runnerTotalTokenTotal = 0;
            let runnerCacheReadTotal = 0;
            let runnerCacheCreateTotal = 0;
            let runnerRequestTotal = 0;
            let runnerReportFallbackCount = 0;
            for (const runner of (runnersResult?.runners || [])) {
                if (!runner?.id) continue;
                const cumulativeTokens = positiveIntegerValue(runner.cumulativeTokens);
                const requestCount = positiveIntegerValue(runner.cumulativeLlmRequestCount);
                runnerTokenTotal += cumulativeTokens;
                runnerTotalTokenTotal += positiveIntegerValue(runner.cumulativeTotalTokens) || cumulativeTokens;
                runnerCacheReadTotal += positiveIntegerValue(runner.cumulativeCacheReadTokens);
                runnerCacheCreateTotal += positiveIntegerValue(runner.cumulativeCacheCreateTokens);
                runnerRequestTotal += requestCount;
                if (requestCount <= 0 && cumulativeTokens > 0) runnerReportFallbackCount += 1;
            }
            const effectiveRequestCount = runnerRequestTotal || runnerReportFallbackCount;
            if (runnerTokenTotal > 0) parsedMetrics.autoflow_token_usage_count = String(runnerTokenTotal);
            if (runnerTotalTokenTotal > 0) parsedMetrics.autoflow_token_total_count = String(runnerTotalTokenTotal);
            if (runnerCacheReadTotal > 0) parsedMetrics.autoflow_token_cache_read_count = String(runnerCacheReadTotal);
            if (runnerCacheCreateTotal > 0) parsedMetrics.autoflow_token_cache_create_count = String(runnerCacheCreateTotal);
            if (effectiveRequestCount > 0) {
                parsedMetrics.autoflow_token_report_count = String(effectiveRequestCount);
                parsedMetrics.autoflow_llm_request_count = String(effectiveRequestCount);
            }
        }
    } catch {
    }

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

function readBoardSnapshotCacheKey(options: any = {}) {
    return [
        options.projectRoot || "",
        options.boardDirName || defaultBoardDirName
    ].join("\0");
}

function readBoardCached(options: any = {}) {
    const key = readBoardSnapshotCacheKey(options);
    const entry = readBoardSnapshotCache.get(key);
    const now = Date.now();
    if (entry?.result && now - entry.updatedAt < readBoardSnapshotCacheTtlMs) {
        return Promise.resolve(entry.result);
    }
    if (entry?.promise) {
        return entry.promise;
    }
    const nextEntry = entry || {result: null, updatedAt: 0, promise: null};
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

async function listRunners(options: any = {}) {
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
    enrichLivePtyRunnerActivity(runners, options.projectRoot, boardDirName);

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
            {maxBuffer: 2 * 1024 * 1024},
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
                        rows.set(pid, {pid, ppid, cpuPercent, memoryPercent, rssKb});
                    });
                resolve(rows);
            }
        );
    });

    processResourceSnapshotCache = {createdAt: now, promise};
    return promise;
}

async function runnerResourceUsage(options: any = {}) {
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

function runnerClaimKeys(runner: any) {
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

function isWorkerRunner(runner: any) {
    const role = String(runner?.role || "").trim().toLowerCase();
    if (role === "worker" || role === "ticket") {
        return true;
    }
    const normalizedId = canonicalWorkerRunnerId(runner?.id || "");
    return normalizedId === "worker" || /^worker-\d+$/.test(normalizedId);
}

function runnerClaimsTicketFromMeta(runner: any, ticketMeta: any) {
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

async function enrichRunnerActiveTicketFromFs(runners: any, boardRoot: any) {
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
        } catch {
            return "";
        }
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
            .filter((name) => workItemQueueFilePattern.test(name))
            .sort();
        for (const file of entries) {
            const ticketPath = path.join(ticketsRoot, "inprogress", file);
            inprogressTickets.push({
                id: file.replace(/\.md$/, ""),
                path: ticketPath,
                meta: await readTicketMeta(ticketPath)
            });
        }
    } catch {
    }
    try {
        const entries = (await fs.readdir(path.join(ticketsRoot, "verifier")))
            .filter((name) => workItemQueueFilePattern.test(name))
            .sort();
        for (const file of entries) {
            const ticketPath = path.join(ticketsRoot, "verifier", file);
            verifierTickets.push({
                id: file.replace(/\.md$/, ""),
                path: ticketPath,
                meta: await readTicketMeta(ticketPath)
            });
        }
    } catch {
    }
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

function readBoardRunnerListCacheKey(options: any = {}) {
    return [
        "runners",
        options.projectRoot || "",
        options.boardDirName || defaultBoardDirName
    ].join("\0");
}

function clearReadBoardRunnerListCache(options: any = {}) {
    readBoardRunnerListCache.delete(readBoardRunnerListCacheKey(options));
}

function publishBoardChange(scope: any = {}, reason: any = "board-change") {
    const projectRoot = scope.projectRoot || "";
    const boardDirName = scope.boardDirName || defaultBoardDirName;
    // Board broadcasts only invalidate UI caches; runner shutdown stays on explicit stop paths.
    clearReadBoardCachesForScope({projectRoot, boardDirName});
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

function cloneRunnersResult(result: any) {
    if (!result) {
        return result;
    }
    return {
        ...result,
        values: result.values ? {...result.values} : result.values,
        runners: Array.isArray(result.runners)
            ? result.runners.map((runner) => ({...runner}))
            : []
    };
}

function emptyRunnerListResult(options: any = {}, fallback: any = {}) {
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

function markRunnerListFallback(result: any, fallback: any = {}) {
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

function runnerListErrorResult(options: any = {}, error: any, fallback: any = {}) {
    return emptyRunnerListResult(options, {
        ok: false,
        code: -1,
        signal: fallback.signal || "",
        cancelled: Boolean(fallback.cancelled),
        stderr: diagnosticErrorMessage(error, "readBoard diagnostic runners failed."),
        cacheStatus: fallback.cacheStatus || "error"
    });
}

function listRunnersReadBoardDiagnostic(options: any = {}) {
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

function startRunnerListRefresh(options: any, key: any, entry: any) {
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

function listRunnersCachedOrRefresh(options: any = {}, ttlMs: any = readBoardRunnerListCacheTtlMs) {
    const key = readBoardRunnerListCacheKey(options);
    const entry = readBoardRunnerListCache.get(key);
    const now = Date.now();

    if (entry?.result && now - entry.updatedAt < ttlMs) {
        return Promise.resolve(markRunnerListFallback(cloneRunnersResult(entry.result), {cacheStatus: "fresh"}));
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
            markRunnerListFallback(cloneRunnersResult(result), {cacheStatus: "miss"})
        );
    }

    return entry.promise.then((result) =>
        markRunnerListFallback(cloneRunnersResult(result), {
            refreshInFlight: true,
            cacheStatus: "pending"
        })
    );
}

async function listRunnersStandalone(options: any = {}) {
    const key = readBoardRunnerListCacheKey(options);
    const entry = readBoardRunnerListCache.get(key);
    const now = Date.now();

    if (entry?.result && now - entry.updatedAt < standaloneRunnerListCacheTtlMs) {
        return markRunnerListFallback(cloneRunnersResult(entry.result), {cacheStatus: "fresh"});
    }

    if (entry?.promise) {
        const result = await entry.promise;
        return markRunnerListFallback(cloneRunnersResult(result), {
            refreshInFlight: true,
            cacheStatus: "pending"
        });
    }

    const result = await startRunnerListRefresh(options, key, entry);
    return markRunnerListFallback(cloneRunnersResult(result), {cacheStatus: "fresh"});
}

// Per-(projectRoot, runnerId) inflight tracker. Renderer-side parallel
// start/stop fires multiple `autoflow:controlRunner` IPC calls in flight;
// without this guard a fast double-click on the same runner could spawn
// duplicate `autoflow runners start` subprocesses or interleave start/stop
// on the same state file. Different runner ids stay parallel.
const runnerControlInflight = new Map();

async function controlRunner(options: any = {}) {
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
            clearReadBoardRunnerListCache({projectRoot: options.projectRoot, boardDirName});
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

function listRunnerArtifacts(options: any = {}) {
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

function createRunner(options: any = {}) {
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

function runRole(options: any = {}) {
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

function configureRunner(options: any = {}) {
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
            clearReadBoardRunnerListCache({projectRoot: options.projectRoot, boardDirName});
            publishBoardChange({projectRoot: options.projectRoot, boardDirName}, "runners/config.local.toml");
        }
        return {
            ...result,
            values,
            configFingerprint: values.config_fingerprint || "",
            configUpdatedAt: values.config_updated_at || values.last_event_at || ""
        };
    });
}

function emitInstallProgress(event: any, options: any = {}, stage: any, label: any) {
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

async function installBoard(options: any = {}, event: any = null) {
    if (!options.projectRoot) {
        return {
            ok: false,
            command: "init",
            code: -1,
            stdout: "",
            stderr: "Project root is required."
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

    emitInstallProgress(event, options, "watcher", "보드 변경 감시를 시작하고 있습니다.");
    const watcherResult = await runAutoflow("watch-bg", options);
    followUpStdout.push(`[watch-bg]\n${watcherResult.stdout || ""}`.trimEnd());
    if (watcherResult.stderr) {
        followUpStderr.push(`[watch-bg]\n${watcherResult.stderr}`.trimEnd());
    }

    emitInstallProgress(event, options, "finalizing", "설치 결과를 정리하고 있습니다.");
    const boardDirName = options.boardDirName || defaultBoardDirName;
    clearReadBoardCachesForScope({projectRoot: options.projectRoot, boardDirName});
    publishBoardChange({projectRoot: options.projectRoot, boardDirName}, "install-complete");
    return {
        ok: true,
        command: "init+watch-bg",
        code: initResult.code,
        stdout: [initResult.stdout, ...followUpStdout].filter(Boolean).join("\n\n"),
        stderr: [initResult.stderr, ...followUpStderr].filter(Boolean).join("\n\n")
    };
}

function controlWiki(options: any = {}) {
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

function wikiDatabaseEmptyResult(stderr: any = "") {
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

function compactWikiCell(value: any) {
    if (value == null) return "";
    const text = String(value);
    return text.length > 2000 ? `${text.slice(0, 2000)}… (${text.length} chars)` : text;
}

async function browseWikiDatabase(options: any = {}) {
    if (!options.projectRoot) {
        return wikiDatabaseEmptyResult("Project root is required.");
    }
    const boardDirName = options.boardDirName || defaultBoardDirName;
    if (!isSafeBoardDirName(boardDirName)) {
        return wikiDatabaseEmptyResult("Invalid board directory name.");
    }

    const boardRoot = path.resolve(options.projectRoot, boardDirName);
    const wikiRoot = path.join(boardRoot, "wiki");
    const rawRoot = path.join(boardRoot, "raw");
    const doneRoot = path.join(boardRoot, "tickets", "done");
    const roots = [
        {name: "wiki", root: wikiRoot},
        {name: "raw", root: rawRoot},
        {name: "done", root: doneRoot}
    ];
    const walkMarkdown = (root) => {
        const files = [];
        const visit = (dir) => {
            let entries = [];
            try {
                entries = fsSync.readdirSync(dir, {withFileTypes: true});
            } catch {
                return;
            }
            for (const entry of entries) {
                const file = path.join(dir, entry.name);
                if (entry.isDirectory()) visit(file);
                else if (entry.isFile() && entry.name.endsWith(".md")) files.push(file);
            }
        };
        visit(root);
        return files.sort((a, b) => a.localeCompare(b));
    };
    try {
        const filesByGroup = new Map(roots.map((item) => [item.name, walkMarkdown(item.root)]));
        const tables = roots.map((item) => ({
            name: item.name,
            type: item.name === "wiki" ? "canonical markdown" : "source markdown",
            rowCount: filesByGroup.get(item.name)?.length || 0
        }));

        const requestedTable = String(options.table || "").trim();
        const selectedTable =
            tables.find((table) => table.name === requestedTable)?.name ||
            tables.find((table) => table.name === "wiki")?.name ||
            tables[0]?.name ||
            "";
        if (!selectedTable) {
            return {
                ok: true,
                dbPath: wikiRoot,
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
        const columns = [
            {name: "path", type: "markdown path", notNull: true, primaryKey: true},
            {name: "title", type: "heading", notNull: false, primaryKey: false},
            {name: "lines", type: "number", notNull: false, primaryKey: false},
            {name: "updated", type: "mtime", notNull: false, primaryKey: false},
            {name: "preview", type: "text", notNull: false, primaryKey: false}
        ];
        const selectedSummary = tables.find((table) => table.name === selectedTable);
        const selectedFiles = filesByGroup.get(selectedTable) || [];
        const rows = selectedFiles.slice(offset, offset + limit).map((file) => {
            const text = fsSync.readFileSync(file, "utf8");
            const rel = path.relative(boardRoot, file).replace(/\\/g, "/");
            const title = text.split(/\r?\n/).find((line) => line.trim())?.replace(/^#+\s*/, "").trim() || path.basename(file);
            const stat = fsSync.statSync(file);
            return {
                path: compactWikiCell(rel),
                title: compactWikiCell(title),
                lines: String(text.split(/\r?\n/).length),
                updated: stat.mtime.toISOString().replace(/\.\d+Z$/, "Z"),
                preview: compactWikiCell(text.replace(/\s+/g, " ").trim())
            };
        });

        return {
            ok: true,
            dbPath: wikiRoot,
            selectedTable,
            tables,
            columns,
            rows,
            rowCount: selectedSummary?.rowCount || rows.length,
            limit,
            offset,
            stderr: ""
        };
    } catch (error: any) {
        return {
            ...wikiDatabaseEmptyResult(error instanceof Error ? error.message : "Failed to read markdown wiki."),
            dbPath: wikiRoot
        };
    }
}


function controlWatcher(options: any = {}) {
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

function withScopeMemory(handler: any) {
    return (_event, options) => {
        rememberProjectScope(options);
        return handler(options || {}, _event);
    };
}

// Wrap an IPC handler so a hung underlying call (e.g. CLI subprocess that
// never exits) surfaces to the renderer as a rejection instead of leaving
// the UI frozen on a permanent loading state. Pass ms <= 0 to disable.
function withTimeout(handler: any, ms: any) {
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

function attachTimeoutSignal(args: any, signal: any) {
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

function terminateAutoflowChild(child: any, reason: any = "cancelled", graceMs: any = autoflowChildKillGraceMs) {
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
        } catch {
        }
        try {
            process.kill(target, "SIGTERM");
        } catch {
        }
    }
    try {
        child.kill("SIGTERM");
    } catch {
    }

    const delay = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : autoflowChildKillGraceMs;
    setTimeout(() => {
        for (const target of collectProcessTree(child.pid)) {
            try {
                process.kill(-target, "SIGKILL");
            } catch {
            }
            try {
                process.kill(target, "SIGKILL");
            } catch {
            }
        }
    }, delay).unref();

    if (reason) {
    }
    return true;
}

function isSafeBoardDirName(value: any) {
    return typeof value === "string" && safeBoardDirNamePattern.test(value);
}

function listChildPids(parentPid: any) {
    try {
        const {spawnSync} = require("node:child_process");
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
function inspectPidIdentity(pid: any) {
    if (!Number.isInteger(pid) || pid <= 0) return {alive: false, ppid: 0, command: ""};
    try {
        process.kill(pid, 0);
    } catch {
        return {alive: false, ppid: 0, command: ""};
    }
    try {
        const {spawnSync} = require("node:child_process");
        const result = spawnSync("ps", ["-p", String(pid), "-o", "ppid=,command="], {
            stdio: ["ignore", "pipe", "ignore"]
        });
        if (result.status !== 0 || !result.stdout) return {alive: true, ppid: 0, command: ""};
        const line = result.stdout.toString().trim();
        const match = line.match(/^\s*(\d+)\s+(.*)$/);
        if (!match) return {alive: true, ppid: 0, command: ""};
        return {alive: true, ppid: Number.parseInt(match[1], 10) || 0, command: match[2] || ""};
    } catch {
        return {alive: true, ppid: 0, command: ""};
    }
}

// Heuristic: does this command line look like an Autoflow runner adapter?
// Used to avoid killing arbitrary processes if PID has been reused by the OS.
function commandLooksLikeAutoflowRunner(command: any) {
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
        const {spawnSync} = require("node:child_process");
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
            orphans.push({pid, command});
        }
        if (orphans.length === 0) return 0;
        for (const {pid, command} of orphans) {
            // Process-group kill first (clean up any lingering claude/codex
            // children that legacy spawned), then targeted PID kill as fallback.
            try {
                process.kill(-pid, "SIGTERM");
            } catch {
            }
            try {
                process.kill(pid, "SIGTERM");
            } catch {
            }
            killed += 1;
        }
        // Brief grace period, then SIGKILL stragglers.
        const deadline = Date.now() + 1500;
        while (Date.now() < deadline) {
            const stillAlive = orphans.filter(({pid}) => {
                try {
                    process.kill(pid, 0);
                    return true;
                } catch {
                    return false;
                }
            });
            if (stillAlive.length === 0) break;
            // busy-wait (small ms) — runs only at startup, on a single batch
            const waitUntil = Date.now() + 100;
            while (Date.now() < waitUntil) {
            }
        }
        for (const {pid} of orphans) {
            try {
                process.kill(pid, 0);
            } catch {
                continue;
            }
            try {
                process.kill(-pid, "SIGKILL");
            } catch {
            }
            try {
                process.kill(pid, "SIGKILL");
            } catch {
            }
        }
    } catch (err: any) {
    }
    return killed;
}

// Startup-time sweep: any state.state with status=running but PID dead OR
// PID alive with PPID=1 (parent crashed → orphaned to launchd) gets cleaned.
// Same goal as forceKillSurvivingRunners but applies on app start, not quit,
// to recover from crash / red-X / power loss / kill -9.
async function sweepStaleRunnersForScope(scope: any) {
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
        const ptyMgr = (globalThis as any).__autoflowPtyManager;
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
            // status=running but no pid recorded -> mark stopped while preserving usage counters.
            values.status = "stopped";
            values.runner_status = "stopped";
            values.pid = "";
            values.last_stop_reason = "startup_no_pid";
            values.last_result = "loop_stopped";
            values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
            try {
                await writeRunnerStateAtomic(filePath, values);
            } catch {
            }
            continue;
        }

        const identity = inspectPidIdentity(pid);
        let action = "";
        if (!identity.alive) {
            action = "dead_pid"; // mark stopped; usage counters stay with the fixed runner.
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
                try {
                    process.kill(-target, "SIGKILL");
                } catch {
                }
                try {
                    process.kill(target, "SIGKILL");
                } catch {
                }
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
        } catch {
        }
        cleanedCount += 1;
    }
    return cleanedCount;
}

function collectProcessTree(rootPid: any, visited: any = new Set()) {
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

function killPidGracefully(pid: any) {
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
        } catch {
        }
        try {
            process.kill(target, "SIGTERM");
        } catch {
        }
    }

    setTimeout(() => {
        for (const target of collectProcessTree(pid)) {
            try {
                process.kill(-target, "SIGKILL");
            } catch {
            }
            try {
                process.kill(target, "SIGKILL");
            } catch {
            }
        }
    }, 1500).unref();

    return true;
}

function killPidForcefully(pid: any) {
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
        } catch {
        }
        try {
            process.kill(target, "SIGKILL");
        } catch {
        }
    }

    return true;
}

function parseRunnerStateFile(content: any) {
    const values = {};
    for (const line of content.split(/\r?\n/)) {
        const index = line.indexOf("=");
        if (index <= 0) continue;
        values[line.slice(0, index)] = line.slice(index + 1);
    }
    return values;
}


function serializeRunnerState(values: any) {
    return Object.entries(values)
        .map(([key, value]) => `${key}=${value ?? ""}`)
        .join("\n") + "\n";
}

async function writeRunnerStateAtomic(filePath: any, values: any, explicitKeys: any = new Set()) {
    const nextMap = new Map(Object.entries({...runnerTokenStateDefaults, ...values}));
    try {
        const latest = parseStateMap(await fs.readFile(filePath, "utf8"));
        preserveLatestRunnerAccountingFields(nextMap, latest, explicitKeys);
    } catch {
    }
    const next = Object.fromEntries(nextMap);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, serializeRunnerState(next), "utf8");
    await fs.rename(tmpPath, filePath);
}

async function readRunnerStateValues(filePath: any) {
    try {
        return parseRunnerStateFile(await fs.readFile(filePath, "utf8"));
    } catch {
        return {};
    }
}

function shouldSelfHealStoppedRunner(runner: any, stateValues: any) {
    return (
        runner &&
        runner.id &&
        runner.enabled === "true" &&
        runner.stateStatus === "stopped" &&
        stateValues.stopped_by !== "user"
    );
}

async function selfHealStoppedRunnersForScope(_scope: any) {
    // Disabled in PTY mode (vibe-terminal pattern). Explicit starts in the UI
    // route to runnerPtySpawn, so leaving this no-op forces all runner starts to
    // be user-initiated. To re-enable an auto-restart story under PTY, call
    // ptyManager.start with the runner's resolved config.
    return;
}

async function shutdownRunnersForScope(scope: any, reason: any = "parent_terminated", opts: any = {}) {
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
                values.runner_status = "stopped";
                values.pid = "";
                values.stopped_by = "";
                values.last_stop_reason = reason;
                values.last_result = "loop_stopped";
                values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
                try {
                    await writeRunnerStateAtomic(filePath, values);
                } catch {
                }
            })
    );
    return killedCount;
}

async function shutdownAllRunners(options: any = {}) {
    if (runnerShutdownInProgress && !options.allowWhileInProgress) return 0;
    runnerShutdownInProgress = true;

    let total = 0;
    for (const scope of knownProjectScopes.values()) {
        try {
            total += await shutdownRunnersForScope(scope);
        } catch {
        }
    }

    for (const child of activeChildProcesses) {
        try {
            child.kill("SIGTERM");
        } catch {
        }
    }
    activeChildProcesses.clear();

    return total;
}

async function closeProjectRunners(options: any = {}) {
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

    const scope = {projectRoot, boardDirName};
    const runnerIds = stopPtyRunnersForScope(scope, {force: true});
    const stateStoppedCount = await shutdownRunnersForScope(scope, "project_tab_closed", {force: true});
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
                try {
                    process.kill(-target, "SIGKILL");
                } catch {
                }
                try {
                    process.kill(target, "SIGKILL");
                } catch {
                }
            }

            values.status = "stopped";
            values.runner_status = "stopped";
            values.pid = "";
            values.stopped_by = "";
            values.last_stop_reason = "parent_terminated";
            values.last_result = "loop_stopped";
            values.last_event_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
            try {
                await writeRunnerStateAtomic(filePath, values);
            } catch {
            }
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
        const mgr = (globalThis as any).__autoflowPtyManager;
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
    } catch {
    }

    // powerMonitor: when the system sleeps, PTYs are suspended (not killed) so
    // we just preserve current state. On resume, re-run self-heal in case the
    // OS or watchdogs broke any state file during the suspend window.
    try {
        powerMonitor.on("suspend", () => {
        });
        powerMonitor.on("resume", () => {
            void selfHealPtyRunnerStates();
        });
    } catch (err: any) {
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
    } catch {
    }
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
                        try {
                            fsSync.unlinkSync(path.join(lockDir, child));
                        } catch {
                        }
                    }
                    fsSync.rmdirSync(lockDir);
                } catch {
                }
            }
        }
    } catch {
    }
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
                    return {...empty, stderr: "projectRoot and filePath are required."};
                }
                if (!isSafeBoardDirName(boardDirNameRaw)) {
                    return {...empty, stderr: "Invalid board directory name."};
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
                        const {bytesRead} = await handle.read(buffer, 0, bytesToRead, startOffset);
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
                } catch (error: any) {
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
            return {exists: await pathExists(normalizedRoot)};
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
    (globalThis as any).__autoflowPtyManager = (globalThis as any).__autoflowPtyManager || new PtyRunnerManager();
    const ptyManager = (globalThis as any).__autoflowPtyManager;
    const broadcastPty = (channel, payload) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                try {
                    win.webContents.send(channel, payload);
                } catch {
                }
            }
        }
    };
    ptyManager.on("bytes", ({runnerId, data}) => {
        broadcastPty("autoflow:runnerPtyBytes", ptyRunnerScopedPayload(runnerId, {data}));
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
        if (payload.status === "stopped") {
            flushSessionTokenUsageImportForRunner(payload.runnerId);
        }
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
            clearAllHandoffTimersForRunner(payload.runnerId);
            ptyRunnerMeta.delete(payload.runnerId);
            ptyTokenUsageParseState.delete(payload.runnerId);
            sessionTokenUsageImportPending.delete(payload.runnerId);
            clearCodexHookTrustPromptAutomation(payload.runnerId);
            // Drop from precise reaper registry — PID is dead.
            if (Number.isInteger(payload.pid) && payload.pid > 0) {
                try {
                    removePtySessionPid(payload.pid);
                } catch {
                }
            }
        }
    });
    ptyManager.on("error", ({runnerId, error}) => {
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
            return {ok: false, error: "node-pty unavailable (rebuild required)"};
        }
        const projectRoot = String(opts.projectRoot || "");
        const boardDirName = String(opts.boardDirName || ".autoflow");
        const runnerId = String(opts.runnerId || "");
        if (!runnerId || !projectRoot) {
            return {ok: false, error: "runnerId and projectRoot required"};
        }
        const diskRunnerConfig = readRunnerConfigBlock(projectRoot, boardDirName, runnerId);
        const role = resolveRunnerStartRole({
            projectRoot,
            boardDirName,
            runnerId,
            diskRunnerConfig,
            requestedRole: opts.role
        });
        const normalizedRole = normalizeRunnerRole(role);
        if (normalizedRole === "coordinator") {
            return {ok: false, error: "coordinator is not a runner; use planner, worker, verifier, or wiki runners."};
        }
        const agent = String(diskRunnerConfig.agent || opts.agent || "codex").toLowerCase();
        const model = String(diskRunnerConfig.model ?? opts.model ?? "");
        const reasoning = String(diskRunnerConfig.reasoning ?? opts.reasoning ?? "");
        const codexHistory = normalizeCodexHistoryMode(diskRunnerConfig.codex_history ?? opts.codexHistory ?? "");
        if (!(await commandExists(agent))) {
            return {ok: false, error: `${agent} CLI not found in shell PATH`};
        }
        if (normalizedRole === "wiki-maintainer") {
            ensureWikiAssignmentForPendingWorkSync({
                projectRoot,
                boardDirName,
                boardRoot: path.join(projectRoot, boardDirName),
                runnerId
            });
        }
        const initialPrompt = buildInitialPrompt({
            role: normalizedRole,
            agent,
            runnerId,
            projectRoot,
            boardDirName
        });
        const initialPromptFile = agent === "codex"
            ? writeRunnerStartupPromptFile({projectRoot, boardDirName, runnerId, prompt: initialPrompt})
            : "";
        const command = buildAgentCliCommand(agent, model, reasoning, {boardDirName, initialPromptFile});
        if (!command) {
            return {ok: false, error: `unsupported agent: ${agent}`};
        }
        const runnerKey = ptyRunnerKey(projectRoot, boardDirName, runnerId);
        try {
            const existing = ptyManager.get(runnerKey);
            const existingMatchesScope = ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, {
                projectRoot,
                boardDirName
            });
            const freshSessionRequested = Boolean(opts.freshSession) || normalizedRole === "wiki-maintainer";
            if (existing && existing.status === "running") {
                if (freshSessionRequested || !existingMatchesScope || (existing.command && existing.command !== command)) {
                    if (Number.isInteger(existing.pid) && existing.pid > 0) {
                        killPidForcefully(existing.pid);
                        removePtySessionPid(existing.pid);
                    }
                    ptyManager.stop(runnerKey, {force: true});
                    await new Promise((resolve) => setTimeout(resolve, 300));
                } else {
                    return {
                        ok: true,
                        runnerId,
                        pid: existing.pid,
                        status: existing.status,
                        stdout: "",
                        reused: true
                    };
                }
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
            rememberProjectScope({projectRoot, boardDirName});
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
                last_result: "",
                runner_status: "running",
                stopped_by: "",
                last_stop_reason: "",
                last_process_result: "",
                control_action: "",
                control_source: "",
                control_requested_at: "",
                control_force: ""
            });
            // Record PID in precise reaper registry so a desktop crash next time
            // leaves the next session a clean kill list.
            try {
                addPtySessionPid({pid: runner.pid, runnerId, role: normalizedRole, agent, spawnedAt: startedAt});
            } catch {
            }
            // Wait for the agent CLI to load its TUI before pushing the initial
            // prompt. The shared delay covers the supported CLIs without making the
            // first turn feel sluggish.
            const PROMPT_INJECT_DELAY_MS = 6000;
            if (agent === "codex" && initialPromptFile) {
                markRunnerInitialPromptSent(runnerKey);
            } else {
                setTimeout(() => {
                    const paste = agent === "claude" ? "bracketed" : "plain";
                    const ok = ptyManager.writePrompt(runnerKey, initialPrompt, {paste});
                    if (ok) markRunnerInitialPromptSent(runnerKey);
                }, PROMPT_INJECT_DELAY_MS);
            }
            // Diagnostic: dump PTY buffer 2.5s AFTER prompt write so we can see
            // whether the TUI accepted it (text in input box / model response /
            // mojibake / nothing).
            setTimeout(() => {
                try {
                    const snap = ptyManager.snapshot(runnerKey) || "";
                } catch (err: any) {
                }
            }, PROMPT_INJECT_DELAY_MS + 2500);
            return {ok: true, runnerId, pid: runner.pid, status: runner.status};
        } catch (err: any) {
            return {ok: false, error: String(err && err.message ? err.message : err)};
        }
    });
    ipcMain.handle("autoflow:runnerPtyStop", (_event, opts = {}) => {
        const runnerKey = ptyRunnerKeyForScope(opts, opts.runnerId);
        if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, opts)) {
            return {ok: false, error: "runner scope mismatch"};
        }
        if (opts.force) {
            const runner = typeof ptyManager.get === "function" ? ptyManager.get(runnerKey) : null;
            if (Number.isInteger(runner?.pid) && runner.pid > 0) {
                killPidForcefully(runner.pid);
                removePtySessionPid(runner.pid);
            }
        }
        return {ok: ptyManager.stop(runnerKey, {force: !!opts.force})};
    });
    ipcMain.handle("autoflow:runnerPtyResize", (_event, opts = {}) => {
        const runnerKey = ptyRunnerKeyForScope(opts, opts.runnerId);
        if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, opts)) {
            return {ok: false};
        }
        const ok = ptyManager.resize(runnerKey, opts.cols, opts.rows);
        return {ok};
    });
    ipcMain.handle("autoflow:runnerPtyInput", (_event, opts = {}) => {
        const runnerId = String(opts.runnerId || "");
        if (!runnerId) {
            return {ok: false, error: "runnerId required"};
        }
        return {ok: false, error: "runner terminal input is read-only"};
    });
    ipcMain.handle("autoflow:runnerPtySnapshot", (_event, opts = {}) => {
        const runnerKey = ptyRunnerKeyForScope(opts, opts.runnerId);
        if (!ptyRunnerMatchesRequestedScope(ptyManager, runnerKey, opts)) {
            return {snapshot: ""};
        }
        return {snapshot: ptyManager.snapshot(runnerKey)};
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
    // Reads runners/config.local.toml (or the share-root default topology) for
    // the enabled runner list, then drives the same code path as a UI ▶ click.
    // Useful when the renderer hasn't loaded yet or after a hard restart
    // where stuck PTYs were force-killed.
    if (process.env.AUTOFLOW_AUTO_SPAWN_RUNNERS === "1") {
        setTimeout(async () => {
            try {
                const projectRoot = repoRoot;
                const boardDirName = defaultBoardDirName;
                const configPath = runnerConfigReadPath(projectRoot, boardDirName);
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
                    if (role === "wiki-maintainer") {
                        ensureWikiAssignmentForPendingWorkSync({
                            projectRoot,
                            boardDirName,
                            boardRoot: path.join(projectRoot, boardDirName),
                            runnerId
                        });
                    }
                    const initialPrompt = buildInitialPrompt({role, agent, runnerId, projectRoot, boardDirName});
                    const initialPromptFile = agent === "codex"
                        ? writeRunnerStartupPromptFile({projectRoot, boardDirName, runnerId, prompt: initialPrompt})
                        : "";
                    const command = buildAgentCliCommand(agent, model, reasoning, {boardDirName, initialPromptFile});
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
                    rememberProjectScope({projectRoot, boardDirName});
                    startCodexHookTrustPromptWatchdog(ptyManager, runnerKey);
                    await writePtyRunnerStateFile(runnerKey, {
                        id: runnerId, status: "running", role, agent, model, reasoning,
                        mode: "pty", pid: String(runner.pid || ""), started_at: startedAt,
                        codex_home: runnerEnv.codexHome || "",
                        codex_history: runnerEnv.codexHistory || "",
                        last_event_at: startedAt,
                        runner_status: "running",
                        stopped_by: "",
                        last_stop_reason: "",
                        last_process_result: "",
                        control_action: "",
                        control_source: "",
                        control_requested_at: "",
                        control_force: ""
                    });
                    try {
                        addPtySessionPid({pid: runner.pid, runnerId, role, agent, spawnedAt: startedAt});
                    } catch {
                    }
                    const promptDelay = 6000;
                    if (agent === "codex" && initialPromptFile) {
                        markRunnerInitialPromptSent(runnerKey);
                    } else {
                        setTimeout(() => {
                            const paste = agent === "claude" ? "bracketed" : "plain";
                            const ok = ptyManager.writePrompt(runnerKey, initialPrompt, {paste});
                            if (ok) markRunnerInitialPromptSent(runnerKey);
                        }, promptDelay);
                    }
                    await new Promise((r) => setTimeout(r, 800));
                }
            } catch (err: any) {
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

function runShutdownCleanupSync(reason: any) {
    if (appShutdownCleanupRun) return;
    appShutdownCleanupRun = true;
    if (memoryCeilingIntervalId) {
        try {
            clearInterval(memoryCeilingIntervalId);
        } catch {
        }
        memoryCeilingIntervalId = null;
    }
    clearVerifierHandoffTurnTimers();
    // 1. Kill our PTY children (zsh + claude/codex). Synchronous.
    try {
        if ((globalThis as any).__autoflowPtyManager) {
            (globalThis as any).__autoflowPtyManager.shutdown();
        }
    } catch {
    }
    // 2. Stop board watchers.
    try {
        disposeAllBoardWatchers();
    } catch {
    }
    // 3. Drop the precise PTY PID registry — children are dead.
    try {
        clearPtySessionPids();
    } catch {
    }
    // 4. Mark this session as cleanly shut down so next-boot reaper does not
    //    over-probe.
    try {
        markDesktopSessionClean(reason || "quit");
    } catch {
    }
}

async function runShutdownCleanupAsync(reason: any) {
    if (appShutdownCleanupRun) return;
    appShutdownCleanupRun = true;
    if (memoryCeilingIntervalId) {
        try {
            clearInterval(memoryCeilingIntervalId);
        } catch {
        }
        memoryCeilingIntervalId = null;
    }
    clearVerifierHandoffTurnTimers();
    try {
        if ((globalThis as any).__autoflowPtyManager) {
            (globalThis as any).__autoflowPtyManager.shutdown();
        }
    } catch {
    }
    try {
        await disposeAllBoardWatchersAsync();
    } catch {
    }
    try {
        clearPtySessionPids();
    } catch {
    }
    try {
        markDesktopSessionClean(reason || "quit");
    } catch {
    }
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
