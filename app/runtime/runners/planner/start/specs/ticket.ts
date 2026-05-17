import {fs, path, BOARD_ROOT, PROJECT_ROOT, displayId, utils} from "../context";
import {emit} from "../output";
import {boardRelativePath, projectKeyFromSpecRef, ticketPath} from "../ids";
import {nextTicketId} from "../files";
import {SplitMapEntry, extractBulletSection, extractChecklist, extractSectionText, extractSplitMap} from "../sections";
import {normalizeChangeType, normalizePriority} from "../priority";
import {archiveSourceOrderForSpec, archiveSpecToDoneIfNeeded} from "./archive";
import {missingRequiredSecrets, runLintTicket} from "./preflight";

type TodoSlice = {
  title: string;
  goal: string;
  allowedPaths: string[];
  doneWhen: string;
  verificationCommand: string;
  notes: string[];
  index: number;
  count: number;
};

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

function specDoneWhenLines(file: string): string[] {
  return [
    ...checklistOrBullets(file, "Global Acceptance Criteria"),
    ...checklistOrBullets(file, "Done When"),
  ];
}

function specDoneWhen(file: string): string {
  return specDoneWhenLines(file).join("\n") || "- [ ] Implementation stays inside Allowed Paths\n- [ ] Verification evidence is recorded before done/order-retry";
}

function splitListValues(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(/[;,]/))
    .map((value) => stripTicks(value))
    .filter((value) => value && value !== "TBD" && value !== "...");
}

function splitChecklistValues(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value && value !== "TBD" && value !== "...")
    .map((value) => (/^\s*-\s*\[[ xX]\]/.test(value) ? value : `- [ ] ${value}`));
}

function firstSplitValue(entry: SplitMapEntry, key: string): string {
  return (entry.fields[key] || []).find((value) => value.trim()) || "";
}

function defaultSliceDoneWhen(goal: string, allowedPaths: string[], verificationCommand: string): string {
  const pathText = allowedPaths.join(", ") || "Allowed Paths";
  return [
    `- [ ] \`${pathText}\` 범위 변경이 "${goal}" 결과를 반영한다.`,
    `- [ ] 검증 명령 \`${verificationCommand || "none-shell"}\` 이 exit 0 으로 끝나거나, \`none-shell\` 인 경우 파일 검토 근거가 남는다.`,
    `- [ ] 최종 diff가 \`${pathText}\` 밖의 파일을 포함하지 않는다.`,
  ].join("\n");
}

function todoSlicesFromSpec(file: string, projectKey: string): TodoSlice[] {
  const baseTitle = specTitle(file, projectKey);
  const baseGoal = specGoal(file, projectKey);
  const baseVerificationCommand = specVerificationCommand(file);
  const concreteAllowedPaths = extractBulletSection(file, "Allowed Paths").filter((p) => utils.allowedPathIsConcreteRepoPath(p));
  const entries = extractSplitMap(file, ["Todo Split Map", "Todo Splits", "Implementation Slices", "Ticket Split Map"]);

  if (entries.length === 0) {
    return [{
      title: baseTitle,
      goal: baseGoal,
      allowedPaths: concreteAllowedPaths,
      doneWhen: specDoneWhen(file),
      verificationCommand: baseVerificationCommand,
      notes: [],
      index: 1,
      count: 1,
    }];
  }

  return entries.map((entry, index) => {
    const entryTitle = firstSplitValue(entry, "title") || entry.title || `Slice ${index + 1}`;
    const goal = firstSplitValue(entry, "goal") || firstSplitValue(entry, "scope") || entryTitle;
    const sliceAllowedPaths = splitListValues(entry.fields.allowed_paths || []).filter((p) => utils.allowedPathIsConcreteRepoPath(p));
    const allowedPaths = sliceAllowedPaths.length > 0 ? sliceAllowedPaths : concreteAllowedPaths;
    const verificationCommand = firstSplitValue(entry, "verification").replace(/^Command:\s*/i, "") || baseVerificationCommand;
    const doneWhenLines = splitChecklistValues(entry.fields.done_when || []);
    return {
      title: `${baseTitle} - ${entryTitle}`,
      goal,
      allowedPaths,
      doneWhen: doneWhenLines.length > 0 ? doneWhenLines.join("\n") : defaultSliceDoneWhen(goal, allowedPaths, verificationCommand),
      verificationCommand,
      notes: [...(entry.fields.notes || []), ...(entry.fields.depends_on || []).map((item) => `Depends on: ${item}`)],
      index: index + 1,
      count: entries.length,
    };
  });
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

  const tickets = createTodoTicketsFromSpec(specFile);
  if (lint.status) {
    for (const ticket of tickets) {
      utils.replaceScalarFieldInSection(ticket, "Goal Runtime", "Last Lint Status", lint.status);
      utils.replaceScalarFieldInSection(ticket, "Goal Runtime", "Last Lint Vagueness Score", lint.score || "0");
    }
  }
  emit({
    status: "ok",
    source: "prd-to-todo",
    spec: specFile,
    todo_ticket: tickets[0] || "",
    todo_tickets: tickets.map((ticket) => boardRelativePath(ticket)).join(","),
    todo_ticket_count: String(tickets.length),
    lint_status: lint.status,
    lint_vagueness_score: lint.score,
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    next_action: `${tickets.length} todo ticket(s) created from ${boardRelativePath(specFile)}; hand off to worker.`,
  });
  process.exit(0);
}

