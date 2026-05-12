#!/usr/bin/env npx tsx
/**
 * start-plan.ts
 *
 * Primary TypeScript implementation for the Autoflow Planner AI runner.
 * It preserves the legacy start-plan key=value contract while moving the
 * express, retry, inbox, backlog, priority, and backlog-first orchestration
 * out of start-plan.legacy.sh.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import * as utils from "./board-utils";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const BOARD_ROOT = utils.resolveBoardRoot();
const PROJECT_ROOT = utils.resolveProjectRoot();
const requestedArg = process.argv[2] ?? "";
const requestedNormalized = normalizeId(requestedArg);
const workerId = process.env.AUTOFLOW_WORKER_ID || process.env.WORKER_ID || "planner";
const displayId = displayWorkerId(workerId);

type PlannerSource =
  | "express-order-to-todo"
  | "backlog-to-todo"
  | "order-inbox-retry"
  | "order-inbox"
  | "legacy-plan"
  | "vague-done-when"
  | "needs-user-secret";

function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(
      "start-plan.ts - Autoflow Planner AI runner.\n" +
        "Usage: npx tsx start-plan.ts [id]\n" +
        "Sources: express-order-to-todo | backlog-to-todo | order-inbox-retry | order-inbox | legacy-plan | idle\n"
    );
    return;
  }

  ensureExpectedRole("plan");
  setThreadContextRecord("plan", workerId, "", "", "");

  const expressOrder = selectExpressInboxOrder();
  if (expressOrder) {
    const ticket = createExpressTodoFromOrder(expressOrder);
    if (ticket) {
      const orderId = extractNumericId(expressOrder);
      emit({
        status: "ok",
        source: "express-order-to-todo",
        order: `tickets/done/express_${orderId}/${path.basename(expressOrder)}`,
        todo_ticket: ticket,
        project_key: `express_${orderId}`,
        path: "express",
        board_root: BOARD_ROOT,
        project_root: PROJECT_ROOT,
        next_action: `Express ticket ${path.basename(ticket)} ready for ticket owner; PRD authoring skipped.`,
      });
      return;
    }
  }

  const orderGeneratedSpec = selectOrderGeneratedSpec();
  if (orderGeneratedSpec) promoteSpecToTodoOrExit(orderGeneratedSpec);

  const retryOrder = selectInboxRetryOrder();
  if (retryOrder) {
    emit({
      status: "ok",
      source: "order-inbox-retry",
      order: retryOrder,
      order_id: extractNumericId(retryOrder),
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Promote retry order ${boardRelativePath(retryOrder)} per plan-to-ticket-agent.md, then rerun start-plan.`,
    });
    return;
  }

  const nonretryOrder = selectInboxNonretryOrder();
  const spec = selectPopulatedSpec();
  const policyPick = choosePolicyPick(nonretryOrder, spec);

  if (policyPick === "spec" && spec) promoteSpecToTodoOrExit(spec);

  if (policyPick === "order" && nonretryOrder) {
    emit({
      status: "ok",
      source: "order-inbox",
      order: nonretryOrder,
      order_id: extractNumericId(nonretryOrder),
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Promote order ${boardRelativePath(nonretryOrder)} per plan-to-ticket-agent.md, then rerun start-plan.`,
    });
    return;
  }

  const legacyPlan = selectLegacyPlan();
  if (legacyPlan) {
    emit({
      status: "ok",
      source: "legacy-plan",
      plan: legacyPlan,
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Convert unticketed candidates from legacy plan ${legacyPlan}.`,
    });
    return;
  }

  emit({
    status: "idle",
    reason: "no_actionable_plan_input",
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    worker_role: workerRole(),
  });
}

function emit(fields: Record<string, string | number | undefined>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === "") continue;
    process.stdout.write(`${key}=${value}\n`);
  }
}

function ensureExpectedRole(expected: string): void {
  const role = process.env.AUTOFLOW_ROLE || process.env.ROLE || "";
  if (!role) return;
  if (expected === "plan" && ["plan", "planner"].includes(role)) return;
  if (role === expected) return;
  process.stderr.write(`start-plan.ts: expected role ${expected}, got ${role}\n`);
  process.exit(1);
}

function workerRole(): string {
  return process.env.AUTOFLOW_TICKET_WORKER_ROLE || process.env.AUTOFLOW_WORKER_ROLE || "ticket-owner";
}

function setThreadContextRecord(role: string, owner: string, ticket: string, worktree: string, branch: string): void {
  const stateDir = path.join(BOARD_ROOT, "automations", "state");
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, `${role}.context`),
      `role=${role}\nowner=${owner}\nticket=${ticket}\nworktree=${worktree}\nbranch=${branch}\nupdated_at=${utils.nowIso()}\n`,
      "utf8"
    );
  } catch {}
}

function displayWorkerId(raw: string): string {
  if (/^(planner|plan)-/.test(raw)) return "planner";
  if (raw === "planner" || raw === "plan") return "planner";
  return raw || "planner";
}

function normalizeId(raw: string): string {
  const digits = raw.replace(/^.*_/, "").replace(/\.md$/i, "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Number.parseInt(digits, 10)).padStart(3, "0");
}

function extractNumericId(file: string): string {
  return normalizeId(path.basename(file));
}

function boardRelativePath(file: string): string {
  return utils.boardRelativePath(file, BOARD_ROOT);
}

function listMatchingFiles(dir: string, patterns: RegExp[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => patterns.some((re) => re.test(name)))
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile())
    .sort((a, b) => {
      const rank = priorityRank(a) - priorityRank(b);
      if (rank !== 0) return rank;
      const id = Number.parseInt(extractNumericId(a) || "999999", 10) - Number.parseInt(extractNumericId(b) || "999999", 10);
      if (id !== 0) return id;
      return a.localeCompare(b);
    });
}

function priorityRank(file: string): number {
  const text = utils.readFileSafe(file);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  const candidates: string[] = [];
  if (frontmatter) {
    const m = frontmatter[1].match(/^\s*priority\s*:\s*(.+)$/im);
    if (m) candidates.push(m[1]);
  }
  const bodyPriority = text.match(/^\s*(?:-\s*)?[Pp]riority\s*:\s*(.+)$/m);
  if (bodyPriority) candidates.push(bodyPriority[1]);
  const title = text.match(/^\s*(?:-\s*)?Title\s*:\s*(.+)$/m) || text.match(/^#\s+(.+)$/m);
  if (title) {
    if (/\[critical\]|\[CRITICAL\]|🚨/.test(title[1])) return 0;
    if (/\[high\]|\[HIGH\]|⚠/.test(title[1])) return 1;
  }
  for (const value of candidates) {
    const rank = priorityValueToRank(value);
    if (rank !== null) return rank;
  }
  return 2;
}

function priorityValueToRank(value: string): number | null {
  const clean = utils
    .trimSpaces(value.toLowerCase().replace(/#.*/, "").replace(/[`"'\[\]:]/g, ""));
  if (["critical", "crit", "p0"].includes(clean)) return 0;
  if (["high", "p1"].includes(clean)) return 1;
  if (["normal", "medium", "default", "p2"].includes(clean)) return 2;
  if (["low", "p3"].includes(clean)) return 3;
  return null;
}

function isPlaceholderSpec(file: string): boolean {
  const text = utils.readFileSafe(file);
  return text.includes("<!-- AUTOFLOW_STARTER_SPEC_PLACEHOLDER -->") || text.includes("Replace with your project name");
}

function isPlaceholderPlan(file: string): boolean {
  const text = utils.readFileSafe(file);
  return (
    text.includes("<!-- AUTOFLOW_STARTER_PLAN_PLACEHOLDER -->") ||
    text.includes("첫 구현 티켓 후보를 관찰 가능한 문장으로 적기") ||
    text.includes("- Title: Initial project bootstrap")
  );
}

function orderRefIsAlreadyPromoted(orderRef: string): boolean {
  const roots = [
    path.join(BOARD_ROOT, "tickets", "backlog"),
    path.join(BOARD_ROOT, "tickets", "done"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const files = collectFiles(root, /^(prd|project)_\d+\.md$/);
    for (const file of files) {
      const text = utils.readFileSafe(file);
      if (text.includes(`Source: \`${orderRef}\``) || text.includes(`Source: ${orderRef}`)) return true;
    }
  }
  return false;
}

