---
title: AI runner 중지 버튼을 graceful "중지 예약" + 알림 패턴으로 전환
priority: high
created_at: 2026-05-03
source: claude-code /order
---

## Request

현재 데스크톱 앱의 AI runner 정지 버튼이 즉시 SIGKILL 로 동작 → LLM 호출 중이면 응답 손실 + 토큰 낭비. **중지 예약(graceful stop) + 사용자 알림** 패턴으로 전환:
1. 중지 버튼 클릭 → 즉시 kill 안 하고 `stop_pending` 마킹
2. 현재 tick 의 LLM 호출/마무리 끝나면 자연스럽게 stopped
3. 두 단계 알림: "중지 예약됨" → "멈춤 완료"
4. 강제 종료는 별도 옵션 (확인 다이얼로그 또는 force flag)

## 현재 동작 분석

`packages/cli/runners-project.sh:1268-1316` `stop_runner()`:
```bash
if runner_pid_is_running "$previous_pid"; then
  runner_kill_process_tree "$previous_pid"   # ← 즉시 SIGKILL
fi
runner_write_state ... status=stopped, last_stop_reason=user_requested
```

→ 즉시 강제 종료. graceful / pending / 알림 mechanism 없음.

**문제 시나리오:**
- worker 가 codex 호출 중 (호출당 평균 145K tokens, max 189K)
- 사용자 stop 클릭 → 즉시 SIGKILL → LLM 응답 진행 중 끊김
- 응답 토큰 비용은 이미 발생, 결과는 활용 못 함 → **순수 손실**
- tick 의 partial 상태 (worktree 변경, ticket file 이동 등) 가 inconsistent → orchestration cleanup 필요

## Scope (hint) — 권장 설계

### 1. State 확장
- `runner.state` 에 추가 필드:
  - `stop_pending=true|false` (기본 false)
  - `stop_requested_at=<ISO>` (예약 시각)
  - `stop_mode=graceful|force` (기본 graceful)
  - `stop_requested_by=<user|system>` (출처)

### 2. CLI 동작 변경
- `runners-project.sh stop <id>` 기본 동작을 **graceful** 로 전환:
  - `stop_pending=true`, `stop_requested_at=<now>` 마킹
  - PID 는 그대로 두고 SIGKILL 안 함
  - state `last_event_at` 갱신
- `--force` 플래그 도입 (현재 동작 유지):
  - `runners-project.sh stop <id> --force` → 즉시 SIGKILL (현재 로직)
  - state `stop_mode=force`, `last_stop_reason=user_force`
- runner tick 시작 시 `stop_pending` 검사:
  - true 면 tick skip + 자기 자신 graceful 종료 (state `status=stopped`, `last_stop_reason=graceful_stop_completed`)
- LLM 호출 중에는:
  - 호출 응답 받으면 finalize (state save) 후 stopped
  - 호출이 timeout (`AUTOFLOW_AGENT_TIMEOUT_SECONDS=1200`) 도달하면 자연 종료 → graceful stop 완료
- **graceful stop 최대 대기**: `AUTOFLOW_GRACEFUL_STOP_MAX_WAIT_SECONDS` (기본 300 = 5분). 초과 시 SIGTERM → 30s 후 SIGKILL fallback (1원칙 보존, 무한 대기 방지)

### 3. 데스크톱 UI 변경
- `apps/desktop/src/renderer/main.tsx` 의 stop 버튼 (line 2899, 6056 등):
  - 클릭 시 `controlRunner(id, "stop")` 호출 (기본 graceful)
  - 버튼 상태 변화:
    - 정상: `중지` (사각형 아이콘)
    - graceful pending: `중지 예약 중...` (스피너 + 회색)
    - 완료: 다시 `시작` (재 활성화)
  - 사용자 추가 클릭 시 (graceful pending 중): 확인 다이얼로그 "현재 LLM 호출이 진행 중입니다. 강제 종료할까요?" → Yes 면 force stop
- 토스트 알림 두 단계:
  - 클릭 직후: `"<runner-id> 중지 예약됨 (현재 작업 끝나면 자동 멈춤)"`
  - state `status=stopped` 감지 시: `"<runner-id> 멈춤 완료"`
- 데스크톱 native notification (선택, opt-in):
  - 백그라운드일 때도 OS-level notification (Electron `Notification` API)
  - 환경변수 또는 settings 로 toggle

