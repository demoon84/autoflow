# Autoflow Memo

## Memo

- ID: memo_005
- Title: Replace AI-1 labels with worker
- Status: ready
- Created At: 2026-04-28T14:43:05Z
- Source: autoflow memo create

## Request

AI-1 으로 되어 있는 모든 표기 코드포함 worker로 변경

## Hints

### Scope

- worker display naming policy across UI, runtime, docs, and code; reconcile existing AI-N display policy

### Allowed Paths

- `apps/desktop/src`
- `runtime/board-scripts`
- `packages/cli`
- `scaffold`
- `.autoflow`

### Verification

- Command: npm run desktop:check

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.

## Planner Resolution

- User clarified on 2026-04-29 that memo requests are implementation directives and must not become planner question loops. Treat this memo as an intentional request to replace `AI-1`/`AI-N` user-visible worker attribution policy and stale literal labels with `worker` wording where in scope, while preserving internal storage identifiers such as `owner-1`, runner state filenames, runtime role keys, and config IDs.

## Planner Notes

- Previous planner turns repeatedly left this memo in `needs-info` because the older contract allowed ambiguity questions and the runtime ignored `Status: needs-info` as non-actionable input. That loop was collapsed on 2026-04-29 after the user clarified that memo intake is directive-only.
