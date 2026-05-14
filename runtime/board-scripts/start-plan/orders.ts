import {fs, path, BOARD_ROOT, PROJECT_ROOT, requestedNormalized, displayId, utils} from "./context";
import {emit} from "./output";
import {boardRelativePath, extractNumericId, ticketPath} from "./ids";
import {archiveFile, collectFiles, listMatchingFiles, nextTicketId} from "./files";
import {extractBulletSection, extractChecklist, extractSectionText, extractSpecSourceOrderRef} from "./sections";
import {normalizeChangeType, normalizePriority} from "./priority";

export function orderRefIsAlreadyPromoted(orderRef: string): boolean {
  const roots = [
    path.join(BOARD_ROOT, "tickets", "prd"),
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

export function orderFileIsActionable(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  if (orderRefIsAlreadyPromoted(boardRelativePath(file))) return false;
  const status = utils.trimSpaces(utils.extractScalarFieldInSection(file, "Order", "Status"));
  return ["", "order", "inbox", "ready", "pending", "needs-info"].includes(status);
}

export function orderFileIsRetry(file: string): boolean {
  return /^order_.*_retry_.*\.md$/.test(path.basename(file));
}

export function selectRetryOrder(): string {
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "order"), [/^order_.*_retry_.*\.md$/])) {
    if (orderFileIsRetry(file) && orderFileIsActionable(file)) return file;
  }
  return "";
}

export function selectNonretryOrder(): string {
  if (requestedNormalized) {
    const file = path.join(BOARD_ROOT, "tickets", "order", `order_${requestedNormalized}.md`);
    return orderFileIsActionable(file) && !orderFileIsRetry(file) ? file : "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "order"), [/^order_.*\.md$/])) {
    if (!orderFileIsRetry(file) && orderFileIsActionable(file)) return file;
  }
  return "";
}

export function orderIsExpressEligible(file: string): boolean {
  const express = utils.trimSpaces(utils.extractScalarFieldInSection(file, "Order", "Express")).toLowerCase();
  if (!["true", "yes", "1", "on"].includes(express)) return false;
  return extractBulletSection(file, "Allowed Paths").length > 0 && extractChecklist(file, "Done When").length > 0;
}

export function selectExpressOrder(): string {
  if (requestedNormalized) {
    const file = path.join(BOARD_ROOT, "tickets", "order", `order_${requestedNormalized}.md`);
    return orderFileIsActionable(file) && orderIsExpressEligible(file) ? file : "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "order"), [/^order_.*\.md$/])) {
    if (orderFileIsActionable(file) && orderIsExpressEligible(file)) return file;
  }
  return "";
}

export function createExpressTodoFromOrder(orderFile: string): string {
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
- Plan Candidate: Express promotion from tickets/order/${orderBasename}
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

- 다음에 바로 이어서 할 일: Impl AI 가 이 express 티켓을 todo 에서 claim 한 뒤, Allowed Paths 안에서 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다. PRD 단계는 의도적으로 생략됐다.

## Resume Context

- 현재 상태 요약: Express order ${orderId} 가 PRD 없이 todo 로 직접 승격된 직후.
- 직전 작업: scripts/start-plan.ts 의 express 분기가 order 파일을 읽어 todo 를 생성했다.
- 재개 시 먼저 볼 것: Order, Goal, Allowed Paths, Done When.

## Notes

- Created by ${displayId} (Plan AI, express path) from tickets/order/${orderBasename} at ${timestamp}.
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
