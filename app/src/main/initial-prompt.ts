import fsSync from "node:fs";
import path from "node:path";
import {
  listQueueFilesSync,
  normalizeRunnerRole,
  walkMarkdownFilesSync,
  workItemQueueFilePattern
} from "./board-queue";
import { buildRunnerStartupScan } from "./context-reset";
import { defaultBoardDirName } from "./pty-scope";
import { resolvedShareRoot } from "./runner-config-read";
import { autoflowShellCommand } from "./shell-path";

export function userShareRoot(projectRoot = "", boardDirName = ""): string {
  return resolvedShareRoot(projectRoot, boardDirName);
}

export function roleInstructionPath(_boardRoot: string, role: string): string {
  const shareRoot = userShareRoot();
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return path.join(shareRoot, "agents", "plan-to-ticket-agent.md");
    case "worker":
      return path.join(shareRoot, "agents", "worker-agent.md");
    case "verifier":
      return path.join(shareRoot, "agents", "verifier-agent.md");
    case "wiki-maintainer":
      return path.join(shareRoot, "agents", "wiki-maintainer-agent.md");
    case "coordinator":
      return path.join(shareRoot, "agents", "plan-to-ticket-agent.md");
    default:
      return path.join(shareRoot, "agents", "plan-to-ticket-agent.md");
  }
}

export function startupRulesPath(_boardRoot: string, role: string): string {
  const shareRoot = userShareRoot();
  switch (normalizeRunnerRole(role)) {
    case "planner":
      return path.join(shareRoot, "reference", "runner-startup-rules", "planner.md");
    case "worker":
      return path.join(shareRoot, "reference", "runner-startup-rules", "worker.md");
    case "verifier":
      return path.join(shareRoot, "reference", "runner-startup-rules", "verifier.md");
    case "wiki-maintainer":
      return path.join(shareRoot, "reference", "runner-startup-rules", "wiki-maintainer.md");
    default:
      return "";
  }
}

export function commonStartupRulesPath(_boardRoot: string): string {
  return path.join(userShareRoot(), "reference", "runner-startup-common.md");
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

function markdownFileLink(label: string, filePath: string): string {
  const safeLabel = String(label || filePath || "").replace(/[\]\n\r]/g, " ").trim() || String(filePath || "");
  const safeTarget = String(filePath || "").replace(/>/g, "%3E");
  return `[${safeLabel}](<${safeTarget}>)`;
}

function normalizeStartupPrdKey(raw: unknown): string {
  const match = String(raw || "").match(/\bPRD[-_]?(\d+)\b/i);
  if (!match) return "";
  return `PRD-${String(Number.parseInt(match[1], 10)).padStart(3, "0")}`;
}

function startupPrdKeysFromText(text: unknown): Set<string> {
  const keys = new Set<string>();
  const re = /\bPRD[-_]?(\d+)\b/gi;
  let match;
  while ((match = re.exec(String(text || ""))) !== null) {
    const key = normalizeStartupPrdKey(match[0]);
    if (key) keys.add(key);
  }
  return keys;
}

function startupPrdKeyFromHandoffFile(boardRoot: string, filePath: string): string {
  const rel = path.relative(path.join(boardRoot, "conversations"), filePath).split(path.sep).join("/");
  const fromPath = normalizeStartupPrdKey(rel);
  if (fromPath) return fromPath;
  try {
    return Array.from(startupPrdKeysFromText(fsSync.readFileSync(filePath, "utf8")))[0] || "";
  } catch {
    return "";
  }
}

