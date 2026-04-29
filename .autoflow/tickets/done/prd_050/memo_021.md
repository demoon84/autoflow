# Autoflow Memo

## Memo

- ID: memo_021
- Title: Add change-gate and per-page truncation to wiki semantic lint
- Status: inbox
- Created At: 2026-04-29T06:31:06Z
- Source: autoflow memo create

## Request

packages/cli/wiki-project.sh:557-572 (run_semantic_lint) finds every wiki/*.md and ships sed -n '1,220p' of each page into the Wiki AI adapter prompt every tick. Today the project has 31 wiki pages (~921 lines). Wiki AI ticks every minute (per AGENTS.md topology); current coordinator-project.sh:10 docs say lint --semantic runs as part of wiki-1's tick. There is no detected change-gate before re-shipping the same 921 lines.

Proposal: (1) hash wiki/ tree (file mtime+size manifest) and skip run_semantic_lint when unchanged since last successful synth; (2) shorten per-page slice to first ~80 lines OR replace with a digest header + 'recent diff vs prior synth'. Expected savings: ~20-50k tokens per Wiki AI idle minute (zero wiki delta between most ticks).

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
