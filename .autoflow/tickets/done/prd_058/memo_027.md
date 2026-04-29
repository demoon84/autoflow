# Autoflow Memo

## Memo

- ID: memo_027
- Title: 단일 runner 시 -1 접미사 표기 생략
- Status: inbox
- Created At: 2026-04-29T21:09:00Z
- Source: autoflow memo create

## Request

planner, worker, 위키봇이 1개씩 이라 planner-1, worker-1의 표기는 없어도 됨. -1 표기를 없애.

## Hints

### Scope

- runtime/board-scripts/common.sh 의 display_worker_id() 가 owner-N / ai-N → worker-N 으로 정규화하는데, 같은 역할의 enabled runner 가 1개뿐이면 끝의 -N 도 떼서 'planner', 'worker', '위키봇' 처럼 노출. config.toml 의 storage id (planner-1, owner-1, wiki-1) 와 runner state 파일/runtime role 키는 그대로 유지(parser 호환). desktop renderer 의 worker_id 표시도 같은 규칙을 따라야 하므로 displayWorkerId 류 helper 가 없으면 추가. 이미 wiki-1 / wiki-maintainer-1 → '위키봇' 매핑은 main.tsx 4929 에 있음.

### Allowed Paths

- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/common.sh`
- `dogfood-board/scripts/common.sh`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `packages/cli/runners-project.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: tests/smoke/runner-idle-preflight-skip-smoke.sh 등 smoke 통과, npm --prefix apps/desktop run check, 그리고 desktop dev 모드에서 runner 카드/티켓/Notes/log 의 worker 표기가 -1 없이 'planner', 'worker', '위키봇' 으로 보이는지 수동 확인. 같은 역할 runner 가 2개 이상으로 늘어나면 다시 -1, -2 가 보여야 함도 확인.

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
