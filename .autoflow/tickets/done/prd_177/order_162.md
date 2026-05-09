---
title: 🚨 token-cache + telemetry-runs.jsonl 24시간 갱신 멈춤 — PRD-129 regression
priority: critical
created_at: 2026-05-04T22:08Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #2
---

## Request

🚨 critical — 실시간 감시 중 검출. token usage 집계가 **24시간 동안 멈춤**. PRD-129 (telemetry token recording and desktop token aggregation fixed, commit `025c723`) 가 done 됐지만 실제로 효과 미적용 또는 regression. 즉시 진단 + 복구.

## 검출 증거

검출 시각: 2026-05-04T22:08:24Z (실시간 감시 tick #2)

### 1. token-cache.tsv 갱신 멈춤
```
$ tail -1 .autoflow/metrics/token-cache.tsv
/Users/.../runners/logs/worker_2026-05-03T07-20-46Z_stdout.log	... ts=2026-05-03T07:20Z
```
→ **마지막 row 가 23시간 전 worker 로그**. 그 후 모든 runner 호출이 token-cache 에 추가 안 됨.

### 2. telemetry-runs.jsonl 빈 상태
```
$ tail -5 .autoflow/metrics/telemetry-runs.jsonl
(빈 출력)
```
→ PRD-129 의 source 파일이 존재하지 않거나 빈 상태.

### 3. Runner 들은 정상 호출 중
- worker: last_event_at=22:07:05Z, active=Todo-174, stdout 진행 중 (223KB live log)
- planner: 22:07:57Z, 7분 31초 LLM 호출 직후 회복
- verifier: 22:08:06Z, adapter_exit_0
- wiki: 22:06:35Z, success
- 모든 runner 가 ticking 중인데 metrics 만 멈춤

### 4. 호출 빈도 vs 측정값 불일치
- 최근 1시간 stdout logs: 4개 파일
- token-cache 마지막 측정: 24시간 전
- → 약 24시간 측정 누락 (수십~수백 호출 추적 실패)

### 5. 현재 누계 (stale baseline)
| Runner | calls | total tokens |
|---|---|---|
| planner | 9 | 946,878 |
| worker | 4 | 582,022 |
| verifier | 45 | 516,811 |
| wiki | 0 | 0 |

→ 24시간 stale. 데스크톱 통계 화면 / "토큰 사용량" badge 가 모두 이 stale 값 표시.

## 영향

- **데스크톱 통계 화면 토큰 사용량 카드 / 미터 / "사용 토큰" 표시 모두 stale** (사용자 명시 PRD-129 의 핵심 issue 가 다시 발생)
- AI 진행 현황 카드의 per-runner "N 토큰 사용" 라벨도 stale
- PRD-152~159 (토큰 절감 시리즈) 의 ABA 검증 baseline 측정 불가
- order_159 (응답 지연 단계화) 의 구현 검증도 영향
- order_139 (자원 방어) 의 token budget 정책 의미 없음 (측정값 stale)

## Root Cause 후보 (검증 필요)

1. **PRD-129 의 fix 가 일부만 적용** — desktop main.js 의 parser 만 적용되고 backend telemetry record 가 누락
2. **telemetry-runs.jsonl 작성 경로 issue** — `packages/cli/run-role.sh` 의 `run_role_record_worker_tick_telemetry` 가 호출 안 되거나 fail-silent
3. **token-cache.tsv 갱신 trigger 부재** — desktop main.js 의 aggregateLiveTokenUsage 가 새 stdout 로그를 cache 로 옮기는 step 누락
4. **PRD-129 commit 후 다른 PRD 가 회귀 도입** — git log 추적해 변경된 telemetry/metrics 코드 확인
5. **gemini token marker 가 다른 어댑터 출력 형식 깨뜨림** (PRD-126 부작용 가능)

## Suggested Fix (urgent)

### Phase A — 즉시 진단 (수 분)
- `git log --oneline --since="24 hours ago" -- packages/cli/metrics-project.sh packages/cli/telemetry-project.sh packages/cli/run-role.sh apps/desktop/src/main.js`
- 직전 PRD-129 (commit 025c723) 직후 어떤 변경이 있었는지 확인
- 의심 commit revert 또는 hotfix

### Phase B — telemetry-runs.jsonl 복구
- `packages/cli/run-role.sh:499-563` `run_role_record_worker_tick_telemetry` 가 실제로 호출되는지 디버그 로그 추가
- 호출 시 `--token-input/--token-output` 인자가 정확히 채워지는지 (PRD-129 의 핵심 fix)
- 호출 후 telemetry-runs.jsonl 에 실제 행이 추가되는지 검증

### Phase C — token-cache.tsv 갱신 복구
- `apps/desktop/src/main.js` 의 `aggregateLiveTokenUsage` (line 1484) 가 새 stdout 로그를 정상 파싱하는지
- token marker 매칭 (claude/codex/gemini) 이 최근 호출 형식과 일치하는지

### Phase D — 회귀 테스트
- 1 tick 후 token-cache.tsv 에 새 row 추가되는지 확인
- 데스크톱 미리보기에서 토큰 사용량 카드 갱신되는지 확인

## Allowed Paths

- `packages/cli/run-role.sh` (`run_role_record_worker_tick_telemetry` 디버그 + 회복)
- `packages/cli/telemetry-project.sh` (record 명령 검증)
- `packages/cli/metrics-project.sh` (aggregation 검증)
- `apps/desktop/src/main.js` (`aggregateLiveTokenUsage`, `readRunnerTokenUsage`)

## Verification

```bash
# Phase A
git log --oneline --since="24 hours ago" -- packages/cli/{metrics,telemetry,run-role}-project.sh apps/desktop/src/main.js

# Phase B 후
tail -5 .autoflow/metrics/telemetry-runs.jsonl  # 새 행 확인

# Phase C 후
tail -5 .autoflow/metrics/token-cache.tsv  # 마지막 row timestamp 가 최근

# Phase D
# 데스크톱 토큰 사용량 카드 stale 값 → 새 값으로 갱신
```

## Notes

- **연관:**
  - PRD-129 (이미 done) — 본 order 가 그 regression. 가능하면 PRD-129 author / commit 의 원본 의도 확인.
  - PRD-126 (gemini token marker) — 이전 변경이 다른 어댑터 형식 영향 가능.
  - PRD-152 ~ 159 (토큰 절감 시리즈) — 본 order fix 후 ABA baseline 정상화.
  - order_139 (자원 방어 — token budget) — 측정값 정상화 후 의미 있음.
- **위험:** 측정값 누락 = 운영 가시성 0. PRD-152~159 진행 전 본 order 우선 처리 필수.
- **1원칙 정합:** metrics 누락은 자율 흐름 자체는 안 막지만 사람 가시성 / ABA 검증 / token budget 의 의미를 무력화. critical 분류.
- **검출 방법:** 실시간 감시 중 검출. 사용자 모니터링 요청의 첫 결과물.
