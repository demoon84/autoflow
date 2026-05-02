# Autoflow Memo

## Memo

- ID: memo_016
- Title: Trim verbose next_action strings in start-plan.sh
- Status: inbox
- Created At: 2026-04-29T06:28:17Z
- Source: autoflow memo create

## Request

runtime/board-scripts/start-plan.sh emits long static next_action= instruction strings every plan tick (line 380 ~60-word memo-intake directive, line 366 reject-replan, line 395 backlog-to-todo, line 410 legacy-plan). Each emitted runtime_output is shipped verbatim to the planner adapter prompt by packages/cli/run-role.sh:1273 (cat runtime_output). The memo-intake directive in particular re-explains 'do not turn into a question loop', 'infer narrow scope', etc., which already lives in .autoflow/agents/plan-to-ticket-agent.md.

Proposal: shrink each next_action= to a 1-line cue (e.g. 'Promote inbox memo %s; see plan-to-ticket-agent.md.') and let the agent instruction file carry the steady-state contract. Expected savings: ~50-80 tokens per planner tick, scales to ~100k tokens/day at 1-min cadence.

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
