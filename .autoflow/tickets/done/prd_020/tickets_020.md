# Ticket

## Ticket

- ID: tickets_020
- PRD Key: prd_020
- Plan Candidate: Plan AI handoff from tickets/done/prd_020/prd_020.md
- Title: Auto-resume finish-pass when an inprogress ticket has Result: passed but no commit / merge
- Stage: done
- AI: AI-1
- Claimed By: AI-1
- Execution AI: AI-1
- Verifier AI: AI-1
- Last Updated: 2026-04-27T14:19:11Z

## Goal

- 이번 작업의 목표: Impl AI tick 이 코드수정→검증통과→Result: passed 기록 후 finish-ticket-owner.sh 호출 전에 중단된 경우, 다음 tick 에서 자동으로 finish-pass 를 재개해 worktree commit + inline merge → done 까지 흐르게 한다. common.sh 에 recover_passed_inprogress_ticket 헬퍼 추가, start-ticket-owner.sh 에 auto-finish 분기 삽입, bin/autoflow doctor 에 check.passed_inprogress_recovery_pending 추가, 로그에 source=auto_resumed_finish_pass 키 emit.

## References

- PRD: tickets/done/prd_020/prd_020.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_020]]
- Plan Note:
- Ticket Note: [[tickets_020]]

## Allowed Paths

