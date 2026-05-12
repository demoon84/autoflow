# Autoflow Order

## Order

- ID: order_313
- Title: 데스크탑 runner 카드 active ticket 중복/stale 표기 보정
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:02:16Z
- Source: autoflow order create

## Request

데스크탑 AI Autoflow runner 카드에서 여러 ticket-owner runner가 있을 때 active ticket 표기가 중복 또는 stale하게 보이는 문제를 수정한다.

실제 확인한 상태:
- 보드 기준 Todo-312는 이미 tickets/done/express_312/Todo-312.md 로 완료됨.
- 현재 실제 활성 티켓은 tickets/inprogress/Todo-313.md 하나이고, Claimed By / AI / Execution AI 는 worker-2 이다.
- worker.state 는 active_stage=idle, active_ticket_id empty 이고, worker-2.state 만 active_ticket_id=Todo-313 이다.
- 그런데 UI 스크린샷에서는 두 ticket-owner 카드가 모두 Worker 로 보이고, 완료된 Todo-312 또는 같은 Todo 배지를 함께 들고 있는 것처럼 표시됐다.

원인 후보:
- apps/desktop/src/main.js 의 enrichRunnerActiveTicketFromFs 가 PTY ticket-owner runner 각각에 대해 tickets/inprogress 의 첫 Todo-*.md 를 무조건 activeTicketId 로 붙인다. 이러면 worker / worker-2 가 동시에 존재할 때 idle worker 카드에도 같은 inprogress ticket 이 표시될 수 있다.
- apps/desktop/src/renderer/main.tsx 의 displayProgressRoleLabel 은 role=ticket-owner 를 항상 Worker 로 반환해서 worker-2 카드도 제목이 Worker 로 보인다. 여러 ticket-owner가 enabled 상태면 displayWorkflowRunnerId 기준으로 Worker / Worker-2 를 구분해서 보여야 한다.

해야 할 것:
1. PTY fallback active ticket 보강은 inprogress 첫 파일을 모든 ticket-owner에 붙이지 말고, ticket 본문의 AI / Claimed By / Execution AI 또는 runner state를 기준으로 실제 owner runner에만 붙인다.
2. state file 이 active_stage=idle 이고 active_ticket_id 가 비어 있는 runner에는 fallback이 완료/타 runner ticket 을 덮어씌우지 않도록 한다.
3. 완료되어 done/ 또는 verifier 처리 완료된 Todo-312 같은 티켓은 runner active badge 에 남지 않아야 한다.
4. 여러 ticket-owner runner가 있을 때 progress card 제목은 Worker / Worker-2 처럼 runner id를 구분해 표시한다. 단일 worker일 때 기존처럼 Worker 로 보여도 된다.
5. renderer의 active ticket 버튼 경로는 실제 activeTicketId 가 있을 때만 tickets/inprogress/<id>.md 를 열어야 한다.

## Hints

### Scope

- Desktop runner card active ticket display and multi-worker label only

### Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`

### Verification

- Command: ./bin/autoflow runners list . .autoflow; cd apps/desktop && npm run check; 데스크톱 UI에서 worker는 idle/no ticket badge, worker-2만 Todo-313 badge, 완료된 Todo-312 미표시 확인

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
