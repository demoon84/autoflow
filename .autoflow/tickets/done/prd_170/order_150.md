# Autoflow Order

## Order

- ID: order_150
- Title: 🚨 needs_user/repairing ticket 이 inprogress 에서 무한 잔류 — 1원칙 자율회복 깨짐
- Status: inbox
- Priority: normal
- Created At: 2026-05-03T16:04:26Z
- Source: autoflow order create

## Request


**inprogress ticket 의 Recovery State 가 needs_user / repairing 인 채로 무한히 잔류** 해 worker 가 진보하지 못함. 1원칙 자율 회복 코드의 실제 깨짐 사례.

## 관찰 (T+~9시간, monitor 5:30분)

```
inprogress 폴더:
  Todo-157.md   Recovery: needs_user (ANTHROPIC_API_KEY) — 1시간 47분
  Todo-162.md   Recovery: needs_user (Last Updated 14:16:42Z) — 1시간 47분
  Todo-163.md   Recovery: repairing (Last Updated 14:50:51Z) — 1시간 13분

planner.active_item = Todo-157
worker.active_item = Todo-163, last_result=ticket_stage_blocked
```

지난 1시간:
- wiki update commit: **29**
- orchestration cleanup commit: **26**
- 실제 PRD/ticket 진행: **0**
- check ledger 누적: 44 → **82** (+38)

## Root Cause

A) **needs_user 인 ticket 이 inprogress 에서 분리 안 됨**:
- AGENTS.md: "needs_user 는 git 자체가 동작 불가한 mechanical 한 경우만 남긴다"
- 그러나 ticket_162 는 needs_user 인 채로 inprogress 에 1시간 47분째 잔류
- 별도 폴더 (예: `tickets/needs_user/` 또는 `tickets/parked/`) 또는 reject 로 이동하는 코드 없음
- worker 매 tick 마다 needs_user ticket 을 보고 stage_blocked emit

B) **repairing timeout 부재**:
- ticket_163 의 Recovery `repairing` 상태가 1시간 13분째 — fixpoint 도달 못함
- timeout (예: 30분) 후 escalate 필요. 현재 영원히 repairing.

C) **worker 의 stage_blocked 자가 해제 없음** (order_148):
- worker.last_result=ticket_stage_blocked 가 한번 set 되면 이후 모든 tick 이 같은 last_result 유지
- inprogress 의 needs_user / repairing 잔류와 결합되어 영구 stuck

## Suggested Fix

A) **needs_user ticket 분리**:
```
- planner tick 시작 시 inprogress/*.md 의 Recovery State 검사
- Recovery=needs_user 면 → tickets/needs_user/ 또는 tickets/reject/ 로 이동 (worker 시야에서 빼기)
- Owner Resume Instruction 보존
```

B) **repairing timeout**:
```
- Last Updated 가 30분+ 인 repairing → planner 가 needs_user 로 escalate
- 또는 retry 한도 (3회) 까지 repairing 시도 후 reject 으로 보냄
```

C) **worker 의 active_item 검증**:
```
- worker tick 시작 시 active_item 의 Recovery State 확인
- needs_user / repairing 이고 update 시각이 N분 이상 → active_item 비우고 stage_blocked 해제
- 다음 ticket 으로 넘어감
```

권장: A + B + C 모두. 1원칙 보호.

## Allowed Paths

- packages/cli/start-plan.sh (planner 의 inprogress 분리 로직)
- packages/cli/run-role.sh (worker 의 active_item 검증)
- 또는 .autoflow/scripts/common.sh (공통 ticket lifecycle helper)

## Verification

```bash
# fix 후 30분 관찰
ls .autoflow/tickets/inprogress/ | grep -v gitkeep | wc -l
# < 2 이어야 함 (현재 6+)
git log --since="30 min ago" --oneline | grep -c "\[wiki\]"
# 합리적 (현재 1시간 29건)
grep '^last_result=' .autoflow/runners/state/worker.state
# ticket_stage_blocked 가 30분+ 지속되지 않아야 함
```

## Notes

- order_148 (worker stage_blocked 자가 reset), order_149 (check ledger live-lock) 의 root cause 보강.
- monitor 가 5시간 30분 관찰한 결과 가장 명확한 1원칙 위반 패턴.
- ticket_162 자체가 "orchestration intervention check ledger" 였고, ticket_163 은 그 후속 — 이 두 ticket 이 자율 회복 코드의 dogfood 인데 그 코드가 자기 자신으로 stuck.
- 사용자 시스템에서 desktop UI 가 inprogress 3개 + 86개 check ledger 로 표시되어 가시성 혼란.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/start-plan.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: ls .autoflow/tickets/inprogress/ | grep -v gitkeep | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
