import { spawnSync } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { cliInvocation } from "./cli-invocation";
import { activeCoreRegistryEntry, coreBundledShareRoot } from "./core-registry";
import { parseTomlStringValue, stripTomlComment } from "./manifest-toml";
import { normalizeRunnerRole, wikiPendingReviewPathsSync } from "./board-queue";
import { defaultBoardDirName } from "./pty-scope";

function repoRoot(): string {
  return process.env.AUTOFLOW_REPO_ROOT || "";
}

function parseRunnerStateFileText(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

export function boardManifestShareRoot(projectRoot: string, boardDirName: string): string {
  if (!projectRoot) return "";
  const boardName = boardDirName || defaultBoardDirName();
  const manifestPath = path.join(projectRoot, boardName, "manifest.toml");
  let currentSection = "";
  try {
    const text = fsSync.readFileSync(manifestPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;
      const section = line.match(/^\[([^\]]+)\]$/);
      if (section) {
        currentSection = section[1].trim();
        continue;
      }
      if (currentSection !== "core") continue;
      const match = line.match(/^share_root\s*=\s*(.+)$/);
      if (match) return path.resolve(parseTomlStringValue(match[1]));
    }
  } catch {
    return "";
  }
  return "";
}

export function resolvedShareRoot(projectRoot = "", boardDirName = ""): string {
  const override = process.env.AUTOFLOW_SHARE_ROOT;
  if (override && override.trim()) return path.resolve(override);
  const registryEntry = activeCoreRegistryEntry();
  if (registryEntry?.shareRoot) return registryEntry.shareRoot;
  const boardShareRoot = boardManifestShareRoot(projectRoot, boardDirName);
  if (boardShareRoot) return boardShareRoot;
  return coreBundledShareRoot(repoRoot());
}

export function runnerConfigReadPath(projectRoot: string, boardDirName: string): string {
  if (!projectRoot) return "";
  const boardName = boardDirName || defaultBoardDirName();
  const local = path.join(projectRoot, boardName, "runners", "config.local.toml");
  if (fsSync.existsSync(local)) return local;
  const template = path.join(resolvedShareRoot(projectRoot, boardName), "reference", "runners", "config.toml");
  if (fsSync.existsSync(template)) return template;
  return path.join(projectRoot, boardName, "runners", "config.toml");
}

export function readRunnerConfigBlocks(projectRoot: string, boardDirName: string): Record<string, string>[] {
  if (!projectRoot) return [];
  const configPath = runnerConfigReadPath(projectRoot, boardDirName);
  let text = "";
  try {
    text = fsSync.readFileSync(configPath, "utf8");
  } catch {
    return [];
  }
  const items: Record<string, string>[] = [];
  let current: { section: string; tableId: string; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const values: Record<string, string> = {};
    for (const rawLine of current.lines) {
      const line = stripTomlComment(rawLine).trim();
      const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!match) continue;
      values[match[1]] = parseTomlStringValue(match[2]);
    }
    if (current.tableId && !values.id) {
      values.id = current.tableId;
    }
    if (values.id) items.push(values);
    current = null;
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    const arrayHeader = line.match(/^\[\[runners\]\]$/);
    const namedHeader = line.match(/^\[runners\.([^\]]+)\]$/);
    if (arrayHeader || namedHeader) {
      flush();
      current = {
        section: "runners",
        tableId: namedHeader ? parseTomlStringValue(namedHeader[1] || "") : "",
        lines: []
      };
      continue;
    }
    if (/^\[/.test(line)) {
      flush();
      continue;
    }
    if (current) {
      current.lines.push(rawLine);
    }
  }
  flush();
  return items;
}

export function readRunnerConfigBlock(projectRoot: string, boardDirName: string, runnerId: string): Record<string, string> {
  if (!projectRoot || !runnerId) return {};
  for (const values of readRunnerConfigBlocks(projectRoot, boardDirName)) {
    if (values.id === runnerId) return values;
  }
  return {};
}

