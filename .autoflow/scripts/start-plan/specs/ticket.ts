import {fs, path, BOARD_ROOT, PROJECT_ROOT, displayId, utils} from "../context";
import {emit} from "../output";
import {boardRelativePath, projectKeyFromSpecRef, ticketPath} from "../ids";
import {nextTicketId} from "../files";
import {extractBulletSection, extractChecklist} from "../sections";
import {normalizeChangeType, normalizePriority} from "../priority";
import {archiveSourceOrderForSpec, archiveSpecToDoneIfNeeded, projectKeyHasTicket} from "./archive";
import {missingRequiredSecrets, runLintTicket} from "./preflight";

export function promoteSpecToTodoOrExit(specFile: string): never {
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
  const title = utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Name") || utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Title") || `AI work for ${projectKey}`;
  const goal = utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Goal") || `Implement the approved spec for ${projectKey}.`;
  const priority = normalizePriority(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Change Type"));
  const verificationCommand = utils.extractScalarFieldInSection(archivedSpecFile, "Verification", "Command");
  const allowedPaths = extractBulletSection(archivedSpecFile, "Allowed Paths").map((p) => `- ${p}`).join("\n") || "- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims.";
  const doneWhen = extractChecklist(archivedSpecFile, "Global Acceptance Criteria").join("\n") || "- [ ] Implementation stays inside Allowed Paths\n- [ ] Verification evidence is recorded before done/order-retry";

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

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 PRD 큐에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.ts 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
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
