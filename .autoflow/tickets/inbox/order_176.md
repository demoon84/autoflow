---
title: 모든 runner 를 event-driven (fs.watch + post-work recheck) 로 전환 — interval 폴링 폐지로 LLM 호출 80%+ 절감
priority: high
created_at: 2026-05-05T07:00Z
source: claude-code
related: [order_175, order_160, prd_171]
---

## Request

현재 모든 runner (planner / worker / verifier / wiki) 가 60s interval 폴링으로 매 tick 마다 LLM 호출을 발생시켜 6시간에 13M tokens 을 소비. quota 30% 가 6시간에 소진되는 페이스. **순수 event-driven 모델** 로 전환해 "할 일 없을 때는 LLM 호출 0" 을 달성.

## 동작 모델 (사용자 직접 명세)

```
[idle / sleep + fs.watch 감시]
        ↓ 폴더에 새 파일 도착 (fs.watch hook)
        ↓
[wake up + tick 시작]
        ↓
[작업 수행 — LLM 호출]
        ↓
[작업 완료]
        ↓
[폴더 재확인]
   ├─ 처리할 파일 있음 → 즉시 다음 tick (LLM 호출)
   └─ 없음 → 다시 idle / sleep + fs.watch 감시
```

**핵심:** interval 기반 정기 폴링 폐지. **trigger 는 오직 (a) 폴더 변경 hook 또는 (b) 직전 작업 완료 후 큐 잔존**.

## 6시간 측정 데이터 (현재 폴링의 비용)

| Runner | 호출 수 | Output | Total | 평균/호출 |
|---|---|---|---|---|
| verifier | **154** ⚠ | 4.33M | 4.43M | 28K |
| planner | **76** | 4.83M | 4.90M | 64K |
| worker | 5 | 3.79M | 3.79M | 758K |
| wiki | 59 | 0.04M | 0.08M | 1.3K |
| **합계** | **294** | | **13.16M** | |

→ verifier+planner 의 230 호출 중 대부분은 큐 비어있는데도 LLM 호출 발생. 순수 낭비.

## Scope (hint)

### 1. 각 runner 별 watch 매핑

| Runner | Watch 폴더 | wake trigger |
|---|---|---|
| **planner** | `tickets/inbox/`, `tickets/backlog/`, `tickets/reject/` | order/PRD/reject 도착 (이미 19c 부분 구현) |
| **worker** | `tickets/todo/` | 새 ticket 도달 |
| **verifier** | `tickets/verifier/` | verifier 큐 진입 |
| **wiki** | `tickets/done/`, `wiki/` (debounce) | done 진입 또는 source 변경 |

### 2. tick 종료 시 큐 재확인

각 runner 의 tick finish 직전:
```bash
# 의사 코드
1. 현재 작업 finish (verify, commit, etc.)
2. watch 폴더 재확인:
   - 비어있음 → fs.watch + sleep (no marker, no polling)
   - 잔존 → 즉시 다음 tick (LLM 호출, marker 정리)
3. interval timer 는 **safety net 으로만** 유지 (예: 30분, 매우 긴)
```

### 3. fs.watch 구현 (planner 19c 패턴 generic 화)
- 현재 planner 만 구현된 realtime wakeup 코드를 `runner_realtime_watch_setup()` 같은 helper 로 추출
- worker / verifier / wiki 모두 동일 패턴 사용
- pending marker (`.autoflow/runners/state/<runner>.realtime-wakeup.pending`) 1개로 변경 합치기 (race-free)

### 4. Heartbeat fallback 정책

다음 작업은 시간 기반 fallback 필수 (1원칙):
- Reject auto-replan retry cooldown (기본 1h)
- Blocked-dirty orchestration retries (5회 cap 후 needs_user)
- Skill curator 7일 주기
- Adapter timeout watchdog (1200s)
- Stale state cleanup

→ 각 runner 의 `interval_seconds` 를 **safety heartbeat** 로 재정의 (기본 1800s = 30분)
→ 평소엔 fs.watch + post-work recheck 로 깨어나고, heartbeat 는 안전망

