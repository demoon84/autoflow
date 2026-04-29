# Ticket

## Ticket

- ID: tickets_049
- PRD Key: prd_049
- Plan Candidate: Plan AI handoff from tickets/done/prd_049/prd_049.md
- Title: Demote runtime bookkeeping notes
- Stage: rejected
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T07:42:21Z

## Goal

- 이번 작업의 목표: Reduce recurring ticket-owner adapter prompt noise by keeping decision-relevant AI notes in `## Notes` while moving repetitive runtime bookkeeping events to a capped `## Runtime Log` or equivalent runtime-only field.

## References

- PRD: tickets/done/prd_049/prd_049.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_049]]
- Plan Note:
- Ticket Note: [[tickets_049]]

## Allowed Paths

- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `runtime/board-scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.sh`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049`
- Branch: autoflow/tickets_049
- Base Commit: d3734813de7c48f955d8c42ffd83a011fd3363d6
- Worktree Commit:
- Integration Status: pending

## Done When

- [ ] Runtime-only bookkeeping entries such as `Runtime hydrated worktree dependency`, `AI worker-* prepared todo/resume`, automatic shared-path/shared-head block/recovery bookkeeping, auto-resume finish-pass bookkeeping, reject archival/replan bookkeeping, and `Coordinator post-merge cleanup` no longer append to `## Notes`.
- [ ] The same runtime-only events are still recorded in a non-AI notes location such as capped `## Runtime Log` or a single last-machine-action field, with the durable ticket file retaining no more than the last 3 runtime-only entries.
- [ ] Decision-relevant lines such as AI mini-plans, implementation progress, verification pass/fail summaries, merge blockers, and explicit blocker diagnostics still use `## Notes`.
- [ ] Runtime and installed board script copies remain synchronized for all changed files.
- [ ] All modified shell scripts pass syntax checks.

## Next Action
- reject 처리됨: Reject Reason 을 기준으로 재작업 범위를 정한다.

## Resume Context

