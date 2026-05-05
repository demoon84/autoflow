---
title: AI runner start/stop 처리 중 버튼 비활성 — state transition 도달까지 disabled 유지
priority: high
created_at: 2026-05-03
source: claude-code /order
---

## Request

AI runner 가 시작/종료 **처리 중** (state transition 도중) 일 때는 같은 동작 버튼이 비활성화되어야 함. 현재는 IPC 응답 받자마자 버튼이 다시 활성화되어 사용자가 중복 클릭 시 race condition / 중복 spawn 가능. order_147 (graceful stop) 와 결합해 transition 의 의미가 더 길어진 만큼 disabled 정책을 명확히.

## 현재 동작 분석

`apps/desktop/src/renderer/main.tsx:1053-1069`:
```ts
// Per-runner inflight tracker. Key = runner.id, value = action label
const [runnerActionKeys, setRunnerActionKeys] = React.useState<Record<string, string>>({});
```

- `setRunnerAction(runnerId, "start")` 마킹 → IPC 호출 → 응답 받으면 `setRunnerAction(runnerId, "")` 로 클리어.
- 즉 **IPC 응답 = transition 완료 로 가정**.

**문제:**
- start 클릭 → IPC `start` 호출 → 응답 (보통 즉시) → actionKey 클리어 → 버튼 활성화
- 그러나 실제 runner state 는 spawn 중 (`status=starting` 같은 transient 또는 직전 `stopped` 그대로)
- 사용자가 또 클릭 가능 → 중복 spawn 시도 → race condition
- order_147 후 stop 도 마찬가지 — IPC 응답 후 graceful stop 이 진행 중인데 버튼은 활성화

## Scope (hint)

### 1. transition state 인식 강화
- `runnerActionKeys` 의 value 를 IPC 호출 inflight 가 아니라 **state transition 의도** 로 의미 변경:
  - "starting" — start 클릭 후 `status=running` 도달 전까지
  - "stopping_pending" — graceful stop 클릭 후 `status=stopped` 도달 전까지 (state `stop_pending=true` 와 정합)
  - "stopping_force" — force stop 클릭 후 `status=stopped` 도달 전까지
  - "restarting" — restart 클릭 후 stop → start 사이클 완료 전까지
  - "config" / "run" / "dry-run" — 기존 IPC inflight (단발성)
- 클리어 timing:
  - start: state `status=running` 감지 시 (board polling 또는 SSE)
  - stop: state `status=stopped` 감지 시
  - restart: 두 단계 모두 완료 후
  - timeout fallback: 60s 내 transition 안 되면 forced clear + 경고 토스트 (state polling 실패 회복)

### 2. 버튼 disabled 정책
- runner 카드의 start / stop / restart 버튼:
  - `runnerActionKeys[runner.id]` 에 어떤 값이든 있으면 모두 disabled
  - 단, graceful stop pending 중에는 stop 버튼만 다른 라벨로 활성화 ("강제 종료") — order_147 의 확인 다이얼로그 경로 유지
- 사이드바 footer / 일괄 정지 버튼도 동일 정책

### 3. 시각 피드백
- transition 중인 버튼:
  - spinner (Loader2 아이콘) + 라벨 변경:
    - "starting" → `시작 중...`
    - "stopping_pending" → `중지 예약 중...`
    - "stopping_force" → `강제 종료 중...`
    - "restarting" → `재시작 중...`
  - 색상 / opacity 로 disabled 명확히
- 카드 전체 상태 (배경 색 또는 outline) 도 transition 중임을 표시

### 4. state polling 정합
- 기존 board reload 주기로는 transition 감지 늦을 수 있음 → IPC 호출 후 short-poll (예: 500ms 간격, 60s cap) 로 빠르게 state 변화 감지
- 또는 main.js 에서 runner state file watch (`fs.watch`) 로 push 알림

### 5. 에러 / timeout 처리
- start 가 실패 (process spawn error) 시:
  - actionKey 클리어 + 토스트 "시작 실패: ..."
- stop graceful 이 max wait 도달 시:
  - actionKey 자동 force 로 전환 + 토스트 "max wait 초과, 강제 종료로 전환"
- 60s polling timeout 시:
  - actionKey 강제 클리어 + 경고 토스트 "state 확인 실패, 새로고침 권장"

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx` (runnerActionKeys 의미 변경 + 클리어 timing + 버튼 라벨/spinner)
- `apps/desktop/src/renderer/styles.css` (transition 시각 피드백)
- `apps/desktop/src/main.js` (필요 시 state file watch / short-poll handler)

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기:
  - runner start 클릭 → 버튼 "시작 중..." spinner → state running 도달 후 "중지" 라벨로 활성화.
  - graceful stop 클릭 → 버튼 "중지 예약 중..." spinner → state stopped 도달 후 "시작" 라벨로 활성화.
  - graceful stop 중 다시 클릭 가능한 "강제 종료" 라벨이 별도로 노출 (확인 다이얼로그).
  - restart 클릭 → 두 단계 모두 완료 후 활성화.
  - 같은 runner 의 다른 버튼 (config / run / dry-run) 도 transition 중 disabled.
- 회귀:
  - 여러 runner 를 병렬로 start/stop 가능 (per-runner 독립 disabled).
  - 60s timeout 시 강제 클리어 + 경고 토스트.
  - state file watch 가 정상 추적 (또는 short-poll 이 동작).
- 단위 테스트:
  - `setRunnerAction` 의 transition 의미 변경 회귀 점검.

## Notes

- **연관:**
  - **order_147** (graceful stop) 와 강결합 — 본 order 가 그 UX 보강. 같은 PRD 로 묶임 권장.
  - PRD-135 (stop reason marker) — state polling source.
- **위험:**
  - transition timeout 60s 가 너무 짧으면 force clear 가 잘못된 회복. tuning 가능 환경변수 권장.
  - state file watch 의 호스트 OS 차이 (linux inotify / macOS FSEvents) — fallback short-poll 권장.
- **1원칙 정합:**
  - 자율 흐름 영향 없음. UX 일관성만 강화.
  - timeout fallback 이 자율 흐름 안 막음 (강제 clear + 경고).
- **추가 검토 (Plan AI 결정):**
  - state polling 주기 (500ms) 가 호스트 IO 부하에 영향 있는지
  - 데스크톱 앱이 백그라운드일 때 polling 일시 중단 (foreground 복귀 시 즉시 반영)
  - fs.watch vs short-poll 의 trade-off

## Planner Notes

- 2026-05-05T13:21:04Z: Renamed from `order_148.md` to `order_176.md` because `tickets/done/prd_169/order_148.md` already archives a different completed order. Keep this request actionable as a distinct inbox item for the next planner tick.
