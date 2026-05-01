---
id: memo_051
title: 티켓 표시 ID prefix 소문자 통일
status: inbox
created: 2026-05-01
---

## Request

표기가 대소문자가 불규칙해 Order- prd-  전부 소문자로 통일해줘 이것 두개뿐 아니라 다른 티켓들도 수정되야해

(첨부 스크린샷: 티켓 디테일 레이어의 메타 박스. ID 칸은 `Order-046` (대문자 O 시작), PRD KEY 칸은 `prd_080` (소문자) 으로 표기되어 일관성이 깨져 보이는 상태. 사용자는 사람이 보는 모든 표시 ID prefix 를 소문자로 통일하길 원함.)

## Notes

- 핵심 위치: `apps/desktop/src/renderer/main.tsx:3839-3857` 의 `workflowFileDisplayName` 가 표시용 ID 를 만든다. 현재 매핑:
  - `prd_NNN` → `PRD-NNN`
  - `project_NNN` → `PRD-NNN`
  - `reject_NNN` → `Reject-NNN`
  - `memo_NNN` → `Order-NNN`
  - `tickets_NNN` → `Ticket-NNN`
- 의도된 변경 (Plan AI 가 표기 형식 최종 결정):
  - 모두 소문자 prefix 로 통일. 후보 형식 두 가지:
    - 하이픈 유지: `prd-NNN`, `reject-NNN`, `order-NNN`, `ticket-NNN`
    - 원본 underscore 유지: `prd_NNN`, `reject_NNN`, `order_NNN`, `ticket_NNN`
  - 사용자가 PRD KEY (`prd_080`) 를 기준으로 비교한 점을 보면 underscore 형식이 자연스러울 수도 있음. 두 표기 중 어느 쪽으로 통일할지는 Plan AI 가 사용 빈도/가독성 기준으로 결정.
- 사용처: `workflowFileDisplayName` 와 `displayId` 가 여러 곳에서 노출됨:
  - `apps/desktop/src/renderer/main.tsx:4100` 디테일 레이어 헤더 (`<strong>{item.displayId}</strong>`)
  - `:4077` 메타 박스 ID 행 (`["ID", item.id || item.displayId]`)
  - `:4426` 칸반 카드 id (`<span className="ticket-kanban-card-id">{item.displayId}</span>`)
  - `:4605, :4657` 워크플로 핀 레이어 / 리스트 항목 제목
  - `:4711` 핀 레이어 셀렉티드 타이틀
  - `:5555` 러너 진행 카드의 활성 티켓 표시
- 절대 건드리면 안 되는 것 (CLAUDE.md 규칙 15/15a/16 항):
  - 파일명 자체 (`memo_NNN.md`, `prd_NNN.md`, `tickets_NNN.md`, `reject_NNN.md`)
  - parser 가 읽는 키 (`ID`, `PRD Key`, `Stage` 등 섹션 헤더 / 필드명)
  - PRD KEY 값 (`prd_080`) 처럼 보드 contract 로 쓰이는 식별자
  - storage runner id (`owner-1`, `planner-1`, `wiki-1`), role key, ticket field, key=value 출력
- 즉 이번 변경은 **사용자에게 보이는 표시 ID prefix 의 대소문자만** 손본다.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (`workflowFileDisplayName` 및 그 결과를 그대로 노출하는 영역)
  - `apps/desktop/src/renderer/styles.css` (해당 라벨에 의존한 폭/줄바꿈이 있다면 부수적으로 보강)

## Verification hint

- 데스크톱 앱에서 칸반 카드, 티켓 디테일 레이어 ID 칸, 핀 레이어 헤더, 러너 진행 카드 등 표시 ID 가 등장하는 모든 화면에서 prefix 가 일관되게 소문자로 보이는지 확인.
- 검색 / 필터처럼 case-sensitive 비교를 하는 코드 경로(있다면)에 회귀가 없는지 확인.
- 파일 이름, PRD KEY 값, 보드 contract, parser 가 읽는 출력은 그대로인지 확인.
- 위키/로그/스냅샷 같은 다른 화면의 동일 ID 노출도 일관되는지 확인.
