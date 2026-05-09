# Ticket

## Ticket

- ID: Todo-104
- PRD Key: prd_106
- Plan Candidate: Plan AI handoff from tickets/done/prd_106/prd_106.md
- Title: Planner recovery 자동화 - needs_user 자동 해소 정책
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-02T05:54:34Z

## Goal

- 이번 작업의 목표: agent-only dirty worktree 와 same-scope allowed path conflict 는 사람이 매번 결정하지 않아도 planner/runtime 이 안전하게 백업, 정리, retry 로 이어가도록 만든다.

## References

- PRD: tickets/done/prd_106/prd_106.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_106]]
- Plan Note:
- Ticket Note: [[Todo-104]]

## Allowed Paths

- packages/cli/run-role.sh
- packages/cli/guard-project.sh
- runtime/board-scripts/run-role.sh
- runtime/board-scripts/start-plan.sh
- runtime/board-scripts/common.sh
- runtime/board-scripts/start-ticket-owner.sh
- runtime/board-scripts/board-guard.sh
- .autoflow/scripts/start-plan.sh
- .autoflow/scripts/common.sh
- .autoflow/scripts/start-ticket-owner.sh
- .autoflow/scripts/board-guard.sh
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/protocols/board-orchestration.md
- .autoflow/protocols/recovery.md
- .autoflow/rules/README.md
- scaffold/board/agents/plan-to-ticket-agent.md
- scaffold/board/agents/ticket-owner-agent.md
- scaffold/board/protocols/board-orchestration.md
- scaffold/board/protocols/recovery.md
- scaffold/board/rules/README.md
- tests/smoke/planner-orchestrator-leftover-worktree-wake-smoke.sh
- tests/smoke/planner-orchestrator-needs-user-wait-smoke.sh
- tests/smoke/planner-orchestrator-recovery-wake-smoke.sh
- tests/smoke/ticket-owner-stale-worktree-recovery-smoke.sh
- tests/smoke/ticket-owner-replan-smoke.sh
- tests/smoke/board-guard-recovery-protocol-sync-smoke.sh

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-104`
- Branch: autoflow/Todo-104
- Base Commit: 52cb2ad29b3a59d8545128b1f95c43db8fb1b833
- Worktree Commit: 
- Integration Status: no_code_changes

## Goal Runtime
- Status: complete
- Started At: 2026-05-02T03:23:36Z
- Started Epoch: 1777692216
- Updated At: 2026-05-02T05:54:37Z
- Tick Count: 16
- Time Used Seconds: 9061
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 192651930

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `AUTOFLOW_RECOVERY_AUTO` 가 미지정 또는 `on` 일 때 agent-only dirty leftover worktree 는 planner/runtime 이 diff 를 `.autoflow/runners/state/recovery-discarded/<ticket>-<timestamp>.diff` 형태로 보존한 뒤 자동으로 discard/cleanup 하고 board flow 를 retry 또는 reject 정리로 이어간다.
- [x] `AUTOFLOW_RECOVERY_AUTO=off` 일 때는 기존처럼 dirty leftover worktree 를 자동 정리하지 않고 `needs_user` recovery evidence 를 남긴다.
- [x] agent-only 판별은 사용자 commit, staged change, branch divergence, push/remote divergence, 또는 Allowed Paths 밖 dirty change 가 있으면 false 로 처리하고 자동 discard 를 금지한다.
- [x] 자동 discard 직전 백업 diff 는 ticket id, worktree path, source recovery reason, timestamp 를 추적할 수 있고, 실패해도 원본 worktree 를 삭제하지 않는다.
- [x] same-scope `allowed_path_conflict` 는 reject reason 의 unmet path 가 현재 `Allowed Paths` 의 부모 디렉터리 또는 같은 파일군 아래에 있을 때만 retry ticket 의 `Allowed Paths` 를 자동 확장한다. `scaffold/board/**` 계열 작업에서 `scaffold/board/reference/{README,backlog,tickets-board}.md` 가 남은 케이스는 자동 확장 대상이다.
- [x] 다른 영향권의 path conflict 는 자동 확장하지 않고 기존 recovery evidence 를 유지한다.
- [x] 자동 확장 retry 는 `AUTOFLOW_REJECT_MAX_RETRIES` / ticket `Max Retries` 카운터에 포함되며, retry limit 에 도달하면 더 이상 자동 requeue 하지 않는다.
- [x] planner 결정 로그는 `.autoflow/runners/logs/planner.log` 에 `event=auto_recovery_resolved reason=... ticket=...` 형태로 남고, ticket `Recovery State` / `Notes` 에도 동일 decision 이 중복 없이 기록된다.
- [x] `start-plan` / runner key=value 출력의 기존 parser-sensitive key (`status`, `source`, `replan_skipped.*`, `failure_class`, `recovery_state`, `board_root`, `project_root`) 는 호환성을 유지한다.
- [x] `.autoflow/agents/*`, `.autoflow/protocols/*`, `.autoflow/rules/*` 와 scaffold mirror 문서는 새 정책을 반영하되, planner 가 runner/OS process 를 관리하지 않는 경계와 `git push` 금지를 그대로 유지한다.
- [x] 현재 `tickets/done/prd_098/Todo-102.md` 에 기록된 dirty leftover + same-scope `allowed_path_conflict` 사례를 재현하는 smoke 가 사람 개입 없이 자동 백업/확장/retry 또는 명시적 자동 정리 결과를 검증한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: worktree 구현 결과를 `PROJECT_ROOT`의 동일 14개 파일로 수동 통합했고, PRD의 전체 검증 명령을 worktree와 `PROJECT_ROOT` 양쪽에서 모두 exit 0으로 재확인했다.
- 직전 작업: `packages/cli/run-role.sh` / `runtime/board-scripts/run-role.sh` 에 clean leftover 즉시 discard + dirty agent-only 판별 분기를 정리했고, `.autoflow/scripts/common.sh` / `runtime/board-scripts/common.sh` 에 recovery auto on/off 판별, diff backup, reject reason multi-path 파싱, same-scope allowed path expansion, durable recovery evidence 갱신을 추가했다. 관련 agent/protocol/rules/scaffold mirror 문서와 허용된 smoke 2개도 같은 정책으로 갱신했다.
- 재개 시 먼저 볼 것: `verify_104.md` 의 통과 근거, `tests/smoke/planner-orchestrator-leftover-worktree-wake-smoke.sh`, `tests/smoke/ticket-owner-replan-smoke.sh`, 그리고 `finish-ticket-owner.sh` 최종 결과.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_106/prd_106.md at 2026-05-02T03:22:57Z.
- Wiki context: `autoflow wiki query --rag` for `Planner recovery 자동화`, `needs_user`, `leftover_worktree`, `allowed_path_conflict`, `AUTOFLOW_RECOVERY_AUTO`, `Todo-102`, and `scaffold/board/reference` surfaced `tickets/done/prd_098/Todo-102.md`, `tickets/done/prd_098/verify_102.md`, `tickets/done/prd_098/verify_102.reject.md`, and `tickets/done/prd_097/prd_097.md`.
- Planning constraint: `Todo-102` records the motivating blocker: dirty leftover worktree `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-102`, diff backup under `.autoflow/runners/state/recovery-discarded/`, and remaining same-scope paths `scaffold/board/reference/README.md`, `scaffold/board/reference/backlog.md`, `scaffold/board/reference/tickets-board.md`.
- Planning constraint: `prd_097` established that retry limits and `replan_skipped.*` key/value output must remain stable. This ticket should add automatic recovery before true retry-limit exhaustion, not remove the retry-limit boundary.
- Mini-plan (worker, 2026-05-02): 1) tighten agent-only leftover detection and diff-backup/discard behavior so auto cleanup is limited to true agent-owned worktree state and leaves durable recovery evidence, 2) align `.autoflow/` and `runtime/board-scripts/` recovery helpers plus planner wake outputs without breaking parser-sensitive key=value contracts from `run-role.sh` and `start-plan.sh`, 3) add/finish smoke coverage for `AUTOFLOW_RECOVERY_AUTO=off`, agent-only false leftovers, and the `Todo-102` same-scope allowed-path retry case before running the full verification command.

- Runtime hydrated worktree dependency at 2026-05-02T03:23:34Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-02T03:23:33Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-104; run=tickets/inprogress/verify_104.md
- AI worker prepared resume at 2026-05-02T05:35:35Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-104; run=tickets/inprogress/verify_104.md
- Implementation progress (worker, 2026-05-02T05:52:01Z): added `AUTOFLOW_RECOVERY_AUTO` gate handling plus agent-only leftover detection/backups in both board-script mirrors, taught reject auto-replan to parse multi-path same-scope conflicts like `Todo-102`, removed debug-only planner wake output, updated planner/owner recovery docs and scaffold mirrors, and extended the allowed smoke coverage for auto-discard success, `AUTOFLOW_RECOVERY_AUTO=off`, agent-only false leftovers, and `scaffold/board/reference/*` retry expansion.
- Verification evidence (worker, 2026-05-02T05:52:01Z): `bash -n ... && bash tests/smoke/planner-orchestrator-leftover-worktree-wake-smoke.sh && bash tests/smoke/planner-orchestrator-needs-user-wait-smoke.sh && bash tests/smoke/planner-orchestrator-recovery-wake-smoke.sh && bash tests/smoke/ticket-owner-stale-worktree-recovery-smoke.sh && bash tests/smoke/ticket-owner-replan-smoke.sh && bash tests/smoke/board-guard-recovery-protocol-sync-smoke.sh` passed in the ticket worktree and again from `PROJECT_ROOT` after manual integration.
- Finish paused at 2026-05-02T05:52:59Z: worktree HEAD 52cb2ad29b3a59d8545128b1f95c43db8fb1b833 does not contain PROJECT_ROOT HEAD 8ddafa660010a2a68444595686cb64dd1f653cb7. AI must perform the rebase/merge; script did not run git rebase.
- No staged code changes found in worktree during merge preparation at 2026-05-02T05:54:34Z.
- Impl AI worker marked verification pass at 2026-05-02T05:54:34Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-02T05:54:34Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-104 deleted_branch=autoflow/Todo-104.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-02T05:54:34Z.
## Verification
- Run file: `tickets/done/prd_106/verify_104.md`
- Log file: `logs/verifier_104_20260502_055437Z_pass.md`
- Result: passed

## Result

- Summary: planner recovery auto cleanup and same-scope retry verified
- Remaining risk: `PROJECT_ROOT` already has unrelated board/wiki churn outside this ticket scope; finalizer must stage only this ticket's allowed-path files and leave unrelated dirty state untouched.
