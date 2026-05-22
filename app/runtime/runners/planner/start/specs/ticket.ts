import {fs, path, BOARD_ROOT, PROJECT_ROOT, displayId, utils} from "../context";
import {ensureTicketWorktree} from "../../../../shared/runner-tool/worktree";
import {emit} from "../output";
import {boardRelativePath, projectKeyFromSpecRef, ticketPath} from "../ids";
import {nextTicketId} from "../files";
import {SplitMapEntry, extractBulletSection, extractChecklist, extractSectionText, extractSplitMap} from "../sections";
import {normalizeChangeType, normalizePriority} from "../priority";
import {archiveSpecToDoneIfNeeded} from "./archive";
import {missingRequiredSecrets, runLintTicket} from "./preflight";

type TodoSlice = {
  title: string;
  goal: string;
  priority: string;
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
  // PRD heading is the most descriptive signal — "PRD 007: Vue page and router
  // modules" carries the actual scope. Project Name (e.g. "Promokit") is the
  // umbrella label and is the worst tiebreaker for a ticket title, so it goes
  // last. Project Title sits between when the spec author bothered to set it.
  return (
    cleanHeadingTitle(firstHeading(file), projectKey) ||
    utils.extractScalarFieldInSection(file, "Project", "Title") ||
    utils.extractScalarFieldInSection(file, "Project", "Name") ||
    `AI work for ${projectKey}`
  );
}

function specGoal(file: string, projectKey: string): string {
  return (
    utils.extractScalarFieldInSection(file, "Project", "Goal") ||
    utils.extractScalarFieldInSection(file, "Core Scope", "Goal") ||
    compactSection(file, "Goal") ||
    `${projectKey}의 승인된 spec을 구현한다.`
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
  return specDoneWhenLines(file).join("\n") || "- [ ] 구현이 Allowed Paths 안에서만 이루어진다.\n- [ ] done/revise 전에 검증 근거가 기록된다.";
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
    `- [ ] \`${pathText}\` 안의 변경이 "${goal}" 결과를 반영한다.`,
    `- [ ] 검증 명령 \`${verificationCommand || "none-shell"}\` 가 exit 0으로 끝나거나, 명령이 \`none-shell\` 이면 파일 검토 근거가 기록된다.`,
    `- [ ] 최종 diff가 \`${pathText}\` 밖의 파일을 포함하지 않는다.`,
  ].join("\n");
}

function inheritedTodoPriorityFromSpec(file: string): string {
  const priority = normalizePriority(utils.extractScalarFieldInSection(file, "Project", "Priority"));
  return priority === "critical" ? "critical" : "normal";
}

