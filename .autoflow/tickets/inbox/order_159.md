---
title: "응답 지연" 라벨 false-alarm 줄이기 — 임계값 조정 + 단계화 + LLM 활성 검출
priority: normal
created_at: 2026-05-03
source: claude-code /order
---

## Request

데스크톱 AI 진행 현황 카드의 "응답 지연" 라벨이 자주 보임. 현재 임계 (3분 또는 interval×3) 가 LLM 호출 시간보다 짧아 정상 호출인데도 false alarm 빈번. 임계 조정 + 단계화 + LLM 활성 검출로 진짜 멈춤만 경고하도록 개선.

## 현재 동작 분석

`apps/desktop/src/renderer/main.tsx:5721-5729`:
```ts
function runnerHeartbeatStale(runner: AutoflowRunner) {
  if ((runner.stateStatus || "").toLowerCase() !== "running") return false;
  if (!runner.lastEventAt) return false;
  const ageSec = (Date.now() - new Date(runner.lastEventAt).getTime()) / 1000;
  const intervalSec = Number(runner.intervalEffectiveSeconds || runner.intervalSeconds || 60) || 60;
  return ageSec > Math.max(intervalSec * 3, 180);
}
```

→ interval=60s 인 runner 가 **3분(180s)** 이상 새 이벤트 없으면 "응답 지연" 표시.

**문제 — 두 케이스 혼재:**

| 케이스 | 실제 상태 | 현재 표시 |
|---|---|---|
| 정상 LLM 호출이 길어짐 | worker (codex 호출 평균 145K, max 189K tokens) → 5~10분 정상 소요 | "응답 지연" (false alarm) |
| 진짜 멈춤 | 어댑터 락 / IPC lock (order_133) / fork-bomb 영향 / timeout 임박 | "응답 지연" (진짜 경고) |

→ 두 케이스가 같은 라벨로 구분 불가. 사용자 인지 부담.

**호출당 토큰 측정값 (직전 분석):**
- worker (codex): 평균 145K, max 189K — 3~10분 정상 소요
- planner (claude opus): 평균 105K, max 162K — 2~5분
- verifier (claude opus): 평균 11K — 30초~1분
- wiki (gemini-flash-lite): <8K — 수초

worker / planner 의 정상 호출만으로도 3분 임계를 자주 넘음.

## Scope (hint) — 개선 방향

### A. 임계값 조정 (단순)
- 임계: `Math.max(intervalSec * 3, 180)` → `Math.max(intervalSec * 5, 600)` (10분).
- adapter timeout (`AUTOFLOW_AGENT_TIMEOUT_SECONDS=1200`) 의 50% 정도가 자연스러움.
- 환경변수: `AUTOFLOW_HEARTBEAT_STALE_THRESHOLD_SECONDS` (기본 600).

### B. 단계화 (중간 — 권장)
3단계 라벨로 분리:
- **`LLM 응답 대기 중 (Nm)`** — 1~5분 (정상 호출 진행 중). 회색 또는 정보 톤.
- **`응답 지연 의심 (Nm)`** — 5~15분 (오래 걸림, 정상 가능성 있으나 모니터링). 노랑.
- **`멈춤 가능 (timeout 임박)`** — 15분~ (어댑터 timeout 1200s 임박). 빨강 (현재 destructive 톤 유지).
- 사용자가 단계로 심각도를 즉시 인지.

### C. LLM 호출 활성 검출 (중장기 — 가장 정확)
- 어댑터 stdout 의 streaming chunk 도착 여부 모니터링 (claude/codex/gemini 어댑터가 streaming 지원하면).
- runner state 에 `last_adapter_chunk_at=<ISO>` 필드 신설 → 어댑터 호출 중 streaming chunk 받을 때마다 갱신.
- heartbeat stale 검사 시 `last_event_at` 외에 `last_adapter_chunk_at` 도 참조 → chunk 가 있으면 정상 활성, 없으면 진짜 멈춤.
- 또는 어댑터 process 상태 검사 (CPU usage, file descriptor 활성).

### D. tooltip / detail 강화 (작은 보강)
- 현재 tooltip: "3분 이상 새 이벤트가 없습니다 — 어댑터 락 대기 또는 멈춤 가능성"
- 단계별 명시:
  - "정상 LLM 호출 진행 중 (3분 경과)"
  - "응답이 평소보다 오래 걸림 (8분 경과). worker/planner 의 큰 호출은 5~10분 정상."
  - "어댑터 timeout 1200s 까지 N분 남음. 멈춤 가능성. force restart 검토."

권장 진행:
1. **A 즉시 적용** — 임계값 환경변수화 + 기본 600s. 한 줄 수정으로 false alarm 즉시 감소.
2. **B 단계화** — UI 변경. 사용자 인지 명확화.
3. **C LLM 활성 검출** — 어댑터 streaming 도입 후 별도 PRD (큰 변경).

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx` (`runnerHeartbeatStale` + 단계 라벨)
- `apps/desktop/src/renderer/styles.css` (단계별 톤)
- (옵션 C) `packages/cli/run-role.sh` (어댑터 streaming + state 갱신)
- (옵션 C) `.autoflow/runners/state/<runner>.state` (`last_adapter_chunk_at` 신설)

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기:
  - **A 적용 후**: 정상 worker 호출 (5~7분) 동안 "응답 지연" 미표시 확인.
  - **B 적용 후**: 호출 시간 경과에 따라 라벨이 정보→노랑→빨강 순으로 단계 변화.
  - tooltip 이 단계별 의미 명확히 노출.
- 회귀:
  - 진짜 멈춤 케이스 (어댑터 hang, IPC lock) 에서 멈춤 가능 라벨이 timeout 임박 시 표시.
  - timeout 1200s 에 따라 자동 종료되어 status=stopped 로 transition 정상.
- 환경변수:
  - `AUTOFLOW_HEARTBEAT_STALE_THRESHOLD_SECONDS=300` 으로 짧게 설정 시 기존 동작 회귀 확인.

## Notes

- **연관:**
  - order_133 (doctor/metrics IPC lock) — 진짜 멈춤 케이스 사례.
  - order_134/136 (fork-bomb) — 진짜 멈춤 케이스 사례.
  - order_147/148/158 (transition / stop / config save) — 같은 UX 일관성 영역.
- **위험:**
  - 임계 너무 길면 진짜 멈춤 인지 늦음. timeout (1200s) 의 50% 정도가 균형.
  - 옵션 C 의 streaming chunk 모니터링은 어댑터 출력 형식 의존. 현재 stdout buffering 방식과 충돌 가능 (별도 검증).
- **1원칙 정합:**
  - 라벨은 시각 표시만. 자율 흐름 영향 없음.
  - 단계화로 사용자가 진짜 멈춤만 빠르게 인지 → graceful stop (order_147) / force restart 적시 결정 가능.
- **추가 검토 (Plan AI 결정):**
  - A 즉시 + B 단계화 묶어서 단일 PRD vs 분할
  - C 는 streaming 어댑터 정합 큰 변경이라 별도 PRD 권장
  - 단계 임계 (5분 / 15분) 가 적절한지 — 보통 호출 분포 분석 후 조정 가능
