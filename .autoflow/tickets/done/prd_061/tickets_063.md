# Ticket

## Ticket

- ID: tickets_063
- PRD Key: prd_061
- Plan Candidate: Plan AI handoff from tickets/done/prd_061/prd_061.md
- Title: Rename desktop memo labels to order
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-04-29T23:47:50Z

## Goal

- 이번 작업의 목표: `/order` quick intake 흐름에 맞춰 데스크톱 대시보드와 인박스에서 사용자에게 보이는 옛 `MEMO`/`Memo`/`메모` 표기를 `ORDER`/`Order`/`오더` 계열로 통일한다. 파일 이름, board stage, parser가 읽는 `memo_NNN.md` prefix는 그대로 유지한다.

## References

- PRD: tickets/done/prd_061/prd_061.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_061]]
- Plan Note:
- Ticket Note: [[tickets_063]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_063`
- Branch: autoflow/tickets_063
- Base Commit: 15bb80de0f4e23f8d44f2e05785e7528df051968
- Worktree Commit: 0d73b96ed5854853d09477506b6d32743904029e
- Integration Status: integrated

## Done When

- [ ] 대시보드 workflow pin 카드와 레이어 제목이 `MEMO N건` 대신 `ORDER N건`으로 표시된다.
- [ ] `memo_NNN.md` 항목의 사용자 노출 prefix가 `Memo-NNN` 대신 `Order-NNN`으로 표시된다.
- [ ] 항목 우측 badge 또는 state label이 `MEMO` 대신 `ORDER`로 표시된다.
- [ ] 인박스 탭/목록/빈 상태/도움말의 한국어 사용자 문구에서 `메모` 표현이 사라지고 `오더` 표현으로 통일된다.
- [ ] 실제 board 파일명, `tickets/inbox/memo_NNN.md` 스캐닝, `memo` kind/status key, CLI 호환 이름은 바뀌지 않는다.
- [ ] `apps/desktop` check command가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_030.md` 를 `tickets/done/prd_061/prd_061.md` 로 승격하고 이 todo 티켓을 생성했다.
- 직전 작업: wiki context pass 결과 이 copy rename 을 직접 제약하는 선행 기록은 없었다. `rg -n "MEMO|Memo-|메모|memo" apps/desktop/src/renderer/main.tsx` 로 사용자 노출 후보가 desktop renderer 한 파일에 모여 있음을 확인했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_061/prd_061.md`, `apps/desktop/src/renderer/main.tsx` 의 `workspaceBoardSections`, `boardStatusMeta.inbox`, `displayBoardFileName`, inbox empty text, workflow memo pin title/state label/layer help text.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_061/prd_061.md at 2026-04-29T22:43:29Z.
- Source memo archived at `tickets/done/prd_061/memo_030.md`.
- Wiki context command: `./bin/autoflow wiki query . .autoflow --term "데스크톱 UI MEMO 표기 ORDER 통일" --term "memo에서 order로 변경 대시보드 인박스 MEMO 배지 Memo-029 빠른 메모" --term "apps/desktop/src/renderer/main.tsx inbox memo order label" --term "prd terminology rename order memo" --term "worker display policy user-visible labels" --limit 10 --runner planner-1`.
- Wiki context result: `result_count=0`; 이 copy rename 을 직접 제약하는 선행 wiki/ticket 기록은 없었다.
- Planning constraint: 사용자 노출 표기만 변경한다. `tickets/inbox/memo_NNN.md`, `memo` TypeScript kind/status key, board scanner, CLI compatibility names 는 parser/runtime 호환을 위해 유지한다.
- Owner wiki context pass: `./bin/autoflow wiki query --term "Rename desktop memo labels to order" --term "apps/desktop/src/renderer/main.tsx inbox memo order label" --term "Memo-NNN ORDER 오더" --term "workflow pin MEMO"` returned `result_count=0`. A broader display-label query surfaced `wiki/decisions/worker-display-policy.md`, reinforcing the pattern that user-visible labels may change while storage ids stay stable.
- Mini-plan: update only `apps/desktop/src/renderer/main.tsx` display copy/mapping for inbox memo artifacts: `Memo-` -> `Order-`, `MEMO` -> `ORDER`, selected kind label -> `Order`, and Korean user text from `메모` to `오더`. Keep `memo` TypeScript kind/status keys, `memo_NNN.md` scanner predicates, and board paths unchanged. Then run the PRD verification command from the ticket worktree and inspect the remaining matches.

- Runtime hydrated worktree dependency at 2026-04-29T23:44:21Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-04-29T23:44:21Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_063; run=tickets/inprogress/verify_063.md
- Implemented display-only rename in `apps/desktop/src/renderer/main.tsx`: inbox/workflow labels now use `Order`, `ORDER`, `Order-`, and `오더`; internal `memo` kind/status keys and `memo_*.md` scanner names remain unchanged.
- Verification passed in ticket worktree and PROJECT_ROOT with `bash -lc 'npm --prefix apps/desktop run check && ! rg -n "MEMO|Memo-|빠른 메모|인박스 메모|메모 목록|메모 본문|들어온 메모|메모가 없습니다" apps/desktop/src/renderer/main.tsx'`.
- Merge note: PROJECT_ROOT already had unrelated unstaged changes in `apps/desktop/src/renderer/main.tsx` for the logs settings UI. The AI owner preserved those changes, applied only this ticket's verified hunks, and staged only this ticket's patch for commit.
- Prepared worktree commit 0d73b96ed5854853d09477506b6d32743904029e at 2026-04-29T23:47:49Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker marked verification pass at 2026-04-29T23:47:49Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-04-29T23:47:50Z: AI already integrated worktree commit 0d73b96ed5854853d09477506b6d32743904029e into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-04-29T23:47:50Z.
- Coordinator post-merge cleanup at 2026-04-29T23:47:50Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_063 deleted_branch=autoflow/tickets_063.
## Verification
- Run file: `tickets/done/prd_061/verify_063.md`
- Log file: `logs/verifier_063_20260429_234750Z_pass.md`
- Result: passed

## Result

- Summary: desktop memo labels display as order
- Remaining risk: Low; no browser check was required for this copy-only change, and the configured desktop check plus forbidden-string search passed.
