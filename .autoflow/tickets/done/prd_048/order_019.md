# Autoflow Memo

## Memo

- ID: memo_019
- Title: Suppress inline_merge_output on success in finish-ticket-owner.sh
- Status: inbox
- Created At: 2026-04-29T06:29:25Z
- Source: autoflow memo create

## Request

runtime/board-scripts/finish-ticket-owner.sh:601-634 dumps the full stdout+stderr of merge-ready-ticket.sh (a 750-line script that runs deterministic update-wiki.sh, integration checks, log writes) verbatim between 'inline_merge.output_begin' and 'inline_merge.output_end' markers on every pass finish - including the happy 'status=done' path. The wiki/log output adds ~30-100 lines per finish. This stream lands in the adapter prompt via run-role.sh:1273.

Proposal: when inline_merge_exit==0 AND inline_merge_status==done, replace the begin/end block with one summary line ('inline_merge=done; wiki+log written'). Keep full output only on needs_ai_merge / blocked / non-zero exit where the AI actually needs to debug. Expected savings: ~200-500 tokens per successful Impl AI ticket completion.

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
