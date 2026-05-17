import {fs, path, BOARD_ROOT, PROJECT_ROOT, displayId, utils} from "../context";
import {emit} from "../output";
import {boardRelativePath, projectKeyFromSpecRef, ticketPath} from "../ids";
import {nextTicketId} from "../files";
import {extractBulletSection, extractChecklist, extractSectionText} from "../sections";
import {normalizeChangeType, normalizePriority} from "../priority";
import {archiveSourceOrderForSpec, archiveSpecToDoneIfNeeded, projectKeyHasTicket} from "./archive";
import {missingRequiredSecrets, runLintTicket} from "./preflight";

function firstHeading(file: string): string {
  return (utils.readFileSafe(file).match(/^#\s+(.+)$/m)?.[1] || "").trim();
}

function cleanHeadingTitle(heading: string, projectKey: string): string {
  return heading
    .replace(new RegExp(`^PRD\\s+${projectKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*`, "i"), "")
    .replace(/^Project\s+PRD\s*:?/i, "")
    .replace(/^PRD\s+\d+\s*:\s*/i, "")
    .trim();
}

function compactSection(file: string, heading: string): string {
  return extractSectionText(file, heading)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function specTitle(file: string, projectKey: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Project", "Name") ||
    utils.extractScalarFieldInSection(file, "Project", "Title") ||
    cleanHeadingTitle(firstHeading(file), projectKey) ||
    `AI work for ${projectKey}`
  );
}

function specGoal(file: string, projectKey: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Project", "Goal") ||
    utils.extractScalarFieldInSection(file, "Core Scope", "Goal") ||
    compactSection(file, "Goal") ||
    `Implement the approved spec for ${projectKey}.`
  );
}

function stripTicks(value: string): string {
  return value.replace(/`/g, "").trim();
}

function specVerificationCommand(file: string): string {
  const scalar = utils.extractScalarFieldInSection(file, "Verification", "Command");
  if (scalar) return stripTicks(scalar);
  return stripTicks(extractBulletSection(file, "Verification")[0] || "");
}

function checklistOrBullets(file: string, heading: string): string[] {
  const checklist = extractChecklist(file, heading);
  if (checklist.length > 0) return checklist;
  return extractBulletSection(file, heading).map((item) => `- [ ] ${item}`);
}

function specDoneWhen(file: string): string {
  return [
    ...checklistOrBullets(file, "Global Acceptance Criteria"),
    ...checklistOrBullets(file, "Done When"),
  ].join("\n") || "- [ ] Implementation stays inside Allowed Paths\n- [ ] Verification evidence is recorded before done/order-retry";
}

export function promoteSpecToTodoOrExit(specFile: string): never {
  const concreteAllowedPaths = extractBulletSection(specFile, "Allowed Paths").filter((p) => utils.allowedPathIsConcreteRepoPath(p));
  if (concreteAllowedPaths.length === 0) {
    utils.replaceScalarFieldInSection(specFile, "Project", "Status", "needs_allowed_paths");
    utils.appendNote(specFile, `Planner preflight blocked PRD-to-todo at ${utils.nowIso()}: Allowed Paths has no concrete repo-relative path.`);
    emit({
      status: "blocked",
      source: "allowed-paths-missing",
      spec: specFile,
      failure_class: "ambiguous_scope",
      recovery_state: "needs_user",
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Narrow Allowed Paths in ${boardRelativePath(specFile)} to concrete repo-relative paths, then rerun planner.`,
    });
    process.exit(0);
  }

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
    source: "prd-to-todo",
    spec: specFile,
    todo_ticket: ticket,
    lint_status: lint.status,
    lint_vagueness_score: lint.score,
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    next_action: `Todo ${path.basename(ticket)} created from ${boardRelativePath(specFile)}; hand off to worker.`,
  });
  process.exit(0);
}

export function createTodoTicketFromSpec(specFile: string): string {
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
  const title = specTitle(archivedSpecFile, projectKey);
  const goal = specGoal(archivedSpecFile, projectKey);
  const priority = normalizePriority(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Change Type"));
  const verificationCommand = specVerificationCommand(archivedSpecFile);
  const concreteAllowedPaths = extractBulletSection(archivedSpecFile, "Allowed Paths").filter((p) => utils.allowedPathIsConcreteRepoPath(p));
  const allowedPaths = concreteAllowedPaths.map((p) => `- ${p}`).join("\n");
  const doneWhen = specDoneWhen(archivedSpecFile);

  fs.mkdirSync(path.dirname(ticketFile), { recursive: true });
  fs.writeFileSync(
    ticketFile,
    `# Ticket

## Ticket

- ID: Todo-${ticketId}
- PRD Key: ${projectKey}
- Plan Candidate: planner-runner handoff from ${archivedSpecRef}
- Title: ${title}
- Priority: ${priority}
- Change Type: ${changeType}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier Runner:
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
- Worker Resume Instruction:
- Last Recovery At:

## Done When

${doneWhen}

## Next Action

- 다음에 바로 이어서 할 일: 플래너 러너가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. 워커 러너는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: 플래너 러너가 PRD 큐에서 todo 티켓을 생성한 직후.
- 직전 작업: autoflow run planner 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by ${displayId} (planner runner) from ${archivedSpecRef} at ${timestamp}.

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
