import type { ConflictInfo, GitRunResult, JsonObject, JsonValue, QueueItem, WakeEmitResult, WorkerTicketItem } from "./context";
import { BOARD_ROOT, PROJECT_ROOT, SCRIPT_DIR, TICKETS_ROOT, args, fs, path, spawnSync, utils, crypto, boardRel, currentRunnerId, emitRunnerWake, ensureTrailingNewline, escapeRe, fail, getArg, getArgs, git, hasFlag, numberValue, ok, oneLine, positiveInt, readOptionalTextFile, safeIsFile, safeSegment, idFromPath, normalizeId, collectFiles, resolveBoardPath, spawnOutputText, spawnTsScript, stringValue, stripTicks, unique } from "./context";
import { resolveAutoflowRepoRoot } from "../tsx";

export function wikiSourceGroups(): Record<string, string[]> {
  return {
    done: collectFiles(path.join(TICKETS_ROOT, "done"), /\.md$/, 8),
    retry_orders: collectFiles(path.join(TICKETS_ROOT, "order"), /^order_.*_retry_.*\.md$/, 3),
    logs: collectFiles(path.join(BOARD_ROOT, "logs"), /\.md$/, 4),
    conversations: collectFiles(path.join(BOARD_ROOT, "conversations"), /\.md$/, 4),
    wiki: collectFiles(path.join(BOARD_ROOT, "wiki"), /\.md$/, 8),
    wiki_raw: collectFiles(path.join(BOARD_ROOT, "wiki-raw"), /\.md$/, 8),
  };
}

export function hashFiles(files: string[]): string {
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    try {
      hash.update(boardRel(file));
      hash.update("\0");
      hash.update(fs.readFileSync(file));
      hash.update("\0");
    } catch {}
  }
  return hash.digest("hex");
}

export function boardDirName(): string {
  const configured = process.env.AUTOFLOW_BOARD_DIR_NAME || process.env.BOARD_DIR_NAME;
  if (configured) return configured;
  const rel = path.relative(PROJECT_ROOT, BOARD_ROOT);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel;
  return path.basename(BOARD_ROOT) || ".autoflow";
}

export function autoflowCliPath(): string {
  const configured = process.env.AUTOFLOW_CLI;
  if (configured) return configured;
  const repoCli = path.join(resolveAutoflowRepoRoot(SCRIPT_DIR), "app", "bin", "autoflow");
  if (fs.existsSync(repoCli)) return repoCli;
  const projectLocal = path.join(PROJECT_ROOT, "app", "bin", "autoflow");
  return fs.existsSync(projectLocal) ? projectLocal : "autoflow";
}

export function emitAutoflowResult(tool: string, cliArgs: string[]): void {
  const cli = autoflowCliPath();
  const result = spawnSync(cli, cliArgs, {
    encoding: "utf8",
    env: {
      ...process.env,
      PROJECT_ROOT,
      AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
      BOARD_ROOT,
      AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
      AUTOFLOW_BOARD_DIR_NAME: boardDirName(),
    },
  });
  const exitCode = typeof result.status === "number" ? result.status : 127;
  ok({
    tool,
    cli,
    cli_args: cliArgs,
    exit_code: exitCode,
    stdout: result.stdout || "",
    stderr: result.stderr || (result.error ? String(result.error) : ""),
    parsed: parseKeyValueOutput(result.stdout || ""),
  });
  process.exit(exitCode === 0 ? 0 : 1);
}

export function parseKeyValueOutput(output: string): JsonObject {
  const parsed: JsonObject = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+)=(.*)$/);
    if (!match) continue;
    parsed[match[1]] = match[2];
  }
  return parsed;
}

export function resolveLocalFile(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^`+|`+$/g, "");
  const resolved = path.resolve(path.isAbsolute(cleaned) ? cleaned : path.join(process.cwd(), cleaned));
  return resolved;
}

export function resolveWikiWritablePath(raw: string): string {
  const cleaned = raw
    .replace(/^`+|`+$/g, "")
    .replace(/\\/g, "/")
    .replace(/^[.][/]/, "")
    .replace(/^\.autoflow\//, "");
  if (!cleaned || path.isAbsolute(cleaned)) return "";
  const normalized = path.posix.normalize(cleaned);
  if (normalized === ".." || normalized.startsWith("../")) return "";
  if (!/^(wiki|wiki-raw)\//.test(normalized)) return "";
  if (!normalized.endsWith(".md")) return "";
  const resolved = path.resolve(BOARD_ROOT, normalized);
  if (!resolved.startsWith(path.resolve(BOARD_ROOT) + path.sep)) return "";
  return resolved;
}

export function parseNumstat(raw: string): Map<string, { additions: number; deletions: number }> {
  const out = new Map<string, { additions: number; deletions: number }>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(/\t/);
    if (parts.length < 3) continue;
    const additions = parts[0] === "-" ? 0 : Number.parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : Number.parseInt(parts[1], 10);
    const file = parts.slice(2).join("\t");
    out.set(file, {
      additions: Number.isFinite(additions) ? additions : 0,
      deletions: Number.isFinite(deletions) ? deletions : 0,
    });
  }
  return out;
}

export function readWikiStatusItem(line: string, gitRoot: string, numstat: Map<string, { additions: number; deletions: number }>): JsonObject {
  const rawStatus = line.slice(0, 2);
  const status = rawStatus.trim() || rawStatus;
  let rawPath = line.slice(3).trim();
  if (rawPath.includes(" -> ")) rawPath = rawPath.split(" -> ").pop() || rawPath;
  rawPath = rawPath.replace(/^"|"$/g, "");
  const abs = path.resolve(gitRoot, rawPath);
  const rel = boardRel(abs);
  const stats = numstat.get(rawPath) || numstat.get(path.relative(gitRoot, abs)) || { additions: 0, deletions: 0 };
  const untracked = rawStatus === "??";
  const additions = untracked ? safeLineCount(abs) : stats.additions;
  const deletions = stats.deletions;
  return {
    path: rel,
    status,
    category: wikiCategory(rel),
    additions,
    deletions,
    untracked,
    weight: wikiFileWeight(rel),
  };
}

export function safeLineCount(file: string): number {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.split(/\r?\n/).filter((line) => line.length > 0).length;
  } catch {
    return 0;
  }
}

export function wikiCategory(rel: string): string {
  const clean = rel.replace(/^\.autoflow\//, "");
  const parts = clean.split("/");
  if (parts[0] === "wiki-raw") return "raw";
  if (parts[0] !== "wiki") return "other";
  return parts[1] || "root";
}

export function wikiFileWeight(rel: string): number {
  const clean = rel.replace(/^\.autoflow\//, "");
  const base = path.basename(clean);
  if (clean === "wiki/index.md" || clean === "wiki/log.md") return 0;
  if (/\.(manifest|history|fingerprint)$/.test(base)) return 0;
  if (clean.startsWith("wiki-raw/")) return 1;
  if (/^wiki\/(answers|architecture|decisions|features|learnings|operations|sources)\//.test(clean)) return 5;
  return clean.startsWith("wiki/") ? 3 : 0;
}