- 현재 상태 요약: Runtime-log implementation is present and mirrored in the ticket worktree, but required verification still fails on an out-of-scope `finish-ticket-owner.sh` smoke output contract.
- 직전 작업: worker-1 reran wiki query, inspected the allowed implementation and finish/smoke flow, reran required verification at 2026-04-29T07:38:04Z, and confirmed the same `cleanup_status=ok` smoke failure after syntax and mirror checks passed.
- 재개 시 먼저 볼 것: `tickets/reject/verify_049.md` or `tickets/inprogress/verify_049.md` findings, then replan scope to include `runtime/board-scripts/finish-ticket-owner.sh`, `.autoflow/scripts/finish-ticket-owner.sh`, or `tests/smoke/ticket-owner-smoke.sh`.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_049/prd_049.md at 2026-04-29T06:48:40Z.
- Wiki context: `bin/autoflow wiki query . --term append_note --term "Runtime Log" --term "AI Notes" --term common.sh --term "ticket-owner resume" --term bookkeeping` surfaced prior done tickets around `common.sh` runtime helper work, especially `tickets/done/prd_020/*`, `tickets/done/prd_022/tickets_022.md`, `tickets/done/prd_009/*`, and `tickets/done/prd_008/*`.
- Planning constraint from prior ticket history: keep `runtime/board-scripts/common.sh` aligned with `.autoflow/scripts/common.sh`, and keep each changed runtime script paired with its installed board copy.
- Scope guard: this ticket should not change lifecycle semantics, verification semantics, merge/finalization behavior, wiki updates, or adapter prompt assembly directly.
- Mini-plan: add a capped `append_runtime_log` helper in `common.sh`; route only PRD-listed machine bookkeeping call sites to it; keep decision-relevant blockers, merge diagnostics, verification summaries, and finalizer decisions in `append_note`; mirror changed runtime scripts into `.autoflow/scripts`; verify with syntax, mirror diffs, smoke test, and a fixture check for capped runtime log behavior.
- Implementation progress: added `append_runtime_log` capped to the last 3 `## Runtime Log` bullet entries and moved runtime-only worktree hydration, prepared todo/resume, shared-path/shared-head auto-block, auto-recovery, auto-resume finish-pass, reject replan/archive, and Coordinator post-merge cleanup events out of `## Notes`.
- Replan verification finding: `bin/autoflow wiki query . --term append_note --term "Runtime Log" --term "ticket-owner resume" --term "finish-ticket-owner cleanup_status" --term bookkeeping` resurfaced this PRD/memo and rejected verification evidence; no prior wiki entry provides authority to change the required smoke outside ticket scope.
- Retry result: required verification was rerun at 2026-04-29T07:03:17Z. The six allowed shell scripts passed `bash -n`, the three runtime/installed mirror `diff -q` checks passed, and smoke failed at the same `cleanup_status=ok` expectation because `finish-ticket-owner.sh` summarizes successful inline merge output. That script and the smoke expectation are outside Allowed Paths.
- Current owner pass at 2026-04-29T07:08:48Z: wiki query found `wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md`, confirming the prior failure pattern; required verification failed again on the same out-of-scope `finish-ticket-owner.sh` concise success output contract after syntax and mirror checks passed.
- Current owner pass at 2026-04-29T07:13:51Z: wiki query found `wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md`, confirming the prior failure pattern; required verification failed again after syntax and mirror checks passed. No additional code changes were made because the remaining fix is outside Allowed Paths.
- Current owner pass at 2026-04-29T07:17:33Z: wiki query again found `wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md`; required verification failed after syntax and mirror checks passed because smoke still expects `cleanup_status=ok` from out-of-scope `finish-ticket-owner.sh`. No additional code changes were made inside this ticket because the remaining fix requires a widened scope.
- Current owner pass at 2026-04-29T07:21:22Z: wiki query again found `wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md`; direct inspection confirmed `merge-ready-ticket.sh` already emits `cleanup_status=ok`, but out-of-scope `finish-ticket-owner.sh` suppresses that line on successful inline merge. Required verification failed after syntax and mirror checks passed. No code changes were made because the remaining fix requires a widened scope.
- Current owner pass at 2026-04-29T07:33:56Z: wiki query again found `wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md`; direct inspection confirmed the required smoke still fails because out-of-scope `finish-ticket-owner.sh` suppresses `merge-ready-ticket.sh` cleanup detail on successful inline merge. Syntax checks, runtime/installed mirror diffs, and a direct `append_runtime_log` fixture passed. No additional code changes were made because the remaining fix requires widened scope.
- Current owner pass at 2026-04-29T07:38:04Z: wiki query again found `wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md` and `tickets/reject/verify_049.md`; direct inspection confirmed `merge-ready-ticket.sh` already emits `cleanup_status=ok`, but out-of-scope `finish-ticket-owner.sh` suppresses successful inline merge detail as `inline_merge=done; wiki+log written`. Required verification failed after syntax and mirror checks passed. No code changes were made because the remaining fix requires widened scope.

