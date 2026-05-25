import { spawn } from "node:child_process";
import * as shared from "../../../shared/runner-tool";

const {
  fs,
  path,
  spawnSync,
  BOARD_ROOT,
  PROJECT_ROOT,
  boardDirName,
  boardRel,
  currentRunnerId,
  requireRoleAssignment,
  startAssignmentIfLeased,
  completeRoleAssignment,
  compactAssignment,
  emitRunnerContextReset,
  getArg,
  hasFlag,
  hashFiles,
  ok,
  parseKeyValueOutput,
  positiveInt,
  unique,
  wikiSourceGroups,
  autoflowCliPath,
} = shared;

type StepResult = {
  name: string;
  exit_code: number;
  parsed_status: string;
  stdout_excerpt: string;
  stderr_excerpt: string;
  parsed: shared.JsonObject;
};

type CompactStepResult = {
  name: string;
  exit_code: number;
  parsed_status: string;
  status?: unknown;
  summary_count?: unknown;
  changed_file_count?: unknown;
  ticket_done_count?: unknown;
  pid?: unknown;
  stdout_excerpt?: string;
  stderr_excerpt?: string;
};

type WikiIndexRefreshLock = {
  pid: number;
  started_at: string;
  lock_path: string;
};

type WikiIndexRefreshStartState = {
  last_started_at: string;
  pid: number;
};

type WikiIndexRefreshCooldownReference = {
  at: string;
  ms: number;
  source: string;
  pid?: number;
};

type FocusedReviewState = {
  focused_wiki_fingerprint: string;
  reviewed_at: string;
  reviewed_at_ms: number;
  reviewed_done_paths: string[];
  pending_done_paths: string[];
};

const DEFAULT_WIKI_INDEX_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

function excerpt(value: string, max = 1600): string {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}\n[truncated:${clean.length - max}]`;
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function nonNegativeInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseTimeMs(raw: string): number {
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function wikiIndexRefreshLockDir(): string {
  return path.join(BOARD_ROOT, "runners", "state", "wiki-index-refresh.lock");
}

function wikiIndexRefreshStateFile(): string {
  return path.join(BOARD_ROOT, "runners", "state", "wiki-index-refresh.json");
}

function wikiIndexRefreshPidFile(): string {
  return path.join(wikiIndexRefreshLockDir(), "pid");
}

function wikiIndexRefreshMetaFile(): string {
  return path.join(wikiIndexRefreshLockDir(), "meta.json");
}

function readWikiIndexRefreshLock(): WikiIndexRefreshLock | null {
  const lockPath = wikiIndexRefreshLockDir();
  if (!fs.existsSync(lockPath)) return null;

  let pid = 0;
  try {
    pid = Number.parseInt(fs.readFileSync(wikiIndexRefreshPidFile(), "utf8").trim(), 10);
  } catch {}

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(fs.readFileSync(wikiIndexRefreshMetaFile(), "utf8")) as Record<string, unknown>;
  } catch {}

  const ageMs = (() => {
    try { return Date.now() - fs.statSync(lockPath).mtimeMs; } catch { return 0; }
  })();

  if (pid > 0 && shared.utils.pidAlive(pid)) {
    return {
      pid,
      started_at: String(meta.started_at || ""),
      lock_path: lockPath,
    };
  }

  if (pid <= 0 && ageMs < 30000) {
    return {
      pid: 0,
      started_at: String(meta.started_at || ""),
      lock_path: lockPath,
    };
  }

  try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch {}
  return null;
}

function skippedIndexRefreshStep(active: WikiIndexRefreshLock): StepResult {
  const parsed = {
    status: "skipped_in_progress",
    reason: "index_refresh_in_progress",
    pid: active.pid ? String(active.pid) : "",
    started_at: active.started_at,
    lock_path: active.lock_path,
  };
  return {
    name: "index-refresh",
    exit_code: 0,
    parsed_status: "skipped_in_progress",
    stdout_excerpt: [
      "status=skipped_in_progress",
      "reason=index_refresh_in_progress",
      `pid=${active.pid || ""}`,
      `started_at=${active.started_at}`,
      `lock_path=${active.lock_path}`,
    ].join("\n"),
    stderr_excerpt: "",
    parsed,
  };
}

function skippedIndexRefreshCooldownStep(
  reference: WikiIndexRefreshCooldownReference,
  cooldownMs: number,
  trigger: string,
): StepResult {
  const ageMs = Math.max(0, Date.now() - reference.ms);
  const remainingMs = Math.max(0, cooldownMs - ageMs);
  const parsed = {
    status: "skipped_cooldown",
    reason: "index_refresh_cooldown",
    trigger,
    cooldown_ms: String(cooldownMs),
    cooldown_remaining_ms: String(remainingMs),
    reference_source: reference.source,
    last_started_or_indexed_at: reference.at,
    pid: reference.pid ? String(reference.pid) : "",
  };
  return {
    name: "index-refresh",
    exit_code: 0,
    parsed_status: "skipped_cooldown",
    stdout_excerpt: [
      "status=skipped_cooldown",
      "reason=index_refresh_cooldown",
      `trigger=${trigger}`,
      `cooldown_ms=${cooldownMs}`,
      `cooldown_remaining_ms=${remainingMs}`,
      `reference_source=${reference.source}`,
      `last_started_or_indexed_at=${reference.at}`,
      `pid=${reference.pid || ""}`,
    ].join("\n"),
    stderr_excerpt: "",
    parsed,
  };
}

function reserveWikiIndexRefreshLock(): boolean {
  const lockPath = wikiIndexRefreshLockDir();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  if (readWikiIndexRefreshLock()) return false;
  try {
    fs.mkdirSync(lockPath);
    return true;
  } catch {
    return !readWikiIndexRefreshLock() && (() => {
      try {
        fs.rmSync(lockPath, { recursive: true, force: true });
        fs.mkdirSync(lockPath);
        return true;
      } catch {
        return false;
      }
    })();
  }
}

function writeWikiIndexRefreshLock(pid: number, startedAt = new Date().toISOString()): void {
  const lockPath = wikiIndexRefreshLockDir();
  try {
    fs.mkdirSync(lockPath, { recursive: true });
    fs.writeFileSync(wikiIndexRefreshPidFile(), `${pid}\n`, "utf8");
    fs.writeFileSync(wikiIndexRefreshMetaFile(), JSON.stringify({
      pid,
      started_at: startedAt,
      project_root: PROJECT_ROOT,
      board_root: BOARD_ROOT,
    }, null, 2) + "\n", "utf8");
  } catch {}
}

function readWikiIndexRefreshStartState(): WikiIndexRefreshStartState | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(wikiIndexRefreshStateFile(), "utf8")) as Record<string, unknown>;
    const lastStartedAt = String(parsed.last_started_at || "");
    const lastStartedMs = parseTimeMs(lastStartedAt);
    if (!lastStartedMs) return null;
    return {
      last_started_at: lastStartedAt,
      pid: nonNegativeInt(String(parsed.pid || ""), 0),
    };
  } catch {
    return null;
  }
}

function writeWikiIndexRefreshStartState(pid: number, startedAt: string): void {
  const filePath = wikiIndexRefreshStateFile();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      last_started_at: startedAt,
      pid,
      project_root: PROJECT_ROOT,
      board_root: BOARD_ROOT,
    }, null, 2) + "\n", "utf8");
  } catch {}
}

function clearWikiIndexRefreshLock(): void {
  try { fs.rmSync(wikiIndexRefreshLockDir(), { recursive: true, force: true }); } catch {}
}

function sourceFiles(): string[] {
  return Object.values(wikiSourceGroups()).flat().sort();
}

function walkMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    let entries: any[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(filePath);
    }
  };
  visit(root);
  return out.sort((a, b) => a.localeCompare(b));
}

function currentIndexedSourceHash(): string {
  return currentIndexableSourceHash().hash;
}

function currentIndexedAt(): string {
  return readWikiIndexRefreshStartState()?.last_started_at || "";
}

function wikiIndexRefreshCooldownMs(): number {
  return nonNegativeInt(
    getArg("--index-refresh-cooldown-ms") || process.env.AUTOFLOW_WIKI_INDEX_REFRESH_COOLDOWN_MS || "",
    DEFAULT_WIKI_INDEX_REFRESH_COOLDOWN_MS,
  );
}

function currentIndexRefreshCooldownReference(): WikiIndexRefreshCooldownReference | null {
  const candidates: WikiIndexRefreshCooldownReference[] = [];
  const startState = readWikiIndexRefreshStartState();
  if (startState) {
    candidates.push({
      at: startState.last_started_at,
      ms: parseTimeMs(startState.last_started_at),
      source: "last_started",
      pid: startState.pid,
    });
  }
  const indexedAt = currentIndexedAt();
  const indexedMs = parseTimeMs(indexedAt);
  if (indexedMs) {
    candidates.push({
      at: indexedAt,
      ms: indexedMs,
      source: "last_indexed",
    });
  }
  return candidates
    .filter((candidate) => candidate.ms > 0)
    .sort((left, right) => right.ms - left.ms)[0] || null;
}

function currentIndexableSourceHash(): { hash: string; count: number } {
  const files = [
    ...walkMarkdownFiles(path.join(BOARD_ROOT, "wiki")),
    ...walkMarkdownFiles(path.join(BOARD_ROOT, "raw")),
    ...walkMarkdownFiles(path.join(BOARD_ROOT, "tickets", "done")),
  ].sort((a, b) => a.localeCompare(b));
  const hash = shared.crypto.createHash("sha256");
  for (const file of files) {
    try {
      const text = fs.readFileSync(file, "utf8");
      if (!text.trim()) continue;
      const relPath = path.relative(BOARD_ROOT, file);
      const contentSha = shared.crypto.createHash("sha256").update(text).digest("hex");
      hash.update(relPath).update("\0").update(contentSha).update("\0");
    } catch {}
  }
  return { hash: hash.digest("hex"), count: files.length };
}

function recentSources(maxItems: number): shared.JsonObject[] {
  return sourceFiles()
    .map((file) => {
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        return null;
      }
      return {
        path: boardRel(file),
        size: stat.size,
        mtime: stat.mtime.toISOString().replace(/\.\d+Z$/, "Z"),
      };
    })
    .filter(Boolean)
    .sort((left: any, right: any) => String(right.mtime).localeCompare(String(left.mtime)))
    .slice(0, maxItems) as shared.JsonObject[];
}

function isFocusedWikiSourcePath(value: unknown): boolean {
  return /^wiki\/(concepts|decisions|questions|sources)\//.test(String(value || ""));
}

function normalizeBoardSourcePath(value: unknown): string {
  return String(value || "").replace(/^\.autoflow\//, "");
}

function changedFocusedWikiSources(items: shared.JsonObject[]): shared.JsonObject[] {
  return items
    .map((item) => {
      const itemPath = normalizeBoardSourcePath(item.path);
      if (!isFocusedWikiSourcePath(itemPath)) return null;
      return {
        path: itemPath,
        status: item.status || "",
      };
    })
    .filter(Boolean) as shared.JsonObject[];
}

function mergeSourcesByPath(items: shared.JsonObject[]): shared.JsonObject[] {
  const seen = new Set<string>();
  const out: shared.JsonObject[] = [];
  for (const item of items) {
    const itemPath = String(item.path || "");
    if (!itemPath || seen.has(itemPath)) continue;
    seen.add(itemPath);
    out.push(item);
  }
  return out;
}

function focusedWikiFiles(): string[] {
  return sourceFiles()
    .filter((file) => isFocusedWikiSourcePath(boardRel(file)))
    .sort((a, b) => a.localeCompare(b));
}

function focusedWikiFingerprint(): string {
  const hash = shared.crypto.createHash("sha256");
  for (const file of focusedWikiFiles()) {
    try {
      const text = fs.readFileSync(file, "utf8");
      const relPath = boardRel(file);
      const contentSha = shared.crypto.createHash("sha256").update(text).digest("hex");
      hash.update(relPath).update("\0").update(contentSha).update("\0");
    } catch {}
  }
  return hash.digest("hex");
}

function focusedReviewStatePath(): string {
  return path.join(BOARD_ROOT, "runners", "state", "wiki-focused-review.json");
}

function readFocusedReviewState(): FocusedReviewState {
  try {
    const parsed = JSON.parse(fs.readFileSync(focusedReviewStatePath(), "utf8"));
    const reviewedAt = typeof parsed?.reviewed_at === "string" ? parsed.reviewed_at : "";
    const reviewedDonePaths = Array.isArray(parsed?.reviewed_done_paths)
      ? parsed.reviewed_done_paths.map((item: unknown) => String(item || "")).filter(Boolean)
      : [];
    const pendingDonePaths = Array.isArray(parsed?.pending_done_paths)
      ? parsed.pending_done_paths.map((item: unknown) => String(item || "")).filter(Boolean)
      : [];
    return {
      focused_wiki_fingerprint: typeof parsed?.focused_wiki_fingerprint === "string" ? parsed.focused_wiki_fingerprint : "",
      reviewed_at: reviewedAt,
      reviewed_at_ms: parseTimeMs(reviewedAt),
      reviewed_done_paths: reviewedDonePaths,
      pending_done_paths: pendingDonePaths,
    };
  } catch {
    return {
      focused_wiki_fingerprint: "",
      reviewed_at: "",
      reviewed_at_ms: 0,
      reviewed_done_paths: [],
      pending_done_paths: [],
    };
  }
}

function readFocusedReviewFingerprint(): string {
  return readFocusedReviewState().focused_wiki_fingerprint;
}

function writeFocusedReviewFingerprint(fingerprint: string): void {
  const filePath = focusedReviewStatePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = readFocusedReviewState();
  const reviewedDonePaths = unique([...current.reviewed_done_paths, ...current.pending_done_paths]).sort();
  const payload = {
    focused_wiki_fingerprint: fingerprint,
    reviewed_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    reviewed_done_paths: reviewedDonePaths,
    pending_done_paths: [],
  };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writePendingDoneReviewPaths(paths: string[]): void {
  if (paths.length === 0) return;
  const filePath = focusedReviewStatePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = readFocusedReviewState();
  const payload = {
    focused_wiki_fingerprint: current.focused_wiki_fingerprint,
    reviewed_at: current.reviewed_at,
    reviewed_done_paths: unique(current.reviewed_done_paths).sort(),
    pending_done_paths: unique(paths).sort(),
  };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function compactRecentSources(items: shared.JsonObject[]): shared.JsonObject[] {
  return items.map((item) => ({
    path: item.path,
    mtime: item.mtime,
  }));
}

function compactStep(step: StepResult): CompactStepResult {
  const parsed = step.parsed || {};
  const out: CompactStepResult = {
    name: step.name,
    exit_code: step.exit_code,
    parsed_status: step.parsed_status,
  };
  for (const key of [
    "status",
    "summary_count",
    "changed_file_count",
    "ticket_done_count",
    "pid",
    "reason",
    "trigger",
    "cooldown_ms",
    "cooldown_remaining_ms",
    "reference_source",
    "last_started_or_indexed_at",
  ]) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      (out as any)[key] = parsed[key];
    }
  }
  if (step.exit_code !== 0) {
    out.stdout_excerpt = excerpt(step.stdout_excerpt, 600);
    out.stderr_excerpt = excerpt(step.stderr_excerpt, 600);
  }
  return out;
}

function runAutoflowStep(name: string, cliArgs: string[]): StepResult {
  const cli = autoflowCliPath();
  const result = spawnSync(cli, cliArgs, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PROJECT_ROOT,
      AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
      BOARD_ROOT,
      AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
      AUTOFLOW_BOARD_DIR_NAME: boardDirName(),
      AUTOFLOW_RUNNER_ID: currentRunnerId("wiki"),
      RUNNER_ID: currentRunnerId("wiki"),
    },
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || (result.error ? String(result.error) : "");
  const parsed = parseKeyValueOutput(stdout);
  return {
    name,
    exit_code: typeof result.status === "number" ? result.status : 127,
    parsed_status: typeof parsed.status === "string" ? parsed.status : "",
    stdout_excerpt: excerpt(stdout),
    stderr_excerpt: excerpt(stderr, 800),
    parsed,
  };
}

function runAutoflowBackgroundStep(name: string, cliArgs: string[]): StepResult {
  const guardedIndexRefresh = name === "index-refresh";
  if (guardedIndexRefresh) {
    const active = readWikiIndexRefreshLock();
    if (active) return skippedIndexRefreshStep(active);
    if (!reserveWikiIndexRefreshLock()) {
      const reserved = readWikiIndexRefreshLock();
      if (reserved) return skippedIndexRefreshStep(reserved);
      return {
        name,
        exit_code: 0,
        parsed_status: "skipped_in_progress",
        stdout_excerpt: "status=skipped_in_progress\nreason=index_refresh_lock_busy",
        stderr_excerpt: "",
        parsed: { status: "skipped_in_progress", reason: "index_refresh_lock_busy" },
      };
    }
  }

  const cli = autoflowCliPath();
  try {
    const child = spawn(cli, cliArgs, {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PROJECT_ROOT,
        AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
        BOARD_ROOT,
        AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
        AUTOFLOW_BOARD_DIR_NAME: boardDirName(),
        AUTOFLOW_RUNNER_ID: currentRunnerId("wiki"),
        RUNNER_ID: currentRunnerId("wiki"),
      },
    });
    child.unref();
    if (guardedIndexRefresh) {
      if (child.pid) {
        const startedAt = new Date().toISOString();
        writeWikiIndexRefreshLock(child.pid, startedAt);
        writeWikiIndexRefreshStartState(child.pid, startedAt);
      } else {
        clearWikiIndexRefreshLock();
      }
    }
    const parsed = {
      status: "started_background",
      pid: String(child.pid || ""),
    };
    return {
      name,
      exit_code: child.pid ? 0 : 127,
      parsed_status: "started_background",
      stdout_excerpt: [
        "status=started_background",
        `pid=${child.pid || ""}`,
      ].join("\n"),
      stderr_excerpt: "",
      parsed,
    };
  } catch (error: any) {
    if (guardedIndexRefresh) clearWikiIndexRefreshLock();
    return {
      name,
      exit_code: 127,
      parsed_status: "spawn_failed",
      stdout_excerpt: "",
      stderr_excerpt: excerpt(String(error?.message || error), 800),
      parsed: {
        status: "spawn_failed",
        error: String(error?.message || error),
      },
    };
  }
}

function indexRefreshMode(step: StepResult | undefined, waitIndex: boolean): string {
  if (!step) return "none";
  if (step.parsed_status === "started_background") return "background";
  if (step.parsed_status.startsWith("skipped")) return step.parsed_status;
  return waitIndex ? "wait" : step.parsed_status;
}

function gitChangedWikiFiles(): shared.JsonObject[] {
  const result = spawnSync("git", [
    "status",
    "--short",
    "--",
    path.relative(PROJECT_ROOT, path.join(BOARD_ROOT, "wiki")),
    path.relative(PROJECT_ROOT, path.join(BOARD_ROOT, "raw")),
  ], { cwd: PROJECT_ROOT, encoding: "utf8" });
  const raw = result.stdout || "";
  return raw.split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3).trim().replace(/^"|"$/g, ""),
    }));
}

function markWikiRunnerIdle(runnerId: string, result: string, assignmentStatus = ""): void {
  shared.utils.updateRunnerState(runnerId, {
    active_role: "",
    active_item: "",
    active_ticket_id: "",
    active_ticket_title: "",
    active_ticket_path: "",
    active_spec_ref: "",
    active_stage: "idle",
    assignment_role: "",
    assigned_item_ref: "",
    contract_id: "",
    contract_digest: "",
    assignment_status: assignmentStatus,
    last_result: result,
  }, BOARD_ROOT);
}

export function cmdWikiTick(): void {
  const runnerId = currentRunnerId("wiki");
  const leasedAssignment = requireRoleAssignment("wiki", runnerId);
  let assignment = startAssignmentIfLeased(leasedAssignment);
  let assignmentLifecycle = leasedAssignment.status === "leased" ? "started" : "unchanged";
  const verbose = hasFlag("--verbose");
  const maxItems = positiveInt(getArg("--max-items"), verbose ? 12 : 5);
  const skipTelemetry = hasFlag("--skip-telemetry");
  const skipLint = hasFlag("--skip-lint");
  const noIndex = hasFlag("--no-index");
  const waitIndex = hasFlag("--wait-index");
  const forceIndex = hasFlag("--force-index");
  const noTickets = hasFlag("--no-tickets");

  const beforeFiles = sourceFiles();
  const beforeFingerprint = hashFiles(beforeFiles);
  const indexableBefore = currentIndexableSourceHash();
  const indexedBefore = currentIndexedSourceHash();
  const indexStaleBefore = indexableBefore.count > 0 && (!indexedBefore || indexedBefore !== indexableBefore.hash);
  const beforeRecent = recentSources(maxItems);
  const steps: StepResult[] = [];

  // Deterministic baseline step removed: index.md / project-overview.md were sake-of-people artifacts.
  const baselineChanged = false;
  const afterBaselineFingerprint = beforeFingerprint;
  void afterBaselineFingerprint;

  if (!skipTelemetry) {
    const windowValue = getArg("--window") || "7d";
    steps.push(runAutoflowStep("telemetry-summary", [
      "wiki",
      "summarize-telemetry",
      PROJECT_ROOT,
      boardDirName(),
      "--slug-set",
      "telemetry-default",
      "--window",
      windowValue,
    ]));
  }

  const afterRoutineFiles = sourceFiles();
  const afterRoutineFingerprint = hashFiles(afterRoutineFiles);
  const sourceChanged = beforeFingerprint !== afterRoutineFingerprint;

  if (!noIndex && (forceIndex || sourceChanged || indexStaleBefore)) {
    const ingestArgs = ["wiki", "ingest", PROJECT_ROOT, boardDirName()];
    if (noTickets) ingestArgs.push("--no-tickets");
    const trigger = forceIndex ? "force" : (sourceChanged ? "source_changed" : "stale_index");
    const cooldownMs = wikiIndexRefreshCooldownMs();
    const cooldownReference = currentIndexRefreshCooldownReference();
    const cooldownAgeMs = cooldownReference ? Math.max(0, Date.now() - cooldownReference.ms) : Number.POSITIVE_INFINITY;
    if (!forceIndex && !waitIndex && cooldownReference && cooldownMs > 0 && cooldownAgeMs < cooldownMs) {
      steps.push(skippedIndexRefreshCooldownStep(cooldownReference, cooldownMs, trigger));
    } else {
      steps.push(waitIndex
        ? runAutoflowStep("index-refresh", ingestArgs)
        : runAutoflowBackgroundStep("index-refresh", ingestArgs));
    }
  }

  if (!skipLint) {
    steps.push(runAutoflowStep("lint", ["wiki", "lint", PROJECT_ROOT, boardDirName()]));
  }

  const changedFiles = gitChangedWikiFiles();
  const indexableAfter = currentIndexableSourceHash();
  const indexedAfter = currentIndexedSourceHash();
  const indexStaleAfter = indexableAfter.count > 0 && (!indexedAfter || indexedAfter !== indexableAfter.hash);
  const failedSteps = steps.filter((step) => step.exit_code !== 0);
  const recent = recentSources(maxItems);
  const recentForFollowup = recentSources(Math.max(maxItems, 12));
  const recentDoneForFollowup = recentSources(Math.max(maxItems * 4, 50));
  const focusedRecent = recentForFollowup
    .filter((item) => isFocusedWikiSourcePath(item.path))
    .slice(0, 1);
  const focusedFingerprint = focusedWikiFingerprint();
  if (skipTelemetry && focusedFingerprint) {
    writeFocusedReviewFingerprint(focusedFingerprint);
  }
  const focusedReviewState = readFocusedReviewState();
  const focusedReviewFingerprint = focusedReviewState.focused_wiki_fingerprint;
  const recentDone = recentDoneForFollowup.filter((item) => String(item.path || "").startsWith("tickets/done/"));
  const reviewedDonePaths = new Set(focusedReviewState.reviewed_done_paths);
  const unreviewedRecentDone = recentDone.filter((item) => {
    const itemPath = String(item.path || "");
    return itemPath && !reviewedDonePaths.has(itemPath);
  });
  const focusedChanged = changedFiles.filter((item) => /^\.autoflow\/wiki\/(concepts|decisions|questions|sources)\//.test(String(item.path || "")));
  const focusedNeedsReview = !skipTelemetry && focusedRecent.length > 0 && focusedFingerprint !== focusedReviewFingerprint;
  const doneNeedsReview = unreviewedRecentDone.length > 0;
  const aiFollowupRecommended = doneNeedsReview || (baselineChanged && recentDone.length > 0) || focusedChanged.length > 0 || focusedNeedsReview;
  const indexStep = steps.find((step) => step.name === "index-refresh");
  const backgroundIndexStep = indexStep?.parsed_status === "started_background" ? indexStep : undefined;
  const followupTargetPages = mergeSourcesByPath([
    ...changedFocusedWikiSources(focusedChanged),
    ...focusedRecent,
  ]).slice(0, 1);
  const followupEvidenceSources = (doneNeedsReview ? unreviewedRecentDone : recentDone).slice(0, 1);
  const followupSources = aiFollowupRecommended
    ? compactRecentSources(mergeSourcesByPath([...followupTargetPages, ...followupEvidenceSources]))
    : [];
  if (!skipTelemetry && doneNeedsReview) {
    writePendingDoneReviewPaths(followupEvidenceSources.map((item) => String(item.path || "")).filter(Boolean));
  }

  if (failedSteps.length === 0 && !aiFollowupRecommended) {
    assignment = completeRoleAssignment(assignment, "wiki focused review completed", "completed");
    if (assignment.status !== "completed") {
      const now = shared.utils.nowIso();
      assignment = {
        ...assignment,
        status: "completed",
        completed_at: assignment.completed_at || now,
        updated_at: now,
        result: assignment.result || "wiki focused review completed",
      };
    }
    assignmentLifecycle = "completed";
    markWikiRunnerIdle(runnerId, "wiki_idle_no_followup", "completed");
  }

  const output: shared.JsonObject = {
    tool: "wiki.tick",
    runner: runnerId,
    assignment: compactAssignment(assignment),
    assignment_lifecycle: assignmentLifecycle,
    output_mode: verbose ? "verbose" : "compact",
    before_source_count: beforeFiles.length,
    after_source_count: sourceFiles().length,
    baseline_changed: baselineChanged,
    source_changed: sourceChanged,
    index_stale_before: indexStaleBefore,
    index_stale_after: indexStaleAfter,
    index_refresh_mode: indexRefreshMode(indexStep, waitIndex),
    failed_step_count: failedSteps.length,
    steps: verbose ? steps : steps.map(compactStep),
    changed_files: changedFiles,
    recent_done_pending_review_count: unreviewedRecentDone.length,
    ai_followup_recommended: aiFollowupRecommended,
    ai_followup_reason: aiFollowupRecommended && doneNeedsReview
      ? "recent_done_sources_pending_review"
      : (aiFollowupRecommended && recentDone.length > 0
        ? "recent_done_sources_present"
      : (aiFollowupRecommended && focusedChanged.length > 0
        ? "focused_wiki_pages_changed"
        : (aiFollowupRecommended && focusedNeedsReview ? "focused_wiki_review_pending" : ""))),
    ai_followup_scope: {
      inspect_only_recent_sources: followupSources,
      max_files_to_open: followupSources.length,
      max_wiki_pages_to_edit: aiFollowupRecommended ? 1 : 0,
      do_not_follow_references_outside_scope: true,
      avoid_routine_tools_already_run: true,
      rerun_tick_after_manual_wiki_edits: true,
    },
  };
  if (verbose) {
    output.board_root = BOARD_ROOT;
    output.project_root = PROJECT_ROOT;
    output.recent_sources_before = beforeRecent;
    output.recent_sources = recent;
  } else {
    output.details_hint = "rerun wiki tick with --verbose for step excerpts and full recent source lists";
  }
  const idleContextResetEnabled = /^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_WIKI_CONTEXT_RESET_ON_IDLE || "");
  if (failedSteps.length === 0 && skipTelemetry && (aiFollowupRecommended || idleContextResetEnabled)) {
    const contextReset = emitRunnerContextReset(runnerId, "wiki.tick", "compact", {
      tool: "wiki.tick",
      ai_followup_recommended: aiFollowupRecommended,
      skip_telemetry: skipTelemetry,
    });
    output.context_reset = contextReset.ok ? "queued" : "failed";
    output.context_reset_path = contextReset.path;
  }

  ok(output);
  process.exit(failedSteps.length > 0 ? 1 : 0);
}
