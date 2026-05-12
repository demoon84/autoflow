# Autoflow Order

## Order

- ID: order_316
- Title: sh to ts 전환 1단계 active-runtime 동기화
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:43:54Z
- Source: autoflow order create

## Request

order_315 0단계 기반 정리 이후, .autoflow/scripts 와 runtime/board-scripts 의 현재 불일치 상태를 정리한다.

목표는 실제 로직 전환 전에 설치/runtime mirror의 기준을 맞추는 것이다. active 보드와 runtime scaffold에 같은 이름의 파일이 다른 구현을 갖는 경우 의도된 차이인지 확인하고, 의도되지 않은 차이는 한쪽 기준으로 동기화한다. 특히 finish-ticket-owner.sh, board-guard.sh, state-db.sh, start-ticket-owner.legacy.sh, runner-common.sh, watch-board.sh, start-todo.sh 등 diff 상태 파일을 우선 점검한다.

이 작업은 실제 대형 로직 전환을 하지 않고, 후속 전환 티켓들이 안정적으로 같은 출발점에서 시작할 수 있게 만드는 단계다.

## Hints

### Scope

- sh-to-ts 1단계: .autoflow/scripts와 runtime/board-scripts mirror 불일치 정리 및 기준 고정

### Allowed Paths

- `.autoflow/scripts`
- `runtime/board-scripts`
- `packages/cli/doctor-project.sh`
- `tests/smoke`

### Verification

- Command: find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name '*.sh' -exec bash -n {} \; && node -e 'const fs=require("fs"),crypto=require("crypto"); const names=["finish-ticket-owner.sh","board-guard.sh","state-db.sh","start-ticket-owner.legacy.sh","runner-common.sh","watch-board.sh","start-todo.sh"]; for (const name of names) { const a=`.autoflow/scripts/`, b=`runtime/board-scripts/`; if (fs.existsSync(a)&&fs.existsSync(b)) console.log(name); }'

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
