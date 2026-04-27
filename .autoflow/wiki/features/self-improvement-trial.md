# Self-Improvement Trial Runner

## Overview
The **Log-driven self-improvement trial runner** is a time-boxed experimental runtime route designed to analyze accumulated Autoflow logs and state, detecting repeated operational problems to propose evidence-backed improvements.

## Behavior
- **Interval and Limits**: The trial runs every 30 minutes for a maximum duration of 3 hours, or a maximum of 6 ticks.
- **Analysis Scope**: Analyzes logs, runner states, and rejected/in-progress tickets to identify recurring error patterns, blocks, memory issues, token overuse, or verification failures.
- **Candidate Generation**: 
  - Groups issues by stable fingerprints to prevent duplicate work.
  - Generates an improvement candidate (PRD/TODO/ticket-owner handoff) only when an issue exceeds a configured threshold.
  - Deduplicates against existing open PRDs, TODO tickets, and recent self-improvement logs.
- **Risk Assessment**:
  - Low-risk candidates are routed to the automated improvement path.
  - High-risk candidates are marked as `recommend_only` and require manual intervention (no automatic implementation).
- **Safety Constraints**:
  - The runner must never execute `git push`.
  - Mutations are skipped if the repository has unsafe dirty overlaps, active merge/rebase/cherry-pick states, or conflicting active ticket work.

## Origins
- **Design Handoff**: Introduced via a conversation handoff to establish a safe, bounded experiment in app evolution, rather than an infinite autonomous system (`conversations/prd_022/spec-handoff.md`).
