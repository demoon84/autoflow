#!/usr/bin/env node
// One-off: for every tickets/done/<prd-key>/PRD-NNN.md that has no Todo
// referencing it (anywhere on the board), create a retroactive Stage=done
// Todo so the PRD is no longer an orphan. The Todo lives at
// tickets/done/<prd-key>/Todo-NNN.md.
//
// Usage:
//   node app/scripts/backfill-orphan-prd-todos.mjs <board-root>

import fs from "node:fs";
import path from "node:path";

const boardRoot = path.resolve(process.argv[2] || path.join(process.cwd(), ".autoflow"));
const ticketsRoot = path.join(boardRoot, "tickets");
const doneRoot = path.join(ticketsRoot, "done");

if (!fs.existsSync(doneRoot)) {
  process.exit(1);
}

function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function extractTitle(content, fallback) {
  const m = content.match(/^#\s+(.+)$/m);
  if (!m) return fallback;
  return m[1].replace(/^PRD\s+\d+:\s*/i, "").replace(/^PRD\s+PRD-\d+:\s*/i, "").trim() || fallback;
}

function listExistingTicketIds() {
  const ids = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const m = entry.name.match(/^TODO-(\d+)\.md$/);
      if (m) ids.push(Number.parseInt(m[1], 10));
    }
  };
  walk(ticketsRoot);
  return ids;
}

let nextId = (Math.max(0, ...listExistingTicketIds()) || 0);
function takeNextId() {
  nextId += 1;
  return String(nextId).padStart(3, "0");
}

function todoReferencesPrdKey(file, prdKey) {
  const re = new RegExp(`^-\\s*PRD Key\\s*:\\s*${prdKey}\\b`, "im");
  return re.test(readFile(file));
}

function boardHasTodoFor(prdKey) {
  for (const bucket of ["todo", "inprogress", "verifier"]) {
    const dir = path.join(ticketsRoot, bucket);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/^TODO-\d+\.md$/.test(name)) continue;
      if (todoReferencesPrdKey(path.join(dir, name), prdKey)) return true;
    }
  }
  const doneProjectDir = path.join(doneRoot, prdKey);
  if (fs.existsSync(doneProjectDir)) {
    for (const name of fs.readdirSync(doneProjectDir)) {
      if (/^TODO-\d+\.md$/.test(name)) return true;
    }
  }
  return false;
}

function buildRetroactiveTodo(prdKey, prdTitle, prdRef, ticketId, timestamp) {
  return `# Ticket

## Ticket

- ID: TODO-${ticketId}
- PRD Key: ${prdKey}
- PRD Slice: 1/1
- Plan Candidate: retroactive backfill for archived PRD
- Title: ${prdTitle}
- Priority: normal
- Change Type: code
- Stage: done
- AI: backfill
- Claimed By: backfill
- Execution AI: backfill
- Verifier Runner: backfill
- Last Updated: ${timestamp}

## Goal

- ${prdTitle}

## References

- PRD: ${prdRef}
- Plan Source: retroactive-backfill

## Reference Notes

- Project Note: [[${prdKey}]]
- Plan Note: retroactive backfill so the PRD is not orphaned in done/.
- Ticket Note: [[TODO-${ticketId}]]

## Allowed Paths

- ${prdRef}

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: integrated

## Goal Runtime

- Status: complete
- Started At: ${timestamp}
- Started Epoch:
- Updated At: ${timestamp}
- Tick Count: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event: retroactive backfill
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Done When

- [x] PRD ${prdKey} 의 본문 자체가 산출물(연구/감사/정책/문서) 또는 별도 산출물 (research/wiki/code) 로 이미 보존되어 있다.
- [x] 본 Todo 는 PRD ↔ Todo 매핑 불일치 해소를 위한 retroactive 기록이다. 추가 구현은 필요 없다.
- [x] 향후 PRD 는 archive 전에 ≥1 Todo 를 반드시 생성하는 강제 조항이 planner runtime / item-archive / board-guard 에 적용되어 있다.

## Next Action

- 없음. 본 ticket 은 historical 기록 목적이다.

## Resume Context

- Current state: retroactive backfill 완료. PRD ${prdKey} 의 done 상태와 동기화됨.
- Last completed action: ${timestamp} backfill-orphan-prd-todos.mjs 가 본 Todo 를 생성했다.
- First thing to inspect on resume: 만약 본 PRD 에 실제 후속 구현 작업이 필요하다는 evidence 가 나타나면 새 PRD 또는 atodo 로 발행한다.

## Notes

- backfill: ${timestamp} 에 orphan PRD 정리를 위해 자동 생성.
- 원본 PRD: ${prdRef}.
- 본 ticket 은 board integrity 를 위한 사후 기록이며 어떤 product 변경도 동반하지 않는다.

## Verification

- Command: none-shell
- Run file:
- Log file:
- Result: pass (retroactive — PRD 본문 자체가 산출물 또는 외부 산출물로 보존됨)

## Result

- Summary: retroactive backfill — PRD ${prdKey} 가 더 이상 orphan 상태가 아님.
- Remaining risk: 본 PRD 의 의도가 실제로 미구현 상태이면 새 PRD 로 후속 발행 필요.
`;
}

let projectDirs = [];
try {
  projectDirs = fs.readdirSync(doneRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^(PRD)-\d+$/i.test(e.name))
    .map((e) => e.name);
} catch (error) {
  process.exit(1);
}

const timestamp = nowIso();
const created = [];
const skipped = [];

for (const projectKey of projectDirs) {
  const projectDir = path.join(doneRoot, projectKey);
  const prdFile = path.join(projectDir, `${projectKey}.md`);
  if (!fs.existsSync(prdFile)) {
    skipped.push(`${projectKey}:no_prd_file`);
    continue;
  }
  if (boardHasTodoFor(projectKey)) {
    skipped.push(`${projectKey}:has_todo`);
    continue;
  }
  const prdContent = readFile(prdFile);
  const prdTitle = extractTitle(prdContent, projectKey);
  const ticketId = takeNextId();
  const prdRef = `tickets/done/${projectKey}/${projectKey}.md`;
  const todoFile = path.join(projectDir, `TODO-${ticketId}.md`);
  if (fs.existsSync(todoFile)) {
    skipped.push(`${projectKey}:todo_conflict`);
    continue;
  }
  fs.writeFileSync(todoFile, buildRetroactiveTodo(projectKey, prdTitle, prdRef, ticketId, timestamp), "utf8");
  created.push(`${projectKey}->TODO-${ticketId}`);
}

void created;
void skipped;
