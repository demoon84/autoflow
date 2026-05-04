# Autoflow Order

## Order

- ID: order_152
- Title: 🚨 commit 폭증 (분당 0.75건) — granularity + debounce + adapter timeout 3 root cause
- Status: inbox
- Priority: normal
- Created At: 2026-05-04T01:40:04Z
- Source: autoflow order create

## Request


monitor 가 2시간 관찰한 결과 **commit 90건** (분당 0.75건) 발생. 그 중 **실제 implementation 0건**, 나머지는 cleanup / wiki update. commit volume 폭증 + token 소비 폭증 root cause.

## 측정 (monitor 130분)

```
total commits (2h):    90
[wiki] wiki update:    19
ticket_164 cleanup:    21
다른 ticket:            ~50
실제 impl:              0
```

가장 자주 modified 파일:
```
35회  .autoflow/telemetry/runs.jsonl                       ← 매 tick append, 1줄 = 1 commit
25회  .autoflow/tickets/inprogress/tickets_163.md          ← archive 후에도 history 에 잡힘
22회  .autoflow/wiki/operations/runner-timing.md           ← Wiki AI debounce 무력화
22회  .autoflow/wiki/operations/runner-health.md
21회  .autoflow/wiki/agents/prompt-evolution.md
16회  .autoflow/tickets/inprogress/tickets_164.md          ← worker tick 마다 Stage 갱신
```

cleanup commit 예시: `a2b08a5 [PRD_166][ticket_164] orchestration cleanup: telemetry evidence`
- 변경: `.autoflow/telemetry/runs.jsonl | 1 +` (1줄 추가)
- 즉 **1줄 추가에 1 commit**

worker stdout 마지막:
```
output_truncated=true
adapter_stderr_begin
... line 2753: 16389 Terminated: 15  ← SIGTERM
adapter_stderr_end
```
→ adapter 가 매 tick timeout SIGTERM, output 잘림.

## 3 root cause

### A) commit granularity 너무 미세
- planner orchestration cleanup 이 1줄 telemetry append 마다 1 commit
- 여러 dirty path 를 한 commit 으로 묶어야 (예: `cleanup: telemetry + wiki + ticket runtime (15 paths)`) — 이미 일부 commit 은 misc housekeeping 패턴 사용 중인데 일관성 없음
- 결과: 1 tick = 3-5 commit (telemetry, wiki, recovery note, runtime, ticket) 로 fragmentation

### B) Wiki debounce 무력화
- AGENTS.md: `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES=3` 또는 `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS=1800` (30분) 이상 시 fire
- 실제: 6분당 1 wiki commit = 매 tick 마다 사실상 fire
- runner-timing.md / runner-health.md 가 매 tick 갱신되어 항상 changes >= 3 만족 → debounce 무의미

### C) adapter timeout SIGTERM 패턴
- `Terminated: 15` 흔적이 worker stdout 에 정기적
- AUTOFLOW_AGENT_TIMEOUT_SECONDS 기본 1200s 인데 worker tick 평균 60s 이내 — 정상 종료 후 watchdog cleanup 의 SIGTERM 일 가능성. 그러나 `output_truncated=true` 가 같이 떠 정상 종료 아님 의심.
- 매 tick token 소비

## Suggested Fix

A) **per-tick batch commit**:
- planner cleanup 이 한 tick 의 모든 dirty path 를 단일 commit 으로. exception 없음.
- `cleanup: misc housekeeping (N paths)` 패턴 일관 적용.

B) **Wiki debounce 강화**:
- `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES` 를 3 → 10 또는 20 으로
- 또는 changes 가 단순 갱신 (timing/health 같은 metrics 갱신) 인 경우 dedup 후 카운트
- `runner-timing.md`, `runner-health.md` 같이 metric-only 갱신은 wiki debounce 에서 제외

C) **adapter timeout watchdog 검수**:
- SIGTERM/SIGKILL 호출 path 추적
- `output_truncated=true` 가 매 tick 떠도 OK 인지 design intent 확인
- 잘못되면 매 tick 1 adapter 호출 손실 = token 낭비

## Allowed Paths

- packages/cli/start-plan.sh (planner cleanup batching)
- packages/cli/run-role.sh (adapter watchdog cleanup)
- packages/cli/wiki-project.sh (debounce logic)

## Verification

```bash
# fix 후 1시간
git log --since="1 hour ago" --oneline | wc -l
# < 15 이어야 함 (현재 45+/h)
git log --since="1 hour ago" --oneline | grep -c "\[wiki\]"
# < 3 이어야 함 (현재 ~10/h)
```

## Notes

- 1원칙 "멈추지 않음" 의 부작용 — 자율 흐름이 commit/token 폭증으로 이어짐.
- order_149 (check ledger 자기참조) + order_151 (worker self-refresh) 와 함께 commit 폭증 트리오.
- token cost 영향: 매 commit 마다 wiki AI / planner / verifier adapter 호출 = 시간당 ~30 adapter 호출 = 비용 큼.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/start-plan.sh`
- `packages/cli/run-role.sh`
- `packages/cli/wiki-project.sh`

### Verification

- Command: git log --since='1 hour ago' --oneline | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
