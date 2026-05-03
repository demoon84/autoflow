# Ticket

## Ticket

- ID: tickets_144
- PRD Key: prd_145
- Plan Candidate: Plan AI handoff from tickets/done/prd_145/prd_145.md
- Title: priority scheduling for orders PRDs tickets and verifier queue
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T11:42:07Z

## Goal

- 이번 작업의 목표: 인박스 order, backlog PRD, todo ticket, verifier queue가 파일 번호 오름차순만 따르지 않고 `critical`, `high`, `normal`, `low` 우선순위를 먼저 반영하도록 공통 정렬 경로와 데스크톱 표시를 추가한다.

## References

- PRD: tickets/done/prd_145/prd_145.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_145]]
- Plan Note:
- Ticket Note: [[tickets_144]]

## Allowed Paths

- `.autoflow/scripts/common.sh`
- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-verifier.sh`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/agents/verifier-agent.md`
- `AGENTS.md`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_144`
- Branch: autoflow/tickets_144
- Base Commit: 52ac1c7513f7ba5ad303345d177de3929f8fd990
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T11:36:55Z
- Started Epoch: 1777808215
- Updated At: 2026-05-03T11:42:09Z
- Tick Count: 3
- Time Used Seconds: 314
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1589670008

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `.autoflow/scripts/common.sh` exposes a priority extraction helper that returns rank `0`, `1`, `2`, or `3` for frontmatter, body field, title marker, and fallback cases.
- [x] `list_matching_files` sorts by priority rank first, numeric id second, and path third; `lowest_matching_file` therefore selects critical/high files before normal/low files without changing its caller contract.
- [x] Planner inbox/backlog selection, ticket-owner todo claim, and legacy verifier claim all use the priority-aware helper path without each caller reimplementing priority parsing.
- [x] Existing files without priority metadata still sort as `normal` and retain numeric FIFO order.
- [x] Desktop ticket workspace and inbox order cards show `critical` / `high` priority clearly and sort items by priority before modified time or filename fallback.
- [x] Runner and project instructions define when to use `critical`, `high`, `normal`, and `low`, and warn that `critical` is reserved for host resource, board integrity, security, or self-recovery threats.
- [x] Implementation stays inside the Allowed Paths.
- [x] `bash -lc 'for f in .autoflow/scripts/common.sh .autoflow/scripts/start-plan.sh .autoflow/scripts/start-ticket-owner.sh .autoflow/scripts/start-verifier.sh; do bash -n "$f"; done && npm run desktop:check'` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_137`을 `prd_145`와 `tickets_144`로 승격했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 145`가 `prd_145`를 `tickets/done/prd_145/prd_145.md`로 보관하고 `tickets/todo/tickets_144.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_145/prd_145.md`, `.autoflow/scripts/common.sh`의 `list_matching_files` / `lowest_matching_file`, `start-plan.sh`의 `select_inbox_order`와 backlog selection, `start-ticket-owner.sh`의 todo claim, `start-verifier.sh`의 verifier selection, `apps/desktop/src/renderer/main.tsx`의 `markdownScalar`, `extractTicketWorkspaceMeta`, ticket workspace kanban rendering.
- Wiki/ticket constraints: wiki RAG는 `tickets/done/prd_144/prd_144.md` lines 53-78 1건만 반환했다. `prd_144`는 priority scheduling을 out of scope로 둔 listRunners fork-bomb PRD이므로 이번 작업은 queue priority ordering에 집중하고 `tickets_143` process cleanup 범위로 넓히지 않는다.
- 구현/검증 결과: worktree와 PROJECT_ROOT 모두에서 `bash -lc 'for f in .autoflow/scripts/common.sh .autoflow/scripts/start-plan.sh .autoflow/scripts/start-ticket-owner.sh .autoflow/scripts/start-verifier.sh; do bash -n "$f"; done && npm run desktop:check'`가 exit 0으로 통과했다. Vite chunk-size warning은 기존 빌드 경고이며 실패가 아니다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_145/prd_145.md at 2026-05-03T11:28:32Z.
- Planner wiki pass: `bin/autoflow wiki query --term "priority order PRD todo verify list_matching_files extract_priority_rank" --term "autoflow order create priority critical high normal low" --term "resource exhaustion DOS PID fan-out token budget rate limit anomaly detection fork-bomb" --term "orchestration intervention check ledger tickets/check automatic intervention history" --term "desktop listRunners IPC fork-bomb runners-project.sh child process timeout" --limit 12 --rag` returned `result_count=1`.
- Relevant prior ticket: `tickets/done/prd_144/prd_144.md` confirms listRunners fork-bomb protection and leaves priority scheduling outside that PRD; do not modify `apps/desktop/src/main.js` or `packages/cli/runners-project.sh` for this ticket.
- Repository context: `list_matching_files` currently uses filename `sort`, and all four requested queues already route through `list_matching_files` / `lowest_matching_file`; keep priority parsing centralized instead of duplicating sorting policy in each caller.
- Related pending order: `tickets/inbox/order_138.md` owns `autoflow order create --priority` and `/order` skill priority insertion. This ticket should parse priority metadata and markers, but should not implement the input-side CLI option unless a later planner ticket expands scope.

- Runtime hydrated worktree dependency at 2026-05-03T11:36:54Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T11:36:53Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_144; run=tickets/inprogress/verify_144.md
- AI worker prepared resume at 2026-05-03T11:37:11Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_144; run=tickets/inprogress/verify_144.md
- AI worker mini-plan at 2026-05-03T11:45:00Z: add centralized `extract_priority_rank` in `.autoflow/scripts/common.sh`, make `list_matching_files` emit priority-rank/numeric-id/path ordering while preserving its path-only caller contract, adjust backlog union selection in `start-plan.sh` so priority is not lost by an outer filename sort, add desktop markdown priority parsing/badges/sort to ticket workspace and inbox order cards, and document `critical`/`high`/`normal`/`low` usage in runner/project instructions. Wiki context still only found `tickets/done/prd_144/prd_144.md` listRunners boundary, so this work stays focused on queue priority ordering.
- AI worker verification at 2026-05-03T11:58:00Z: priority helper smoke confirmed rank/order behavior; worktree and PROJECT_ROOT verification command exited 0; `git diff --check` was clean for all Allowed Paths.
- Queued without worktree commit at 2026-05-03T11:42:07Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T11:42:06Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T11:42:07Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_144 deleted_branch=autoflow/tickets_144.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T11:42:07Z.
## Verification
- Run file: `tickets/done/prd_145/verify_144.md`
- Log file: `logs/verifier_144_20260503_114209Z_pass.md`
- Result: passed

## Result

- Summary: priority-aware queue ordering and desktop priority badges
- Remaining risk: Desktop verification was non-browser build/type verification only; no rendered browser screenshot was required by the ticket.
