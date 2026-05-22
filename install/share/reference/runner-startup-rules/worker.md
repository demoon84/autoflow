# 워커 러너 시작 규칙

`worker` / `ticket` runner에 주입되는 role rule이다.

## Startup Scan

- File을 열기 전에 `"$AUTOFLOW_CLI" tool runner-tool worker active-get --runner <runner-id> --max-items 12`를 한 번 실행한다.
- `active-get.active_get_terminal=true`이거나 `active-get.ai_followup_reason=worker_ticket_waiting_for_verifier`이면 검증 러너가 아직 ticket을 소유한 상태다. source file을 열거나 `todo-snapshot`을 실행하지 말고 compact result만 요약한 뒤 idle한다.
- `active-get.ai_followup_reason=verifier_passed_merge_pending`이면 idle하지 않고 `todo-snapshot`도 실행하지 않는다. `active-get.ai_followup_scope.inspect_only_recent_sources`만 inspect한 뒤 verifier-approved worktree를 ticket policy에 따라 merge target에 merge하고, 해당 target에서 필요한 검증을 다시 실행하고, `worker finalize-approved`를 호출한다.
- `active-get.ai_followup_reason=verifier_revision_requested`이면 idle하거나 새 ticket을 claim하지 않는다. scoped ticket/worktree만 inspect하고 verifier reason을 Allowed Paths 안에서 수정한 뒤 local verification을 재실행하고 `worker submit-to-verifier`를 다시 호출한다.
- `active-get.ai_followup_reason=verifier_replan_requested`이면 idle하거나 새 ticket을 claim하지 않는다. scoped ticket만 inspect하고 같은 ticket에 대해 `worker request-replan`을 실행한다.
- `active-get.ai_followup_recommended=true`이고 `active-get.active_get_terminal`이 true가 아니면 `active-get.ai_followup_scope.inspect_only_recent_sources`만 inspect하고 소유 중인 ticket 하나를 resume한다.
- 소유 중인 ticket이 없으면 idle 판단 전에 항상 `"$AUTOFLOW_CLI" tool runner-tool worker todo-snapshot --runner <runner-id> --max-items 12`를 한 번 실행한다. `active-get.ai_followup_recommended=false`는 소유 중인 in-progress ticket이 없다는 뜻일 뿐, 그 자체로 idle permission이 아니다.
- `todo-snapshot.ai_followup_recommended=false`이면 compact result를 요약하고 source file을 열지 않은 채 idle한다.
- Candidate가 있으면 `todo-snapshot.ai_followup_scope.inspect_only_recent_sources`만 inspect한다. Claim 전에 관련 없는 ticket을 inspect하거나 scope 밖 reference를 따라가지 않는다.
- 소유 중인 active ticket이 `tickets/inprogress/`나 `tickets/verifier/` 어디에도 없을 때만 가장 높은 priority의 `tickets/todo/Todo-*.md`를 최대 하나 claim한다. `todo-snapshot`의 Allowed Paths conflict는 병렬 작업 경고일 뿐 claim blocker가 아니다.
- 편집 전에 ticket worktree를 ensure하거나 reuse한다. 반환된 worktree를 implementation과 local verification의 working root로 쓴다.
- Product file inspection은 `worktree-ensure`가 성공한 뒤 시작하며, 선택한 ticket의 Allowed Paths 안에 머문다.

## Atomic Ticket Cycle

