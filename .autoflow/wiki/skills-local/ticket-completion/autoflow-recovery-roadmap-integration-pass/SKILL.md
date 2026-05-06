---
name: "autoflow-recovery-roadmap-integration-pass"
description: "autoflow recovery roadmap integration pass"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/start-plan.sh"
  keywords:
    - "autoflow"
    - "recovery"
    - "roadmap"
    - "integration"
    - "pass"
    - "scripts"
    - "start"
    - "plan"
    - "common"
    - "ticket"
    - "owner"
    - "runtime"
pinned: false
created_from:
  prd: "prd_176"
  ticket: "tickets_175"
created_at: "2026-05-05T13:31:36Z"
---

# autoflow recovery roadmap integration pass

## Trigger

- Reuse when: autoflow recovery roadmap integration pass
- Source ticket: `tickets/done/prd_176/tickets_175.md`

## Recommended Procedure

- `rg -n "blocked-cleanup|fixpoint|tickets/check|ticket_stage_blocked" .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh packages/cli/run-role.sh` returns evidence for check-ledger live-lock prevention and stale worker-state reset hooks, or the ticket records why the existing PRD/ticket coverage is sufficient without a new patch.
- `rg -n "needs_user|repairing|Recovery State|active_item" .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh packages/cli/run-role.sh` returns evidence for parked `needs_user` / stale `repairing` handling, or the ticket records the exact missing path fixed in this integration pass.
- `rg -n "ticket_stage_blocked|verify_.*md|self-refresh|dirty" .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/start-ticket-owner.sh packages/cli/run-role.sh` returns evidence that active ticket markdown self-refresh does not remain the only blocker signal.
- `rg -n "loop-worker|worktree|orphan|runner-common|process group|kill" packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh` returns evidence for worktree-bound runner cleanup or self-exit handling. If the implementation uses a non-`kill` guard, the ticket explains the exact function and state key.
- `rg -n "DEBOUNCE|runner-timing|runner-health|prompt-evolution|output_truncated|adapter_finish|adapter_timeout|SIGTERM" packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/wiki-project.sh runtime/board-scripts/wiki-project.sh` returns evidence for commit-throttle, wiki debounce, and adapter timeout classification.

## Pitfalls

- Source inference uses the most recently modified `tickets/done/prd_*/{tickets_*.md,prd_*.md}` when staged wiki paths lack a direct `prd_NNN`; if none exists, the subject explicitly records `[source: unknown]`.

## Verification Pattern

- Command: ``bash -lc 'bash -n .autoflow/scripts/start-plan.sh .autoflow/scripts/common.sh .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/start-plan.sh runtime/board-scripts/common.sh runtime/board-scripts/start-ticket-owner.sh packages/cli/run-role.sh packages/cli/runners-project.sh packages/cli/wiki-project.sh runtime/board-scripts/run-role.sh runtime/board-scripts/runners-project.sh runtime/board-scripts/wiki-project.sh && node --check apps/desktop/src/main.js && bin/autoflow guard && rg -n "ticket_stage_blocked|needs_user|repairing|loop-worker|DEBOUNCE|output_truncated|selfHealStoppedRunnersForScope" .autoflow/scripts/start-plan.sh .autoflow/scripts/start-ticket-owner.sh packages/cli/run-role.sh packages/cli/runners-project.sh packages/cli/wiki-project.sh runtime/board-scripts/start-plan.sh runtime/board-scripts/start-ticket-owner.sh runtime/board-scripts/run-role.sh runtime/board-scripts/runners-project.sh runtime/board-scripts/wiki-project.sh apps/desktop/src/main.js'``

## Source Evidence

- Ticket: `tickets/done/prd_176/tickets_175.md`
- PRD: `tickets/done/prd_176/prd_176.md`
- Verification: `tickets/done/prd_176/verify_175.md`
- Result summary: wiki autocommit source attribution fallback
