# Planner Next-Action Cues

## Overview

Planner runtime `next_action=` output should stay concise and point back to the existing planner role instructions instead of repeating the full memo-promotion contract on every tick.

## Current Constraints

- `prd_045` shortened the static `next_action=` strings in both `.autoflow/scripts/start-plan.sh` and `runtime/board-scripts/start-plan.sh`.
- The change is limited to natural-language cue text for reject replan, memo inbox, backlog-to-todo, and legacy-plan branches.
- Machine-readable keys and branch outputs such as `status=`, `source=`, and emitted path/id values remain part of the contract and must not change with prompt-token optimizations.
- The memo-inbox branch must remain a planner directive and must not regress into a question loop.

## Reusable Guidance

- Treat runtime output wording as an acceptance surface when `packages/cli/run-role.sh` forwards `runtime_output` into planner prompts.
- Prefer short cues that reference stable role instructions like `plan-to-ticket-agent.md` over embedding long policy text in recurring runtime output.
- Keep current-board and source-runtime copies aligned when planner runtime scripts exist in both `.autoflow/scripts/` and `runtime/board-scripts/`.

## Sources

- `tickets/done/prd_045/tickets_045.md`
- `tickets/done/prd_045/verify_045.md`
- `tickets/done/prd_045/prd_045.md`
- Related context: [[features/run-role-prompt-dispatch]]
