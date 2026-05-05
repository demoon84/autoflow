---
title: 🚨 어댑터 stdout `_live_stdout.log` 30+개 leak — finalize/rename 누락
priority: high
created_at: 2026-05-04T22:15Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #4
---

## Request

`.autoflow/runners/logs/` 에 `*_live_stdout.log` 접미사를 가진 stdout 파일이 **30+개 누적 leak**. 정상 동작이라면 어댑터 호출 종료 시 `_live` 접미사 제거되어 일반 `*_stdout.log` 로 rename 되어야 함. finalize/rename 로직 누락 또는 fail-silent 의심.

## 검출 증거

검출 시각: 2026-05-04T22:15:24Z (실시간 감시 tick #4)

```
$ ls .autoflow/runners/logs/*_live_stdout.log | wc -l
30+

# 가장 오래된 leak (37시간 전):
worker_2026-05-03T09-48-24Z_live_stdout.log  466KB
worker_2026-05-03T11-17-32Z_live_stdout.log  1.3MB  ← 가장 큰
planner_2026-05-03T10-29-17Z_live_stdout.log 144KB
verifier_2026-05-03T10-30-45Z_live_stdout.log 58KB
wiki_2026-05-03T10-27-49Z_live_stdout.log    4.6KB

# Per-runner 누적:
planner: 7개  (max 148KB)
worker:  11개 (max 1.3MB, 일부는 200KB+ 다수)
verifier: 6개 (max 58KB)
wiki:    7개  (max 12KB)
```

## 영향

1. **디스크 누적**: worker 만 11개 × 평균 200KB = **~2.2MB** 의 partial 호출 결과 leak. 시간 지나면 GB 단위 가능.
2. **모니터링 노이즈**: 어떤 호출이 진짜 진행 중인지 vs leak 인지 구분 어려움. (현재 worker 1개 active 인데 _live 11개 보임)
3. **데스크톱 UI 영향 가능**: live log streaming 이 stale 파일을 잘못 표시할 수 있음.
4. **state vs file system 불일치**: runner state 의 last_event_at 은 정상 갱신되는데 _live 파일은 그대로. finalize 로직이 state 만 업데이트하고 file rename 누락.

## Root Cause 후보 (검증 필요)

1. **rename step 누락**: `packages/cli/run-role.sh` 의 어댑터 호출 finalize 직후 `mv ${file}_live_stdout.log ${file}_stdout.log` 수행 안 됨
2. **adapter timeout 시 cleanup 부재**: timeout 으로 호출 강제 종료 시 _live 그대로 남음 (timeout fallback path 의 cleanup 책임 누락)
3. **runner crash / restart 시 leak**: runner process 가 죽으면 진행 중이던 _live 가 그대로 남고 새 호출은 새 _live 생성
4. **PRD-135 (stop reason marker) 후속 변경 부작용**: stop 처리 경로에 cleanup 누락 가능

## Suggested Fix

### Phase A — 즉시 cleanup 스크립트 (수동 회복)
```bash
# 안전: state 의 active live 가 아닌 것만 정리
for f in .autoflow/runners/logs/*_live_stdout.log; do
  # 24시간 이상 오래된 파일은 일괄 cleanup
  if [ -n "$(find "$f" -mmin +1440)" ]; then
    mv "$f" "${f%_live_stdout.log}_stdout.log"
  fi
done
```

### Phase B — 코드 수정
- `packages/cli/run-role.sh` 의 어댑터 호출 finalize 단계 (각 어댑터 호출 직후, line 2150-2410 부근) 에서:
  - 호출 정상 종료 후 `_live_stdout.log` → `_stdout.log` rename
  - timeout (exit 124) 후에도 동일 cleanup
  - error 후에도 cleanup (단 _live 자체를 진단용으로 보관 정책이면 별도 디렉터리 archive)

### Phase C — Periodic janitor
- runner tick 시작 시 자기 runner_id 의 stale _live 파일 (state.last_event_at 보다 오래된) 자동 cleanup
- 또는 wiki maintainer / curator 가 주기적 정리

## Allowed Paths

- `packages/cli/run-role.sh` (어댑터 호출 finalize cleanup)
- `packages/cli/runners-project.sh` (start/stop/restart 시 cleanup)
- `.autoflow/scripts/log-cleanup.sh` (신설 — periodic janitor)
- (한 번) `.autoflow/runners/logs/` 의 stale _live 파일 일괄 rename

## Verification

```bash
# 정상 호출 1회 후
ls .autoflow/runners/logs/*_live_stdout.log | wc -l
# → 1 (현재 진행 중인 호출만)

# Phase A 후
ls .autoflow/runners/logs/*_live_stdout.log | wc -l
# → 1~5 (직전 1시간 내만)

# Phase B 적용 후 24시간 운영 후
ls .autoflow/runners/logs/*_live_stdout.log | wc -l
# → 4 미만 (각 runner 의 진행 중 1개씩 최대)
```

## Notes

- **연관:**
  - PRD-135 (stop reason marker) — 동일 finalize 경로. 회귀 가능성.
  - order_134 (bash leak) — file leak 형제 패턴.
  - order_136 (fork-bomb) — process leak 의 partial 산출물이 _live 로 남아 누적.
  - order_162 (token-cache stale) — _live 가 정리 안 되면 token cache 도 영향 받을 가능성 (마지막 stdout 추적 logic 이 _live 인지 _stdout 인지 어디서 보는지 확인).
- **위험:**
  - 진짜 진행 중인 _live 를 잘못 cleanup → live streaming 깨짐. 안전 가드: state.last_event_at 보다 오래된 파일만 cleanup.
- **1원칙 정합:**
  - file leak 은 자율 흐름 안 막지만 호스트 디스크 / monitoring 가시성 영향. 장기 보호.