- `runtime/board-scripts/start-ticket-owner.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/common.sh`
- `packages/cli/doctor-project.sh`
- `runtime/board-scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.sh`

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020`
- Branch: autoflow/tickets_020
- Base Commit: 9dfdec4cd10caa5a0bf259984a32257d7eda25ec
- Worktree Commit: d11a15c2560624d79a49b067f8f6ada4dd5ea54b
- Integration Status: integrated

## Done When

- [ ] `tickets/inprogress/tickets_NNN.md` 의 `Result` 가 `passed by ...` 이고 worktree 의 변경이 commit 되지 않은 상태에서 owner runner 의 다음 tick 이 돌면, 자동으로 worktree 를 commit 하고 finish-pass 가 호출되어 ticket 이 done/ 으로 이동한다.
- [ ] 동일 상태에서 worktree 가 이미 commit 만 있고 ticket 만 finish 안 된 경우, 합성 commit 없이 기존 commit 으로 finish-pass 가 호출된다.
- [ ] 회복 후 wiki update + local commit 까지 inline merge 흐름이 그대로 동작한다.
- [ ] `Result: passed` 가 아닌 ticket (`pending`, `failed`, blocked) 은 자동 회복 분기를 타지 않고 기존 흐름 유지.
- [ ] `bin/autoflow doctor` 가 미완료 회복 ticket 이 있을 때 `check.passed_inprogress_recovery_pending=warning` 을 보고하고, 0 일 때 `=ok`.
- [ ] runner 로그에 `source=auto_resumed_finish_pass` 가 발생한 경우 데스크톱의 진행률 카드에서 `last_result` 로 보인다.
- [ ] 기존 정상 ticket 흐름 (Plan AI / Impl AI 가 처음부터 실행하는 케이스) 회귀 없음 — start-ticket-owner.sh 의 dry-run / 일반 claim 출력 형식이 동일.
- [ ] `bash -n` syntax check 통과, `bin/autoflow doctor` status=ok.

## Next Action
- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓 생성 완료. Allowed Paths, Done When, Verification, mini-plan 모두 PRD 기준으로 정제됨.
- 직전 작업: Plan AI 가 PRD 를 done/prd_020/ 으로 보관하고 todo 티켓을 만들고 필드를 정제했다.
- 재개 시 먼저 볼 것: Notes 의 mini-plan 6단계. common.sh 의 기존 헬퍼 패턴 확인 후 recover_passed_inprogress_ticket 추가.

## Notes

- Created by AI-1 (Plan AI) from tickets/done/prd_020/prd_020.md at 2026-04-27T12:35:48Z.
- Wiki context: tickets_008 (prd_008) added bounded reject auto-replan — the reject retry infrastructure in common.sh is already present. tickets_009 (prd_009) fixed git_root unbound variable in merge-ready-ticket.sh. Both are relevant baseline.
- Reject context: 4 reject records (verify_001, verify_004, verify_005, verify_009) exist in reject/ but were skipped by auto-replan (retry limit or ineligible). verify_005 references the git_root bug now fixed in tickets_009. verify_009 had TS errors from unrelated prd_009 scope.
- PRD conversation handoff: user reported tickets_012 / tickets_015 stuck as Result=passed but never finished. This ticket adds self-healing for that failure mode.
- Mini-plan:
  1. Add `recover_passed_inprogress_ticket` helper to `runtime/board-scripts/common.sh` (and mirror to `.autoflow/scripts/common.sh`).
  2. Insert auto-finish branch in `start-ticket-owner.sh` after adoptable ticket selection, before normal claim flow.
  3. Add `check.passed_inprogress_recovery_pending` to `packages/cli/doctor-project.sh`.
  4. Emit `source=auto_resumed_finish_pass` log key from the new branch.
  5. Mirror runtime scripts to `.autoflow/scripts/`.
  6. Run verification: `bash -n` + `bin/autoflow doctor`.

- Runtime hydrated worktree dependency at 2026-04-27T13:33:41Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T13:33:41Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI AI-1 prepared todo at 2026-04-27T13:33:41Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- AI AI-1 prepared resume at 2026-04-27T13:44:35Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- AI AI-1 prepared resume at 2026-04-27T14:05:16Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- AI AI-1 prepared resume at 2026-04-27T14:06:12Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- AI AI-1 prepared resume at 2026-04-27T14:12:50Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- AI AI-1 prepared resume at 2026-04-27T14:14:06Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- AI AI-1 prepared resume at 2026-04-27T14:14:26Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020; run=tickets/inprogress/verify_020.md
- Wiki query at 2026-04-27T14:17:36Z: `tickets/done/prd_006/tickets_006.md` confirms finish-pass should keep wiki-maintainer absence non-blocking; `tickets/done/prd_009/tickets_009.md` confirms runtime and `.autoflow/scripts` mirror updates are an established pattern for start-ticket-owner changes.
- Implementation progress at 2026-04-27T14:17:36Z: added `recover_passed_inprogress_ticket` in common.sh, inserted the auto-resume branch in start-ticket-owner.sh, mirrored both scripts to `.autoflow/scripts/`, and added `check.passed_inprogress_recovery_pending` to doctor diagnostics.
- Ticket owner verification failed by AI-1 at 2026-04-27T14:18:08Z: command exited 127
- Ticket owner verification passed by AI-1 at 2026-04-27T14:19:03Z: command exited 0
- Rebased worktree onto PROJECT_ROOT HEAD 9dfdec4cd10caa5a0bf259984a32257d7eda25ec at 2026-04-27T14:19:10Z for clean merge.
- Prepared worktree commit d11a15c2560624d79a49b067f8f6ada4dd5ea54b at 2026-04-27T14:19:10Z; coordinator should integrate it into PROJECT_ROOT and create the local completion commit.
- Impl AI AI-1 marked verification pass at 2026-04-27T14:19:10Z and triggered inline merge.
- Coordinator AI-1 integrated worktree commit d11a15c2560624d79a49b067f8f6ada4dd5ea54b into PROJECT_ROOT without committing at 2026-04-27T14:19:11Z.
- Coordinator AI-1 finalized this verified ticket at 2026-04-27T14:19:11Z.
- Coordinator post-merge cleanup at 2026-04-27T14:19:11Z: removed_worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_020 deleted_branch=autoflow/tickets_020.
## Verification
- Run file: `tickets/done/prd_020/verify_020.md`
- Log file: `logs/verifier_020_20260427_141912Z_pass.md`
- Result: passed

## Result

- Summary: auto-resume finish-pass recovery implemented
- Remaining risk:
