# Autoflow Memo

## Memo

- ID: memo_017
- Title: Collapse routing_*/next_action duplicates in start-ticket-owner.sh
- Status: inbox
- Created At: 2026-04-29T06:28:36Z
- Source: autoflow memo create

## Request

runtime/board-scripts/start-ticket-owner.sh:422-425 emits four back-to-back long English directives every Impl AI tick: next_action (~50 words), routing_verify (~45), routing_pass (~55), routing_fail (~30). All four restate rules already in .autoflow/agents/ticket-owner-agent.md (e.g. 'AI owns merge', 'never push', 'finish-ticket-owner.sh is finalization tool only'). They flow into the adapter prompt via packages/cli/run-role.sh:1273.

Proposal: keep one short cue line (e.g. 'next_action=ticket-owner-agent.md flow for ticket %s') and drop routing_verify/pass/fail emission; the agent file is already loaded as Role instruction file. Expected savings: ~150 tokens per Impl AI tick = ~200k tokens/day at 1-min cadence.

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
