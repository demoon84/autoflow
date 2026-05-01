---
id: memo_043
title: 티켓 디테일 레이어 메타 그리드 한 줄 표시
status: inbox
created: 2026-05-01
---

## Request

레이어 박스 디자인이 1줄로 나와야 함 빈공간이 너무 많음

(첨부 스크린샷: 티켓 디테일 레이어 상단의 메타 박스들. 현재 ID / PRD KEY / STAGE 가 1행, WORKER / LAST UPDATED 가 2행으로 3-column 그리드로 그려져 있어, 두 번째 행 오른쪽 칸은 비어 있고 전체 높이가 두 줄을 차지함. 사용자는 이 박스들을 한 줄(가로 1행) 로 합쳐 빈 공간을 줄이길 원함.)

## Notes

- React 위치: `apps/desktop/src/renderer/main.tsx:3920-3991` 의 `TicketDetailLayer` 컴포넌트. `metaRows` 가 `ID, PRD Key, Stage, Worker, Claimed By, Last Updated` 까지 최대 6개 항목을 만들고 `<dl className="ticket-detail-layer-meta">` 로 렌더링.
- CSS 위치: `apps/desktop/src/renderer/styles.css:3023` `.ticket-detail-layer-meta { grid-template-columns: repeat(3, ...); }`. 3열 고정이라 항목 수가 4~6개일 때 마지막 행이 비어 두 줄로 보임. 760px 이하에서는 1열로 떨어지는 미디어 쿼리만 있음.
- 의도된 표시:
  - 항목들을 한 행에 가로로 펼쳐서 빈 칸 없이 채운다.
  - 화면이 좁을 때만 줄바꿈/축약(`flex-wrap` 또는 가로 스크롤) 되도록 한다.
- 대안 1: `display: flex; flex-wrap: nowrap; overflow-x: auto;` + 각 박스 `flex: 1 1 0; min-width: 0;` 로 한 줄 강제.
- 대안 2: `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));` 처럼 항목 수에 따라 자동 채움.
- 박스 안 텍스트는 이미 `text-overflow: ellipsis; white-space: nowrap;` 처리되어 있어 한 줄 압축 시에도 단일 라인 표시 가능.
- Plan AI 가 정확한 구현 방식을 결정. 좁은 폭에서의 회귀(겹침/잘림) 도 함께 검토.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (`TicketDetailLayer`)
  - `apps/desktop/src/renderer/styles.css` (`.ticket-detail-layer-meta`, `.ticket-detail-layer-meta div`, 760px 미디어 쿼리)

## Verification hint

- 데스크톱 앱에서 티켓 카드를 눌러 디테일 레이어를 띄우고 메타 박스들이 한 줄로 정렬되는지, 두 번째 빈 행이 사라졌는지 확인.
- 항목 수가 적은 경우(예: 메모) 와 많은 경우(예: 진행 중 ticket 으로 Claimed By 까지 표시되는 경우) 모두 깨지지 않는지 확인.
- 좁은 폭(노트북 기본 ~1280, 좁은 창 ~960) 에서 텍스트가 잘리거나 박스가 깨지지 않는지 확인.
