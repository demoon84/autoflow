# Autoflow Memo

## Memo

- ID: memo_020
- Title: Demote append_note bookkeeping spam in common.sh
- Status: inbox
- Created At: 2026-04-29T06:30:17Z
- Source: autoflow memo create

## Request

runtime/board-scripts/common.sh:1143 (append_note) is called from many bookkeeping sites that produce no decision-relevant context, e.g. common.sh:409,431,527,1409,1436,1458,1469,1551,1568,1597,1616,1627,2045 plus start-ticket-owner.sh:406 'AI worker-1 prepared resume at...' on every resume tick. Sample done ticket .autoflow/tickets/done/prd_044/tickets_044.md has 18 Notes lines, ~half are 'Runtime hydrated worktree dependency', 'AI worker-1 prepared todo/resume', 'Coordinator post-merge cleanup' lines that the AI never needs. The full Notes section ships in every adapter prompt because the ticket file is the primary context.

Proposal: split into 'AI Notes' (decision/finding by AI) vs 'Runtime Log' (machine bookkeeping). Adapter prompts only need AI Notes; Runtime Log can live in the run file or be capped to last 3 entries. Or: collapse runtime-only entries into one 'last machine action: <line>' field. Expected savings: ~150-300 tokens per ticket-owner tick on long-running tickets.

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
