# Autoflow Memo

## Memo

- ID: memo_058
- Title: TODO 레이어 레이아웃 깨짐 수정
- Status: inbox
- Created At: 2026-05-01T21:20:33Z
- Source: autoflow memo create

## Request

레이아웃 깨짐 버그 수정

첨부 스크린샷 기준:
- TODO (6/6) 레이어에서 ticket-088~ticket-083 목록 row의 둥근 배경/구분선과 텍스트가 세로로 겹쳐 보임.
- ticket 제목, TODO badge, 날짜가 한 줄 안에서 지나치게 압축되어 읽기 어렵고 하단 row가 레이어 아래쪽과 붙어 보임.
- TODO 핀 레이어 목록이 적절한 row 높이/간격/텍스트 줄바꿈 또는 말줄임으로 깨지지 않게 표시되어야 함.

## Hints

### Scope

- 데스크톱 앱 작업 흐름 TODO 핀 레이어의 목록 item 레이아웃이 스크린샷처럼 row 높이/간격이 압축되어 텍스트, badge, 날짜, border가 겹치는 문제를 수정한다. ORDER/PRD/reject 핀 레이어와 티켓 본문 열기 동작은 회귀하지 않게 유지한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
