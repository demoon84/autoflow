# PRD Handoff

- Project: project_022
- Spec: tickets/backlog/prd_022.md
- Source: autoflow spec create

## Conversation Summary

```text
# Project PRD

## Project

- ID: prd_022
- Title: Log-driven self-improvement trial runner
- AI:
- Status: draft

## Core Scope

- Goal: Build a limited self-improvement trial runner that analyzes accumulated Autoflow logs and runner state every 30 minutes for up to 3 hours, detects repeated operational problems, and turns only evidence-backed low-risk findings into a PRD/TODO/ticket-owner improvement path.
- In Scope:
  - Add a trial self-improvement runner or runtime route.
  - Default interval: 30 minutes.
  - Maximum trial duration: 3 hours.
  - Maximum tick count: 6.
  - Analyze `.autoflow/logs/`, `.autoflow/runners/logs/`, `.autoflow/tickets/reject/`, `.autoflow/tickets/inprogress/`, and runner state files.
  - Detect repeated error, blocked, reject, timeout, memory, token overuse, or verification-failure patterns.
  - Create an improvement candidate only when the same issue pattern crosses a configured threshold.
  - For each candidate, record source log paths, occurrence count, impact, suspected cause, risk level, and proposed allowed paths.
  - Deduplicate against existing open PRDs, TODO tickets, in-progress tickets, and recent self-improvement logs.
  - Route low-risk candidates to a PRD/TODO/ticket-owner handoff path.
  - Record high-risk candidates as `recommend_only` and do not implement them automatically.
  - Write durable tick logs under `.autoflow/logs/self-improve_*.md`.
- Out of Scope:
  - Infinite autonomous improvement loops.
  - Reason-free refactors or cosmetic changes without log evidence.
  - Automatic `git push`.
  - Destructive cleanup or deleting failure logs.
  - Automatic merge-conflict resolution.
  - Large dependency upgrades or broad architecture rewrites.
  - Product-code changes outside the generated candidate's Allowed Paths.

## Main Screens / Modules

- Module: Self-improvement runtime and runner integration
- Path: `packages/cli/`
- Path: `runtime/board-scripts/`
- Path: `scaffold/board/`
- Path: `.autoflow/runners/config.toml`
- Path: `.autoflow/automations/`
- Path: `.autoflow/logs/`
- Path: `tests/smoke/`

## Global Rules

- Allowed Paths are relative to the host project root.
- Verification commands run from the host project root unless a ticket says otherwise.
- Keep acceptance criteria observable.
- The trial must stop after 3 hours or 6 ticks, whichever comes first.
- One tick may process at most one candidate.
- Every candidate must cite source logs or ticket files.
- No source evidence means no candidate.
- High-risk candidates must be recommendation-only.
- The runner must never run `git push`.
- The runner must skip mutation when git is in rebase/merge/cherry-pick state or when active tickets/merge work would make the change unsafe.

## Global Acceptance Criteria

- [ ] A self-improvement trial runner/config exists with `interval_seconds=1800`, `max_duration_seconds=10800`, and `max_ticks=6` or equivalent settings.
- [ ] Each tick reads recent logs and runner/ticket state, then records a durable `self-improve` log with status, reason, and evidence summary.
- [ ] Repeated issues are grouped by stable fingerprints so noisy logs do not create duplicate PRDs or tickets.
- [ ] A candidate is created only when a fingerprint crosses the configured threshold.
- [ ] Candidate output includes source log paths, occurrence count, impact, suspected cause, risk level, proposed allowed paths, and proposed verification command.
- [ ] Existing open PRDs/tickets and recent self-improvement logs are checked before creating new work.
- [ ] Low-risk candidates can be handed to PRD/TODO/ticket-owner flow.
- [ ] High-risk candidates are logged as `recommend_only` and are not implemented automatically.
- [ ] If the repo has unsafe dirty overlap, active merge/rebase/cherry-pick, or active conflicting ticket work, the tick skips mutation and records the skip reason.
- [ ] After 3 hours or 6 ticks, the runner no longer creates or mutates work and records `status=expired` or equivalent.
- [ ] No path in the flow executes `git push`.

## Verification

- Command: `bash tests/smoke/log-driven-self-improvement-smoke.sh`
- Command: `npm --prefix apps/desktop run check`
- Notes: Smoke coverage should include no-log idle, repeated-pattern candidate creation, duplicate suppression, high-risk recommend-only, unsafe dirty-skip, and trial expiry.

## Conversation Handoff

- Source: 2026-04-27 chat
- Summary: User clarified that self-upgrade means log-driven app evolution: inspect accumulating logs, find repeated problematic areas, and improve those parts safely. The requested experiment should run every 30 minutes for about 3 hours, not indefinitely.

## Notes

- This is intentionally a trial runner, not a permanent autonomous system.
- Start with conservative detection rules and small, auditable candidates.
- Useful first fingerprints may include repeated `blocked`, repeated verifier failures for the same command, repeated runner model/config failures, recurring memory/metrics spikes, and repeated token-heavy log patterns.
```
