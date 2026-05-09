# Autoflow Order

## Order

- ID: order_148
- Title: worker.state.ticket_stage_blocked 자가 reset 부재 — PRD_150 follow-up
- Status: inbox
- Priority: normal
- Created At: 2026-05-03T14:24:39Z
- Source: autoflow order create

## Request


PRD_150 (blocked-dirty orchestration full inventory + auto-recover) 머지 후에도 **worker.state.last_result 가 `ticket_stage_blocked` 로 잔류**. dirty path 가 모두 cleanup 됐는데도 worker tick 마다 동일 last_result emit.

## 관찰 (T+~6시간)

cleanup commit 7건 (`8a9d01a`, `02d8d1c`, `c9fe35f`, `f0a53b2`, `eb2beb7`, `d4f7ae6` + wiki 2건) 이 sequential 으로 머지된 이후에도:
- monitor 가 매 tick 마다 `STATE_VIOLATION worker:ticket_stage_blocked` emit
- 10분+ 동안 동일 last_result
- inprogress 의 Todo-162 가 처리 진행 중인데도 last_result reset 부재

## Suggested Fix

A) **worker 자가 reset**: tick 시작 시 git status 가 clean 이고 last_result=`ticket_stage_blocked` 면 → idle 로 reset.
B) **planner orchestration cleanup commit 후 worker reset 트리거**: planner 가 cleanup commit 마무리 후 worker.state.last_result 명시적 비우기.
C) **last_result 의 stickiness 제거**: tick 시작 시 매번 빈 값으로 시작.

권장: A (worker 자가) + B (orchestration 보강).

## Allowed Paths

- packages/cli/run-role.sh (worker tick 시작부)
- packages/cli/start-plan.sh (orchestration cleanup 종료부)

## Verification

```bash
# planner cleanup 후 1 tick 안에
grep '^last_result=' .autoflow/runners/state/worker.state
# 'ticket_stage_blocked' 가 아니어야 함 (idle 또는 빈값)
```

## Notes

- order_142 (PRD_150) 의 follow-up. dirty cleanup 자체는 잘 동작, 다만 worker state 표면 정리만 빠짐.
- 1원칙 가시성: monitor / desktop UI 가 worker 를 "blocked" 으로 계속 표시 → 사용자 잘못된 인지.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`
- `packages/cli/start-plan.sh`

### Verification

- Command: grep '^last_result=' .autoflow/runners/state/worker.state

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
