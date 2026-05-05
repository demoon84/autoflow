---
title: Runner config 저장 — 실제 적용 시점까지 시각 피드백 + 저장 버튼 disabled 유지
priority: high
created_at: 2026-05-03
source: claude-code /order
---

## Request

데스크톱에서 AI runner 의 모델/reasoning/agent 등을 변경하고 "저장" 버튼을 누르면, IPC 응답은 즉시 와서 버튼이 곧바로 풀리지만 실제 새 config 가 runner 에 적용되는 시점은 한참 뒤 (다음 tick 또는 restart). 사용자는 "저장 안 됐나?" 혼란. order_147 / order_148 와 동일 root cause — IPC 응답 = 완료 가정. 저장 후 실제 적용 시점까지 명확한 시각 피드백 + 버튼 disabled 유지.

## 현재 동작 분석

**저장 흐름:**
1. 사용자 변경 + 저장 클릭
2. `apps/desktop/src/main.js:2805` `configureRunner` → CLI `runners-project.sh set <id> <key=value>...`
3. CLI 가 `set_runner_config` 실행 → config.toml TOML 쓰기 (~10ms)
4. IPC 응답 → 데스크톱 `actionKey` 클리어 → **저장 버튼 풀림** (line 2718 `disabled={!canEditConfig || !hasDraftChanges || Boolean(actionKey)}`)
5. 사용자: 즉시 적용된 것처럼 보이지만 실제 runner 는 직전 config 로 동작 중
6. 실제 적용: runner 의 다음 tick (interval_seconds=60) 또는 restart 시점에 config.toml 재로드

**문제:**
- 저장 버튼 disabled 가 IPC 응답 후 즉시 풀려 사용자가 "저장됐는지" 헷갈림
- 적용까지 최대 60s 시간 차 — 즉시 인지 mechanism 없음
- 사용자가 또 클릭 → 같은 config 중복 저장 (해는 없으나 UX 혼란)
- model 변경처럼 큰 변경은 next tick 에서 LLM 호출 시 비로소 영향 → 사용자가 새 model 응답 보기 전까지 적용 확신 못 함

## Scope (hint) — 권장 설계

### 1. 적용 인지 mechanism — `config_applied_at` state 필드
- runner state 에 `config_applied_at=<ISO>` 추가:
  - tick 시작 시 config.toml 의 해당 runner block hash 계산
  - 직전 tick 의 hash 와 다르면 새 config 로 감지 → state `config_applied_at=<now>` 갱신
- 또는 더 단순: state 에 `applied_agent`, `applied_model`, `applied_reasoning` 필드를 매 tick 시작 시 기록

### 2. 데스크톱 저장 후 actionKey 유지
- `apps/desktop/src/renderer/main.tsx` 의 saveDraft 흐름:
  - 저장 IPC 호출 후 `setRunnerAction(runnerId, "config_applying")` (즉시 클리어 안 함)
  - state polling (또는 fs.watch) 으로 `config_applied_at` 변화 감지 시 actionKey 클리어
  - timeout fallback: `interval_seconds + 30s` (예: 90s) 내 적용 안 되면 강제 클리어 + 경고 토스트
- 카드 시각 피드백:
  - 저장 직후: 버튼 라벨 `저장 중...` (Loader2 spinner) → 토스트 #1: `"<runner-id> 설정 저장됨, 다음 tick(최대 N초)에 적용"`
  - 적용 인지 시: 버튼 다시 `저장` 활성화 + 토스트 #2: `"<runner-id> 새 설정 적용됨"`
  - 카드에 "적용 대기" 뱃지 (저장 후 ~ 적용 인지 사이)

### 3. 즉시 적용 옵션 — "저장하고 재시작"
- 저장 dialog 또는 카드에 "지금 재시작" 옵션 추가
- 클릭 시: configureRunner → restart_runner 연속 호출
- 시각 피드백:
  - "저장 + 재시작 중..." spinner
  - state `status=running` + new config 적용 인지 시 클리어
- 사용자가 "다음 tick 까지 기다림" vs "즉시 적용" 선택 가능

### 4. 일관 정책 (order_147 / 148 와 정합)
- order_147 (graceful stop): IPC 응답 ≠ 완료, state 도달까지 대기
- order_148 (transition disabled): start/stop 도 같은 패턴
- 본 order_158 (config save): config_applied 도 같은 패턴
- 공통 헬퍼:
  - `useRunnerActionGuard(runnerId, action, { waitFor: stateCondition, timeout })` 같은 Hook
  - 모든 runner action 이 같은 contract (IPC + state polling + timeout fallback)
- order_147 / 148 / 158 을 같은 PRD 로 묶어 처리 권장

### 5. 빈도 / 부하 가드
- state polling 주기 (500ms) 가 너무 잦으면 호스트 IO 부하 → 저장 후 30s 동안만 active polling, 이후 board reload 주기로 전환
- fs.watch 가 호스트 OS 에서 동작하면 우선 사용 (linux inotify / macOS FSEvents)

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx` (저장 후 actionKey 유지 + 토스트 + 카드 뱃지 + "저장+재시작" 옵션)
- `apps/desktop/src/renderer/styles.css` (적용 대기 뱃지 스타일)
- `apps/desktop/src/main.js` (state file watch / short-poll handler — order_148 와 공통)
- `packages/cli/runners-project.sh` 또는 `packages/cli/run-role.sh` (state `config_applied_at` 또는 `applied_*` 필드 기록)
- `.autoflow/runners/state/<runner>.state` (스키마 확장)

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기:
  - runner agent/model/reasoning 변경 + 저장 클릭 → 버튼 "저장 중..." spinner → 토스트 "저장됨, 적용 대기" + 카드 "적용 대기" 뱃지.
  - 다음 tick 후 (최대 60s) → state `applied_model` 등 갱신 → 토스트 "적용됨" + 버튼 "저장" 재활성 + 뱃지 제거.
  - "저장하고 재시작" 옵션 선택 시 즉시 restart → 새 config 적용 → 빠른 토스트 시퀀스.
  - 90s timeout 시 강제 클리어 + 경고 토스트 "적용 확인 실패, 새로고침 권장".
- 회귀:
  - 변경 없는 상태에서 저장 시도 (이미 disabled) 정상.
  - 동시 다중 runner 변경 → per-runner 독립 적용 인지.
  - state file watch 가 안 되는 환경 (CI 등) 에서 short-poll fallback 정상.

## Notes

- **연관:**
  - **order_147** (graceful stop), **order_148** (transition disabled) 와 **같은 root cause + 같은 패턴**.
  - 세 order 를 단일 PRD 로 묶어 공통 `useRunnerActionGuard` Hook 으로 일관 처리 권장.
- **위험:**
  - state file watch 의 OS 차이 + fallback short-poll 부담 — 적당한 polling cap (저장 후 30s) 으로 완화.
  - "저장하고 재시작" 자동 옵션이 default 면 사용자 의도 없는 재시작 발생 — 명시 클릭만 활성 권장.
- **1원칙 정합:**
  - 자율 흐름 영향 없음 (UX 일관성만).
  - state polling 실패해도 timeout fallback 으로 자율 흐름 안 막음.
- **추가 검토 (Plan AI 결정):**
  - `config_applied_at` 추적 방식: hash 기반 vs 단순 필드 기반
  - "저장하고 재시작" 옵션 위치 (저장 버튼 옆 dropdown / 별도 메뉴)
  - 토스트 vs 카드 뱃지 — 시각 피드백 channel 우선순위
