---
name: "runner-commit-volume-throttle"
description: "Use when runner commit volume throttle"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/start-plan.sh"
  keywords:
    - "runner"
    - "commit"
    - "volume"
    - "throttle"
    - "autoflow"
    - "scripts"
    - "start"
    - "plan"
    - "runtime"
    - "board"
    - "packages"
    - "cli"
pinned: false
created_from:
  prd: "prd_172"
  ticket: "tickets_171"
created_at: "2026-05-05T02:08:43Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# runner commit volume throttle

## Trigger

- Reuse when: runner commit volume throttle
- Source ticket: `tickets/done/prd_172/tickets_171.md`

## Recommended Procedure

- A planner blocked-dirty orchestration tick with multiple board/runtime dirty paths creates no more than one housekeeping cleanup commit for that tick unless a mechanical git conflict forces a split and the reason is logged.
- A telemetry-only dirty set such as `.autoflow/telemetry/runs.jsonl` plus runtime/check markdown does not create one commit per path or one commit per telemetry line.
- Wiki debounce logic does not trigger a wiki commit solely because `wiki/operations/runner-timing.md`, `wiki/operations/runner-health.md`, and `wiki/agents/prompt-evolution.md` were refreshed from telemetry summaries.
- Meaningful wiki source changes from done/reject/backlog/order content still trigger wiki update after the configured debounce threshold or max age.
- Adapter timeout / SIGTERM / output truncation evidence in `packages/cli/run-role.sh` is classified in runner logs so a normal adapter finish is distinguishable from timeout cleanup.

## Pitfalls

- Runtime `wiki-project.sh` is a wrapper in installed templates; deeper behavioral tests for live loop commit volume require post-merge runner observation, but deterministic shell verification and root recheck passed.

## Verification Pattern

- Command: ``bash -lc 'bash -n .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/wiki-project.sh runtime/board-scripts/wiki-project.sh && grep -n "orchestration cleanup\\|dirty_paths\\|blocked-dirty" .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh && grep -n "output_truncated\\|adapter_finish\\|adapter_timeout\\|SIGTERM\\|kill_after" packages/cli/run-role.sh runtime/board-scripts/run-role.sh && grep -n "DEBOUNCE\\|runner-timing\\|runner-health\\|prompt-evolution\\|metric" packages/cli/wiki-project.sh runtime/board-scripts/wiki-project.sh'``

## Source Evidence

- Ticket: `tickets/done/prd_172/tickets_171.md`
- PRD: `tickets/done/prd_172/prd_172.md`
- Verification: `tickets/done/prd_172/verify_171.md`
- Result summary: runner commit volume throttle implemented and verified
