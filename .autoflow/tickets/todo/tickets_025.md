# Ticket

## Ticket

- ID: tickets_025
- PRD Key: prd_025
- Plan Candidate: Plan AI handoff from tickets/done/prd_025/prd_025.md
- Title: Audit AI progress stages and fix dot alignment so the bar matches runtime-observable signals
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-27T13:40:25Z

## Goal

- 이번 작업의 목표: 작업 흐름 페이지의 AI 카드 progress bar 를 런타임에서 실제로 구분 가능한 단계로만 표시하고, active dot / label / connector fill 의 중심 정렬을 모든 4단계 카드 상태와 wrap 상태에서 맞춘다.

## References

- PRD: tickets/done/prd_025/prd_025.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_025]]
- Plan Note:
- Ticket Note: [[tickets_025]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Done When

- [ ] Impl AI 카드가 정확히 4단계 (`대기 / 구현 / 완료 / 반려`) 만 표시한다.
- [ ] 4가지 상태 매핑이 위 In Scope 의 규칙대로 동작한다.
- [ ] Plan AI / Wiki AI 카드는 기존 4단계 그대로 유지된다.
- [ ] 어느 단계가 활성이든 dot 의 시각 중심이 그 단계 라벨 텍스트의 가로 중심과 일치한다 (시각 inspect 시 ≤ 2px 오차).
- [ ] 첫 단계가 활성일 때 dot 이 카드 좌측 padding 안에 잘리지 않고 라벨과 정렬된다 (스크린샷의 잘림 현상 사라짐).
- [ ] 마지막 단계가 활성일 때도 동일하게 우측 정렬.
- [ ] progress 가 두 줄로 wrap 되는 좁은 폭에서도 각 줄의 dot/라벨 정렬이 유지된다.
- [ ] `cd apps/desktop && npx tsc --noEmit` 가 0 errors.
- [ ] `cd apps/desktop && npm run check` 가 통과한다.
- [ ] 시각 회귀: 다른 페이지 영향 없음.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 가 todo 에서 claim 한 뒤 `ownerFlowStages`, `runnerStageKey()` ticket-owner 분기, `AiProgressRow` / progress fill 계산, `.ai-progress-*` CSS 정렬을 점검하고 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 를 todo 티켓으로 만들고, wiki/ticket context 를 반영해 Allowed Paths / Goal / Notes / Verification 을 구체화했다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 를 `tickets/done/prd_025/prd_025.md` 로 보관하고 `tickets/todo/tickets_025.md` 를 만들었다. 이후 `autoflow wiki query` 로 `ownerFlowStages`, `runnerStageKey`, `ai-progress-dot`, `progress wrap`, `prd_014`, `prd_021` 관련 선행 작업을 조회했다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `ownerFlowStages`, `plannerFlowStages`, `wikiBotFlowStages`, `runnerStageKey()`, `AiProgressRow` / progress percent 계산. CSS 는 `apps/desktop/src/renderer/styles.css` 의 `.ai-progress-track`, `.ai-progress-step`, `.ai-progress-dot`, wrap 관련 selector.

## Notes

- Created by AI-1 (Plan AI) from tickets/done/prd_025/prd_025.md at 2026-04-27T13:40:12Z.
- Plan AI refined at 2026-04-27T13:40:25Z: narrowed Allowed Paths to the two desktop renderer files named in the PRD, enriched Goal/Next Action/Verification, and added wiki/ticket context.
- Wiki context: `tickets/done/prd_014/tickets_014.md` fixed planner-stage mapping in `runnerStageKey()` and intentionally left Plan AI labels/styles unchanged. This ticket should preserve that planner behavior and focus owner mapping plus shared dot alignment.
- Wiki context: `tickets/done/prd_007/prd_007.md` introduced the owner progress card pattern and index-based progress calculation. Audit any `flowStages.length` / percent math after reducing Impl AI from 6 stages to 4 so fill endpoints still land on dot centers.
- Queue overlap: `tickets/inprogress/tickets_021.md` is actively changing workflow-card layout, progress wrap, and inline controls in the same two files. If that lands first, keep its wrap behavior and add dot/fill alignment on top instead of reverting it.
- Queue overlap: `tickets/todo/tickets_023.md` also touches `styles.css` around `.ai-progress-*` and workflow pins to remove left-border/tint accents. Do not reintroduce those visual accents; this ticket only changes stage count/mapping and dot/fill alignment.
- Scope constraints: no color/icon redesign, no left-border/card-shell changes, no start/stop/model selector changes, no Plan AI/Wiki AI stage label changes. If the 4-step owner bar remains semantically weak, leave a remaining-risk note for a future status-pill replacement instead of expanding scope.
- Implementation hints:
  1. Reduce `ownerFlowStages` to exactly 4 display stages: `대기`, `구현`, `완료`, `반려`. The `구현` meta should describe mini-plan / implementation / verification / merge integration as one runtime-observable bucket.
  2. Simplify the ticket-owner branch in `runnerStageKey()`: no active ticket -> `todo`; `executing|claimed|inprogress|verifying|ready_to_merge|merging` -> `inprogress`; `committed_via_inline_merge` or `event=adapter_finish.*status=ok` -> `done`; fail-like states -> `reject`.
  3. Preserve planner and wiki-maintainer 4-stage arrays and the `prd_014` planner mapping semantics.
  4. Inspect the dot-center/fill formula, especially `((stageIndex + 0.5) / flowStages.length) * 100` or equivalent, after the owner stage count changes.
  5. Adjust CSS so `.ai-progress-dot` is horizontally centered over the label/step, first/last dots are not clipped by track/card padding, and wrap lines keep label/dot alignment.
  6. Verify all active positions for owner/planner/wiki 4-step cards. Use non-Playwright browser/manual visual inspection if rendered behavior needs confirmation, and close any browser tab opened in the turn.

## Verification

- Run file:
- Log file:
- Command: `cd apps/desktop && npm run check`
- Result: pending

## Result

- Summary:
- Remaining risk:
