---
title: Self-monitoring agent 도입 — 본 세션 monitoring 패턴을 Autoflow 표준 기능으로
priority: high
created_at: 2026-05-04T23:34Z
source: claude-code /order
---

## Request

claude-code 가 1.5시간 동안 60s 주기 polling 으로 보드/runner/process/메트릭을 추적해 9건의 critical/high order 를 검출 + 발행한 monitoring 패턴을, **Autoflow 자체 기능 (self-monitoring agent)** 으로 표준화. AI 가 단순히 작업을 처리하는 자율 흐름에 더해 자기 자신의 운영 건강성을 모니터링하고 문제 검출 시 자동으로 check/order 를 발행하는 closed loop 를 도입. order_146 (Hermes self-learning) 의 형제 패턴.

## 배경 — 본 세션 검증 결과

claude-code 의 monitoring 도구 (60s tick × 32회) 가:
1. **8개 감시 항목** 중 7개에서 신호 검출:
   - runner state stuck (last_event_at 5분+)
   - last_result 반복 (worker token_budget_exceeded 22회 cycle)
   - process 폭증 (없음, 안전)
   - 메트릭 비정상 (token-cache 24h stale)
   - 인박스/inprogress 적체 (정상 흐름)
   - dirty PROJECT_ROOT (32 누적)
   - needs_user (false positive)
2. **9건 critical/high order 발행** — root cause (telemetry 86B 단위 버그) 까지 cross-verification 으로 확정
3. **운영 시간** 90분, 자원 부담 최소 (60s polling, fs 직접 접근)
4. 5건 order 가 monitoring 진행 중 자율 흐름에서 처리 → 닫힘 loop 입증

→ 같은 패턴을 **Autoflow 자체 기능** 으로 도입하면 사용자가 monitoring 도구 직접 운영 안 해도 자율적으로 운영 건강성 보호.

## Scope (hint) — Self-monitoring agent 설계

### 1. 새 runner 도입 (또는 기존 wiki AI 확장)
- option A: 별도 runner `monitor` (role=`monitor`, agent=gemini, interval=60s)
- option B: Wiki AI 의 책임 확장 (이미 wiki 영역 owner)
- 권장: **option A** (단일 책임 분리, wiki 와 cadence 다름)

### 2. 감시 항목 8개 (본 세션 기준)
1. runner state stuck (`last_event_at` > 임계 — 5min default, order_159 단계화 적용)
2. last_result 반복 (같은 fail N회 — 3 default, order_168 정합)
3. process 폭증 (runners-project.sh / bash 수 baseline × N — order_136/139 정합)
4. 메트릭 비정상 (token-cache stale > 1h, telemetry token quota 초과 sanity)
5. board 적체 (inbox/inprogress/reject N건 이상)
6. dirty PROJECT_ROOT (N개 이상 누적, baseline 비교)
7. needs_user 발생 (정확한 `Recovery State: needs_user` 패턴 매칭, 키워드 false-positive 회피)
8. 새 패턴 검출 (이전 baseline 과 다른 행동 — anomaly detection)

### 3. 신호 검출 시 자동 발행
- 검출된 신호마다 `tickets/inbox/order_NNN.md` 자동 작성:
  - frontmatter: `source: autoflow-monitor-agent`, `priority` 자동 결정
  - 본문: 검출 시각, baseline 차이, 권장 조치 hint
  - order_135 (check_NNN.md) 와 다름 — check 는 자동 개입 결과 기록, monitor 는 신호 검출
- 또는 critical 한 경우 **`tickets/check/check_NNN.md`** (order_135 와 통합) 형태도 가능

### 4. Cross-verification 정책 (root cause 추적)
- 단일 source 신호로는 가설만, 여러 source 비교로 root cause 확정 후 발행
- 본 세션의 token_budget false positive 검증이 모범 사례:
  ```
  token-cache (582K, 정상 단위) vs telemetry (86B, 버그) → 86,000배 차이 → 단위 버그 확정
  ```
- 가설 단계 order 와 root cause 확정 단계 order 를 분리 발행 가능

### 5. 데스크톱 UI 통합
- 신호 검출 시 데스크톱 toast 알림 (order_171 정합)
- "monitor" 메뉴 또는 통계 페이지 (order_129) 에 monitoring 결과 카드 추가
- 검출된 신호 목록 + 자동 발행된 order list

### 6. 환경변수
- `AUTOFLOW_MONITOR_ENABLED` (default 1)
- `AUTOFLOW_MONITOR_INTERVAL_SECONDS` (default 60)
- `AUTOFLOW_MONITOR_STUCK_THRESHOLD_SECONDS` (default 600, order_159 정합)
- `AUTOFLOW_MONITOR_REPEAT_FAIL_THRESHOLD` (default 3, order_168 정합)
- `AUTOFLOW_MONITOR_AUTO_ORDER_ENABLED` (default 1)

## Allowed Paths (hint)

- `.autoflow/runners/config.toml` (새 monitor runner 추가)
- `.autoflow/scripts/start-monitor.sh` (신설)
- `packages/cli/monitor-project.sh` (신설 — 감시 항목 8개 측정 + 신호 분류)
- `packages/cli/run-role.sh` (monitor role 분기)
- `.autoflow/agents/monitor-agent.md` (신설 — 정책 명시)
- `apps/desktop/src/renderer/main.tsx` (데스크톱 표시)
- `AGENTS.md` (self-monitoring 정책 명시)

## Verification (hint)

- monitor runner 시작 후 1시간 운영:
  - 본 세션과 비슷한 8개 신호 항목 측정 정상
  - 인위적 stuck 시뮬레이션 → 자동 order 발행 확인
  - cross-verification 패턴 작동 (가설 → root cause)
- 데스크톱 UI 에 monitor 메뉴 / 카드 노출 + toast 알림
- `AUTOFLOW_MONITOR_ENABLED=0` 으로 끄면 기존 동작
- 회귀: 다른 runner (planner/worker/verifier/wiki) 정상

## Notes

- **연관:**
  - **order_146** (Hermes self-learning) — 본 order 와 형제. self-monitoring + self-learning 합쳐 self-aware Autoflow.
  - **order_135** (check_NNN.md 자동 개입 이력) — monitor 가 자동 발행하는 order 가 같은 자리.
  - **order_139** (자원 방어) — monitor 가 fork-bomb / token spike 검출.
  - **order_159** (응답 지연 단계화) — monitor 의 stuck 임계 정합.
  - **order_168** (worker 3-tick stuck) — monitor 의 repeat fail 임계 정합.
  - **PRD-129** (token 집계) — monitor source 정확성 의존.
- **위험:**
  - monitor 자체가 자원 소비 (60s polling) → 본 세션 측정 결과 minimal (수십 ms / tick).
  - false positive 자동 order 발행 → 인박스 noise. 임계 보수적 + cross-verification 필수.
  - monitor agent 의 LLM 호출 비용 → gemini-flash-lite 권장 (Wiki AI 와 동일).
- **1원칙 정합:**
  - self-monitoring 은 자율 흐름의 자기 보호 — 1원칙 강화.
  - monitor 자체 fail 도 폐쇄루프 (다른 runner 가 monitor 의 stuck 검출 가능, 추후).
- **장기 비전:**
  - Self-monitoring + Self-learning (order_146) 결합 → 검출된 패턴이 skill 로 자동 학습 → 같은 신호 재발 시 자동 회복까지.