### 5. 환경변수
```bash
# 기본 모드 변경
AUTOFLOW_RUNNER_MODE=event_driven  # 또는 "polling" (legacy)

# safety heartbeat
AUTOFLOW_RUNNER_HEARTBEAT_SECONDS=1800

# planner 19c 와의 호환
AUTOFLOW_PLANNER_REALTIME_ENABLED=1  # event_driven 모드면 강제 on
```

### 6. wiki 의 debounce 보존
- wiki 는 file 변경이 매우 잦음 (문서 동기화)
- 기존 `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES` (3) + `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS` (1800) 는 그대로 유지
- fs.watch 는 trigger 만 제공, debounce 로 합치기

## Allowed Paths

- `packages/cli/run-role.sh` (runner loop 핵심 로직)
- `runtime/board-scripts/run-role.sh` (설치 템플릿 동기화)
- `packages/cli/runners-project.sh` (event_driven mode 환경변수)
- `.autoflow/runners/config.toml` (interval_seconds 기본값 변경)
- `runtime/board-scripts/common.sh` (helper 함수)
- `.autoflow/scripts/common.sh` (sidecar 동기화)
- `tests/smoke/runner-event-driven-smoke.sh` (신규 단위 테스트)

## Verification

### Smoke test
```bash
# 1. 모든 runner event_driven 모드 시작
AUTOFLOW_RUNNER_MODE=event_driven autoflow run

# 2. 큐 모두 비어있을 때 6시간 가동
# expected: LLM 호출 거의 0 (heartbeat 30분 × 4 runner × 12회 = 48 호출 max)

# 3. order_*.md 1건 inbox 에 추가
# expected: planner 가 1초 안에 깨어나서 처리

# 4. ticket todo 진입
# expected: worker 가 1초 안에 깨어나서 claim

# 5. tick finish 후 큐에 잔존 ticket 있으면 즉시 다음 처리
```

### 정량 검증
- 24시간 가동 시 LLM 호출 합계: 현재 (60s polling) **~1200건** → event_driven **~50-100건** (큐 활동 의존)
- 큐 비활성 8시간 (밤 시간대 등): 현재 ~480건 → event_driven **~16건** (heartbeat only)

## Notes

- **연관:**
  - **order_175** (live-lock fix) — 본 order 의 fixpoint guard 가 event_driven 에서도 정상 동작해야 함.
  - **order_160** (planner realtime trigger) — 본 order 의 source.
  - **prd_171** (worker self-refresh dirty deadlock) — event_driven 모드에서 worker 의 자기 dirty 가 다음 tick trigger 가 안 되도록 주의 (자기 자신 변경 watch 는 제외).
  - **CLAUDE.md 19c** — planner realtime 정책 base, 본 order 가 4 runner 일관 적용으로 확장.
- **위험:**
  - fs.watch 의 OS 차이 (linux inotify / macOS FSEvents / WSL 호환성). fallback short-poll (10s) 권장.
  - watch 가 자기 자신 (runner state, log) 변경을 trigger 하지 않게 exclude 패턴 필요.
  - heartbeat 너무 길면 reject auto-replan / blocked recovery 가 늦게 동작. 30분 default 가 적정선이지만 환경변수로 조정 가능.
- **1원칙 정합:**
  - heartbeat fallback 이 멈추지 않음 보장.
  - event_driven 모드에서도 모든 자동 회복 (reject auto-replan, blocked-dirty orchestration, auto-close) 정상 동작.
- **예상 효과:**
  - 6h 토큰: 13.16M → **2-3M** (80% 절감)
  - 주간 quota: 30% → **6%** 사용
  - 폴링으로 인한 stdout/log 누적도 감소

## 추가 검토 (Plan AI 결정)

- event_driven 모드를 default 로 할지, opt-in 으로 할지
- 기존 `AUTOFLOW_PLANNER_REALTIME_ENABLED` 와의 통합 정책 (event_driven 모드면 자동 enabled)
- macOS FSEvents 의 latency (수백ms) 가 운영에 미치는 영향
- inotify watch limit (linux fs.inotify.max_user_watches) 초과 가능성
- watch handle leak 방지 (signal trap / cleanup hook)
