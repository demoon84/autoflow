---
title: AI 진행 현황 보드를 1줄 4칸 그리드로 배치
created_at: 2026-05-03
source: claude-code chat (no slash trigger; small-change intent)
---

## Request

ai 진행 현황을 1줄 4칸 배열로 변경해 보자.

## Scope (hint)

- 데스크톱 앱 "AI 진행 현황" 화면(`settings-content-progress` → `.ai-progress-board`) 의 카드 그리드를 한 줄에 4칸이 들어가는 가로 배치로 변경.
- 현재 상태(`apps/desktop/src/renderer/styles.css`):
  - 기본: `grid-template-columns: repeat(2, minmax(0, 1fr))`
  - `data-runner-count="3"`: 1줄 3칸 (plan / impl / wiki)
  - `data-runner-count="4"`: 2x2 (plan/impl, veri/wiki)
- 변경 방향: `.ai-progress-board { grid-template-columns: repeat(4, minmax(0, 1fr)); }` 기준 1줄 4칸으로 통일하고, 러너 수에 따른 grid-area 분기 (`data-runner-count="3"`, `="4"`) 는 정리(또는 단순화). 카드 수가 4보다 적으면 우측이 비어 보이는 게 자연스럽고, 4보다 많아지면 다음 줄로 자동 wrap.
- 카드 최소 너비/높이는 좁아질 수 있으므로 `.ai-progress-row` 의 padding / 폰트 크기 / 내부 정보 밀도 회귀 확인.
- 좁은 viewport 에서는 한 줄 4칸이 너무 좁을 수 있으니 media query 로 viewport <= 일정 너비에서는 2칸 또는 1칸으로 자연스럽게 줄어드는 fallback 고려 (Plan AI 판단).

## Allowed Paths (hint)

- `apps/desktop/src/renderer/styles.css`
- (불가피하면) `apps/desktop/src/renderer/main.tsx` 의 `.ai-progress-board` data-attribute 사용부

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기에서 "AI 진행 현황" 화면이 한 줄 4칸 그리드로 나타나는지 확인.
- 현재 토폴로지(3-runner: planner / worker / wiki) 에서는 4번째 칸이 비어 있어도 카드 정렬과 너비가 깨지지 않는지 확인.
- 향후 4번째 runner(예: 별도 verifier 등) 가 추가될 때 4번째 칸으로 자연스럽게 채워지는지 시뮬레이션 (가능 범위 내).
- 좁은 너비(예: 1280px 미만) 에서 카드 안 텍스트가 잘리지 않는지 회귀 확인.
