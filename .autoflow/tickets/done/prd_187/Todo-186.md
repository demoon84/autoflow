# Ticket

## Ticket

- ID: Todo-186
- PRD Key: prd_187
- Plan Candidate: Plan AI handoff from tickets/done/prd_187/prd_187.md
- Title: planner secret dependency preflight
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-06T00:54:47Z

## Goal

- 이번 작업의 목표: PRD의 verification 또는 명시 메타데이터가 외부 비밀키를 요구할 때, 해당 환경변수가 없는 상태에서 planner가 todo ticket을 만들지 않고 PRD를 `needs_user_secret` 상태로 park 한다.

## References

- PRD: tickets/done/prd_187/prd_187.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_187]]
- Plan Note:
- Ticket Note: [[Todo-186]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/agents/spec-author-agent.md`
- `scaffold/board/agents/spec-author-agent.md`
- `.autoflow/reference/project-spec-template.md`
- `scaffold/board/reference/project-spec-template.md`
- `tests/smoke/planner-secret-preflight-smoke.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-186`
- Branch: autoflow/Todo-186
- Base Commit: d876a266819bf54cd17c8be7ff802502f9832d4d
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-06T00:47:48Z
- Started Epoch: 1778028468
- Updated At: 2026-05-06T00:54:49Z
- Tick Count: 4
- Time Used Seconds: 421
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3245214419

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] A fixture PRD whose `## Verification` `Command:` references `$ANTHROPIC_API_KEY` with that env var unset causes `start-plan.sh` to exit `0`, emits `source=needs-user-secret`, `missing_secrets=ANTHROPIC_API_KEY`, `recovery_state=needs_user`, and creates no `tickets/todo/Todo-*.md`.
- [x] The same fixture PRD is updated in backlog with `Status: needs_user_secret` and exactly one idempotent `## Notes` entry naming the missing variable and source PRD path after two repeated planner runs with the env var unset.
- [x] When `ANTHROPIC_API_KEY=dummy` is provided for the fixture run, `start-plan.sh` creates one todo ticket from the same PRD and the ticket `Verification.Command` remains unchanged.
- [x] A fixture PRD that mentions `ANTHROPIC_API_KEY` only in explanatory prose but not in `Verification.Command` or `Requires Secrets` is promoted to todo and is not parked as `needs_user_secret`.
- [x] A fixture PRD with explicit `Requires Secrets: [OPENAI_API_KEY]` or YAML `requires_secrets: [OPENAI_API_KEY]` is parked when `OPENAI_API_KEY` is unset and promotes when it is set.
- [x] The generated todo ticket for this PRD cites `tickets/done/prd_158/Todo-157.md` as the prior late-block example and keeps the scope limited to planner preflight, spec metadata guidance, and smoke tests.
- [x] `bash -n .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh tests/smoke/planner-secret-preflight-smoke.sh` exits `0`.
- [x] `bash tests/smoke/planner-secret-preflight-smoke.sh` exits `0` and prints evidence lines for `missing_secret_blocked=1`, `idempotent_notes=1`, `secret_present_promoted=1`, and `prose_only_promoted=1`.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_156`을 `prd_187`과 `Todo-186`으로 승격했다. 작업은 `Verification.Command`와 명시 `Requires Secrets` metadata의 missing env var를 planner promote 전에 감지하는 범위로 제한된다.
- 직전 작업: owner 가 worktree와 PROJECT_ROOT에 planner secret preflight 구현을 통합했고, 지정 검증 명령을 양쪽에서 exit 0으로 확인했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_186.md`, `.autoflow/scripts/start-plan.sh`, `.autoflow/scripts/common.sh`, `tests/smoke/planner-secret-preflight-smoke.sh`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_187/prd_187.md at 2026-05-05T00:43:08Z.
- Planner wiki pass: `bin/autoflow wiki query --term "ANTHROPIC_API_KEY needs_user_secret planner promote start-plan external secret" --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_158/Todo-157.md` shows `ANTHROPIC_API_KEY` was absent, static checks passed, live Anthropic API verification could not run, and planner later parked the ticket as external-secret `needs_user_decision`.
- Related recovery context: `tickets/done/prd_170/prd_170.md` addressed downstream `needs_user` / `repairing` inprogress parking. This ticket should prevent the upstream promote of secret-bound PRDs before worker time is spent.
- Scope boundary from `order_156`: implement A plus B in a narrow form: gate `Verification.Command` and explicit `Requires Secrets` / `requires_secrets`; do not add a new `tickets/needs_secret/` folder and do not broadly scan explanatory prose.
- Guard warning: `bin/autoflow guard` at 2026-05-05T00:43:58Z returned `status=warning`, `error_count=0`, `warning_count=3`; existing warnings are invalid legacy recovery class on `tickets/inprogress/Todo-166.md`, leftover worktree `autoflow/Todo-119`, and dirty done-ticket worktree `autoflow/Todo-163`. Planner recorded evidence and did not delete, reset, or manage worktrees.

- Runtime hydrated worktree dependency at 2026-05-06T00:47:47Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-06T00:47:47Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-06T00:47:46Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-186; run=tickets/inprogress/verify_186.md
- AI worker prepared resume at 2026-05-06T00:48:14Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-186; run=tickets/inprogress/verify_186.md
- Ticket owner verification tool initially recorded exit 127 because it treated smoke stdout as a command; owner manually corrected `tickets/inprogress/verify_186.md` after direct worktree and PROJECT_ROOT verification both exited 0.
- 2026-05-06T00:53:15Z mini-plan/evidence: cite `tickets/done/prd_158/Todo-157.md` as the prior late `ANTHROPIC_API_KEY` blocker; add planner preflight before backlog PRD archiving/todo creation; parse only `Verification.Command`, `Requires Secrets`, and YAML `requires_secrets`; preserve prose-only mentions; update spec author/template guidance; cover behavior with `tests/smoke/planner-secret-preflight-smoke.sh`.
- 2026-05-06T00:53:15Z verification: worktree and PROJECT_ROOT both passed `bash -n .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh tests/smoke/planner-secret-preflight-smoke.sh && bash tests/smoke/planner-secret-preflight-smoke.sh`; smoke printed `missing_secret_blocked=1`, `idempotent_notes=1`, `secret_present_promoted=1`, `prose_only_promoted=1`, `explicit_secret_promoted=1`.
- Queued without worktree commit at 2026-05-06T00:54:25Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-06T00:54:25Z; runtime finalizer will not perform merge operations.
- Queued without worktree commit at 2026-05-06T00:54:46Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-06T00:54:46Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-06T00:54:47Z: worktree_processes_stopped=0 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-186 deleted_branch=autoflow/Todo-186.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-06T00:54:47Z.
## Verification
- Run file: `tickets/done/prd_187/verify_186.md`
- Log file: `logs/verifier_186_20260506_005449Z_pass.md`
- Result: passed

## Result

- Summary: planner secret dependency preflight
- Remaining risk: Secret detection intentionally ignores explanatory prose outside `Verification.Command` and explicit metadata to avoid false positives.
