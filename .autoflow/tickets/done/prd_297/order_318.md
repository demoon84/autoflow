# Autoflow Order

## Order

- ID: order_318
- Title: sh to ts 전환 3단계 planner start-plan 실제 이관
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:44:59Z
- Source: autoflow order create

## Request

2단계 보조 스크립트 이관 이후, planner 핵심 진입점 start-plan의 실제 로직을 start-plan.ts로 이관한다.

현재 start-plan.ts는 상태 타입과 preflight를 갖고 있지만 전체 planner orchestration은 start-plan.legacy.sh에 남아 있다. 목표는 start-plan.legacy.sh 의 inbox retry/order/backlog/express promotion 로직을 TypeScript로 옮기고, .legacy.sh 의존을 제거하거나 compatibility fallback으로만 제한하는 것이다.

Planner 출력 계약(status/source/todo_ticket/reason/next_action 등)은 기존과 호환되어야 하며, priority ordering, express order, retry order, backlog-first 정책을 보존해야 한다.

## Hints

### Scope

- sh-to-ts 3단계: start-plan.legacy.sh 로직을 start-plan.ts로 실제 이관

### Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-plan.ts`
- `.autoflow/scripts/start-plan.legacy.sh`
- `.autoflow/scripts/board-utils.ts`
- `.autoflow/scripts/promote-order-to-ticket.ts`
- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.ts`
- `runtime/board-scripts/start-plan.legacy.sh`
- `tests/smoke`

### Verification

- Command: find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f -name 'start-plan*.sh' -exec bash -n {} \; && node --check .autoflow/scripts/start-plan.ts && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=planner ./.autoflow/scripts/start-plan.sh 999999

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