function orderFileIsActionable(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  if (orderRefIsAlreadyPromoted(boardRelativePath(file))) return false;
  const status = utils.trimSpaces(utils.extractScalarFieldInSection(file, "Order", "Status"));
  return ["", "inbox", "ready", "pending", "needs-info"].includes(status);
}

function orderFileIsRetry(file: string): boolean {
  return /^order_.*_retry_.*\.md$/.test(path.basename(file));
}

function selectInboxRetryOrder(): string {
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "inbox"), [/^order_.*_retry_.*\.md$/])) {
    if (orderFileIsRetry(file) && orderFileIsActionable(file)) return file;
  }
  return "";
}

function selectInboxNonretryOrder(): string {
  if (requestedNormalized) {
    const file = path.join(BOARD_ROOT, "tickets", "inbox", `order_${requestedNormalized}.md`);
    return orderFileIsActionable(file) && !orderFileIsRetry(file) ? file : "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "inbox"), [/^order_.*\.md$/])) {
    if (!orderFileIsRetry(file) && orderFileIsActionable(file)) return file;
  }
  return "";
}

function selectPopulatedSpec(): string {
  if (requestedNormalized) {
    for (const name of [`prd_${requestedNormalized}.md`, `project_${requestedNormalized}.md`]) {
      const file = path.join(BOARD_ROOT, "tickets", "backlog", name);
      if (fs.existsSync(file) && !isPlaceholderSpec(file)) return file;
    }
    return "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "backlog"), [/^prd_.*\.md$/, /^project_.*\.md$/])) {
    if (!isPlaceholderSpec(file) && extractNumericId(file)) return file;
  }
  return "";
}

function selectOrderGeneratedSpec(): string {
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "backlog"), [/^prd_.*\.md$/, /^project_.*\.md$/])) {
    if (isPlaceholderSpec(file)) continue;
    if (/^tickets\/inbox\/order_.*\.md$/.test(extractSpecSourceOrderRef(file))) return file;
  }
  return "";
}

function extractSpecSourceOrderRef(file: string): string {
  return extractSectionLines(file, "Conversation Handoff")
    .map((line) => {
      const m = line.match(/^\s*-\s*Source:\s*(.+)$/);
      return m ? m[1].replace(/`/g, "").trim() : "";
    })
    .find(Boolean) ?? "";
}

function orderIsExpressEligible(file: string): boolean {
  const express = utils.trimSpaces(utils.extractScalarFieldInSection(file, "Order", "Express")).toLowerCase();
  if (!["true", "yes", "1", "on"].includes(express)) return false;
  return extractBulletSection(file, "Allowed Paths").length > 0 && extractChecklist(file, "Done When").length > 0;
}

function selectExpressInboxOrder(): string {
  if (requestedNormalized) {
    const file = path.join(BOARD_ROOT, "tickets", "inbox", `order_${requestedNormalized}.md`);
    return orderFileIsActionable(file) && orderIsExpressEligible(file) ? file : "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "inbox"), [/^order_.*\.md$/])) {
    if (orderFileIsActionable(file) && orderIsExpressEligible(file)) return file;
  }
  return "";
}

function createExpressTodoFromOrder(orderFile: string): string {
  const orderId = extractNumericId(orderFile);
  if (!orderId) return "";
  const projectKey = `express_${orderId}`;
  const ticketId = nextTicketId();
  const ticketFile = ticketPath("todo", ticketId);
  const timestamp = utils.nowIso();
  const title = utils.trimSpaces(utils.extractScalarFieldInSection(orderFile, "Order", "Title")) || `Express order ${orderId}`;
  const priority = normalizePriority(utils.extractScalarFieldInSection(orderFile, "Order", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(orderFile, "Order", "Change Type"));
  const allowedPaths = extractBulletSection(orderFile, "Allowed Paths").map((p) => `- ${p}`).join("\n");
  const doneWhen = extractChecklist(orderFile, "Done When").join("\n");
  const verificationCommand = utils.extractScalarFieldInSection(orderFile, "Verification", "Command");
  const requestBody = extractSectionText(orderFile, "Request");
  const notesBody = extractSectionText(orderFile, "Notes").trim();
  const goal = requestBody.split(/\r?\n/).find((line) => line.trim())?.trim() || `Express 처리 대상: ${title}`;
  const orderBasename = path.basename(orderFile);

  fs.mkdirSync(path.dirname(ticketFile), { recursive: true });
  fs.writeFileSync(
    ticketFile,
    `# Ticket

## Ticket

- ID: Todo-${ticketId}
- PRD Key: ${projectKey}
- Plan Candidate: Express promotion from tickets/inbox/${orderBasename}
- Title: ${title}
- Priority: ${priority}
- Change Type: ${changeType}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${goal}

## References

- PRD: (express; no PRD authored)
- Order: tickets/done/${projectKey}/${orderBasename}
- Plan Source: express-skip-prd

## Reference Notes

- Project Note: [[${projectKey}]]
- Plan Note:
- Ticket Note: [[Todo-${ticketId}]]

## Allowed Paths

${allowedPaths}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

${doneWhen}

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 가 이 express 티켓을 todo 에서 claim 한 뒤, Allowed Paths 안에서 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다. PRD 단계는 의도적으로 생략됐다.

## Resume Context

- 현재 상태 요약: Express order ${orderId} 가 PRD 없이 todo 로 직접 승격된 직후.
- 직전 작업: scripts/start-plan.sh 의 express 분기가 order 파일을 읽어 todo 를 생성했다.
- 재개 시 먼저 볼 것: Order, Goal, Allowed Paths, Done When.

## Notes

- Created by ${displayId} (Plan AI, express path) from tickets/inbox/${orderBasename} at ${timestamp}.
- Express promotion: order_${orderId} 의 Allowed Paths 와 Done When 이 모두 명시돼 있어 PRD 단계를 생략했다.${notesBody ? `\n\n### Order Notes\n\n${notesBody}` : ""}

### Original Request

${requestBody}

## Verification

- Command: ${verificationCommand}
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
`,
    "utf8"
  );

  archiveFile(orderFile, path.join(BOARD_ROOT, "tickets", "done", projectKey, orderBasename));
  return ticketFile;
}

function promoteSpecToTodoOrExit(specFile: string): never {
  const missingSecrets = missingRequiredSecrets(specFile);
  if (missingSecrets.length > 0) {
    utils.replaceScalarFieldInSection(specFile, "Project", "Status", "needs_user_secret");
    utils.appendNote(specFile, `Planner secret preflight: missing_secrets=${missingSecrets.join(",")}; source=${boardRelativePath(specFile)}; status=needs_user_secret`);
    emit({
      status: "ok",
      source: "needs-user-secret",
      spec: specFile,
      missing_secrets: missingSecrets.join(","),
      failure_class: "needs_user_decision",
      recovery_state: "needs_user",
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Set ${missingSecrets.join(",")}, then rerun planner to promote ${boardRelativePath(specFile)}.`,
    });
    process.exit(0);
  }

  const lint = runLintTicket(specFile);
  if (lint.blocked) {
    emit({
      status: "ok",
      source: "vague-done-when",
      spec: specFile,
      lint_status: lint.status || "block",
      lint_vagueness_score: lint.score || "unknown",
      lint_vague_terms: lint.terms || "",
      failure_class: "vague_completion_promise",
      recovery_state: "needs_user",
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `PRD ${boardRelativePath(specFile)} has a vague Completion Promise (lint_status=${lint.status || "block"}, vagueness_score=${lint.score || "unknown"}). spec-author-agent must rework Done When / Global Acceptance Criteria with concrete signals (commands, file paths, exit codes, numeric metrics) before promoting to todo. Override only after review with AUTOFLOW_LINT_TICKET=off.`,
    });
    process.exit(0);
  }

  const ticket = createTodoTicketFromSpec(specFile);
  if (lint.status) {
    utils.replaceScalarFieldInSection(ticket, "Goal Runtime", "Last Lint Status", lint.status);
    utils.replaceScalarFieldInSection(ticket, "Goal Runtime", "Last Lint Vagueness Score", lint.score || "0");
  }
  emit({
    status: "ok",
    source: "backlog-to-todo",
    spec: specFile,
    todo_ticket: ticket,
    lint_status: lint.status,
    lint_vagueness_score: lint.score,
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    next_action: `Todo ${path.basename(ticket)} created from ${boardRelativePath(specFile)}; hand off to ticket owner.`,
  });
  process.exit(0);
}

function createTodoTicketFromSpec(specFile: string): string {
  const specRef = boardRelativePath(specFile);
  const projectKey = projectKeyFromSpecRef(specRef);
  if (projectKeyHasTicket(projectKey)) {
    emit({
      status: "blocked",
      reason: "project_already_has_ticket",
      project_key: projectKey,
      spec: specFile,
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
    });
    process.exit(0);
  }

  const archivedSpecRef = archiveSpecToDoneIfNeeded(specRef);
  const archivedSpecFile = path.join(BOARD_ROOT, archivedSpecRef);
  archiveSourceOrderForSpec(projectKey, archivedSpecFile);
  const ticketId = nextTicketId();
  const ticketFile = ticketPath("todo", ticketId);
  const timestamp = utils.nowIso();
  const title = utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Name") || utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Title") || `AI work for ${projectKey}`;
  const goal = utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Goal") || `Implement the approved spec for ${projectKey}.`;
  const priority = normalizePriority(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Change Type"));
  const verificationCommand = utils.extractScalarFieldInSection(archivedSpecFile, "Verification", "Command");
  const allowedPaths = extractBulletSection(archivedSpecFile, "Allowed Paths").map((p) => `- ${p}`).join("\n") || "- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims.";
  const doneWhen = extractChecklist(archivedSpecFile, "Global Acceptance Criteria").join("\n") || "- [ ] Implementation stays inside Allowed Paths\n- [ ] Verification evidence is recorded before done/reject";

  fs.mkdirSync(path.dirname(ticketFile), { recursive: true });
  fs.writeFileSync(
    ticketFile,
    `# Ticket

## Ticket

- ID: Todo-${ticketId}
- PRD Key: ${projectKey}
- Plan Candidate: Plan AI handoff from ${archivedSpecRef}
- Title: ${title}
- Priority: ${priority}
- Change Type: ${changeType}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${goal}

## References

- PRD: ${archivedSpecRef}
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[${projectKey}]]
- Plan Note:
- Ticket Note: [[Todo-${ticketId}]]

## Allowed Paths

${allowedPaths}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

${doneWhen}

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by ${displayId} (Plan AI) from ${archivedSpecRef} at ${timestamp}.

## Verification

- Command: ${verificationCommand}
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
`,
    "utf8"
  );
  return ticketFile;
}

function choosePolicyPick(orderFile: string, specFile: string): "order" | "spec" | "" {
  if (!orderFile && !specFile) return "";
  if (!orderFile) return "spec";
  if (!specFile) return "order";
  const orderRank = priorityRank(orderFile);
  const specRank = priorityRank(specFile);
  if (orderRank < specRank) return "order";
  if (specRank < orderRank) return "spec";
  return backlogFirstStuckCheckAndBump(specFile) ? "order" : "spec";
}

function backlogFirstStatePath(): string {
  return path.join(BOARD_ROOT, "runners", "state", "backlog-first-stuck.json");
}

function backlogFirstStuckCheckAndBump(specFile: string): boolean {
  const limitRaw = Number.parseInt(process.env.AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT || "3", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 3;
  const stateFile = backlogFirstStatePath();
  const key = path.basename(specFile);
  let state: Record<string, number> = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {}
  const count = (Number(state[key]) || 0) + 1;
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  if (count >= limit) {
    delete state[key];
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return true;
  }
  state[key] = count;
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return false;
}

function selectLegacyPlan(): string {
  const roots = [path.join(BOARD_ROOT, "tickets", "plan"), path.join(BOARD_ROOT, "rules", "plan")];
  const root = roots.find((p) => fs.existsSync(p)) || roots[0];
  for (const file of listMatchingFiles(root, [/^plan_\d\d\d\.md$/])) {
    if (!isPlaceholderPlan(file)) return file;
  }
  return "";
}

function extractSectionLines(file: string, heading: string): string[] {
  return extractSectionText(file, heading).split(/\r?\n/);
}

function extractSectionText(file: string, heading: string): string {
  const text = utils.readFileSafe(file);
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (line === `## ${heading}`) {
      inSection = true;
      continue;
    }
    if (inSection && /^## /.test(line)) break;
    if (inSection) out.push(line);
  }
  return out.join("\n").trimEnd();
}

function extractBulletSection(file: string, heading: string): string[] {
  return extractSectionLines(file, heading)
    .map((line) => {
      const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
      return m ? m[1].replace(/`/g, "").trim() : "";
    })
    .filter((value) => value && value !== "...");
}

function extractChecklist(file: string, heading: string): string[] {
  return extractSectionLines(file, heading).filter((line) => /^\s*-\s*\[[ xX]\]/.test(line));
}

function normalizePriority(value: string): string {
  const rank = priorityValueToRank(value);
  if (rank === 0) return "critical";
  if (rank === 1) return "high";
  if (rank === 3) return "low";
  return "normal";
}

function normalizeChangeType(value: string): string {
  const clean = utils.trimSpaces(value).toLowerCase();
  if (["docs", "cleanup", "infra"].includes(clean)) return clean;
  return "code";
}

function ticketPath(state: string, id: string): string {
  return path.join(BOARD_ROOT, "tickets", state, `Todo-${id}.md`);
}

function nextTicketId(): string {
  let max = 0;
  for (const file of collectFiles(path.join(BOARD_ROOT, "tickets"), /^(Todo-\d\d\d|tickets_\d\d\d|reject_\d\d\d)\.md$/)) {
    const id = Number.parseInt(extractNumericId(file) || "0", 10);
    if (id > max) max = id;
  }
  return String(max + 1).padStart(3, "0");
}

function collectFiles(root: string, basenameRe: RegExp): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) stack.push(file);
      else if (basenameRe.test(name)) out.push(file);
    }
  }
  return out.sort();
}

function projectKeyFromSpecRef(specRef: string): string {
  return path.basename(specRef).replace(/\.md$/i, "") || "unlinked-project";
}

function projectKeyHasTicket(projectKey: string): boolean {
  for (const file of collectFiles(path.join(BOARD_ROOT, "tickets"), /^(Todo-\d\d\d|tickets_\d\d\d|reject_\d\d\d)\.md$/)) {
    const current = utils.ticketScalarField(file, "PRD Key") || projectKeyFromSpecRef(utils.extractScalarFieldInSection(file, "References", "PRD"));
    if (utils.trimSpaces(current) === projectKey) return true;
  }
  return false;
}

function doneSpecPathForSpecRef(specRef: string): string {
  return path.join(BOARD_ROOT, "tickets", "done", projectKeyFromSpecRef(specRef), path.basename(specRef));
}

function archiveSpecToDoneIfNeeded(specRef: string): string {
  const normalized = specRef.replace(/`/g, "");
  if (normalized.startsWith("tickets/done/")) return normalized;
  const source = path.join(BOARD_ROOT, normalized);
  const target = doneSpecPathForSpecRef(normalized);
  const targetRef = boardRelativePath(target);
  if (fs.existsSync(target)) {
    if (fs.existsSync(source) && filesEqual(source, target)) fs.rmSync(source);
    return targetRef;
  }
  if (fs.existsSync(source)) archiveFile(source, target);
  return targetRef;
}

function archiveSourceOrderForSpec(projectKey: string, specFile: string): void {
  const orderRef = extractSpecSourceOrderRef(specFile);
  if (!/^tickets\/inbox\/order_.*\.md$/.test(orderRef)) return;
  const source = path.join(BOARD_ROOT, orderRef);
  if (!fs.existsSync(source)) return;
  archiveFile(source, path.join(BOARD_ROOT, "tickets", "done", projectKey, path.basename(source)));
}

function archiveFile(source: string, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.rmSync(target);
  fs.renameSync(source, target);
}

function filesEqual(a: string, b: string): boolean {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

function runLintTicket(specFile: string): { blocked: boolean; status: string; score: string; terms: string } {
  if (["off", "false", "0", "no"].includes((process.env.AUTOFLOW_LINT_TICKET || "on").toLowerCase())) {
    return { blocked: false, status: "", score: "", terms: "" };
  }
  const lintScript = path.join(SCRIPT_DIR, "lint-ticket.js");
  if (!fs.existsSync(lintScript)) return { blocked: false, status: "", score: "", terms: "" };
  const result = spawnSync(lintScript, [specFile], { cwd: PROJECT_ROOT, encoding: "utf8" });
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
  const status = keyValue(raw, "lint_status");
  const score = keyValue(raw, "vagueness_score");
  const terms = keyValue(raw, "vague_terms");
  return { blocked: (result.status || 0) !== 0 || status === "block", status, score, terms };
}

function keyValue(raw: string, key: string): string {
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : "";
}

function missingRequiredSecrets(specFile: string): string[] {
  const text = utils.readFileSafe(specFile);
  const required = new Set<string>();
  const requiresLine = text.match(/^- Requires Secrets:\s*\[(.*?)\]\s*$/m);
  if (requiresLine) {
    for (const part of requiresLine[1].split(",")) {
      const name = part.replace(/[`"']/g, "").trim();
      if (/^[A-Z_][A-Z0-9_]*$/.test(name)) required.add(name);
    }
  }
  const command = utils.extractScalarFieldInSection(specFile, "Verification", "Command");
  for (const match of command.matchAll(/\$[{]?([A-Z_][A-Z0-9_]*)[}]?/g)) required.add(match[1]);
  return [...required].filter((name) => !process.env[name]);
}

main();
