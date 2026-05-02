---
id: memo_053
title: 진행 카드 헤더 재배치 — 토큰을 이름 옆, 버튼은 우측 끝, 트랙은 아래줄
status: inbox
created: 2026-05-01
---

## Request

프로그레스바를 아래줄로 내려고 토큰 사용량을 이름 옆으로 이동 같은 줄의 오른쪽 끝에 시작 정지 버튼 이렇게 정리

(첨부 스크린샷: AI Progress Row(러너 카드). 현재 한 줄에 [에이전트 아이콘 + Worker(이름) + 토큰 사용량(아래)] | [대기 → 구현 → 완료 → 반려 트랙] | [시작/정지 버튼] 이 가로로 펼쳐져 있고, 토큰 사용량은 이름 아래 두 번째 줄에 있음. 사용자는 다음 형태로 정리하길 원함:
- 첫 줄: 아이콘 + 이름(`Worker`) + 토큰 사용량(`5,077,269 토큰 사용`) 이 같은 줄에 가로로 붙고, 같은 줄의 오른쪽 끝에 시작/정지 버튼.
- 둘째 줄: `대기 → 구현 → 완료 → 반려` 진행 트랙을 카드 폭 전체로 펼침.)

## Notes

- 핵심 위치 (JSX): `apps/desktop/src/renderer/main.tsx:5427-5508` 의 `AiProgressRow`. 현재 구조:
  ```tsx
  <article className="ai-progress-row ...">
    <div className="ai-progress-row-top">
      <div className="ai-progress-agent">  {/* 아이콘 + 이름 + 토큰(이름 아래) */} </div>
      {!hideProgressTrack ? <div className="ai-progress-track">...</div> : null}
      {canControl ? <div className="ai-progress-actions">...</div> : null}
    </div>
    <div className="ai-progress-current">...</div>
  </article>
  ```
- 현재 CSS 그리드: `apps/desktop/src/renderer/styles.css:3150-3156`
  ```css
  .ai-progress-row-top {
    display: grid;
    grid-template-columns: minmax(132px, 0.28fr) minmax(0, 1fr) auto;
    align-items: start;
    gap: 16px;
  }
  ```
  (3열: agent | track | actions)
- 의도된 레이아웃 (Plan AI 가 구체 구현 결정):
  - 첫째 줄: `[icon + 이름 + 토큰사용량]` 좌측, 가운데 빈 영역, 우측 끝 `[stop/start]` 버튼.
  - 둘째 줄: `track` 을 `grid-column: 1 / -1` 로 펼치거나, 트랙을 `.ai-progress-row-top` 밖으로 분리해 `<article>` 의 직속 자식으로 옮기고 그 자체가 한 줄을 차지하게.
- 가능한 구현 방향:
  1. **JSX 재구성**: 트랙 `<div className="ai-progress-track">` 을 `.ai-progress-row-top` 밖으로 빼서 `.ai-progress-row` 의 새 자식 (예: `.ai-progress-row-track`) 으로 두고, 첫째 줄은 `agent`(좌) + `actions`(우) 만 있는 2열 그리드로 줄임.
  2. **그리드 영역 활용**: `.ai-progress-row-top` 을 2행 그리드로 만들고 `grid-template-areas` 로 첫 행은 `agent ... actions`, 둘째 행은 `track track track` 식으로 묶음.
  3. **flex 분리**: 첫 줄을 `display: flex; justify-content: space-between; align-items: center;` 로 두고 트랙은 형제 `<div>` 로 분리.
- 토큰 사용량 inline 처리:
  - `apps/desktop/src/renderer/main.tsx:5436-5444` 의 `<div>` 안 `<div className="ai-progress-agent-title">` 옆에 `<span className="ai-progress-token-usage">` 가 별도 줄로 그려지고 있음. 이걸 `agent-title` 의 형제(아이콘+이름)와 같은 인라인 흐름으로 옮기거나, `agent-title` 안에 함께 묶어 `display: flex; gap: ...` 처리.
  - CSS: `apps/desktop/src/renderer/styles.css:3491` `.ai-progress-agent span.ai-progress-token-usage` 의 줄바꿈/패딩 정리 필요.
- 좁은 폭 회귀: 윈도우 minWidth 1040 (`apps/desktop/src/main.js:249`) 부근에서도 첫 줄이 깨지지 않게 `토큰 사용량` 텍스트가 ellipsis 되거나 자연스럽게 줄어들도록 보강.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (`AiProgressRow` JSX 재배치)
  - `apps/desktop/src/renderer/styles.css` (`.ai-progress-row*`, `.ai-progress-agent*`, `.ai-progress-track`, `.ai-progress-actions`, `.ai-progress-token-usage`)

## Verification hint

- 데스크톱 앱 진행 메뉴에서 각 러너 카드의 첫 줄에 `아이콘 + 이름 + 토큰 사용량` 이 한 줄로 붙고, 같은 줄의 오른쪽 끝에 시작/정지 버튼이 정렬되는지 확인.
- 둘째 줄에 `대기 / 구현 / 완료 / 반려` 트랙이 카드 폭 전체로 펼쳐지는지 확인.
- 토큰 사용량이 0이거나 아주 큰 값(`12,345,678 토큰 사용`) 일 때도 줄바꿈/잘림 없이 보기 좋은지 확인.
- `hideProgressTrack` 분기 (트랙이 없는 카드) 에서도 헤더가 깨지지 않는지 확인.
- 윈도우 minWidth 부근(1040) 에서 회귀가 없는지 확인.
- 진행/상세 카드 아래 `ai-progress-current` 영역 (상태 배지/메시지) 이 그대로 보이는지 회귀 확인.
