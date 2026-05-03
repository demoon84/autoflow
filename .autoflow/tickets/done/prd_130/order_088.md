---
title: AI 진행 현황 보드 카드 표시 순서를 [오케스트레이터, 워커, 검증, 위키] 로 고정
created_at: 2026-05-03
source: claude-code /order
---

## Request

데스크톱 앱 "AI 진행 현황" 화면의 AI 카드 표시 순서가 현재 [오케스트레이터, 워커, 위키, 검증] 으로 보이는데, [오케스트레이터, 워커, 검증, 위키] 순으로 보여야 함. 위키와 검증의 위치를 바꿔줘.

## Context (분석)

- `.autoflow/runners/config.toml` 의 runner 정의 순서가:
  1. `planner` (오케스트레이터)
  2. `self-improve-1` (disabled, 표시 안 됨)
  3. `worker` (워커, role=ticket-owner)
  4. `wiki` (위키, role=wiki-maintainer)
  5. `verifier` (검증, role=verifier)
- 데스크톱 앱 `apps/desktop/src/renderer/main.tsx` 가 `board.runners` 를 별도 정렬 없이 그대로 렌더해 config 정의 순서가 화면 순서가 됨.
- `apps/desktop/src/renderer/styles.css` 의 `.ai-progress-board[data-runner-count="4"]` grid-template-areas 는 `"plan impl" / "veri wiki"` 로 정의되어 있어 grid-area 매핑이 적용되면 의도된 위치(검증→위키)로 가지만, 현재 보드가 1줄 4칸 또는 다른 layout 으로 노출되면서 grid-area 가 적용 안 되어 DOM 순서(=config 순서)대로 보이는 상태 (직전 order_086 영향 가능).

## Scope (hint)

해결 후보 (Plan AI 결정):

- **(a) `config.toml` 의 runner 정의 순서를 [planner, self-improve-1, worker, verifier, wiki] 로 재배치** — 가장 단순. 다만 config 는 runtime / CLI / 다른 도구에서도 source-of-truth 로 쓰이므로 순서 변경의 부수 효과 점검 필요.
- **(b) 데스크톱 앱에서 role 우선순위로 정렬** — `apps/desktop/src/renderer/main.tsx` 의 `board.runners` 를 화면에 렌더하기 직전에 다음 우선순위로 정렬:
  ```
  planner < ticket-owner / owner / ticket < verifier / veri < wiki-maintainer / wiki < (그 외 role)
  ```
  config 변경 없이 표시만 고정. 가장 안전.
- **(c) CSS grid-area 보강** — 1줄 4칸 grid 또는 `data-runner-count` 분기에서 `grid-template-areas`/`grid-area` 매핑을 모든 layout 에 일관되게 적용해 DOM 순서와 무관하게 시각적 순서를 강제.

권장: (b) 가 가장 안전 (config 영향 없음, 향후 runner 추가/변경에도 정책으로 유지).

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx` (옵션 b — 권장)
- (옵션 c 병행 시) `apps/desktop/src/renderer/styles.css`
- (옵션 a 채택 시) `.autoflow/runners/config.toml`

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기 "AI 진행 현황" 화면에서 카드가 좌→우 (또는 상→하) 순서로 [오케스트레이터, 워커, 검증, 위키] 가 되는지 확인.
- runner 추가/제거 시나리오 회귀:
  - 3 runner (planner, worker, wiki) 에서도 [오케스트레이터, 워커, 위키] 순서가 깨지지 않는지.
  - 알 수 없는 신규 role 이 들어오면 마지막 칸으로 fallback 정렬되는지.
- 직전 order_086 ("1줄 4칸 배열") 작업이 함께 진행 중이면, 그 layout 에서도 [오케스트레이터, 워커, 검증, 위키] 순서가 유지되는지 함께 확인.
