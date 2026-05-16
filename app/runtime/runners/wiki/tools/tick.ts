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

function excerpt(value: string, max = 1600): string {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}\n[truncated:${clean.length - max}]`;
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
  const maxItems = positiveInt(getArg("--max-items"), 12);
  const skipTelemetry = hasFlag("--skip-telemetry");
  const skipLint = hasFlag("--skip-lint");
  const noIndex = hasFlag("--no-index");
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
    steps.push(runAutoflowStep("index-refresh", ingestArgs));
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
  const recentDone = recent.filter((item) => String(item.path || "").startsWith("tickets/done/"));
  const focusedChanged = changedFiles.filter((item) => /^\.autoflow\/wiki\/(answers|architecture|decisions|features|learnings)\//.test(String(item.path || "")));
  const aiFollowupRecommended = (baselineChanged && recentDone.length > 0) || focusedChanged.length > 0;

  ok({
    tool: "wiki.tick",
    runner: currentRunnerId("wiki"),
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    before_source_count: beforeFiles.length,
    after_source_count: sourceFiles().length,
    baseline_changed: baselineChanged,
    source_changed: sourceChanged,
    index_stale_before: indexStaleBefore,
    index_stale_after: indexStaleAfter,
    failed_step_count: failedSteps.length,
    steps,
    changed_files: changedFiles,
    recent_sources_before: beforeRecent,
    recent_sources: recent,
    ai_followup_recommended: aiFollowupRecommended,
    ai_followup_reason: aiFollowupRecommended && recentDone.length > 0
      ? "recent_done_sources_present"
      : (aiFollowupRecommended && focusedChanged.length > 0 ? "focused_wiki_pages_changed" : ""),
    ai_followup_scope: {
      inspect_only_recent_sources: recent.slice(0, maxItems),
      avoid_routine_tools_already_run: true,
      rerun_tick_after_manual_wiki_edits: true,
    },
  });
  process.exit(failedSteps.length > 0 ? 1 : 0);
}
