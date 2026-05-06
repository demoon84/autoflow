# Autoflow Order

## Order

- ID: order_149
- Title: 🚨 ticket_162 check ledger 자기참조 무한 loop (live-lock) — 1원칙 degenerate case
- Status: inbox
- Priority: normal
- Created At: 2026-05-03T14:35:37Z
- Source: autoflow order create

## Request


ticket_162 의 orchestration cleanup 이 **자기참조 무한 loop** 으로 동작 중. 매 cleanup commit 이 새 `.autoflow/tickets/check/check_NNN.md` 를 생성하고, 그 새 파일이 다음 planner tick 의 dirty path 로 잡혀 또 cleanup trigger.

## 관찰 (T+~6:30분)

```
.autoflow/tickets/check/  →  16개 (check_001 ~ check_016)
1시간 내 cleanup commit:    15건 (ticket_162 attribution)
worker.state.last_result:   ticket_stage_blocked (변동 없음)
ticket_162 Stage:           blocked (Last Updated 14:16:42Z 그대로)
```

cleanup commit 패턴:
```
[PRD_163][ticket_162] orchestration cleanup: blocked-dirty residual evidence
[PRD_163][ticket_162] orchestration cleanup: residual board housekeeping (... + check_010/011 + ...)
[PRD_163][ticket_162] orchestration cleanup: ticket Notes + check_012 record for <hash>
[PRD_163][ticket_162] orchestration cleanup: residual board housekeeping (... + check_013/014)
[PRD_163][ticket_162] orchestration cleanup: residual board housekeeping (... + check_015/016)
```

매 cleanup 이 `check_<N>` 와 `check_<N+1>` 를 새로 만들고 다음 cleanup 이 그것을 또 정리.

## Root Cause

PRD_143 의 "orchestration intervention check ledger" 가 cleanup 자체를 ledger entry 로 기록하는 설계였는데, **cleanup commit 안에 새 check entry 를 포함시키므로 다음 tick 이 그 새 entry 를 dirty 로 인식**. 자기참조 amplification.

PRD_150 (full inventory + auto-recover) 가 dirty inventory 를 모두 cleanup 하지만 cleanup 행위 자체가 새 dirty 를 만드므로 fixpoint 도달 못함.

1원칙 의 "멈추지 않음" 은 만족 (commit 이 계속 생성), 그러나 **목표 달성** 은 불가 (ticket_162 영원히 inprogress) → degenerate "live lock".

## Suggested Fix

A) **check ledger 가 cleanup commit 자체에 포함되지 않도록 분리**:
- check_NNN 기록은 별도 path (예: `.autoflow/runners/state/check-ledger.jsonl`) 또는 별도 commit (cleanup 과 묶이지 않는 background)
- cleanup 의 dirty inventory 에서 `tickets/check/` 제외

B) **fixpoint guard**:
- cleanup commit 이 **새 check_NNN 만 추가** 하는 경우 (다른 dirty path 0) → "no-op cleanup" 으로 인식 후 ticket 을 done 으로 advance
- 또는 같은 ticket 의 cleanup commit 이 N개 (예: 5) 이상 누적 시 advance

C) **ticket_162 specific reset**:
- 현재 stuck 상태를 강제 resolve. 16 check 중 일부 archive + ticket 강제 done 이동.

권장: A + B. ticket_162 자체는 PRD_143 의 ledger 기능을 정상 검증한 것이므로 done 가능.

## Allowed Paths

- packages/cli/start-plan.sh (cleanup dirty inventory 산정)
- packages/cli/run-role.sh (planner orchestration cleanup commit 생성)

## Verification

```bash
# fix 후 1시간 관찰
ls .autoflow/tickets/check/ | wc -l
# 누적이 멈춰야 함 (또는 의도된 ledger 만 증가)
git log --since="30 min ago" --oneline | grep -c "ticket_162"
# < 5 이어야 함 (현재 15+/시간)
```

## Notes

- 1원칙 의 가장 미묘한 위반 — "멈추지 않음 ≠ 진보". live-lock 도 1원칙 위반으로 봐야.
- PRD_150 follow-up + order_148 (worker stage reset) 와 함께 처리 권장.
- 6시간 모니터링 마지막 발견. monitor 가 30분+ STATE_VIOLATION 계속 emit 하면서 잡아냄.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/start-plan.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: ls .autoflow/tickets/check/ | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
