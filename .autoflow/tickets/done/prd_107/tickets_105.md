# Ticket

## Ticket

- ID: tickets_105
- PRD Key: prd_107
- Plan Candidate: Plan AI handoff from tickets/done/prd_107/prd_107.md
- Title: Autoflow 1원칙 문서 정렬 - 사용자 정지 외 자동 흐름 유지
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-02T06:01:06Z

## Goal

- 이번 작업의 목표: 루트 문서와 agent 지침에서 Autoflow 의 1원칙을 가장 먼저 보이게 선언하고, 같은 파일 범위 안의 parked/waiting 중심 문구를 비차단 forward-action 의미로 정렬한다.

## References

- PRD: tickets/done/prd_107/prd_107.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_107]]
- Plan Note:
- Ticket Note: [[tickets_105]]

## Allowed Paths

- AGENTS.md
- CLAUDE.md
- README.md
- .autoflow/rules/README.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/verifier-agent.md
- .autoflow/agents/spec-author-agent.md

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_105`
- Branch: autoflow/tickets_105
- Base Commit: 19a9331e77ff2e5485088ab71149d9d1beae5dac
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-02T05:55:55Z
- Started Epoch: 1777701355
- Updated At: 2026-05-02T06:01:07Z
- Tick Count: 4
- Time Used Seconds: 312
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 533207918

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `AGENTS.md` Root Rules 최상단에 1원칙이 추가되고 기존 규칙 흐름이 유지된다.
- [x] `CLAUDE.md`, `README.md`, `.autoflow/rules/README.md` 첫머리에 같은 원칙 또는 직접 링크되는 선언이 들어간다.
- [x] `.autoflow/agents/plan-to-ticket-agent.md`, `.autoflow/agents/ticket-owner-agent.md`, `.autoflow/agents/verifier-agent.md`, `.autoflow/agents/spec-author-agent.md` 시작부가 1원칙을 참조한다.
- [x] Allowed Paths 안에서는 user-facing dead-end 문구가 비차단 forward-action 의미로 정리된다.
- [x] `git push` 금지, runner 역할 경계, parser-sensitive 포맷은 유지된다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: memo_061 은 광범위한 no-park 헌법/자동 회복 정책을 요청하지만, planner 는 이번 티켓을 worker 가 한 턴에 끝낼 수 있는 문서·프롬프트 정렬 1차 슬라이스로 축소했다.
- 직전 작업: worktree 에서 문서 정렬을 구현한 뒤 같은 변경을 `PROJECT_ROOT` 에 수동 통합했고, 루트 기준 grep 검증으로 1원칙 선언과 dead-end 문구 정리를 다시 확인했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_105.md`, `tickets/done/prd_107/prd_107.md`, `wiki/answers/planner-recovery-automation-policy.md`, `wiki/answers/worker-isolation-and-retry-strategy.md`, `wiki/answers/dirty-root-finalization-blockers-20260502.md`.

## Notes

- Created by planner (Plan AI) from tickets/inbox/memo_061.md at 2026-05-02T03:38:30Z.
- Planning constraint: `prd_106` / `planner-recovery-automation-policy` already moved some agent-only recovery cases out of `needs_user`, but runtime retry-limit evidence is still an intentional boundary. Do not over-edit document language in a way that promises shell/runtime behavior this ticket does not implement.
- Planning constraint: `dirty-root-finalization-blockers-20260502`, `reject_071`, and `reject_074` show real dirty-root blockers still exist. The document rewrite should prefer "알림은 남기되 다른 흐름은 계속 진행" wording over promising that every blocked runtime case auto-resolves immediately.
- Follow-up cue: memo_062 is the likely next source for shell/runtime authority inversion. If the worker sees wording that would require code-level behavior to stay truthful, keep the docs precise about this ticket being a contract/alignment slice only.
- Mini-plan (2026-05-02): `AGENTS.md`, `CLAUDE.md`, `README.md`, `.autoflow/rules/README.md` 첫머리에 "사용자 명시 정지 외 흐름 유지" 1원칙을 먼저 배치한다.
- Mini-plan (2026-05-02): `.autoflow/agents/{plan-to-ticket-agent,ticket-owner-agent,verifier-agent,spec-author-agent}.md` 시작부에 같은 원칙을 참조하고, legacy/blocked 설명은 "증거를 남기고 다음 safe action 또는 다음 wake-up 으로 이어진다" 의미로만 정렬한다.
- Wiki constraint (2026-05-02): `[[planner-recovery-automation-policy]]`, `[[worker-isolation-and-retry-strategy]]`, `[[dirty-root-finalization-blockers-20260502]]`, `tickets/done/prd_107/prd_107.md`를 기준으로 문서 레이어에서만 forward-action 원칙을 선명하게 하고, retry-limit/dirty-root 같은 실제 runtime 경계는 유지한다.

- Runtime hydrated worktree dependency at 2026-05-02T05:55:54Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-02T05:55:53Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_105; run=tickets/inprogress/verify_105.md
- AI worker prepared resume at 2026-05-02T05:56:23Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_105; run=tickets/inprogress/verify_105.md
- Finish paused at 2026-05-02T06:00:23Z: worktree HEAD 19a9331e77ff2e5485088ab71149d9d1beae5dac does not contain PROJECT_ROOT HEAD c0fa11db7317aa6b52f0d2003840396c37a3b2ef. AI must perform the rebase/merge; script did not run git rebase.
- Queued without worktree commit at 2026-05-02T06:01:05Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-02T06:01:05Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-02T06:01:06Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_105 deleted_branch=autoflow/tickets_105.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-02T06:01:06Z.
## Verification
- Run file: `tickets/done/prd_107/verify_105.md`
- Log file: `logs/verifier_105_20260502_060107Z_pass.md`
- Result: passed

## Result

- Summary: 1원칙 문서 정렬과 forward-action 문구 반영
- Remaining risk: 실제 shell/runtime 의 `needs_user`, retry-limit, authority inversion 동작은 이번 문서 슬라이스에서 바꾸지 않았다.
