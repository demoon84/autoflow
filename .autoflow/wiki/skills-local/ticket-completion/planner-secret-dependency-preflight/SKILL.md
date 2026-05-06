---
name: "planner-secret-dependency-preflight"
description: "planner secret dependency preflight"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/start-plan.sh"
  keywords:
    - "planner"
    - "secret"
    - "dependency"
    - "preflight"
    - "autoflow"
    - "scripts"
    - "start"
    - "plan"
    - "runtime"
    - "board"
    - "common"
    - "agents"
pinned: false
created_from:
  prd: "prd_187"
  ticket: "tickets_186"
created_at: "2026-05-06T00:54:50Z"
---

# planner secret dependency preflight

## Trigger

- Reuse when: planner secret dependency preflight
- Source ticket: `tickets/done/prd_187/tickets_186.md`

## Recommended Procedure

- A fixture PRD whose `## Verification` `Command:` references `$ANTHROPIC_API_KEY` with that env var unset causes `start-plan.sh` to exit `0`, emits `source=needs-user-secret`, `missing_secrets=ANTHROPIC_API_KEY`, `recovery_state=needs_user`, and creates no `tickets/todo/tickets_*.md`.
- The same fixture PRD is updated in backlog with `Status: needs_user_secret` and exactly one idempotent `## Notes` entry naming the missing variable and source PRD path after two repeated planner runs with the env var unset.
- When `ANTHROPIC_API_KEY=dummy` is provided for the fixture run, `start-plan.sh` creates one todo ticket from the same PRD and the ticket `Verification.Command` remains unchanged.
- A fixture PRD that mentions `ANTHROPIC_API_KEY` only in explanatory prose but not in `Verification.Command` or `Requires Secrets` is promoted to todo and is not parked as `needs_user_secret`.
- A fixture PRD with explicit `Requires Secrets: [OPENAI_API_KEY]` or YAML `requires_secrets: [OPENAI_API_KEY]` is parked when `OPENAI_API_KEY` is unset and promotes when it is set.

## Pitfalls

- Secret detection intentionally ignores explanatory prose outside `Verification.Command` and explicit metadata to avoid false positives.

## Verification Pattern

- Command: ```bash -lc 'bash -n .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh tests/smoke/planner-secret-preflight-smoke.sh && bash tests/smoke/planner-secret-preflight-smoke.sh'```

## Source Evidence

- Ticket: `tickets/done/prd_187/tickets_186.md`
- PRD: `tickets/done/prd_187/prd_187.md`
- Verification: `tickets/done/prd_187/verify_186.md`
- Result summary: planner secret dependency preflight
