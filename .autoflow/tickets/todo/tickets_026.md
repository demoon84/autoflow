# Ticket

## Ticket

- ID: tickets_026
- PRD Key: prd_026
- Plan Candidate: Plan AI handoff from tickets/done/prd_026/prd_026.md
- Title: Fix Gemini app icon in Desktop AI runner UI
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-27T13:57:41Z

## Goal

- 이번 작업의 목표: Replace the odd generic Gemini fallback icon shown in the Desktop AI runner card with a polished local Gemini image icon that visually matches the Codex and Claude app icons.

## References

- PRD: tickets/done/prd_026/prd_026.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_026]]
- Plan Note:
- Ticket Note: [[tickets_026]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css
- apps/desktop/src/renderer/assets/agent-icons/gemini.png

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Done When

- [ ] Gemini runner cards display a Gemini image icon instead of the current gray bordered Sparkles fallback.
- [ ] The Gemini icon aligns visually with existing Codex and Claude icons: same apparent size, no clipping, no extra border shell, no awkward padding.
- [ ] Codex and Claude icon rendering remains unchanged.
- [ ] Unknown/fallback agents still render the generic Sparkles fallback.
- [ ] The change does not alter Gemini runner models, reasoning support, runner config, or adapter behavior.
- [ ] Desktop visual check confirms the Gemini row/card no longer matches the reported screenshot issue.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 todo 에서 claim 한 뒤 Gemini icon asset 을 local checked-in PNG 로 추가하고, `AgentAppIcon` 의 `gemini` branch 를 Codex/Claude 와 같은 image asset path 로 맞춘다. `npm --prefix apps/desktop run check` 와 Desktop AI management/progress visual check evidence 를 남긴다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성하고 PRD 기준으로 Allowed Paths, Goal, Next Action, Verification 을 좁혔다.
- 직전 작업: `scripts/start-plan.sh` 가 `tickets/backlog/prd_026.md` 를 `tickets/done/prd_026/prd_026.md` 로 보관하고 `tickets/todo/tickets_026.md` 를 만들었다. Plan AI 는 그 직후 wiki pass 를 반영해 이 티켓을 보강했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_026/prd_026.md`, `apps/desktop/src/renderer/main.tsx` 의 `AgentAppIcon`, 기존 `claude.png`/`codex.png` asset handling, and `styles.css` Gemini fallback styles.
- Wiki context: `./bin/autoflow wiki query . --term "Gemini app icon" --term AgentAppIcon --term "apps/desktop/src/renderer/main.tsx" --term "agent-icons" --term Sparkles --limit 8` and the follow-up Gemini runner query surfaced no prior Gemini icon implementation. Related done tickets show this area has frequent narrow Desktop renderer edits; keep scope limited to this ticket's three paths.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_026/prd_026.md at 2026-04-27T13:57:23Z.
- Planner wiki finding: `tickets/done/prd_017/{prd_017.md,tickets_017.md,verify_017.md}` explicitly preserved Codex/OpenCode/Gemini reasoning behavior while changing Claude only, so this ticket must not alter Gemini runner model or reasoning logic.
- Planner wiki finding: `tickets/done/prd_013/tickets_013.md` and `tickets/done/prd_003/reject_003.md` point to prior Desktop renderer/style conflict risk from broad or unisolated edits. This ticket should stay in the listed Allowed Paths and avoid layout redesign.
- PRD note: existing `claude.png` and `codex.png` are 128x128 local PNG assets under `apps/desktop/src/renderer/assets/agent-icons/`; Gemini should use the same local asset pattern, not a remote hotlink.

## Verification

- Run file:
- Log file:
- Result: pending
- Command: `npm --prefix apps/desktop run check`
- Visual: use the current agent desktop/browser tool if available to confirm the Gemini AI runner row/card no longer shows the gray bordered Sparkles fallback. Do not use Playwright.

## Result

- Summary:
- Remaining risk:
