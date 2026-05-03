# Autoflow Order

## Order

- ID: order_122
- Title: telemetry 가 worker만 기록 - planner/wiki/verifier 누락
- Status: inbox
- Created At: 2026-05-03T08:12:38Z
- Source: autoflow order create

## Request

## Request

`packages/cli/run-role.sh:507` 의 `run_role_record_worker_tick_telemetry()` 첫 줄이 `[ "$public_role" = "ticket" ] || return 0` 이라 **planner / wiki / verifier / coordinator / self-improve / todo 의 모든 tick 이 telemetry 에 절대 기록되지 않는다**.

런타임 관찰 (T+254s 동안 보드 상태):
- worker(ticket), planner, wiki, verifier 4개 runner 모두 status=running
- 4분 사이에 ticket 1건 done 이동, todo 신규 추가, inbox order 1건 promote 진행
- 그러나 `.autoflow/telemetry/runs.jsonl` 라인 수: 5 → 5 (변화 없음)

## Suggested Fix

함수 이름이 `run_role_record_*worker*_tick_telemetry` 인데 실제로는 모든 runner 의 tick 을 기록해야 한다. 두 가지 방향 중 하나.

A) 가드를 제거하고 모든 role 을 기록 (가장 단순):
```bash
# packages/cli/run-role.sh:507 삭제 또는 변경
# 기존: [ "$public_role" = "ticket" ] || return 0
# 새:   (line 삭제 — 모든 role 기록)
```
함수 이름도 `run_role_record_tick_telemetry` 로 rename 권장.

B) 명시적 화이트리스트:
```bash
case "$public_role" in
  ticket|planner|wiki|verifier) ;;
  *) return 0 ;;
esac
```

`runner_id` 필드는 이미 jsonl 에 들어가므로 wiki-project.sh:2740 의 p50/p95/p99 통계는 자연스럽게 runner 별로 분리된다.

## Impact

- `.autoflow/telemetry/runs.jsonl` 에 모든 runner tick 의존-data 가 들어감
- `autoflow metrics` 의 token/duration aggregation 이 planner/wiki/verifier 까지 포함하게 됨
- adapter timeout (exit 124) / stderr nonempty 등 failure_class 도 모든 role 에서 추적 가능
- `consecutive_timeout_count` watchdog 동작 확인 가능

## Allowed Paths

- packages/cli/run-role.sh

## Verification

```bash
# 1. fix 후 wiki tick 1회 발생까지 대기
ls .autoflow/runners/state/wiki.state
# 2. 새 telemetry 라인이 wiki runner_id 로 들어왔는지 확인
tail -3 .autoflow/telemetry/runs.jsonl | jq -r '.runner_id' | sort -u
# 기대: planner, wiki, worker (시점에 따라)
```

## Related

- order_121 (`duration_ms` 단위 버그) 와 함께 fix 하는 것이 자연스러움. 두 fix 모두 같은 함수 영역.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`

### Verification

- Command: tail -5 .autoflow/telemetry/runs.jsonl | jq -r .runner_id | sort -u

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
