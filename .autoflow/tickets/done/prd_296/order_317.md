# Autoflow Order

## Order

- ID: order_317
- Title: sh to ts 전환 2단계 보조 스크립트 실제 이관
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:44:58Z
- Source: autoflow order create

## Request

1단계 active-runtime 동기화 이후, 이미 TypeScript 구현이 존재하거나 독립성이 높은 보조 스크립트부터 .sh 본체 로직을 .ts 중심으로 실제 이관한다.

대상 후보는 board-guard, lint-ticket, path-conflict-check, state-db, integrate-worktree 계열이다. 단순 wrapper 추가가 아니라, 기존 bash 본체가 남아 있는 경우 TS 구현을 canonical로 삼고 shell은 호환 진입점만 남기거나 제거 가능한 상태로 축소한다.

공통 파서/보드 유틸은 board-utils.ts를 우선 사용하고, 새로 중복 parser를 만들지 않는다.

## Hints

### Scope

- sh-to-ts 2단계: 독립 보조 runtime 스크립트의 실제 TypeScript 이관

### Allowed Paths

- `.autoflow/scripts/board-guard.sh`
- `.autoflow/scripts/board-guard.ts`
- `.autoflow/scripts/lint-ticket.sh`
- `.autoflow/scripts/lint-ticket.ts`
- `.autoflow/scripts/path-conflict-check.sh`
- `.autoflow/scripts/path-conflict-check.ts`
- `.autoflow/scripts/state-db.sh`
- `.autoflow/scripts/state-db.ts`
- `.autoflow/scripts/integrate-worktree.sh`
- `.autoflow/scripts/integrate-worktree.ts`
- `.autoflow/scripts/board-utils.ts`
- `runtime/board-scripts`
- `tests/smoke`

### Verification

- Command: find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \; && ./bin/autoflow guard . .autoflow

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
