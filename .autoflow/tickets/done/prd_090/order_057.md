# Autoflow Memo

## Memo

- ID: memo_057
- Title: 사이드바 메뉴명 변경
- Status: inbox
- Created At: 2026-05-01T00:32:12Z
- Source: autoflow memo create

## Request

메뉴명 변경
작업 => AI 대쉬보드
Tickets => 티켓
Wiki => LLM 위키

## Hints

### Scope

- 데스크톱 앱 좌측 사이드바 메뉴 라벨을 요청한 문구로 변경한다: 작업은 'AI 대쉬보드', Tickets는 '티켓', Wiki는 'LLM 위키'로 표시한다. 기존 아이콘, 라우팅 key, 통계/로그 메뉴는 유지하고, 변경된 긴 라벨이 사이드바에서 잘리지 않거나 겹치지 않게 확인한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
