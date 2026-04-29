# Run-Role Prompt Dispatch

## Overview

The runtime copy of `run-role.sh` now emits only the role boundary and required-flow text relevant to the current runner role, matching the CLI source for the prompt-dispatch helper block.

## Behavior

- `runtime/board-scripts/run-role.sh` uses `role_boundary_for_current_role` so prompt boundaries are scoped to the active role instead of listing every role.
- `role_specific_required_flow_items` limits merge-judgment text to ticket-owner prompts and keeps wiki-context flow scoped to planner/ticket/todo style work.
- Dry-run prompt output is part of the acceptance surface, so prompt-shape regressions can be checked without executing a full runner turn.
- Follow-up runtime trimming kept the same acceptance-surface rule for adjacent scripts: `prd_045` shortened planner `next_action=` cues in both `start-plan.sh` copies, and `prd_046` collapsed ticket-owner routing output to one concise `next_action=` cue while removing `routing_verify=`, `routing_pass=`, and `routing_fail=` from both `start-ticket-owner.sh` copies.

## Reusable Constraints

- Keep `packages/cli/run-role.sh` as the source pattern for role-specific prompt dispatch and mirror only the relevant helper block into `runtime/board-scripts/run-role.sh`.
- Do not delete the runtime copy while `runtime/board-scripts/runners-project.sh` still invokes `${SCRIPT_DIR}/run-role.sh`.
- When the two files still differ elsewhere, verify the helper block diff and role-specific dry-run prompt behavior instead of forcing unrelated byte-for-byte parity.
- Treat runtime key/value output shape as a user-visible contract: shorten natural-language cues only, preserve machine-readable status/path keys, and keep `.autoflow/scripts/` and `runtime/board-scripts/` copies aligned.

## Citations

- Source: `tickets/done/prd_044/tickets_044.md`
- Verification: `tickets/done/prd_044/verify_044.md`
- PRD: `tickets/done/prd_044/prd_044.md`
- Follow-up sources: `tickets/done/prd_045/tickets_045.md`, `tickets/done/prd_046/tickets_046.md`
