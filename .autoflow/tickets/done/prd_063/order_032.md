---
id: memo_032
title: 대시보드 핀 카드 PRD ↔ MEMO 배치 순서 교체
created: 2026-04-30
source: chat-order-trigger
---

## Request

두 개 배치 순서를 변경.

스크린샷 기준 대시보드 상단 워크플로우 핀 스트립이 현재 `PRD 62건 → MEMO 2건` 순서로 좌→우 배치되어 있다. 이 두 카드의 순서를 바꿔서 인박스(MEMO/ORDER) 카드가 먼저 오고 PRD 카드가 그 뒤에 오도록 한다. TODO 카드와 반려 카드의 위치는 건드리지 않는다.

## Notes

- 의도: 사용자 작업 흐름이 inbox(주문) → PRD → todo 로 좌→우 흐른다는 멘탈 모델에 맞춘다. 이 흐름이 핀 스트립에서 자연스럽게 읽히도록 한다.
- memo_030 (`MEMO` 라벨을 `ORDER` 로 바꾸는 주문) 과 같은 화면이라 한 번에 같이 처리해도 무방하다. 단, 두 주문은 의도상 독립적이므로 PR 분리 여부는 Plan AI / Impl AI 가 결정.
- 결과 순서: `ORDER(=MEMO) → PRD → TODO → 반려` (반려 카드는 존재할 때만 노출되는 기존 동작 유지).

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx`

  현재 핀 스트립은 `WorkflowPinLayer` 호출 4개가 같은 부모 div(`workflow-pin-strip`) 안에 정적으로 나열되어 있다. PRD 카드와 MEMO 카드 두 블록의 위치를 서로 맞바꾸면 충분하다. (대시보드 코드 기준 4670~4724 라인 부근.)

## Verification (hint)

- `apps/desktop` 빌드 / 타입체크 통과.
- 데스크톱 대시보드 상단 핀 스트립이 좌측부터 `MEMO/ORDER → PRD → TODO → (반려)` 순서로 보이는지 사용자 확인.
- 카드 클릭 시 열리는 레이어 다이얼로그(목록/세부 내용)가 그대로 동작하는지 확인 (배치 변경 외 동작 변화 없음).
