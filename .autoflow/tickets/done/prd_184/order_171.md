---
title: 🚨 데스크톱 앱 종료 (사용자 보고) — runner 4개는 detached 로 살아있음
priority: high
created_at: 2026-05-04T23:16Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #26 (사용자 보고)
---

## Request

🚨 high — 사용자 보고: "개발앱이 종료됨". Electron 데스크톱 process 0개 확인. 그러나 4개 runner (planner/worker/verifier/wiki) 는 detached 로 살아있고 정상 ticking 중. 데스크톱 UI 통한 monitoring/control 차단. 종료 원인 분석 + detached runner 정책 검증 + 재시작 시 충돌 방지.

## 검출 증거

검출 시각: 2026-05-04T23:16:14Z (실시간 감시 tick #26)

```
$ ps -A | grep "Electron.*Autoflow" | wc -l
0   ← 데스크톱 종료 확정

$ ps -A | grep "runners-project.sh loop-worker"
20442  bash runners-project.sh loop-worker planner   (1h 31m 운영)
24003  bash runners-project.sh loop-worker verifier  (1h 28m 운영)
32563  bash runners-project.sh loop-worker wiki      (35m 운영)
50887  bash runners-project.sh loop-worker worker    (1h 32m 운영)

$ runner state 마지막 갱신: 모두 1분 이내 ✅
```

→ runner 들이 데스크톱 종료 후에도 detached 로 자율 흐름 유지.

## 영향

### 긍정적
- **자율 흐름 보존** — 1원칙 정합. 데스크톱 종료해도 boards 진행.
- monitoring 도구 (본 세션) 가 fs 직접 접근으로 추적 가능.

### 부정적
- **사용자 가시성 0** — UI 통한 보드 / runner 상태 / 토큰 사용량 / 통계 모두 확인 불가.
- **runner control 어려움** — start/stop/restart 가 CLI 직접 호출만 가능.
- **데스크톱 재시작 시 충돌 가능성**:
  - 기존 detached runner 와 새 데스크톱이 같은 runner state 동시 write
  - PID 추적 / lock file 정합성 깨질 가능성
  - 사용자 ConfigureRunner 액션이 detached runner 에 즉시 반영 안 될 수 있음

## 종료 원인 후보 (분석 필요)

### A. 의도적 종료
- 사용자가 직접 닫음 (Cmd+Q)
- 정상 종료, 별도 fix 불필요

### B. 앱 crash
- order_167/170 의 token_budget cycle 영향 — IPC 호출 폭증으로 메모리 leak
- order_133 (doctor/metrics IPC lock 35s+) — UI freeze 후 사용자 force quit
- order_134/136 (bash leak / fork-bomb) — 호스트 자원 고갈로 앱 무응답
- 기타 메모리/CPU 누적 (1.5h 운영)

### C. 시스템 측
- macOS App Nap 또는 강제 종료
- 로그아웃 / 시스템 sleep 중

## Suggested Fix

### Phase A — 즉시 진단 (사용자 측)
```bash
# 종료 원인 확인 (시스템 로그)
log show --predicate 'process == "Electron"' --last 30m 2>/dev/null | tail -50
# 또는
log show --predicate 'eventMessage contains "Autoflow"' --last 30m 2>/dev/null | head -20

# crash report
ls -lat ~/Library/Logs/DiagnosticReports/ | head -5
```

### Phase B — Detached runner 안전 종료 정책
- 데스크톱 앱이 running 상태에서 종료 시:
  - **A 옵션 (현재)**: detached runner 그대로 alive — 자율 흐름 지속
  - **B 옵션**: detached runner 도 graceful stop (order_147 와 정합)
  - **C 옵션**: 사용자 선택 다이얼로그 ("앱 닫을 때 runner 멈출까?")
- 권장: **C 옵션** (사용자 선택, default A)

### Phase C — 데스크톱 재시작 시 기존 runner 인지
- `apps/desktop/src/main.js` 의 `app.whenReady()` 에서 detached runner 검출:
  - state file 의 pid 가 alive 인지 확인
  - 이미 살아있으면 spawn 안 하고 attach 만 (UI 표시)
  - 사용자에게 "기존 runner 재연결됨" 토스트
- runner state 의 atomic write 보장 (race condition 방지)

### Phase D — Crash 원인 자가 진단 (장기)
- 데스크톱 종료 직전 last 30s 의 IPC 호출 수, 메모리, CPU 기록
- 비정상 종료 패턴 (memory > 4GB, IPC > 1000/s 등) 시 사용자 알림
- order_139 (자원 방어) 와 정합

## Allowed Paths

- `apps/desktop/src/main.js` (종료 시 cleanup 정책 + 재시작 시 detached runner 검출)
- `apps/desktop/src/renderer/main.tsx` (사용자 선택 다이얼로그)
- `packages/cli/runners-project.sh` (필요 시 detached runner 식별)

## Verification

```bash
# Phase B 검증
# 데스크톱 종료 → runner pid 추적
# A 옵션: runner 들 alive
# B 옵션: runner 들 graceful stopped

# Phase C 검증
# 1. detached runner 상태에서 데스크톱 시작
# 2. UI 가 기존 runner pid 인식 + 정상 표시
# 3. "재연결됨" 토스트 표시
```

## Notes

- **연관:**
  - **order_147** (graceful stop) — 종료 시 graceful 정책 정합
  - **order_148** (transition state) — runner state 동시 write 정합
  - **order_133/134/136** (IPC lock / fork-bomb) — 데스크톱 crash 원인 후보
  - **order_167/170** (token_budget cycle) — 메모리 leak 가능성
- **위험:**
  - detached runner 가 사용자 모르게 계속 자원 소비 (token / disk / process)
  - 데스크톱 재시작 시 runner 중복 spawn 위험
- **1원칙 정합:**
  - 데스크톱 종료해도 runner 자율 흐름 유지 = 1원칙 부합 (긍정적)
  - 단 사용자 가시성 회복 위해 데스크톱 재시작 정책 필요
- **현재 상태 (monitoring 관점):**
  - 본 세션의 monitoring 도구는 fs 직접 접근 → 데스크톱 종료 무관하게 계속 작동
  - 다음 tick 까지 runner 정상 추적 가능