function startupRelevantPrdKeys(boardRoot: string, role: string): Set<string> {
  const keys = new Set<string>();
  const addFromFile = (filePath: string) => {
    try {
      for (const key of startupPrdKeysFromText(fsSync.readFileSync(filePath, "utf8"))) {
        keys.add(key);
      }
    } catch {}
  };
  const addTicketBucket = (bucket: string) => {
    for (const filePath of listQueueFilesSync(boardRoot, `tickets/${bucket}`, workItemQueueFilePattern, 200)) {
      addFromFile(filePath);
    }
  };

  switch (normalizeRunnerRole(role)) {
    case "planner":
      for (const filePath of listQueueFilesSync(boardRoot, "tickets/prd", /^PRD[-_].+\.md$/i, 200)) {
        const key = normalizeStartupPrdKey(path.basename(filePath, ".md"));
        if (key) keys.add(key);
      }
      addTicketBucket("todo");
      addTicketBucket("inprogress");
      break;
    case "worker":
      addTicketBucket("todo");
      addTicketBucket("inprogress");
      addTicketBucket("verifier");
      break;
    case "verifier":
      addTicketBucket("verifier");
      break;
    case "wiki-maintainer":
      break;
    default:
      break;
  }
  return keys;
}

function collectStartupHandoffLinks(
  { role, projectRoot, boardDirName }: { role: string; projectRoot: string; boardDirName: string },
  limit = 8
): { filePath: string; rel: string; prdKey: string; mtimeMs: number }[] {
  const boardRoot = path.join(projectRoot, boardDirName || defaultBoardDirName());
  const conversationsRoot = path.join(boardRoot, "conversations");
  if (!fsSync.existsSync(conversationsRoot)) return [];
  const relevantPrdKeys = startupRelevantPrdKeys(boardRoot, role);
  const allFiles = walkMarkdownFilesSync(conversationsRoot)
    .filter((filePath) => path.basename(filePath).toLowerCase() !== "readme.md")
    .map((filePath) => {
      let stat: fsSync.Stats | null = null;
      try { stat = fsSync.statSync(filePath); } catch {}
      const prdKey = startupPrdKeyFromHandoffFile(boardRoot, filePath);
      return {
        filePath,
        rel: path.relative(boardRoot, filePath).split(path.sep).join("/"),
        prdKey,
        mtimeMs: stat?.mtimeMs || 0
      };
    })
    .filter((entry) => entry.filePath && (!relevantPrdKeys.size || relevantPrdKeys.has(entry.prdKey)));
  return allFiles
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.rel.localeCompare(b.rel))
    .slice(0, Math.max(0, limit));
}

function buildStartupHandoffLinksBlock(options: { role: string; projectRoot: string; boardDirName: string }): string[] {
  const links = collectStartupHandoffLinks(options, 8);
  if (!links.length) return [];
  return [
    `Startup handoff links:`,
    `- These links are supporting context. Do not open them until the startup scan selects the matching PRD/work item scope.`,
    `- The PRD or ticket file remains the source of truth; handoff files preserve conversation context.`,
    ...links.map((entry) => {
      const prdSuffix = entry.prdKey ? ` (${entry.prdKey})` : "";
      return `- ${markdownFileLink(entry.rel, entry.filePath)}${prdSuffix}`;
    })
  ];
}

function startupRuleLinksBlock({ commonRulesPath, roleRulesPath }: { commonRulesPath: string; roleRulesPath: string }): string[] {
  const links = [
    { label: "common runner startup rules", filePath: commonRulesPath },
    roleRulesPath ? { label: "role runner startup rules", filePath: roleRulesPath } : null
  ].filter((x): x is { label: string; filePath: string } => Boolean(x));
  if (!links.length) return [];
  return [
    `Startup rule links:`,
    `- These rule files are linked, not inlined. Use the compact startup tool output and the scan order below first.`,
    `- Open a linked rule file only if the compact tool fails or the selected scoped work directly requires expanded contract text.`,
    ...links.map((entry) => {
      const status = fsSync.existsSync(entry.filePath) ? "" : " (missing on disk; report this and continue with the scan order below)";
      return `- ${markdownFileLink(entry.label, entry.filePath)}${status}`;
    })
  ];
}

