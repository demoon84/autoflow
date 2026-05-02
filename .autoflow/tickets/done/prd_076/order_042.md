---
id: memo_042
title: 다이얼로그/레이어 깜박임 현상 수정
status: inbox
created: 2026-05-01
---

## Request

레이어가 열렸을때 레이어가 자주 깜박임

(맥락: 데스크톱 앱에서 다이얼로그/모달 같은 "레이어" 가 떠 있는 동안, 백그라운드에서 보드 상태가 갱신될 때마다 레이어 자체가 한 번씩 깜박이거나 다시 그려지는 듯한 느낌이 있다는 사용자 보고. 재현 빈도가 "자주" 라는 표현이라 1분 tick / 폴링 주기와 연관 있을 가능성이 높음.)

## Notes

- 후보 컴포넌트: `apps/desktop/src/components/ui/dialog.tsx` (custom 구현). `DialogContent` 가 `context.open` 으로 mount/unmount 되고, `[hidden]` 속성으로 표시 토글, 추가로 `af-dialog-backdrop-in` / `af-dialog-content-in` 키프레임 애니메이션을 entry 시 적용함.
- 후보 스타일: `apps/desktop/src/renderer/styles.css:3804-3851` 의 `.af-dialog-root`, `.af-dialog-backdrop`, `.af-dialog-content`, `@keyframes af-dialog-backdrop-in`, `@keyframes af-dialog-content-in`.
- 의심 시나리오 (Plan AI 가 분기별로 검증 필요):
  1. 다이얼로그를 띄운 상태에서 부모 컴포넌트가 재렌더(보드 폴링 등)될 때 `DialogContent` 의 `if (!context.open && !keepMounted) return null;` 가 잠깐 false → true 로 토글되어 entry 애니메이션이 재실행 → 깜박임으로 보임.
  2. 부모에서 다이얼로그를 다른 노드(`<div>`) 안에 두고 재렌더 시 React 가 동일 인스턴스로 재사용하지 못해 remount.
  3. `af-dialog-root:not([hidden]) .af-dialog-*` selector + `animation: ... both;` 구조가 hidden 토글마다 keyframe 을 재생.
- 사용자가 가리키는 "레이어" 가 여러 개일 수 있다(`workflow-pin-layer-overlay` 등). 우선 가장 빈도 높은 케이스를 수정하고, 동일 원인이라면 한 번에 정리.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/components/ui/dialog.tsx`
  - `apps/desktop/src/renderer/main.tsx` (Dialog 사용처들)
  - `apps/desktop/src/renderer/styles.css` (`af-dialog-*`, `workflow-pin-layer-*`)

## Verification hint

- 데스크톱 앱에서 어떤 다이얼로그/레이어를 띄운 채 1~3 분 정도 두면서 백그라운드 보드 갱신이 일어나도 레이어가 깜박이지 않는지 확인.
- `prefers-reduced-motion` 환경에서도 회귀 없는지 확인.
- 다이얼로그 정상 open/close 애니메이션은 그대로 동작해야 함.
