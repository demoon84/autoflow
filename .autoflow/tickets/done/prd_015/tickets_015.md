# Ticket

## Ticket

- ID: tickets_015
- PRD Key: prd_015
- Plan Candidate: Plan AI handoff from tickets/done/prd_015/prd_015.md
- Title: Show pending PRD count alongside total in workflow pin label
- Stage: done
- AI: 019dcee6-0b20-7252-9b42-47a5e7cda19d
- Claimed By: 019dcee6-0b20-7252-9b42-47a5e7cda19d
- Execution AI: 019dcee6-0b20-7252-9b42-47a5e7cda19d
- Verifier AI: 019dcee6-0b20-7252-9b42-47a5e7cda19d
- Last Updated: 2026-04-27T12:31:30Z

## Goal

- 이번 작업의 목표: 데스크톱 작업 흐름 페이지의 PRD 핀 라벨이 누적 PRD 수만 보여주는 현재 표기 (`PRD 14건`) 에서, 아직 처리되지 않고 backlog 에 남은 대기 PRD 수를 함께 노출해 (`PRD 14건 · 대기 N건`) 사용자가 잔여 작업량을 즉시 인지할 수 있게 한다. `backlogSpecs.length` 를 활용해 `pinTitle` 과 `layerHeading` 문자열만 변경하면 되는 단일 파일 수정.

## References

- PRD: tickets/done/prd_015/prd_015.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_015]]
- Plan Note:
- Ticket Note: [[tickets_015]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx` (modify only the PRD WorkflowPinLayer `pinTitle` and `layerHeading` props at lines ~4019 and ~4022 — do not change the reject pin, layer internals, other pages, or CSS)

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_015`
- Branch: autoflow/tickets_015
- Base Commit: 4629581b08ff2026b93f8b294d1b872e4bac1514
- Worktree Commit:
- Integration Status: no_code_changes

## Done When

- [x] `tickets/backlog/` 에 처리 대기 PRD 가 N(>0)건 있으면 핀 라벨이 `PRD ${total}건 · 대기 ${N}건` 형식으로 표시된다.
- [x] backlog 가 비었을 때는 핀 라벨이 `PRD ${total}건` 만으로 표시되고 `· 대기 0건` 같은 노이즈가 붙지 않는다.
- [x] 핀을 펼친 layer 의 헤딩 (`layerHeading`) 도 핀 라벨과 동일한 문자열로 일치한다.
- [x] `cd apps/desktop && npx tsc --noEmit` 가 0 errors 로 통과한다.
- [x] `cd apps/desktop && npm run check` 가 통과한다.
- [x] dev 앱에서 backlog 에 PRD 1~2건이 떠 있을 때 라벨에 `· 대기 1건` / `· 대기 2건` 이 즉시 반영되는 것이 시각적으로 확인된다.

## Next Action
- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Implementation and owner verification passed. PRD pin title now includes pending backlog count only when `backlogSpecs.length > 0`, and `layerHeading` reuses the same string.
- 직전 작업: `npx tsc --noEmit`, `npm run check`, owner verification, and rendered local app checks passed.
- 재개 시 먼저 볼 것: Finish pass / ready-to-merge routing; coordinator will integrate into `PROJECT_ROOT`.

## Notes

- Created by demoon@gomgom:73608 (Plan AI) from tickets/done/prd_015/prd_015.md at 2026-04-27T12:16:57Z.

- Runtime hydrated worktree dependency at 2026-04-27T12:25:06Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T12:25:06Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI 019dcee6-0b20-7252-9b42-47a5e7cda19d prepared todo at 2026-04-27T12:25:06Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_015; run=tickets/inprogress/verify_015.md
- Mini-plan at 2026-04-27T12:25:59Z:
  1. Compute one shared PRD pin label from `specFiles.length` and `backlogSpecs.length`, omitting the pending suffix when backlog is empty.
  2. Reuse that label for both `pinTitle` and `layerHeading` in the PRD `WorkflowPinLayer`; leave reject pin behavior untouched.
  3. Verify with `npx tsc --noEmit`, `npm run check`, and the ticket owner verification script.
- Wiki context: `autoflow wiki query` terms `PRD WorkflowPinLayer`, `backlogSpecs pinTitle layerHeading`, and `tickets_015 prd_015` returned only `tickets/done/prd_015/prd_015.md`, matching the current ticket scope.
- Ticket owner verification failed by 019dcee6-0b20-7252-9b42-47a5e7cda19d at 2026-04-27T12:27:41Z: command exited 127
- Ticket owner verification passed by 019dcee6-0b20-7252-9b42-47a5e7cda19d at 2026-04-27T12:28:10Z: command exited 0
- Verification evidence at 2026-04-27T12:30:40Z:
  - `cd apps/desktop && npx tsc --noEmit` passed.
  - `cd apps/desktop && npm run check` passed.
  - Owner runtime verification passed with `cd apps/desktop && npm run check`.
  - Local rendered check with mocked board data showed `PRD 3건 · 대기 2건` in the pin, the opened dialog heading also `PRD 3건 · 대기 2건`, and a zero-backlog board showed `PRD 1건` with no `대기 0건` suffix.
- Allowed path was not present in worktree during merge preparation at 2026-04-27T12:31:30Z, so it was skipped: apps/desktop/src/renderer/main.tsx (modify only the PRD WorkflowPinLayer pinTitle and layerHeading props at lines ~4019 and ~4022 — do not change the reject pin, layer internals, other pages, or CSS)
- No staged code changes found in worktree during merge preparation at 2026-04-27T12:31:30Z.
- Impl AI 019dcee6-0b20-7252-9b42-47a5e7cda19d marked verification pass at 2026-04-27T12:31:30Z and triggered inline merge.
- Coordinator 019dcee6-0b20-7252-9b42-47a5e7cda19d finalized this verified ticket at 2026-04-27T12:31:30Z.
## Verification
- Run file: `tickets/done/prd_015/verify_015.md`
- Log file: `logs/verifier_015_20260427_123130Z_pass.md`
- Result: passed

## Result

- Summary: PRD workflow pin label now shows nonzero pending backlog count and reuses the label for the layer heading.
- Remaining risk: Coordinator merge pending; no known owner-side blockers.