export function buildInitialPrompt(
  { role, agent, runnerId, projectRoot, boardDirName }:
  { role: string; agent: string; runnerId: string; projectRoot: string; boardDirName: string }
): string {
  const boardRoot = path.join(projectRoot, boardDirName);
  const ticketsRoot = path.join(boardRoot, "tickets");
  const normalizedRole = normalizeRunnerRole(role);
  const compactStartupRole = ["planner", "worker", "verifier", "wiki-maintainer"].includes(normalizedRole);
  const roleInstruction = roleInstructionPath(boardRoot, role);
  const commonRulesPath = commonStartupRulesPath(boardRoot);
  const roleRulesPath = startupRulesPath(boardRoot, role);
  const startupRuleLinks = startupRuleLinksBlock({ commonRulesPath, roleRulesPath });
  const startupHandoffLinks = buildStartupHandoffLinksBlock({ role: normalizedRole, projectRoot, boardDirName });
  const runnerStageCmd = autoflowShellCommand(["tool", "runner-stage"]);
  const runnerTokensCmd = autoflowShellCommand(["tool", "runner-tokens"]);
  const startupScan = buildRunnerStartupScan({ role, runnerId }) || [
    `Startup scan:`,
    `  - List ${ticketsRoot} subfolders and pick up anything pending for this role.`
  ].join("\n");
  const projectAgents = path.join(projectRoot, "AGENTS.md");
  const boardAgents = path.join(boardRoot, "AGENTS.md");
  const fullContractFiles = uniquePaths(
    compactStartupRole
      ? []
      : [roleInstruction, projectAgents, boardAgents]
  );
  const contractReadIntro = compactStartupRole
    ? [
        `This startup turn is token-sensitive. Do not open full AGENTS, role docs,`,
        `or broad source searches unless the compact startup tool reports a failed`,
        `step or the scoped paths make those files directly relevant.`
      ]
    : [
        `Read these full contract files once before planning, editing board state, or`,
        `making role judgments:`
      ];
  const injectedStartupRules = normalizedRole === "wiki-maintainer"
    ? [
        `Compact wiki startup rules from the Desktop start button:`,
        `- Run the wiki tick command below once inside this visible turn.`,
        `- If tick.ai_followup_recommended=false, summarize the compact result; leave this runner idle and waiting for the next handoff.`,
        `- If follow-up is needed, inspect only tick.ai_followup_scope.inspect_only_recent_sources.`,
        `- Do not open or follow references outside the inspect_only_recent_sources list.`,
        `- Write or update at most one focused wiki page via wiki write-page (DB upsert; no .autoflow/wiki markdown), then rerun tick with --skip-telemetry once.`,
        `- If the rerun tick still reports ai_followup_recommended=true or recent_done_pending_review_count > 0, summarize the focused update and let the Stop hook continue. When no follow-up remains, summarize and leave this runner idle.`
      ]
    : startupRuleLinks;
  const runnerTail: string[] = (() => {
    switch (normalizedRole) {
      case "planner":
        return [
          `Planner turn boundaries:`,
          `- Do not call runner-stage, runner-tokens, or date during this focused planner startup turn; Desktop tracks PTY state and usage.`,
          `- Use only planner queue-snapshot output and its ai_followup_scope before opening any board file.`,
          `- Do not open or follow references outside snapshot.ai_followup_scope.inspect_only_recent_sources.`,
          `- After the selected PRD's worker-facing work item set is created, rerun queue-snapshot so the tool closes the planner assignment; after that, summarize briefly and leave this runner idle when no actionable work remains.`,
          `- Every PRD must produce at least one work item before being archived. The runtime slicer guarantees this on the normal path; do not idle before the slice is materialized.`
        ];
      case "worker":
        return [
          `Worker turn boundaries:`,
          `- Do not call generic runner-stage, runner-tokens, or date during this focused worker startup turn; Desktop tracks PTY state and usage.`,
          `- Use worker active-get first. When active-get reports no owned ticket, always run work-snapshot before any no-work decision.`,
          `- Do not open or follow references outside the selected ticket scope before claim/worktree-ensure.`,
          `- Product file inspection starts only after worktree-ensure succeeds and must stay inside Allowed Paths.`,
          `- After the current ticket reaches a wait state, blocker, or finalization, summarize briefly. If no actionable work remains, leave this runner idle and waiting for the next handoff.`
        ];
      case "verifier":
        return [
          `Legacy inactive role boundaries:`,
          `- This role is retained only for old board compatibility.`,
          `- Current Autoflow uses planner, worker, and wiki-maintainer.`,
          `- Do not claim new work from this role. Summarize that the role is inactive and leave it idle.`
        ];
      case "wiki-maintainer":
        return [
          `Wiki turn boundaries:`,
          `- Do not call runner-stage during this focused wiki turn; Desktop tracks the PTY state.`,
          `- Do not run date. If no exact timestamp is already in scope, keep the existing frontmatter timestamp.`,
          `- Do not open or follow references outside tick.ai_followup_scope.inspect_only_recent_sources.`,
          `- After one focused summary once the rerun tick finishes, idle only if the rerun tick reports no follow-up. If follow-up remains, let the Stop hook continue another focused wiki turn.`
        ];
      default:
        return [
          `After the startup scan, continue this role's normal Autoflow work.`,
          `Keep working as long as anything is pending in the relevant queue.`,
          ``,
          `Hard rules: no git push; stay within the active ticket's Allowed Paths;`,
          `record durable progress in board files; do not re-read the full startup`,
          `contract files again within this session unless this runner process restarts.`,
          ``,
          `Active reporting (every turn — required):`,
          `  - On stage change: \`${runnerStageCmd} <stage> --runner ${runnerId} [--ticket <work-item-id>]\``,
          `  - End of turn: Desktop records provider usage automatically when exact live usage metadata is emitted.`,
          `    Do not also run \`${runnerTokensCmd} report\` for the same Desktop PTY turn.`,
          `    Only use \`${runnerTokensCmd} report --runner ${runnerId} --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]\``,
          `    in non-Desktop runs or when the host explicitly asks for a manual report and exact values are visible.`,
          `If exact values are not visible, skip token reporting; never report 0/0, placeholders, or estimates.`,
          `Format tick-id as`,
          `\`${runnerId}-<unix-epoch-sec>-<random4>\` so duplicates dedupe correctly.`
        ];
    }
  })();
  return [
    `Autoflow ${role} runner started (id=${runnerId}, agent=${agent}).`,
    `Project root: ${projectRoot}`,
    `Board root:   ${boardRoot}`,
    `Runner id:    ${runnerId}`,
    `Role:         ${normalizedRole}`,
    `Assignment:   run \`${autoflowShellCommand(["tool", "assignment", "current", "--runner", runnerId])}\` to inspect the current runner assignment before acting.`,
    `Autoflow CLI: "$AUTOFLOW_CLI" is injected as a runnable shim, and its directory is first on PATH as "autoflow".`,
    `If plain "autoflow" or npx autoflow fails, use "$AUTOFLOW_CLI"; do not idle because the global CLI is missing.`,
    ``,
    ...startupHandoffLinks,
    startupHandoffLinks.length ? `` : null,
    ...injectedStartupRules,
    ``,
    `Desktop opened this PTY because the user explicitly started the runner.`,
    compactStartupRole
      ? `Run the compact startup tool inside this visible turn, then decide whether focused work is needed.`
      : `Run the startup scan below, then either work on the actionable item or record why the runner is idling.`,
    ``,
    ...contractReadIntro,
    ...fullContractFiles.map((filePath) => {
      const status = fsSync.existsSync(filePath) ? "" : " (missing on disk; report this and continue with injected rules)";
      return `  - ${filePath}${status}`;
    }),
    `Do not recursively expand Read Order lists inside host/board AGENTS unless`,
    `the active work requires the referenced document.`,
    ``,
    startupScan,
    ``,
    ...runnerTail
  ].filter((line): line is string => line !== null && typeof line !== "undefined").join("\n");
}
