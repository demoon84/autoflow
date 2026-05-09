# Autoflow Order

## Order

- ID: order_199
- Title: 러너 quota_limited / 토큰 부족 시 터미널 하단 고정 토스트
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T10:28:36Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 러너 quota_limited / 토큰 부족 시 터미널 하단에 고정 토스트 레이어
- Priority: normal
- Status: ready


토큰 부족일 경우 터미널창 하단에 고정 토스트 레이어 출력

## Notes

- 사용자 시나리오: LLM Wiki / Worker 중 한 러너의 agent (gemini / codex / claude) 가 API 한도 도달하면 stdout 에 "ERROR: You've hit your usage limit" 같은 메시지가 흘러나오고 runner state 는 `last_result=quota_limited` 로 표시됨. 사용자는 카드 헤더의 작은 badge ("중지됨 quota_limited") 만 봐서 즉시 인지 어려움. 터미널 본문 안에 고정 토스트로 강조.
- 토스트 내용 (한국어): "토큰 한도 도달 — <agent> 의 사용 한도를 초과했습니다. <retry-after> 에 재개 가능. 다른 모델로 임시 swap 하거나 한도 회복을 기다려주세요."
- 토스트 위치: 터미널 (LiveTerminalView) 의 하단에 sticky 오버레이. 터미널 출력은 그 위로 흐르고 토스트는 항상 보임.

### 감지 신호

이미 시스템에 있는 데이터:
- `runner.lastResult` (state 의 `last_result` 키): `quota_limited`, `adapter_exit_1` 등.
- `runner.stateStatus` 가 `stopped` + lastResult `quota_limited` 면 확실.
- 또는 stdout chunk 에서 정규식 매칭: `usage limit`, `rate limit`, `quota exceeded`, `Too Many Requests`, `RESOURCE_EXHAUSTED`, `MODEL_CAPACITY_EXHAUSTED` (이미 `runner_file_has_quota_limit` 헬퍼가 .autoflow/scripts/runner-common.sh 에 있음).
- retry-after 시각: stdout 에 "try again at <ts>" 정규식으로 추출.

### 후보 위치

- `apps/desktop/src/renderer/main.tsx`:
  - `LiveTerminalView` 또는 그 wrapper 에 토스트 sticky element 추가.
  - 토스트 표시 조건: `runner.lastResult === "quota_limited"` 또는 정규식 매치.
  - 새 컴포넌트 `RunnerQuotaToast({ runner, retryAfter })`.
- `apps/desktop/src/renderer/styles.css`:
  - `.live-terminal-view-quota-toast` (position: absolute; bottom: 0; left: 0; right: 0; bg: var(--destructive)/orange tint; padding; border-top).
- 정규식으로 retry-after 추출 (stdout 스트림에서):
  - `try again at (May 12th, 2026 7:34 AM)` 같은 텍스트 → 사용자 표기 변환.
  - `quota.*reset.*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})` 등.

### 상호작용

- 토스트는 dismiss X 버튼 (잠시 숨기기) — 사용자가 닫으면 같은 fingerprint 동안 재표시 안 함.
- 다음 tick 에 quota 회복되면 (`lastResult` 변경) 자동 토스트 사라짐.
- 다른 카드와 별도 — 각 러너 카드 마다 독립 토스트.

### 회귀 가드

- 토스트가 xterm 의 fit/cols 계산에 영향 주면 안 됨 (overlay 라 absolute positioning).
- 다크 / 라이트 테마 모두 가독성 (대비 4.5:1).
- prefers-reduced-motion: 슬라이드 애니메이션 비활성, 즉시 표시.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Done When

- [ ] 러너의 `lastResult` 가 `quota_limited` 거나 stdout 에 한도 키워드 매치 시 터미널 하단에 고정 토스트가 표시된다.
- [ ] 토스트 본문에 한국어 안내 + (가능 시) retry-after 시각.
- [ ] 토스트 dismiss(X) 가능, 같은 fingerprint 동안 재표시 안 됨.
- [ ] quota 회복 (`lastResult` 변경) 시 자동 사라짐.
- [ ] 토스트가 xterm 의 fit/cols 에 영향 없음 — 우측 글자 잘림 회귀 없음.
- [ ] `npm run desktop:check` 통과.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조: 실제 quota_limited 상태 (또는 mock) 시 터미널 하단 토스트 시각 확인.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
