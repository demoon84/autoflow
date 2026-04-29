# Autoflow Memo

## Memo

- ID: memo_018
- Title: Cap verification stdout+stderr in run files for token budget
- Status: inbox
- Created At: 2026-04-29T06:29:00Z
- Source: autoflow memo create

## Request

runtime/board-scripts/verify-ticket-owner.sh:182-192 inlines tail -n ${AUTOFLOW_VERIFY_OUTPUT_LINES:-200} of BOTH stdout AND stderr into the run file Output section (so up to ~400 lines per verify). The same run file is read back during finish (see finish-ticket-owner.sh:518-519 'pending_run_path') and ends up in adapter context. Verbose test runners (vitest, npm test) often dump 1k+ lines, so each line over the cap is silently kept up to 200.

Proposal: lower the default to ~50 lines per stream (or a combined byte cap), and on pass shrink Output to first/last 20 lines + 'truncated' marker. Failure paths can keep the larger window since AI needs more context only when fixing. Expected savings: ~500-2000 tokens per successful verify on noisy projects.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
