# Autoflow Memo

## Memo

- ID: memo_059
- Title: Worker 행 flex 중앙 정렬
- Status: inbox
- Created At: 2026-05-01T22:19:08Z
- Source: autoflow memo create

## Request

flex로 묶고 중앙 정렬

첨부 스크린샷 기준:
- Worker 행에서 아이콘, Worker 라벨, 토큰 사용량 텍스트, 우측 체크박스가 같은 행에 보임.
- 라벨/토큰 사용량 영역을 flex로 묶고 세로 중앙 정렬해 텍스트 baseline과 control 위치가 어색하게 어긋나지 않게 한다.
- 긴 토큰 사용량 텍스트가 있어도 행 높이와 좌우 간격이 안정적으로 유지되어야 한다.

## Hints

### Scope

- 데스크톱 앱 AI 진행/Worker row 헤더의 라벨과 토큰 사용량 표시를 flex 기반으로 정렬하고, 행 내부 요소가 세로 중앙에 맞도록 CSS/markup을 최소 수정한다. 기존 체크박스 동작, runner 선택/제어 동작은 유지한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