function todoSlicesFromSpec(file: string, projectKey: string): TodoSlice[] {
  const baseTitle = specTitle(file, projectKey);
  const baseGoal = specGoal(file, projectKey);
  const inheritedPriority = inheritedTodoPriorityFromSpec(file);
  const baseVerificationCommand = specVerificationCommand(file);
  const concreteAllowedPaths = extractBulletSection(file, "Allowed Paths").filter((p) => utils.allowedPathIsConcreteRepoPath(p));
  const entries = extractSplitMap(file, ["Todo Split Map", "Todo Splits", "Implementation Slices", "Ticket Split Map"]);

  if (entries.length === 0) {
    return [{
      title: baseTitle,
      goal: baseGoal,
      priority: inheritedPriority,
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
    const priority = firstSplitValue(entry, "priority");
    const sliceAllowedPaths = splitListValues(entry.fields.allowed_paths || []).filter((p) => utils.allowedPathIsConcreteRepoPath(p));
    const allowedPaths = sliceAllowedPaths.length > 0 ? sliceAllowedPaths : concreteAllowedPaths;
    const verificationCommand = firstSplitValue(entry, "verification").replace(/^Command:\s*/i, "") || baseVerificationCommand;
    const doneWhenLines = splitChecklistValues(entry.fields.done_when || []);
    return {
      title: `${baseTitle} - ${entryTitle}`,
      goal,
      priority: priority ? normalizePriority(priority) : inheritedPriority,
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
      blocker_state: "needs_user",
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
	      next_action: `${boardRelativePath(specFile)}의 Allowed Paths를 구체적인 repo-relative path로 좁힌 뒤 플래너 러너를 다시 실행한다.`,
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
      blocker_state: "needs_user",
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
	      next_action: `${missingSecrets.join(",")} 값을 설정한 뒤 플래너 러너를 다시 실행해 ${boardRelativePath(specFile)}를 승격한다.`,
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
      blocker_state: "needs_user",
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
	      next_action: `PRD ${boardRelativePath(specFile)}의 완료 약속이 모호하다(lint_status=${lint.status || "block"}, vagueness_score=${lint.score || "unknown"}). todo로 승격하기 전에 spec-author-agent가 Done When / Global Acceptance Criteria를 명령, 파일 경로, exit code, 수치 지표 같은 구체적 신호로 다시 작성해야 한다. 검토 후에만 AUTOFLOW_LINT_TICKET=off로 우회한다.`,
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
	    next_action: `${boardRelativePath(specFile)}에서 todo ticket ${tickets.length}개를 생성했다. 워커 러너에게 넘긴다.`,
  });
  process.exit(0);
}

export function createTodoTicketsFromSpec(specFile: string): string[] {
  const specRef = boardRelativePath(specFile);
  const projectKey = projectKeyFromSpecRef(specRef);
  // Compute slices BEFORE archiving the PRD so we never leave a PRD in done/
  // without a sibling Todo. todoSlicesFromSpec always returns at least one
  // slice (base slice from PRD Goal + Allowed Paths when no Split Map),
  // so this guarantees ≥1 Todo per archived PRD.
  const preflightSlices = todoSlicesFromSpec(specFile, projectKey);
  if (preflightSlices.length === 0) {
    throw new Error(`PRD ${specRef} produced 0 todo slices; refuse to archive without at least one Todo.`);
  }
  const archivedSpecRef = archiveSpecToDoneIfNeeded(specRef);
  const archivedSpecFile = path.join(BOARD_ROOT, archivedSpecRef);
  const slices = todoSlicesFromSpec(archivedSpecFile, projectKey);
  const effectiveSlices = slices.length > 0 ? slices : preflightSlices;
  return effectiveSlices.map((slice) => writeTodoTicketFromSlice(archivedSpecRef, archivedSpecFile, projectKey, slice));
}

export function createTodoTicketFromSpec(specFile: string): string {
  return createTodoTicketsFromSpec(specFile)[0] || "";
}

function writeTodoTicketFromSlice(archivedSpecRef: string, archivedSpecFile: string, projectKey: string, slice: TodoSlice): string {
  const ticketId = nextTicketId();
  const ticketFile = ticketPath("todo", ticketId);
  const timestamp = utils.nowIso();
  const priority = slice.priority || inheritedTodoPriorityFromSpec(archivedSpecFile);
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(archivedSpecFile, "Project", "Change Type"));
  const allowedPaths = slice.allowedPaths.map((p) => `- ${p}`).join("\n");
  const sliceRef = slice.count > 1 ? `${archivedSpecRef}#todo-${String(slice.index).padStart(2, "0")}` : archivedSpecRef;

  fs.mkdirSync(path.dirname(ticketFile), { recursive: true });
  fs.writeFileSync(
    ticketFile,
    `# Ticket

## Ticket

- ID: TODO-${ticketId}
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
- Ticket Note: [[TODO-${ticketId}]]

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

## Done When

${slice.doneWhen}

## Next Action

	- 다음 즉시 작업: 워커 러너가 이 todo ticket을 claim하고, mini-plan을 작성한 뒤 Allowed Paths 안에서 구현하고, 검증 근거를 기록한 다음 검증 러너 handoff로 진행한다.

## Resume Context

	- 현재 상태: 플래너 러너가 PRD queue에서 이 todo ticket을 방금 생성했다.
	- 마지막 완료 작업: \`autoflow run planner\` 가 PRD를 archive하고 이 todo ticket을 만들었다.
	- 재개 시 먼저 확인할 것: PRD, Goal, Allowed Paths, Done When.

## Notes

	- ${displayId} (플래너 러너)가 ${timestamp}에 ${archivedSpecRef}에서 생성했다.
- PRD slice: ${slice.index}/${slice.count}.
	${slice.notes.length > 0 ? slice.notes.map((item) => `- slice 메모: ${item}`).join("\n") : ""}

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

  // Provision branch + worktree, and commit the ticket markdown into the
  // worktree so the PRD-track squash captures both planner output and worker
  // implementation in one branch.
  try {
    const ticketContent = fs.readFileSync(ticketFile, "utf8");
    const wt = ensureTicketWorktree({
      id: ticketId,
      kind: "todo",
      content: ticketContent,
      prdKey: projectKey,
    });
    if (wt.worktreePath) {
      utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Path", `\`${wt.worktreePath}\``);
      utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Branch", wt.branch);
      utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Base Commit", wt.baseCommit);
      utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Worktree Commit", "");
      utils.replaceScalarFieldInSection(ticketFile, "Worktree", "Integration Status", "ready");
    }
  } catch {
    // Best-effort: ticket file is already on disk; worktree provisioning failure
    // does not block planner output. Worker still creates worktree on claim.
  }

  return ticketFile;
}
