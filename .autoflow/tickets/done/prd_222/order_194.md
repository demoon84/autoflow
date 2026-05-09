# Autoflow Order

## Order

- ID: order_194
- Title: 데스크톱 ticket dialog 의 deprecated reject/ + legacy naming 보정
- Status: inbox
- Priority: high
- Created At: 2026-05-09T06:42:43Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 데스크톱 ticket dialog 의 deprecated reject/ + 레거시 tickets_NNN naming 보정
- Priority: high
- Status: ready


데스크톱에서 현재 처리 중인 Todo (예: Todo-214) 본문을 열려고 하면 "ENOENT: no such file or directory, stat '/.../tickets/reject/tickets_214.md'" 에러로 못 찾음.

## Notes

- 사용자가 가리킨 화면: 러너 카드 → ticket dialog 가 active ticket 본문 fetch 실패. 화면에 빨간 ENOENT 메시지 노출.
- 직접 원인: `apps/desktop/src/renderer/main.tsx` line ~6841~6846 의 `openTicketDialog`:
  ```ts
  const ticketFile = `${runner.activeTicketId}.md`;
  const candidatePaths = [
    `${projectRoot}/${boardDir}/tickets/inprogress/${ticketFile}`,
    `${projectRoot}/${boardDir}/tickets/todo/${ticketFile}`,
    `${projectRoot}/${boardDir}/tickets/reject/${ticketFile}`,
  ];
  ```
  두 가지 문제:
  1. **`reject/` 폴더는 2026-05-07 refactor 에서 제거됨** (AGENTS.md rule 5a — fail 처리는 inbox 재발행 단일 흐름). 그런데 candidate 에 그대로 남음.
  2. `runner.activeTicketId` 가 legacy `tickets_214` 형식이면 `tickets_214.md` 로 lookup 하는데 실제 파일은 `Todo-214.md`. naming convention 불일치.
- 의도하는 수정 (planner / worker 가 결정):
  - `reject/` 후보 제거.
  - 같은 numeric id 에 대해 `Todo-NNN.md` 와 `tickets_NNN.md` 두 형식 모두 시도 (legacy + new). active_ticket_id 가 어느 형식이든 잘 찾도록.
  - 후보 폴더는 `inprogress/`, `todo/` 두 곳. (찾으려는 게 inprogress 거나 todo 큐 안에 있을 때만 의미 있음. done 폴더는 별도 경로 — done/<prd_key>/Todo-NNN.md — 이건 프로젝트 키 모르면 못 찾으므로 dialog 가 inprogress/todo 에 한정하는 건 합리적.)
  - 추가 가드: 두 파일 형식 모두 못 찾으면 `inbox/` 에 retry order (`order_*_retry_*.md`) 도 한 번 시도 (dirty_root 같은 reject 사이클 중일 때 본문 표시). 이건 nice-to-have.
- runner.activeTicketId 자체 normalize: state 파일 / IPC 가 `tickets_NNN` 으로 push 한다면 그것도 `Todo-NNN` 으로 변환할지 별개 작업 — 본 order 범위 밖. UI 에서만 양쪽 후보를 시도해 표시 안 깨지게.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Done When

- [ ] `openTicketDialog` candidate paths 에 `reject/` 가 없다 (`grep -n "tickets/reject" apps/desktop/src/renderer/main.tsx` 가 0 hit).
- [ ] active_ticket_id 가 numeric (예: `214`) 또는 legacy (`tickets_214`) 또는 새 (`Todo-214`) 어느 형태여도 `inprogress/Todo-NNN.md` 또는 `inprogress/tickets_NNN.md` 또는 `todo/...` 중 한 곳에서 본문을 찾는다.
- [ ] Todo-214 가 todo/ 에 있을 때 dialog 가 본문을 정상 표시 (ENOENT 에러 없음) — 시각 확인.
- [ ] `npm run desktop:check` 통과.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조: 데스크톱 dev 앱에서 todo/ 또는 inprogress/ 에 있는 Todo 카드 클릭 → 본문 dialog 정상 표시.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
