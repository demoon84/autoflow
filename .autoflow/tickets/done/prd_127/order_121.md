# Autoflow Order

## Order

- ID: order_121
- Title: telemetry duration_ms 단위 버그 (×1000 누락)
- Status: inbox
- Created At: 2026-05-03T08:06:09Z
- Source: autoflow order create

## Request

## Request

`packages/cli/run-role.sh:515` 의 `duration_ms=$((end_epoch - start_epoch))` 는 epoch seconds 차이를 그대로 `duration_ms` 변수에 넣어 telemetry 에 저장한다. `telemetry_timestamp_to_epoch()` (cli-common.sh:183) 가 `date +%s` (seconds 단위) 를 반환하므로 실제 `duration_ms` 는 ms 가 아니라 seconds 가 들어가고 있다.

현재 `.autoflow/telemetry/runs.jsonl` 의 모든 worker run 에서 stored duration_ms (e.g. 382, 661) 가 actual delta_ms (382000, 661000) 의 1/1000 로 기록되고 있는 것을 확인했다.

## Suggested Fix

```bash
duration_ms=$(((end_epoch - start_epoch) * 1000))
```

(또는 일관되게 `duration_seconds` 로 필드를 rename. 후자는 `wiki-project.sh:2740` 의 p50/p95/p99 보고 헤더와 desktop dashboard 까지 영향이 커서 전자가 안전.)

## Impact

- `.autoflow/telemetry/runs.jsonl` `duration_ms` 필드
- `packages/cli/wiki-project.sh:2740` 의 p50/p95/p99 duration_ms 통계 보고
- `autoflow metrics` 출력의 token / duration 관련 집계
- desktop dashboard 의 runner 평균 시간 표시 (있다면)

## Allowed Paths

- packages/cli/run-role.sh

## Verification

```bash
# 1. bash 산술 동작 sanity
bash -c 'a=1700000060; b=1700000000; echo $(((a-b)*1000))'  # 60000 이어야 함
# 2. fix 후 worker tick 1회 발생시키고 새 라인 검사
tail -1 .autoflow/telemetry/runs.jsonl | jq '{duration_ms, started_at, ended_at}'
# duration_ms 가 분 단위 작업에 대해 minutes*60*1000 수준이어야 함
```

## Notes

- `wiki-project.sh:2740` header 가 `p50_duration_ms` 로 표기돼 있어 ms 가 정합적이고, 단순 rename 보다 ×1000 fix 가 backwards compatible.
- 과거 jsonl 라인은 이미 잘못 기록돼 있어 backfill 은 별도 판단. 현재 5라인 뿐이므로 그대로 두거나 `* 1000` 일괄 보정 옵션을 PRD 단계에서 결정.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`

### Verification

- Command: tail -1 .autoflow/telemetry/runs.jsonl | jq .duration_ms

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
