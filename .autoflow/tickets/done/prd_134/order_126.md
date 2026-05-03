# Autoflow Order

## Order

- ID: order_126
- Title: verifier logs reset 잔재로 verification_pass_rate 왜곡 (60.3%)
- Status: inbox
- Created At: 2026-05-03T09:33:13Z
- Source: autoflow order create

## Request

## Request

`.autoflow/logs/` 의 verifier outcome 로그가 ticket reset 이전 history 까지 누적되어 `autoflow metrics` 의 `verification_pass_rate_percent` 와 `verifier_fail_count` 를 왜곡한다.

증거:
- `verifier_003_*_fail.md` 가 22개 누적. ticket_003 은 `.autoflow/tickets/done/prd_003/` 에 정상 종결되어 있음.
- ticket reset 폴더 다수 존재: `.autoflow/logs/tickets-reset_20260426T043324Z/tickets-before-reset/done/prd_003/`, `.autoflow/archive/start-blocked-reset_20260426T045128Z/tickets-before-reset/done/prd_003/`
- `tickets-reset` 시점 이후 같은 ticket id 로 재처리되면서 이전 fail 들이 그대로 metrics 의 `verifier_fail_count` 에 합산됨
- `metrics` 출력: `verifier_pass_count=108, verifier_fail_count=71, verification_pass_rate_percent=60.3` — pass rate 가 비현실적으로 낮음

ticket fail 빈도 top:
```
22 ticket_003   ← 4/26~4/30 (reset 잔재)
11 ticket_049
 9 ticket_071
 6 ticket_005
 6 ticket_004
 4 ticket_119  ← 5/3 최근 cycle (정상 retry 한도 4번?)
 4 ticket_009
 3 ticket_121  ← 5/3 (PRD_122 acceptance, retry 후 PRD 보강으로 처리)
```

`AUTOFLOW_REJECT_MAX_RETRIES` 기본값 3 (`/.autoflow/scripts/common.sh:1136`) 와 어긋남 → reset 시점 이전 history 가 retry 한도와 무관하게 누적된 것.

## Suggested Fix

A) **metrics aggregation 에서 reset epoch 이후 logs 만 카운트**:
- `.autoflow/runners/state/wiki-baseline.history` 에 baseline epoch 마커 또는 `.autoflow/.metrics-epoch` 같은 timestamp 파일.
- `metrics-project.sh` 의 `verifier_*` 카운터가 이 epoch 이후 logs 만 집계.

B) **logs/tickets-reset 시점 이전의 verifier_*_fail.md 를 archive 로 이동**:
- 한 번에 정리:
  ```bash
  mkdir -p .autoflow/archive/legacy-verifier-logs/
  mv .autoflow/logs/verifier_*_fail.md .autoflow/archive/legacy-verifier-logs/  # 단, 최근 N일 제외
  mv .autoflow/logs/verifier_*_pass.md .autoflow/archive/legacy-verifier-logs/  # 동일
  ```
- 또는 ticket reset 폴더 (`tickets-reset_*`, `start-blocked-reset_*`) 를 발견 시 자동으로 logs 의 동일 ticket id fail 도 같이 archive.

C) **metrics 가 ticket id 기준 dedup**: 같은 ticket id 에 대해 마지막 outcome 만 카운트. 단순 카운트보다 의미 있는 통계.

권장은 A + B 조합.

## Allowed Paths

- packages/cli/metrics-project.sh
- .autoflow/logs/ (정리 시)
- 또는 새 packages/cli/archive-legacy-logs.sh

## Verification

```bash
# fix 후
bin/autoflow metrics 2>&1 | grep -E "verification_pass_rate|verifier_(pass|fail)_count"
# verification_pass_rate_percent 가 합리적 (>= 80%) 으로 회복되어야 함
ls .autoflow/logs/verifier_003_*_fail.md | wc -l
# 0 또는 archive 폴더로 이동되어 verifier_003 fail 이 더 이상 metrics 에 잡히지 않음
```

## Notes

- order_125 (logs/.md retention) 와 시너지. 두 PRD 를 묶어 "logs lifecycle 정책" 하나로 가도 좋음.
- 시스템이 자율적으로 잘 작동하는데 metrics 만 왜곡되어 사용자/desktop UI 에서 시스템 건강을 잘못 판단할 수 있는 위험.
- ticket_003/049/071 같은 reset 이전 ticket 의 fail 은 현재 시스템 품질을 반영하지 않음.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/metrics-project.sh`

### Verification

- Command: ls .autoflow/logs/verifier_003_*_fail.md 2>/dev/null | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
