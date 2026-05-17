# Runner And Runner Tool Contract

This file is the canonical contract between Autoflow runners and runner tools.
When another document describes the same boundary, this file wins.

## Terms

- **Runner**: the LLM-backed actor for one role (`planner`, `worker`, `verifier`, or `wiki`). The runner reads the board, reasons about the next safe action, calls tools, interprets results, and writes durable decisions.
- **Runner tool**: a deterministic command called by a runner for one explicit action. The tool may inspect state, validate invariants, reserve ids, perform narrow board mutations, prepare evidence, or run a mechanical check.
- **Runtime macro**: a coarse runtime script such as `start-plan.*`, `start-ticket.*`, or `finish-ticket.*`. Macros are allowed only where the equivalent small runner tools have not fully replaced the flow. A start macro may provide startup context, but it must not choose work, claim tickets, create worktrees, or silently fall back from a missing worktree to `PROJECT_ROOT` implementation.
- **Board state**: files under `.autoflow/tickets/`, `.autoflow/runners/`, `.autoflow/logs/`, and related reference/runtime state. Board state is the source of truth; chat text is not.

## Primary Rule

A runner tool is never the workflow brain.

The runner owns every semantic decision:

- which queue item to work on,
- what scope and `Allowed Paths` mean,
- what `Done When` should require,
- whether evidence satisfies the ticket,
- whether to pass, revise, replan, block, or ask the user,
- how to resolve merge or recovery strategy,
- what wiki meaning should be written.

A runner tool owns only deterministic execution of the runner's explicit request.

## Decision Boundary

Every runner tool must have `decision_boundary=result_only`.

That means a tool may return facts such as:

- queue snapshots,
- resolved paths,
- reserved ids,
- changed file lists,
- validation failures,
- diff counts,
- evidence bundles,
- board mutation results,
- finalizer status.

But a tool must not decide:

- "this is the correct ticket to claim",
- "this PRD/ticket scope is enough",
- "this Done When is acceptable",
- "verification passed semantically",
- "the merge conflict should be resolved this way",
- "this wiki summary is the right meaning",
- "the runner process should start, stop, or restart".

If a tool detects ambiguity or danger, it returns structured evidence and a non-success status. The runner interprets it and records the next safe action in board files.

## Runner Duties

Every runner must:

1. Read the relevant role contract before changing board state.
2. Choose the next action itself from board evidence.
3. Call runner tools with explicit arguments, not broad instructions.
4. Inspect tool output before continuing.
5. Record durable state in ticket, runner, wiki, or log files as appropriate.
6. Keep parser-sensitive fields and key=value output stable.
7. Leave a resumable `Next Action` / `Resume Context` when the work cannot finish in the same tick.

Runners must not wait for a script to "drive" the loop. The runner ticks the tools.

## Tool Duties

Every runner tool must:

1. Do one narrow operation.
2. Validate its inputs and target paths.
3. Prefer JSON or key=value output that the runner can inspect.
4. Be idempotent where practical.
5. Fail closed on unsafe path, state, or argument ambiguity.
6. Avoid hidden retries that change workflow meaning.
7. Avoid asking the user directly.
8. Avoid creating new policy that is not documented here or in the role contract.

Tools may perform atomic filesystem operations, lock acquisition, id reservation, mechanical checks, and deterministic formatting. Tools may not invent missing ticket content or silently broaden scope.

## Role Boundaries

`planner`:

- Owns order/prd promotion, ticket drafting, queue choice, and recovery decisions.
- Uses `autoflow tool runner-tool planner ...` for queue snapshots, id reservation, validated PRD/ticket writes, archival, recovery field updates, and guard checks.
- Does not implement product code, verify tickets, merge code, update wiki meaning, or manage runner processes.

`worker`:

- Owns one active ticket from claim through implementation, local verification judgment, verifier handoff, verifier revise/replan handling, verifier-approved merge, and finalization request.
- Uses `autoflow tool runner-tool worker ...` for active lookup, todo snapshots, explicit claim, worktree setup/status, context/stage updates, evidence records, Done When checks, diff checks, and finalizer wrappers.
- The worker chooses the ticket, writes the mini-plan, edits code inside `Allowed Paths`, runs verification, judges evidence, and resolves merge work. Tools only record or check those actions.

`verifier`:

- Owns semantic review of verifier-lane tickets.
- Uses `autoflow tool runner-tool verifier ...` for queue snapshots, evidence bundles, decision records, pass markers, and worker wake routing.
- The verifier decides whether the finished diff matches the ticket title, goal, and Done When. Tools only gather evidence and route the recorded decision; verifier tools must not merge or finalize product code.

`wiki`:

- Owns derived wiki knowledge.
- Uses `autoflow tool runner-tool wiki ...` for source snapshots, baseline updates, hybrid BM25+vector index refresh, query/lint/telemetry wrappers, deterministic frontmatter repair, validated page writes, diff snapshots, and wake markers.
- The wiki runner decides whether a content update is meaningful and whether a missing/stale hybrid index should be refreshed. Tools must not rewrite committed wiki pages for check timestamps alone, and RAG tools must report hybrid-index readiness instead of silently choosing another search path.

## Macro Compatibility

Large runtime scripts remain only as compatibility layers while behavior is split into smaller runner tools.

- Prefer `autoflow tool runner-tool <role> ...` for new behavior.
- Do not add `.sh` entrypoints for repo-owned runtime behavior.
- Do not keep a renamed runtime alias merely for convenience; stale aliases make runner/tool claim ambiguous.
- Remove a legacy fallback once the JS/TS implementation is the single worker and package/smoke docs no longer require it.

## Pass, Revise, Replan, And Merge Rules

Finalizer tools are bookkeeping and mechanical gates.

- `approve-merge` must be called only after the runner has already decided pass.
- For worker pass, the AI worker must already have verified the work and merged or prepared the required result according to the current topology.
- `verifier request-revision` keeps the same inprogress ticket/worktree and wakes worker for correction.
- `verifier request-replan` marks the inprogress ticket for replacement and wakes worker; worker then calls `worker create-retry-order` to create the retry order, delete the worktree, and remove the old inprogress ticket.
- The finalizer may validate diff/Done When, archive evidence, write logs, create local completion commits, and route verifier/replan flows.
- The finalizer must not be the actor that makes semantic pass/revise/replan decisions or resolves product-code merge conflicts.

## Extension Checklist

When adding or changing a runner tool:

1. Add the command as a narrow feature file under `app/runtime/runners/<role>/tools/<command>.ts`, export it from that role folder's `index.ts`, and keep `autoflow tool runner-tool` routed through `app/runtime/runners/tool.ts`.
2. Document the action in the relevant role agent file.
3. Keep `autoflow tool list` contract text accurate.
4. Update this file if the responsibility boundary changes.
5. Update package install and smoke tests when files move or disappear.
6. Run `autoflow tool runner-tool --help` or `npx tsx autoflow tool runner-tool --help`, `./app/bin/autoflow tool list`, and installed-board status/runners checks.