### 4. graceful stop 종료 경로 명시
state transition:
```
running → (user stop click)
       → status=running, stop_pending=true, stop_requested_at=<ISO>
       → (current tick finishes / LLM response received / timeout 도달)
       → status=stopped, stop_pending=false, last_stop_reason=graceful_stop_completed
       → toast "멈춤 완료"
```

force stop transition:
```
running 또는 stop_pending → (force flag)
                        → SIGKILL → status=stopped, last_stop_reason=user_force
                        → toast "강제 종료됨"
```

### 5. 일괄 정지 (전체 stop) 도 동일 패턴
- order_138 의 force-stop / `autoflow halt --all` 같은 emergency stop 은 force 유지 (1원칙 자기 보호)
- 일반 stop-all 은 모든 runner 에 graceful 적용

### 6. 알림 mechanism 통합
- 토스트는 기존 in-app toast (이미 있는 시스템 재사용)
- Native notification 은 Electron `new Notification(title, { body, icon })`
- 사용자가 데스크톱 fore/background 에 따라 자동 dispatch

## Allowed Paths (hint)

- `packages/cli/runners-project.sh` (stop_runner graceful + --force flag)
- `packages/cli/run-role.sh` (tick 시작 시 stop_pending 검사 + LLM 호출 후 graceful 종료 경로)
- `apps/desktop/src/main.js` (controlRunner IPC, native notification)
- `apps/desktop/src/renderer/main.tsx` (stop 버튼 상태 변화 + 확인 다이얼로그 + 토스트)
- `apps/desktop/src/renderer/styles.css` (pending 상태 스타일)
- `.autoflow/runners/state/<runner>.state` (스키마 확장)
- `AGENTS.md` (graceful stop 정책 명시)

## Verification (hint)

- `bash bin/autoflow runners stop worker "$PWD" .autoflow` → state `stop_pending=true` 마킹 + PID alive 유지 확인.
- 다음 tick → graceful 종료 + state `status=stopped, last_stop_reason=graceful_stop_completed`.
- `bash bin/autoflow runners stop worker "$PWD" .autoflow --force` → 즉시 SIGKILL + state `last_stop_reason=user_force`.
- `AUTOFLOW_GRACEFUL_STOP_MAX_WAIT_SECONDS=10` 환경에서 tick 이 길어지면 10s 후 force fallback 동작.
- 데스크톱 UI:
  - stop 클릭 → 버튼이 "중지 예약 중..." → toast 노출.
  - state stopped 감지 → 버튼이 "시작" 재활성화 + toast "멈춤 완료".
  - graceful pending 중 다시 클릭 → 확인 다이얼로그 → 강제 종료.
- 회귀:
  - emergency stop / `halt --all` 은 즉시 force 유지 (자기 보호).
  - 기존 stop 호출 (CLI / IPC) 가 default graceful 로 바뀐 영향 점검 (auto stop 류 자동화).
- `npm run desktop:check` 통과.

## Notes

- **위험:**
  - graceful stop 대기 시간이 너무 길면 사용자 답답함 → max wait 5분 + 강제 종료 옵션으로 완화.
  - tick 안의 partial 상태 finalize 가 깨지면 orchestration cleanup 발생 → planner blocked-dirty-orchestration 으로 자연 회복.
  - 자동화 (다른 시스템) 가 stop CLI 를 호출하던 것이 default 변경으로 동작 변화 → `--force` 명시 권장 또는 호환 mode (`--legacy-immediate`) 한시적 유지.
- **연관:**
  - PRD-135 (stop reason marker) — `last_stop_reason` 확장 (`graceful_stop_completed`, `user_force`, `graceful_stop_max_wait_force`)
  - order_139 (자원 방어) — emergency stop / circuit breaker 는 force 유지 (자기 보호)
  - order_146 (Hermes self-learning) — graceful stop 패턴이 skill 화 가치 있음 (blocked_recovery pattern 의 한 종류)
- **1원칙 정합:**
  - graceful stop 은 자율 흐름의 안전 종료 — 작업 손실 방지.
  - 강제 종료는 명시적 사용자 의도 (force flag 또는 확인 다이얼로그) 후만.
  - max wait timeout 으로 무한 대기 방지 (자기 보호).
- **추가 검토 (Plan AI 결정):**
  - native notification 활성화 default (on/off)
  - graceful stop 중 새 tick 시작 안 됨 → 이미 큐에 있던 작업 처리 정책 (skip vs hold)
  - 다른 runner control (start/restart) 는 graceful 패턴 필요 없음 (즉시 동작)