export function createTodoTicketsFromSpec(specFile: string): string[] {
  const specRef = boardRelativePath(specFile);
  const projectKey = projectKeyFromSpecRef(specRef);
  const archivedSpecRef = archiveSpecToDoneIfNeeded(specRef);
  const archivedSpecFile = path.join(BOARD_ROOT, archivedSpecRef);
  archiveSourceOrderForSpec(projectKey, archivedSpecFile);
  const slices = todoSlicesFromSpec(archivedSpecFile, projectKey);
  return slices.map((slice) => writeTodoTicketFromSlice(archivedSpecRef, archivedSpecFile, projectKey, slice));
}

export function createTodoTicketFromSpec(specFile: string): string {
  return createTodoTicketsFromSpec(specFile)[0] || "";
}

function writeTodoTicketFromSlice(archivedSpecRef: string, archivedSpecFile: string, projectKey: string, slice: TodoSlice): string {
  const ticketId = nextTicketId();
  const ticketFile = ticketPath("todo", ticketId);
  const timestamp = utils.nowIso();
  const priority = normalizePriority(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Change Type"));
  const allowedPaths = slice.allowedPaths.map((p) => `- ${p}`).join("\n");
  const sliceRef = slice.count > 1 ? `${archivedSpecRef}#todo-${String(slice.index).padStart(2, "0")}` : archivedSpecRef;

  fs.mkdirSync(path.dirname(ticketFile), { recursive: true });
  fs.writeFileSync(
    ticketFile,
    `# Ticket

## Ticket

- ID: Todo-${ticketId}
- PRD Key: ${projectKey}
- PRD Slice: ${slice.index}/${slice.count}
- Plan Candidate: planner-runner handoff from ${sliceRef}
- Title: ${slice.title}
- Priority: ${priority}
- Change Type: ${changeType}
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated: ${timestamp}

## Goal

- 이번 작업의 목표: ${slice.goal}

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

${slice.doneWhen}

## Next Action

- 다음에 바로 이어서 할 일: 플래너 러너가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. 워커 러너는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: 플래너 러너가 PRD 큐에서 todo 티켓을 생성한 직후.
- 직전 작업: autoflow run planner 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by ${displayId} (planner runner) from ${archivedSpecRef} at ${timestamp}.
- PRD slice: ${slice.index}/${slice.count}.
${slice.notes.length > 0 ? slice.notes.map((item) => `- Slice note: ${item}`).join("\n") : ""}

## Verification

- Command: ${slice.verificationCommand}
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
