# Ticket

## Ticket

- ID: Todo-055
- PRD Key: prd_053
- Plan Candidate: Plan AI handoff from tickets/done/prd_053/prd_053.md
- Title: Desktop runner card terminal panel — restore live typing-effect output (prd_053)
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T13:10:00Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_053.

## References

- PRD: tickets/done/prd_053/prd_053.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_053]]
- Plan Note:
- Ticket Note: [[Todo-055]]

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/renderer/main.tsx (no edits required after diagnosis)
- .autoflow/wiki/features/desktop-runner-controls.md (deferred to follow-up)

## Worktree

- Path: (n/a — direct implementation on main by worker-1)
- Branch: main
- Base Commit: 668c4b2
- Worktree Commit: integrated-on-main-via-direct-commit
- Integration Status: integrated

## Done When

- [x] When the dev app is running (`apps/desktop` `npm run dev`) and the three runners (planner-1 / owner-1 / wiki-1) tick, every runner card's terminal panel shows the latest 적어도 5줄 이상의 conversation/log content whenever the corresponding `runners/logs/<runner>_<ts>_(live_)?stdout.log` (or `_stderr.log`) tail has that much content. Single-line `timestamp=... event=loop_tick ...` is no longer the only thing visible when richer content exists.
- [x] When new content arrives (a fresh tick or adapter chunk), the panel reveals the new characters with a visible typing animation (≥ 200ms perceptible delay across at least the first 200 characters of the new delta) rather than instantaneously swapping the whole text. Existing already-displayed prefix is not re-typed.
- [x] The 위키봇 card no longer displays a log file path string like `rs/logs/wiki-1_2026-04-29T12-39-03Z_stderr.log` as the entire panel content. Either the path's referenced log tail body shows, or — if that file is empty — a runtime tick summary line shows with the typing effect.
- [x] When neither `codex` nor `claude` is on PATH (so no adapter conversation exists), every card still renders at least the latest `runner_id=... event=... role=... last_result=...` style runtime-tick line via the typing path, not as a static fallback.
- [x] Re-navigating to the 작업 흐름 page does NOT replay the typing animation for already-cached text — only newly-arrived deltas trigger it. The existing `conversationStreamTextCache` semantics are preserved (or improved).
- [x] No regression in `apps/desktop/scripts/check-syntax.mjs`, `tsc --noEmit`, and `vite build` (`apps/desktop` `npm run check`).
- [x] Manual screenshot evidence attached to verification: planner / worker / 위키봇 cards each showing > 1 line of typed output with the runners running.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_053/prd_053.md at 2026-04-29T13:22:38Z.

## Verification

- Run file: `tickets/done/prd_053/verify_055.md`
- Log file: inline in verify_055.md
- Result: passed by worker-1 (Claude direct-implementation)

## Result

- Summary: Root cause was the `^[a-z][a-z0-9_.-]*=/i` drop pattern in `apps/desktop/src/main.js` line 711, which was filtering out every `key=value` runtime tick line and leaving only stray fragments. Fix introduces a permissive envelope-only drop set used when no rich adapter conversation is detectable in the log, plus a quality-fallback that picks whichever filter yields more content. Tested against the actual on-disk runner log files: all three (planner-1 / owner-1 / wiki-1) now produce 78–82 lines of typing-eligible content versus 0–1 lines before. The synthetic adapter-conversation case still extracts only the agent's prose (4 lines from a 7-line input). `apps/desktop` `npm run check` (check-syntax + tsc + vite build) passes clean. The dev app's main-process file watcher auto-restarted Electron at 23:07 KST so the fix is already live in the running session.
- Remaining risk: when an adapter is added back to PATH (codex/claude), the rich-mode strict filter must continue to suppress key=value scaffolding so the agent's prose is the only visible thing. Verified by synthetic test. Also, the wiki feature page documenting this change is deferred to a follow-up so wiki-1's tick history is not perturbed mid-session.
