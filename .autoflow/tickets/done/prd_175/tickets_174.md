# Ticket

## Ticket

- ID: tickets_174
- PRD Key: prd_175
- Plan Candidate: Plan AI handoff from tickets/done/prd_175/prd_175.md
- Title: Planner realtime wakeup trigger
- Priority: high
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-04T22:24:09Z

## Goal

- 이번 작업의 목표: planner loop runner 가 새 order / backlog PRD / reject 입력을 최대 60초 polling 지연 없이 빠르게 감지하되, 이벤트 누락 시에도 polling fallback 으로 자율 흐름을 유지한다.

## References

- PRD: tickets/done/prd_175/prd_175.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_175]]
- Plan Note:
- Ticket Note: [[tickets_174]]

## Allowed Paths

- `packages/cli/runners-project.sh`
- `tests/smoke/planner-realtime-wakeup-smoke.sh`
- `AGENTS.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_174`
- Branch: autoflow/tickets_174
- Base Commit: fb02f82d23514aa04434a76dcf674426502cfeac
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-04T22:07:04Z
- Started Epoch: 1777932424
- Updated At: 2026-05-04T22:24:09Z
- Tick Count: 5
- Time Used Seconds: 1025
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1056936476

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `AUTOFLOW_PLANNER_REALTIME_ENABLED=1` 상태에서 `.autoflow/tickets/inbox/order_*.md`가 추가되면 planner loop sleep 이 기존 interval 만료 전 조기 종료된다.
- [x] `.autoflow/tickets/backlog/prd_*.md` 추가와 `.autoflow/tickets/reject/reject_*.md` 추가도 같은 wakeup 경로를 사용한다.
- [x] 짧은 시간에 여러 감시 대상 파일이 추가되어도 trigger marker 는 1개 pending 으로 병합되고 planner adapter 가 동시에 2개 이상 실행되지 않는다.
- [x] trigger 로 깨어났지만 입력 manifest hash 가 직전과 같으면 state/log 에 `planner_inputs_unchanged` 또는 기존 idle skip 결과가 남고 adapter LLM 호출은 생략된다.
- [x] `AUTOFLOW_PLANNER_REALTIME_ENABLED=0` 또는 unset 상태에서는 기존 interval / backoff 동작이 유지된다.
- [x] `tests/smoke/planner-realtime-wakeup-smoke.sh`가 event wakeup, burst 병합, disabled fallback 을 검증하고 exit 0 한다.
- [x] 기존 `bash tests/smoke/runner-tick-backoff-smoke.sh`가 계속 exit 0 한다.
- [x] `npm run desktop:check` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_160`을 `prd_175`로 승격했고, `start-plan.sh 175`가 PRD/order를 `tickets/done/prd_175/`로 보관한 뒤 이 todo 티켓을 생성했다.
- 직전 작업: `bin/autoflow wiki query ... --rag`는 `result_count=0`이었고, 관련 완료 티켓 `prd_155/tickets_154` 및 `prd_156/tickets_155`에서 idle skip/backoff 선행 계약을 확인했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_175/prd_175.md`, `packages/cli/runners-project.sh`의 `runner_tick_backoff_sleep`, `tests/smoke/runner-tick-backoff-smoke.sh`.
- Wiki/ticket constraints: 새 scheduler 를 만들지 말고 `planner_inputs_unchanged` idle skip 및 PRD_156 backoff early wakeup 계약과 정합되게 구현한다. worker/verifier/wiki 확장은 이번 티켓 범위 밖이다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_175/prd_175.md at 2026-05-04T22:05:37Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "planner realtime trigger wakeup polling" --term "fs.watch planner watcher order inbox backlog reject" --term "run-role wait_for_trigger_or_timeout planner.wakeup" --term "PRD-155 idle skip PRD-156 dynamic backoff order_139 fork-bomb" --term "packages/cli/run-role.sh .autoflow/scripts/start-plan.sh apps/desktop/src/main.js" --limit 8 --rag` returned `result_count=0`.
- Related ticket findings: `tickets/done/prd_155/tickets_154.md` records the existing `planner_inputs_unchanged` idle skip contract; `tickets/done/prd_156/tickets_155.md` records the current `packages/cli/runners-project.sh` backoff sleep / early wakeup implementation and smoke test pattern.
- Planner runtime: `start-plan.sh 175` returned `source=backlog-to-todo`, `todo_ticket=tickets_174.md`, `lint_status=ok`, `lint_vagueness_score=0`.
- Guard warning after planner creation: `bin/autoflow guard /Users/demoon2016/Documents/project/autoflow .autoflow` returned `error_count=0`, `warning_count=2`; cleanup candidates are leftover worktree `autoflow/tickets_119` without a board ticket and dirty done-ticket worktree `autoflow/tickets_163`. Planner left both untouched per recovery protocol.

- Runtime hydrated worktree dependency at 2026-05-04T22:07:04Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-04T22:07:03Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_174; run=tickets/inprogress/verify_174.md
- AI worker prepared resume at 2026-05-04T22:07:32Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_174; run=tickets/inprogress/verify_174.md
- Mini-plan (2026-05-05T07:21:00 KST): wiki query는 출력 없이 장시간 대기해 직접 완료 티켓을 재확인했다. `tickets/done/prd_155/tickets_154.md`의 `planner_inputs_unchanged` idle skip 계약과 `tickets/done/prd_156/tickets_155.md`의 `runner_tick_backoff_sleep` fingerprint wake-up 패턴을 재사용한다. 구현은 `packages/cli/runners-project.sh`의 planner loop sleep에만 opt-in `AUTOFLOW_PLANNER_REALTIME_ENABLED=1` 경로를 추가하고, `tickets/inbox/order_*.md`, `tickets/backlog/prd_*.md`, `tickets/reject/reject_*.md` 변경을 pending marker 1개로 병합해 기존 단일 loop child 실행으로 깨운다. 새 scheduler, worker/verifier/wiki 확장, adapter prompt 변경은 하지 않는다.
- Implemented (2026-05-05T07:17:00 KST): `packages/cli/runners-project.sh`에 planner-only realtime input fingerprint, pending marker, marker consume, `planner_realtime_wakeup`/`backoff_wake` 로그를 추가했다. realtime base sleep은 watched planner input만 감시하고, 기존 full input fingerprint early wake는 extended backoff sleep에서만 유지해 adapter 직후 반복 wake를 막았다. `AGENTS.md`에 opt-in env와 marker/idle skip 계약을 문서화했고 `tests/smoke/planner-realtime-wakeup-smoke.sh`를 추가했다.
- Verification (2026-05-05T07:17:00 KST): worktree와 PROJECT_ROOT에서 `bash tests/smoke/planner-realtime-wakeup-smoke.sh && bash tests/smoke/runner-tick-backoff-smoke.sh && npm run desktop:check`가 exit 0으로 통과했다. `desktop:check`는 기존 Vite chunk-size warning만 출력했다.
- Merge recovery (2026-05-05T07:20:00 KST): 첫 `finish-ticket-owner.sh pass`가 `status=needs_ai_merge`, `reason=worktree_rebase_required`를 반환했다. AI가 worktree를 PROJECT_ROOT HEAD `477573f19d11ad4f5366c2859bfda0211a154f7a`로 fast-forward하고 Allowed Paths 변경을 재적용했으며, worktree와 PROJECT_ROOT의 Allowed Paths 파일 내용이 일치함을 `cmp`로 확인했다. 이후 worktree에서 동일 verification command를 재실행해 exit 0을 확인했다.
- Finish paused at 2026-05-04T22:18:21Z: worktree HEAD fb02f82d23514aa04434a76dcf674426502cfeac does not contain PROJECT_ROOT HEAD 477573f19d11ad4f5366c2859bfda0211a154f7a. AI must perform the rebase/merge; script did not run git rebase.
- Finish paused at 2026-05-04T22:20:54Z: worktree HEAD 477573f19d11ad4f5366c2859bfda0211a154f7a does not contain PROJECT_ROOT HEAD 353b98f9ec6b67f4e6a36bc9655c89ef794badec. AI must perform the rebase/merge; script did not run git rebase.
- Queued without worktree commit at 2026-05-04T22:24:08Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-04T22:24:08Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-04T22:24:09Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_174 deleted_branch=autoflow/tickets_174.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-04T22:24:09Z.
## Verification
- Run file: `tickets/done/prd_175/verify_174.md`
- Log file: `logs/verifier_174_20260504_222409Z_pass.md`
- Result: passed

## Result

- Summary: planner realtime wakeup trigger with polling fallback
- Remaining risk: 실제 장시간 운영에서 OS별 파일 생성 타이밍과 planner adapter 처리량은 runner log의 `planner_realtime_wakeup` / `planner_inputs_unchanged` 비율로 추가 관찰하면 좋다.
