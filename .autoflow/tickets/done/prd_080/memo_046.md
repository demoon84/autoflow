---
id: memo_046
title: 작업 흐름 요약 카드 최소 폭에서도 한 줄 유지
status: inbox
created: 2026-05-01
---

## Request

윈도우 최소 사이즈에서도 한줄로 나와야 함

(첨부 스크린샷: ORDER (2/45) / PRD (0/79) / TODO (0/0) 세 장의 "세부 보기" 카드가 그려진 작업 흐름 요약 영역. 현재 좁은 폭에서는 2-column 으로 떨어져서 TODO 카드만 두 번째 줄에 단독으로 가고 그 옆이 빈 공간이 됨. 사용자는 세 카드가 항상 한 줄로 가로 정렬되길 원함.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:4778-4833` 의 `TicketBoard` 헤더 영역, `<div className="workflow-pin-strip">` 안에 ORDER / PRD / TODO 3개 `WorkflowPinLayer` 가 들어감.
- CSS 위치:
  - 기본: `apps/desktop/src/renderer/styles.css:2404` `.workflow-pin-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }` → 평상시엔 3열 한 줄.
  - 문제 분기: `:3763-3766` `@media (max-width: 1120px) { .workflow-pin-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }` → 좁아지면 2열, TODO 가 줄바꿈됨.
  - 더 좁아지면: `:3769-3772` `@media (max-width: 820px) { ... 1fr; }` → 1열.
- 윈도우 최소 폭: `apps/desktop/src/main.js:249` `minWidth: 1040`. 최소 폭 1040px 은 위 1120px 분기에 걸려 2열로 떨어짐.
- 의도된 동작:
  - `minWidth: 1040` 까지 좁아져도 ORDER / PRD / TODO 가 한 줄(3열) 로 유지.
  - 카드 안의 텍스트가 잘려도 박스 자체는 한 줄에 가로로 펼쳐져 있어야 함.
- 가능한 방향 (Plan AI 가 결정):
  1. `@media (max-width: 1120px)` 분기를 제거하거나 임계값을 더 낮춰 최소 폭(1040) 보다 작게 잡고, 3열 유지.
  2. `.workflow-pin-strip` 자체를 `grid-template-columns: repeat(3, minmax(0, 1fr))` 로 못박고, 카드 내부 텍스트가 ellipsis 되도록 보강.
  3. 카드 내부 `세부 보기` 버튼이 폭을 강제로 넓히고 있으면 `flex-shrink: 1` / `min-width: 0` 으로 잡아 압축 가능하게 함.
- `@media (max-width: 820px)` 의 1열 분기는 그대로 둘지, 함께 제거할지도 같이 검토(데스크톱 앱은 모바일 폭으로 거의 안 가지만, 사이드바 등으로 콘텐츠 폭이 좁아질 수 있음).

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/styles.css` (`.workflow-pin-strip` 및 관련 미디어 쿼리)
  - `apps/desktop/src/renderer/main.tsx` (필요 시 `WorkflowPinLayer` 카드 내부 폭 압축 보강)

## Verification hint

- 데스크톱 앱을 띄우고 창을 minWidth (1040px 부근) 까지 좁혀도 ORDER / PRD / TODO 카드가 한 줄에 유지되는지 확인.
- 카드 안 카운트와 "세부 보기" 버튼이 잘리거나 줄바꿈으로 깨지지 않는지 확인.
- 더 좁아지는 임의 환경 (예: DevTools 열어 콘텐츠 폭 ~880px) 에서도 의도대로 동작하는지(또는 의도된 fallback) 확인.
