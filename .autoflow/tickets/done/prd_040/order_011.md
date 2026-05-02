# Autoflow Memo

## Memo

- ID: memo_011
- Title: Remove unsupported Gemini 3.1 model options
- Status: inbox
- Created At: 2026-04-28T20:51:57Z
- Source: autoflow memo create

## Request

gemini 선택 모델중에 3.1은 지원모델이 아니라서 선택목록에서 삭제

## Hints

### Scope

- Remove unsupported Gemini 3.1 entries from the Desktop runner model selection list.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

### Verification

- Command: npm --prefix apps/desktop run check

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
