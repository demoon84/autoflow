# Ticket

## Ticket

- ID: Todo-219
- PRD Key: prd_220
- Plan Candidate: Plan AI handoff from tickets/done/prd_220/prd_220.md
- Title: 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간)
- Priority: normal
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T07:35:39Z

## Goal

- 이번 작업의 목표: 데스크톱 통계 카드의 "처리 시간" 라벨과 sub 텍스트를 사용자가 한 눈에 의미를 파악할 수 있게 풀어쓴다. Badge 는 `평균 처리 시간` 으로 바꾸고, sub 라벨은 `lead {avgLead} / 누적 24h {duration24h}` 처럼 짧은 키만 적힌 형태에서 lead/누적 24h 의 실제 의미가 드러나는 한국어 표현으로 교체한다.

## References

- PRD: tickets/done/prd_220/prd_220.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_220]]
- Plan Note:
- Ticket Note: [[Todo-219]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_219`
- Branch: autoflow/tickets_219
- Base Commit: 42c46f1f1d5adc4272b202fc089c1f73f2c0f680
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T07:32:17Z
- Started Epoch: 1778311937
- Updated At: 2026-05-09T07:35:40Z
- Tick Count: 4
- Time Used Seconds: 203
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1126755827

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `apps/desktop/src/renderer/main.tsx` 의 처리 시간 카드 Badge 텍스트가 `처리 시간` 에서 `평균 처리 시간` 으로 변경되어 있다.
- [x] 같은 카드 sub 라인이 `lead {avgLead} / 누적 24h {duration24h}` 형태에서 lead 와 누적 24h 의 의미가 드러나는 풀어쓴 한국어 표현으로 교체되어 있다.
- [x] hover `title` 의 raw 디버그 표기(`n=, lead=Xs, active=Ys, ticks=Z, 24h=Ws`) 는 변경되지 않은 채 유지된다.
- [x] 다른 두 카드(`변경 코드량`, `토큰 사용량`) 의 Badge 텍스트 / sub / 정렬이 변경되지 않는다.
- [x] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_220/prd_220.md at 2026-05-09T06:28:29Z.

- Runtime hydrated worktree dependency at 2026-05-09T07:32:16Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T07:32:16Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T07:32:15Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_219
- No staged code changes found in worktree during merge preparation at 2026-05-09T07:33:32Z.
- Impl AI worker marked verification pass at 2026-05-09T07:33:32Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T07:33:32Z: post_merge_cleanup_failed
- No staged code changes found in worktree during merge preparation at 2026-05-09T07:34:07Z.
- Impl AI worker marked verification pass at 2026-05-09T07:34:07Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T07:34:07Z: post_merge_cleanup_failed
- Queued without worktree commit at 2026-05-09T07:35:39Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-09T07:35:38Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T07:35:39Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_219 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_219 deleted_branch=autoflow/tickets_219.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T07:35:39Z.
## Verification
- Result: passed by worker at 2026-05-09T07:35:38Z
- Log file: pending AI merge finalization

## Result

- Summary: 처리 시간 카드 Badge를 평균 처리 시간으로, sub 라인을 평균 대기시간/최근 24시간 누적 처리 풀어쓴 한국어 표현으로 교체
- Remaining risk:
