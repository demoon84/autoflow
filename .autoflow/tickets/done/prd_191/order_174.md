---
title: "Token spike 재발 (worker 5.2T tokens / 단일 row, 00:42:21Z) — order_169 root cause 확정 + intermittent 재현 패턴"
priority: normal
created_at: 2026-05-05T00:46Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #21
related: [order_169, order_170, order_171, prd_181, Todo-180]
status_update_2026-05-05T00:55Z: |
  Tick #24 검증 결과, 본 spike 와 동일 root cause 의 fix 가 이미 배포됨:
  - commit 25c2e45 (09:42:02Z) "[PRD_181][ticket_180] telemetry token usage sanity correction"
  - telemetry-project.sh 에 skipped_suspicious_rows / token_usage_trusted 가드 추가
  - 본 spike row 도 향후 aggregation 에서 skip 됨
  → 본 order 의 sanity guard / Phase A 제안은 이미 구현됨. priority 를 critical → normal 로 강등.
  → 남은 가치: Phase B (root cause prefix `5247000` 출처 추적) 만 향후 조사 가치.
---

## Request

token reset 직후의 새 baseline 위에서, 2시간 모니터링 round 의 Tick #21 에 또 한 번 동일한 telemetry 단위 mismatch spike 가 재현되었다. 단일 worker row 의 token_input/output 이 각각 **5.2 TRILLION** (정상 범위 145K 의 약 3,600만 배) 로 기록됐다. order_169 의 root cause 가 단순 한 번의 contamination 이 아니라 **systematic 한 코드 버그** 임을 증거로 확정. 즉시 코드 수정이 필요.

## 재현 evidence (Tick #21 측정)

`/Users/demoon2016/Documents/project/autoflow/.autoflow/telemetry/runs.jsonl` 의 line:

```json
{
  "event_version":1,
  "runner_id":"worker",
  "started_at":"2026-05-05T00:31:49Z",
  "ended_at":"2026-05-05T00:42:21Z",
  "duration_ms":632000,
  "result":"success",
  "token_input":5247000554307,
  "token_output":5247000065696,
  "ticket_id":"Todo-180",
  "prd_key":"prd_181",
  "model":"gpt-5.5",
  "stdout_bytes":3673016,
  "stderr_bytes":0
}
```

→ 같은 round 의 직전·직후 worker 호출은 정상 (token_input/output 각각 5만~17만 정도). **3개 worker 호출 중 1개가 spike** (~33% 발현률).

## order_169 와의 정합

| 비교 항목 | order_169 (전 round, 02:03~) | order_174 (본 round, 00:31~00:42) |
|---|---|---|
| 단일 row token spike | 43B, 86B, 88B | **5.2T (10^12)** |
| stdout_bytes | 86B 와 거의 일치 | 3.6MB (token 값과 무관) |
| runner | worker (codex) | worker (codex) |
| ticket | 다양 | Todo-180 / prd_181 |
| token-cache.tsv | 582K (정상) | 0 (reset 후 초기) |
| daily.jsonl 누적 | 86M+ (false trigger 임박) | 누적 미확인 (이번 round 측정 중) |

→ root cause 는 동일 (telemetry-project.sh 의 token aggregation 로직 또는 codex stdout parsing 단의 단위/값 mismatch). **token 값이 stdout_bytes 와 무관한 스케일** 까지 진화했다는 점이 추가 정보.

## 영향

1. **token_budget false trigger 재발 확실** — 한 번 spike 가 daily 누적에 합쳐지면 100M quota 즉시 초과 → runner_budget_preflight_or_exit 가 worker stop 또는 idle 강제. 자율 흐름 정지 위험.
2. **hot fix (budget.toml.bak) 일시 무력** — 사용자가 적용한 hot fix 는 quota check 를 비활성한 상태일 수 있으나 telemetry 자체의 잘못된 값은 그대로 누적. 재활성 시 즉시 trigger.
3. **monitoring 신호 신뢰 저하** — desktop UI 의 token 사용량 표시가 또 잘못된 값 보일 가능성.
4. **대시보드 / metrics summary 오염** — 5T 단일 row 가 daily.jsonl 의 `autoflow_token_usage_count` 에 합산되면 평균/추이 분석 무의미.

## Suggested Fix (즉시)

