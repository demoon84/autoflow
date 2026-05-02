# Autoflow Memo

## Memo

- ID: memo_022
- Title: Extend maybe_skip_unchanged_wiki_turn pattern to Plan/Impl AI idle ticks
- Status: inbox
- Created At: 2026-04-29T06:32:24Z
- Source: autoflow memo create

## Request

packages/cli/run-role.sh:243 (maybe_skip_unchanged_wiki_turn) skips the entire adapter call when wiki inputs are unchanged. Same script gates by role at line 246 ('[ "$public_role" = "wiki" ] || return 1'), so Plan AI (planner-1) and Impl AI (owner-1) never benefit.

When start-plan.sh exits with status=idle reason=no_actionable_plan_input (line 416-421) AND start-ticket-owner.sh exits with status=idle reason=no_actionable_ticket (line 505-509), the runner still calls write_agent_prompt and ships the full adapter prompt for the AI to confirm 'nothing to do'. With 1-min ticks and many idle minutes, this is pure waste.

Proposal: add maybe_skip_unchanged_planner_turn / maybe_skip_unchanged_ticket_turn that fingerprint .autoflow/tickets/{inbox,backlog,reject,todo,inprogress}/ and skip adapter when unchanged + last preflight was idle. Expected savings: ~1-2k tokens per idle minute per runner = ~3-6M tokens/day across both runners during quiet periods.

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