- Ticket owner verification failed by worker-1 at 2026-04-29T06:58:54Z: command exited 1
- Verification finding: syntax checks, mirror `diff -q` checks, `git diff --check`, and a direct `append_runtime_log` fixture passed; required smoke failed because `tests/smoke/ticket-owner-smoke.sh` expects `cleanup_status=ok` in `finish-ticket-owner.sh` pass output, but that script currently summarizes successful inline merge output and omits cleanup detail. `finish-ticket-owner.sh` is outside this ticket's Allowed Paths, so the next plan should either widen scope to expose cleanup output or adjust the smoke expectation.
- AI worker-1 marked fail at 2026-04-29T06:59:35Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T06:59:46Z; retry_count=1
- AI worker-1 prepared todo at 2026-04-29T07:01:18Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:01:41Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:03:33Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:04:09Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:04:21Z; retry_count=2
- AI worker-1 prepared todo at 2026-04-29T07:05:52Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:06:34Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:08:48Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:09:35Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:10:08Z; retry_count=3
- AI worker-1 prepared todo at 2026-04-29T07:11:11Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:11:48Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:13:51Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:14:37Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:15:00Z; retry_count=4
- AI worker-1 prepared todo at 2026-04-29T07:16:16Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:16:39Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 marked fail at 2026-04-29T07:18:06Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:18:21Z; retry_count=5
- AI worker-1 prepared todo at 2026-04-29T07:19:29Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:19:46Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:21:22Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:21:55Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:22:39Z; retry_count=6
- AI worker-1 prepared todo at 2026-04-29T07:23:20Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:23:37Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:25:19Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:25:29Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:26:07Z; retry_count=7
- AI worker-1 prepared todo at 2026-04-29T07:26:55Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:27:33Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:29:28Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:29:45Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:30:10Z; retry_count=8
- AI worker-1 prepared todo at 2026-04-29T07:31:13Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:31:51Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:33:43Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:34:47Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:34:48Z; retry_count=9
- AI worker-1 prepared todo at 2026-04-29T07:36:33Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:36:52Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 marked fail at 2026-04-29T07:38:48Z.
- Ticket automatically replanned from tickets/reject/reject_049.md at 2026-04-29T07:39:17Z; retry_count=10
- AI worker-1 prepared todo at 2026-04-29T07:40:14Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared resume at 2026-04-29T07:40:29Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Ticket owner verification failed by worker-1 at 2026-04-29T07:42:05Z: command exited 1
- AI worker-1 marked fail at 2026-04-29T07:42:21Z.
## Runtime Log
- AI worker-1 prepared resume at 2026-04-29T06:54:17Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- AI worker-1 prepared todo at 2026-04-29T06:53:48Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049; run=tickets/inprogress/verify_049.md
- Runtime hydrated worktree dependency at 2026-04-29T06:53:48Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
## Verification
- Run file: `tickets/reject/verify_049.md`
- Log file: `logs/verifier_049_20260429_074221Z_fail.md`
- Result: failed

## Result
- Summary:
- Remaining risk:

## Reject Reason

- Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.

## Retry
- Retry Count: 10
- Max Retries: 10

## Reject History
- 2026-04-29T06:59:46Z | retry_count=1 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_065935Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:04:21Z | retry_count=2 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_070409Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:10:08Z | retry_count=3 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_070935Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:15:00Z | retry_count=4 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_071438Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:18:21Z | retry_count=5 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_071806Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:22:39Z | retry_count=6 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_072155Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:26:07Z | retry_count=7 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_072529Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:30:10Z | retry_count=8 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_072945Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:34:48Z | retry_count=9 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_073447Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.
- 2026-04-29T07:39:17Z | retry_count=10 | source=`tickets/reject/reject_049.md` | log=``logs/verifier_049_20260429_073848Z_fail.md`` | reason=Required smoke verification fails outside this ticket scope: tests/smoke/ticket-owner-smoke.sh expects cleanup_status=ok in finish-ticket-owner.sh output after successful inline merge, but finish-ticket-owner.sh is not in Allowed Paths for tickets_049. Replan with finish-ticket-owner or smoke expectation scope.

## Archive Note

- Archived 2026-04-30 by direct user instruction. 사용자가 반려 1건 직접 처리 요청.
- 원 목표(`## Notes` 의 runtime bookkeeping 누적 방지) 는 다른 방식으로 이미 해결됨. 메인 commit `d8dae69` 의 `append_note_replacing` 헬퍼가 prepared-resume / prepared-todo 같은 고빈도 노트를 prefix-match 회전으로 대체해 ticket file 이 더 이상 부풀지 않도록 함.
- 049 의 별도 `## Runtime Log` 섹션 + cap 접근은 같은 call site 를 다른 방식으로 다루므로 메인의 회전 방식과 공존 불가. retry_count 10/10 도달, 이 라운드는 폐기.
- worktree `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_049` 와 branch `autoflow/tickets_049` 제거함. worktree 내 변경(append_runtime_log helper) 도 함께 폐기.
- 후속 필요 시: 별도 PRD 로 (a) Runtime Log 섹션 도입 + (b) finish-ticket-owner.sh 의 cleanup_status=ok contract 보존을 한 ticket scope 로 다시 계획.