### Phase A — telemetry write 시점에 sanity guard
- `packages/cli/run-role.sh` 의 telemetry append 직전 또는 `packages/cli/telemetry-project.sh` 의 token_input/token_output write 단에서:
  ```bash
  # 단일 row token 값 sanity cap (예: 1M = 1,000,000)
  TELEMETRY_TOKEN_SANITY_CAP="${TELEMETRY_TOKEN_SANITY_CAP:-1000000}"
  if [[ "$token_input" -gt "$TELEMETRY_TOKEN_SANITY_CAP" ]] || [[ "$token_output" -gt "$TELEMETRY_TOKEN_SANITY_CAP" ]]; then
    log "telemetry_token_sanity_violation runner=$runner token_input=$token_input token_output=$token_output cap=$TELEMETRY_TOKEN_SANITY_CAP"
    # 두 가지 옵션:
    # (a) drop the row (가장 안전)
    # (b) clamp to cap (data preservation)
    token_input=0
    token_output=0
  fi
  ```
- 즉시 false trigger 차단. 진짜 root cause 수정과는 독립적으로 안전망.

### Phase B — root cause 추적 (telemetry 또는 stdout parsing)
- `packages/cli/telemetry-project.sh:314-388` 의 token-usage 집계 함수 정밀 분석:
  - 5,247,000,554,307 vs 5,247,000,065,696 의 공통 prefix `5247000` 의 출처 추적 (timestamp epoch 일부일 가능성? `5247000` ≈ 60.7 일 의 초)
  - codex stdout 의 token 마커 parsing 시 byte 값 또는 ANSI 시퀀스가 numeric 으로 contamination 되는지
  - JSON parsing 시 float overflow 또는 unsigned int 변환 오류
- `apps/desktop/src/main.js:1422 parseTokenUsageChunk` 와 비교 — desktop 측은 spike 값을 어떻게 처리하는지

### Phase C — daily.jsonl 보호
- daily aggregation 시 sanity cap 를 한번 더 적용. 한 row 가 전체 평균/총량 오염시키지 않도록.

## Allowed Paths

- `packages/cli/telemetry-project.sh` (sanity guard + root cause 추적)
- `packages/cli/run-role.sh` (telemetry append 직전 guard)
- `apps/desktop/src/main.js` (parseTokenUsageChunk 비교 및 동일 guard)
- `.autoflow/telemetry/runs.jsonl` (수동 cleanup — 5.2T row 만 재작성 또는 sanity cap 적용)

## Verification

- Phase A 적용 후: 새로운 worker 호출 100건 실행 시 spike row 가 0건 (또는 sanity cap 에 의해 drop 된 로그 확인).
- Phase B 적용 후: 동일 ticket (Todo-180 등) 재실행해도 5.2T 같은 비정상 값 미발생.
- Phase C 적용 후: daily.jsonl 의 autoflow_token_usage_count 가 정상 범위 (수십M~100M/일) 유지.
- 회귀: 정상 worker 호출 (145K avg, 189K max) 의 token 값이 정확히 기록.

## Notes

- **연관:**
  - **order_169** — root cause 최초 발견 ticket. 본 order 가 systematic 재현 증거.
  - **order_170** — daily.jsonl false aggregation. 본 order 가 누적 영향 우려 증거.
  - **order_171** — budget hot fix 일시 무력화. 본 order 가 재활성 위험 증거.
  - **order_173** — 본 round 에서 cross-verification 패턴 보존 learning. 본 order 가 그 패턴의 효용 증명.
- **위험:**
  - sanity cap 너무 낮으면 정상 worker 큰 호출 (189K) 도 잘릴 수 있음. cap=1M 권장 (max 정상값의 5배).
  - cap drop 정책이면 정상 통계 일부 누락. clamp 정책이면 통계 정확도 영향. trade-off 검토 필요.
- **1원칙 정합:**
  - 본 root cause 가 자율 흐름의 가장 큰 stoppage 위험 (budget false trigger). 즉시 수정으로 1원칙 수호.
  - sanity guard 만 적용해도 false trigger 차단 → root cause 추적 동안 자율 흐름 보호.
- **추가 검토:**
  - 5,247,000 prefix 의 출처 (epoch fragment? memory address? counter overflow?) 가 root cause 핵심 단서.
  - 본 round 의 다른 worker 호출이 정상이었던 것은 동일 ticket 의 stdout 길이 차이 또는 codex 실행 path 차이가 spike trigger 인지 검토 필요.
