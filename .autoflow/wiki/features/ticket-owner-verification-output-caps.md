# Ticket-Owner Verification Output Caps

## Overview

Successful `verify-ticket-owner.sh` runs now keep the run file compact by capping pass-path stdout/stderr excerpts separately from failure diagnostics.

## Current Constraints

- `prd_047` introduced a dedicated pass cap via `AUTOFLOW_VERIFY_PASS_OUTPUT_LINES`, instead of reusing the larger `AUTOFLOW_VERIFY_OUTPUT_LINES` window.
- When a successful stream exceeds the pass cap, the run file keeps `### stdout` and `### stderr` but stores first/last excerpts with an explicit omitted-lines marker.
- Failure output keeps the larger diagnostic tail so same-turn debugging still has enough context.
- `.autoflow/scripts/verify-ticket-owner.sh` and `runtime/board-scripts/verify-ticket-owner.sh` must stay behaviorally aligned because `finish-ticket-owner.sh` still reads the same pending run-file format.

## Reusable Guidance

- Treat verification run-file size as part of adapter prompt hygiene, because successful verification evidence is fed back into later finish/finalization turns.
- Optimize only the pass path when reducing token load; preserve broader failure context unless a ticket explicitly changes the debug contract.
- Keep the run-file section shape stable when compacting output so downstream readers can continue parsing `## Output`, `### stdout`, and `### stderr` without migration work.

## Citations

- Source: `tickets/done/prd_047/tickets_047.md`
- Verification: `tickets/done/prd_047/verify_047.md`
- PRD: `tickets/done/prd_047/prd_047.md`
