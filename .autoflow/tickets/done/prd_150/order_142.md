# Autoflow Order

## Order

- ID: order_142
- Title: blocked-dirty orchestration 부분 cleanup → worker stuck (1원칙 자율 회복 깨짐)
- Status: inbox
- Created At: 2026-05-03T11:16:34Z
- Source: autoflow order create

## Request

## Request

`blocked-dirty orchestration` 이 dirty paths 의 일부 ownership group 만 commit 하고 worker.state 를 리셋하지 못해 worker 가 5분+ stuck. 1원칙 자율 회복 코드의 실제 실패 사례.

## 관찰 (T+~3시간 5분)

worker.state:
```
last_result=ticket_stage_blocked
updated_at=2026-05-03T11:15:28Z (5분+ 동안 동일 상태)
```

planner.state:
```
last_result=adapter_exit_0  (planner 는 정상 tick 함)
updated_at=2026-05-03T11:15:45Z
```

직전 commit `459e68b [PRD_143][ticket_142] orchestration cleanup: AGENTS root rule update` 후 git status 잔여:
```
modified:
  .autoflow/wiki/agents/prompt-evolution.md
  .autoflow/wiki/architecture/runner-role-slugs.md
  .autoflow/wiki/index.md
  .autoflow/wiki/learnings/*.md (3 files)
  .autoflow/wiki/log.md
  .autoflow/wiki/operations/runner-health.md
  .autoflow/wiki/operations/runner-timing.md
  .autoflow/wiki/project-overview.md
  .autoflow/telemetry/runs.jsonl
deleted:
  .autoflow/tickets/inbox/order_120.md
untracked:
  .autoflow/telemetry/.gitignore
  .autoflow/tickets/done/prd_143/
  .autoflow/tickets/inbox/order_136.md ... order_141.md (6 files)
```

즉 planner 가 dirty 11+ 파일 중 AGENTS root rule 만 commit 하고 wiki/telemetry/inbox/done 그룹은 그대로 둠.

이 ticket 의 PRD 는 정확히 "orchestration intervention check ledger" — 메타 시나리오로, 본 PRD 자체의 fix 가 본 사례를 해결.

## Hypotheses

A) **owner grouping 누락 그룹**: AGENTS.md 에 있는 grouping rule 이 wiki/inbox/done 패턴을 cover 하지 못해 planner 가 "ambiguous" 로 판단 → `[ticket_NNN] orchestration cleanup: misc housekeeping` bundle 로 가야 하는데 이 fallback path 가 작동 안 함.

B) **부분 cleanup 후 stage 리셋 누락**: planner 가 일부 cleanup commit 한 후 worker.state.last_result 를 idle 로 리셋해야 하는데 그 코드 경로가 빠짐. 또는 ticket markdown 의 `Stage: blocked` 를 todo 로 reset 하는 단계 누락.

C) **한 tick 1건 limit 누적**: AGENTS.md `5a` 의 "한 tick 에 최대 1건씩 처리" 제약 때문에 매 tick 1개 cleanup 만 진행, 7+ 그룹 cleanup 에 7+ 분 필요. 현재 1번 처리하고 worker reset 안 됨.

## Suggested Fix

A) **모든 dirty 파일 커버 가드**:
- `start-plan.sh` 의 dirty inventory 가 wiki/, telemetry/.gitignore, inbox/order_*.md (untracked), done/prd_*/ 모두 커버
- 매 tick 모든 그룹을 sequence 로 처리 (loop until clean)

B) **부분 cleanup 후 worker reset**:
- planner 가 1건 cleanup commit 후 worker.state.last_result 가 `ticket_stage_blocked` 이고 dirty 가 줄었으면 → worker.state 를 idle 로 reset + Stage 를 todo 로 되돌림
- 또는 worker 가 자체적으로 매 tick 시작 시 git 이 clean 이면 stage_blocked 자동 해제

C) **catch-all bundle**:
- AGENTS.md 의 fallback 인 `[ticket_NNN] orchestration cleanup: misc housekeeping` 으로 가는 코드 경로가 작동하는지 확인. 한 tick 에서 1 commit 이지만 모든 dirty 를 한 번에 묶어 마무리.

## Allowed Paths

- packages/cli/start-plan.sh
- packages/cli/run-role.sh (worker 의 stage_blocked 자가 해제)
- 또는 .autoflow/scripts/common.sh (recovery state 처리)

## Verification

```bash
# fix 후
git status --short | wc -l
# 0 이어야 함 (또는 의도된 dirty 만)
grep '^last_result=' .autoflow/runners/state/worker.state
# 'ticket_stage_blocked' 가 5분 이상 지속되지 않아야 함
```

## Notes

- 1원칙 자율 회복 코드의 실제 깨짐. order_127 (self-resurrect) 은 runner 재기동, 본 PRD 는 stage_blocked 자율 해제 — 둘 다 1원칙 직결.
- ticket_142 자체가 "orchestration intervention check ledger" 라는 점에서 본 PRD 가 해결되면 그 ledger 의 첫 entry 가 될 좋은 메타 케이스.
- 이 ticket 의 이름이 시사하듯 자율 개입 케이스를 누적/UI노출 하는게 목표인데, 이번 stuck 은 그 ledger 의 dogfood 시나리오.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/start-plan.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: git status --short | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