export function safeAssignmentSegment(value: unknown): string {
  return String(value || "").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function readRunnerAssignmentSync(boardRoot: string, runnerId: string): Record<string, unknown> | null {
  const safeRunner = safeAssignmentSegment(runnerId);
  if (!boardRoot || !safeRunner) return null;
  const assignmentPath = path.join(boardRoot, "automations", "state", "assignments", `${safeRunner}.json`);
  try {
    const assignment = JSON.parse(fsSync.readFileSync(assignmentPath, "utf8"));
    return assignment && assignment.runner_id ? assignment : null;
  } catch {
    return null;
  }
}

export function activeAssignmentStatus(status: unknown): boolean {
  return ["leased", "running"].includes(String(status || "").toLowerCase());
}

export function currentRunnerAssignmentRole(projectRoot: string, boardDirName: string, runnerId: string): string {
  if (!projectRoot || !runnerId) return "";
  const assignment = readRunnerAssignmentSync(
    path.join(projectRoot, boardDirName || defaultBoardDirName()),
    runnerId
  );
  const status = String(assignment?.status || "").toLowerCase();
  if (!["leased", "running"].includes(status)) return "";
  const role = String(assignment?.role || "").trim();
  return role ? normalizeRunnerRole(role) : "";
}

export function ensureWikiAssignmentForPendingWorkSync(
  { projectRoot, boardDirName, boardRoot, runnerId }: { projectRoot: string; boardDirName: string; boardRoot: string; runnerId: string }
): Record<string, unknown> | null {
  if (!projectRoot || !boardRoot || !runnerId) return null;
  const pendingPaths = wikiPendingReviewPathsSync(boardRoot);
  if (pendingPaths.length === 0) return null;

  const current = readRunnerAssignmentSync(boardRoot, runnerId);
  if (current && activeAssignmentStatus(current.status)) {
    return String(current.role || "").toLowerCase() === "wiki" ? current : null;
  }

  const item = pendingPaths[0];
  const invocation = cliInvocation([
    "tool",
    "assignment",
    "create",
    "--runner",
    runnerId,
    "--role",
    "wiki",
    "--item",
    item,
    "--contract-id",
    "wiki-focused-review-v1",
    "--contract-summary",
    `위키 갱신 필요: ${item}`,
    "--contract-ref",
    "reference/runner-startup-rules/wiki-maintainer.md",
    "--contract-ref",
    "agents/wiki-maintainer-agent.md",
    "--ttl-sec",
    "21600"
  ]);
  const env = {
    ...process.env,
    ...invocation.env,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    BOARD_ROOT: boardRoot,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_BOARD_DIR_NAME: boardDirName || defaultBoardDirName(),
    AUTOFLOW_ROLE: "wiki",
    AUTOFLOW_RUNNER_ID: runnerId,
    RUNNER_ID: runnerId
  };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: projectRoot,
    encoding: "utf8",
    env
  });
  if (result.status !== 0) return null;
  try {
    const parsed = JSON.parse(String(result.stdout || "{}"));
    return parsed?.assignment || null;
  } catch {
    return readRunnerAssignmentSync(boardRoot, runnerId);
  }
}

export function runnerStateAssignmentRole(projectRoot: string, boardDirName: string, runnerId: string): string {
  if (!projectRoot || !runnerId) return "";
  const statePath = path.join(projectRoot, boardDirName || defaultBoardDirName(), "runners", "state", `${runnerId}.state`);
  try {
    const values = parseRunnerStateFileText(fsSync.readFileSync(statePath, "utf8"));
    const status = String(values.assignment_status || "").toLowerCase();
    const assignedItem = String(values.assigned_item_ref || "").trim();
    if (!assignedItem || !["leased", "running"].includes(status)) return "";
    const role = String(values.assignment_role || values.active_role || "").trim();
    return role ? normalizeRunnerRole(role) : "";
  } catch {
    return "";
  }
}

export function inferRunnerRoleFromId(runnerId: unknown): string {
  const id = String(runnerId || "").toLowerCase();
  if (id === "worker" || id.startsWith("worker-")) return "worker";
  if (id === "wiki" || id.startsWith("wiki-")) return "wiki-maintainer";
  if (id === "verifier" || id.startsWith("verifier-")) return "verifier";
  return "planner";
}

export function resolveRunnerStartRole(
  { projectRoot, boardDirName, runnerId, diskRunnerConfig = {}, requestedRole = "" }:
  { projectRoot: string; boardDirName: string; runnerId: string; diskRunnerConfig?: Record<string, string>; requestedRole?: string }
): string {
  const assignmentRole = currentRunnerAssignmentRole(projectRoot, boardDirName, runnerId);
  if (assignmentRole) return assignmentRole;
  const stateRole = runnerStateAssignmentRole(projectRoot, boardDirName, runnerId);
  if (stateRole) return stateRole;
  return String(diskRunnerConfig.role || requestedRole || inferRunnerRoleFromId(runnerId));
}

export function runnerConfigBoolean(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
}

export function canonicalWorkerRunnerId(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes(":")) {
    return canonicalWorkerRunnerId(normalized.split(":")[0]);
  }
  if (normalized === "worker" || normalized === "ticket") return "worker";
  if (/^ai-\d+$/i.test(normalized)) return normalized.replace(/^ai-/i, "worker-");
  return normalized;
}
