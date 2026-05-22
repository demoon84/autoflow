#!/usr/bin/env npx tsx
/*
 * install-stop-hook.ts — manage Codex Stop hook manifest without shell.
 *
 * Actions:
 *   install — ensure this repo's check-stop hook is registered (idempotent),
 *             and prune Stop entries that point at non-existent commands.
 *   remove  — strip this repo's check-stop hook (preserve other entries),
 *             and prune dead entries while we're at it.
 *   status  — read-only report.
 *   prune   — only prune dead entries, do not change install state.
 *
 * Pruning targets `command` strings that look like absolute filesystem paths
 * (literal or shell-quoted) where the resolved path no longer exists. Hooks
 * with relative commands or shell-expression commands (e.g. `bash "$X/foo"`)
 * are left intact, because we cannot safely decide whether they're stale.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));

const action = process.argv[2] || "install";
if (!["install", "remove", "status", "prune"].includes(action) || process.argv.length > 3) {
  process.stderr.write("Usage: install-stop-hook.ts [install|remove|status|prune]\n");
  process.exit(1);
}

const manifestPath = resolveManifestPath(process.env.AUTOFLOW_CODEX_HOOKS_PATH || process.env.CODEX_HOOKS_PATH || path.join(os.homedir(), ".codex", "hooks.json"));
const checkStopScriptPath = path.join(__dirname, "check-stop.ts");
const autoflowCliPath = path.join(__dirname, "..", "..", "bin", "autoflow");
const defaultCommandText = `${quoteCommand(autoflowCliPath)} tool check-stop`;
const legacyCommandTexts = [quoteCommand(checkStopScriptPath)];
const commandText = process.env.AUTOFLOW_STOP_HOOK_COMMAND || defaultCommandText;
const timeoutValue = positiveInt(process.env.AUTOFLOW_STOP_HOOK_TIMEOUT || "", 30);

const manifestExists = fs.existsSync(manifestPath);
let data: any = {};
if (manifestExists) {
  const raw = fs.readFileSync(manifestPath, "utf8").trim();
  data = raw ? JSON.parse(raw) : {};
}
if (!data || typeof data !== "object" || Array.isArray(data)) {
  throw new Error(`hook manifest root must be a JSON object: ${manifestPath}`);
}

let hooks = data.hooks;
if (hooks === undefined) hooks = {};
if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) {
  throw new Error(`hook manifest 'hooks' must be a JSON object: ${manifestPath}`);
}
data.hooks = hooks;

let stopEntries = hooks.Stop;
if (stopEntries === undefined) stopEntries = [];
if (!Array.isArray(stopEntries)) throw new Error(`hook manifest 'hooks.Stop' must be a JSON array: ${manifestPath}`);
hooks.Stop = stopEntries;

const hookMatches = (hook: any): boolean => hook && typeof hook === "object" && !Array.isArray(hook) && hook.type === "command" && hook.command === commandText;
const legacyHookMatches = (hook: any): boolean => hook && typeof hook === "object" && !Array.isArray(hook) && hook.type === "command" && legacyCommandTexts.includes(hook.command);
const entryMatches = (entry: any): boolean => entry && typeof entry === "object" && !Array.isArray(entry) && Array.isArray(entry.hooks) && entry.hooks.some(hookMatches);

const installedBefore = stopEntries.some(entryMatches);
let changed = false;
const prunedCommands: string[] = [];

const pruneStaleEntries = (): void => {
  // Walk every Stop entry's inner hooks list and drop the ones whose command
  // resolves to an absolute path that no longer exists. Keep entries we can't
  // safely judge (relative paths, env-var commands, etc.) so we never delete
  // a working hook by accident.
  const next: any[] = [];
  for (const entry of stopEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !Array.isArray(entry.hooks)) {
      next.push(entry);
      continue;
    }
    const filteredHooks = entry.hooks.filter((hook: any) => {
      const cmd = extractAbsoluteCommandPath(hook);
      if (!cmd) return true;
      if (fs.existsSync(cmd)) return true;
      prunedCommands.push(cmd);
      changed = true;
      return false;
    });
    if (filteredHooks.length === 0) continue;
    if (filteredHooks.length === entry.hooks.length) {
      next.push(entry);
    } else {
      next.push({ ...entry, hooks: filteredHooks });
    }
  }
  stopEntries = next;
  hooks.Stop = stopEntries;
};

// Always prune dead entries first, regardless of action. This keeps the
// manifest tidy even when the user just runs `status` — except for `status`
// we leave the prune as observation-only (no write).
pruneStaleEntries();
const stalePrunedDuringRead = changed;

if (action === "install" && !process.env.AUTOFLOW_STOP_HOOK_COMMAND) {
  hooks.Stop = stopEntries.flatMap((entry: any) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !Array.isArray(entry.hooks)) return [entry];
    const filtered = entry.hooks.filter((hook: any) => !legacyHookMatches(hook));
    if (filtered.length !== entry.hooks.length) changed = true;
    return filtered.length > 0 ? [{ ...entry, hooks: filtered }] : [];
  });
  stopEntries = hooks.Stop;
}

if (action === "install" && !installedBefore) {
  stopEntries.push({ hooks: [{ type: "command", command: commandText, timeout: timeoutValue }] });
  changed = true;
}
if (action === "remove") {
  hooks.Stop = stopEntries.flatMap((entry: any) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !Array.isArray(entry.hooks)) return [entry];
    const filtered = entry.hooks.filter((hook: any) => !hookMatches(hook));
    if (filtered.length !== entry.hooks.length) changed = true;
    return filtered.length > 0 ? [{ ...entry, hooks: filtered }] : [];
  });
  stopEntries = hooks.Stop;
}

const installedAfter = (hooks.Stop || []).some(entryMatches);
const writeManifest = action !== "status" && changed;
if (writeManifest) {
  if (!hooks.Stop || hooks.Stop.length === 0) delete hooks.Stop;
  if (!manifestExists) {
    data.name ??= "autoflow";
    data.description ??= "Generated by Autoflow stop-hook installer.";
  }
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const tempPath = path.join(path.dirname(manifestPath), `.autoflow-hooks-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, manifestPath);
}

printPairs({
  manifest_path: manifestPath,
  manifest_exists_before: manifestExists ? "true" : "false",
  manifest_changed: writeManifest ? "true" : "false",
  installed_before: installedBefore ? "true" : "false",
  installed_after: installedAfter ? "true" : "false",
  status: installedAfter ? "installed" : "missing",
  action,
  pruned_count: String(prunedCommands.length),
  pruned_commands: prunedCommands.join(" | "),
  prune_seen_during_read: stalePrunedDuringRead ? "true" : "false",
  board_root: boardRoot,
  project_root: projectRoot,
  command: commandText,
});

function resolveManifestPath(rawPath: string): string {
  const raw = rawPath.replace(/^['"]+|['"]+$/g, "");
  if (raw === "~") return os.homedir();
  if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
  if (path.isAbsolute(raw)) return path.normalize(raw);
  return path.resolve(process.cwd(), raw);
}

function quoteCommand(commandPath: string): string {
  return `"${commandPath.replace(/"/g, '\\"')}"`;
}

function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function printPairs(fields: Record<string, string>): void {
  for (const [key, value] of Object.entries(fields)) process.stdout.write(`${key}=${value}\n`);
}

// Pull an absolute filesystem path out of a hook command string if and only
// if the command is "<absolute-path>" or '<absolute-path>' (optionally
// surrounded by whitespace). Returns "" for relative paths, shell pipelines,
// env-var expansions, or commands that combine flags with the path — in
// those cases we lack the context to declare them stale, so we keep them.
function extractAbsoluteCommandPath(hook: any): string {
  if (!hook || typeof hook !== "object" || Array.isArray(hook)) return "";
  if (hook.type !== "command") return "";
  const raw = typeof hook.command === "string" ? hook.command.trim() : "";
  if (!raw) return "";
  const stripped = raw.replace(/^['"]+|['"]+$/g, "");
  // Reject shell-y commands. Anything that uses a shell variable, pipe,
  // redirect, semicolon, or contains whitespace is left for the user to
  // judge; only literal path-only commands are auto-pruned.
  if (/[\s;|&<>$`]/.test(stripped)) return "";
  if (!path.isAbsolute(stripped)) return "";
  return path.normalize(stripped);
}
