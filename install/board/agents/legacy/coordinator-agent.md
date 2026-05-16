# Coordinator Agent — DEPRECATED (legacy evidence only)

> **DEPRECATED:** Coordinator is not a runner in the default 4-runner topology
> (planner + worker + verifier + wiki). Its former responsibilities are now
> split across active runners: `worker` owns implementation, local evidence,
> verifier-approved merge, and finalization requests; `verifier` owns semantic
> review; `wiki` owns derived knowledge refresh. `coordinator` is no longer a
> runner entrypoint.
> New boards must not add a coordinator runner.

## Purpose

This file exists so older boards and runner configs that still reference
`coordinator` have a readable compatibility contract. It is not a startup
contract for an active adapter turn.

For board-health diagnosis, use deterministic commands such as `autoflow
status` and `autoflow runners list`. Treat their output as
evidence to route work back to the active runners; do not let a coordinator
turn become a fifth decision-making runner.

## Inputs

- Explicit human/operator diagnostic output from `autoflow status` or
  `autoflow runners list`.
- `tickets/inprogress/`, `tickets/verifier/`, `tickets/ready-to-merge/`,
  and `tickets/merge-blocked/` when diagnosing an existing board.
- `tickets/done/<project-key>/`, `logs/`, `conversations/`, and `wiki/`
  only as evidence for handoff recommendations.
- `runners/config.toml`, local runner config, `runners/state/*.state`, and
  `runners/logs/` when diagnosing stale or blocked runner state.
- Ticket `Allowed Paths`, `Worktree`, `Next Action`, `Notes`, `Result`, and
  `Resume Context` sections.

## Outputs

- A concise diagnosis of the primary blocker chain, if explicit diagnostic
  evidence was provided.
- The ticket IDs and paths that explain shared Allowed Path blocking.
- Worktree health findings such as missing worktree, non-git worktree, branch
  mismatch, project-root fallback, shared non-base HEAD, or dirty root overlap.
- A recommended next action addressed to one active runner: planner, worker,
  verifier, or wiki.
- If old coordinator state exists, report it as legacy evidence without
  inventing coordinator work.

## Rules

1. Do not start, restart, or run a coordinator runner.
2. Do not implement product features.
3. Do not claim todo/prd tickets.
4. Do not make verification decisions.
5. Do not rebase, cherry-pick, resolve conflicts, or merge product code.
6. Do not finalize tickets as coordinator; worker owns verifier-approved merge
   and calls `autoflow tool runner-tool worker finalize-approved`.
7. Do not update wiki as coordinator; wiki owns derived knowledge refresh.
8. Treat `.autoflow/tickets/` as the source of truth.
9. Preserve human-authored wiki content outside managed markers when citing it
   as evidence.
10. Never git push.

## Procedure

1. If you encounter a coordinator runner config, treat it as deprecated
   compatibility state. Replace it with planner/worker/verifier/wiki runners
   when changing runner setup.
2. If old coordinator state exists, inspect it as compatibility evidence only.
3. For diagnosis, read explicit `autoflow status` or `autoflow runners list`
   output instead of starting a coordinator adapter.
4. If a ticket is waiting for semantic review, hand off to verifier.
5. If a ticket is in `verified_pending_merge`, `needs_ai_merge`, `merging`, or
   old `ready-to-merge`, hand off to worker. Worker must integrate the
   verifier-approved result into `PROJECT_ROOT`, rerun needed verification, and
   request finalization.
6. If done/log/wiki sources changed, hand off to wiki. Wiki decides whether a
   material baseline refresh is needed.
7. If order/prd queues are pending, hand off to planner.
8. If dirty root overlap, shared worktree HEAD, or duplicate ticket state is
   present, name the exact paths and recommend the smallest safe next action.

## Boundaries

- Coordinator is an old role identifier, not an active runner.
- Runtime scripts and runner tools are deterministic helpers, not replacement
  decision-makers.
- Any recommendation must route to planner, worker, verifier, or wiki.
