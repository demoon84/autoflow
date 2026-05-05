---
title: 🚨🚨 false positive token_budget_exceeded planner 까지 확산 — 자율 흐름 차단 임박
priority: critical
created_at: 2026-05-04T22:59Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #19
---

## Request

🚨🚨 critical escalation — order_169 (telemetry token-usage 86B 버그) 의 false positive token_budget_exceeded 가 worker 단일 → planner 까지 확산. 자율 흐름 전체 (planner + worker) 차단 임박. order_169 fix 가 즉시 우선되어야 함. 본 order 는 확산 사실을 명시적으로 기록 + 사용자 알림.

## 검출 증거

검출 시각: 2026-05-04T22:59:15Z (실시간 감시 tick #19)

| Runner | last_result | last_event_at | cycle 횟수 |
|---|---|---|---|
| **planner** | **token_budget_exceeded** | 22:59:09Z | **1회 (새 발생)** |
| **worker** | token_budget_exceeded | 22:58:52Z | **10회 연속** |
| verifier | (이전 adapter_exit_0) | 22:58:18Z | 정상 |
| wiki | success | 22:57:04Z | 정상 |

→ planner 가 token_budget_exceeded fail 시작. 같은 단위 mismatch 버그 (order_169) 영향 받음.

## 영향 (확산)

이전 (order_169 발행 시점):
- worker 단일 stuck cycle
- planner / verifier / wiki 정상

현재 (tick #19):
- worker + planner 동시 stuck
- 자율 흐름의 핵심 2개 runner 차단
- verifier 도 같은 budget 정책 적용 중 → 시간 문제로 확산 가능
- wiki 는 별도 어댑터 (gemini) 라 다를 가능성 있지만 같은 정책 source

**결과 예측 (order_169 fix 안 되면):**
- 다음 tick 들에서 verifier 도 token_budget_exceeded 시작
- 모든 runner 차단 → 1원칙 (멈추지 않음) 완전 위배
- Autoflow 자체 사망

## Root Cause (order_169)

`packages/cli/telemetry-project.sh token-usage` 가 worker 24h token 사용량을 **86,004,270,902** (86 billion) 으로 보고. budget quota 100M 의 860배. 단위 mismatch (bytes 를 tokens 로 잘못 계산) 또는 누적 오류. 모든 runner 의 budget preflight 가 매번 false 초과 판정 → token_budget_exceeded.

## Suggested Fix (urgent)

### Phase 0 — 즉시 budget 정책 비활성 (Hot fix)
사용자 응급 조치 가능:
```bash
# .autoflow/policies/budget.toml 의 daily_token_quota 를 매우 큰 값으로 일시 변경
sed -i.bak 's/daily_token_quota = 100000000/daily_token_quota = 999999999999/g' \
  .autoflow/policies/budget.toml

# 또는 budget.toml 임시 백업 후 제거 (정책 비활성)
mv .autoflow/policies/budget.toml .autoflow/policies/budget.toml.bak
```

→ runner 들이 즉시 회복. budget 정책 fix 후 복원.

### Phase 1 — order_169 의 root cause fix
`packages/cli/telemetry-project.sh` 의 token-usage 합산 로직 검증/수정. 단위 mismatch 또는 누적 오류 fix.

### Phase 2 — Hot guard (Sanity check)
budget preflight 에서 token_usage 가 quota × 100 초과 → false positive 의심, budget 검사 skip + warning.

## Allowed Paths

- `.autoflow/policies/budget.toml` (Phase 0 hot fix)
- `packages/cli/telemetry-project.sh` (Phase 1 root fix)
- `packages/cli/run-role.sh` (Phase 2 sanity check)

## Verification

```bash
# Phase 0 후 1 tick 대기
grep last_result .autoflow/runners/state/{worker,planner,verifier,wiki}.state
# → adapter_exit_0 또는 success (token_budget_exceeded 사라짐)

# Phase 1 후 정확 측정
bash packages/cli/telemetry-project.sh token-usage \
  --project-root "$PWD" --runner worker --since "$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)"
# → 정상 단위 (~10M) 반환
```

## Notes

- **연관 (조치 우선순위):**
  - **order_169** (telemetry 86B 버그) — root cause, 우선 fix
  - **order_168** (worker 3-tick stuck cycle) — 본 order 의 직전 단계 (worker 만)
  - **order_167** (false positive 의심) — 본 order 의 가설 단계
  - **order_162** (token-cache 24h stale) — 토큰 metrics 신뢰성 family
  - **order_165** (state heartbeat) — worker 가 처리 중인 PRD-179, 영원히 차단 위험
  - **order_139** (자원 방어 — circuit breaker) — Phase 2 의 정합 source
- **위험:**
  - Phase 0 hot fix (budget 비활성) 시 진짜 token 폭증 안전망 없어짐 — 단기 임시
  - 확산이 verifier 까지 도달하면 verify 흐름도 차단 → 사용자 작업 결과 검증 불가
- **1원칙 정합:**
  - 자율 흐름이 false positive 로 영원 차단 = 1원칙 완전 위배
  - 즉시 hot fix → root fix 단계 필수
- **검출 source:** 실시간 감시 (1시간 + 30분 연장) 의 19번째 tick.
