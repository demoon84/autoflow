---
title: 🚨🚨 telemetry token-usage 가 86 billion 보고 (실제는 ~10M) — false token_budget_exceeded 확정
priority: critical
created_at: 2026-05-04T22:48Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #14 cross-verification
---

## Request

🚨🚨 critical — order_167 의 false positive 의심을 **데이터로 확정**. `telemetry-project.sh token-usage` 가 worker 의 24h token 사용량을 **86,004,270,902** (86 billion) 으로 보고. 그러나 budget quota = 100M (1억). 즉 quota 의 **860배**. 이는 물리적으로 불가능 (worker 호출당 ~145K × 24h ≈ 10M 정상 추정). 단위 mismatch / 누적 오류로 매 tick token_budget_exceeded false trigger → worker 무한 stuck (order_168 의 root cause).

## 검출 증거 (cross-verification)

```bash
$ cat .autoflow/policies/budget.toml | grep daily_token_quota
[default]
daily_token_quota = 100000000   # 100M tokens / day

$ bash packages/cli/telemetry-project.sh token-usage \
    --project-root /Users/demoon2016/Documents/project/autoflow \
    --runner worker --since "2026-05-03T22:47:35Z"
runner_id=worker
since=2026-05-03T22:47:35Z
until=
token_usage=86004270902   # 86 BILLION ← 비정상

$ awk -F'\t' '/\/worker_/ && $4+0 > 0 {sum+=$4; cnt++} END{print sum}' \
    .autoflow/metrics/token-cache.tsv
582022   # 582K (24h stale 이지만 정상 단위)
```

→ 두 source 가 **86,000배 차이**. token-cache 가 정상 단위, telemetry-project.sh token-usage 가 비정상.

## 영향 (cycle)

```
budget.toml: daily_token_quota = 100,000,000
   ↓
worker tick → runner_budget_preflight_or_exit
   ↓
runner_budget_telemetry_token_usage_since() 호출
   ↓
telemetry-project.sh token-usage → 86,004,270,902 반환 (BUG)
   ↓
86B >= 100M → token_budget_exceeded
   ↓
worker tick skip + state.last_result=token_budget_exceeded
   ↓
다음 tick 도 같은 결과 → 무한 cycle (order_168)
   ↓
PRD-179 (order_165 state heartbeat) 처리 영원히 차단
```

## Root Cause 후보

### A. 단위 mismatch — bytes 를 tokens 로 잘못 계산
- 86GB ≈ 86 billion bytes — 약식 추정 일치 (worker stdout 누적 bytes)
- token usage 계산 시 stdout byte length 를 그대로 token 으로 계산했을 가능성
- 실제 token 변환 (≈ 4 byte/token) 필요한데 안 한 듯

### B. 윈도우 무시
- `--since` 인자 무시하고 전 기간 누적 → 더 큰 값
- since="2026-05-03T22:47Z" (24h 전) 인데 since 처리 안 됐을 가능성

### C. 누적 자체가 잘못 — 같은 row 가 여러 번 카운트
- 같은 호출이 token-cache 와 별도 source 양쪽에서 카운트
- 또는 stdout file 의 모든 line 을 token usage 로 합산

### D. PRD-129 (token 계측 fix) 가 잘못된 unit 으로 합산
- fix 의도가 token 측정 정확화였는데 byte 단위로 측정해 false 큰 값
- order_162 와 같은 source

## Suggested Fix (Phase A 즉시)

### 1. telemetry-project.sh 의 token-usage 로직 검증
```bash
grep -nB2 -A20 "^run_token_usage\|run.*token_usage\|token-usage" packages/cli/telemetry-project.sh
```
- jq 의 token_input/token_output 합산 query 검사
- since 인자 처리 로직
- 합산 source (telemetry-runs.jsonl, 다른 곳?)

### 2. 단위 검증
- 단일 호출의 token_input/output 값이 정상인지 (~10K-200K 범위)
- 비정상 큰 값 (수십M~수십B) 인 행 검색
- byte/token 변환 누락 위치 찾음

### 3. 즉시 가드 (Hot fix)
- budget preflight 에서 token_usage 가 quota × 100 초과 (sanity check) 시 → false positive 의심, budget 검사 skip + warning
- 또는 budget 정책 일시 비활성화 (`AUTOFLOW_BUDGET_DISABLED=1` env)

### 4. 회복
- worker 의 `last_result=token_budget_exceeded` 후 재시작 → false trigger 회복 후 정상 진행

## Allowed Paths

- `packages/cli/telemetry-project.sh` (token-usage 합산 로직 검증/수정)
- `packages/cli/run-role.sh` (`runner_budget_preflight_or_exit` sanity check 추가)
- `.autoflow/policies/budget.toml` (필요 시 임시 quota 상향 또는 비활성)
- `.autoflow/metrics/telemetry-runs.jsonl` (검사용)

## Verification

```bash
# Phase 1: 단위 확인
bash packages/cli/telemetry-project.sh token-usage \
  --project-root "$PWD" --runner worker --since "2026-05-04T22:00:00Z"
# → 1억 미만이어야 정상 (1시간 ~1M 추정)

# Phase 3: 가드 적용 후
# worker 가 다음 tick 정상 진행 (last_result=adapter_exit_0)
grep last_result .autoflow/runners/state/worker.state

# 단위 fix 후
# token-usage 가 정상 단위 (~10M-100M / 24h) 반환
```

## Notes

- **연관:**
  - **order_167** (token_budget_exceeded false positive 의심) — **본 order 가 데이터로 확정**.
  - **order_168** (worker 3-tick stuck cycle) — 본 order 가 root cause.
  - **order_162** (token-cache 24h stale) — token 측정 신뢰성 문제 family.
  - **order_165** (state heartbeat = PRD-179) — 본 worker 가 처리 중인 PRD, 차단 대상.
  - PRD-129 (token 계측 fix, regression 발생) — 본 issue 의 source 가 PRD-129 의 partial fix 일 가능성.
- **위험:**
  - 단위 mismatch fix 시 다른 metrics (데스크톱 통계, ABA 검증) 도 영향 받음. 보수적 fix.
  - budget 일시 비활성 (Phase 3 Hot fix) 시 진짜 token 폭증 안전망 없어짐 — 단기 임시.
- **1원칙 정합:**
  - false positive 로 자율 흐름 영원 차단 = 1원칙 위배. 즉시 hot fix 필수.
  - 진짜 budget 초과는 별도 가드 (정확한 측정 후 적용).
- **검출 방법:** 사용자 질문 ("워커 토큰 사용이 실제로 저게 맞아?") → cross-verification → 86B vs 582K (~86,000배 차이) 발견.
