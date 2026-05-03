# Ticket

## Ticket

- ID: tickets_128
- PRD Key: prd_130
- Plan Candidate: Plan AI handoff from tickets/done/prd_130/prd_130.md
- Title: AI 진행 현황 runner 카드 표시 순서 고정
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T08:47:06Z

## Goal

- 이번 작업의 목표: 데스크톱 앱 `AI 진행 현황` 화면에서 enabled runner 카드 표시 순서를 config 정의 순서와 무관하게 `[오케스트레이터, 워커, 검증, 위키]` 로 고정한다.

## References

- PRD: tickets/done/prd_130/prd_130.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_130]]
- Plan Note:
- Ticket Note: [[tickets_128]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_128`
- Branch: autoflow/tickets_128
- Base Commit: 7b1c537af0dea7dcbe6408f5ebb4bd92d2a83ec9
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T08:44:08Z
- Started Epoch: 1777797848
- Updated At: 2026-05-03T08:47:07Z
- Tick Count: 3
- Time Used Seconds: 179
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 24847967

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `apps/desktop/src/renderer/main.tsx` 의 `AIProgressBoard` 가 `board.runners` 를 그대로 map 하지 않고 표시 전용 role 우선순위로 정렬한다.
- [x] enabled runner 4개가 `planner`, `worker` 또는 `ticket-owner`, `wiki` 또는 `wiki-maintainer`, `verifier` 순서로 config 에 들어와도 화면 렌더링 순서는 `[오케스트레이터, 워커, 검증, 위키]` 가 된다.
- [x] enabled runner 3개가 `planner`, `worker` 또는 `ticket-owner`, `wiki` 또는 `wiki-maintainer` 만 있을 때 기존 `[오케스트레이터, 워커, 위키]` 순서를 유지한다.
- [x] 알 수 없는 신규 role 은 알려진 네 role 뒤로 배치되고, 같은 fallback 그룹 안에서는 기존 config 순서를 유지한다.
- [x] `apps/desktop/src/renderer/styles.css` 의 4-column desktop layout 은 변경하지 않는다.
- [x] 구현은 `apps/desktop/src/renderer/main.tsx` 안에만 머문다.
- [x] `npm run desktop:check` 가 exit 0 으로 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `apps/desktop/src/renderer/main.tsx` 에 `sortProgressBoardRunners()` / `progressBoardRunnerOrder()` 를 추가했고, `AIProgressBoard` 는 `self-improve` 제외 후 표시 전용 stable sort 결과를 렌더링한다.
- 직전 작업: worktree 와 PROJECT_ROOT 양쪽에 같은 `main.tsx` 변경을 반영하고 각각 `npm run desktop:check` 를 직접 실행해 exit 0 을 확인했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_128.md` 의 manual verification correction 과 PROJECT_ROOT `apps/desktop/src/renderer/main.tsx` diff.
- Guard warning context: `bin/autoflow guard` at 2026-05-03T08:33:43Z reported leftover worktree candidate `autoflow/tickets_119` with no board ticket; planner left the worktree untouched because cleanup is outside this order promotion.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_130/prd_130.md at 2026-05-03T08:33:25Z.
- Planner wiki context at 2026-05-03T08:33:43Z: `bin/autoflow wiki query --term "AI 진행 현황 runner card order verifier wiki desktop main.tsx ai-progress-board" --rag` returned `result_count=0`; no prior wiki constraint was found for this exact order.
- Related completed ticket: `tickets/done/prd_124/tickets_123.md` changed the same AI progress board to a 4-column desktop grid and kept `main.tsx` ordering semantics unchanged. Preserve that CSS behavior and keep this ticket limited to display-order sorting in `main.tsx`.
- Planner inspection at 2026-05-03T08:33:43Z: current `AIProgressBoard` filters `self-improve` from `board.runners` and renders `runners.map(...)`; `.autoflow/runners/config.toml` currently lists `wiki` before `verifier`, which explains the observed DOM/display order.

- Runtime hydrated worktree dependency at 2026-05-03T08:44:07Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T08:44:07Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_128; run=tickets/inprogress/verify_128.md
- AI worker mini-plan at 2026-05-03T08:44:20Z: `start-ticket-owner` returned `status=resume`, `worktree_status=ready`; wiki context query for `AI 진행 현황 runner card order verifier wiki desktop main.tsx AIProgressBoard displayWorkflowRunnerId` returned `result_count=0`. Implement display-only stable sorting in `apps/desktop/src/renderer/main.tsx`: keep filtering `self-improve`, rank planner/plan/orchestrator before ticket-owner/worker/ticket/owner, verifier/verification/veri before wiki-maintainer/wiki, then unknown roles; keep unknown same-rank order by original config index. Do not edit `styles.css` or runner config.
- AI worker prepared resume at 2026-05-03T08:44:24Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_128; run=tickets/inprogress/verify_128.md
- Ticket owner verification failed by worker at 2026-05-03T08:45:49Z: command exited 127
- Manual verification correction at 2026-05-03T08:45:59Z: the helper failure came from command quoting (`bash: >: command not found`) after Vite emitted its normal chunk-size warning. AI owner directly ran `npm run desktop:check` in the ticket worktree and then in PROJECT_ROOT; both completed with exit 0. PROJECT_ROOT has unrelated pre-existing dirty files under `.autoflow/telemetry`, `.autoflow/wiki/`, and `.autoflow/tickets/inbox/order_120.md`; ticket product diff is limited to `apps/desktop/src/renderer/main.tsx`.
- Queued without worktree commit at 2026-05-03T08:47:06Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T08:47:06Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T08:47:06Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_128 deleted_branch=autoflow/tickets_128.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T08:47:06Z.
## Verification
- Run file: `tickets/done/prd_130/verify_128.md`
- Log file: `logs/verifier_128_20260503_084707Z_pass.md`
- Result: passed

## Result

- Summary: AI 진행 현황 runner 카드 표시 순서 고정
- Remaining risk: Vite still emits the existing large chunk warning during `desktop:check`; it does not fail the command.
