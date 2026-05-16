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
  getArg,
  hasFlag,
  hashFiles,
  ok,
  parseKeyValueOutput,
  positiveInt,
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
  semantic_lint?: unknown;
  pid?: unknown;
  log_path?: unknown;
  stdout_excerpt?: string;
  stderr_excerpt?: string;
};

function excerpt(value: string, max = 1600): string {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}\n[truncated:${clean.length - max}]`;
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
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
  const dbPath = path.join(BOARD_ROOT, "runners", "state", "wiki-search.db");
  if (!fs.existsSync(dbPath)) return "";
  const result = spawnSync("sqlite3", [dbPath, "SELECT value FROM wiki_index_meta WHERE key='source_hash' LIMIT 1;"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function currentIndexableSourceHash(): { hash: string; count: number } {
  const files = [
    ...walkMarkdownFiles(path.join(BOARD_ROOT, "wiki")),
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
  return /^wiki\/(answers|architecture|decisions|features|learnings)\//.test(String(value || ""));
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

function readFocusedReviewFingerprint(): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(focusedReviewStatePath(), "utf8"));
    return typeof parsed?.focused_wiki_fingerprint === "string" ? parsed.focused_wiki_fingerprint : "";
  } catch {
    return "";
  }
}

function writeFocusedReviewFingerprint(fingerprint: string): void {
  const filePath = focusedReviewStatePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = {
    focused_wiki_fingerprint: fingerprint,
    reviewed_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
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
    "semantic_lint",
    "pid",
    "log_path",
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
  const cli = autoflowCliPath();
  const logDir = path.join(BOARD_ROOT, "runners", "logs");
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {}
  const logPath = path.join(logDir, `wiki-${name}-${stamp()}.log`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(logPath, "a");
    const child = spawn(cli, cliArgs, {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", fd, fd],
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
    const parsed = {
      status: "started_background",
      pid: String(child.pid || ""),
      log_path: logPath,
    };
    return {
      name,
      exit_code: child.pid ? 0 : 127,
      parsed_status: "started_background",
      stdout_excerpt: [
        "status=started_background",
        `pid=${child.pid || ""}`,
        `log_path=${logPath}`,
      ].join("\n"),
      stderr_excerpt: "",
      parsed,
    };
  } catch (error: any) {
    return {
      name,
      exit_code: 127,
      parsed_status: "spawn_failed",
      stdout_excerpt: "",
      stderr_excerpt: excerpt(String(error?.message || error), 800),
      parsed: {
        status: "spawn_failed",
        error: String(error?.message || error),
        log_path: logPath,
      },
    };
  } finally {
    if (typeof fd === "number") {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function gitChangedWikiFiles(): shared.JsonObject[] {
  const result = spawnSync("git", [
    "status",
    "--short",
    "--",
    path.relative(PROJECT_ROOT, path.join(BOARD_ROOT, "wiki")),
    path.relative(PROJECT_ROOT, path.join(BOARD_ROOT, "wiki-raw")),
    path.relative(PROJECT_ROOT, path.join(BOARD_ROOT, "runners", "state", "wiki-baseline.history")),
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

export function cmdWikiTick(): void {
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

  steps.push(runAutoflowStep("update-baseline", ["wiki", "update", PROJECT_ROOT, boardDirName()]));
  const afterBaselineFiles = sourceFiles();
  const afterBaselineFingerprint = hashFiles(afterBaselineFiles);
  const baselineChanged = beforeFingerprint !== afterBaselineFingerprint;

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
    steps.push(waitIndex
      ? runAutoflowStep("index-refresh", ingestArgs)
      : runAutoflowBackgroundStep("index-refresh", ingestArgs));
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
  const focusedRecent = recentForFollowup
    .filter((item) => isFocusedWikiSourcePath(item.path))
    .slice(0, 3);
  const focusedFingerprint = focusedWikiFingerprint();
  if (skipTelemetry && focusedFingerprint) {
    writeFocusedReviewFingerprint(focusedFingerprint);
  }
  const focusedReviewFingerprint = readFocusedReviewFingerprint();
  const recentDone = recentForFollowup.filter((item) => String(item.path || "").startsWith("tickets/done/"));
  const focusedChanged = changedFiles.filter((item) => /^\.autoflow\/wiki\/(answers|architecture|decisions|features|learnings)\//.test(String(item.path || "")));
  const focusedNeedsReview = !skipTelemetry && focusedRecent.length > 0 && focusedFingerprint !== focusedReviewFingerprint;
  const aiFollowupRecommended = (baselineChanged && recentDone.length > 0) || focusedChanged.length > 0 || focusedNeedsReview;
  const indexStep = steps.find((step) => step.name === "index-refresh");
  const backgroundIndexStep = indexStep?.parsed_status === "started_background" ? indexStep : undefined;
  const followupSources = compactRecentSources(mergeSourcesByPath([...focusedRecent, ...recentForFollowup]));

  const output: shared.JsonObject = {
    tool: "wiki.tick",
    runner: currentRunnerId("wiki"),
    output_mode: verbose ? "verbose" : "compact",
    before_source_count: beforeFiles.length,
    after_source_count: sourceFiles().length,
    baseline_changed: baselineChanged,
    source_changed: sourceChanged,
    index_stale_before: indexStaleBefore,
    index_stale_after: indexStaleAfter,
    index_refresh_mode: indexStep ? (waitIndex ? "wait" : "background") : "none",
    failed_step_count: failedSteps.length,
    steps: verbose ? steps : steps.map(compactStep),
    changed_files: changedFiles,
    ai_followup_recommended: aiFollowupRecommended,
    ai_followup_reason: aiFollowupRecommended && recentDone.length > 0
      ? "recent_done_sources_present"
      : (aiFollowupRecommended && focusedChanged.length > 0
        ? "focused_wiki_pages_changed"
        : (aiFollowupRecommended && focusedNeedsReview ? "focused_wiki_review_pending" : "")),
    ai_followup_scope: {
      inspect_only_recent_sources: followupSources,
      avoid_routine_tools_already_run: true,
      rerun_tick_after_manual_wiki_edits: true,
    },
  };
  if (backgroundIndexStep?.parsed?.log_path) {
    output.index_refresh_log_path = backgroundIndexStep.parsed.log_path;
  }
  if (verbose) {
    output.board_root = BOARD_ROOT;
    output.project_root = PROJECT_ROOT;
    output.recent_sources_before = beforeRecent;
    output.recent_sources = recent;
  } else {
    output.details_hint = "rerun wiki tick with --verbose for step excerpts and full recent source lists";
  }

  ok(output);
  process.exit(failedSteps.length > 0 ? 1 : 0);
}
