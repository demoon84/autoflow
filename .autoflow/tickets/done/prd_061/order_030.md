---
id: memo_030
title: 데스크톱 UI의 MEMO 표기를 ORDER 로 통일
created: 2026-04-30
source: chat-order-trigger
---

## Request

memo에서 order로 변경 되었기 때문에 관련 표기도 모두 order로 변경되어야 함.

대시보드/인박스 화면에서 사용자에게 보이는 "MEMO" 배지, "MEMO N건" 핀 타이틀, "Memo-029" 형태의 항목 라벨, 그리고 "빠른 메모", "메모 본문", "들어온 메모가 없습니다" 같은 한국어 문구가 아직 옛 이름(memo)으로 남아 있다. 채팅 트리거가 `/order` 로 바뀐 만큼 사용자가 보는 데스크톱 UI 표기도 ORDER 계열로 통일되어야 한다.

스크린샷 기준 변경 대상 (예시):
- 핀 카드 타이틀: `MEMO 6건` → `ORDER 6건`
- 레이어 다이얼로그 타이틀: `MEMO 6건` → `ORDER 6건`
- 항목 prefix 라벨: `Memo-029` → `Order-029`
- 항목 우측 배지: `MEMO` → `ORDER`
- 본문 안내: "인박스에 들어온 빠른 메모 목록입니다…" → "주문" 또는 "오더" 어휘로 일관 (사용자 친화적인 한국어로)

## Notes

- 파일 시스템 레벨의 `tickets/inbox/memo_NNN.md` prefix 와 CLI `autoflow memo create` 는 의도적으로 그대로 둔다 (Plan AI 스캐너 / CLI 호환). UI 라벨만 ORDER 로 바꾼다.
- "Memo-029" 같은 prefix 변환은 파일 stem `memo_NNN` 을 표시 단계에서 `Order-NNN` 으로 매핑하는 식이면 충분하다 (파일 이름 자체는 건들지 않음).
- 한국어 카피("빠른 메모", "메모 목록", "메모가 없습니다")는 "주문" 또는 "오더" 중 일관된 용어 하나로 통일해 달라. 결정은 Plan AI / Impl AI 가 맥락을 보고 정한다.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx`

  현재 grep 기준 `MEMO`, `Memo-`, "메모" 라벨은 이 파일 한 곳에만 등장한다 (대시보드 핀 카드, 인박스 레이어, 워크플로우 행 라벨, prefix 변환 함수 등).

추가로 발견되는 사용자 노출 문자열이 있으면 같은 PR 안에서 함께 정리.

## Verification (hint)

- `apps/desktop` 빌드 / 타입체크 통과
- 런타임 화면(인박스 핀 카드, 인박스 레이어 다이얼로그, Tickets 행 라벨)에서 MEMO 표기가 모두 ORDER 로 바뀌었는지 사용자 확인 (스크린샷 기반)
- 파일 시스템에서는 `tickets/inbox/memo_NNN.md` 가 그대로 유지되는지 확인 (Plan AI 스캐너가 계속 동작)