- Code 편집 전에 ticket에 mini-plan을 쓰거나 갱신한다.
- Ticket `Allowed Paths` 안에서만 구현한다.
- Verification command는 직접 실행하고 직접 판단한다.
- Evidence를 ticket에 기록한다.
- Local pass 이후 어떤 merge보다 먼저 검증 러너에 handoff한다. 이때 ticket file은 `tickets/inprogress/`에서 `tickets/verifier/`로 이동하므로 워커 러너는 검증 결정이 날 때까지 새 ticket을 claim하지 않는다.
- 검증 러너의 pass/revise/replan 결정은 ticket file을 다시 `tickets/inprogress/`로 이동하고 각각 `verified_pending_merge`, `revision_requested`, `replan_requested` 상태를 기록한다.
- Verifier revise에서는 같은 worktree를 유지하고, reason을 고치고, local verification을 다시 실행한 뒤 `worker submit-to-verifier`를 다시 실행한다.
- Verifier replan에서는 `worker request-replan`을 실행해 worktree를 정리하고 같은 ticket을 `tickets/todo/`로 되돌린다. 이때 `Replan Count` / `Replan Decision` / `Replan Fingerprint`를 증가시키고 `## Replan Reason` block을 추가한다. 워커는 이후 tick에서 같은 ticket을 re-claim한다.
- Verifier pass 이후에는 ticket의 `PRD Key`로 merge target을 고른다.
- PRD track: ticket에 `PRD Key`와 matching PRD `Branch:` field가 있으면 ticket worktree는 곧 PRD worktree다. 별도 TODO worktree나 `autoflow/TODO-NNN` branch를 만들지 않는다. TODO 완료 기록은 PRD branch에 누적하고, 같은 `PRD Key`의 모든 TODO가 `tickets/done/PRD-NNN/`에 도달한 마지막 TODO에서 워커 러너가 PRD branch를 main/master로 squash merge한다.
- atodo track: ticket에 `PRD Key`가 없으면 direct TODO worktree를 사용하고, 해당 TODO를 처리한 워커 러너가 worktree를 main/master로 squash merge한다.
- **항상 최종 main/master 반영은 `git merge --squash <branch>`로 한다.** `--no-ff`나 plain `git merge`를 쓰지 않는다. PRD track은 PRD cycle당 main/master 1커밋, atodo track은 TODO당 1커밋을 남긴다.
- **Merge 뒤 follow-up sync/bookkeeping commit을 만들지 않는다.** Board metadata가 ticket과 함께 들어가야 하면 squash commit 전에 stage하거나 `git commit --amend`로 접는다. 위키는 DB-only (wiki-search.db) 이므로 worker 가 별도로 stage 하지 않는다. Merge target에 별도 `[TODO-N] ... sync` commit을 만들지 않는다.
- Conflict resolution은 worker의 책임이지만, **conflict를 해결하기 전에 반드시 conflict region의 prior work를 wiki에서 검색한다.** `"$AUTOFLOW_CLI" tool runner-tool wiki query --runner <runner-id> --question "<conflict file path or function name>"`를 사용하고, 같은 file에 대한 `tickets/done/<project-key>/`도 확인한다. 어느 쪽을 고르기 전에 matching wiki/done-ticket entry를 읽어 이전 ticket의 의도를 이해한다. Conflict가 있다는 이유만으로 이전 ticket change를 조용히 덮어쓰지 말고, 가능하면 두 의도를 통합한다. 두 의도가 실제로 충돌하면 한쪽을 임의로 고르지 말고 ticket `## Notes`에 conflict reason을 기록한 뒤 사용자 지시를 기다린다. 해결 후에는 같은 squash commit을 완료한다. Conflict를 피하려고 다른 merge strategy로 바꾸지 않는다.
- Merge 이후 merge target에서 verification을 다시 실행하고 `worker finalize-approved`를 실행한다. 전체 정책은 [prd-branch-policy.md](../prd-branch-policy.md)를 본다.
- Local blocker가 있으면 구체적 reason과 next safe action을 기록한다.

## Boundaries

- Compact되지 않은 worker context 하나에서 여러 ticket을 처리하지 않는다. Ticket finalize 후 Desktop이 runner context를 compact하면 즉시 startup scan을 다시 실행하고, `todo-snapshot`이 남은 ticket work를 찾으면 claim한다.
- Planner ticket이나 wiki page를 만들지 않는다.
- push하지 않는다.
- Focused startup turn 중 generic `runner-stage`, `runner-tokens`, `date`를 호출하지 않는다. 실제 ticket state transition 또는 evidence update가 필요할 때만 `stage-set`, `context-update`, completion command 같은 worker-specific tool을 쓴다.
