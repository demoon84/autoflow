# Autoflow Memo

## Memo

- ID: memo_054
- Title: 위키 문서 뷰어 모드
- Status: inbox
- Created At: 2026-05-01T00:10:32Z
- Source: autoflow memo create

## Request

위키 문서 보기는 뷰어 모드로 보여줘

## Hints

### Scope

- 데스크톱 앱의 Wiki 문서 상세/미리보기는 편집형 또는 콘솔형 표시가 아니라 읽기 전용 viewer mode로 표시한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/markdown-viewer.tsx`

### Verification

- Command: cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
